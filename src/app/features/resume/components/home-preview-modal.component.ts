import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models';
import { HeroSectionComponent } from '../../home/components/hero-section.component';
import { SkillsSectionComponent } from '../../home/components/skills-section.component';
import { ExperienceSectionComponent } from '../../home/components/experience-section.component';
import { ProjectsSectionComponent } from '../../home/components/projects-section.component';
import { EducationSectionComponent } from '../../home/components/education-section.component';
import { LanguagesSectionComponent } from '../../home/components/languages-section.component';
import { ProficiencySectionComponent } from '../../home/components/proficiency-section.component';
import { LearningSectionComponent } from '../../home/components/learning-section.component';
import { TestimonialsSectionComponent } from '../../home/components/testimonials-section.component';
import { ContactSectionComponent } from '../../home/components/contact-section.component';
import { SidebarSectionComponent } from '../../home/components/sidebar-section.component';

@Component({
  selector: 'app-home-preview-modal',
  imports: [
    HeroSectionComponent,
    SkillsSectionComponent,
    ExperienceSectionComponent,
    ProjectsSectionComponent,
    EducationSectionComponent,
    LanguagesSectionComponent,
    ProficiencySectionComponent,
    LearningSectionComponent,
    TestimonialsSectionComponent,
    ContactSectionComponent,
    SidebarSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-preview-modal.component.html',
  styleUrl: './home-preview-modal.component.scss',
})
export class HomePreviewModalComponent {
  readonly themeService = inject(ThemeService);
  readonly i18n = inject(I18nService);

  readonly profile = input<ResumeProfile | null>(null);
  readonly close = output<void>();
}
