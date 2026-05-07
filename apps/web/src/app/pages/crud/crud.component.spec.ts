import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CrudPageComponent } from './crud.component';
import { PageHeaderService } from '../../core/page-header/page-header.service';
import { KlarDialogService } from '../../shared/ui/klar-dialog.service';

describe('CrudPageComponent', () => {
  function render(): { html: HTMLElement; cmp: CrudPageComponent } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrudPageComponent],
      providers: [provideRouter([])],
    });
    const fix = TestBed.createComponent(CrudPageComponent);
    fix.detectChanges();
    return { html: fix.nativeElement as HTMLElement, cmp: fix.componentInstance };
  }

  it('sets the page header title', () => {
    render();
    const header = TestBed.inject(PageHeaderService);
    expect(header.title()).toBe('CRUD-Dialoge');
  });

  it('renders one card per dialog pattern', () => {
    const { html, cmp } = render();
    const cards = html.querySelectorAll('.card');
    expect(cards.length).toBe(cmp['cards'].length);
    expect(cmp['cards'].length).toBe(8);
    const titles = cmp['cards'].map(c => c.title);
    expect(titles).toEqual([
      'Anlegen',
      'Detail',
      'Bearbeiten',
      'Löschen',
      'Verschieben',
      'Massenaktion',
      'Pausieren',
      'Verwerfen-Schutz',
    ]);
  });

  it('opens a dialog via KlarDialogService when a card button is clicked', () => {
    const { html } = render();
    const dialog = TestBed.inject(KlarDialogService);
    const spy = vi.spyOn(dialog, 'open').mockImplementation(() => undefined);
    const firstBtn = html.querySelector('button.btn.primary') as HTMLButtonElement;
    firstBtn.click();
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg.title).toBe('Anlegen');
    spy.mockRestore();
  });
});
