export type ServerManaged = 'id' | 'createdAt' | 'updatedAt';

export type CreateDto<T extends Record<ServerManaged, unknown>> =
  Omit<T, ServerManaged>;

export type UpdateDto<T extends Record<ServerManaged, unknown>> =
  Partial<Omit<T, ServerManaged>>;

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type AppRole = 'USER' | 'ADMIN';

/** Öffentliche User-Darstellung (ohne passwordHash) */
export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  appRole: AppRole;
  avatarUrl?: string | null;
  createdAt: string; // ISO-String für JSON-Transport
};

export type LoginRequest = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type RegisterRequest = {
  email: string;
  displayName: string;
  password: string;
  inviteToken?: string;
};

export type RegisterResponse = {
  message: string;
};

export type RefreshResponse = {
  accessToken: string;
  user: AuthUser;
};

export type ResendVerificationRequest = {
  email: string;
};

// ─── Households ───────────────────────────────────────────────────────────────

export type HouseholdRole = 'OWNER' | 'MEMBER';

export type Household = {
  id: string;
  name: string;
  /** Free-text note rendered in the Fixkosten right-rail Notiz card. */
  note?: string | null;
  createdAt: string;
};

export type HouseholdWithRole = {
  household: Household;
  role: HouseholdRole;
  joinedAt: string;
};

export type HouseholdMember = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: HouseholdRole;
  joinedAt: string;
  avatarUrl?: string | null;
};

export type InvitationLink = {
  id: string;
  householdId: string;
  token: string;
  email: string | null;
  createdByUserId: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  usedByUserId: string | null;
  createdAt: string;
  link: string;
};

export type CreateInviteLinkRequest = {
  expiresInDays?: number;
};

export type InviteTokenInfo = {
  householdName: string;
  expiresAt: string | null;
  email?: string | null;
  userExists?: boolean;
};

// ─── Categories ───────────────────────────────────────────────────────────────

export type CategoryType =
  | 'FIXED_INCOME'
  | 'VARIABLE_INCOME'
  | 'FIXED_EXPENSE'
  | 'VARIABLE_EXPENSE'
  | 'SAVINGS'
  // Legacy — kept for existing data, not used for new entries
  | 'INCOME'
  | 'EXPENSE';

const INCOME_CATEGORY_TYPES = new Set<CategoryType>([
  'FIXED_INCOME',
  'VARIABLE_INCOME',
  'INCOME',
]);

/** Returns true if the category type represents income (positive amounts). */
export function isIncomeCategoryType(type: CategoryType | string | null | undefined): boolean {
  return !!type && INCOME_CATEGORY_TYPES.has(type as CategoryType);
}

/**
 * Applies the sign implied by a category type to a positive (absolute) amount in cents.
 * INCOME types → positive; EXPENSE/SAVINGS → negative. The input is taken as the
 * user-facing absolute value (e.g. 999 for "9,99 €").
 */
export function signedAmountForCategory(absCents: number, type: CategoryType | string | null | undefined): number {
  const abs = Math.abs(absCents);
  return isIncomeCategoryType(type) ? abs : -abs;
}

export type Category = {
  id: string;
  householdId: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string | null;
  isArchived: boolean;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
};

export type CreateCategoryRequest = {
  name: string;
  type: CategoryType;
  color: string;
  icon?: string | null;
  sortOrder?: number;
};

export type UpdateCategoryRequest = Partial<CreateCategoryRequest> & {
  isArchived?: boolean;
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type Visibility = 'PRIVATE' | 'SHARED';

export type Project = {
  id: string;
  householdId: string;
  createdByUserId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  totalBudgetCents: number | null;
  startDate: string | null;
  endDate: string | null;
  color: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectRequest = {
  name: string;
  color: string;
  description?: string | null;
  status?: ProjectStatus;
  totalBudgetCents?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  visibility?: Visibility;
};

export type UpdateProjectRequest = Partial<CreateProjectRequest>;

// ─── Recurring Transactions ───────────────────────────────────────────────────

// RecurringFrequency is defined in calculations.ts and re-exported from index.ts
import type { RecurringFrequency } from './calculations';
export type { RecurringFrequency };

export type RecurringTransaction = {
  id: string;
  householdId: string;
  createdByUserId: string | null;
  name: string;
  amountCents: number;
  categoryId: string;
  projectId: string | null;
  frequency: RecurringFrequency;
  customDays: number | null;
  dayOfMonth: number | null;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  visibility: Visibility;
  isVariable: boolean;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateRecurringTransactionRequest = {
  name: string;
  amountCents: number;
  categoryId: string;
  projectId?: string | null;
  frequency: RecurringFrequency;
  customDays?: number | null;
  dayOfMonth?: number | null;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  visibility?: Visibility;
  isVariable?: boolean;
  note?: string | null;
  isActive?: boolean;
};

export type UpdateRecurringTransactionRequest = Partial<CreateRecurringTransactionRequest>;

// ─── Transactions ─────────────────────────────────────────────────────────────

export type Transaction = {
  id: string;
  householdId: string;
  createdByUserId: string | null;
  amountCents: number; // signed int: positive = income, negative = expense
  /** Set when a planned entry was realized — preserves the original planned
   *  amount so the deviation (amountCents - plannedAmountCents) is visible. */
  plannedAmountCents: number | null;
  /** true = planned only (not yet realized; excluded from cashflow). */
  isPlanned: boolean;
  categoryId: string;
  projectId: string | null;
  date: string; // YYYY-MM-DD
  description: string | null;
  visibility: Visibility;
  recurringTransactionId: string | null;
  /** Optional per-transaction override; UI falls back to category color when null.
   *  Mirrors RecurringTransaction.color so both share one edit dialog. */
  color: string | null;
  /** Optional per-transaction icon (iconify key). Falls back to category icon. */
  icon: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTransactionRequest = {
  amountCents: number;
  plannedAmountCents?: number | null;
  isPlanned?: boolean;
  categoryId: string;
  date: string; // YYYY-MM-DD
  description?: string | null;
  projectId?: string | null;
  visibility?: Visibility;
  recurringTransactionId?: string | null;
  color?: string | null;
  icon?: string | null;
};

export type UpdateTransactionRequest = Partial<CreateTransactionRequest>;

// ─── Budgets ──────────────────────────────────────────────────────────────────

export type Budget = {
  id: string;
  householdId: string;
  categoryId: string;
  month: string; // YYYY-MM-01
  amountCents: number; // positive, the target amount
  createdAt: string;
  updatedAt: string;
};

export type CreateBudgetRequest = {
  categoryId: string;
  month: string; // YYYY-MM-01
  amountCents: number;
};

export type UpdateBudgetRequest = Partial<CreateBudgetRequest>;

// ─── User Settings ────────────────────────────────────────────────────────────

export type OidcIdentityItem = {
  id: string;
  providerName: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type SessionItem = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  hasPassword: boolean;
  appRole: AppRole;
  createdAt: string;
  lastLoginAt: string | null;
  totpEnabled: boolean;
  oidcIdentities: OidcIdentityItem[];
};

export type UpdateProfileRequest = {
  displayName?: string;
  email?: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type ChangeRoleRequest = {
  role: HouseholdRole;
};
