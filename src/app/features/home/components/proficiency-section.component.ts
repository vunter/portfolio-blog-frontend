import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';
import { getIconType } from '../../../shared/utils/icon.utils';

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

  getIconType = getIconType;
}
