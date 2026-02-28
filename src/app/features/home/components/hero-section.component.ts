import { Component, ChangeDetectionStrategy, inject, input, computed, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-hero-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.scss'
})
export class HeroSectionComponent {
  public i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly profile = input<ResumeProfile | null>(null);

  readonly displayName = computed(() => this.profile()?.fullName ?? '');
  readonly displayTitle = computed(() => this.profile()?.title ?? '');
  readonly email = computed(() => this.profile()?.email ?? '');
  readonly linkedinUrl = computed(() => {
    const url = this.profile()?.linkedin;
    return url ? (url.startsWith('http') ? url : 'https://' + url) : null;
  });
  readonly githubUrl = computed(() => {
    const url = this.profile()?.github;
    return url ? (url.startsWith('http') ? url : 'https://' + url) : null;
  });

  readonly yearsExp = computed(() => this.getHomeCustomization('highlight_1_value') ?? this.getHomeCustomization('years_experience') ?? null);
  readonly yearsExpLabel = computed(() => this.getHomeCustomization('highlight_1_label') ?? null);
  readonly costReduction = computed(() => this.getHomeCustomization('highlight_2_value') ?? this.getHomeCustomization('cost_reduction') ?? null);
  readonly costReductionLabel = computed(() => this.getHomeCustomization('highlight_2_label') ?? null);
  readonly ticketReduction = computed(() => this.getHomeCustomization('highlight_3_value') ?? this.getHomeCustomization('ticket_reduction') ?? null);
  readonly ticketReductionLabel = computed(() => this.getHomeCustomization('highlight_3_label') ?? null);

  readonly hasHighlights = computed(() => this.yearsExp() !== null || this.costReduction() !== null || this.ticketReduction() !== null);

  /** Hero description from homeCustomization, falling back to professionalSummary or null (i18n fallback in template) */
  // SEC-F-02: Sanitize HTML content before binding to [innerHTML] to prevent XSS.
  // Uses Angular's built-in DomSanitizer.sanitize(SecurityContext.HTML) which strips
  // dangerous elements/attributes while preserving safe formatting tags.
  readonly heroDescription = computed(() => {
    const fromCustomization = this.getHomeCustomization('hero_description');
    const raw = fromCustomization ?? this.profile()?.professionalSummary ?? null;
    if (!raw) return null;
    return this.sanitizer.sanitize(SecurityContext.HTML, raw) ?? null;
  });

  private getHomeCustomization(label: string): string | null {
    return this.profile()?.homeCustomization?.find(i => i.label === label)?.content ?? null;
  }
}
