import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-education-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './education-section.component.html',
  styleUrl: './education-section.component.scss',
})
export class EducationSectionComponent {
  readonly i18n = inject(I18nService);
  readonly profile = input<ResumeProfile | null>(null);

  readonly educations = computed(() => this.profile()?.educations ?? null);
  readonly certifications = computed(() => this.profile()?.certifications ?? null);
  readonly hasProfileData = computed(() => {
    const edu = this.educations();
    return edu !== null && edu.length > 0;
  });
}
