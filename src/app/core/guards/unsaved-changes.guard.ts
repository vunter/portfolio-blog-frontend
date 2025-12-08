import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { I18nService } from '../services/i18n.service';
import { ConfirmDialogService } from '../services/confirm-dialog.service';

/**
 * FEAT-09: CanDeactivate guard to prevent accidental navigation
 * when there are unsaved changes in a form.
 *
 * Components must implement `hasUnsavedChanges(): boolean`
 */
export interface HasUnsavedChanges {
  hasUnsavedChanges: boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  if (component?.hasUnsavedChanges) {
    const i18n = inject(I18nService);
    const confirmDialog = inject(ConfirmDialogService);
    return confirmDialog.confirm({
      title: i18n.t('common.confirm'),
      message: i18n.t('admin.articles.unsavedChanges'),
      confirmText: i18n.t('common.confirm'),
      cancelText: i18n.t('common.cancel'),
      type: 'warning',
    });
  }
  return true;
};
