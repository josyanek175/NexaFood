import type { EstablishmentSettings, PublicBusinessHour } from "@nexafood/shared";
import { apiClient } from "@/lib/api-client";

export type { EstablishmentSettings, PublicBusinessHour };

export type UpdateEstablishmentSettingsInput = {
  name?: string;
  legalName?: string | null;
  cnpj?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  isOpen?: boolean;
  minimumOrder?: number;
  estimatedTimeMin?: number;
  estimatedTimeMax?: number;
  serviceFeePercentage?: number;
  primaryColor?: string;
  businessHours?: PublicBusinessHour[];
};

export function fetchEstablishmentSettings() {
  return apiClient.get<EstablishmentSettings>("/api/v1/establishment/settings");
}

export function updateEstablishmentSettings(input: UpdateEstablishmentSettingsInput) {
  return apiClient.patch<EstablishmentSettings>("/api/v1/establishment/settings", input);
}
