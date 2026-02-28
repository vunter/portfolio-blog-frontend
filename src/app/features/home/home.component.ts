import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { PublicProfileService } from '../../core/services/public-profile.service';
import { I18nService } from '../../core/services/i18n.service';
import { SeoService } from '../../core/services/seo.service';
import { HeroSectionComponent } from './components/hero-section.component';
import { SkillsSectionComponent } from './components/skills-section.component';
import { ExperienceSectionComponent } from './components/experience-section.component';
import { ProjectsSectionComponent } from './components/projects-section.component';
import { EducationSectionComponent } from './components/education-section.component';
import { LanguagesSectionComponent } from './components/languages-section.component';
import { ProficiencySectionComponent } from './components/proficiency-section.component';
import { LearningSectionComponent } from './components/learning-section.component';
import { TestimonialsSectionComponent } from './components/testimonials-section.component';
import { ContactSectionComponent } from './components/contact-section.component';
import { SidebarSectionComponent } from './components/sidebar-section.component';
// PERF-F-05: Removed unused ProfileSelectorComponent import (F-500: re-add when multi-dev is ready)

@Component({
  selector: 'app-home',
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
    // PERF-F-05: ProfileSelectorComponent removed — re-add when F-500 multi-dev is ready
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  readonly themeService = inject(ThemeService);
  readonly profileService = inject(PublicProfileService);
  readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.update({
      title: '',
      description: this.i18n.t('seo.home.description'),
      url: '/',
      locale: this.seo.getLocale(this.i18n.language()),
    });
  }
}
