import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KlarInputComponent } from './klar-input.component';

describe('KlarInputComponent', () => {
  let component: KlarInputComponent;
  let fixture: ComponentFixture<KlarInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KlarInputComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(KlarInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('writeValue sets the value', () => {
    component.writeValue('test@example.com');
    expect(component['value']).toBe('test@example.com');
  });

  it('writeValue handles null/undefined gracefully', () => {
    component.writeValue(null as unknown as string);
    expect(component['value']).toBe('');
  });

  it('setDisabledState disables the input', () => {
    component.setDisabledState(true);
    expect(component['isDisabled']).toBe(true);
    component.setDisabledState(false);
    expect(component['isDisabled']).toBe(false);
  });

  it('registerOnChange stores the callback', () => {
    const cb = vi.fn();
    component.registerOnChange(cb);
    expect(component['onChange']).toBe(cb);
  });

  it('registerOnTouched stores the callback', () => {
    const cb = vi.fn();
    component.registerOnTouched(cb);
    expect(component['onTouched']).toBe(cb);
  });

  it('onInput updates value and calls onChange', () => {
    const cb = vi.fn();
    component.registerOnChange(cb);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    expect(cb).toHaveBeenCalledWith('hello');
  });

  it('emits valueChange on input', () => {
    const emitted: string[] = [];
    component.valueChange.subscribe((v: string) => emitted.push(v));
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'test';
    input.dispatchEvent(new Event('input'));
    expect(emitted).toEqual(['test']);
  });
});
