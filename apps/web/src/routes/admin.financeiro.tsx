import { createFileRoute } from "@tanstack/react-router";
import { SalesReport } from "@/components/admin/SalesReport";
export const Route = createFileRoute("/admin/financeiro")({ component: () => <SalesReport title="Financeiro" /> });
