import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-skills-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skills-section.component.html',
  styleUrl: './skills-section.component.scss',
})
export class SkillsSectionComponent {
  readonly i18n = inject(I18nService);
  readonly profile = input<ResumeProfile | null>(null);

  readonly dynamicSkills = computed(() => {
    const skills = this.profile()?.skills;
    if (!skills?.length) return null;
    return skills.map(s => ({
      category: s.category,
      tags: s.content.split(/,\s*(?![^()]*\))/).map(t => t.trim()).filter(t => t.length > 0)
    }));
  });
}
