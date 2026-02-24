import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

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

  // TODO F-378: Extract to shared icon.utils.ts
  /** Determine how to render the emoji/icon field */
  getIconType(value: string | undefined | null): 'fa' | 'img' | 'emoji' | 'none' {
    if (!value || !value.trim()) return 'none';
    const v = value.trim();
    // Font Awesome classes: start with fa, fas, fab, far, fal, fad, fat
    if (/^fa[sbrldt]?\s+fa-/.test(v)) return 'fa';
    // Image URL
    if (/^(https?:\/\/|\/)/i.test(v) || /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/i.test(v)) return 'img';
    // Everything else (emoji, text symbol, etc.)
    return 'emoji';
  }
}
