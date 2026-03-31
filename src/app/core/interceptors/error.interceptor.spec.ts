import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptors,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { NotificationService } from '../services/notification.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let notificationSpy: jasmine.SpyObj<NotificationService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    notificationSpy = jasmine.createSpyObj('NotificationService', [
      'error', 'success', 'warning', 'info',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notificationSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should pass through successful requests', () => {
    http.get('/api/v1/articles').subscribe((data) => {
      expect(data).toEqual({ content: [] });
    });

    const req = httpMock.expectOne('/api/v1/articles');
    req.flush({ content: [] });

    expect(notificationSpy.error).not.toHaveBeenCalled();
  });

  it('should show "Could not connect" for status 0', () => {
    http.get('/api/v1/articles').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/articles');
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown' });

    expect(notificationSpy.error).toHaveBeenCalledWith('Could not connect to the server');
  });

  it('should show i18n message for 400 with body', () => {
    http.post('/api/v1/admin/articles', {}).subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/articles');
    req.flush({ message: 'Título é obrigatório' }, { status: 400, statusText: 'Bad Request' });

    expect(notificationSpy.error).toHaveBeenCalledWith('Invalid request');
  });

  it('should show default message for 400 without body message', () => {
    http.post('/api/v1/admin/articles', {}).subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/articles');
    req.flush({}, { status: 400, statusText: 'Bad Request' });

    expect(notificationSpy.error).toHaveBeenCalledWith('Invalid request');
  });

  it('should NOT show notification for 401', () => {
    http.get('/api/v1/admin/dashboard').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/dashboard');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(notificationSpy.error).not.toHaveBeenCalled();
  });

  it('should show "no permission" for 403', () => {
    http.get('/api/v1/admin/users').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/users');
    req.flush(null, { status: 403, statusText: 'Forbidden' });

    expect(notificationSpy.error).toHaveBeenCalledWith(
      'You do not have permission to access this resource'
    );
  });

  it('should show "Resource not found" for 404', () => {
    http.get('/api/v1/articles/not-found-slug').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/articles/not-found-slug');
    req.flush(null, { status: 404, statusText: 'Not Found' });

    expect(notificationSpy.error).toHaveBeenCalledWith('Resource not found');
  });

  it('should show i18n message for 409 with body', () => {
    http.post('/api/v1/admin/tags', { name: 'Java' }).subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/tags');
    req.flush({ message: 'Tag já existe' }, { status: 409, statusText: 'Conflict' });

    expect(notificationSpy.error).toHaveBeenCalledWith('Data conflict');
  });

  it('should show "Too many requests" for 429', () => {
    http.post('/api/v1/admin/auth/login', {}).subscribe({
      error: () => {},
    });

    // /auth/login is a silent endpoint, so test with something else
    http.get('/api/v1/admin/dashboard').subscribe({
      error: () => {},
    });

    // Flush the silent one first
    const loginReq = httpMock.expectOne('/api/v1/admin/auth/login');
    loginReq.flush(null, { status: 429, statusText: 'Too Many Requests' });

    const dashReq = httpMock.expectOne('/api/v1/admin/dashboard');
    dashReq.flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(notificationSpy.error).toHaveBeenCalledWith(
      'Too many requests. Please wait a moment.'
    );
  });

  it('should show "Internal server error" for 500', () => {
    http.get('/api/v1/articles').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/articles');
    req.flush(null, { status: 500, statusText: 'Internal Server Error' });

    expect(notificationSpy.error).toHaveBeenCalledWith('Internal server error');
  });

  it('should show "Server temporarily unavailable" for 502/503/504', () => {
    http.get('/api/v1/articles').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/articles');
    req.flush(null, { status: 503, statusText: 'Service Unavailable' });

    expect(notificationSpy.error).toHaveBeenCalledWith(
      'Server temporarily unavailable'
    );
  });

  // Silent endpoints
  it('should NOT show notification for /auth/login errors', () => {
    http.post('/api/v1/admin/auth/login', {}).subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/auth/login');
    req.flush({ message: 'Invalid' }, { status: 400, statusText: 'Bad Request' });

    expect(notificationSpy.error).not.toHaveBeenCalled();
  });

  it('should NOT show notification for /auth/refresh errors', () => {
    http.post('/api/v1/admin/auth/refresh', {}).subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/auth/refresh');
    req.flush(null, { status: 400, statusText: 'Bad Request' });

    expect(notificationSpy.error).not.toHaveBeenCalled();
  });
});
