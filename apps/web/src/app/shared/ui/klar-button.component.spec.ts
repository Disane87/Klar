import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { KlarButtonComponent } from './klar-button.component';

describe('KlarButtonComponent', () => {
  let component: KlarButtonComponent;
  let fixture: ComponentFixture<KlarButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KlarButtonComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(KlarButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hostClass returns size-md and variant-primary by default', () => {
    expect(component.hostClass()).toBe('size-md variant-primary');
  });

  it('hostClass includes full-width class when fullWidth is true', () => {
    fixture.componentRef.setInput('fullWidth', true);
    expect(component.hostClass()).toContain('full-width');
  });

  it('hostClass reflects custom variant and size', () => {
    fixture.componentRef.setInput('variant', 'ghost');
    fixture.componentRef.setInput('size', 'lg');
    expect(component.hostClass()).toBe('size-lg variant-ghost');
  });

  it('iconSize returns 14 for md', () => {
    expect(component.iconSize()).toBe(14);
  });

  it('iconSize returns 12 for sm', () => {
    fixture.componentRef.setInput('size', 'sm');
    expect(component.iconSize()).toBe(12);
  });

  it('iconSize returns 16 for lg', () => {
    fixture.componentRef.setInput('size', 'lg');
    expect(component.iconSize()).toBe(16);
  });

  it('emits clicked event on button click', () => {
    const emitSpy = vi.spyOn(component.clicked, 'emit');
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    expect(emitSpy).toHaveBeenCalled();
  });
});
