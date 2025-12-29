import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-languages-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './languages-section.component.html',
  styleUrl: './languages-section.component.scss',
})
export class LanguagesSectionComponent {
  readonly i18n = inject(I18nService);

  profile = input<ResumeProfile | null>(null);

  readonly profileLanguages = computed(() => this.profile()?.languages ?? null);

  readonly workModeDisplay = computed(() => {
    const val = this.profile()?.workMode;
    if (!val) return null;
    return val.split(',').map(v => {
      const key = 'resume.profile.workMode.' + v.trim();
      const translated = this.i18n.t(key);
      return translated !== key ? translated : v.trim();
    }).join(', ');
  });

  readonly timezoneDisplay = computed(() => {
    const val = this.profile()?.timezone;
    if (!val) return null;
    return val.split(',').map(v => {
      const tz = v.trim();
      const keySuffix = tz.replace('UTC-', 'utcM').replace('UTC+', 'utcP').replace(':', '');
      const key = 'resume.profile.tz.' + keySuffix;
      const translated = this.i18n.t(key);
      return translated !== key ? translated : tz;
    }).join(', ');
  });

  readonly employmentTypeDisplay = computed(() => {
    const val = this.profile()?.employmentType;
    if (!val) return null;
    return val.split(',').map(v => {
      const key = 'resume.profile.employmentType.' + v.trim();
      const translated = this.i18n.t(key);
      return translated !== key ? translated : v.trim();
    }).join(', ');
  });
}
