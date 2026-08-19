import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ContactSectionComponent } from './contact-section.component';
import { I18nService } from '../../../core/services/i18n.service';
import { ResumeDownloadService } from '../../../core/services/resume-download.service';
import { ResumeProfile } from '../../../models/resume-profile.model';

// AUD19C-09: the public profile endpoint strips email (and phone) on the
// username-fallback path — the CTAs must not render dead mailto:/href="" links,
// while the section itself (CV download + contact form) stays visible.
describe('ContactSectionComponent', () => {
  let component: ContactSectionComponent;
  let fixture: ComponentFixture<ContactSectionComponent>;
  let mockDownload: { downloading: ReturnType<typeof signal<boolean>>; download: jasmine.Spy };

  beforeEach(async () => {
    mockDownload = { downloading: signal(false), download: jasmine.createSpy('download') };
    const mockI18n = { t: (key: string) => key, language: signal('en') };

    await TestBed.configureTestingModule({
      imports: [ContactSectionComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
        { provide: ResumeDownloadService, useValue: mockDownload },
      ],
    })
      // The embedded contact form is out of scope — render without it.
      .overrideComponent(ContactSectionComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactSectionComponent);
    component = fixture.componentInstance;
  });

  function buttonAnchors(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.contact-buttons a'));
  }

  it('renders no broken anchors for a profile with stripped contact fields', () => {
    fixture.componentRef.setInput('profile', { username: 'leo' } as unknown as ResumeProfile);
    fixture.detectChanges();

    expect(buttonAnchors().length).toBe(0);
    // The CV download button and the rest of the section must remain
    expect(fixture.nativeElement.querySelector('.btn-download')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#contact')).toBeTruthy();
  });

  it('renders no broken anchors when the profile is null', () => {
    fixture.detectChanges();

    expect(buttonAnchors().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.btn-download')).toBeTruthy();
  });

  it('renders each CTA only when its contact field is present', () => {
    fixture.componentRef.setInput('profile', {
      email: 'leo@example.com',
      github: 'github.com/leo',
    } as unknown as ResumeProfile);
    fixture.detectChanges();

    const anchors = buttonAnchors();
    expect(anchors.length).toBe(2);
    expect(anchors[0].getAttribute('href')).toBe('mailto:leo@example.com');
    expect(anchors[1].getAttribute('href')).toBe('https://github.com/leo');
    // No LinkedIn anchor without a linkedin field
    expect(anchors.some(a => a.textContent?.includes('LinkedIn'))).toBeFalse();
  });

  it('renders all three CTAs for a full profile', () => {
    fixture.componentRef.setInput('profile', {
      email: 'leo@example.com',
      linkedin: 'https://linkedin.com/in/leo',
      github: 'https://github.com/leo',
    } as unknown as ResumeProfile);
    fixture.detectChanges();

    expect(buttonAnchors().length).toBe(3);
  });
});
