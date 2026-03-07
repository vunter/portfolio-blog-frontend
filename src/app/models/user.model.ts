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
  hasPassword?: boolean;
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
