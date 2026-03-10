import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
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

  ngOnInit(): void {
    const expiresIn = Number(this.route.snapshot.queryParams['expires_in']) || 900;

    this.authStore.setAuthenticated();
    this.authStore.setTokenExpiry(expiresIn);

    this.authService.getCurrentUser().subscribe({
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
