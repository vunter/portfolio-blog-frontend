import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginResponse,
  MfaSetupResponse,
  MfaStatusResponse,
  MfaLoginVerifyRequest,
  MfaVerifyRequest,
} from '../../models';

@Injectable({ providedIn: 'root' })
export class MfaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/${environment.apiVersion}/admin/mfa`;

  /** Initiate MFA setup (TOTP returns QR code + secret, EMAIL enables immediately). */
  setup(method: 'TOTP' | 'EMAIL'): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>(`${this.baseUrl}/setup`, { method }, {
      withCredentials: true,
    });
  }

  /** Verify initial TOTP setup with the first code from the authenticator app. */
  verifySetup(request: MfaVerifyRequest): Observable<{ verified: boolean; message: string; backupCodes?: string[] }> {
    return this.http.post<{ verified: boolean; message: string; backupCodes?: string[] }>(`${this.baseUrl}/verify-setup`, request, {
      withCredentials: true,
    });
  }

  /** Verify MFA code during login flow (unauthenticated — uses mfaToken). */
  verifyLogin(request: MfaLoginVerifyRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/verify`, request, {
      withCredentials: true,
    });
  }

  /** Send email OTP during login flow (unauthenticated — uses mfaToken). */
  sendEmailOtp(mfaToken: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/send-email-otp`, { mfaToken }, {
      withCredentials: true,
    });
  }

  /** Disable MFA for the authenticated user. */
  disable(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/disable`, {
      withCredentials: true,
    });
  }

  /** Disable a single MFA method after OTP verification. */
  disableMethod(method: string, code: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/disable-method`, { method, code }, {
      withCredentials: true,
    });
  }

  /** Send an email OTP to the authenticated user for security verification. */
  sendAuthenticatedOtp(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/send-otp`, {}, {
      withCredentials: true,
    });
  }

  /** Get MFA status for the authenticated user. */
  getStatus(): Observable<MfaStatusResponse> {
    return this.http.get<MfaStatusResponse>(`${this.baseUrl}/status`, {
      withCredentials: true,
    });
  }

  /** Generate new backup codes (replaces existing). */
  generateBackupCodes(): Observable<{ codes: string[] }> {
    return this.http.post<{ codes: string[] }>(`${this.baseUrl}/backup-codes`, {}, {
      withCredentials: true,
    });
  }
}
