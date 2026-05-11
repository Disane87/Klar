import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { AccountEditDialogComponent } from './account-edit-dialog.component';
import { AccountsService } from '../../core/accounts/accounts.service';
import { FintsStore } from '../../core/fints/fints.store';
import { HouseholdStore } from '../../core/household/household.store';
import { KlarToastService } from '../../shared/ui/klar-toast.service';

function setup(opts: {
  initialName?: string;
  initialSyncEnabled?: boolean;
  updateImpl?: ReturnType<typeof vi.fn>;
} = {}) {
  const update = opts.updateImpl ?? vi.fn().mockReturnValue(of({}));
  const reload = vi.fn();
  const close = vi.fn();
  const success = vi.fn();
  const error = vi.fn();

  TestBed.configureTestingModule({
    imports: [AccountEditDialogComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: AccountsService, useValue: { update } },
      { provide: FintsStore, useValue: { reload } },
      { provide: HouseholdStore, useValue: { activeId: signal('hh-1') } },
      { provide: KlarToastService, useValue: { success, error } },
      { provide: DialogRef, useValue: { close } },
    ],
  });

  const fixture = TestBed.createComponent(AccountEditDialogComponent);
  TestBed.runInInjectionContext(() => {
    fixture.componentRef.setInput('accountId', 'acc-1');
    fixture.componentRef.setInput('initialName', opts.initialName ?? 'Girokonto');
    fixture.componentRef.setInput('initialSyncEnabled', opts.initialSyncEnabled ?? true);
  });
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, update, reload, close, success, error };
}

describe('AccountEditDialogComponent', () => {
  it('starts pristine and rejects unchanged save', async () => {
    const { component, update } = setup();
    expect(component.dirty()).toBe(false);
    await component.onSave();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects empty name', async () => {
    const { component, update } = setup({ initialName: 'Foo' });
    component.name.set('   ');
    expect(component.nameValid()).toBe(false);
    await component.onSave();
    expect(update).not.toHaveBeenCalled();
  });

  it('sends only changed fields and reloads on success', async () => {
    const { component, update, reload, close } = setup({
      initialName: 'Old',
      initialSyncEnabled: true,
    });
    component.name.set('New');
    component.syncEnabled.set(false);
    await component.onSave();
    expect(update).toHaveBeenCalledWith('hh-1', 'acc-1', { name: 'New', syncEnabled: false });
    expect(reload).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('omits name patch when only sync toggles', async () => {
    const { component, update } = setup({ initialName: 'Foo', initialSyncEnabled: true });
    component.syncEnabled.set(false);
    await component.onSave();
    expect(update).toHaveBeenCalledWith('hh-1', 'acc-1', { syncEnabled: false });
  });

  it('surfaces backend error in callout, keeps dialog open', async () => {
    const update = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { detail: 'Nur der Inhaber …' } })));
    const { component, close } = setup({ updateImpl: update });
    component.name.set('Neu');
    await component.onSave();
    expect(component.errorMessage()).toBe('Nur der Inhaber …');
    expect(close).not.toHaveBeenCalled();
  });
});
