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
  recaptchaToken?: string;
}

export type Role = 'ADMIN' | 'DEV' | 'EDITOR' | 'VIEWER';
export const ROLES: readonly Role[] = ['ADMIN', 'DEV', 'EDITOR', 'VIEWER'] as const;

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
  createdAt: string;
  updatedAt: string;
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
