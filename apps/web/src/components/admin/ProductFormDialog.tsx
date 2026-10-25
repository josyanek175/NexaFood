import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { OptionGroup } from "@/lib/types";
import { ApiClientError } from "@/lib/api-client";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  emptyProductForm,
  formFromAdminProduct,
  moveVariation,
  nextVariationKey,
  snapshotForm,
  toWritePayload,
  validateProductForm,
  type ProductFormState,
} from "@/components/admin/product-form-state";
import type { KitchenSectorOption } from "@/services/menu-adapter";
import { createProduct, getProduct, updateProduct } from "@/services/products-api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  open: boolean;
  productId: string | null;
  categories: Array<{ id: string; name: string }>;
  sectors: KitchenSectorOption[];
  optionGroups: OptionGroup[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const NONE = "__none__";

export function ProductFormDialog({
  open,
  productId,
  categories,
  sectors,
  optionGroups,
  onOpenChange,
  onSaved,
}: Props) {
  const isEdit = Boolean(productId);
  const [tab, setTab] = useState("info");
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [baseline, setBaseline] = useState(snapshotForm(emptyProductForm()));
  const [errors, setErrors] = useState<ReturnType<typeof validateProductForm>>({});

  const detailQuery = useQuery({
    queryKey: ["admin-product", productId],
    queryFn: () => getProduct(productId!),
    enabled: open && Boolean(productId),
  });

  useEffect(() => {
    if (!open) return;
    setTab("info");
    setErrors({});
    if (!productId) {
      const empty = emptyProductForm();
      setForm(empty);
      setBaseline(snapshotForm(empty));
    }
  }, [open, productId]);

  useEffect(() => {
    if (!open || !productId || !detailQuery.data) return;
    const next = formFromAdminProduct(detailQuery.data);
    setForm(next);
    setBaseline(snapshotForm(next));
    setErrors({});
  }, [open, productId, detailQuery.data]);

  const dirty = snapshotForm(form) !== baseline;
  const loadingDetail = isEdit && detailQuery.isLoading;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextErrors = validateProductForm(form);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        throw new Error("VALIDATION");
      }
      const payload = toWritePayload(form);
      if (productId) return updateProduct(productId, payload);
      return createProduct(payload);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? "Produto atualizado." : "Produto criado.");
      setBaseline(snapshotForm(formFromAdminProduct(saved)));
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "VALIDATION") {
        toast.error("Revise os campos destacados.");
        const current = validateProductForm(form);
        setTab(
          current.variations &&
            !current.name &&
            !current.price &&
            !current.promoPrice &&
            !current.prepMinutes &&
            !current.imageUrl
            ? "variations"
            : "info",
        );
        return;
      }
      const message =
        error instanceof ApiClientError ? error.message : "Não foi possível salvar o produto.";
      toast.error(message);
    },
  });

  const sortedGroups = useMemo(
    () => [...optionGroups].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [optionGroups],
  );

  function patch<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl">
              {isEdit ? "Editar produto" : "Novo produto"}
            </DialogTitle>
            {dirty && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Alterações não salvas
              </span>
            )}
          </div>
          <DialogDescription>
            Preencha as informações principais e configure variações, adicionais e disponibilidade.
          </DialogDescription>
        </DialogHeader>

        {loadingDetail ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <div className="border-b px-6 pt-3">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-full bg-muted/60 p-1">
                  <TabsTrigger value="info" className="rounded-full px-3">
                    Informações
                  </TabsTrigger>
                  <TabsTrigger value="variations" className="rounded-full px-3">
                    Variações
                  </TabsTrigger>
                  <TabsTrigger value="options" className="rounded-full px-3">
                    Adicionais
                  </TabsTrigger>
                  <TabsTrigger value="availability" className="rounded-full px-3">
                    Disponibilidade
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <TabsContent value="info" className="mt-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nome do produto" error={errors.name} className="sm:col-span-2">
                      <Input
                        value={form.name}
                        onChange={(e) => patch("name", e.target.value)}
                        placeholder="Ex.: X-Burger da Casa"
                        className="h-11 rounded-xl"
                      />
                    </Field>
                    <Field label="Preço" error={errors.price}>
                      <Input
                        value={form.price}
                        onChange={(e) => patch("price", e.target.value)}
                        inputMode="decimal"
                        placeholder="0,00"
                        className="h-11 rounded-xl font-semibold"
                      />
                    </Field>
                    <Field label="Preço promocional" error={errors.promoPrice}>
                      <Input
                        value={form.promoPrice}
                        onChange={(e) => patch("promoPrice", e.target.value)}
                        inputMode="decimal"
                        placeholder="Opcional"
                        className="h-11 rounded-xl"
                      />
                    </Field>
                    <Field label="Categoria">
                      <Select
                        value={form.categoryId || NONE}
                        onValueChange={(v) => patch("categoryId", v === NONE ? "" : v)}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem categoria</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Setor da cozinha">
                      <Select
                        value={form.sectorId || NONE}
                        onValueChange={(v) => patch("sectorId", v === NONE ? "" : v)}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem setor</SelectItem>
                          {sectors.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Descrição">
                    <Textarea
                      value={form.description}
                      onChange={(e) => patch("description", e.target.value)}
                      placeholder="Ingredientes, observação para o cliente..."
                      className="min-h-24 rounded-xl"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="URL da imagem" error={errors.imageUrl}>
                      <Input
                        value={form.imageUrl}
                        onChange={(e) => patch("imageUrl", e.target.value)}
                        placeholder="https://..."
                        className="h-11 rounded-xl"
                      />
                    </Field>
                    <Field label="SKU">
                      <Input
                        value={form.sku}
                        onChange={(e) => patch("sku", e.target.value)}
                        placeholder="Código interno"
                        className="h-11 rounded-xl"
                      />
                    </Field>
                    <Field label="Tempo de preparo (min)" error={errors.prepMinutes}>
                      <Input
                        value={form.prepMinutes}
                        onChange={(e) => patch("prepMinutes", e.target.value)}
                        inputMode="numeric"
                        className="h-11 rounded-xl"
                      />
                    </Field>
                    <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">Destaque no cardápio</p>
                        <p className="text-xs text-muted-foreground">
                          Aparece em evidência na vitrine.
                        </p>
                      </div>
                      <Switch
                        checked={form.featured}
                        onCheckedChange={(v) => patch("featured", v)}
                        aria-label="Destaque"
                      />
                    </div>
                  </div>

                  {form.imageUrl.trim() && (
                    <div className="overflow-hidden rounded-xl border bg-muted/30">
                      <img
                        src={form.imageUrl}
                        alt="Prévia"
                        className="h-36 w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="variations" className="mt-0 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Tamanhos e versões</p>
                      <p className="text-xs text-muted-foreground">
                        Ex.: Individual (+ R$ 0,00) e Duplo (+ R$ 12,00).
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() =>
                        patch("variations", [
                          ...form.variations,
                          {
                            key: nextVariationKey(),
                            name: "",
                            priceDelta: "0",
                            available: true,
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 size-4" />
                      Adicionar
                    </Button>
                  </div>
                  {errors.variations && (
                    <p className="text-xs font-medium text-destructive">{errors.variations}</p>
                  )}
                  {form.variations.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhuma variação. O produto será vendido só com o preço base.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {form.variations.map((v, index) => (
                        <li
                          key={v.key}
                          className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_7rem_auto_auto]"
                        >
                          <Input
                            value={v.name}
                            onChange={(e) => {
                              const next = [...form.variations];
                              next[index] = { ...v, name: e.target.value };
                              patch("variations", next);
                            }}
                            placeholder="Nome (ex.: Duplo)"
                            className="h-10 rounded-xl"
                          />
                          <Input
                            value={v.priceDelta}
                            onChange={(e) => {
                              const next = [...form.variations];
                              next[index] = { ...v, priceDelta: e.target.value };
                              patch("variations", next);
                            }}
                            inputMode="decimal"
                            placeholder="+/-"
                            className="h-10 rounded-xl"
                          />
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={v.available}
                              onCheckedChange={(checked) => {
                                const next = [...form.variations];
                                next[index] = { ...v, available: checked };
                                patch("variations", next);
                              }}
                              aria-label="Variação disponível"
                            />
                            <span className="text-xs text-muted-foreground">
                              {v.available ? "À venda" : "Esgotada"}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 rounded-full"
                              disabled={index === 0}
                              onClick={() =>
                                patch("variations", moveVariation(form.variations, index, -1))
                              }
                              aria-label="Subir"
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 rounded-full"
                              disabled={index === form.variations.length - 1}
                              onClick={() =>
                                patch("variations", moveVariation(form.variations, index, 1))
                              }
                              aria-label="Descer"
                            >
                              <ArrowDown className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 rounded-full text-destructive"
                              onClick={() =>
                                patch(
                                  "variations",
                                  form.variations.filter((_, i) => i !== index),
                                )
                              }
                              aria-label="Remover"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground sm:col-span-4">
                            Acréscimo: {brl(Number(String(v.priceDelta).replace(",", ".")) || 0)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="options" className="mt-0 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Grupos de adicionais</p>
                    <p className="text-xs text-muted-foreground">
                      Vincule grupos já cadastrados neste estabelecimento. Novos grupos são criados
                      na aba Complementos.
                    </p>
                  </div>
                  {sortedGroups.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum grupo de adicionais cadastrado ainda.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {sortedGroups.map((g) => {
                        const checked = form.optionGroupIds.includes(g.id);
                        return (
                          <li key={g.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer gap-3 rounded-xl border p-3 transition",
                                checked
                                  ? "border-primary/40 bg-primary-soft/40"
                                  : "hover:bg-muted/40",
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  const on = value === true;
                                  patch(
                                    "optionGroupIds",
                                    on
                                      ? [...form.optionGroupIds, g.id]
                                      : form.optionGroupIds.filter((id) => id !== g.id),
                                  );
                                }}
                                className="mt-1"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{g.name}</span>
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                    {g.required ? "Obrigatório" : "Opcional"}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    mín. {g.min} / máx. {g.max}
                                  </span>
                                </div>
                                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                                  {g.items.map((item) => (
                                    <li
                                      key={item.id}
                                      className={cn(
                                        "rounded-full bg-muted px-2 py-0.5 text-[11px]",
                                        !item.available && "line-through opacity-60",
                                      )}
                                    >
                                      {item.name}
                                      {item.price > 0 ? ` · ${brl(item.price)}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="availability" className="mt-0 space-y-3">
                  <StatusCard
                    title="Produto ativo no cardápio"
                    description={
                      form.active
                        ? "Aparece no cardápio público e no catálogo."
                        : "Fica oculto no cardápio público. Clientes não veem este item."
                    }
                    checked={form.active}
                    onCheckedChange={(v) => patch("active", v)}
                    onLabel="Ativo"
                    offLabel="Inativo"
                  />
                  <StatusCard
                    title="Disponível para venda"
                    description={
                      form.available
                        ? "Clientes podem adicionar ao carrinho e pedir."
                        : "Continua visível no cardápio como esgotado, sem possibilidade de compra."
                    }
                    checked={form.available}
                    onCheckedChange={(v) => patch("available", v)}
                    onLabel="Disponível"
                    offLabel="Esgotado"
                    disabled={!form.active}
                  />
                  {!form.active && (
                    <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      Com o produto inativo, a disponibilidade para venda não aparece ao cliente — o
                      item fica oculto.
                    </p>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card/95 px-6 py-4">
              <p className="text-xs text-muted-foreground">
                {dirty ? "Há alterações pendentes." : "Tudo salvo."}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  disabled={saveMutation.isPending}
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="rounded-full px-5"
                  disabled={saveMutation.isPending || loadingDetail}
                  onClick={() => {
                    if (saveMutation.isPending) return;
                    saveMutation.mutate();
                  }}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Salvar produto
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function StatusCard({
  title,
  description,
  checked,
  onCheckedChange,
  onLabel,
  offLabel,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  onLabel: string;
  offLabel: string;
  disabled?: boolean | undefined;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-xl border p-4",
        disabled && "opacity-60",
      )}
    >
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs font-semibold text-primary">{checked ? onLabel : offLabel}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
