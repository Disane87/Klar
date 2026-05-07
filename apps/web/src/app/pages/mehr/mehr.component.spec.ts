import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { MehrPageComponent } from './mehr.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { AuthStore } from '../../core/auth/auth.store';

describe('MehrPageComponent', () => {
  let userSignal: ReturnType<typeof signal<{ appRole: 'USER' | 'ADMIN' } | null>>;
  let pageHeaderStub: { set: ReturnType<typeof vi.fn> };

  function setup() {
    pageHeaderStub = { set: vi.fn() };
    TestBed.configureTestingModule({
      imports: [MehrPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PageHeaderService, useValue: pageHeaderStub },
        { provide: AuthStore, useValue: { user: userSignal } },
      ],
    }).compileComponents();
    return TestBed.createComponent(MehrPageComponent);
  }

  it('hides the admin-only Admin entry for non-admin users', () => {
    userSignal = signal({ appRole: 'USER' });
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Admin');
  });

  it('shows the Admin entry when the current user is an app admin', () => {
    userSignal = signal({ appRole: 'ADMIN' });
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Admin');
  });

  it('sets the page header title on init', () => {
    userSignal = signal({ appRole: 'USER' });
    const fixture = setup();
    fixture.detectChanges();
    const calls = pageHeaderStub.set.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.[0]).toMatchObject({ title: 'Mehr' });
  });
});
