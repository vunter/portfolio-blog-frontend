import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-testimonials-section',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './testimonials-section.component.html',
  styleUrl: './testimonials-section.component.scss',
})
export class TestimonialsSectionComponent {
  readonly i18n = inject(I18nService);

  readonly profile = input<ResumeProfile | null>(null);

  readonly testimonials = computed(() => {
    const items = this.profile()?.testimonials ?? [];
    return items.length > 0 ? [...items].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  });

  readonly hasTestimonials = computed(() => this.testimonials().length > 0);

  getAccentClass(testimonial: { accentColor?: string }, index: number): string {
    if (testimonial.accentColor) {
      return 'testimonial-' + testimonial.accentColor;
    }
    // Cycle through default accent classes
    const defaults = ['testimonial-accent', 'testimonial-success', 'testimonial-warning'];
    return defaults[index % defaults.length];
  }
}
