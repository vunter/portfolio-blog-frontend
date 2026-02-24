import { Component, ChangeDetectionStrategy, inject, signal, input, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { I18nService } from '../../../core/services/i18n.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DownloadService } from '../../../core/services/download.service';
import { ContactFormComponent } from '../../../shared/components/contact-form/contact-form.component';
import { environment } from '../../../../environments/environment';
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
  // TODO F-329: Use ApiService instead of direct HttpClient for consistency
  private http = inject(HttpClient);
  private notification = inject(NotificationService);
  private downloadService = inject(DownloadService);

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

  downloadingResume = signal(false);

  downloadResume(): void {
    if (this.downloadingResume()) return;

    this.downloadingResume.set(true);
    const lang = this.i18n.language();
    const alias = environment.ownerAlias;
    const url = `${environment.apiUrl}/${environment.apiVersion}/public/resume/${alias}/pdf?lang=${lang}&t=${Date.now()}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const name = this.profile()?.fullName ?? 'Resume';
        const safeName = name.replace(/\s+/g, '_');
        const filename = this.i18n.isEnglish()
          ? `${safeName}_Resume.pdf`
          : `${safeName}_Curriculo.pdf`;
        this.downloadService.downloadBlob(blob, filename);
        this.downloadingResume.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('home.contact.downloadError'));
        this.downloadingResume.set(false);
      }
    });
  }

  private getHomeCustomization(label: string): string | null {
    return this.profile()?.homeCustomization?.find(i => i.label === label)?.content ?? null;
  }
}
