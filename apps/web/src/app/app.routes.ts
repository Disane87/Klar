import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';
import { guestGuard } from './core/auth/guest.guard';
import { householdGuard } from './core/household/household.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'join/:token',
    loadComponent: () =>
      import('./pages/join/join.component').then(m => m.JoinComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./pages/verify-email/verify-email.component').then(
        m => m.VerifyEmailComponent,
      ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./pages/auth-callback/auth-callback.component').then(
        m => m.AuthCallbackComponent,
      ),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/onboarding/onboarding.component').then(
        m => m.OnboardingComponent,
      ),
  },
  {
    path: 'oauth/consent',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/oauth-consent/oauth-consent.component').then(
        m => m.OAuthConsentComponent,
      ),
  },
  {
    path: 'app',
    canActivate: [authGuard, householdGuard],
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
          import('./pages/fixkosten/fixkosten.component').then(
            m => m.FixkostenPageComponent,
          ),
      },
      {
        path: 'monat',
        loadComponent: () =>
          import('./pages/monat/monat.component').then(m => m.MonatPageComponent),
      },
      {
        path: 'projekte',
        loadComponent: () =>
          import('./pages/projekte/projekte.component').then(
            m => m.ProjektePageComponent,
          ),
      },
      {
        path: 'projekte/:id',
        loadComponent: () =>
          import('./pages/projekte/project-detail.component').then(
            m => m.ProjectDetailPageComponent,
          ),
      },
      {
        path: 'buchungen',
        loadComponent: () =>
          import('./pages/buchungen/buchungen.component').then(
            m => m.BuchungenPageComponent,
          ),
      },
      {
        path: 'planspiel',
        loadComponent: () =>
          import('./pages/planspiel/planspiel.component').then(
            m => m.PlanspielPageComponent,
          ),
      },
      {
        path: 'tresor',
        loadComponent: () =>
          import('./pages/tresor/tresor.component').then(
            m => m.TresorPageComponent,
          ),
      },
      {
        path: 'vertraege',
        loadComponent: () =>
          import('./pages/vertraege/vertraege.component').then(
            m => m.VertraegeComponent,
          ),
      },
      {
        path: 'kalender',
        loadComponent: () =>
          import('./pages/kalender/kalender.component').then(
            m => m.KalenderComponent,
          ),
      },
      {
        path: 'statistik',
        loadComponent: () =>
          import('./pages/statistik/statistik.component').then(
            m => m.StatistikComponent,
          ),
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./pages/csv-import/csv-import.page').then(
            m => m.CsvImportPageComponent,
          ),
      },
      {
        path: 'haushalt',
        loadComponent: () =>
          import('./pages/haushalt/haushalt.component').then(
            m => m.HaushaltPageComponent,
          ),
      },
      {
        path: 'banken',
        loadComponent: () =>
          import('./pages/banken/banken.component').then(
            m => m.BankenPageComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.component').then(
            m => m.SettingsPageComponent,
          ),
      },
      {
        path: 'mehr',
        loadComponent: () =>
          import('./pages/mehr/mehr.component').then(
            m => m.MehrPageComponent,
          ),
      },
      {
        path: 'health',
        loadComponent: () =>
          import('./pages/health/health.component').then(
            m => m.HealthPageComponent,
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/admin.component').then(
            m => m.AdminPageComponent,
          ),
      },
      {
        path: 'spec',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/spec/spec.component').then(m => m.SpecPageComponent),
      },
      {
        path: 'crud',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/crud/crud.component').then(m => m.CrudPageComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
