import { Routes } from '@angular/router';
import { guestGuard } from '../../core/auth/auth.guard';

export const authRoutes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'oauth-callback',
    loadComponent: () =>
      import('./pages/oauth-callback/oauth-callback.component').then(
        (m) => m.OAuthCallbackComponent
      ),
  },
  {
    path: 'mfa-verify',
    loadComponent: () =>
      import('./pages/mfa-verify/mfa-verify.component').then((m) => m.MfaVerifyComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: 'verify-email-change',
    loadComponent: () =>
      import('./pages/verify-email-change/verify-email-change.component').then(
        (m) => m.VerifyEmailChangeComponent
      ),
  },
  {
    path: 'revert-email-change',
    loadComponent: () =>
      import('./pages/revert-email-change/revert-email-change.component').then(
        (m) => m.RevertEmailChangeComponent
      ),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
