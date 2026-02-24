import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { PublicProfileService, PublicProfileSummary } from '../../../core/services/public-profile.service';
import { I18nService } from '../../../core/services/i18n.service';

/**
 * F-500: Profile Selector Component
 *
 * Allows switching between published developer profiles.
 * Currently NOT rendered in the template — ready for future activation.
 *
 * Usage (when enabled):
 *   <app-profile-selector />
 *
 * The component loads available profiles on init and provides a dropdown
 * to switch the active alias in PublicProfileService.
 */
@Component({
  selector: 'app-profile-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="profile-selector">
      <label class="profile-selector__label" for="profile-select">
        {{ i18n.t('home.profileSelector.label') || 'Developer Profile' }}
      </label>

      <select
        id="profile-select"
        class="profile-selector__select"
        [value]="profileService.activeAlias()"
        (change)="onProfileChange($event)"
      >
        @for (p of profileService.availableProfiles(); track p.alias) {
          <option [value]="p.alias">
            {{ p.name }}{{ p.title ? ' — ' + p.title : '' }}
          </option>
        }
      </select>
    </div>
  `,
  styles: [`
    .profile-selector {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      margin-bottom: 1rem;

      &__label {
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
        white-space: nowrap;
      }

      &__select {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-color, #d1d5db);
        border-radius: 0.5rem;
        background: var(--bg-secondary, #f9fafb);
        color: var(--text-primary, #111827);
        font-size: 0.875rem;
        cursor: pointer;
        min-width: 200px;
        transition: border-color 0.2s, box-shadow 0.2s;

        &:hover {
          border-color: var(--accent-color, #3b82f6);
        }

        &:focus {
          outline: none;
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
      }
    }
  `],
})
export class ProfileSelectorComponent implements OnInit {
  readonly profileService = inject(PublicProfileService);
  readonly i18n = inject(I18nService);

  ngOnInit(): void {
    this.profileService.loadAvailableProfiles();
  }

  onProfileChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.profileService.setAlias(select.value);
  }
}
