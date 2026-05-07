import { Injector, computed, effect, inject, runInInjectionContext, signal } from '@angular/core';

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  total: number | null;
}

export interface PaginatedListConfig<T, F> {
  fetch: (filter: F, cursor: string | null) => Promise<CursorPage<T>>;
  initialFilter: F;
  /** Debounce in ms for filter changes that re-fetch from cursor=null. */
  debounceMs?: number;
}

export interface PaginatedListController<T, F> {
  readonly items: () => T[];
  readonly total: () => number | null;
  readonly loading: () => boolean;
  readonly error: () => string | null;
  readonly hasMore: () => boolean;
  readonly filter: () => F;
  setFilter: (next: F | ((prev: F) => F)) => void;
  loadMore: () => void;
  reload: () => void;
}

export function usePaginatedList<T, F>(
  config: PaginatedListConfig<T, F>,
): PaginatedListController<T, F> {
  const injector = inject(Injector);
  const debounceMs = config.debounceMs ?? 300;

  const filter = signal<F>(config.initialFilter);
  const items = signal<T[]>([]);
  const cursor = signal<string | null>(null);
  const total = signal<number | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const hasMore = signal(true);

  // Generation counter to ignore stale responses.
  let gen = 0;

  async function fetchPage(currentCursor: string | null, append: boolean): Promise<void> {
    const myGen = ++gen;
    loading.set(true);
    error.set(null);
    try {
      const page = await config.fetch(filter(), currentCursor);
      if (myGen !== gen) return; // stale
      items.update((prev) => (append ? [...prev, ...page.data] : page.data));
      cursor.set(page.nextCursor);
      hasMore.set(page.nextCursor !== null);
      if (page.total !== null) total.set(page.total);
    } catch (e) {
      if (myGen !== gen) return;
      error.set(e instanceof Error ? e.message : 'Fehler beim Laden');
      hasMore.set(false);
    } finally {
      if (myGen === gen) loading.set(false);
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let firstRun = true;

  runInInjectionContext(injector, () => {
    effect(() => {
      filter(); // track
      if (firstRun) {
        firstRun = false;
        void fetchPage(null, false);
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        items.set([]);
        cursor.set(null);
        total.set(null);
        hasMore.set(true);
        void fetchPage(null, false);
      }, debounceMs);
    });
  });

  return {
    items: computed(() => items()),
    total: computed(() => total()),
    loading: computed(() => loading()),
    error: computed(() => error()),
    hasMore: computed(() => hasMore()),
    filter: computed(() => filter()),
    setFilter: (next) => {
      if (typeof next === 'function') {
        filter.update(next as (prev: F) => F);
      } else {
        filter.set(next);
      }
    },
    loadMore: () => {
      if (loading() || !hasMore()) return;
      void fetchPage(cursor(), true);
    },
    reload: () => {
      items.set([]);
      cursor.set(null);
      total.set(null);
      hasMore.set(true);
      void fetchPage(null, false);
    },
  };
}
