import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  UserResponse,
} from '../../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;
  private oauthProviders$?: Observable<Record<string, boolean>>;

  getOAuthProviders(): Observable<Record<string, boolean>> {
    if (!this.oauthProviders$) {
      this.oauthProviders$ = this.http
        .get<Record<string, boolean>>(`${this.baseUrl}/admin/auth/oauth2/providers`)
        .pipe(shareReplay(1));
    }
    return this.oauthProviders$;
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/admin/auth/login/v2`, request, {
      withCredentials: true,
    });
  }

  register(request: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/admin/auth/register`, request, {
      withCredentials: true,
    });
  }

  refreshToken(request: Record<string, unknown> = {}): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/admin/auth/refresh`, request, {
      withCredentials: true,
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/auth/logout`, {}, {
      withCredentials: true,
    });
  }

  requestPasswordReset(request: PasswordResetRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/auth/forgot-password`, request);
  }

  confirmPasswordReset(request: PasswordResetConfirmRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/auth/reset-password`, request);
  }

  validateResetToken(token: string): Observable<{ valid: boolean }> {
    return this.http.get<{ valid: boolean }>(`${this.baseUrl}/admin/auth/reset-password/validate`, {
      params: { token }
    });
  }

  getCurrentUser(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/admin/users/me`, {
      withCredentials: true,
    });
  }

  getActiveSessions(): Observable<SessionInfo[]> {
    return this.http.get<SessionInfo[]>(`${this.baseUrl}/admin/auth/sessions`, {
      withCredentials: true,
    });
  }

  revokeSession(sessionId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/auth/sessions/${sessionId}`, {
      withCredentials: true,
    });
  }

  revokeAllOtherSessions(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/auth/sessions`, {
      withCredentials: true,
    });
  }
}

export interface SessionInfo {
  id: number;
  deviceName: string;
  ipAddress: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}
