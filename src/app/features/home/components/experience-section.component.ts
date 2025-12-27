import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile, ResumeProfileExperience } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-experience-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './experience-section.component.html',
  styleUrl: './experience-section.component.scss',
})
export class ExperienceSectionComponent {
  readonly i18n = inject(I18nService);
  readonly profile = input<ResumeProfile | null>(null);
  readonly experiences = computed(() => this.profile()?.experiences ?? null);
}
