import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { KlarComboboxComponent } from './klar-combobox.component';

interface Cat {
  id: string;
  name: string;
}

@Component({
  standalone: true,
  imports: [KlarComboboxComponent],
  template: `
    <klar-combobox
      [items]="items()"
      [(value)]="value"
      [idOf]="idOf"
      [displayWith]="displayWith"
      [addLabel]="addLabel()"
      [disabled]="disabled()"
      [loading]="loading()"
      (addNew)="onAdd($event)"
    />
  `,
})
class HostComponent {
  items = signal<Cat[]>([
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Charlie' },
  ]);
  value = signal<string | null>(null);
  disabled = signal(false);
  loading = signal(false);
  addLabel = signal<((q: string) => string) | null>((q) => `+ "${q}" anlegen`);
  added: string[] = [];

  readonly idOf = (c: Cat) => c.id;
  readonly displayWith = (c: Cat) => c.name;

  onAdd(name: string): void {
    this.added.push(name);
  }
}

describe('KlarComboboxComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let combobox: KlarComboboxComponent<Cat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    combobox = fixture.debugElement.children[0].componentInstance as KlarComboboxComponent<Cat>;
  });

  it('renders trigger with placeholder when no value', () => {
    const button = fixture.nativeElement.querySelector('button[brnPopoverTrigger]') as HTMLButtonElement;
    expect(button.textContent).toContain('Auswählen');
  });

  it('shows selected item label in trigger', async () => {
    host.value.set('b');
    fixture.detectChanges();
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button[brnPopoverTrigger]') as HTMLButtonElement;
    expect(button.textContent).toContain('Beta');
  });

  it('filteredItems returns all when query empty', () => {
    expect(combobox['filteredItems']()).toHaveLength(3);
  });

  it('filteredItems filters case-insensitive by displayWith', () => {
    combobox['query'].set('alp');
    expect(combobox['filteredItems']()).toEqual([{ id: 'a', name: 'Alpha' }]);
  });

  it('selectedItem reflects value()', () => {
    expect(combobox['selectedItem']()).toBeNull();
    host.value.set('c');
    fixture.detectChanges();
    expect(combobox['selectedItem']()).toEqual({ id: 'c', name: 'Charlie' });
  });

  it('selectedItem is null when value is not in items (stale id)', () => {
    host.value.set('does-not-exist');
    fixture.detectChanges();
    expect(combobox['selectedItem']()).toBeNull();
  });

  it('onSelectItem updates value', () => {
    combobox.onSelectItem({ id: 'b', name: 'Beta' });
    expect(host.value()).toBe('b');
  });

  it('showAdd is true when query has no exact match and addLabel set', () => {
    combobox['query'].set('Delta');
    expect(combobox['showAdd']()).toBe(true);
  });

  it('showAdd is false when query exactly matches an item (case-insensitive)', () => {
    combobox['query'].set('beta');
    expect(combobox['showAdd']()).toBe(false);
  });

  it('showAdd is false when query is empty', () => {
    combobox['query'].set('   ');
    expect(combobox['showAdd']()).toBe(false);
  });

  it('showAdd is false when addLabel is null', async () => {
    host.addLabel.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    combobox['query'].set('Delta');
    expect(combobox['showAdd']()).toBe(false);
  });

  it('onAdd emits trimmed query', () => {
    combobox['query'].set('  Neue Kategorie  ');
    combobox.onAdd();
    expect(host.added).toEqual(['Neue Kategorie']);
  });

  it('onAdd does nothing when query is empty', () => {
    combobox['query'].set('');
    combobox.onAdd();
    expect(host.added).toHaveLength(0);
  });

  it('reflects items() updates reactively (new item appears in filtered list)', () => {
    host.items.update(arr => [...arr, { id: 'd', name: 'Delta' }]);
    fixture.detectChanges();
    combobox['query'].set('del');
    expect(combobox['filteredItems']()).toEqual([{ id: 'd', name: 'Delta' }]);
  });

  it('parent can set value to newly added id and trigger reflects it', async () => {
    host.items.update(arr => [...arr, { id: 'new', name: 'Neu' }]);
    host.value.set('new');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(combobox['selectedItem']()).toEqual({ id: 'new', name: 'Neu' });
    const button = fixture.nativeElement.querySelector('button[brnPopoverTrigger]') as HTMLButtonElement;
    expect(button.textContent).toContain('Neu');
  });

  it('disabled propagates to trigger button', async () => {
    host.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button[brnPopoverTrigger]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
