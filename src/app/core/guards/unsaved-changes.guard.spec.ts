import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { unsavedChangesGuard, HasUnsavedChanges } from './unsaved-changes.guard';
import { I18nService } from '../services/i18n.service';
import { ConfirmDialogService } from '../services/confirm-dialog.service';

describe('unsavedChangesGuard', () => {
  let i18nSpy: jasmine.SpyObj<I18nService>;
  let confirmDialogService: ConfirmDialogService;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = { url: '/admin/articles/new' } as RouterStateSnapshot;

  beforeEach(() => {
    i18nSpy = jasmine.createSpyObj('I18nService', ['t']);
    i18nSpy.t.and.returnValue('You have unsaved changes. Leave anyway?');

    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18nSpy },
        ConfirmDialogService,
      ],
    });

    confirmDialogService = TestBed.inject(ConfirmDialogService);
  });

  it('should allow navigation when component is null', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(null as any, {} as any, mockState, mockState)
    );
    expect(result).toBeTrue();
  });

  it('should allow navigation when hasUnsavedChanges is false', async () => {
    const component: HasUnsavedChanges = { hasUnsavedChanges: false };

    const result = await TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as any, mockState, mockState)
    );
    expect(result).toBeTrue();
  });

  it('should call confirm dialog when hasUnsavedChanges is true', async () => {
    spyOn(confirmDialogService, 'confirm').and.returnValue(Promise.resolve(true));
    const component: HasUnsavedChanges = { hasUnsavedChanges: true };

    await TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as any, mockState, mockState)
    );

    expect(confirmDialogService.confirm).toHaveBeenCalled();
  });

  it('should use I18nService for the confirmation message', async () => {
    spyOn(confirmDialogService, 'confirm').and.returnValue(Promise.resolve(true));
    const component: HasUnsavedChanges = { hasUnsavedChanges: true };

    await TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as any, mockState, mockState)
    );

    expect(i18nSpy.t).toHaveBeenCalledWith('dev.articles.unsavedChanges');
    expect(confirmDialogService.confirm).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'warning' })
    );
  });

  it('should allow navigation when user confirms', async () => {
    spyOn(confirmDialogService, 'confirm').and.returnValue(Promise.resolve(true));
    const component: HasUnsavedChanges = { hasUnsavedChanges: true };

    const result = await TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as any, mockState, mockState)
    );
    expect(result).toBeTrue();
  });

  it('should block navigation when user cancels', async () => {
    spyOn(confirmDialogService, 'confirm').and.returnValue(Promise.resolve(false));
    const component: HasUnsavedChanges = { hasUnsavedChanges: true };

    const result = await TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as any, mockState, mockState)
    );
    expect(result).toBeFalse();
  });

  it('should not show confirm dialog when no unsaved changes', async () => {
    spyOn(confirmDialogService, 'confirm');
    const component: HasUnsavedChanges = { hasUnsavedChanges: false };

    await TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as any, mockState, mockState)
    );

    expect(confirmDialogService.confirm).not.toHaveBeenCalled();
  });

  it('should not inject I18nService when no unsaved changes', async () => {
    const component: HasUnsavedChanges = { hasUnsavedChanges: false };

    await TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as any, mockState, mockState)
    );

    expect(i18nSpy.t).not.toHaveBeenCalled();
  });
});
