import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bike, MapPin, Timer } from "lucide-react";
import { api } from "@/services/api";
import { establishments } from "@/data/demo";
import { brl, timeAgo } from "@/lib/format";
import { DemoNotice, Panel, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/entregas")({
  component: DeliveriesPage,
});

const DRIVER_STATUS: Record<string, string> = {
  disponivel: "bg-success/15 text-success",
  em_rota: "bg-info/12 text-info",
  offline: "bg-muted text-muted-foreground",
};

function DeliveriesPage() {
  const est = establishments[0]!;
  const { data: orders } = useQuery({ queryKey: ["orders", est.id], queryFn: () => api.listOrders(est.id) });
  const { data: drivers } = useQuery({ queryKey: ["drivers", est.id], queryFn: () => api.listDrivers(est.id) });

  const waiting = (orders ?? []).filter((o) => o.mode === "delivery" && o.status === "pronto");
  const onRoute = (orders ?? []).filter((o) => o.status === "em_entrega");

  return (
    <>
      <PageHeader title="Entregas" description="Fila de despacho, rotas em andamento e equipe de entregadores." />
      <DemoNotice>estrutura pronta para logística própria e integração futura com serviços externos.</DemoNotice>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Aguardando entregador">
          {waiting.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido na fila.</p>}
          <ul className="space-y-3">
            {waiting.map((o) => (
              <li key={o.id} className="rounded-xl border p-3">
                <p className="font-bold">{o.code}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {o.address}
                </p>
                <p className="mt-1 text-sm font-semibold">{brl(o.total)}</p>
                <Button size="sm" className="mt-2 w-full rounded-full" onClick={() => toast.success(`Entregador designado — ${o.code}`)}>
                  Designar entregador
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Em rota">
          {onRoute.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma entrega em rota.</p>}
          <ul className="space-y-3">
            {onRoute.map((o) => (
              <li key={o.id} className="rounded-xl border p-3">
                <p className="font-bold">{o.code}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {o.address}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs">
                  <Timer className="size-3" /> saiu há {timeAgo(o.history.at(-1)?.at ?? o.created_at)}
                </p>
                <Button size="sm" variant="outline" className="mt-2 w-full rounded-full" onClick={() => toast.success(`Entrega confirmada — ${o.code}`)}>
                  Confirmar entrega
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Entregadores">
          <ul className="divide-y">
            {(drivers ?? []).map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary">
                  <Bike className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.vehicle} • {d.deliveries_today} entregas hoje
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${DRIVER_STATUS[d.status]}`}>
                  {d.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Zonas de entrega">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Região</th>
                  <th className="p-2">Taxa</th>
                  <th className="p-2">Previsão</th>
                  <th className="p-2">Raio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["Vila Madalena", 6.9, "30-40 min", "0-2 km"],
                  ["Pinheiros", 9.9, "35-50 min", "2-4 km"],
                  ["Perdizes", 12.9, "45-60 min", "4-6 km"],
                ].map(([region, fee, eta, radius]) => (
                  <tr key={String(region)}>
                    <td className="p-2 font-medium">{region}</td>
                    <td className="p-2">{brl(Number(fee))}</td>
                    <td className="p-2 text-muted-foreground">{eta}</td>
                    <td className="p-2 text-muted-foreground">{radius}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
