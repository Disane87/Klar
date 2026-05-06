import {
  Component,
  inject,
  input,
  signal,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { KlarButtonComponent } from './klar-button.component';
import { KlarCropComponent } from './klar-crop.component';
import { KlarDialogService } from './klar-dialog.service';
import { KlarToastService } from './klar-toast.service';

/**
 * Modal step for cropping an uploaded image. Receives a `File`, exposes pan/zoom UI,
 * and on save passes the resulting JPEG data URL to `onConfirm`.
 *
 * Open it via `KlarDialogService.open({ component: KlarImageCropDialogComponent, inputs: { file, onConfirm } })`.
 */
@Component({
  selector: 'app-klar-image-crop-dialog',
  standalone: true,
  imports: [KlarButtonComponent, KlarCropComponent],
  template: `
    <div class="flex flex-col items-center gap-4 px-4 pb-4">
      <klar-crop #cropper
                 [imageSrc]="objectUrl()"
                 [outputSize]="outputSize()"
                 [shape]="shape()"
                 outputFormat="image/jpeg"
                 [quality]="0.85" />

      <p class="text-(--text-muted) text-[11px] text-center max-w-[280px]">
        Ziehen zum Verschieben, Mausrad oder Slider zum Zoomen.
      </p>

      <div class="flex items-center justify-end gap-2 w-full">
        <klar-button tone="link" (click)="cancel()">Abbruch</klar-button>
        <klar-button tone="primary" [loading]="saving()" (click)="save()">
          Speichern
        </klar-button>
      </div>
    </div>
  `,
})
export class KlarImageCropDialogComponent implements OnDestroy {
  file       = input.required<File>();
  outputSize = input<number>(256);
  shape      = input<'circle' | 'rect'>('circle');
  /** Caller hook: receives the cropped JPEG data URL and uploads it. */
  onConfirm  = input.required<(dataUrl: string) => Promise<void>>();

  private dialog = inject(KlarDialogService);
  private toast  = inject(KlarToastService);

  private cropper = viewChild.required(KlarCropComponent);

  protected readonly objectUrl = signal<string | null>(null);
  protected readonly saving = signal(false);
  private currentUrl: string | null = null;

  constructor() {
    queueMicrotask(() => this.loadFile());
  }

  ngOnDestroy(): void {
    this.revokeUrl();
  }

  private loadFile(): void {
    const f = this.file();
    if (!f.type.startsWith('image/')) {
      this.toast.error('Datei ist kein Bild');
      this.dialog.close();
      return;
    }
    this.revokeUrl();
    this.currentUrl = URL.createObjectURL(f);
    this.objectUrl.set(this.currentUrl);
  }

  private revokeUrl(): void {
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  protected cancel(): void {
    this.dialog.close();
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const { dataUrl } = await this.cropper().crop();
      await this.onConfirm()(dataUrl);
      this.dialog.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Foto konnte nicht gespeichert werden';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }
}
