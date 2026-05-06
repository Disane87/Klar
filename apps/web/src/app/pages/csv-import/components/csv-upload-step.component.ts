import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';

@Component({
  selector: 'app-csv-upload-step',
  standalone: true,
  imports: [HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <header class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">CSV-Import — Sparkasse</h2>
        <p class="text-sm text-muted-foreground">
          Online-Banking → Umsätze → Export → CSV-CAMT v2
        </p>
      </header>

      <label
        class="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-background py-10 text-center min-h-[44px] cursor-pointer hover:bg-accent/30 active:bg-accent/40 transition-colors"
      >
        <span class="text-base text-foreground">Datei auswählen…</span>
        <span class="text-xs text-muted-foreground">
          {{ fileName() ?? 'CSV, max. 5 MB' }}
        </span>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          class="hidden"
          (change)="onFileChange($event)"
        />
      </label>

      @if (errorMessage()) {
        <p class="text-sm text-danger">{{ errorMessage() }}</p>
      }

      <div class="flex justify-end">
        <button
          hlmBtn
          variant="default"
          [disabled]="!file() || analyzing()"
          (click)="emit()"
        >
          @if (analyzing()) {
            Analysiere…
          } @else {
            Analysieren
          }
        </button>
      </div>
    </div>
  `,
})
export class CsvUploadStepComponent {
  readonly analyzing = signal(false);
  readonly file = signal<File | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly fileSelected = output<File>();

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      this.errorMessage.set('Datei zu groß (max 5 MB)');
      return;
    }
    this.errorMessage.set(null);
    this.file.set(f);
    this.fileName.set(f.name);
  }

  emit(): void {
    const f = this.file();
    if (!f) return;
    this.analyzing.set(true);
    this.fileSelected.emit(f);
  }
}
