import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeDownloadService } from '../../../core/services/resume-download.service';
import { ContactFormComponent } from '../../../shared/components/contact-form/contact-form.component';
import { ResumeProfile } from '../../../models/resume-profile.model';

@Component({
  selector: 'app-contact-section',
  imports: [ContactFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-section.component.html',
  styleUrl: './contact-section.component.scss',
})
export class ContactSectionComponent {
  readonly i18n = inject(I18nService);
  private readonly resumeDownload = inject(ResumeDownloadService);

  profile = input<ResumeProfile | null>(null);

  readonly email = computed(() => this.profile()?.email ?? '');
  readonly linkedinUrl = computed(() => {
    const url = this.profile()?.linkedin;
    return url ? (url.startsWith('http') ? url : 'https://' + url) : '';
  });
  readonly githubUrl = computed(() => {
    const url = this.profile()?.github;
    return url ? (url.startsWith('http') ? url : 'https://' + url) : '';
  });
  readonly profileAlias = computed(() => {
    // Extract alias from profile LinkedIn URL or use empty string
    const linkedin = this.profile()?.linkedin ?? '';
    const match = linkedin.match(/linkedin\.com\/in\/([^/]+)/);
    return match?.[1] ?? '';
  });

  readonly contactDescription = computed(() => {
    return this.getHomeCustomization('contact_description') ?? null; // null = i18n fallback in template
  });

  private static readonly AVAILABILITY_KEY_MAP: Record<string, string> = {
    'remote-opportunities': 'resume.profile.availability.remoteOpportunities',
    'open-to-new': 'resume.profile.availability.openToNew',
    'employed-open-to-offers': 'resume.profile.availability.employedOpenToOffers',
    'actively-looking': 'resume.profile.availability.activelyLooking',
    'immediately': 'resume.profile.availability.immediately',
    'two-weeks': 'resume.profile.availability.twoWeeks',
    'not-available': 'resume.profile.availability.notAvailable',
  };

  readonly availabilityText = computed(() => {
    const raw = this.getHomeCustomization('availability_status');
    if (!raw) return null;
    const i18nKey = ContactSectionComponent.AVAILABILITY_KEY_MAP[raw];
    if (i18nKey) {
      const translated = this.i18n.t(i18nKey);
      return translated !== i18nKey ? translated : raw;
    }
    return raw; // custom value, show as-is
  });

  readonly displayTitle = computed(() => this.profile()?.title ?? '');

  // Shared with the header CTA — same in-flight flag, so both spinners agree.
  readonly downloadingResume = this.resumeDownload.downloading;

  downloadResume(): void {
    this.resumeDownload.download();
  }

  private getHomeCustomization(label: string): string | null {
    return this.profile()?.homeCustomization?.find(i => i.label === label)?.content ?? null;
  }
}
