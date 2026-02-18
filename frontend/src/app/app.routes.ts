import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./components/auth/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'callback',
        loadComponent: () =>
          import('./components/auth/callback.component').then((m) => m.CallbackComponent),
      },
    ],
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'budgets',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/budgets/budgets.component').then((m) => m.BudgetsComponent),
  },
  {
    path: 'incomes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/incomes/incomes.component').then((m) => m.IncomesComponent),
  },
  {
    path: 'categories',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/categories/categories.component').then((m) => m.CategoriesComponent),
  },
  {
    path: 'households',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/households/households.component').then((m) => m.HouseholdsComponent),
  },
  {
    path: 'households/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/households/household-detail.component').then(
        (m) => m.HouseholdDetailComponent,
      ),
  },
  { path: '**', redirectTo: 'dashboard' },
];
