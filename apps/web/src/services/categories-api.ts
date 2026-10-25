import type { AdminCategory } from "@nexafood/shared";
import { apiClient } from "@/lib/api-client";

export type CategoryWritePayload = {
  name: string;
  position?: number | undefined;
  active?: boolean | undefined;
  availableFrom?: string | null | undefined;
  availableTo?: string | null | undefined;
};

export async function listCategories(): Promise<AdminCategory[]> {
  return apiClient.get<AdminCategory[]>("/api/v1/categories");
}

export async function createCategory(payload: CategoryWritePayload): Promise<AdminCategory> {
  return apiClient.post<AdminCategory>("/api/v1/categories", payload);
}

export async function updateCategory(
  categoryId: string,
  payload: Partial<CategoryWritePayload>,
): Promise<AdminCategory> {
  return apiClient.patch<AdminCategory>(
    `/api/v1/categories/${encodeURIComponent(categoryId)}`,
    payload,
  );
}
