import { Component, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  themeService = inject(ThemeService);
  i18n = inject(I18nService);

  // ANG20-01: input() signal functions instead of @Input() decorators
  readonly variant = input<'default' | 'compact' | 'floating' | 'sidebar' | 'segmented'>('default');
  readonly showLabel = input(false);
}
