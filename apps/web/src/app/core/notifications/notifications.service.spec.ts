import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), NotificationsService],
    });
    service = TestBed.inject(NotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() forwards cursor / limit / unreadOnly as query params', () => {
    service.list('h1', { cursor: 'abc', limit: 25, unreadOnly: true }).subscribe();
    const req = httpMock.expectOne(r =>
      r.url === '/api/v1/households/h1/notifications' &&
      r.params.get('cursor') === 'abc' &&
      r.params.get('limit') === '25' &&
      r.params.get('unreadOnly') === 'true',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], nextCursor: null });
  });

  it('markRead / markAllRead / remove use the right verbs and paths', () => {
    service.markRead('h1', 'n1').subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/notifications/n1/read', method: 'PATCH' })
      .flush(null);

    service.markAllRead('h1').subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/notifications/read-all', method: 'PATCH' })
      .flush({ count: 3 });

    service.remove('h1', 'n1').subscribe();
    httpMock.expectOne({ url: '/api/v1/households/h1/notifications/n1', method: 'DELETE' })
      .flush(null);
  });
});
