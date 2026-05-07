import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { KlarConfirmDialogComponent, type KlarConfirmDialogData } from './klar-confirm-dialog.component';

describe('KlarConfirmDialogComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarConfirmDialogComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents(),
  );

  function makeData(over: Partial<KlarConfirmDialogData> = {}): KlarConfirmDialogData {
    return {
      message: 'Wirklich löschen?',
      resolve: () => {},
      ...over,
    };
  }

  it('renders the message', () => {
    const fx = TestBed.createComponent(KlarConfirmDialogComponent);
    fx.componentRef.setInput('data', makeData());
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('Wirklich löschen?');
  });

  it('renders detail when provided', () => {
    const fx = TestBed.createComponent(KlarConfirmDialogComponent);
    fx.componentRef.setInput('data', makeData({ detail: 'Hat Buchungen → wird archiviert.' }));
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('archiviert');
  });

  it('uses default labels when none given', () => {
    const fx = TestBed.createComponent(KlarConfirmDialogComponent);
    fx.componentRef.setInput('data', makeData());
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('Abbrechen');
    expect(fx.nativeElement.textContent).toContain('Bestätigen');
  });

  it('uses custom labels when provided', () => {
    const fx = TestBed.createComponent(KlarConfirmDialogComponent);
    fx.componentRef.setInput('data', makeData({ confirmLabel: 'Löschen', cancelLabel: 'Doch nicht' }));
    fx.detectChanges();
    expect(fx.nativeElement.textContent).toContain('Doch nicht');
    expect(fx.nativeElement.textContent).toContain('Löschen');
  });

  it('resolves false on cancel', () => {
    let resolved: boolean | undefined;
    const fx = TestBed.createComponent(KlarConfirmDialogComponent);
    fx.componentRef.setInput('data', makeData({ resolve: (v) => (resolved = v) }));
    fx.detectChanges();
    fx.componentInstance.onCancel();
    expect(resolved).toBe(false);
  });

  it('resolves true on confirm', () => {
    let resolved: boolean | undefined;
    const fx = TestBed.createComponent(KlarConfirmDialogComponent);
    fx.componentRef.setInput('data', makeData({ resolve: (v) => (resolved = v) }));
    fx.detectChanges();
    fx.componentInstance.onConfirm();
    expect(resolved).toBe(true);
  });
});
