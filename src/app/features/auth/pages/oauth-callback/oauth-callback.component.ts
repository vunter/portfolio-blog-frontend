import { Component, inject, OnInit, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
  selector: 'app-oauth-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
      <p>Completing login...</p>
    </div>
  `,
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // AUD18-A10: MFA-enabled accounts arrive here WITHOUT auth cookies — the backend
    // redirects with the short-lived MFA challenge in the URL *fragment* (never sent
    // to the server, so it cannot land in access logs). Route to the same MFA verify
    // page the password login uses, with the same navigation-state contract.
    const fragment = this.route.snapshot.fragment;
    if (fragment) {
      const params = new URLSearchParams(fragment);
      const mfaToken = params.get('mfa_token');
      if (params.get('mfa_required') === 'true' && mfaToken) {
        this.router.navigate(['/auth/mfa-verify'], {
          state: {
            mfaToken,
            email: params.get('email') ?? '',
            returnUrl: '/',
            // AUD19C-MFA-UX: backend mirrors TokenResponse.mfaMethod into the redirect
            // fragment as `mfa_method` — preselect it on the verify page when present.
            method: params.get('mfa_method') ?? undefined,
          },
        });
        return;
      }
    }

    const expiresIn = Number(this.route.snapshot.queryParams['expires_in']) || 900;

    this.authStore.setAuthenticated();
    this.authStore.setTokenExpiry(expiresIn);

    this.authService.getCurrentUser().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        this.authStore.login(user);
        if (!user.hasPassword) {
          this.router.navigateByUrl('/auth/complete-profile');
        } else {
          const defaultRoute = '/';
          this.router.navigateByUrl(defaultRoute);
        }
      },
      error: () => {
        // Clear the auth flag set above — getCurrentUser failed so there's no session
        this.authStore.logout();
        this.router.navigateByUrl('/auth/login');
      },
    });
  }
}
