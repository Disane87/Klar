import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { KlarLogoMarkComponent } from './klar-logo-mark.component';
import { KlarWordmarkComponent } from './klar-wordmark.component';

describe('KlarLogoMarkComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarLogoMarkComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
  );

  it('should create with ledger variant', () => {
    const fixture = TestBed.createComponent(KlarLogoMarkComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should create with diamond variant', () => {
    const fixture = TestBed.createComponent(KlarLogoMarkComponent);
    fixture.componentRef.setInput('variant', 'diamond');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});

describe('KlarWordmarkComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarWordmarkComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
  );

  it('should create', () => {
    const fixture = TestBed.createComponent(KlarWordmarkComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('gap is proportional to size', () => {
    const fixture = TestBed.createComponent(KlarWordmarkComponent);
    fixture.componentRef.setInput('size', 40);
    fixture.detectChanges();
    expect(fixture.componentInstance.gap()).toBeCloseTo(40 * 0.18);
  });

  it('fontSize is proportional to size', () => {
    const fixture = TestBed.createComponent(KlarWordmarkComponent);
    fixture.componentRef.setInput('size', 40);
    fixture.detectChanges();
    expect(fixture.componentInstance.fontSize()).toBeCloseTo(40 * 0.78);
  });
});
