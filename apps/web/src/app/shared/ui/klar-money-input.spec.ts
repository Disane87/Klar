import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { KlarMoneyInputComponent } from './klar-money-input.component';

describe('KlarMoneyInputComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KlarMoneyInputComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents(),
  );

  it('renders an hlmInput input element', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('input')).toBeTruthy();
  });

  it('formats positive cents as DE decimal on initial render', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.componentRef.setInput('amountCents', 5000);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('50,00');
  });

  it('formats negative cents with leading minus', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.componentRef.setInput('amountCents', -12345);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('-123,45');
  });

  it('renders empty string when amountCents is null', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.componentRef.setInput('amountCents', null);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('parses DE decimal input back to cents', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '49,99';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.amountCents()).toBe(4999);
  });

  it('parses dot-decimal input as well', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '12.34';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.amountCents()).toBe(1234);
  });

  it('strips DE thousands separator', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '1.234,56';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.amountCents()).toBe(123456);
  });

  it('parses negative values', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '-50,00';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.amountCents()).toBe(-5000);
  });

  it('coerces to absolute when allowNegative=false', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.componentRef.setInput('allowNegative', false);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '-50,00';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.amountCents()).toBe(5000);
  });

  it('treats empty input as null', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.componentRef.setInput('amountCents', 100);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.amountCents()).toBe(null);
  });

  it('reformats on blur from sloppy decimal', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '5';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fx.detectChanges();
    expect(input.value).toBe('5,00');
  });

  it('rounds to nearest cent (no float drift)', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '0.1';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.amountCents()).toBe(10);
    input.value = '0.30';
    input.dispatchEvent(new Event('input'));
    expect(fx.componentInstance.amountCents()).toBe(30);
  });

  it('does not double-format while user is mid-typing', () => {
    const fx = TestBed.createComponent(KlarMoneyInputComponent);
    fx.detectChanges();
    const input = fx.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '1,';
    input.dispatchEvent(new Event('input'));
    fx.detectChanges();
    // value should remain "1," — not snapped to "1,00" until blur
    expect(input.value).toBe('1,');
  });
});
