import { ChangeDetectionStrategy, Component, OnInit, Type, inject } from '@angular/core';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';
import { SampleBulkDialogComponent } from './dialogs/sample-bulk-dialog.component';
import { SampleCreateDialogComponent } from './dialogs/sample-create-dialog.component';
import { SampleDeleteDialogComponent } from './dialogs/sample-delete-dialog.component';
import { SampleDetailDialogComponent } from './dialogs/sample-detail-dialog.component';
import { SampleDiscardDialogComponent } from './dialogs/sample-discard-dialog.component';
import { SampleEditDialogComponent } from './dialogs/sample-edit-dialog.component';
import { SampleMoveDialogComponent } from './dialogs/sample-move-dialog.component';
import { SamplePauseDialogComponent } from './dialogs/sample-pause-dialog.component';

interface CrudCard {
  readonly id: string;
  readonly title: string;
  readonly sub: string;
  readonly width: 'sm' | 'md' | 'lg' | 'xl';
  readonly component: Type<unknown>;
}

/**
 * /app/crud — admin-only dev gallery of the 8 canonical dialog patterns
 * (Anlegen / Detail / Bearbeiten / Löschen / Verschieben / Massenaktion /
 * Pausieren / Verwerfen-Schutz). Demo-only, not wired to data.
 */
@Component({
  selector: 'klar-crud-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-(--s-6) p-(--s-6) max-w-350 mx-auto">
      <div>
        <div class="section-head">CRUD-Dialoge</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-(--s-4)">
          @for (c of cards; track c.id) {
            <div class="card flex flex-col gap-(--s-3) p-(--s-5)">
              <div class="flex flex-col gap-1">
                <div class="serif text-[20px] leading-none">{{ c.title }}</div>
                <div class="text-[12px] text-(--fg-2)">{{ c.sub }}</div>
              </div>
              <div class="mt-auto">
                <button class="btn primary sm" (click)="open(c)">Öffnen</button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class CrudPageComponent implements OnInit {
  private header = inject(PageHeaderService);
  private dialog = inject(KlarDialogService);

  protected readonly cards: CrudCard[] = [
    { id: 'create',  title: 'Anlegen',          sub: 'Create — leeres Formular', width: 'md', component: SampleCreateDialogComponent },
    { id: 'detail',  title: 'Detail',           sub: 'Read — read-only Felder',  width: 'md', component: SampleDetailDialogComponent },
    { id: 'edit',    title: 'Bearbeiten',       sub: 'Update — vorausgefüllt',   width: 'md', component: SampleEditDialogComponent },
    { id: 'delete',  title: 'Löschen',          sub: 'Delete — Confirm + Danger',width: 'sm', component: SampleDeleteDialogComponent },
    { id: 'move',    title: 'Verschieben',      sub: 'Ziel-Picker via KSelect',  width: 'sm', component: SampleMoveDialogComponent },
    { id: 'bulk',    title: 'Massenaktion',     sub: 'Multi-select Bulk-Aktion', width: 'md', component: SampleBulkDialogComponent },
    { id: 'pause',   title: 'Pausieren',        sub: 'Toggle State + Confirm',   width: 'sm', component: SamplePauseDialogComponent },
    { id: 'discard', title: 'Verwerfen-Schutz', sub: 'Unsaved-changes Guard',    width: 'md', component: SampleDiscardDialogComponent },
  ];

  ngOnInit(): void {
    this.header.set({
      title: 'CRUD-Dialoge',
      subtitle: 'Acht Standard-Patterns für Listen-Editing',
    });
  }

  protected open(card: CrudCard): void {
    this.dialog.open({
      title: card.title,
      component: card.component,
      width: card.width,
    });
  }
}
