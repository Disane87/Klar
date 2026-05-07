import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KalenderComponent } from './kalender.component';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';

interface CmpInternals {
  cells: () => Array<{ pad: boolean; day: number; iso: string; txCount: number; pills: unknown[]; extraCount: number; totalCents: number; isWeekend: boolean }>;
  monthLabel: () => string;
  totalIncomeCents: () => number;
  totalExpenseCents: () => number;
  totalBalanceCents: () => number;
  totalCount: () => number;
  prevMonth: () => void;
  nextMonth: () => void;
  goToday: () => void;
  selectedIso: () => string | null;
  selectDay: (cell: { pad: boolean; iso: string }) => void;
  pillAmount: (cents: number) => string;
  cellSum: (cents: number) => string;
  formatStrip: (cents: number, signed: boolean) => string;
  pad2: (n: number) => string;
  categoryColor: (id: string | null) => string;
}

function makeTx(over: Partial<{ id: string; date: string; amountCents: number; description: string; categoryId: string | null; recurringTransactionId: string | null }> = {}) {
  return {
    id: over.id ?? 't1',
    householdId: 'h1',
    categoryId: over.categoryId ?? null,
    projectId: null,
    recurringTransactionId: over.recurringTransactionId ?? null,
    amountCents: over.amountCents ?? -1234,
    plannedAmountCents: null,
    isPlanned: false,
    description: over.description ?? 'Edeka',
    counterparty: null,
    date: over.date ?? '2026-05-04',
    visibility: 'SHARED' as const,
    color: null,
    icon: null,
    createdAt: '2026-05-04T00:00:00Z',
  };
}

describe('KalenderComponent', () => {
  let dialogOpen: ReturnType<typeof vi.fn>;
  let txItems: ReturnType<typeof signal<ReturnType<typeof makeTx>[]>>;
  let currentMonth: ReturnType<typeof signal<string>>;

  beforeEach(async () => {
    txItems = signal<ReturnType<typeof makeTx>[]>([
      makeTx({ id: 't1', date: '2026-05-04', amountCents: -2500, description: 'Kaffee' }),
      makeTx({ id: 't2', date: '2026-05-04', amountCents: -150000, description: 'Miete' }),
      makeTx({ id: 't3', date: '2026-05-04', amountCents: -300, description: 'Brot' }),
      makeTx({ id: 't4', date: '2026-05-04', amountCents: -200, description: 'Apfel' }),
      makeTx({ id: 't5', date: '2026-05-15', amountCents: 350000, description: 'Lohn' }),
    ]);
    currentMonth = signal('2026-05');
    dialogOpen = vi.fn();

    const transactionsStub = { items: txItems, currentMonth };
    const categoriesStub = { byId: (_id: string | null) => ({ name: 'Essen', color: '#facc15' }) };
    const pageHeaderStub = {
      set:    vi.fn(),
      title:  signal(''),
      stats:  signal([]),
    };

    await TestBed.configureTestingModule({
      imports:   [KalenderComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TransactionsStore,  useValue: transactionsStub },
        { provide: CategoriesStore,    useValue: categoriesStub },
        { provide: PageHeaderService,  useValue: pageHeaderStub },
        { provide: KlarDialogService,  useValue: { open: dialogOpen, close: vi.fn() } },
      ],
    }).compileComponents();
  });

  function instance(): CmpInternals {
    const fixture = TestBed.createComponent(KalenderComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as CmpInternals;
  }

  it('builds Monday-first cells with padding for May 2026 (1.5. is Friday → 4 pad cells)', () => {
    const cmp = instance();
    const cells = cmp.cells();
    // First 4 cells are pads
    expect(cells.slice(0, 4).every(c => c.pad)).toBe(true);
    expect(cells[4].pad).toBe(false);
    expect(cells[4].day).toBe(1);
    // Total cells must be a multiple of 7
    expect(cells.length % 7).toBe(0);
  });

  it('groups transactions by date and computes day totals', () => {
    const cmp = instance();
    const day4 = cmp.cells().find(c => c.day === 4 && !c.pad);
    expect(day4).toBeDefined();
    expect(day4!.txCount).toBe(4);
    expect(day4!.pills.length).toBe(3);
    expect(day4!.extraCount).toBe(1);
    expect(day4!.totalCents).toBe(-2500 - 150000 - 300 - 200);
  });

  it('marks Sat/Sun as weekend', () => {
    const cmp = instance();
    const day2 = cmp.cells().find(c => c.day === 2 && !c.pad)!; // Sat
    const day3 = cmp.cells().find(c => c.day === 3 && !c.pad)!; // Sun
    const day4 = cmp.cells().find(c => c.day === 4 && !c.pad)!; // Mon
    expect(day2.isWeekend).toBe(true);
    expect(day3.isWeekend).toBe(true);
    expect(day4.isWeekend).toBe(false);
  });

  it('exposes monthLabel for the active month', () => {
    const cmp = instance();
    expect(cmp.monthLabel()).toContain('2026');
  });

  it('aggregates totals across the visible items', () => {
    const cmp = instance();
    expect(cmp.totalCount()).toBe(5);
    expect(cmp.totalIncomeCents()).toBe(350000);
    expect(cmp.totalExpenseCents()).toBe(-2500 - 150000 - 300 - 200);
    expect(cmp.totalBalanceCents()).toBe(350000 - (2500 + 150000 + 300 + 200));
  });

  it('shifts month with prev/next/today', () => {
    const cmp = instance();
    cmp.prevMonth();
    expect(currentMonth()).toBe('2026-04');
    cmp.nextMonth();
    expect(currentMonth()).toBe('2026-05');
    cmp.goToday();
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    expect(currentMonth()).toBe(ym);
  });

  it('opens day dialog on selectDay with bookings filtered by ISO', () => {
    const cmp = instance();
    cmp.selectDay({ pad: false, iso: '2026-05-04' });
    expect(dialogOpen).toHaveBeenCalledTimes(1);
    const cfg = dialogOpen.mock.calls[0][0];
    expect((cfg.inputs as { iso: string }).iso).toBe('2026-05-04');
    expect(((cfg.inputs as { bookings: unknown[] }).bookings).length).toBe(4);
  });

  it('ignores selectDay for padding cells', () => {
    const cmp = instance();
    cmp.selectDay({ pad: true, iso: '' });
    expect(dialogOpen).not.toHaveBeenCalled();
  });

  it('formats pill amounts: integer below 1000, k-suffix above', () => {
    const cmp = instance();
    expect(cmp.pillAmount(-1234)).toBe('−12');
    expect(cmp.pillAmount(350000)).toBe('+3.5k');
    expect(cmp.pillAmount(99900)).toBe('+999');
    expect(cmp.pillAmount(100000)).toBe('+1k');
  });

  it('formats cell sums (signed)', () => {
    const cmp = instance();
    expect(cmp.cellSum(-150000)).toBe('−1.5k');
    expect(cmp.cellSum(500)).toBe('+5');
    expect(cmp.cellSum(0)).toBe('+0');
  });

  it('formats strip values with sign for income/balance', () => {
    const cmp = instance();
    expect(cmp.formatStrip(0, true)).toMatch(/0/);
    expect(cmp.formatStrip(350000, true)).toMatch(/^\+/);
    expect(cmp.formatStrip(-150000, false)).toMatch(/^−/);
  });

  it('pads day numbers to 2 digits', () => {
    const cmp = instance();
    expect(cmp.pad2(1)).toBe('01');
    expect(cmp.pad2(31)).toBe('31');
  });

  it('falls back to accent for null/missing category color', () => {
    const cmp = instance();
    expect(cmp.categoryColor(null)).toBe('var(--accent)');
  });
});
