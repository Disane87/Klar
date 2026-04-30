import { TestBed } from '@angular/core/testing';
import { KlarToastService } from './klar-toast.service';

describe('KlarToastService', () => {
  let service: KlarToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [KlarToastService] });
    service = TestBed.inject(KlarToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('should add a success toast', () => {
    service.success('Gespeichert');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].tone).toBe('success');
    expect(service.toasts()[0].title).toBe('Gespeichert');
    expect(service.toasts()[0].body).toBeUndefined();
  });

  it('should add an error toast with body', () => {
    service.error('Fehler', 'Details');
    expect(service.toasts()[0].tone).toBe('error');
    expect(service.toasts()[0].body).toBe('Details');
  });

  it('should add an info toast', () => {
    service.info('Hinweis');
    expect(service.toasts()[0].tone).toBe('info');
  });

  it('should dismiss a toast by id', () => {
    service.success('Test');
    const { id } = service.toasts()[0];
    service.dismiss(id);
    expect(service.toasts()).toEqual([]);
  });

  it('should not error when dismissing unknown id', () => {
    service.dismiss('non-existent');
    expect(service.toasts()).toEqual([]);
  });

  it('should auto-dismiss after 5 seconds', () => {
    vi.useFakeTimers();
    service.success('Test');
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(service.toasts().length).toBe(0);
    vi.useRealTimers();
  });

  it('should assign unique ids to multiple toasts', () => {
    service.success('A');
    service.success('B');
    const ids = service.toasts().map(t => t.id);
    expect(new Set(ids).size).toBe(2);
  });
});
