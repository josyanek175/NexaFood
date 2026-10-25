import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Clock, Flame, Printer, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { fetchOrders, updateOrderItemKitchenStatus } from "@/services/orders";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { printReceipt } from "@/lib/print";
import { hhmm, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { KitchenItemStatus, KitchenSector, Order, OrderItem } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cozinha")({
  component: KitchenPage,
});

const SECTORS: (KitchenSector | "todos")[] = [
  "todos",
  "cozinha",
  "bar",
  "chapa",
  "pizzaria",
  "sobremesas",
];

const COLUMNS: {
  status: KitchenItemStatus;
  title: string;
  accent: string;
  actionLabel?: string;
  next?: KitchenItemStatus;
}[] = [
  {
    status: "novo",
    title: "Novos",
    accent: "border-t-primary",
    actionLabel: "Iniciar",
    next: "preparando",
  },
  {
    status: "preparando",
    title: "Em preparação",
    accent: "border-t-warning",
    actionLabel: "Pronto",
    next: "pronto",
  },
  {
    status: "pronto",
    title: "Prontos",
    accent: "border-t-success",
  },
];

const AUTO_PRINT_KEY = "nexa.kds.autoPrint";

/** Bipe curto via WebAudio (não exige arquivo de áudio). */
function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

type BoardCard = {
  key: string;
  order: Order;
  item: OrderItem;
};

function KitchenPage() {
  const { currentEstablishmentId: estId, currentMembership } = useAuth();
  const estName = currentMembership?.establishment.name ?? "NexaCardápio";
  const [sector, setSector] = useState<KitchenSector | "todos">("todos");
  const [sound, setSound] = useState(true);
  const [autoPrint, setAutoPrint] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AUTO_PRINT_KEY) === "1";
  });
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const autoPrintRef = useRef(autoPrint);
  autoPrintRef.current = autoPrint;
  const printedRef = useRef<Set<string>>(new Set());
  const seededPrintRef = useRef(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["orders", estId],
    queryFn: () => fetchOrders(estId!),
    enabled: Boolean(estId),
  });

  // Seed once so existing tickets are not auto-printed on page open.
  useEffect(() => {
    if (!data || seededPrintRef.current) return;
    for (const order of data) printedRef.current.add(order.id);
    seededPrintRef.current = true;
  }, [data]);

  const tryAutoPrint = useCallback(
    (order: Order) => {
      if (!autoPrintRef.current) return;
      if (printedRef.current.has(order.id)) return;
      printedRef.current.add(order.id);
      const ok = printReceipt(order, estName, "comanda", {
        sector: sector === "todos" ? undefined : sector,
      });
      if (!ok) toast.error("Permita pop-ups para imprimir a comanda automaticamente");
    },
    [estName, sector],
  );

  const onNewOrder = useCallback(() => {
    if (soundRef.current) beep();
    toast.success("Novo pedido na cozinha!");
    void qc.invalidateQueries({ queryKey: ["orders", estId] }).then(() => {
      const latest = qc.getQueryData<Order[]>(["orders", estId]) ?? [];
      for (const order of latest) {
        if (!printedRef.current.has(order.id)) tryAutoPrint(order);
      }
    });
  }, [estId, qc, tryAutoPrint]);
  useRealtimeOrders(estId, onNewOrder);

  const mutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: KitchenItemStatus }) =>
      updateOrderItemKitchenStatus(itemId, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const boardCards = useMemo(() => {
    const cards: BoardCard[] = [];
    for (const order of data ?? []) {
      if (order.status === "cancelado" || order.status === "finalizado") continue;
      for (const item of order.items) {
        if (sector !== "todos" && item.sector !== sector) continue;
        cards.push({ key: `${order.id}:${item.id}`, order, item });
      }
    }
    return cards;
  }, [data, sector]);

  return (
    <>
      <PageHeader
        title="Painel da cozinha (KDS)"
        description="Quadro por item — inicie e finalize cada produto. Imprima a comanda com o número da mesa."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
              <Printer className="size-4 text-muted-foreground" />
              <span className="font-medium">Auto-imprimir</span>
              <Switch
                checked={autoPrint}
                onCheckedChange={(v) => {
                  setAutoPrint(v);
                  window.localStorage.setItem(AUTO_PRINT_KEY, v ? "1" : "0");
                }}
                aria-label="Imprimir comanda automaticamente"
              />
            </label>
            <Button variant="secondary" className="rounded-full" onClick={() => setSound((s) => !s)}>
              {sound ? <Volume2 className="mr-1.5 size-4" /> : <VolumeX className="mr-1.5 size-4" />}
              {sound ? "Som ativo" : "Som mudo"}
            </Button>
          </div>
        }
      />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {SECTORS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSector(s)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold capitalize transition ${
              sector === s
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const cards = boardCards.filter((c) => c.item.kitchen_status === col.status);
          return (
            <section
              key={col.status}
              className={`rounded-2xl border border-t-4 bg-card/60 p-3 ${col.accent}`}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-bold uppercase tracking-wide">{col.title}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                  {cards.length}
                </span>
              </header>
              <div className="space-y-3">
                {cards.length === 0 && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Nenhum item nesta coluna
                  </p>
                )}
                {cards.map(({ key, order, item }) => (
                  <KdsItemCard
                    key={key}
                    order={order}
                    item={item}
                    estName={estName}
                    sectorFilter={sector}
                    pending={mutation.isPending}
                    actionLabel={col.actionLabel}
                    onAdvance={
                      col.next
                        ? () => mutation.mutate({ itemId: item.id, status: col.next! })
                        : undefined
                    }
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

function KdsItemCard({
  order,
  item,
  estName,
  sectorFilter,
  pending,
  actionLabel,
  onAdvance,
}: {
  order: Order;
  item: OrderItem;
  estName: string;
  sectorFilter: KitchenSector | "todos";
  pending: boolean;
  actionLabel?: string | undefined;
  onAdvance?: (() => void) | undefined;
}) {
  const late = Date.now() - new Date(order.created_at).getTime() > 20 * 60000;

  return (
    <article
      className={`animate-rise rounded-xl border bg-card p-3 shadow-soft ${
        late ? "ring-2 ring-destructive/60" : ""
      }`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {order.table_number ? (
            <p className="text-lg font-black tracking-tight text-primary">Mesa {order.table_number}</p>
          ) : (
            <p className="text-sm font-bold uppercase text-primary">
              {order.mode === "delivery" ? "Entrega" : "Retirada"}
            </p>
          )}
          <h3 className="truncate text-sm font-bold text-muted-foreground">#{order.code}</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            late ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground"
          }`}
        >
          {late ? <Flame className="size-3" /> : <Clock className="size-3" />}{" "}
          {timeAgo(order.created_at)}
        </span>
      </header>

      <div className="mt-3 rounded-lg bg-muted/70 p-2.5">
        <p className="text-base font-bold leading-snug">
          {item.quantity}x {item.product_name}
          {item.variation && (
            <span className="font-normal text-muted-foreground"> • {item.variation}</span>
          )}
        </p>
        {item.options.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            + {item.options.map((o) => o.item_name).join(", ")}
          </p>
        )}
        {item.removed.length > 0 && (
          <p className="text-xs text-destructive">− sem {item.removed.join(", ")}</p>
        )}
        {item.notes && (
          <p className="mt-1.5 rounded bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">
            <Bell className="mr-1 inline size-3" />
            {item.notes}
          </p>
        )}
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          setor: {item.sector} • {hhmm(order.created_at)}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        {onAdvance && actionLabel && (
          <Button
            size="sm"
            className="flex-1 rounded-full"
            disabled={pending}
            onClick={onAdvance}
          >
            {actionLabel}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => {
            const ok = printReceipt(order, estName, "comanda", {
              sector: sectorFilter === "todos" ? item.sector : sectorFilter,
            });
            if (!ok) toast.error("Permita pop-ups para imprimir");
          }}
        >
          <Printer className="size-4" />
        </Button>
      </div>
    </article>
  );
}
