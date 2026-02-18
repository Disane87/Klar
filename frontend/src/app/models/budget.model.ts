export interface BudgetEntry {
  id: string;
  categoryId: string;
  userId: string;
  householdId: string | null;
  name: string;
  amount: number;
  isRecurring: boolean;
  month: number;
  year: number;
  category?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetEntryRequest {
  name: string;
  amount: number;
  categoryId: string;
  isRecurring?: boolean;
  month: number;
  year: number;
  householdId?: string;
}

export interface BudgetSummary {
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  remaining: number;
  categoryBreakdown: CategoryBreakdownItem[];
}

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
}
