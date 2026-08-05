import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { I18nService } from './i18n.service';
import { NotificationService } from './notification.service';
import { DownloadService } from './download.service';
import { AnalyticsTrackingService } from './analytics-tracking.service';
import { PublicProfileService } from './public-profile.service';
import { environment } from '../../../environments/environment';

/**
 * Central résumé-download flow shared by the header CTA and the contact section.
 * Both surfaces hit the public `/public/resume/{alias}/pdf` endpoint, name the
 * file from the loaded profile, and report the same errors — keeping that in one
 * place avoids the two copies drifting apart.
 */
@Injectable({ providedIn: 'root' })
export class ResumeDownloadService {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly notification = inject(NotificationService);
  private readonly downloadService = inject(DownloadService);
  private readonly analytics = inject(AnalyticsTrackingService);
  private readonly profileService = inject(PublicProfileService);

  /** True while a download is in flight (shared across every trigger). */
  readonly downloading = signal(false);

  /**
   * Download the active public profile's résumé PDF in the current language.
   * The active alias follows the profile selector (F-500); it defaults to the
   * owner alias. The filename uses the loaded profile's full name when known.
   */
  download(): void {
    if (this.downloading()) return;
    this.downloading.set(true);

    const lang = this.i18n.language();
    const alias = this.profileService.activeAlias() || environment.ownerAlias;

    this.api.getBlob(`/public/resume/${alias}/pdf`, { lang, t: Date.now() }).subscribe({
      next: (blob) => {
        const name = this.profileService.profile()?.fullName ?? 'Resume';
        const safeName = name.replace(/\s+/g, '_');
        const filename = this.i18n.isEnglish()
          ? `${safeName}_Resume.pdf`
          : `${safeName}_Curriculo.pdf`;
        this.downloadService.downloadBlob(blob, filename);
        this.analytics.trackDownload(filename, 'resume');
        this.downloading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('home.contact.downloadError'));
        this.downloading.set(false);
      },
    });
  }
}
