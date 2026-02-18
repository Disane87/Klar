import { User } from './user.model';

export type HouseholdRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  members?: HouseholdMember[];
}

export interface HouseholdMember {
  householdId: string;
  userId: string;
  role: HouseholdRole;
  joinedAt: string;
  user?: User;
}

export interface HouseholdSummary {
  householdId: string;
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  remaining: number;
  members: MemberSummary[];
}

export interface MemberSummary {
  userId: string;
  displayName: string;
  role: HouseholdRole;
  totalIncome: number;
  totalExpenses: number;
}
