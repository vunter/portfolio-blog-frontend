import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { DeleteAccountComponent } from './delete-account.component';
import {
  AccountPrivacyService,
  AccountDeletionPreview,
} from '../../../../core/services/account-privacy.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { AuthStore } from '../../../../core/auth/auth.store';

describe('DeleteAccountComponent', () => {
  let component: DeleteAccountComponent;
  let fixture: ComponentFixture<DeleteAccountComponent>;
  let mockService: jasmine.SpyObj<AccountPrivacyService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockAuthStore: { logout: jasmine.Spy };
  let router: Router;

  const preview: AccountDeletionPreview = {
    newsletterLinked: true,
    newsletterStatus: 'CONFIRMED',
    commentsCount: 3,
    articlesCount: 1,
  };

  beforeEach(async () => {
    mockService = jasmine.createSpyObj('AccountPrivacyService', [
      'getDeletionPreview',
      'deleteAccount',
    ]);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);
    mockAuthStore = { logout: jasmine.createSpy('logout') };

    mockService.getDeletionPreview.and.returnValue(of(preview));

    const mockI18n = {
      t: (key: string) => (key === 'account.delete.confirmWord' ? 'DELETE' : key),
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [DeleteAccountComponent],
      providers: [
        provideRouter([]),
        { provide: AccountPrivacyService, useValue: mockService },
        { provide: NotificationService, useValue: mockNotification },
        { provide: I18nService, useValue: mockI18n },
        { provide: AuthStore, useValue: mockAuthStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteAccountComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads and renders the deletion preview', () => {
    fixture.detectChanges();

    expect(mockService.getDeletionPreview).toHaveBeenCalled();
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('account.delete.previewComments');
    expect(compiled.textContent).toContain('account.delete.previewArticles');
    expect(compiled.textContent).toContain('account.delete.previewNewsletterLinked');
  });

  it('shows the cancel-newsletter checkbox only when the newsletter is linked', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#cancel-newsletter')).toBeTruthy();
  });

  it('hides the cancel-newsletter checkbox when nothing is linked', () => {
    mockService.getDeletionPreview.and.returnValue(
      of({ ...preview, newsletterLinked: false, newsletterStatus: null })
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#cancel-newsletter')).toBeFalsy();
  });

  it('does not submit without a password', () => {
    fixture.detectChanges();

    component.submit();

    expect(mockService.deleteAccount).not.toHaveBeenCalled();
    expect(component.form.controls.password.touched).toBeTrue();
  });

  it('requires the confirmation word for permanent erasure', () => {
    fixture.detectChanges();
    component.setMode('ERASE');
    component.form.controls.password.setValue('secret');
    component.form.controls.confirmWord.setValue('nope');

    component.submit();

    expect(mockService.deleteAccount).not.toHaveBeenCalled();
    expect(component.submitErrorKey()).toBe('account.delete.confirmWordError');
  });

  it('deactivates the account, logs out and redirects home', () => {
    mockService.deleteAccount.and.returnValue(of(void 0));
    fixture.detectChanges();
    component.form.controls.password.setValue('secret');
    component.form.controls.cancelNewsletter.setValue(true);

    component.submit();

    expect(mockService.deleteAccount).toHaveBeenCalledWith({
      password: 'secret',
      mode: 'DEACTIVATE',
      cancelNewsletter: true,
    });
    expect(mockNotification.success).toHaveBeenCalled();
    expect(mockAuthStore.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('erases the account when the confirmation word matches', () => {
    mockService.deleteAccount.and.returnValue(of(void 0));
    fixture.detectChanges();
    component.setMode('ERASE');
    component.form.controls.password.setValue('secret');
    component.form.controls.confirmWord.setValue('delete');

    component.submit();

    expect(mockService.deleteAccount).toHaveBeenCalledWith({
      password: 'secret',
      mode: 'ERASE',
      cancelNewsletter: false,
    });
    expect(mockAuthStore.logout).toHaveBeenCalled();
  });

  it('shows a wrong-password error on 401 without logging out', () => {
    mockService.deleteAccount.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );
    fixture.detectChanges();
    component.form.controls.password.setValue('wrong');

    component.submit();
    fixture.detectChanges();

    expect(component.submitErrorKey()).toBe('account.delete.wrongPassword');
    expect(mockAuthStore.logout).not.toHaveBeenCalled();
    const alert = fixture.nativeElement.querySelector('.form-error[role="alert"]');
    expect(alert?.textContent).toContain('account.delete.wrongPassword');
  });

  // AUD19C-DEL: wrong password now comes back as 400 from the backend re-auth check.
  // The message must show inline and the user must NOT be logged out.
  it('shows a wrong-password error on 400 without logging out', () => {
    mockService.deleteAccount.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400 }))
    );
    fixture.detectChanges();
    component.form.controls.password.setValue('wrong');

    component.submit();
    fixture.detectChanges();

    expect(component.submitErrorKey()).toBe('account.delete.wrongPassword');
    expect(mockAuthStore.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    const alert = fixture.nativeElement.querySelector('.form-error[role="alert"]');
    expect(alert?.textContent).toContain('account.delete.wrongPassword');
  });

  it('shows a generic error on other failures', () => {
    mockService.deleteAccount.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );
    fixture.detectChanges();
    component.form.controls.password.setValue('secret');

    component.submit();

    expect(component.submitErrorKey()).toBe('account.delete.failed');
    expect(mockAuthStore.logout).not.toHaveBeenCalled();
  });

  it('never sends cancelNewsletter=true when the newsletter is not linked', () => {
    mockService.getDeletionPreview.and.returnValue(
      of({ ...preview, newsletterLinked: false, newsletterStatus: null })
    );
    mockService.deleteAccount.and.returnValue(of(void 0));
    fixture.detectChanges();
    component.form.controls.password.setValue('secret');
    component.form.controls.cancelNewsletter.setValue(true);

    component.submit();

    expect(mockService.deleteAccount).toHaveBeenCalledWith(
      jasmine.objectContaining({ cancelNewsletter: false })
    );
  });
});
