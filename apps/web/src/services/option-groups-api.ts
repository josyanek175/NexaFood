import type { AdminOptionGroup } from "@nexafood/shared";
import { apiClient } from "@/lib/api-client";

export type OptionItemWrite = {
  id?: string | undefined;
  name: string;
  price: number;
  available?: boolean | undefined;
  position?: number | undefined;
};

export type OptionGroupWritePayload = {
  name: string;
  required?: boolean | undefined;
  minSelect?: number | undefined;
  maxSelect?: number | undefined;
  selection?: "single" | "multiple" | undefined;
  position?: number | undefined;
  active?: boolean | undefined;
  items?: OptionItemWrite[] | undefined;
};

export async function listOptionGroups(): Promise<AdminOptionGroup[]> {
  return apiClient.get<AdminOptionGroup[]>("/api/v1/option-groups");
}

export async function getOptionGroup(groupId: string): Promise<AdminOptionGroup> {
  return apiClient.get<AdminOptionGroup>(
    `/api/v1/option-groups/${encodeURIComponent(groupId)}`,
  );
}

export async function createOptionGroup(
  payload: OptionGroupWritePayload,
): Promise<AdminOptionGroup> {
  return apiClient.post<AdminOptionGroup>("/api/v1/option-groups", payload);
}

export async function updateOptionGroup(
  groupId: string,
  payload: Partial<OptionGroupWritePayload>,
): Promise<AdminOptionGroup> {
  return apiClient.patch<AdminOptionGroup>(
    `/api/v1/option-groups/${encodeURIComponent(groupId)}`,
    payload,
  );
}
