import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { Bell, Clock, Flame, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { fetchOrders, updateOrderStatus } from "@/services/orders";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { printReceipt } from "@/lib/print";
import { hhmm, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { KitchenSector, Order, OrderStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cozinha")({
  component: KitchenPage,
});

const SECTORS: (KitchenSector | "todos")[] = ["todos", "cozinha", "bar", "chapa", "pizzaria", "sobremesas"];

const COLUMNS: { status: OrderStatus; title: string; accent: string }[] = [
  { status: "enviado", title: "Novos", accent: "border-t-primary" },
  { status: "preparando", title: "Em preparação", accent: "border-t-warning" },
  { status: "pronto", title: "Prontos", accent: "border-t-success" },
];

/** Bipe curto via WebAudio (não exige arquivo de áudio). */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    /* áudio indisponível */
  }
}

function KitchenPage() {
  const { currentEstablishmentId: estId, currentMembership } = useAuth();
  const estName = currentMembership?.establishment.name ?? "NexaCardápio";
  const [sector, setSector] = useState<KitchenSector | "todos">("todos");
  const [sound, setSound] = useState(true);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["orders", estId], queryFn: () => fetchOrders(estId!), enabled: Boolean(estId) });

  const onNewOrder = useCallback(() => {
    if (soundRef.current) beep();
    toast.success("Novo pedido na cozinha!");
  }, []);
  useRealtimeOrders(estId, onNewOrder);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orders = (data ?? []).filter((o) =>
    sector === "todos" ? true : o.items.some((i) => i.sector === sector),
  );

  return (
    <>
      <PageHeader
        title="Painel da cozinha (KDS)"
        description="Visualização em tela cheia para a produção, dividida por setor."
        action={
          <Button variant="secondary" className="rounded-full" onClick={() => setSound((s) => !s)}>
            {sound ? <Volume2 className="mr-1.5 size-4" /> : <VolumeX className="mr-1.5 size-4" />}
            {sound ? "Alerta sonoro ativo" : "Alerta sonoro mudo"}
          </Button>
        }
      />


      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {SECTORS.map((s) => (
          <button
            key={s}
            onClick={() => setSector(s)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold capitalize transition ${
              sector === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className={`rounded-2xl border border-t-4 bg-card/60 p-3 ${col.accent}`}>
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-bold uppercase tracking-wide">{col.title}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{items.length}</span>
              </header>
              <div className="space-y-3">
                {items.length === 0 && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Nenhum pedido nesta coluna
                  </p>
                )}
                {items.map((o) => (
                  <KdsCard
                    key={o.id}
                    order={o}
                    sector={sector}
                    estName={estName}
                    pending={mutation.isPending}
                    onStatus={(status) => mutation.mutate({ id: o.id, status })}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function KdsCard({
  order,
  sector,
  estName,
  pending,
  onStatus,
}: {
  order: Order;
  sector: KitchenSector | "todos";
  estName: string;
  pending: boolean;
  onStatus: (status: OrderStatus) => void;
}) {
  const items = sector === "todos" ? order.items : order.items.filter((i) => i.sector === sector);
  const late = Date.now() - new Date(order.created_at).getTime() > 20 * 60000;


  return (
    <article className={`animate-rise rounded-xl border bg-card p-3 shadow-soft ${late ? "ring-2 ring-destructive/60" : ""}`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold">{order.code}</h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            late ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground"
          }`}
        >
          {late ? <Flame className="size-3" /> : <Clock className="size-3" />} {timeAgo(order.created_at)}
        </span>
      </header>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {order.table_number ? `Mesa ${order.table_number}` : order.mode === "delivery" ? "Entrega" : "Retirada"} •{" "}
        {order.channel} • {hhmm(order.created_at)}
      </p>

      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.id} className="rounded-lg bg-muted/70 p-2">
            <p className="font-semibold">
              {i.quantity}x {i.product_name}
              {i.variation && <span className="font-normal text-muted-foreground"> • {i.variation}</span>}
            </p>
            {i.options.length > 0 && (
              <p className="text-xs text-muted-foreground">+ {i.options.map((o) => o.item_name).join(", ")}</p>
            )}
            {i.removed.length > 0 && <p className="text-xs text-destructive">− sem {i.removed.join(", ")}</p>}
            {i.notes && (
              <p className="mt-1 rounded bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">
                <Bell className="mr-1 inline size-3" />
                {i.notes}
              </p>
            )}
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">setor: {i.sector}</p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        {order.status === "enviado" && (
          <Button size="sm" className="flex-1 rounded-full" disabled={pending} onClick={() => onStatus("preparando")}>
            Iniciar preparo
          </Button>
        )}
        {order.status === "preparando" && (
          <Button size="sm" className="flex-1 rounded-full" disabled={pending} onClick={() => onStatus("pronto")}>
            Marcar pronto
          </Button>
        )}
        {order.status === "pronto" && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-full"
            disabled={pending}
            onClick={() => onStatus("finalizado")}
          >
            Entregue
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => {
            if (!printReceipt(order, estName, "comanda")) toast.error("Permita pop-ups para imprimir");
          }}
        >
          Imprimir
        </Button>
      </div>

    </article>
  );
}
