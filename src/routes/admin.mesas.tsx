import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QrCode, Split, Merge, Plus } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { fetchTables } from "@/services/orders";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { brl, timeAgo } from "@/lib/format";
import { DemoNotice, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TableEntity } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/mesas")({
  component: TablesPage,
});

const STATUS: Record<TableEntity["status"], { label: string; className: string; mark: string }> = {
  livre: { label: "Livre", className: "bg-muted text-muted-foreground border-border", mark: "○" },
  ocupada: { label: "Ocupada", className: "bg-primary-soft text-primary border-primary/40", mark: "●" },
  aguardando_pedido: { label: "Aguardando pedido", className: "bg-info/12 text-info border-info/40", mark: "◔" },
  preparando: { label: "Em preparação", className: "bg-warning/20 text-warning-foreground border-warning/50", mark: "◐" },
  aguardando_pagamento: { label: "Aguardando pagamento", className: "bg-destructive/12 text-destructive border-destructive/40", mark: "◕" },
  fechada: { label: "Conta fechada", className: "bg-success/15 text-success border-success/40", mark: "✓" },
};

function TablesPage() {
  const { currentEstablishmentId: estId } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["tables", estId], queryFn: () => fetchTables(estId!), enabled: Boolean(estId) });
  useRealtimeOrders(estId);

  return (
    <>
      <PageHeader
        title="Mapa de mesas"
        description="Abertura, transferência, união de mesas e divisão de conta."
        action={
          <Button className="rounded-full" onClick={() => toast.info("Abrir mesa (demonstração)")}>
            <Plus className="mr-1.5 size-4" /> Abrir mesa
          </Button>
        }
      />
      <DemoNotice>cada mesa possui um QR Code próprio no formato /seu-estabelecimento?mesa=N.</DemoNotice>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUS).map(([key, s]) => (
          <span key={key} className={`rounded-full border px-2.5 py-1 font-semibold ${s.className}`}>
            {s.mark} {s.label}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((t) => {
            const s = STATUS[t.status];
            return (
              <article key={t.id} className={`animate-rise rounded-2xl border-2 bg-card p-4 shadow-soft ${s.className}`}>
                <header className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-bold">{t.number}</h3>
                  <span className="text-xs font-bold">{s.mark}</span>
                </header>
                <p className="text-xs font-semibold">{s.label}</p>
                <p className="mt-1 text-xs opacity-80">{t.seats} lugares</p>
                {t.total !== undefined && <p className="mt-2 text-sm font-bold">{brl(t.total)}</p>}
                {t.opened_at && <p className="text-[11px] opacity-80">aberta há {timeAgo(t.opened_at)}</p>}
                <div className="mt-3 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 flex-1 rounded-full text-xs"
                    onClick={() => toast.info(`Consumo da mesa ${t.number} (demonstração)`)}
                  >
                    Consumo
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full"
                    aria-label={`QR Code da mesa ${t.number}`}
                    onClick={() => toast.success(`QR Code da mesa ${t.number} gerado (demonstração)`)}
                  >
                    <QrCode className="size-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-full" onClick={() => toast.info("Transferir mesa (demonstração)")}>
          Transferir mesa
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => toast.info("Unir mesas (demonstração)")}>
          <Merge className="mr-1.5 size-4" /> Unir mesas
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => toast.info("Dividir conta (demonstração)")}>
          <Split className="mr-1.5 size-4" /> Dividir conta
        </Button>
      </div>
    </>
  );
}
