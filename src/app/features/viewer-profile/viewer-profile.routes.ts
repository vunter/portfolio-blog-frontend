import { Routes } from '@angular/router';
import { ViewerProfileLayoutComponent } from './layout/viewer-profile-layout.component';

export const viewerProfileRoutes: Routes = [
  {
    path: '',
    component: ViewerProfileLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/viewer-profile.component').then(
            (m) => m.ViewerProfileComponent
          ),
      },
      {
        path: 'security',
        loadComponent: () =>
          import('../admin/pages/security/security-settings.component').then(
            (m) => m.SecuritySettingsComponent
          ),
      },
      {
        path: 'reading-history',
        loadComponent: () =>
          import('../admin/pages/reading-history/reading-history.component').then(
            (m) => m.ReadingHistoryComponent
          ),
      },
    ],
  },
];
