// ============================================
// AUTHENTICATION
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  recaptchaToken?: string;
}

export interface LoginResponse {
  tokenType: 'Bearer';
  expiresIn: number;
  email: string;
  name: string;
  mfaRequired?: boolean;
  mfaToken?: string;
  // AUD19C-MFA-UX: backend includes the user's preferred MFA method on the challenge
  // response so the verify page can open on the right method (TOTP vs EMAIL).
  mfaMethod?: 'TOTP' | 'EMAIL';
}

export interface PasswordResetRequest {
  email: string;
  recaptchaToken?: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  termsAccepted: boolean;
  recaptchaToken?: string;
}

export type Role = 'ADMIN' | 'DEV' | 'VIEWER';
export const ROLES: readonly Role[] = ['ADMIN', 'DEV', 'VIEWER'] as const;

// ============================================
// USER
// ============================================

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  role: Role;
  active: boolean;
  // AUD19: exposed by the backend /admin/users/me response so the account page
  // can offer "resend verification" only to unverified users.
  emailVerified?: boolean;
  hasPassword?: boolean;
  termsAccepted?: boolean;
  preferredLocale?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// MFA / TWO-FACTOR AUTHENTICATION
// ============================================

export interface MfaSetupResponse {
  qrCodeDataUri: string;
  secretKey: string;
  method: 'TOTP' | 'EMAIL';
}

export interface MfaStatusResponse {
  mfaEnabled: boolean;
  methods: string[];
  preferredMethod?: string;
  backupCodesRemaining: number;
}

export interface MfaVerifyRequest {
  code: string;
  method: 'TOTP' | 'EMAIL';
}

export interface MfaLoginVerifyRequest {
  mfaToken: string;
  code: string;
  method: 'TOTP' | 'EMAIL' | 'BACKUP';
}

// ============================================
// ROLE UPGRADE REQUEST
// ============================================

export interface RoleUpgradeRequestResponse {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  currentRole?: string;
  requestedRole: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}
