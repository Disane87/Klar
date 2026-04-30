import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { householdGuard } from './core/household/household.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
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
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/onboarding/onboarding.component').then(
        m => m.OnboardingComponent,
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
        path: 'buchungen',
        loadComponent: () =>
          import('./pages/buchungen/buchungen.component').then(
            m => m.BuchungenPageComponent,
          ),
      },
      {
        path: 'haushalt',
        loadComponent: () =>
          import('./pages/haushalt/haushalt.component').then(
            m => m.HaushaltPageComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
