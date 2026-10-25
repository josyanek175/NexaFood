import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
import type { AdminProduct } from "@nexafood/shared";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api-client";
import { brl } from "@/lib/format";
import { listProducts } from "@/services/products-api";
import { listTables } from "@/services/tables-api";
import { placeStaffOrder } from "@/services/orders-staff-api";
import type { OrderMode, PaymentMethod } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

type DraftLine = {
  key: string;
  product: AdminProduct;
  variationId: string | null;
  variationName: string | null;
  optionItemIds: string[];
  optionLabels: string[];
  quantity: number;
  unitPrice: number;
};

type ServiceType = "balcao" | "mesa" | "retirada" | "delivery";

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `line-${keySeq}`;
}

function unitPriceOf(product: AdminProduct, variationId: string | null, optionItemIds: string[]) {
  let unit = product.promoPrice ?? product.price;
  const variation = product.variations.find((v) => v.id === variationId);
  if (variation) unit += variation.priceDelta;
  for (const group of product.optionGroups) {
    for (const item of group.items) {
      if (optionItemIds.includes(item.id)) unit += item.price;
    }
  }
  return unit;
}

export function ManualOrderDialog({ open, onOpenChange, onCreated }: Props) {
  const { currentEstablishmentId: estId } = useAuth();
  const [service, setService] = useState<ServiceType>("balcao");
  const [tableId, setTableId] = useState<string>("");
  const [customerName, setCustomerName] = useState("Balcão");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("caixa");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [picking, setPicking] = useState<AdminProduct | null>(null);
  const [pickVariationId, setPickVariationId] = useState<string>("");
  const [pickOptions, setPickOptions] = useState<string[]>([]);

  const productsQuery = useQuery({
    queryKey: ["cashier-products", estId],
    queryFn: () => listProducts({ active: true, available: true }),
    enabled: open && Boolean(estId),
  });

  const tablesQuery = useQuery({
    queryKey: ["cashier-tables", estId],
    queryFn: () => listTables(estId!),
    enabled: open && Boolean(estId),
  });

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (productsQuery.data ?? []).filter((p) =>
      q ? p.name.toLowerCase().includes(q) : true,
    );
  }, [productsQuery.data, query]);

  const allTables = (tablesQuery.data ?? []).filter((t) => t.active !== false);

  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  function reset() {
    setService("balcao");
    setTableId("");
    setCustomerName("Balcão");
    setCustomerPhone("");
    setAddress("");
    setPayment("caixa");
    setNotes("");
    setQuery("");
    setLines([]);
    setPicking(null);
  }

  function startAdd(product: AdminProduct) {
    const firstVar = product.variations.find((v) => v.available) ?? product.variations[0];
    const needsOptions = product.optionGroups.some((g) => g.required || g.minSelect > 0);
    if (product.variations.length > 1 || needsOptions) {
      setPicking(product);
      setPickVariationId(firstVar?.id ?? "");
      setPickOptions([]);
      return;
    }
    addLine(product, firstVar?.id ?? null, []);
  }

  function addLine(product: AdminProduct, variationId: string | null, optionItemIds: string[]) {
    const variation = product.variations.find((v) => v.id === variationId) ?? null;
    const optionLabels: string[] = [];
    for (const g of product.optionGroups) {
      for (const i of g.items) {
        if (optionItemIds.includes(i.id)) optionLabels.push(i.name);
      }
    }
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        product,
        variationId,
        variationName: variation?.name ?? null,
        optionItemIds,
        optionLabels,
        quantity: 1,
        unitPrice: unitPriceOf(product, variationId, optionItemIds),
      },
    ]);
    setPicking(null);
  }

  function confirmPick() {
    if (!picking) return;
    for (const g of picking.optionGroups) {
      const selected = pickOptions.filter((id) => g.items.some((i) => i.id === id));
      if (g.required || g.minSelect > 0) {
        if (selected.length < Math.max(g.minSelect, g.required ? 1 : 0)) {
          toast.error(`Escolha em "${g.name}" (mín. ${Math.max(g.minSelect, 1)}).`);
          return;
        }
      }
      if (selected.length > g.maxSelect) {
        toast.error(`"${g.name}" permite no máximo ${g.maxSelect}.`);
        return;
      }
    }
    addLine(picking, pickVariationId || null, pickOptions);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error("VALIDATION_ITEMS");
      if (!customerName.trim()) throw new Error("VALIDATION_NAME");
      if (service === "mesa" && !tableId) throw new Error("VALIDATION_TABLE");
      if (service === "delivery" && !address.trim()) throw new Error("VALIDATION_ADDRESS");

      const mode: OrderMode =
        service === "delivery" ? "delivery" : service === "retirada" ? "retirada" : "local";

      return placeStaffOrder({
        mode,
        payment,
        channel: service === "mesa" ? "mesa" : service === "balcao" ? "balcao" : "manual",
        customerName: customerName.trim(),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(service === "mesa" ? { tableId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        items: lines.map((l) => ({
          productId: l.product.id,
          variationId: l.variationId,
          quantity: l.quantity,
          optionItemIds: l.optionItemIds,
        })),
      });
    },
    onSuccess: (result) => {
      toast.success(`Pedido #${result.code} criado — ${brl(result.total)}`);
      reset();
      onCreated();
      onOpenChange(false);
    },
    onError: (error) => {
      const map: Record<string, string> = {
        VALIDATION_ITEMS: "Adicione pelo menos um item.",
        VALIDATION_NAME: "Informe o nome do cliente.",
        VALIDATION_TABLE: "Selecione a mesa.",
        VALIDATION_ADDRESS: "Informe o endereço de entrega.",
      };
      if (error instanceof Error && map[error.message]) {
        toast.error(map[error.message]);
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao criar pedido.");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>Novo pedido (caixa)</DialogTitle>
          <DialogDescription>
            Lance pedidos de balcão, mesa, retirada ou delivery direto no painel.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-h-0 space-y-3 overflow-y-auto border-b p-4 lg:border-b-0 lg:border-r">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto"
                className="h-10 rounded-full pl-9"
              />
            </div>
            <ul className="space-y-1.5">
              {products.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition hover:bg-muted/50"
                    onClick={() => startAdd(p)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.variations.length > 0
                          ? `${p.variations.length} variação(ões)`
                          : "Preço base"}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-primary">
                      {brl(p.promoPrice ?? p.price)}
                    </span>
                  </button>
                </li>
              ))}
              {!productsQuery.isLoading && products.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum produto disponível.
                </li>
              )}
            </ul>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tipo</Label>
                <Select
                  value={service}
                  onValueChange={(v) => {
                    const next = v as ServiceType;
                    setService(next);
                    if (next === "balcao") setCustomerName((n) => (n === "" ? "Balcão" : n));
                    if (next === "mesa") setCustomerName((n) => (n === "Balcão" ? "Mesa" : n));
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balcao">Balcão</SelectItem>
                    <SelectItem value="mesa">Mesa</SelectItem>
                    <SelectItem value="retirada">Retirada</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {service === "mesa" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Mesa</Label>
                  <Select value={tableId || undefined} onValueChange={setTableId}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Selecione a mesa" />
                    </SelectTrigger>
                    <SelectContent>
                      {allTables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          Mesa {t.number}
                          {t.status !== "livre" ? ` (${t.status.replaceAll("_", " ")})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Dica: abra a mesa em Mesas antes, ou selecione qualquer mesa cadastrada.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pagamento</Label>
                <Select
                  value={payment}
                  onValueChange={(v) => setPayment(v as PaymentMethod)}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {service === "delivery" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Telefone (opcional)</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Itens do pedido</Label>
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Toque em um produto à esquerda para adicionar.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((line) => (
                    <li
                      key={line.key}
                      className="flex items-start justify-between gap-2 rounded-xl border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {line.product.name}
                          {line.variationName ? ` • ${line.variationName}` : ""}
                        </p>
                        {line.optionLabels.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            + {line.optionLabels.join(", ")}
                          </p>
                        )}
                        <p className="text-xs font-medium text-primary">
                          {brl(line.unitPrice)} un.
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 rounded-full"
                          onClick={() =>
                            setLines((prev) =>
                              prev
                                .map((l) =>
                                  l.key === line.key
                                    ? { ...l, quantity: Math.max(1, l.quantity - 1) }
                                    : l,
                                )
                                .filter((l) => l.quantity > 0),
                            )
                          }
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-5 text-center text-sm font-bold">{line.quantity}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 rounded-full"
                          onClick={() =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key ? { ...l, quantity: l.quantity + 1 } : l,
                              ),
                            )
                          }
                        >
                          <Plus className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 rounded-full text-destructive"
                          onClick={() =>
                            setLines((prev) => prev.filter((l) => l.key !== line.key))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-16 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-bold text-primary">{brl(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-full"
            disabled={save.isPending}
            onClick={() => {
              if (!save.isPending) save.mutate();
            }}
          >
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Lançar pedido
          </Button>
        </div>

        {/* Variation / options picker */}
        <Dialog open={Boolean(picking)} onOpenChange={(o) => !o && setPicking(null)}>
          <DialogContent className="max-w-md rounded-2xl sm:rounded-2xl">
            <DialogHeader>
              <DialogTitle>{picking?.name}</DialogTitle>
              <DialogDescription>Escolha variação e adicionais.</DialogDescription>
            </DialogHeader>
            {picking && (
              <div className="space-y-4">
                {picking.variations.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Variação</Label>
                    <Select value={pickVariationId} onValueChange={setPickVariationId}>
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {picking.variations.map((v) => (
                          <SelectItem key={v.id} value={v.id} disabled={!v.available}>
                            {v.name}
                            {v.priceDelta ? ` (${v.priceDelta > 0 ? "+" : ""}${brl(v.priceDelta)})` : ""}
                            {!v.available ? " — esgotado" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {picking.optionGroups.map((g) => (
                  <div key={g.id} className="space-y-1.5">
                    <Label>
                      {g.name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({g.required ? "obrigatório" : "opcional"} · máx. {g.maxSelect})
                      </span>
                    </Label>
                    <div className="space-y-1">
                      {g.items.map((item) => {
                        const checked = pickOptions.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm"
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type={g.selection === "single" ? "radio" : "checkbox"}
                                name={`og-${g.id}`}
                                checked={checked}
                                disabled={!item.available}
                                onChange={() => {
                                  if (g.selection === "single") {
                                    const others = pickOptions.filter(
                                      (id) => !g.items.some((i) => i.id === id),
                                    );
                                    setPickOptions(
                                      checked ? others : [...others, item.id],
                                    );
                                  } else {
                                    setPickOptions((prev) =>
                                      checked
                                        ? prev.filter((id) => id !== item.id)
                                        : [...prev, item.id],
                                    );
                                  }
                                }}
                              />
                              {item.name}
                            </span>
                            <span className="text-muted-foreground">
                              {item.price > 0 ? `+ ${brl(item.price)}` : "Grátis"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <Button className="w-full rounded-full" onClick={confirmPick}>
                  Adicionar ao pedido
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
