import { Component, inject, signal, input, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ResumeProfileService } from '../../../resume/services/resume-profile.service';
import { ResumeProfile, ResumeProfileHomeCustomization } from '../../../../models';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { MultiSelectComponent } from '../../../../shared/components/multi-select/multi-select.component';
import { HomePreviewModalComponent } from '../../../resume/components/home-preview-modal.component';
import { getLocaleName as sharedGetLocaleName } from '../../../../shared/utils/locale.utils';
import {
  WELL_KNOWN_HC_LABELS,
  WORK_MODE_OPTIONS,
  AVAILABILITY_STATUS_OPTIONS,
  TIMEZONE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
} from './home-customization.data';

@Component({
  selector: 'app-home-customization',
  imports: [FormsModule, MultiSelectComponent, HomePreviewModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-customization.component.html',
  styleUrl: './home-customization.component.scss',
})
export class HomeCustomizationComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  /** When false, hides floating FABs (used when parent provides its own FABs) */
  showFabs = input(true);
  /** When false, hides inline action buttons (save, preview) */
  showActions = input(true);
  private profileService = inject(ResumeProfileService);
  private notification = inject(NotificationService);

  loading = signal(true);
  saving = signal(false);
  showPreview = signal(false);
  previewProfile = signal<ResumeProfile | null>(null);
  availableLocales = signal<string[]>([]);
  // M-05: Track whether the form has unsaved changes
  isDirty = signal(false);

  currentLocale = 'en';

  /** The full resume profile — kept in memory so we can merge HC changes on save */
  private fullProfile: ResumeProfile | null = null;

  // M-05: Snapshot of initial form state — used for dirty tracking
  private formSnapshot = '';

  /** Mark form as dirty (called from template on input changes) */
  markDirty(): void {
    this.isDirty.set(true);
  }

  /** Form fields for home customization (well-known labels) */
  hcForm = {
    hero_description: '',
    sidebar_bio: '',
    contact_description: '',
    availability_status: '',
    highlight_1_value: '',
    highlight_1_label: '',
    highlight_2_value: '',
    highlight_2_label: '',
    highlight_3_value: '',
    highlight_3_label: '',
  };

  /** Profile-level fields edited here */
  workMode = '';
  timezone = '';
  employmentType = '';

  private readonly WELL_KNOWN_LABELS = WELL_KNOWN_HC_LABELS;

  readonly workModeOptions = WORK_MODE_OPTIONS;
  readonly availabilityStatusOptions = AVAILABILITY_STATUS_OPTIONS;
  readonly timezoneOptions = TIMEZONE_OPTIONS;
  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;

  ngOnInit(): void {
    this.loadLocales();
    this.loadProfile();
  }

  // M-03: Delegate to shared utility
  getLocaleName(code: string): string {
    return sharedGetLocaleName(code);
  }

  switchLocale(locale: string): void {
    this.currentLocale = locale;
    this.loadProfile();
  }

  openPreview(): void {
    if (!this.fullProfile) return;
    const merged = this.buildMergedProfile();
    this.previewProfile.set(merged);
    this.showPreview.set(true);
  }

  save(): void {
    if (!this.fullProfile || this.saving()) return;
    this.saving.set(true);

    const merged = this.buildMergedProfile();

    const request = {
      fullName: merged.fullName,
      title: merged.title,
      email: merged.email,
      phone: merged.phone,
      linkedin: merged.linkedin,
      github: merged.github,
      website: merged.website,
      location: merged.location,
      professionalSummary: merged.professionalSummary,
      interests: merged.interests,
      workMode: merged.workMode,
      timezone: merged.timezone,
      employmentType: merged.employmentType,
      // Only send HC-managed child arrays; omit others so backend preserves them
      homeCustomization: merged.homeCustomization,
    };

    this.profileService.saveProfile(request, this.currentLocale).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.fullProfile = saved;
        this.syncFormFromProfile();
        this.saving.set(false);
        this.isDirty.set(false);
        this.notification.success(this.i18n.t('account.profile.hcSaveSuccess'));
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(
          this.i18n.t('account.profile.hcSaveError') + ': ' + (err.error?.message || err.message)
        );
      },
    });
  }

  // ── Private helpers ──────────────────────────────

  private loadLocales(): void {
    this.profileService.listLocales().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (locales) => this.availableLocales.set(locales),
      error: () => this.availableLocales.set([]),
    });
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.profileService.getProfile(this.currentLocale).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.fullProfile = data;
        this.syncFormFromProfile();
        this.loading.set(false);
      },
      error: () => {
        this.fullProfile = null;
        this.resetForm();
        this.loading.set(false);
      },
    });
  }

  /** Extract well-known HC labels from the profile into form fields */
  private syncFormFromProfile(): void {
    if (!this.fullProfile) { this.resetForm(); return; }

    const hc = this.hcForm as Record<string, string>;
    for (const label of this.WELL_KNOWN_LABELS) {
      const entry = (this.fullProfile.homeCustomization || []).find(a => a.label === label);
      hc[label] = entry?.content ?? '';
    }

    this.workMode = this.fullProfile.workMode || '';
    this.timezone = this.fullProfile.timezone || '';
    this.employmentType = this.fullProfile.employmentType || '';
    // M-05: Reset dirty state after loading
    this.isDirty.set(false);
  }

  private resetForm(): void {
    const hc = this.hcForm as Record<string, string>;
    for (const label of this.WELL_KNOWN_LABELS) { hc[label] = ''; }
    this.workMode = '';
    this.timezone = '';
    this.employmentType = '';
  }

  /** Build HC entries from form fields */
  private buildHomeCustomizationEntries(): ResumeProfileHomeCustomization[] {
    const hc = this.hcForm as Record<string, string>;
    const entries: ResumeProfileHomeCustomization[] = [];
    for (const label of this.WELL_KNOWN_LABELS) {
      const value = hc[label]?.trim();
      if (value) {
        entries.push({ label, content: value, sortOrder: entries.length });
      }
    }
    return entries;
  }

  /** Merge HC form changes into the full profile for saving */
  private buildMergedProfile(): ResumeProfile {
    const base = this.fullProfile!;
    return {
      ...base,
      workMode: this.workMode,
      timezone: this.timezone,
      employmentType: this.employmentType,
      homeCustomization: this.buildHomeCustomizationEntries(),
    };
  }
}
