import { Component, inject, signal, input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResumeProfileService } from '../../../resume/services/resume-profile.service';
import { ResumeProfile, ResumeProfileHomeCustomization } from '../../../../models';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { MultiSelectComponent } from '../../../../shared/components/multi-select/multi-select.component';
import { HomePreviewModalComponent } from '../../../resume/components/home-preview-modal.component';
import { getLocaleName as sharedGetLocaleName } from '../../../../shared/utils/locale.utils';

// TODO F-333: Extract merge logic to ResumeProfileService.mergeForPreview()

@Component({
  selector: 'app-home-customization',
  imports: [FormsModule, MultiSelectComponent, HomePreviewModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-customization.component.html',
  styleUrl: './home-customization.component.scss',
})
export class HomeCustomizationComponent implements OnInit {
  readonly i18n = inject(I18nService);

  /** When false, hides floating FABs (used when parent provides its own FABs) */
  showFabs = input(true);
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

  // TODO F-386: Extract section configurations to separate data file
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

  private readonly WELL_KNOWN_LABELS = [
    'hero_description', 'sidebar_bio', 'contact_description',
    'availability_status',
    'highlight_1_value', 'highlight_1_label',
    'highlight_2_value', 'highlight_2_label',
    'highlight_3_value', 'highlight_3_label',
  ];

  readonly workModeOptions = [
    { value: 'remote', labelKey: 'resume.profile.workMode.remote' },
    { value: 'hybrid', labelKey: 'resume.profile.workMode.hybrid' },
    { value: 'onsite', labelKey: 'resume.profile.workMode.onsite' },
    { value: 'flexible', labelKey: 'resume.profile.workMode.flexible' },
  ];

  readonly availabilityStatusOptions = [
    { value: 'remote-opportunities', labelKey: 'resume.profile.availability.remoteOpportunities' },
    { value: 'open-to-new', labelKey: 'resume.profile.availability.openToNew' },
    { value: 'employed-open-to-offers', labelKey: 'resume.profile.availability.employedOpenToOffers' },
    { value: 'actively-looking', labelKey: 'resume.profile.availability.activelyLooking' },
    { value: 'immediately', labelKey: 'resume.profile.availability.immediately' },
    { value: 'two-weeks', labelKey: 'resume.profile.availability.twoWeeks' },
    { value: 'not-available', labelKey: 'resume.profile.availability.notAvailable' },
  ];

  readonly timezoneOptions = [
    { value: 'UTC-12', labelKey: 'resume.profile.tz.utcM12' },
    { value: 'UTC-11', labelKey: 'resume.profile.tz.utcM11' },
    { value: 'UTC-10', labelKey: 'resume.profile.tz.utcM10' },
    { value: 'UTC-9', labelKey: 'resume.profile.tz.utcM9' },
    { value: 'UTC-8', labelKey: 'resume.profile.tz.utcM8' },
    { value: 'UTC-7', labelKey: 'resume.profile.tz.utcM7' },
    { value: 'UTC-6', labelKey: 'resume.profile.tz.utcM6' },
    { value: 'UTC-5', labelKey: 'resume.profile.tz.utcM5' },
    { value: 'UTC-4', labelKey: 'resume.profile.tz.utcM4' },
    { value: 'UTC-3', labelKey: 'resume.profile.tz.utcM3' },
    { value: 'UTC-2', labelKey: 'resume.profile.tz.utcM2' },
    { value: 'UTC-1', labelKey: 'resume.profile.tz.utcM1' },
    { value: 'UTC+0', labelKey: 'resume.profile.tz.utcP0' },
    { value: 'UTC+1', labelKey: 'resume.profile.tz.utcP1' },
    { value: 'UTC+2', labelKey: 'resume.profile.tz.utcP2' },
    { value: 'UTC+3', labelKey: 'resume.profile.tz.utcP3' },
    { value: 'UTC+4', labelKey: 'resume.profile.tz.utcP4' },
    { value: 'UTC+5', labelKey: 'resume.profile.tz.utcP5' },
    { value: 'UTC+5:30', labelKey: 'resume.profile.tz.utcP530' },
    { value: 'UTC+6', labelKey: 'resume.profile.tz.utcP6' },
    { value: 'UTC+7', labelKey: 'resume.profile.tz.utcP7' },
    { value: 'UTC+8', labelKey: 'resume.profile.tz.utcP8' },
    { value: 'UTC+9', labelKey: 'resume.profile.tz.utcP9' },
    { value: 'UTC+10', labelKey: 'resume.profile.tz.utcP10' },
    { value: 'UTC+11', labelKey: 'resume.profile.tz.utcP11' },
    { value: 'UTC+12', labelKey: 'resume.profile.tz.utcP12' },
  ];

  readonly employmentTypeOptions = [
    { value: 'full-time', labelKey: 'resume.profile.employmentType.fullTime' },
    { value: 'part-time', labelKey: 'resume.profile.employmentType.partTime' },
    { value: 'contract', labelKey: 'resume.profile.employmentType.contract' },
    { value: 'freelance', labelKey: 'resume.profile.employmentType.freelance' },
    { value: 'internship', labelKey: 'resume.profile.employmentType.internship' },
  ];

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
      educations: merged.educations?.map((e, i) => ({ ...e, sortOrder: i })),
      experiences: merged.experiences?.map((e, i) => ({ ...e, sortOrder: i })),
      skills: merged.skills?.map((s, i) => ({ ...s, sortOrder: i })),
      languages: merged.languages?.map((l, i) => ({ ...l, sortOrder: i })),
      certifications: merged.certifications?.map((c, i) => ({ ...c, sortOrder: i })),
      additionalInfo: merged.additionalInfo?.map((a, i) => ({ ...a, sortOrder: i })),
      homeCustomization: merged.homeCustomization,
      testimonials: merged.testimonials?.map((t, i) => ({ ...t, sortOrder: i })),
      proficiencies: merged.proficiencies?.map((p, i) => ({ ...p, sortOrder: i })),
      projects: merged.projects?.map((p, i) => ({ ...p, sortOrder: i })),
      learningTopics: merged.learningTopics?.map((lt, i) => ({ ...lt, sortOrder: i })),
    };

    this.profileService.saveProfile(request, this.currentLocale).subscribe({
      next: (saved) => {
        this.fullProfile = saved;
        this.syncFormFromProfile();
        this.saving.set(false);
        this.isDirty.set(false);
        this.notification.success(this.i18n.t('admin.profile.hcSaveSuccess'));
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(
          this.i18n.t('admin.profile.hcSaveError') + ': ' + (err.error?.message || err.message)
        );
      },
    });
  }

  // ── Private helpers ──────────────────────────────

  private loadLocales(): void {
    this.profileService.listLocales().subscribe({
      next: (locales) => this.availableLocales.set(locales),
      error: () => this.availableLocales.set([]),
    });
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.profileService.getProfile(this.currentLocale).subscribe({
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
