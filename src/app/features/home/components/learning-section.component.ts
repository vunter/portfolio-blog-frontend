import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';
import { getIconType } from '../../../shared/utils/icon.utils';

@Component({
  selector: 'app-learning-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './learning-section.component.html',
  styleUrl: './learning-section.component.scss',
})
export class LearningSectionComponent {
  readonly i18n = inject(I18nService);

  readonly profile = input<ResumeProfile | null>(null);

  readonly learningTopics = computed(() => {
    const items = this.profile()?.learningTopics ?? [];
    return items.length > 0 ? [...items].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  });

  readonly hasLearningTopics = computed(() => this.learningTopics().length > 0);

  getIconType = getIconType;
}
