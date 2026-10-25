import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import type { CartOptionSelection, OptionGroup, Product, ProductVariation } from "@/lib/types";
import { useCart } from "@/context/cart";
import { toast } from "sonner";

interface Props {
  product: Product | null;
  groups: OptionGroup[];
  onClose: () => void;
}

export function ProductModal({ product, groups, onClose }: Props) {
  const cart = useCart();
  const [variation, setVariation] = useState<ProductVariation | undefined>();
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);

  const productGroups = useMemo(
    () => (product ? groups.filter((g) => product.option_group_ids.includes(g.id)) : []),
    [product, groups],
  );

  const basePrice = product ? (product.promo_price ?? product.price) : 0;
  const currentVariation =
    variation ?? product?.variations.find((v) => v.available !== false) ?? product?.variations[0];

  const optionSelections: CartOptionSelection[] = useMemo(() => {
    const out: CartOptionSelection[] = [];
    productGroups.forEach((g) => {
      (selected[g.id] ?? []).forEach((itemId) => {
        const item = g.items.find((i) => i.id === itemId);
        if (item)
          out.push({
            group_id: g.id,
            group_name: g.name,
            item_id: item.id,
            item_name: item.name,
            price: item.price,
          });
      });
    });
    return out;
  }, [productGroups, selected]);

  const total =
    (basePrice +
      (currentVariation?.price_delta ?? 0) +
      optionSelections.reduce((s, o) => s + o.price, 0)) *
    qty;

  const missingRequired = productGroups.filter(
    (g) => g.required && (selected[g.id]?.length ?? 0) < g.min,
  );

  const reset = () => {
    setVariation(undefined);
    setSelected({});
    setRemoved([]);
    setNotes("");
    setQty(1);
  };

  const toggle = (group: OptionGroup, itemId: string) => {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (group.selection === "single") return { ...prev, [group.id]: [itemId] };
      if (current.includes(itemId))
        return { ...prev, [group.id]: current.filter((i) => i !== itemId) };
      if (current.length >= group.max) return prev;
      return { ...prev, [group.id]: [...current, itemId] };
    });
  };

  if (!product) return null;

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && (reset(), onClose())}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <div className="relative">
          <img
            src={product.image_url}
            alt={product.name}
            width={800}
            height={600}
            className="h-56 w-full object-cover sm:h-64"
          />
        </div>

        <div className="space-y-6 p-5">
          <header className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold">{product.name}</h2>
              {product.promo_price && (
                <Badge className="shrink-0 bg-primary text-primary-foreground">Promoção</Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-primary">{brl(basePrice)}</span>
              {product.promo_price && (
                <span className="text-sm text-muted-foreground line-through">
                  {brl(product.price)}
                </span>
              )}
            </div>
          </header>

          {product.variations.length > 0 && (
            <section className="space-y-3">
              <SectionTitle title="Escolha o tamanho" hint="Obrigatório" required />
              <div className="grid gap-2">
                {product.variations.map((v) => (
                  <label
                    key={v.id}
                    className={`flex items-center justify-between rounded-xl border p-3 text-sm transition ${
                      !v.available
                        ? "cursor-not-allowed opacity-60"
                        : currentVariation?.id === v.id
                          ? "cursor-pointer border-primary bg-primary-soft"
                          : "cursor-pointer hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variation"
                        className="accent-[var(--primary)]"
                        checked={currentVariation?.id === v.id}
                        disabled={!v.available}
                        onChange={() => setVariation(v)}
                      />
                      {v.name}
                      {!v.available && (
                        <span className="text-xs text-muted-foreground">Esgotado</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {v.price_delta > 0 ? `+ ${brl(v.price_delta)}` : "Incluso"}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {productGroups.map((g) => (
            <section key={g.id} className="space-y-3">
              <SectionTitle
                title={g.name}
                hint={g.required ? `Escolha ${g.min}` : `Até ${g.max} itens • opcional`}
                required={g.required}
              />
              <div className="grid gap-2">
                {g.items.map((item) => {
                  const checked = (selected[g.id] ?? []).includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center justify-between rounded-xl border p-3 text-sm transition ${
                        !item.available
                          ? "cursor-not-allowed opacity-50"
                          : checked
                            ? "cursor-pointer border-primary bg-primary-soft"
                            : "cursor-pointer hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type={g.selection === "single" ? "radio" : "checkbox"}
                          name={g.id}
                          disabled={!item.available}
                          checked={checked}
                          onChange={() => toggle(g, item.id)}
                          className="accent-[var(--primary)]"
                        />
                        <span>
                          {item.name}
                          {!item.available && <span className="ml-2 text-xs">Indisponível</span>}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {item.price > 0 ? `+ ${brl(item.price)}` : "Grátis"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}

          {product.removable_ingredients.length > 0 && (
            <section className="space-y-3">
              <SectionTitle title="Retirar ingredientes" hint="Opcional" />
              <div className="flex flex-wrap gap-2">
                {product.removable_ingredients.map((ing) => {
                  const active = removed.includes(ing);
                  return (
                    <button
                      key={ing}
                      onClick={() =>
                        setRemoved((prev) =>
                          active ? prev.filter((i) => i !== ing) : [...prev, ing],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-destructive bg-destructive/10 text-destructive line-through"
                          : "hover:bg-muted"
                      }`}
                    >
                      {ing}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <SectionTitle title="Observações" hint="Opcional" />
            <Textarea
              value={notes}
              maxLength={200}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: capricha no molho, embalar separado..."
              className="resize-none rounded-xl"
            />
          </section>

          <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center gap-3 border-t bg-card/95 p-4 backdrop-blur">
            <div className="flex items-center gap-1 rounded-full border p-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-full"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Diminuir"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold">{qty}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 rounded-full"
                onClick={() => setQty((q) => q + 1)}
                aria-label="Aumentar"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <Button
              className="h-12 flex-1 rounded-full text-base font-semibold shadow-glow"
              disabled={
                !product.available ||
                (product.variations.length > 0 &&
                  (!currentVariation || currentVariation.available === false)) ||
                missingRequired.length > 0
              }
              onClick={() => {
                cart.add({
                  product_id: product.id,
                  name: product.name,
                  image_url: product.image_url,
                  base_price: basePrice,
                  ...(currentVariation ? { variation: currentVariation } : {}),
                  options: optionSelections,
                  removed,
                  ...(notes.trim() ? { notes: notes.trim() } : {}),
                  quantity: qty,
                });
                toast.success(`${product.name} adicionado ao carrinho`);
                reset();
                onClose();
              }}
            >
              {missingRequired.length > 0
                ? `Escolha: ${missingRequired[0]?.name}`
                : `Adicionar • ${brl(total)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({
  title,
  hint,
  required,
}: {
  title: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      {hint && (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            required ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
