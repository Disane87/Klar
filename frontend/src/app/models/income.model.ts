export interface Income {
  id: string;
  userId: string;
  householdId: string | null;
  name: string;
  amount: number;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncomeRequest {
  name: string;
  amount: number;
  month: number;
  year: number;
  householdId?: string;
}
