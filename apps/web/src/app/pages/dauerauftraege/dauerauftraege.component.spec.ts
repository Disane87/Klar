import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DauerauftraegeComponent } from './dauerauftraege.component';
import { StandingOrdersStore } from '../../core/standing-orders/standing-orders.store';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import type { StandingOrder } from '../../core/standing-orders/standing-orders.store';

const makeOrder = (overrides: Partial<StandingOrder> = {}): StandingOrder => ({
  id: 'so-1',
  householdId: 'h-1',
  accountId: 'acc-1',
  source: 'FINTS_DERIVED',
  transactionKind: 'STANDING_ORDER',
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

describe('DauerauftraegeComponent', () => {
  function setup(storeOverrides: Partial<{
    items: ReturnType<typeof signal<StandingOrder[] | undefined>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    includeInactive: ReturnType<typeof signal<boolean>>;
    reload: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }> = {}) {
    const storeStub = {
      items: signal<StandingOrder[] | undefined>(undefined),
      isLoading: signal(false),
      isEmpty: signal(true),
      includeInactive: signal(false),
      reload: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
      ...storeOverrides,
    };

    TestBed.configureTestingModule({
      imports: [DauerauftraegeComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: StandingOrdersStore, useValue: storeStub },
        { provide: KlarDialogService, useValue: { open: vi.fn(), close: vi.fn() } },
        { provide: KlarToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(DauerauftraegeComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, storeStub };
  }

  it('renders empty state when store has 0 items', () => {
    const { fixture } = setup({
      items: signal<StandingOrder[] | undefined>([]),
      isEmpty: signal(true),
      isLoading: signal(false),
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Noch keine Daueraufträge');
  });

  it('renders rows with the "Dauerauftrag" chip for STANDING_ORDER FinTS items', () => {
    const order = makeOrder({
      source: 'FINTS_DERIVED',
      transactionKind: 'STANDING_ORDER',
      counterpartyName: 'Vermieter GmbH',
    });
    const { fixture } = setup({
      items: signal<StandingOrder[] | undefined>([order]),
      isEmpty: signal(false),
      isLoading: signal(false),
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Vermieter GmbH');
    expect(el.textContent).toContain('Dauerauftrag');
  });

  it('renders the "SEPA-Lastschrift" chip for DIRECT_DEBIT FinTS items', () => {
    const order = makeOrder({
      source: 'FINTS_DERIVED',
      transactionKind: 'DIRECT_DEBIT',
      counterpartyName: 'ERGO Krankenversicherung AG',
    });
    const { fixture } = setup({
      items: signal<StandingOrder[] | undefined>([order]),
      isEmpty: signal(false),
      isLoading: signal(false),
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('ERGO Krankenversicherung AG');
    expect(el.textContent).toContain('SEPA-Lastschrift');
  });

  it('renders loading indicator when isLoading is true', () => {
    const { fixture } = setup({
      items: signal<StandingOrder[] | undefined>(undefined),
      isEmpty: signal(true),
      isLoading: signal(true),
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Lade');
  });

  it('renders "Inaktiv" badge for inactive orders', () => {
    const order = makeOrder({ isActive: false, counterpartyName: 'Gym' });
    const { fixture } = setup({
      items: signal<StandingOrder[] | undefined>([order]),
      isEmpty: signal(false),
      isLoading: signal(false),
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Inaktiv');
  });

  it('renders "Manuell" chip for MANUAL source orders', () => {
    const order = makeOrder({ source: 'MANUAL', transactionKind: null, bankFieldsLockedAt: null });
    const { fixture } = setup({
      items: signal<StandingOrder[] | undefined>([order]),
      isEmpty: signal(false),
      isLoading: signal(false),
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Manuell');
  });
});
