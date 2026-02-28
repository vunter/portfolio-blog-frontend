import { Component, inject, OnInit, OnDestroy, signal, computed, input, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import 'emoji-picker-element';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ResumeProfileService } from '../../services/resume-profile.service';
import {
  ResumeProfile,
  ResumeProfileRequest,
  ResumeProfileEducation,
  ResumeProfileExperience,
  ResumeProfileSkill,
  ResumeProfileLanguage,
  ResumeProfileCertification,
  ResumeProfileAdditionalInfo,
  ResumeProfileHomeCustomization,
  ResumeProfileTestimonial,
  ResumeProfileProficiency,
  ResumeProfileProject,
  ResumeProfileLearningTopic,
} from '../../../../models';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { getLocaleName } from '../../../../shared/utils/locale.utils';

interface ExperienceFormEntry extends ResumeProfileExperience {
  _bulletsText?: string;
}

interface ProjectFormEntry extends ResumeProfileProject {
  _techTagsText?: string;
}

interface ProfileForm extends Omit<ResumeProfile, 'experiences' | 'projects'> {
  experiences: ExperienceFormEntry[];
  projects: ProjectFormEntry[];
}

const EMPTY_PROFILE: ProfileForm = {
  fullName: '',
  educations: [],
  experiences: [],
  skills: [],
  languages: [],
  certifications: [],
  additionalInfo: [],
  homeCustomization: [],
  testimonials: [],
  proficiencies: [],
  projects: [],
  learningTopics: [],
} as ProfileForm;

@Component({
  selector: 'app-resume-profile',
  imports: [FormsModule, RouterLink],
  // M-14: CUSTOM_ELEMENTS_SCHEMA is required because this component uses
  // <emoji-picker> from the 'emoji-picker-element' Web Component library.
  // Angular would otherwise reject the unknown HTML element.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './resume-profile.component.html',
  styleUrl: './resume-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeProfileComponent implements OnInit, OnDestroy {
  private readonly profileService = inject(ResumeProfileService);
  private readonly notification = inject(NotificationService);
  readonly i18n = inject(I18nService);

  // Expose Object to template for Object.keys/entries
  Object = Object;

  // M-12: Track setTimeout IDs for cleanup on destroy
  // Dynamic styles (e.g., getSliderGradient) must remain inline as they are computed at runtime
  private messageTimers: ReturnType<typeof setTimeout>[] = [];

  /** When true, hides page header and personal info section (used when embedded in admin profile) */
  embedded = input(false);

  loading = signal(true);
  saving = signal(false);
  translating = signal(false);
  translationAvailable = signal(false);
  translateMessage = signal('');
  translateError = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  fieldErrors = signal<Record<string, string>>({});
  formSubmitted = signal(false);
  targetLang = 'EN';
  currentLocale = 'en';
  translateSourceLocale: string | null = null;
  availableLocales = signal<string[]>([]);
  collapsedSections = signal<Record<string, boolean>>({});

  // Icon & Emoji picker state
  iconPickerIndex = signal<number | null>(null);
  emojiPickerIndex = signal<number | null>(null);
  topicPickerTab = signal<'icons' | 'emojis' | 'url'>('icons');
  customIconUrl = '';
  iconSearchQuery = '';
  filteredIcons = signal([] as { class: string; label: string }[]);

  // FA icons loaded at runtime from CDN stylesheets
  faIconsLoading = signal(false);
  allFaIcons: { class: string; label: string }[] = [];
  private faIconsLoaded = false;

  // Hardcoded arrays removed — icons loaded from CDN, emojis from emoji-picker-element
  // FA icon CDN fetch: SRI not applicable to fetch() API; local assets recommended for production
  // FA icon names are cached in allFaIcons/faIconsLoaded after first load
  private readonly FA_CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css';
  showNewLocaleMenu = signal(false);

  readonly allLocales = ['en', 'pt-br', 'pt-pt', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'ru', 'ja', 'zh'];
  readonly remainingLocales = computed(() => {
    const existing = this.availableLocales();
    return this.allLocales.filter(l => !existing.includes(l));
  });

  profile: ProfileForm = { ...EMPTY_PROFILE };

  ngOnInit(): void {
    this.loadProfile();
    this.checkTranslationStatus();
    this.loadAvailableLocales();
  }

  private checkTranslationStatus(): void {
    this.profileService.getTranslationStatus().subscribe({
      next: (status) => this.translationAvailable.set(status.available),
      error: () => this.translationAvailable.set(false),
    });
  }

  translateProfile(): void {
    if (this.translating()) return;
    this.translating.set(true);
    this.translateMessage.set('');
    this.translateError.set(false);

    const sourceLang = this.translateSourceLocale || this.currentLocale;
    this.profileService.translateProfile(this.targetLang, sourceLang).subscribe({
      next: (translated) => {
        // Switch to the target locale and fill form with translated content
        // The user must click "Salvar" to persist the translation
        const targetLocale = this.targetLang.toLowerCase();
        this.currentLocale = targetLocale;
        this.profile = {
          ...translated,
          educations: translated.educations || [],
          experiences: (translated.experiences || []).map((exp) => ({
            ...exp,
            _bulletsText: (exp.bullets || []).join('\n'),
          })),
          skills: translated.skills || [],
          languages: translated.languages || [],
          certifications: translated.certifications || [],
          additionalInfo: translated.additionalInfo || [],
          homeCustomization: translated.homeCustomization || [],
          testimonials: translated.testimonials || [],
          proficiencies: translated.proficiencies || [],
          projects: (translated.projects || []).map((proj) => ({
            ...proj,
            _techTagsText: (proj.techTags || []).join(', '),
          })),
          learningTopics: translated.learningTopics || [],
        };
        this.translating.set(false);
        this.translateSourceLocale = null;
        this.translateMessage.set(this.i18n.t('resume.profile.translateSuccess'));
        this.setMessageTimer(() => this.translateMessage.set(''), 12000);
      },
      error: (err) => {
        this.translating.set(false);
        this.translateError.set(true);
        const msg = err.status === 503
          ? this.i18n.t('resume.profile.translateNotConfigured')
          : this.i18n.t('resume.profile.translateError') + ': ' + (err.error?.message || err.message);
        this.translateMessage.set(msg);
        this.setMessageTimer(() => this.translateMessage.set(''), 8000);
      },
    });
  }

  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      'EN': 'English', 'PT-BR': 'Português (BR)', 'PT-PT': 'Português (PT)',
      'ES': 'Español', 'FR': 'Français', 'DE': 'Deutsch', 'IT': 'Italiano',
      'NL': 'Nederlands', 'PL': 'Polski', 'RU': 'Русский', 'JA': '日本語', 'ZH': '中文',
    };
    return names[code] || code;
  }

  // M-03: Delegate to shared utility
  getLocaleName(code: string): string {
    return getLocaleName(code);
  }

  loadProfile(): void {
    this.loading.set(true);
    this.profileService.getProfile(this.currentLocale).subscribe({
      next: (data) => {
        this.profile = {
          ...data,
          educations: data.educations || [],
          experiences: (data.experiences || []).map((exp) => ({
            ...exp,
            _bulletsText: (exp.bullets || []).join('\n'),
          })),
          skills: data.skills || [],
          languages: data.languages || [],
          certifications: data.certifications || [],
          additionalInfo: data.additionalInfo || [],
          homeCustomization: data.homeCustomization || [],
          testimonials: data.testimonials || [],
          proficiencies: data.proficiencies || [],
          projects: (data.projects || []).map((proj) => ({
            ...proj,
            _techTagsText: (proj.techTags || []).join(', '),
          })),
          learningTopics: data.learningTopics || [],
        };
        this.loading.set(false);
      },
      error: () => {
        // Profile not found for this locale — start with empty form
        this.profile = { ...EMPTY_PROFILE };
        this.loading.set(false);
      },
    });
  }

  private loadAvailableLocales(): void {
    this.profileService.listLocales().subscribe({
      next: (locales) => this.availableLocales.set(locales),
      error: () => this.availableLocales.set([]),
    });
  }

  switchLocale(locale: string): void {
    this.currentLocale = locale;
    this.translateSourceLocale = null;
    this.loadProfile();
  }

  toggleNewLocaleMenu(event: Event): void {
    event.stopPropagation();
    this.showNewLocaleMenu.update(v => !v);
  }

  addNewLocale(locale: string): void {
    this.showNewLocaleMenu.set(false);
    const previousLocale = this.currentLocale;
    this.translateSourceLocale = previousLocale;
    this.currentLocale = locale;

    // Deep-clone current profile as starting point for the new locale
    const cloned: ProfileForm = JSON.parse(JSON.stringify(this.profile));
    this.profile = cloned;

    // Pre-select the target language for translation if available
    this.targetLang = locale.toUpperCase();

    // Show a hint to the user
    this.successMessage.set('');
    this.errorMessage.set('');
    this.translateMessage.set(
      this.i18n.t('resume.profile.newLocaleHint', { from: previousLocale.toUpperCase(), to: locale.toUpperCase() })
    );
    this.translateError.set(false);
  }

  save(): void {
    this.saving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.fieldErrors.set({});
    this.formSubmitted.set(true);

    try {
      // Convert _bulletsText back to arrays and strip internal fields
      const experiences = (this.profile.experiences || []).map((exp, i) => {
        const { _bulletsText, ...rest } = exp;
        return {
          ...rest,
          sortOrder: i,
          bullets: (_bulletsText || '')
            .split('\n')
            .map((l: string) => l.trim())
            .filter((l: string) => l.length > 0),
        };
      });

      const request: ResumeProfileRequest = {
        fullName: this.profile.fullName,
        title: this.profile.title,
        email: this.profile.email,
        phone: this.profile.phone,
        linkedin: this.profile.linkedin,
        github: this.profile.github,
        website: this.profile.website,
        location: this.profile.location,
        professionalSummary: this.profile.professionalSummary,
        interests: this.profile.interests,
        // workMode/timezone/employmentType omitted — managed by HC component
        educations: (this.profile.educations || []).map((e, i) => ({ ...e, sortOrder: i })),
        experiences,
        skills: (this.profile.skills || []).map((s, i) => ({ ...s, sortOrder: i })),
        languages: (this.profile.languages || []).map((l, i) => ({ ...l, sortOrder: i })),
        certifications: (this.profile.certifications || []).map((c, i) => ({ ...c, sortOrder: i })),
        additionalInfo: (this.profile.additionalInfo || []).map((a, i) => ({ ...a, sortOrder: i })),
        // homeCustomization omitted — managed by HC component; null tells backend to skip
        testimonials: (this.profile.testimonials || []).map((t, i) => ({ ...t, sortOrder: i })),
        proficiencies: (this.profile.proficiencies || []).map((p, i) => ({ ...p, sortOrder: i })),
        projects: (this.profile.projects || []).map((proj, i) => {
          const { _techTagsText, ...rest } = proj;
          return {
            ...rest,
            sortOrder: i,
            techTags: (_techTagsText || '')
              .split(',')
              .map((t: string) => t.trim())
              .filter((t: string) => t.length > 0),
          };
        }),
        learningTopics: (this.profile.learningTopics || []).map((lt, i) => ({ ...lt, sortOrder: i })),
      };

      this.profileService.saveProfile(request, this.currentLocale).subscribe({
        next: (saved) => {
          this.profile = {
            ...saved,
            educations: saved.educations || [],
            experiences: (saved.experiences || []).map((exp) => ({
              ...exp,
              _bulletsText: (exp.bullets || []).join('\n'),
            })),
            skills: saved.skills || [],
            languages: saved.languages || [],
            certifications: saved.certifications || [],
            additionalInfo: saved.additionalInfo || [],
            homeCustomization: saved.homeCustomization || [],
            testimonials: saved.testimonials || [],
            proficiencies: saved.proficiencies || [],
            projects: (saved.projects || []).map((proj) => ({
              ...proj,
              _techTagsText: (proj.techTags || []).join(', '),
            })),
            learningTopics: saved.learningTopics || [],
          };
          this.saving.set(false);
          this.notification.success(this.i18n.t('resume.profile.saveSuccess'));
          this.loadAvailableLocales();
        },
        error: (err) => {
          this.saving.set(false);
          if (err.status === 400 && err.error?.validationErrors) {
            const serverErrors: Record<string, string> = err.error.validationErrors;
            this.fieldErrors.set(serverErrors);
            this.notification.error(this.i18n.t('resume.profile.saveError') + ': ' + (err.error?.message || this.i18n.t('resume.profile.fixValidationErrors')));
          } else {
            this.notification.error(this.i18n.t('resume.profile.saveError') + ': ' + (err.error?.message || err.message));
          }
        },
      });
    } catch (e: unknown) {
      this.saving.set(false);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.notification.error(this.i18n.t('resume.profile.saveError') + ': ' + msg);
    }
  }

  // M-12: Helper to track message-clearing timers for cleanup
  private setMessageTimer(callback: () => void, delay: number): void {
    this.messageTimers.push(setTimeout(callback, delay));
  }

  /** Check if a field has a backend validation error. Supports nested paths like 'educations[0].institution' */
  getFieldError(field: string): string {
    return this.fieldErrors()[field] || '';
  }

  /** Check if any field in a collection at given index has an error */
  hasEntryError(collection: string, index: number): boolean {
    const prefix = `${collection}[${index}]`;
    return Object.keys(this.fieldErrors()).some(k => k.startsWith(prefix));
  }

  ngOnDestroy(): void {
    // M-12: Clear all pending message timers
    for (const id of this.messageTimers) clearTimeout(id);
    this.messageTimers.length = 0;
  }

  // Add/Remove helpers
  addEducation(): void {
    this.profile.educations.push({
      institution: '', location: '', degree: '', startDate: '', endDate: '',
      sortOrder: this.profile.educations.length,
    });
  }
  removeEducation(i: number): void { this.profile.educations.splice(i, 1); }

  addExperience(): void {
    this.profile.experiences.push({
      company: '', position: '', startDate: '', bullets: [],
      _bulletsText: '', sortOrder: this.profile.experiences.length,
    });
  }
  removeExperience(i: number): void { this.profile.experiences.splice(i, 1); }

  addSkill(): void {
    this.profile.skills.push({
      category: '', content: '', sortOrder: this.profile.skills.length,
    });
  }
  removeSkill(i: number): void { this.profile.skills.splice(i, 1); }

  addLanguage(): void {
    this.profile.languages.push({
      name: '', proficiency: '', sortOrder: this.profile.languages.length,
    });
  }
  removeLanguage(i: number): void { this.profile.languages.splice(i, 1); }

  addCertification(): void {
    this.profile.certifications.push({
      name: '', sortOrder: this.profile.certifications.length,
    });
  }
  removeCertification(i: number): void { this.profile.certifications.splice(i, 1); }

  addAdditionalInfo(): void {
    this.profile.additionalInfo.push({
      label: '', content: '', sortOrder: this.profile.additionalInfo.length,
    });
  }
  removeAdditionalInfo(i: number): void { this.profile.additionalInfo.splice(i, 1); }

  addTestimonial(): void {
    this.profile.testimonials.push({
      authorName: '', authorRole: '', authorCompany: '', text: '',
      accentColor: 'accent', sortOrder: this.profile.testimonials.length,
    });
  }
  removeTestimonial(i: number): void { this.profile.testimonials.splice(i, 1); }

  addProficiency(): void {
    this.profile.proficiencies.push({
      skillName: '', percentage: 75, sortOrder: this.profile.proficiencies.length,
    });
  }
  removeProficiency(i: number): void { this.profile.proficiencies.splice(i, 1); }

  addProject(): void {
    this.profile.projects.push({
      title: '', description: '', techTags: [], featured: false,
      _techTagsText: '', sortOrder: this.profile.projects.length,
    });
  }
  removeProject(i: number): void { this.profile.projects.splice(i, 1); }

  addLearningTopic(): void {
    this.profile.learningTopics.push({
      title: '', description: '', emoji: '',
      colorTheme: '#6366f1', sortOrder: this.profile.learningTopics.length,
    });
  }
  removeLearningTopic(i: number): void { this.profile.learningTopics.splice(i, 1); }

  toggleSection(key: string): void {
    this.collapsedSections.update(s => ({ ...s, [key]: !s[key] }));
  }

  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.closest('.new-locale-dropdown') || target.closest('.locale-tab.new-locale')) {
      return;
    }
    this.showNewLocaleMenu.set(false);
  }

  // Slider gradient aligned with thumb center (22px thumb)
  getSliderGradient(percentage: number): string {
    const pct = percentage || 0;
    const offset = 11 - pct * 0.22;
    return `linear-gradient(to right, #6366f1 0%, #818cf8 calc(${pct}% + ${offset}px), #334155 calc(${pct}% + ${offset}px))`;
  }

  // Icon picker methods
  openIconPicker(index: number): void {
    this.emojiPickerIndex.set(null);
    this.iconPickerIndex.set(this.iconPickerIndex() === index ? null : index);
    this.iconSearchQuery = '';
    this.loadFaIcons();
  }

  closeIconPicker(): void {
    this.iconPickerIndex.set(null);
  }

  filterIcons(): void {
    const q = this.iconSearchQuery.toLowerCase();
    this.filteredIcons.set(
      q ? this.allFaIcons.filter(ic => ic.label.toLowerCase().includes(q) || ic.class.toLowerCase().includes(q)) : [...this.allFaIcons]
    );
  }

  /** Fetch FA icon names at runtime by parsing CDN stylesheets */
  private async loadFaIcons(): Promise<void> {
    if (this.faIconsLoaded) { this.filteredIcons.set([...this.allFaIcons]); return; }
    this.faIconsLoading.set(true);
    try {
      const [solidCss, brandsCss] = await Promise.all([
        fetch(`${this.FA_CDN_BASE}/solid.min.css`).then(r => r.text()),
        fetch(`${this.FA_CDN_BASE}/brands.min.css`).then(r => r.text()),
      ]);
      const extractNames = (css: string): Set<string> => {
        const names = new Set<string>();
        const regex = /\.fa-([a-z0-9][a-z0-9-]*?)(?:::before|:before)/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(css)) !== null) names.add(m[1]);
        return names;
      };
      const toLabel = (n: string) => n.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const brandNames = extractNames(brandsCss);
      const solidNames = extractNames(solidCss);
      const icons: { class: string; label: string }[] = [];
      for (const name of solidNames) icons.push({ class: `fas fa-${name}`, label: toLabel(name) });
      for (const name of brandNames) if (!solidNames.has(name)) icons.push({ class: `fab fa-${name}`, label: toLabel(name) });
      icons.sort((a, b) => a.label.localeCompare(b.label));
      this.allFaIcons = icons;
      this.faIconsLoaded = true;
    } catch {
      console.warn('Failed to load Font Awesome icons from CDN — icon picker will be empty');
    } finally {
      this.faIconsLoading.set(false);
      this.filterIcons();
    }
  }

  selectIcon(iconClass: string): void {
    const idx = this.iconPickerIndex();
    if (idx !== null && this.profile.proficiencies[idx]) {
      this.profile.proficiencies[idx].icon = iconClass;
    }
    this.iconPickerIndex.set(null);
  }

  // Emoji/icon picker methods for Learning Topics
  toggleEmojiPicker(index: number): void {
    this.iconPickerIndex.set(null);
    if (this.emojiPickerIndex() === index) {
      this.emojiPickerIndex.set(null);
    } else {
      this.emojiPickerIndex.set(index);
      this.topicPickerTab.set('icons');
      this.customIconUrl = '';
      this.iconSearchQuery = '';
      this.loadFaIcons();
    }
  }

  closeEmojiPicker(): void {
    this.emojiPickerIndex.set(null);
  }

  selectEmoji(value: string): void {
    const idx = this.emojiPickerIndex();
    if (idx !== null && this.profile.learningTopics[idx]) {
      this.profile.learningTopics[idx].emoji = value;
    }
    this.customIconUrl = '';
    this.emojiPickerIndex.set(null);
  }

  /** Handle emoji-picker-element's emoji-click event */
  onEmojiPicked(event: Event): void {
    const detail = (event as CustomEvent)?.detail;
    const unicode = detail?.unicode;
    if (unicode) this.selectEmoji(unicode);
  }
}
