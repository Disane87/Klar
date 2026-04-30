// Full ResourceStore<T> implementation added in Phase 5.
// Stub here so import paths resolve from day 1.

export abstract class ResourceStore<T> {
  abstract readonly items: () => T[] | undefined;
  abstract readonly loading: () => boolean;
  abstract readonly error: () => unknown;
}
