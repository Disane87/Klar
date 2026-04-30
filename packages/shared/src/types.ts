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
};

export type InviteCode = {
  id: string;
  householdId: string;
  code: string;
  createdByUserId: string | null;
  expiresAt: string | null;
  usesRemaining: number | null;
  createdAt: string;
};

export type CreateInviteRequest = {
  expiresInDays?: number;
  maxUses?: number;
};

export type JoinHouseholdRequest = {
  code: string;
};
