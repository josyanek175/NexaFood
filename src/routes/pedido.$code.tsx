import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, CookingPot, PackageCheck, Bike, PartyPopper, Receipt } from "lucide-react";
import { brl, hhmm } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { getOrderTracking } from "@/services/orders";

export const Route = createFileRoute("/pedido/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Pedido ${params.code} — Acompanhe em tempo real | NexaCardápio` },
      { name: "description", content: "Acompanhe o status do seu pedido em tempo real." },
      { property: "og:title", content: `Acompanhe o pedido ${params.code}` },
      { property: "og:description", content: "Status do pedido atualizado em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderTracking,
});

const STEPS = [
  { key: "ENVIADO", label: "Pedido enviado", icon: Receipt },
  { key: "CONFIRMADO", label: "Pedido confirmado", icon: Check },
  { key: "PREPARANDO", label: "Em preparação", icon: CookingPot },
  { key: "PRONTO", label: "Pronto", icon: PackageCheck },
  { key: "EM_ENTREGA", label: "Saiu para entrega", icon: Bike },
  { key: "FINALIZADO", label: "Finalizado", icon: PartyPopper },
];

const MODE_LABEL: Record<string, string> = {
  DELIVERY: "Entrega",
  RETIRADA: "Retirada",
  LOCAL: "Consumo no local",
};

function OrderTracking() {
  const { code } = Route.useParams();

  const { data: order } = useQuery({
    queryKey: ["order-tracking", code],
    queryFn: () => getOrderTracking(code),
    refetchInterval: 15000,
  });

  const isDelivery = order?.mode === "DELIVERY";
  const visibleSteps = isDelivery ? STEPS : STEPS.filter((s) => s.key !== "EM_ENTREGA");
  const stage = Math.max(
    0,
    visibleSteps.findIndex((s) => s.key === (order?.status ?? "ENVIADO")),
  );


  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <div className="surface-card animate-rise overflow-hidden">
        <div className="gradient-warm px-6 py-8 text-center text-primary-foreground">
          <p className="text-sm/6 opacity-90">Pedido recebido com sucesso</p>
          <h1 className="mt-1 text-4xl font-bold">#{code}</h1>
          <p className="mt-2 text-sm opacity-90">
            {order
              ? `${order.establishment.name} • ${hhmm(order.created_at)}`
              : "Acompanhe o preparo em tempo real"}
          </p>
        </div>

        <div className="space-y-6 p-6">
          <ol className="relative space-y-1">
            {visibleSteps.map((step, i) => {
              const done = i <= stage;
              const Icon = step.icon;
              return (
                <li key={step.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-9 place-items-center rounded-full border-2 transition ${
                        done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    {i < visibleSteps.length - 1 && (
                      <span className={`h-8 w-0.5 ${i < stage ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                  <div className="pb-2 pt-1.5">
                    <p className={`text-sm font-semibold ${done ? "" : "text-muted-foreground"}`}>{step.label}</p>
                    {i === stage && (
                      <p className="flex items-center gap-1 text-xs text-primary">
                        <Clock className="size-3" /> em andamento
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {order && (
            <>
              <div className="surface-card divide-y p-4">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                    <span>
                      <strong>{item.quantity}x</strong> {item.name}
                      {item.variation && <span className="text-muted-foreground"> • {item.variation}</span>}
                    </span>
                    <span className="font-semibold">{brl(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Modalidade" value={MODE_LABEL[order.mode] ?? order.mode} />
                <Info
                  label="Previsão"
                  value={`${order.establishment.eta_min}-${order.establishment.eta_max} min`}
                />
                {order.table_number != null && (
                  <Info label="Mesa" value={String(order.table_number)} />
                )}
                <Info label="Total" value={brl(order.total)} />
              </dl>
            </>
          )}

          {!order && (
            <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
              Não encontramos os detalhes deste pedido, mas o acompanhamento de status continua ativo.
            </p>
          )}

          <Button asChild variant="secondary" className="h-11 w-full rounded-full">
            <Link
              to="/$slug"
              params={{ slug: order?.establishment.slug ?? "nexa-burger" }}
              search={{ mesa: undefined }}
            >
              Voltar ao cardápio
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <dt className="text-[11px] uppercase text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
