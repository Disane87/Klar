import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  afterNextRender,
  input,
  output,
} from '@angular/core';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';

const klarEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: '#18181b',
    borderRadius: '4px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: '"GeistMono", ui-monospace, "Cascadia Code", monospace',
    lineHeight: '1.6',
  },
  '.cm-content': { padding: '8px 0', caretColor: '#a1a1aa' },
  '.cm-gutters': {
    backgroundColor: '#18181b',
    borderRight: '1px solid #27272a',
    color: '#52525b',
    padding: '0 4px',
  },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '32px' },
  '.cm-focused .cm-cursor': { borderLeftColor: '#a1a1aa' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.025)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.025)' },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(99,102,241,0.25) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(99,102,241,0.3) !important',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(99,102,241,0.2)',
    outline: '1px solid rgba(99,102,241,0.4)',
  },
});

@Component({
  selector: 'klar-code-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full overflow-hidden rounded' },
  template: `<div #host class="h-full"></div>`,
})
export class KlarCodeEditorComponent implements OnDestroy {
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLElement>;

  readonly initialValue = input('');
  readonly valueChange  = output<string>();

  private view?: EditorView;
  private _syncing = false;

  constructor() {
    afterNextRender(() => {
      this.view = new EditorView({
        state: EditorState.create({
          doc: this.initialValue(),
          extensions: [
            basicSetup,
            html(),
            oneDark,
            klarEditorTheme,
            EditorView.lineWrapping,
            EditorView.updateListener.of(update => {
              if (update.docChanged && !this._syncing) {
                this.valueChange.emit(update.state.doc.toString());
              }
            }),
          ],
        }),
        parent: this.host.nativeElement,
      });
    });
  }

  /** Insert text at the current cursor position */
  insertAtCursor(text: string): void {
    if (!this.view) return;
    const { from, to } = this.view.state.selection.main;
    this._syncing = true;
    this.view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    this._syncing = false;
    this.valueChange.emit(this.view.state.doc.toString());
    this.view.focus();
  }

  ngOnDestroy(): void {
    this.view?.destroy();
  }
}
