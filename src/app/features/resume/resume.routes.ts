import { Routes } from '@angular/router';
import { ResumeLayoutComponent } from './layout/resume-layout.component';

export const resumeRoutes: Routes = [
  {
    path: '',
    component: ResumeLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'templates',
        pathMatch: 'full',
      },
      {
        path: 'profile',
        redirectTo: '/admin/profile',
        pathMatch: 'full',
      },
      {
        path: 'generate',
        loadComponent: () =>
          import('./pages/generate/resume-generate.component').then(
            (m) => m.ResumeGenerateComponent
          ),
      },
      {
        path: 'templates',
        loadComponent: () =>
          import('./pages/template-list/template-list.component').then(
            (m) => m.TemplateListComponent
          ),
      },
      {
        path: 'editor',
        loadComponent: () =>
          import('./pages/template-editor/template-editor.component').then(
            (m) => m.TemplateEditorComponent
          ),
      },
      {
        path: 'editor/:id',
        loadComponent: () =>
          import('./pages/template-editor/template-editor.component').then(
            (m) => m.TemplateEditorComponent
          ),
      },
      {
        path: 'preview/:id',
        loadComponent: () =>
          import('./pages/template-preview/template-preview.component').then(
            (m) => m.TemplatePreviewComponent
          ),
      },
    ],
  },
];
