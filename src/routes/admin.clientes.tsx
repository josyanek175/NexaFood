import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { fetchCustomers } from "@/services/orders";
import { brl, dateBR } from "@/lib/format";
import { DemoNotice, PageHeader } from "@/components/admin/ui";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/clientes")({
  component: CustomersPage,
});

function CustomersPage() {
  const { currentEstablishmentId: estId } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["customers", estId], queryFn: () => fetchCustomers(estId!), enabled: Boolean(estId) });

  return (
    <>
      <PageHeader title="Clientes" description="Base de clientes do estabelecimento e histórico de consumo." />
      <DemoNotice>a base respeita o consentimento de comunicação registrado por cliente.</DemoNotice>

      {isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Telefone</th>
                <th className="p-3">Pedidos</th>
                <th className="p-3">Total gasto</th>
                <th className="p-3">Ticket médio</th>
                <th className="p-3">Último pedido</th>
                <th className="p-3">Comunicações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-muted-foreground">{c.phone}</td>
                  <td className="p-3">{c.orders_count}</td>
                  <td className="p-3 font-semibold">{brl(c.total_spent)}</td>
                  <td className="p-3">{brl(c.total_spent / Math.max(1, c.orders_count))}</td>
                  <td className="p-3 text-muted-foreground">{dateBR(c.last_order_at)}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        c.consent ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.consent ? "✓ Autorizado" : "✕ Não autorizado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
