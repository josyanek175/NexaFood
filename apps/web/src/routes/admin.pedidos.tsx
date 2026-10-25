import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bike, Clock, MapPin, Plus, Printer, Store, Utensils, ReceiptText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { fetchOrders, updateOrderStatus } from "@/services/orders";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { printReceipt } from "@/lib/print";
import { brl, hhmm, timeAgo } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { ManualOrderDialog } from "@/components/admin/ManualOrderDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Order, OrderStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos")({
  component: OrdersPage,
});


const FILTERS: { key: OrderStatus | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "enviado", label: "Novos" },
  { key: "confirmado", label: "Confirmados" },
  { key: "preparando", label: "Em preparação" },
  { key: "pronto", label: "Prontos" },
  { key: "em_entrega", label: "Em entrega" },
  { key: "finalizado", label: "Finalizados" },
  { key: "cancelado", label: "Cancelados" },
];

export const STATUS_STYLE: Record<OrderStatus, { label: string; className: string; mark: string }> = {
  enviado: { label: "Novo", className: "bg-primary-soft text-primary", mark: "●" },
  confirmado: { label: "Confirmado", className: "bg-info/12 text-info", mark: "✓" },
  preparando: { label: "Em preparação", className: "bg-warning/20 text-warning-foreground", mark: "◐" },
  pronto: { label: "Pronto", className: "bg-success/15 text-success", mark: "✓✓" },
  em_entrega: { label: "Em entrega", className: "bg-info/12 text-info", mark: "→" },
  finalizado: { label: "Finalizado", className: "bg-muted text-muted-foreground", mark: "■" },
  cancelado: { label: "Cancelado", className: "bg-destructive/12 text-destructive", mark: "✕" },
};

export const CHANNEL_LABEL: Record<string, string> = {
  cardapio: "Cardápio próprio",
  mesa: "Mesa (QR Code)",
  balcao: "Balcão",
  ifood: "iFood",
  "99food": "99Food",
  manual: "Manual",
};

function OrdersPage() {
  const { currentEstablishmentId: estId, currentMembership } = useAuth();
  const estName = currentMembership?.establishment.name ?? "NexaCardápio";
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");
  const [manualOpen, setManualOpen] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["orders", estId], queryFn: () => fetchOrders(estId!), enabled: Boolean(estId) });
  useRealtimeOrders(estId);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orders = (data ?? []).filter((o) => (filter === "todos" ? true : o.status === filter));

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Operação em tempo real de todos os canais de venda."
        action={
          <Button className="rounded-full" onClick={() => setManualOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Novo pedido
          </Button>
        }
      />


      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <EmptyState
          icon={<ReceiptText className="size-7" />}
          title="Nenhum pedido neste filtro"
          description="Assim que um novo pedido entrar por qualquer canal, ele aparece aqui automaticamente."
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {orders.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            estName={estName}
            pending={mutation.isPending}
            onStatus={(status) => mutation.mutate({ id: o.id, status })}
          />
        ))}
      </div>

      <ManualOrderDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["orders", estId] });
          void qc.invalidateQueries({ queryKey: ["tables", estId] });
        }}
      />
    </>
  );
}

function OrderCard({
  order,
  estName,
  pending,
  onStatus,
}: {
  order: Order;
  estName: string;
  pending: boolean;
  onStatus: (status: OrderStatus) => void;
}) {
  const status = STATUS_STYLE[order.status];
  const ModeIcon = order.mode === "delivery" ? Bike : order.mode === "local" ? Utensils : Store;


  return (
    <article className="surface-card animate-rise flex flex-col p-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{order.code}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>
              {status.mark} {status.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {CHANNEL_LABEL[order.channel]} • {order.customer_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold">{brl(order.total)}</p>
          <p className="text-[11px] uppercase text-muted-foreground">{order.payment_method}</p>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ModeIcon className="size-3.5" />
          {order.table_number ? `Mesa ${order.table_number}` : (order.address ?? "Retirada no balcão")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> {hhmm(order.created_at)} • há {timeAgo(order.created_at)}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5 rounded-xl bg-muted/60 p-3 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            <span className="font-semibold">{item.quantity}x</span> {item.product_name}
            {item.variation && <span className="text-muted-foreground"> • {item.variation}</span>}
            {item.options.length > 0 && (
              <span className="block pl-5 text-xs text-muted-foreground">
                + {item.options.map((o) => o.item_name).join(", ")}
              </span>
            )}
            {item.removed.length > 0 && (
              <span className="block pl-5 text-xs text-destructive">− sem {item.removed.join(", ")}</span>
            )}
            {item.notes && <span className="block pl-5 text-xs italic text-primary">“{item.notes}”</span>}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{order.notes}</p>
      )}

      <footer className="mt-4 flex flex-wrap gap-2">
        {order.status === "enviado" && (
          <>
            <Button size="sm" className="rounded-full" disabled={pending} onClick={() => onStatus("confirmado")}>
              Aceitar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={pending}
              onClick={() => onStatus("cancelado")}
            >
              Rejeitar
            </Button>
          </>
        )}
        {order.status === "confirmado" && (
          <Button size="sm" className="rounded-full" disabled={pending} onClick={() => onStatus("preparando")}>
            Iniciar preparo
          </Button>
        )}
        {order.status === "preparando" && (
          <Button size="sm" className="rounded-full" disabled={pending} onClick={() => onStatus("pronto")}>
            Marcar como pronto
          </Button>
        )}
        {order.status === "pronto" && order.mode === "delivery" && (
          <Button size="sm" className="rounded-full" disabled={pending} onClick={() => onStatus("em_entrega")}>
            Enviar para entrega
          </Button>
        )}
        {["pronto", "em_entrega"].includes(order.status) && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={pending}
            onClick={() => onStatus("finalizado")}
          >
            Finalizar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => {
            if (!printReceipt(order, estName, "cupom")) toast.error("Permita pop-ups para imprimir");
          }}
        >
          <Printer className="mr-1 size-3.5" /> Imprimir cupom
        </Button>
        {order.address && (
          <Button size="sm" variant="ghost" className="rounded-full" asChild>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="mr-1 size-3.5" /> Rota
            </a>
          </Button>
        )}
      </footer>


      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold">Histórico de status</summary>
        <ul className="mt-2 space-y-1">
          {order.history.map((h, i) => (
            <li key={i}>
              {hhmm(h.at)} — {STATUS_STYLE[h.status].label} por {h.by}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
