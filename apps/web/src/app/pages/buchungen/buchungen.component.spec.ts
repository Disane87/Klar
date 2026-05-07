import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BuchungenPageComponent } from './buchungen.component';
import { TransactionsStore } from '../../core/transactions/transactions.store';
import { CategoriesStore } from '../../core/categories/categories.store';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';

describe('BuchungenPageComponent', () => {
  beforeEach(async () => {
    const transactionsStub = {
      sortedItems: signal([]),
      currentMonth: signal('2026-05'),
      loading:     signal(false),
      error:       signal(null),
      reload:      vi.fn(),
      setMonth:    vi.fn(),
    };

    const categoriesStub = {
      items:   signal([]),
      loading: signal(false),
      error:   signal(null),
      reload:  vi.fn(),
    };

    const pageHeaderStub = {
      set:           vi.fn(),
      stats:         signal([]),
      scopeSegments: signal([]),
      scopeValue:    signal('month'),
    };

    await TestBed.configureTestingModule({
      imports:   [BuchungenPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TransactionsStore,  useValue: transactionsStub },
        { provide: CategoriesStore,    useValue: categoriesStub },
        { provide: PageHeaderService,  useValue: pageHeaderStub },
        { provide: KlarDialogService,  useValue: { open: vi.fn(), close: vi.fn() } },
      ],
    }).compileComponents();
  });

  describe('filter tabs', () => {
    it('switches between alle / rec / manual / income via setFilter', () => {
      const fixture = TestBed.createComponent(BuchungenPageComponent);
      const cmp = fixture.componentInstance as unknown as {
        filter: () => string;
        setFilter: (f: 'alle' | 'rec' | 'manual' | 'income') => void;
      };
      expect(cmp.filter()).toBe('alle');
      cmp.setFilter('rec');
      expect(cmp.filter()).toBe('rec');
      cmp.setFilter('manual');
      expect(cmp.filter()).toBe('manual');
      cmp.setFilter('income');
      expect(cmp.filter()).toBe('income');
    });
  });
});
