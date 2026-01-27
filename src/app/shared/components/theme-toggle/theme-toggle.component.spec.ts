import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from '../../../core/services/theme.service';

describe('ThemeToggleComponent', () => {
  let component: ThemeToggleComponent;
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('app-theme', 'dark');

    // Mock matchMedia so 'auto' preference resolves to 'light' deterministically
    spyOn(window, 'matchMedia').and.returnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: jasmine.createSpy('addListener'),
      removeListener: jasmine.createSpy('removeListener'),
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
      dispatchEvent: jasmine.createSpy('dispatchEvent'),
    } as any);

    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should inject ThemeService', () => {
    expect(component.themeService).toBeTruthy();
  });

  describe('rendering', () => {
    it('should render a button with role=switch', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button[role="switch"]');
      expect(button).toBeTruthy();
    });

    it('should have aria-label for accessibility', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button');
      expect(button?.getAttribute('aria-label')).toBe('Toggle light/dark/auto theme');
    });

    it('should set aria-checked based on dark mode', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button');

      TestBed.flushEffects();
      fixture.detectChanges();

      const ariaChecked = button?.getAttribute('aria-checked');
      expect(ariaChecked).toBe(String(themeService.isDark()));
    });

    it('should have sun and moon icons', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const sunIcon = compiled.querySelector('.toggle-icon--sun');
      const moonIcon = compiled.querySelector('.toggle-icon--moon');

      expect(sunIcon).toBeTruthy();
      expect(moonIcon).toBeTruthy();
    });

    it('should have toggle track and knob', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const track = compiled.querySelector('.toggle-track');
      const knob = compiled.querySelector('.toggle-knob');

      expect(track).toBeTruthy();
      expect(knob).toBeTruthy();
    });
  });

  describe('variants', () => {
    it('should default to "default" variant', () => {
      expect(component.variant()).toBe('default');
    });

    it('should apply compact class', () => {
      fixture.componentRef.setInput('variant', 'compact');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button.compact');
      expect(button).toBeTruthy();
    });

    it('should apply floating class', () => {
      fixture.componentRef.setInput('variant', 'floating');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button.floating');
      expect(button).toBeTruthy();
    });

    it('should apply sidebar class', () => {
      fixture.componentRef.setInput('variant', 'sidebar');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button.sidebar');
      expect(button).toBeTruthy();
    });

    it('should render segmented control with 3 radio buttons', () => {
      fixture.componentRef.setInput('variant', 'segmented');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.theme-segmented');
      expect(container).toBeTruthy();
      const buttons = compiled.querySelectorAll('.theme-segment');
      expect(buttons.length).toBe(3);
    });

    it('should highlight active segment matching preference', () => {
      themeService.setPreference('auto');
      TestBed.flushEffects();
      fixture.componentRef.setInput('variant', 'segmented');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const autoBtn = compiled.querySelector('.theme-segment--auto');
      expect(autoBtn?.classList.contains('active')).toBeTrue();
    });

    it('should set preference directly on segmented button click', () => {
      spyOn(themeService, 'setPreference');
      fixture.componentRef.setInput('variant', 'segmented');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('.theme-segment');
      (buttons[0] as HTMLButtonElement).click(); // light button

      expect(themeService.setPreference).toHaveBeenCalledWith('light');
    });
  });

  describe('showLabel', () => {
    it('should not show label by default', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const label = compiled.querySelector('.toggle-label-text');
      expect(label).toBeNull();
    });

    it('should show label when showLabel is true', () => {
      fixture.componentRef.setInput('showLabel', true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const label = compiled.querySelector('.toggle-label-text');
      expect(label).toBeTruthy();
    });

    it('should show "Dark" label when dark mode is active', () => {
      themeService.setTheme('dark');
      TestBed.flushEffects();
      fixture.componentRef.setInput('showLabel', true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const label = compiled.querySelector('.toggle-label-text');
      expect(label?.textContent?.trim()).toBe('Dark');
    });

    it('should show "Light" label when light mode is active', () => {
      themeService.setTheme('light');
      TestBed.flushEffects();
      fixture.componentRef.setInput('showLabel', true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const label = compiled.querySelector('.toggle-label-text');
      expect(label?.textContent?.trim()).toBe('Light');
    });
  });

  describe('click interaction', () => {
    it('should call toggleTheme on button click', () => {
      spyOn(themeService, 'toggleTheme');

      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button') as HTMLButtonElement;
      button.click();

      expect(themeService.toggleTheme).toHaveBeenCalled();
    });

    it('should toggle theme state on click', () => {
      const initialTheme = themeService.theme();

      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button') as HTMLButtonElement;
      button.click();

      TestBed.flushEffects();
      const newTheme = themeService.theme();
      expect(newTheme).not.toBe(initialTheme);
    });
  });

  describe('dark mode classes', () => {
    it('should have dark class on knob when theme is dark', () => {
      themeService.setTheme('dark');
      TestBed.flushEffects();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const knob = compiled.querySelector('.toggle-knob');
      expect(knob?.classList.contains('dark')).toBeTrue();
    });

    it('should not have dark class on knob when theme is light', () => {
      themeService.setTheme('light');
      TestBed.flushEffects();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const knob = compiled.querySelector('.toggle-knob');
      expect(knob?.classList.contains('dark')).toBeFalse();
    });

    it('should mark moon icon active in dark mode', () => {
      themeService.setTheme('dark');
      TestBed.flushEffects();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const moonIcon = compiled.querySelector('.toggle-icon--moon');
      expect(moonIcon?.classList.contains('active')).toBeTrue();
    });

    it('should mark sun icon active in light mode', () => {
      themeService.setTheme('light');
      TestBed.flushEffects();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const sunIcon = compiled.querySelector('.toggle-icon--sun');
      expect(sunIcon?.classList.contains('active')).toBeTrue();
    });
  });
});
