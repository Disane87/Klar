import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FixkostenPageComponent } from './fixkosten.component';
import { OverviewStore } from '../../core/overview/overview.store';
import { HouseholdStore } from '../../core/household/household.store';
import { PlanspielStore } from '../../core/planspiel/planspiel.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { PdfReportService } from '../../core/pdf/pdf-report.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { KlarToastService } from '../../shared/ui/klar-toast.service';
import { RecurringTransactionsService } from '../../core/recurring-transactions/recurring-transactions.service';

describe('FixkostenPageComponent — bulk selection', () => {
  let component: FixkostenPageComponent;
  let recurringDelete: ReturnType<typeof vi.fn>;
  let toastSuccess:    ReturnType<typeof vi.fn>;
  let toastError:      ReturnType<typeof vi.fn>;
  let storeReload:     ReturnType<typeof vi.fn>;
  let confirmSpy:      ReturnType<typeof vi.spyOn>;

  const sampleGroup = {
    categoryId: 'cat-1',
    items: [{ id: 'i-1' }, { id: 'i-2' }, { id: 'i-3' }] as { id: string }[],
  };

  beforeEach(async () => {
    recurringDelete = vi.fn().mockResolvedValue(undefined);
    toastSuccess    = vi.fn();
    toastError      = vi.fn();
    storeReload     = vi.fn();

    const overviewStub = {
      fixedCosts:   signal(null),
      cashflow:     signal(null),
      currentMonth: signal('2026-05'),
      loading:      signal(false),
      error:        signal(null),
      reload:       storeReload,
      setMonth:     vi.fn(),
    };

    const householdStub = {
      activeId:    signal('h-1'),
      activeName:  signal('Test'),
      members:     signal([]),
      loadMembers: vi.fn().mockResolvedValue(undefined),
    };

    const planspielStub = {
      entries:            signal([]),
      loadFromFixkosten:  vi.fn(),
      reset:              vi.fn(),
      removeEntry:        vi.fn(),
    };

    const pageHeaderStub = {
      set:   vi.fn(),
      stats: signal([]),
    };

    await TestBed.configureTestingModule({
      imports:   [FixkostenPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: OverviewStore,                 useValue: overviewStub },
        { provide: HouseholdStore,                useValue: householdStub },
        { provide: PlanspielStore,                useValue: planspielStub },
        { provide: PageHeaderService,             useValue: pageHeaderStub },
        { provide: PdfReportService,              useValue: { exportFixkosten: vi.fn() } },
        { provide: KlarDialogService,             useValue: { open: vi.fn(), close: vi.fn() } },
        { provide: KlarToastService,              useValue: { success: toastSuccess, error: toastError } },
        { provide: RecurringTransactionsService,  useValue: { delete: recurringDelete } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FixkostenPageComponent);
    component = fixture.componentInstance;

    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('starts outside selection mode with empty selection', () => {
    expect(component.selectionMode()).toBe(false);
    expect(component.selectedCount()).toBe(0);
  });

  it('toggleSelectionMode enters and exits, clearing selection on exit', () => {
    component.enterSelection();
    component.toggleItem('i-1');
    expect(component.selectedCount()).toBe(1);

    component.toggleSelectionMode();
    expect(component.selectionMode()).toBe(false);
    expect(component.selectedCount()).toBe(0);
  });

  it('toggleItem toggles individual ids in/out of selection', () => {
    component.toggleItem('i-1');
    expect(component.isSelected('i-1')).toBe(true);
    component.toggleItem('i-2');
    expect(component.selectedCount()).toBe(2);
    component.toggleItem('i-1');
    expect(component.isSelected('i-1')).toBe(false);
    expect(component.selectedCount()).toBe(1);
  });

  describe('groupSelectionState', () => {
    it('returns "none" when no items selected', () => {
      expect(component.groupSelectionState(sampleGroup)).toBe('none');
    });

    it('returns "partial" when some items selected', () => {
      component.toggleItem('i-1');
      expect(component.groupSelectionState(sampleGroup)).toBe('partial');
    });

    it('returns "all" when every item selected', () => {
      component.toggleItem('i-1');
      component.toggleItem('i-2');
      component.toggleItem('i-3');
      expect(component.groupSelectionState(sampleGroup)).toBe('all');
    });

    it('returns "none" for empty group', () => {
      expect(component.groupSelectionState({ items: [] })).toBe('none');
    });
  });

  describe('toggleGroupSelection', () => {
    it('selects all items when state is "none"', () => {
      component.toggleGroupSelection(sampleGroup);
      expect(component.groupSelectionState(sampleGroup)).toBe('all');
      expect(component.selectedCount()).toBe(3);
    });

    it('selects all items when state is "partial"', () => {
      component.toggleItem('i-1');
      component.toggleGroupSelection(sampleGroup);
      expect(component.groupSelectionState(sampleGroup)).toBe('all');
    });

    it('deselects every group item when state is "all", leaving others untouched', () => {
      component.toggleItem('i-1');
      component.toggleItem('i-2');
      component.toggleItem('i-3');
      component.toggleItem('other-99'); // foreign id outside sampleGroup
      component.toggleGroupSelection(sampleGroup);
      expect(component.groupSelectionState(sampleGroup)).toBe('none');
      expect(component.isSelected('other-99')).toBe(true);
    });
  });

  describe('bulkDelete', () => {
    it('does nothing if nothing is selected', async () => {
      await component.bulkDelete();
      expect(recurringDelete).not.toHaveBeenCalled();
    });

    it('aborts if user cancels confirm', async () => {
      confirmSpy.mockReturnValueOnce(false);
      component.toggleItem('i-1');
      await component.bulkDelete();
      expect(recurringDelete).not.toHaveBeenCalled();
    });

    it('deletes every selected id, reloads, exits selection, toasts success', async () => {
      component.enterSelection();
      component.toggleItem('i-1');
      component.toggleItem('i-2');

      await component.bulkDelete();

      expect(recurringDelete).toHaveBeenCalledTimes(2);
      expect(recurringDelete).toHaveBeenCalledWith('h-1', 'i-1');
      expect(recurringDelete).toHaveBeenCalledWith('h-1', 'i-2');
      expect(storeReload).toHaveBeenCalledTimes(1);
      expect(component.selectionMode()).toBe(false);
      expect(component.selectedCount()).toBe(0);
      expect(toastSuccess).toHaveBeenCalledOnce();
      expect(toastError).not.toHaveBeenCalled();
    });

    it('reports partial failures via error toast but still reloads + clears selection', async () => {
      recurringDelete.mockImplementation((_hid: string, id: string) =>
        id === 'i-2' ? Promise.reject(new Error('boom')) : Promise.resolve()
      );

      component.enterSelection();
      component.toggleItem('i-1');
      component.toggleItem('i-2');

      await component.bulkDelete();

      expect(storeReload).toHaveBeenCalledTimes(1);
      expect(component.selectionMode()).toBe(false);
      expect(toastError).toHaveBeenCalledOnce();
      expect(toastSuccess).not.toHaveBeenCalled();
    });
  });
});
