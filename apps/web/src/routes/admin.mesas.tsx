import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Loader2, Plus, QrCode, ReceiptText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import {
  closeTable,
  createTable,
  getTableDetail,
  listTables,
  openTable,
} from "@/services/tables-api";
import { ApiClientError } from "@/lib/api-client";
import { brl, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { TableEntity } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/mesas")({
  component: TablesPage,
});

const STATUS: Record<TableEntity["status"], { label: string; className: string; mark: string }> = {
  livre: { label: "Livre", className: "bg-muted text-muted-foreground border-border", mark: "○" },
  ocupada: {
    label: "Ocupada",
    className: "bg-primary-soft text-primary border-primary/40",
    mark: "●",
  },
  aguardando_pedido: {
    label: "Aguardando pedido",
    className: "bg-info/12 text-info border-info/40",
    mark: "◔",
  },
  preparando: {
    label: "Em preparação",
    className: "bg-warning/20 text-warning-foreground border-warning/50",
    mark: "◐",
  },
  aguardando_pagamento: {
    label: "Aguardando pagamento",
    className: "bg-destructive/12 text-destructive border-destructive/40",
    mark: "◕",
  },
  fechada: {
    label: "Conta fechada",
    className: "bg-success/15 text-success border-success/40",
    mark: "✓",
  },
};

function TablesPage() {
  const { currentEstablishmentId: estId, currentMembership } = useAuth();
  const slug = currentMembership?.establishment.slug;
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newSeats, setNewSeats] = useState("4");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [qrTable, setQrTable] = useState<TableEntity | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tables", estId],
    queryFn: () => listTables(estId!),
    enabled: Boolean(estId),
  });
  useRealtimeOrders(estId);

  const detailQuery = useQuery({
    queryKey: ["table-detail", detailId],
    queryFn: () => getTableDetail(detailId!),
    enabled: Boolean(detailId),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["tables", estId] });
    if (detailId) void qc.invalidateQueries({ queryKey: ["table-detail", detailId] });
  }

  const createMut = useMutation({
    mutationFn: () =>
      createTable({
        number: Number(newNumber),
        seats: Number(newSeats) || 4,
      }),
    onSuccess: () => {
      toast.success("Mesa criada.");
      setCreateOpen(false);
      setNewNumber("");
      setNewSeats("4");
      invalidate();
    },
    onError: (e: Error) =>
      toast.error(e instanceof ApiClientError ? e.message : "Falha ao criar mesa."),
  });

  const openMut = useMutation({
    mutationFn: (id: string) => openTable(id),
    onSuccess: () => {
      toast.success("Mesa aberta.");
      invalidate();
    },
    onError: (e: Error) =>
      toast.error(e instanceof ApiClientError ? e.message : "Falha ao abrir mesa."),
  });

  const closeMut = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => closeTable(id, force),
    onSuccess: () => {
      toast.success("Mesa fechada.");
      invalidate();
    },
    onError: (e: Error) =>
      toast.error(e instanceof ApiClientError ? e.message : "Falha ao fechar mesa."),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const qrUrl = useMemo(() => {
    if (!qrTable) return "";
    const path = qrTable.qr_path ?? (slug ? `/${slug}?mesa=${qrTable.number}` : "");
    return path.startsWith("http") ? path : `${origin}${path}`;
  }, [qrTable, slug, origin]);

  return (
    <>
      <PageHeader
        title="Mapa de mesas"
        description="Abra a mesa, compartilhe o QR do cardápio e acompanhe o consumo."
        action={
          <Button className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Nova mesa
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUS).map(([key, s]) => (
          <span
            key={key}
            className={`rounded-full border px-2.5 py-1 font-semibold ${s.className}`}
          >
            {s.mark} {s.label}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="font-medium">Nenhuma mesa cadastrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie a primeira mesa para gerar o QR do cardápio.
          </p>
          <Button className="mt-4 rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Nova mesa
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((t) => {
            const s = STATUS[t.status];
            const busy = openMut.isPending || closeMut.isPending;
            return (
              <article
                key={t.id}
                className={`animate-rise rounded-2xl border-2 bg-card p-4 shadow-soft ${s.className}`}
              >
                <header className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-bold">{t.number}</h3>
                  <span className="text-xs font-bold">{s.mark}</span>
                </header>
                <p className="text-xs font-semibold">{s.label}</p>
                <p className="mt-1 text-xs opacity-80">
                  {t.seats} lugares
                  {(t.open_orders_count ?? 0) > 0 ? ` • ${t.open_orders_count} pedido(s)` : ""}
                </p>
                {t.total !== undefined && <p className="mt-2 text-sm font-bold">{brl(t.total)}</p>}
                {t.opened_at && (
                  <p className="text-[11px] opacity-80">aberta há {timeAgo(t.opened_at)}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.status === "livre" || t.status === "fechada" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 flex-1 rounded-full text-xs"
                      disabled={busy}
                      onClick={() => openMut.mutate(t.id)}
                    >
                      Abrir
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 flex-1 rounded-full text-xs"
                      disabled={busy}
                      onClick={() => closeMut.mutate({ id: t.id })}
                    >
                      Fechar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full px-2"
                    onClick={() => setDetailId(t.id)}
                    aria-label={`Consumo mesa ${t.number}`}
                  >
                    <ReceiptText className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full"
                    aria-label={`QR Code da mesa ${t.number}`}
                    onClick={() => setQrTable(t)}
                  >
                    <QrCode className="size-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create table */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm rounded-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova mesa</DialogTitle>
            <DialogDescription>Cadastre o número e a capacidade da mesa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                inputMode="numeric"
                placeholder="12"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lugares</Label>
              <Input
                value={newSeats}
                onChange={(e) => setNewSeats(e.target.value)}
                inputMode="numeric"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-full"
              disabled={createMut.isPending}
              onClick={() => {
                if (!createMut.isPending) createMut.mutate();
              }}
            >
              {createMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Consumption / orders */}
      <Dialog open={Boolean(detailId)} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-md rounded-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Consumo — Mesa {detailQuery.data?.number ?? "…"}</DialogTitle>
            <DialogDescription>
              Pedidos vinculados a esta mesa. Total atual:{" "}
              {brl(detailQuery.data?.currentTotal ?? 0)}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto text-sm">
              {(detailQuery.data?.orders ?? []).length === 0 && (
                <li className="py-6 text-center text-muted-foreground">Nenhum pedido ainda.</li>
              )}
              {(detailQuery.data?.orders ?? []).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">#{o.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.customerName} • {o.status.toLowerCase()}
                    </p>
                  </div>
                  <span className="font-bold">{brl(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {detailId &&
              detailQuery.data &&
              detailQuery.data.status !== "LIVRE" &&
              detailQuery.data.status !== "FECHADA" && (
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={closeMut.isPending}
                  onClick={() =>
                    closeMut.mutate(
                      {
                        id: detailId,
                        force: (detailQuery.data?.openOrdersCount ?? 0) > 0,
                      },
                      {
                        onSuccess: () => setDetailId(null),
                      },
                    )
                  }
                >
                  Fechar mesa
                  {(detailQuery.data.openOrdersCount ?? 0) > 0 ? " (forçar)" : ""}
                </Button>
              )}
            <Button className="rounded-full" onClick={() => setDetailId(null)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR */}
      <Dialog open={Boolean(qrTable)} onOpenChange={(o) => !o && setQrTable(null)}>
        <DialogContent className="max-w-sm rounded-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>QR — Mesa {qrTable?.number}</DialogTitle>
            <DialogDescription>Cliente abre o cardápio já vinculado a esta mesa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border bg-white p-3">
              {qrUrl ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}`}
                  alt={`QR mesa ${qrTable?.number}`}
                  className="mx-auto size-56"
                />
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">URL indisponível</p>
              )}
            </div>
            <p className="break-all rounded-xl bg-muted px-3 py-2 text-xs">{qrUrl}</p>
            <Button
              className="w-full rounded-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(qrUrl);
                  toast.success("Link copiado.");
                } catch {
                  toast.error("Não foi possível copiar.");
                }
              }}
            >
              <Copy className="mr-1.5 size-4" /> Copiar link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
