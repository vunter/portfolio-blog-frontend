import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';

export interface MultiSelectOption {
  value: string;
  labelKey: string;
}

@Component({
  selector: 'app-multi-select',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
  host: {
    '(document:mousedown)': 'onDocumentClick($event)',
  },
})
export class MultiSelectComponent {
  readonly i18n = inject(I18nService);

  /** Available options */
  readonly options = input.required<MultiSelectOption[]>();

  /** Current comma-separated value */
  readonly value = input<string>('');

  /** Placeholder text */
  readonly placeholder = input<string>('Search...');

  /** Emits the new comma-separated value on change */
  readonly selectionChange = output<string>();

  /** Internal state */
  readonly searchTerm = signal('');
  readonly dropdownOpen = signal(false);
  readonly highlightedIndex = signal(0);

  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  readonly selectedValues = computed(() => {
    const v = this.value();
    if (!v) return [];
    return v.split(',').map(s => s.trim()).filter(s => s);
  });

  readonly filteredOptions = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const opts = this.options();
    if (!search) return opts;
    return opts.filter(o =>
      this.i18n.t(o.labelKey).toLowerCase().includes(search) ||
      o.value.toLowerCase().includes(search)
    );
  });

  onDocumentClick(event: MouseEvent): void {
    const container = this.containerRef()?.nativeElement;
    if (container && !container.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  getLabel(value: string): string {
    const opt = this.options().find(o => o.value === value);
    return opt ? this.i18n.t(opt.labelKey) : value;
  }

  isSelected(value: string): boolean {
    return this.selectedValues().includes(value);
  }

  onControlClick(): void {
    this.searchInputRef()?.nativeElement.focus();
  }

  openDropdown(): void {
    this.dropdownOpen.set(true);
    this.highlightedIndex.set(0);
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
    this.searchTerm.set('');
    this.highlightedIndex.set(0);
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    if (this.dropdownOpen()) {
      this.closeDropdown();
    } else {
      this.openDropdown();
      this.searchInputRef()?.nativeElement.focus();
    }
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    if (!this.dropdownOpen()) {
      this.openDropdown();
    }
    this.highlightedIndex.set(0);
  }

  selectOption(opt: MultiSelectOption, event: MouseEvent): void {
    event.preventDefault(); // Prevent blur on the input
    const selected = [...this.selectedValues()];
    const idx = selected.indexOf(opt.value);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      selected.push(opt.value);
    }
    this.selectionChange.emit(selected.join(','));
    this.searchTerm.set('');
    this.highlightedIndex.set(0);
  }

  removeValue(value: string, event: MouseEvent): void {
    event.stopPropagation();
    const selected = this.selectedValues().filter(v => v !== value);
    this.selectionChange.emit(selected.join(','));
  }

  onKeydown(event: KeyboardEvent): void {
    const filtered = this.filteredOptions();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.dropdownOpen()) {
          this.openDropdown();
        } else {
          this.highlightedIndex.set(Math.min(this.highlightedIndex() + 1, filtered.length - 1));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.set(Math.max(this.highlightedIndex() - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (this.dropdownOpen() && filtered[this.highlightedIndex()]) {
          this.selectOption(filtered[this.highlightedIndex()], event as any);
        }
        break;
      case 'Escape':
        this.closeDropdown();
        break;
      case 'Backspace':
        if (!this.searchTerm() && this.selectedValues().length > 0) {
          const selected = [...this.selectedValues()];
          selected.pop();
          this.selectionChange.emit(selected.join(','));
        }
        break;
    }
  }
}
