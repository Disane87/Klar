import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HouseholdStore } from './household.store';

export const householdGuard = async (): Promise<boolean | import('@angular/router').UrlTree> => {
  const store = inject(HouseholdStore);
  const router = inject(Router);

  await store.init();

  if (!store.hasHousehold()) {
    return router.createUrlTree(['/onboarding']);
  }
  return true;
};
