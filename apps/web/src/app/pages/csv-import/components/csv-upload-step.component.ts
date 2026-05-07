import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { HlmButtonDirective } from '../../../shared/ui/hlm/hlm-button.directive';
import { KlarIconComponent } from '../../../shared/icons/klar-icon.component';

@Component({
  selector: 'app-csv-upload-step',
  standalone: true,
  imports: [HlmButtonDirective, KlarIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-md border border-(--line) bg-(--bg-1) overflow-hidden">
      <header class="flex items-start gap-3 px-5 py-4 border-b border-(--line-soft)">
        <span class="grid place-items-center size-7 rounded-md border border-(--line-soft) bg-(--bg-2) text-(--accent) shrink-0">
          <klar-icon name="upload" [size]="14" />
        </span>
        <div class="flex flex-col gap-0.5 min-w-0">
          <div class="text-[10px] uppercase tracking-[0.14em] text-(--fg-2) font-medium">
            CSV-Import · Sparkasse · CAMT v2
          </div>
          <div class="serif text-[20px] leading-tight">
            Buchungen analysieren
          </div>
          <div class="text-[12px] text-(--fg-2) mt-1">
            Klar matcht automatisch <strong class="text-(--fg-1) font-medium">Fixkosten</strong>,
            schlägt <strong class="text-(--fg-1) font-medium">Kategorien</strong> &amp;
            <strong class="text-(--fg-1) font-medium">Verträge</strong> vor und erkennt
            <strong class="text-(--fg-1) font-medium">Duplikate</strong>.
          </div>
        </div>
      </header>

      <label
        class="flex flex-col items-center justify-center gap-2 mx-5 my-5 rounded-md border border-dashed border-(--line) bg-(--bg)/40 py-10 text-center min-h-44 cursor-pointer hover:bg-(--bg-2)/40 active:bg-(--bg-2)/60 transition-colors"
      >
        <span class="size-10 grid place-items-center rounded-full bg-(--accent-soft) text-(--accent)">
          <klar-icon name="upload" [size]="18" />
        </span>
        <span class="text-base text-(--fg)">Datei auswählen…</span>
        <span class="text-xs text-(--fg-2)">
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
        <p class="px-5 -mt-2 mb-3 text-sm text-(--danger)">{{ errorMessage() }}</p>
      }

      <div class="flex justify-end gap-2 px-5 py-3 border-t border-(--line-soft) bg-(--bg)/40">
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
