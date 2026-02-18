export interface BudgetCategory {
  id: string;
  userId: string | null;
  householdId: string | null;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  icon?: string;
  color?: string;
  householdId?: string;
}
