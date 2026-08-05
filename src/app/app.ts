import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './core/services/i18n.service';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { CookieConsentComponent } from './shared/components/cookie-consent/cookie-consent.component';
import { ProgressBarComponent } from './shared/components/progress-bar/progress-bar.component';
import { TermsAcceptanceModalComponent } from './shared/components/terms-acceptance-modal/terms-acceptance-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, ConfirmDialogComponent, CookieConsentComponent, ProgressBarComponent, TermsAcceptanceModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly i18n = inject(I18nService);
}
