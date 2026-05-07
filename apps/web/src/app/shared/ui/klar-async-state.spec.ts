import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KlarAsyncStateComponent } from './klar-async-state.component';

describe('KlarAsyncStateComponent', () => {
  @Component({
    standalone: true,
    imports: [KlarAsyncStateComponent],
    template: `
      <klar-async-state
        [loading]="loading"
        [error]="error"
        [empty]="empty"
        emptyMessage="Keine Einträge"
      >
        <div data-test="content">CONTENT</div>
      </klar-async-state>
    `,
  })
  class Host {
    loading = false;
    error: unknown = null;
    empty = false;
  }

  function setup(over: Partial<Host> = {}) {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    const fx = TestBed.createComponent(Host);
    Object.assign(fx.componentInstance, over);
    fx.detectChanges();
    return fx;
  }

  it('renders skeleton-rows when loading', () => {
    const fx = setup({ loading: true });
    expect(fx.nativeElement.querySelector('klar-skeleton-rows')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-test="content"]')).toBeFalsy();
  });

  it('renders error bar when error and not loading', () => {
    const fx = setup({ error: new Error('boom') });
    expect(fx.nativeElement.querySelector('klar-error-bar')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-test="content"]')).toBeFalsy();
  });

  it('renders empty state when empty and no error/loading', () => {
    const fx = setup({ empty: true });
    expect(fx.nativeElement.querySelector('klar-empty-state')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-test="content"]')).toBeFalsy();
  });

  it('renders projected content when no flags set', () => {
    const fx = setup();
    expect(fx.nativeElement.querySelector('[data-test="content"]')).toBeTruthy();
  });

  it('precedence: loading wins over error and empty', () => {
    const fx = setup({ loading: true, error: 'x', empty: true });
    expect(fx.nativeElement.querySelector('klar-skeleton-rows')).toBeTruthy();
    expect(fx.nativeElement.querySelector('klar-error-bar')).toBeFalsy();
    expect(fx.nativeElement.querySelector('klar-empty-state')).toBeFalsy();
  });

  it('precedence: error wins over empty', () => {
    const fx = setup({ error: 'x', empty: true });
    expect(fx.nativeElement.querySelector('klar-error-bar')).toBeTruthy();
    expect(fx.nativeElement.querySelector('klar-empty-state')).toBeFalsy();
  });
});
