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
