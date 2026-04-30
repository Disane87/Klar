import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'fixkosten',
        pathMatch: 'full',
      },
      {
        path: 'fixkosten',
        loadComponent: () =>
          import('./pages/fixkosten/fixkosten.component').then(m => m.FixkostenPageComponent),
      },
      {
        path: 'monat',
        loadComponent: () =>
          import('./pages/monat/monat.component').then(m => m.MonatPageComponent),
      },
      {
        path: 'projekte',
        loadComponent: () =>
          import('./pages/projekte/projekte.component').then(m => m.ProjektePageComponent),
      },
      {
        path: 'buchungen',
        loadComponent: () =>
          import('./pages/buchungen/buchungen.component').then(m => m.BuchungenPageComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
