import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuditComponent } from './audit.component';
import { AdminApiService, AuditLog } from '../../services/admin-api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';

// AUD19: audit drill-down (by-user / by-entity filter modes)
describe('AuditComponent', () => {
  let component: AuditComponent;
  let fixture: ComponentFixture<AuditComponent>;
  let mockAdminApi: jasmine.SpyObj<AdminApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;

  // AUD19C-02: id/performedBy are Snowflake strings
  const mockLogs: AuditLog[] = [
    {
      id: '1',
      action: 'UPDATE',
      entityType: 'ARTICLE',
      entityId: '55',
      performedBy: '7',
      performedByEmail: 'admin@example.com',
      details: 'Updated title',
      ipAddress: '10.0.0.1',
      createdAt: '2026-08-01T10:00:00Z',
    },
    {
      id: '2',
      action: 'LOGIN_FAILED',
      entityType: 'USER',
      entityId: 'ghost@example.com',
      performedBy: null as unknown as string,
      performedByEmail: 'ghost@example.com',
      details: 'Bad credentials',
      ipAddress: '10.0.0.2',
      createdAt: '2026-08-02T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockAdminApi = jasmine.createSpyObj('AdminApiService', [
      'getRecentAuditLogs',
      'getAuditLogsByUser',
      'getAuditLogsByEntity',
      'exportAuditCsv',
      'exportAuditJson',
    ]);
    mockAdminApi.getRecentAuditLogs.and.returnValue(of(mockLogs));
    mockAdminApi.getAuditLogsByUser.and.returnValue(of(mockLogs));
    mockAdminApi.getAuditLogsByEntity.and.returnValue(of([mockLogs[0]]));

    mockNotification = jasmine.createSpyObj('NotificationService', ['error', 'success']);

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [AuditComponent],
      providers: [
        { provide: AdminApiService, useValue: mockAdminApi },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditComponent);
    component = fixture.componentInstance;
  });

  it('should create and load recent logs by default', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component).toBeTruthy();
    expect(mockAdminApi.getRecentAuditLogs).toHaveBeenCalledWith(7, 50);
    expect(component.mode()).toBe('recent');
    expect(component.logs().length).toBe(2);
    expect(component.loading()).toBeFalse();
  }));

  describe('mode switching', () => {
    it('should clear logs and show the prompt when switching to a drill-down mode', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      component.setMode('user');
      fixture.detectChanges();

      expect(component.logs().length).toBe(0);
      expect(component.searched()).toBeFalse();
      expect(fixture.nativeElement.querySelector('.drill-prompt')).toBeTruthy();
      // No drill-down fetch happens until a query is submitted
      expect(mockAdminApi.getAuditLogsByUser).not.toHaveBeenCalled();
    }));

    it('should reload recent logs when switching back to recent mode', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      mockAdminApi.getRecentAuditLogs.calls.reset();

      component.setMode('entity');
      fixture.detectChanges();
      component.setMode('recent');
      fixture.detectChanges();
      tick();

      expect(mockAdminApi.getRecentAuditLogs).toHaveBeenCalledWith(7, 50);
      expect(component.logs().length).toBe(2);
    }));

    it('should hide the export buttons outside recent mode', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      expect(fixture.nativeElement.querySelector('.export-buttons')).toBeTruthy();

      component.setMode('user');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.export-buttons')).toBeFalsy();
    }));
  });

  describe('by-user mode', () => {
    it('should fetch logs for the entered user id with page 0 and size 20', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      component.setMode('user');
      component.userId.set('42');
      component.searchByUser();
      tick();

      expect(mockAdminApi.getAuditLogsByUser).toHaveBeenCalledWith('42', 0, 20);
      expect(component.logs().length).toBe(2);
      expect(component.searched()).toBeTrue();
    }));

    it('should reject an invalid user id without calling the API', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      component.setMode('user');
      component.userId.set(null);
      component.searchByUser();

      expect(mockNotification.error).toHaveBeenCalledWith('admin.audit.invalidUserId');

      // AUD19C-02: non-numeric strings are rejected too
      mockNotification.error.calls.reset();
      component.userId.set('abc');
      component.searchByUser();
      expect(mockNotification.error).toHaveBeenCalledWith('admin.audit.invalidUserId');

      expect(mockAdminApi.getAuditLogsByUser).not.toHaveBeenCalled();
    }));

    // AUD19C-02: Snowflake ids above 2^53 must survive untouched
    it('should pass Snowflake-sized ids through as strings', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      component.setMode('user');
      component.userId.set('9007199254740993');
      component.searchByUser();
      tick();

      expect(mockAdminApi.getAuditLogsByUser).toHaveBeenCalledWith('9007199254740993', 0, 20);
    }));

    it('should page forward and backward with prev/next (0-indexed)', fakeAsync(() => {
      // A full page (20 items) means there may be a next page
      const fullPage: AuditLog[] = Array.from({ length: 20 }, (_, i) => ({
        ...mockLogs[0],
        id: String(i + 1),
      }));
      mockAdminApi.getAuditLogsByUser.and.returnValue(of(fullPage));

      fixture.detectChanges();
      tick();
      component.setMode('user');
      component.userId.set('7');
      component.searchByUser();
      tick();

      expect(component.userHasNext()).toBeTrue();

      component.goToUserPage(1);
      tick();
      expect(mockAdminApi.getAuditLogsByUser).toHaveBeenCalledWith('7', 1, 20);

      // A short page means there is no next page
      mockAdminApi.getAuditLogsByUser.and.returnValue(of([mockLogs[0]]));
      component.goToUserPage(0);
      tick();
      expect(mockAdminApi.getAuditLogsByUser).toHaveBeenCalledWith('7', 0, 20);
      expect(component.userHasNext()).toBeFalse();
    }));
  });

  describe('by-entity mode', () => {
    it('should normalize the entity type to uppercase and fetch', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      component.setMode('entity');
      component.entityType.set('article');
      component.entityId.set(' 55 ');
      component.searchByEntity();
      tick();

      expect(mockAdminApi.getAuditLogsByEntity).toHaveBeenCalledWith('ARTICLE', '55');
      expect(component.logs().length).toBe(1);
      expect(component.searched()).toBeTrue();
    }));

    it('should reject an entity type that does not match ^[A-Z_]+$', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      component.setMode('entity');
      component.entityType.set('Bad-Type!');
      component.entityId.set('55');
      component.searchByEntity();

      expect(mockNotification.error).toHaveBeenCalledWith('admin.audit.invalidEntityType');
      expect(mockAdminApi.getAuditLogsByEntity).not.toHaveBeenCalled();
    }));

    it('should reject an empty entity id', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      component.setMode('entity');
      component.entityType.set('ARTICLE');
      component.entityId.set('   ');
      component.searchByEntity();

      expect(mockNotification.error).toHaveBeenCalledWith('admin.audit.invalidEntityId');
      expect(mockAdminApi.getAuditLogsByEntity).not.toHaveBeenCalled();
    }));

    it('should offer entity types seen in loaded logs plus backend constants', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      const options = component.entityTypeOptions();
      expect(options).toContain('ARTICLE');
      expect(options).toContain('USER');
      expect(options).toContain('SETTINGS');
    }));
  });

  describe('row-click drill-down', () => {
    it('should jump to by-user mode when a user cell is clicked', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const userLink: HTMLButtonElement = fixture.nativeElement.querySelector('td .cell-link:not(.cell-link--entity)');
      expect(userLink).toBeTruthy();
      userLink.click();
      tick();

      expect(component.mode()).toBe('user');
      expect(component.userId()).toBe('7');
      expect(mockAdminApi.getAuditLogsByUser).toHaveBeenCalledWith('7', 0, 20);
    }));

    it('should not render a user link for logs without a performer id', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      // Second mock log has performedBy null (failed login)
      expect(rows[1].querySelector('.cell-link:not(.cell-link--entity)')).toBeFalsy();
    }));

    it('should jump to by-entity mode when an entity cell is clicked', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const entityLink: HTMLButtonElement = fixture.nativeElement.querySelector('td .cell-link--entity');
      expect(entityLink).toBeTruthy();
      entityLink.click();
      tick();

      expect(component.mode()).toBe('entity');
      expect(component.entityType()).toBe('ARTICLE');
      expect(component.entityId()).toBe('55');
      expect(mockAdminApi.getAuditLogsByEntity).toHaveBeenCalledWith('ARTICLE', '55');
    }));
  });

  describe('error handling', () => {
    it('should show the error state with retry when the recent load fails', fakeAsync(() => {
      mockAdminApi.getRecentAuditLogs.and.returnValue(throwError(() => new Error('Network error')));

      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      expect(component.loadError()).toBeTrue();
      expect(fixture.nativeElement.querySelector('.load-error')).toBeTruthy();
      // The table (and its misleading empty state) must not render on failure
      expect(fixture.nativeElement.querySelector('.data-table')).toBeFalsy();
    }));

    it('should retry the failed load from the error state', fakeAsync(() => {
      mockAdminApi.getRecentAuditLogs.and.returnValue(throwError(() => new Error('Network error')));
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      mockAdminApi.getRecentAuditLogs.and.returnValue(of(mockLogs));
      const retryBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.load-error button');
      retryBtn.click();
      tick();
      fixture.detectChanges();

      expect(component.loadError()).toBeFalse();
      expect(component.logs().length).toBe(2);
      expect(fixture.nativeElement.querySelector('.data-table')).toBeTruthy();
    }));

    it('should retry the active drill-down query, not the recent load', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      component.setMode('user');
      component.userId.set('9');
      mockAdminApi.getAuditLogsByUser.and.returnValue(throwError(() => new Error('Network error')));
      component.searchByUser();
      tick();
      expect(component.loadError()).toBeTrue();

      mockAdminApi.getRecentAuditLogs.calls.reset();
      mockAdminApi.getAuditLogsByUser.and.returnValue(of(mockLogs));
      component.retry();
      tick();

      expect(mockAdminApi.getAuditLogsByUser).toHaveBeenCalledWith('9', 0, 20);
      expect(mockAdminApi.getRecentAuditLogs).not.toHaveBeenCalled();
      expect(component.loadError()).toBeFalse();
    }));
  });
});
