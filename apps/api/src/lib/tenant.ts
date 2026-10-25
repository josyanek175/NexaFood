import { AppError } from "./errors.js";

/** Defense-in-depth: ensure every loaded row belongs to the resolved establishment. */
export function assertTenantRows(
  establishmentId: string,
  rows: Array<{ establishmentId: string }>,
  label: string,
): void {
  for (const row of rows) {
    if (row.establishmentId !== establishmentId) {
      throw new AppError(
        500,
        "TENANT_ISOLATION_VIOLATION",
        `Dados de outro estabelecimento detectados em ${label}`,
      );
    }
  }
}
