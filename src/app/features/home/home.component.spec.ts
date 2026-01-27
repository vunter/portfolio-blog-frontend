import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { HomeComponent } from './home.component';
import { ThemeService } from '../../core/services/theme.service';
import { PublicProfileService } from '../../core/services/public-profile.service';
import { I18nService } from '../../core/services/i18n.service';
import { ResumeProfile } from '../../models/resume-profile.model';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  const mockProfile: ResumeProfile = {
    fullName: 'John Doe',
    title: 'Software Engineer',
    email: 'john@example.com',
    linkedin: 'linkedin.com/in/john',
    github: 'github.com/john',
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
  };

  const mockThemeService = {
    isDark: signal(false),
    theme: signal('light' as const),
    preference: signal('light' as const),
    isAuto: signal(false),
    setTheme: jasmine.createSpy('setTheme'),
  };

  const mockProfileService = {
    profile: signal<ResumeProfile | null>(mockProfile),
    loading: signal(false),
    loaded: signal(true),
    error: signal(false),
    retry: jasmine.createSpy('retry'),
  };

  const mockI18n = {
    t: (key: string) => key,
    language: signal('en'),
  };

  beforeEach(async () => {
    // Reset signals before each test
    mockProfileService.profile.set(mockProfile);
    mockProfileService.loading.set(false);
    mockProfileService.loaded.set(true);
    mockProfileService.error.set(false);
    mockThemeService.isDark.set(false);

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ThemeService, useValue: mockThemeService },
        { provide: PublicProfileService, useValue: mockProfileService },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should inject themeService', () => {
    expect(component.themeService).toBeTruthy();
    expect(component.themeService.isDark()).toBeFalse();
  });

  it('should inject profileService', () => {
    expect(component.profileService).toBeTruthy();
    expect(component.profileService.profile()).toEqual(mockProfile);
  });

  it('should render main layout when profile is loaded', () => {
    fixture.detectChanges();

    const mainLayout = fixture.nativeElement.querySelector('.main-layout');
    expect(mainLayout).toBeTruthy();
  });

  it('should render loading skeleton when loading and not yet loaded', () => {
    mockProfileService.loading.set(true);
    mockProfileService.loaded.set(false);
    mockProfileService.error.set(false);
    fixture.detectChanges();

    const skeleton = fixture.nativeElement.querySelector('.loading-skeleton');
    expect(skeleton).toBeTruthy();
    const mainLayout = fixture.nativeElement.querySelector('.main-layout');
    expect(mainLayout).toBeFalsy();
  });

  it('should render error fallback when error occurs', () => {
    mockProfileService.error.set(true);
    fixture.detectChanges();

    const errorFallback = fixture.nativeElement.querySelector('.error-fallback');
    expect(errorFallback).toBeTruthy();
  });

  it('should apply dark theme class when isDark is true', () => {
    mockThemeService.isDark.set(true);
    fixture.detectChanges();

    const homePage = fixture.nativeElement.querySelector('.home-page');
    expect(homePage.classList.contains('theme-dark')).toBeTrue();
    expect(homePage.classList.contains('theme-light')).toBeFalse();
  });

  it('should apply light theme class when isDark is false', () => {
    mockThemeService.isDark.set(false);
    fixture.detectChanges();

    const homePage = fixture.nativeElement.querySelector('.home-page');
    expect(homePage.classList.contains('theme-light')).toBeTrue();
    expect(homePage.classList.contains('theme-dark')).toBeFalse();
  });

  it('should not render main layout when error is present', () => {
    mockProfileService.error.set(true);
    fixture.detectChanges();

    const mainLayout = fixture.nativeElement.querySelector('.main-layout');
    expect(mainLayout).toBeFalsy();
  });

  it('should have retry button in error fallback', () => {
    mockProfileService.error.set(true);
    fixture.detectChanges();

    const retryBtn = fixture.nativeElement.querySelector('.error-fallback__retry');
    expect(retryBtn).toBeTruthy();
  });
});
