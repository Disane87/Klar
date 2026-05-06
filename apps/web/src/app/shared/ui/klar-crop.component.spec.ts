import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { KlarCropComponent } from './klar-crop.component';

describe('KlarCropComponent', () => {
  let fixture: ComponentFixture<KlarCropComponent>;
  let component: KlarCropComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KlarCropComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(KlarCropComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('zoom defaults to 1.0', () => {
    expect(component['zoom']()).toBe(1);
  });

  it('clamps zoom into [1, 4] via slider', () => {
    component['onZoomSlider']({ target: { value: '0.5' } } as unknown as Event);
    expect(component['zoom']()).toBe(1);
    component['onZoomSlider']({ target: { value: '10' } } as unknown as Event);
    expect(component['zoom']()).toBe(4);
    component['onZoomSlider']({ target: { value: '2.5' } } as unknown as Event);
    expect(component['zoom']()).toBe(2.5);
  });

  it('baseScale uses cover-fit so the smaller side fills the crop window', () => {
    component['naturalW'].set(800);
    component['naturalH'].set(400);
    // CONTAINER_SIZE = 280, cover = max(280/800, 280/400) = 280/400 = 0.7
    expect(component['baseScale']()).toBeCloseTo(0.7, 4);
  });

  it('clamps offsets so the image always covers the crop window', () => {
    component['naturalW'].set(400);
    component['naturalH'].set(400);
    // baseScale = 280/400 = 0.7, zoom = 1 → displayedScale = 0.7
    // displayed image = 280×280 → maxX = (280-280)/2 = 0
    component['offsetX'].set(50);
    component['offsetY'].set(-50);
    // Re-trigger clamp via slider (no-op zoom)
    component['onZoomSlider']({ target: { value: '1' } } as unknown as Event);
    // No clamp happens since zoom didn't change; manually invoke
    (component as unknown as { clampOffset: () => void }).clampOffset();
    expect(component['offsetX']()).toBeCloseTo(0, 6);
    expect(component['offsetY']()).toBeCloseTo(0, 6);
  });

  it('crop() rejects when no image is loaded', async () => {
    await expect(component.crop()).rejects.toThrow();
  });
});
