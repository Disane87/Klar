import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

const CONTAINER_SIZE = 280;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 4.0;

export interface CropResult {
  dataUrl: string;
  blob: Blob;
}

/**
 * Generic image crop component.
 *
 * - Pan via pointer drag.
 * - Zoom via wheel and range slider (keeps cursor/center anchor stable).
 * - The image always covers the crop window (cover-fit + zoom).
 *
 * Use through {@link KlarImageCropDialogComponent} for the avatar flow,
 * or call `crop()` directly via a `viewChild` reference.
 */
@Component({
  selector: 'klar-crop',
  standalone: true,
  host: { class: 'flex flex-col items-center gap-3 select-none' },
  template: `
    <div #frame
         class="relative overflow-hidden rounded bg-(--surface-2) border border-(--border)
                touch-none cursor-grab active:cursor-grabbing"
         [style.width.px]="containerSize"
         [style.height.px]="containerSize"
         (pointerdown)="onPointerDown($event)"
         (pointermove)="onPointerMove($event)"
         (pointerup)="onPointerUp($event)"
         (pointercancel)="onPointerUp($event)"
         (wheel)="onWheel($event)">
      @if (imageSrc(); as src) {
        <img #img
             [src]="src"
             alt=""
             draggable="false"
             class="absolute top-1/2 left-1/2 origin-center pointer-events-none max-w-none"
             [style.width.px]="naturalW()"
             [style.height.px]="naturalH()"
             [style.transform]="transform()"
             (load)="onImgLoad()" />
      }

      <!-- Crop overlay -->
      <div class="absolute inset-0 pointer-events-none"
           [class.rounded-full]="shape() === 'circle'"
           style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.55); mask-composite: exclude;"
           [style.border-radius]="shape() === 'circle' ? '50%' : '0'">
      </div>
      <div class="absolute inset-0 pointer-events-none border border-white/40"
           [style.border-radius]="shape() === 'circle' ? '50%' : '0'"></div>
    </div>

    <div class="flex items-center gap-3 w-full max-w-[280px]">
      <span class="text-(--text-muted) text-[11px] tabular-nums w-7">{{ (zoom() * 100).toFixed(0) }}%</span>
      <input type="range"
             [min]="minZoom" [max]="maxZoom" step="0.01"
             [value]="zoom()"
             (input)="onZoomSlider($event)"
             aria-label="Zoom"
             class="flex-1 accent-(--color-accent)" />
    </div>
  `,
})
export class KlarCropComponent {
  imageSrc     = input<string | null>(null);
  aspect       = input<number>(1);
  outputSize   = input<number>(256);
  outputFormat = input<string>('image/jpeg');
  quality      = input<number>(0.85);
  shape        = input<'circle' | 'rect'>('circle');

  cropped = output<CropResult>();

  protected readonly containerSize = CONTAINER_SIZE;
  protected readonly minZoom = MIN_ZOOM;
  protected readonly maxZoom = MAX_ZOOM;

  protected readonly naturalW = signal(0);
  protected readonly naturalH = signal(0);
  protected readonly zoom    = signal(1);
  protected readonly offsetX = signal(0);
  protected readonly offsetY = signal(0);

  private readonly imgRef = viewChild<ElementRef<HTMLImageElement>>('img');
  private readonly frameRef = viewChild<ElementRef<HTMLDivElement>>('frame');

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  /** baseScale = cover-fit ratio so image fills the square crop window. */
  protected baseScale = computed(() => {
    const w = this.naturalW();
    const h = this.naturalH();
    if (!w || !h) return 1;
    return Math.max(CONTAINER_SIZE / w, CONTAINER_SIZE / h);
  });

  protected displayedScale = computed(() => this.baseScale() * this.zoom());

  protected transform = computed(() =>
    `translate(-50%, -50%) translate(${this.offsetX()}px, ${this.offsetY()}px) scale(${this.displayedScale()})`,
  );

  constructor() {
    effect(() => {
      // Reset when a new image is loaded
      const _ = this.imageSrc();
      this.zoom.set(1);
      this.offsetX.set(0);
      this.offsetY.set(0);
    });
  }

  protected onImgLoad(): void {
    const el = this.imgRef()?.nativeElement;
    if (!el) return;
    this.naturalW.set(el.naturalWidth);
    this.naturalH.set(el.naturalHeight);
    this.clampOffset();
  }

  protected onPointerDown(ev: PointerEvent): void {
    if (!this.naturalW()) return;
    this.dragging = true;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  }

  protected onPointerMove(ev: PointerEvent): void {
    if (!this.dragging) return;
    const dx = ev.clientX - this.lastX;
    const dy = ev.clientY - this.lastY;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    this.offsetX.update(v => v + dx);
    this.offsetY.update(v => v + dy);
    this.clampOffset();
  }

  protected onPointerUp(ev: PointerEvent): void {
    this.dragging = false;
    const target = ev.currentTarget as HTMLElement;
    if (target.hasPointerCapture(ev.pointerId)) target.releasePointerCapture(ev.pointerId);
  }

  protected onWheel(ev: WheelEvent): void {
    if (!this.naturalW()) return;
    ev.preventDefault();
    const factor = Math.exp(-ev.deltaY * 0.0015);
    this.applyZoom(this.zoom() * factor);
  }

  protected onZoomSlider(ev: Event): void {
    const value = Number((ev.target as HTMLInputElement).value);
    this.applyZoom(value);
  }

  private applyZoom(target: number): void {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target));
    if (next === this.zoom()) return;
    // Keep image centered relative to crop center: scale offsets proportionally
    const ratio = next / this.zoom();
    this.zoom.set(next);
    this.offsetX.update(v => v * ratio);
    this.offsetY.update(v => v * ratio);
    this.clampOffset();
  }

  private clampOffset(): void {
    const w = this.naturalW();
    const h = this.naturalH();
    if (!w || !h) return;
    const s = this.displayedScale();
    const maxX = Math.max(0, (w * s - CONTAINER_SIZE) / 2);
    const maxY = Math.max(0, (h * s - CONTAINER_SIZE) / 2);
    this.offsetX.update(v => Math.min(maxX, Math.max(-maxX, v)));
    this.offsetY.update(v => Math.min(maxY, Math.max(-maxY, v)));
  }

  /** Render the crop to an output canvas and emit the result. */
  async crop(): Promise<CropResult> {
    const img = this.imgRef()?.nativeElement;
    if (!img || !this.naturalW()) {
      throw new Error('Kein Bild geladen');
    }

    const out = this.outputSize();
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar');

    // Fill bg (in case JPEG and image has transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out, out);

    const s = this.displayedScale();
    const w = this.naturalW();
    const h = this.naturalH();

    // Top-left of the displayed image in container coords (origin at container top-left)
    const imgLeft = (CONTAINER_SIZE - w * s) / 2 + this.offsetX();
    const imgTop  = (CONTAINER_SIZE - h * s) / 2 + this.offsetY();

    // Source rect in original image coordinates that maps to the [0..CONTAINER_SIZE] window
    const srcX = -imgLeft / s;
    const srcY = -imgTop / s;
    const srcW = CONTAINER_SIZE / s;
    const srcH = CONTAINER_SIZE / s;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, out, out);

    const dataUrl = canvas.toDataURL(this.outputFormat(), this.quality());
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Crop fehlgeschlagen'))),
        this.outputFormat(),
        this.quality(),
      );
    });

    const result: CropResult = { dataUrl, blob };
    this.cropped.emit(result);
    return result;
  }
}
