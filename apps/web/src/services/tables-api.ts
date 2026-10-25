import { apiClient } from "@/lib/api-client";
import type { TableEntity } from "@/lib/types";

type ApiTable = {
  id: string;
  establishmentId: string;
  number: number;
  seats: number;
  status: string;
  currentTotal: number;
  openedAt: string | null;
  active: boolean;
  qrPath: string;
  openOrdersCount: number;
};

type ApiTableDetail = ApiTable & {
  establishmentName: string;
  orders: Array<{
    id: string;
    code: string;
    status: string;
    total: number;
    customerName: string;
    createdAt: string;
  }>;
};

const lower = <T extends string>(v: string) => v.toLowerCase() as T;

function mapTable(t: ApiTable, establishmentId: string): TableEntity {
  return {
    id: t.id,
    establishment_id: establishmentId,
    number: t.number,
    seats: t.seats,
    status: lower<TableEntity["status"]>(t.status),
    active: t.active,
    qr_path: t.qrPath,
    open_orders_count: t.openOrdersCount,
    ...(t.currentTotal > 0 ? { total: t.currentTotal } : {}),
    ...(t.openedAt ? { opened_at: t.openedAt } : {}),
  };
}

export async function listTables(establishmentId: string): Promise<TableEntity[]> {
  const data = await apiClient.get<ApiTable[]>("/api/v1/tables");
  return data.map((t) => mapTable(t, establishmentId));
}

export async function getTableDetail(tableId: string): Promise<ApiTableDetail> {
  return apiClient.get<ApiTableDetail>(`/api/v1/tables/${encodeURIComponent(tableId)}`);
}

export async function createTable(payload: { number: number; seats?: number }): Promise<ApiTable> {
  return apiClient.post<ApiTable>("/api/v1/tables", payload);
}

export async function openTable(tableId: string): Promise<ApiTable> {
  return apiClient.post<ApiTable>(`/api/v1/tables/${encodeURIComponent(tableId)}/open`);
}

export async function closeTable(tableId: string, force = false): Promise<ApiTable> {
  return apiClient.post<ApiTable>(`/api/v1/tables/${encodeURIComponent(tableId)}/close`, {
    force,
  });
}
