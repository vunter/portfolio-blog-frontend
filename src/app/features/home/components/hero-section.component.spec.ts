import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HeroSectionComponent } from './hero-section.component';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

describe('HeroSectionComponent', () => {
  let component: HeroSectionComponent;
  let fixture: ComponentFixture<HeroSectionComponent>;

  const mockProfile: ResumeProfile = {
    fullName: 'Jane Smith',
    title: 'Full Stack Developer',
    email: 'jane@example.com',
    linkedin: 'linkedin.com/in/janesmith',
    github: 'https://github.com/janesmith',
    educations: [],
    experiences: [],
    skills: [],
    languages: [],
    certifications: [],
    additionalInfo: [],
    homeCustomization: [
      { label: 'highlight_1_value', content: '12+', sortOrder: 1 },
      { label: 'highlight_1_label', content: 'Years Building', sortOrder: 2 },
      { label: 'highlight_2_value', content: '65%', sortOrder: 3 },
      { label: 'highlight_2_label', content: 'Efficiency Gain', sortOrder: 4 },
      { label: 'highlight_3_value', content: '90%', sortOrder: 5 },
      { label: 'highlight_3_label', content: 'Uptime SLA', sortOrder: 6 },
    ],
    testimonials: [],
    proficiencies: [],
    projects: [],
    learningTopics: [],
  };

  const mockI18n = {
    t: (key: string) => key,
    language: signal('en'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroSectionComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroSectionComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should show default values when no profile is set', () => {
    fixture.detectChanges();

    expect(component.displayName()).toBe('');
    expect(component.displayTitle()).toBe('');
    expect(component.email()).toBe('');
  });

  it('should show default stats when no profile is set', () => {
    fixture.detectChanges();

    expect(component.yearsExp()).toBeNull();
    expect(component.costReduction()).toBeNull();
    expect(component.ticketReduction()).toBeNull();
  });

  it('should display profile data when profile input is set', () => {
    fixture.componentRef.setInput('profile', mockProfile);
    fixture.detectChanges();

    expect(component.displayName()).toBe('Jane Smith');
    expect(component.displayTitle()).toBe('Full Stack Developer');
    expect(component.email()).toBe('jane@example.com');
  });

  it('should display homeCustomization stats from profile', () => {
    fixture.componentRef.setInput('profile', mockProfile);
    fixture.detectChanges();

    expect(component.yearsExp()).toBe('12+');
    expect(component.costReduction()).toBe('65%');
    expect(component.ticketReduction()).toBe('90%');
  });

  it('should display custom highlight labels from profile', () => {
    fixture.componentRef.setInput('profile', mockProfile);
    fixture.detectChanges();

    expect(component.yearsExpLabel()).toBe('Years Building');
    expect(component.costReductionLabel()).toBe('Efficiency Gain');
    expect(component.ticketReductionLabel()).toBe('Uptime SLA');
  });

  it('should fall back to null labels when no custom labels set', () => {
    const profileNoLabels: ResumeProfile = {
      ...mockProfile,
      homeCustomization: [
        { label: 'highlight_1_value', content: '5+', sortOrder: 1 },
        { label: 'highlight_2_value', content: '50%', sortOrder: 2 },
        { label: 'highlight_3_value', content: '70%', sortOrder: 3 },
      ],
    };
    fixture.componentRef.setInput('profile', profileNoLabels);
    fixture.detectChanges();

    expect(component.yearsExpLabel()).toBeNull();
    expect(component.costReductionLabel()).toBeNull();
    expect(component.ticketReductionLabel()).toBeNull();
  });

  it('should prepend https:// to linkedin if missing protocol', () => {
    fixture.componentRef.setInput('profile', mockProfile);
    fixture.detectChanges();

    expect(component.linkedinUrl()).toBe('https://linkedin.com/in/janesmith');
  });

  it('should keep https:// for github if already present', () => {
    fixture.componentRef.setInput('profile', mockProfile);
    fixture.detectChanges();

    expect(component.githubUrl()).toBe('https://github.com/janesmith');
  });

  it('should render hero section element', () => {
    fixture.detectChanges();

    const hero = fixture.nativeElement.querySelector('.hero');
    expect(hero).toBeTruthy();
  });

  it('should render display name in h1', () => {
    fixture.componentRef.setInput('profile', mockProfile);
    fixture.detectChanges();

    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1.textContent).toContain('Jane Smith');
  });

  it('should render stat items', () => {
    fixture.componentRef.setInput('profile', mockProfile);
    fixture.detectChanges();

    const statValues = fixture.nativeElement.querySelectorAll('.stat-value');
    expect(statValues.length).toBe(3);
    expect(statValues[0].textContent.trim()).toBe('12+');
    expect(statValues[1].textContent.trim()).toBe('65%');
    expect(statValues[2].textContent.trim()).toBe('90%');
  });
});
