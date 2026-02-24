import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-proficiency-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proficiency-section.component.html',
  styleUrl: './proficiency-section.component.scss',
})
export class ProficiencySectionComponent {
  readonly i18n = inject(I18nService);

  readonly profile = input<ResumeProfile | null>(null);

  readonly proficiencies = computed(() => {
    const items = this.profile()?.proficiencies ?? [];
    return items.length > 0 ? [...items].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  });

  readonly hasProficiencies = computed(() => this.proficiencies().length > 0);

  // TODO F-378: Extract to shared icon.utils.ts
  /** Determine how to render the icon field */
  getIconType(value: string | undefined | null): 'fa' | 'img' | 'emoji' | 'none' {
    if (!value || !value.trim()) return 'none';
    const v = value.trim();
    if (/^fa[sbrldt]?\s+fa-/.test(v)) return 'fa';
    if (/^(https?:\/\/|\/)/i.test(v) || /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/i.test(v)) return 'img';
    return 'emoji';
  }
}
