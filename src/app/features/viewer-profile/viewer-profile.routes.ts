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
    ],
  },
];
