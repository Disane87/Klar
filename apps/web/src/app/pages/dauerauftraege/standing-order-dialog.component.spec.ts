import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { StandingOrderDialogComponent } from './standing-order-dialog.component';
import { StandingOrdersStore } from '../../core/standing-orders/standing-orders.store';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { FintsStore } from '../../core/fints/fints.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import type { StandingOrder } from '../../core/standing-orders/standing-orders.store';

const makeOrder = (overrides: Partial<StandingOrder> = {}): StandingOrder => ({
  id: 'so-1',
  householdId: 'h-1',
  accountId: 'acc-1',
  source: 'FINTS_DERIVED',
  counterpartyName: 'Vermieter GmbH',
  counterpartyIban: 'DE89370400440532013000',
  amountCents: -80000,
  currency: 'EUR',
  frequency: 'MONTHLY',
  lastSeenAt: '2026-04-01',
  nextExpectedAt: '2026-05-01',
  categoryId: 'cat-1',
  note: null,
  isActive: true,
  bankFieldsLockedAt: '2026-04-01',
  firstSeenAt: '2026-01-01',
  ...overrides,
});

describe('StandingOrderDialogComponent', () => {
  let storeCreate: ReturnType<typeof vi.fn>;
  let storeUpdate: ReturnType<typeof vi.fn>;

  function setup(mode: 'create' | 'edit', item?: StandingOrder) {
    storeCreate = vi.fn().mockResolvedValue({});
    storeUpdate = vi.fn().mockResolvedValue({});

    const storeStub = {
      items: signal<StandingOrder[] | undefined>([]),
      isLoading: signal(false),
      isEmpty: signal(true),
      includeInactive: signal(false),
      reload: vi.fn(),
      create: storeCreate,
      update: storeUpdate,
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const fintsStub = {
      connections: signal([{
        id: 'conn-1',
        bankName: 'Test Bank',
        accounts: [{ id: 'acc-1', name: 'Girokonto', iban: 'DE89370400440532013000' }],
      }]),
    };

    const catsStub = {
      active: signal([{ id: 'cat-1', name: 'Wohnen' }]),
    };

    TestBed.configureTestingModule({
      imports: [StandingOrderDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: StandingOrdersStore, useValue: storeStub },
        { provide: KlarDialogService, useValue: { open: vi.fn(), close: vi.fn() } },
        { provide: KlarToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: FintsStore, useValue: fintsStub },
        { provide: CategoriesStore, useValue: catsStub },
      ],
    });

    const fixture = TestBed.createComponent(StandingOrderDialogComponent);
    const component = fixture.componentInstance;
    // Set inputs directly (component uses signal inputs)
    TestBed.runInInjectionContext(() => {
      fixture.componentRef.setInput('mode', mode);
      if (item) fixture.componentRef.setInput('item', item);
    });
    fixture.detectChanges();
    return { fixture, component };
  }

  it('bank fields are disabled in edit mode for FINTS_DERIVED record', () => {
    const order = makeOrder({ source: 'FINTS_DERIVED', bankFieldsLockedAt: '2026-04-01' });
    const { fixture } = setup('edit', order);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    // The counterpartyName and counterpartyIban fields should be disabled
    const inputs = el.querySelectorAll<HTMLInputElement>('input[disabled]');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('dispatches store.create when submitting in create mode with valid data', async () => {
    const { component } = setup('create');

    // Set valid signal values directly
    component.counterpartyName.set('Test Empfänger');
    component.amountCents.set(-50000);
    component.frequency.set('MONTHLY');
    component.accountId.set('acc-1');

    await component.save();

    expect(storeCreate).toHaveBeenCalledOnce();
    expect(storeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        counterpartyName: 'Test Empfänger',
        amountCents: -50000,
        frequency: 'MONTHLY',
        accountId: 'acc-1',
      })
    );
  });

  it('dispatches store.update when submitting in edit mode for MANUAL record', async () => {
    const order = makeOrder({ source: 'MANUAL', bankFieldsLockedAt: null });
    const { component } = setup('edit', order);

    component.counterpartyName.set('Neue Bezeichnung');
    component.amountCents.set(-60000);

    await component.save();

    expect(storeUpdate).toHaveBeenCalledOnce();
    expect(storeUpdate).toHaveBeenCalledWith(
      'so-1',
      expect.objectContaining({ counterpartyName: 'Neue Bezeichnung' })
    );
  });
});
