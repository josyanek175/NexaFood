import { apiClient, ApiClientError } from "@/lib/api-client";
import type { AppRole } from "@nexafood/shared";

export type AuthMeResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
    status: string;
  };
  isPlatformAdmin: boolean;
  memberships: Array<{
    establishmentId: string;
    organizationId: string;
    establishmentName: string;
    establishmentSlug: string;
    logoUrl: string | null;
    isOpen: boolean;
    status: string;
    role: AppRole;
  }>;
  currentEstablishmentId: string | null;
};

export async function fetchAuthMe(): Promise<AuthMeResponse | null> {
  try {
    return await apiClient.get<AuthMeResponse>("/api/v1/auth/me");
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null;
    throw error;
  }
}

export async function loginWithPassword(email: string, password: string): Promise<AuthMeResponse> {
  return apiClient.post<AuthMeResponse>("/api/v1/auth/login", { email, password });
}

export async function registerAccount(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthMeResponse> {
  return apiClient.post<AuthMeResponse>("/api/v1/auth/register", input);
}

export async function logoutSession(): Promise<void> {
  await apiClient.post<{ ok: boolean }>("/api/v1/auth/logout");
}

export async function setCurrentEstablishment(establishmentId: string): Promise<AuthMeResponse> {
  return apiClient.post<AuthMeResponse>("/api/v1/auth/current-establishment", { establishmentId });
}
