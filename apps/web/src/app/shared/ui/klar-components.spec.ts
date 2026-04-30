import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KlarBadgeComponent } from './klar-badge.component';
import { KlarCardComponent } from './klar-card.component';
import { KlarSkeletonComponent } from './klar-skeleton.component';
import { KlarToastContainerComponent } from './klar-toast.component';

describe('KlarBadgeComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarBadgeComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
  );

  it('should create', () => {
    const fixture = TestBed.createComponent(KlarBadgeComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('applies tone class to host', () => {
    const fixture = TestBed.createComponent(KlarBadgeComponent);
    fixture.componentRef.setInput('tone', 'rose');
    fixture.detectChanges();
    expect(fixture.nativeElement.className).toContain('tone-rose');
  });

  it('applies dim class when dim is true', () => {
    const fixture = TestBed.createComponent(KlarBadgeComponent);
    fixture.componentRef.setInput('dim', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.className).toContain('dim');
  });
});

describe('KlarCardComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarCardComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
  );

  it('should create', () => {
    const fixture = TestBed.createComponent(KlarCardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});

describe('KlarSkeletonComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarSkeletonComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents()
  );

  it('should create', () => {
    const fixture = TestBed.createComponent(KlarSkeletonComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('applies width and height to host element', () => {
    const fixture = TestBed.createComponent(KlarSkeletonComponent);
    fixture.componentRef.setInput('width', '200px');
    fixture.componentRef.setInput('height', '24px');
    fixture.detectChanges();
    expect(fixture.nativeElement.style.width).toBe('200px');
    expect(fixture.nativeElement.style.height).toBe('24px');
  });
});

describe('KlarToastContainerComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarToastContainerComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents()
  );

  it('should create', () => {
    const fixture = TestBed.createComponent(KlarToastContainerComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('toneIcon returns correct icon name', () => {
    const fixture = TestBed.createComponent(KlarToastContainerComponent);
    const comp = fixture.componentInstance as unknown as { toneIcon: (t: { tone: string }) => string };
    expect(comp.toneIcon({ tone: 'success' })).toBe('check');
    expect(comp.toneIcon({ tone: 'error' })).toBe('x');
    expect(comp.toneIcon({ tone: 'info' })).toBe('alert');
  });
});
