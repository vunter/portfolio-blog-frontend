import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let component: PaginationComponent;
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('computedTotalPages', () => {
    it('should use direct totalPages when provided', () => {
      fixture.componentRef.setInput('totalPages', 10);
      fixture.detectChanges();

      expect(component.computedTotalPages()).toBe(10);
    });

    it('should calculate from totalElements and pageSize', () => {
      fixture.componentRef.setInput('totalElements', 42);
      fixture.componentRef.setInput('pageSize', 10);
      fixture.detectChanges();

      expect(component.computedTotalPages()).toBe(5); // ceil(42/10)
    });

    it('should return 0 when no data', () => {
      fixture.detectChanges();
      expect(component.computedTotalPages()).toBe(0);
    });

    it('should handle exact division', () => {
      fixture.componentRef.setInput('totalElements', 30);
      fixture.componentRef.setInput('pageSize', 10);
      fixture.detectChanges();

      expect(component.computedTotalPages()).toBe(3);
    });

    it('should prefer direct totalPages over calculation', () => {
      fixture.componentRef.setInput('totalPages', 5);
      fixture.componentRef.setInput('totalElements', 100);
      fixture.componentRef.setInput('pageSize', 10);
      fixture.detectChanges();

      expect(component.computedTotalPages()).toBe(5);
    });
  });

  describe('visiblePages', () => {
    it('should show all pages when total <= maxVisible', () => {
      fixture.componentRef.setInput('totalPages', 3);
      fixture.componentRef.setInput('currentPage', 0);
      fixture.componentRef.setInput('maxVisiblePages', 5);
      fixture.detectChanges();

      expect(component.visiblePages()).toEqual([0, 1, 2]);
    });

    it('should show window around current page', () => {
      fixture.componentRef.setInput('totalPages', 20);
      fixture.componentRef.setInput('currentPage', 10);
      fixture.componentRef.setInput('maxVisiblePages', 5);
      fixture.detectChanges();

      expect(component.visiblePages()).toEqual([8, 9, 10, 11, 12]);
    });

    it('should clamp to start when current page is near beginning', () => {
      fixture.componentRef.setInput('totalPages', 20);
      fixture.componentRef.setInput('currentPage', 1);
      fixture.componentRef.setInput('maxVisiblePages', 5);
      fixture.detectChanges();

      expect(component.visiblePages()).toEqual([0, 1, 2, 3, 4]);
    });

    it('should clamp to end when current page is near end', () => {
      fixture.componentRef.setInput('totalPages', 20);
      fixture.componentRef.setInput('currentPage', 18);
      fixture.componentRef.setInput('maxVisiblePages', 5);
      fixture.detectChanges();

      expect(component.visiblePages()).toEqual([15, 16, 17, 18, 19]);
    });

    it('should show empty array when no pages', () => {
      fixture.componentRef.setInput('totalPages', 0);
      fixture.detectChanges();

      expect(component.visiblePages()).toEqual([]);
    });

    it('should show single page', () => {
      fixture.componentRef.setInput('totalPages', 1);
      fixture.componentRef.setInput('currentPage', 0);
      fixture.detectChanges();

      expect(component.visiblePages()).toEqual([0]);
    });
  });

  describe('goToPage', () => {
    it('should emit pageChange for valid page', () => {
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('currentPage', 0);
      fixture.detectChanges();

      spyOn(component.pageChange, 'emit');

      component.goToPage(3);
      expect(component.pageChange.emit).toHaveBeenCalledWith(3);
    });

    it('should not emit for current page', () => {
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('currentPage', 5);
      fixture.detectChanges();

      spyOn(component.pageChange, 'emit');

      component.goToPage(5);
      expect(component.pageChange.emit).not.toHaveBeenCalled();
    });

    it('should not emit for negative page', () => {
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('currentPage', 0);
      fixture.detectChanges();

      spyOn(component.pageChange, 'emit');

      component.goToPage(-1);
      expect(component.pageChange.emit).not.toHaveBeenCalled();
    });

    it('should not emit for page >= totalPages', () => {
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('currentPage', 9);
      fixture.detectChanges();

      spyOn(component.pageChange, 'emit');

      component.goToPage(10);
      expect(component.pageChange.emit).not.toHaveBeenCalled();
    });

    it('should emit for first page navigation', () => {
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('currentPage', 5);
      fixture.detectChanges();

      spyOn(component.pageChange, 'emit');

      component.goToPage(0);
      expect(component.pageChange.emit).toHaveBeenCalledWith(0);
    });

    it('should emit for last page navigation', () => {
      fixture.componentRef.setInput('totalPages', 10);
      fixture.componentRef.setInput('currentPage', 0);
      fixture.detectChanges();

      spyOn(component.pageChange, 'emit');

      component.goToPage(9);
      expect(component.pageChange.emit).toHaveBeenCalledWith(9);
    });
  });

  describe('rendering', () => {
    it('should render navigation buttons', () => {
      fixture.componentRef.setInput('totalPages', 5);
      fixture.componentRef.setInput('currentPage', 2);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('.pagination__btn');
      // 4 navigation buttons (first, prev, next, last) + 5 page buttons
      expect(buttons.length).toBe(9);
    });

    it('should disable first/prev buttons on first page', () => {
      fixture.componentRef.setInput('totalPages', 5);
      fixture.componentRef.setInput('currentPage', 0);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('.pagination__btn');
      // First two buttons (first, prev) should be disabled
      expect((buttons[0] as HTMLButtonElement).disabled).toBeTrue();
      expect((buttons[1] as HTMLButtonElement).disabled).toBeTrue();
    });

    it('should disable next/last buttons on last page', () => {
      fixture.componentRef.setInput('totalPages', 5);
      fixture.componentRef.setInput('currentPage', 4);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('.pagination__btn');
      const total = buttons.length;
      // Last two buttons (next, last) should be disabled
      expect((buttons[total - 1] as HTMLButtonElement).disabled).toBeTrue();
      expect((buttons[total - 2] as HTMLButtonElement).disabled).toBeTrue();
    });

    it('should highlight active page button', () => {
      fixture.componentRef.setInput('totalPages', 5);
      fixture.componentRef.setInput('currentPage', 2);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const activeBtn = compiled.querySelector('.pagination__btn--active');
      expect(activeBtn).toBeTruthy();
      expect(activeBtn?.textContent?.trim()).toBe('3'); // Page 2 is displayed as "3" (0-indexed)
    });

    it('should set aria-current on active page', () => {
      fixture.componentRef.setInput('totalPages', 5);
      fixture.componentRef.setInput('currentPage', 1);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const activeBtn = compiled.querySelector('[aria-current="page"]');
      expect(activeBtn).toBeTruthy();
      expect(activeBtn?.textContent?.trim()).toBe('2');
    });

    it('should emit on page button click', () => {
      fixture.componentRef.setInput('totalPages', 5);
      fixture.componentRef.setInput('currentPage', 0);
      fixture.detectChanges();

      spyOn(component.pageChange, 'emit');

      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('.pagination__btn');
      // Third button is page "2" (index 1)
      (buttons[3] as HTMLButtonElement).click();

      expect(component.pageChange.emit).toHaveBeenCalledWith(1);
    });
  });
});
