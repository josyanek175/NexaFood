import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2, Ticket, ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/format";
import { linePrice, useCart } from "@/context/cart";
import { placeOrder } from "@/services/orders";
import type { Establishment, OrderMode, PaymentMethod } from "@/lib/types";
import { toast } from "sonner";

type Step = "cart" | "dados" | "pagamento" | "conferencia";

const MODE_LABEL: Record<OrderMode, string> = {
  delivery: "Entrega",
  retirada: "Retirada",
  local: "Consumo no local",
};

const PAYMENTS: { key: PaymentMethod; label: string }[] = [
  { key: "pix", label: "Pix" },
  { key: "credito", label: "Cartão de crédito" },
  { key: "debito", label: "Cartão de débito" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "caixa", label: "Pagar no caixa" },
];

export function CartSheet({
  open,
  onOpenChange,
  establishment,
  tableNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishment: Establishment;
  tableNumber?: number;
}) {
  const cart = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("cart");
  const [mode, setMode] = useState<OrderMode>(tableNumber ? "local" : (establishment.modes[0] ?? "delivery"));
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ table: tableNumber ? String(tableNumber) : "" });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const subtotal = cart.subtotal;
  const deliveryFee = mode === "delivery" ? establishment.delivery_fee_from : 0;
  const serviceFee = mode === "local" ? (subtotal * establishment.service_fee_percent) / 100 : 0;
  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount + deliveryFee + serviceFee);

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (code === "NEXA10" && subtotal >= 40) {
      setAppliedCoupon({ code, discount: subtotal * 0.1 });
      toast.success("Cupom NEXA10 aplicado (10% de desconto)");
    } else if (code === "FRETEGRATIS" && subtotal >= 90) {
      setAppliedCoupon({ code, discount: establishment.delivery_fee_from });
      toast.success("Cupom FRETEGRATIS aplicado");
    } else {
      toast.error("Cupom inválido ou pedido abaixo do mínimo");
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const finish = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const address =
        mode === "delivery"
          ? [form["address"], form["number"], form["district"], form["complement"], form["cep"]]
              .filter(Boolean)
              .join(", ")
          : undefined;
      const { publicToken } = await placeOrder({
        slug: establishment.slug,
        mode,
        payment,
        customerName: form["name"] ?? (tableNumber ? `Mesa ${tableNumber}` : "Cliente"),
        ...(form["phone"] ? { customerPhone: form["phone"] } : {}),
        ...(address ? { address } : {}),
        ...(mode === "local" && (form["table"] ?? tableNumber)
          ? { tableNumber: Number(form["table"] ?? tableNumber) }
          : {}),
        ...(form["notes"] ? { notes: form["notes"] } : {}),
        ...(payment === "dinheiro" && changeFor ? { changeFor: Number(changeFor) } : {}),
        lines: cart.lines,
      });
      cart.clear();
      onOpenChange(false);
      setStep("cart");
      // Route param holds opaque public_token (display code comes from tracking payload).
      void navigate({ to: "/pedido/$code", params: { code: publicToken } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const requiredFilled =
    mode === "delivery"
      ? ["name", "phone", "cep", "address", "number", "district"].every((k) => (form[k] ?? "").trim())
      : mode === "retirada"
        ? ["name", "phone"].every((k) => (form[k] ?? "").trim())
        : !!(form["table"] ?? "").trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            {step !== "cart" && (
              <button
                aria-label="Voltar"
                onClick={() => setStep(step === "conferencia" ? "pagamento" : step === "pagamento" ? "dados" : "cart")}
                className="rounded-full p-1 hover:bg-muted"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            {step === "cart" && "Seu carrinho"}
            {step === "dados" && "Seus dados"}
            {step === "pagamento" && "Pagamento"}
            {step === "conferencia" && "Confira seu pedido"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {step === "cart" && (
            <>
              {cart.lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="grid size-16 place-items-center rounded-full bg-primary-soft">
                    <ShoppingBag className="size-7 text-primary" />
                  </div>
                  <h3 className="mt-4 font-bold">Seu carrinho está vazio</h3>
                  <p className="mt-1 max-w-[24ch] text-sm text-muted-foreground">
                    Escolha um produto do cardápio para começar seu pedido.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.lines.map((line) => (
                      <div key={line.line_id} className="flex gap-3 rounded-2xl border bg-card p-3">
                        <img
                          src={line.image_url}
                          alt={line.name}
                          width={800}
                          height={600}
                          loading="lazy"
                          className="size-16 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{line.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[line.variation?.name, ...line.options.map((o) => o.item_name)]
                              .filter(Boolean)
                              .join(" • ") || "Sem complementos"}
                          </p>
                          {line.removed.length > 0 && (
                            <p className="text-xs text-destructive">Sem: {line.removed.join(", ")}</p>
                          )}
                          {line.notes && <p className="text-xs italic text-muted-foreground">“{line.notes}”</p>}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1 rounded-full border p-0.5">
                              <button
                                aria-label="Diminuir"
                                className="grid size-6 place-items-center rounded-full hover:bg-muted"
                                onClick={() =>
                                  line.quantity === 1
                                    ? cart.remove(line.line_id)
                                    : cart.update(line.line_id, { quantity: line.quantity - 1 })
                                }
                              >
                                {line.quantity === 1 ? <Trash2 className="size-3" /> : <Minus className="size-3" />}
                              </button>
                              <span className="w-5 text-center text-xs font-bold">{line.quantity}</span>
                              <button
                                aria-label="Aumentar"
                                className="grid size-6 place-items-center rounded-full hover:bg-muted"
                                onClick={() => cart.update(line.line_id, { quantity: line.quantity + 1 })}
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-primary">{brl(linePrice(line))}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Modalidade</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {establishment.modes.map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${
                            mode === m ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted"
                          }`}
                        >
                          {MODE_LABEL[m]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Cupom</Label>
                    <div className="flex gap-2">
                      <Input
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        placeholder="NEXA10"
                        className="rounded-xl uppercase"
                      />
                      <Button variant="secondary" className="rounded-xl" onClick={applyCoupon}>
                        <Ticket className="mr-1 size-4" /> Aplicar
                      </Button>
                    </div>
                  </div>

                  <Totals {...{ subtotal, discount, deliveryFee, serviceFee, total, establishment, mode }} />
                </>
              )}
            </>
          )}

          {step === "dados" && (
            <div className="space-y-4">
              {mode === "delivery" && (
                <>
                  <Field label="Nome" k="name" form={form} set={set} />
                  <Field label="Telefone" k="phone" form={form} set={set} placeholder="(11) 90000-0000" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CEP" k="cep" form={form} set={set} />
                    <Field label="Número" k="number" form={form} set={set} />
                  </div>
                  <Field label="Endereço" k="address" form={form} set={set} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bairro" k="district" form={form} set={set} />
                    <Field label="Complemento" k="complement" form={form} set={set} />
                  </div>
                  <Field label="Referência" k="reference" form={form} set={set} />
                </>
              )}
              {mode === "retirada" && (
                <>
                  <Field label="Nome" k="name" form={form} set={set} />
                  <Field label="Telefone" k="phone" form={form} set={set} />
                  <Field label="Horário desejado" k="pickup_time" form={form} set={set} placeholder="20:30" />
                </>
              )}
              {mode === "local" && (
                <>
                  <Field label="Mesa" k="table" form={form} set={set} placeholder="12" />
                  <Field label="Nome do cliente (opcional)" k="name" form={form} set={set} />
                </>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Observações do pedido</Label>
                <Textarea
                  value={form["notes"] ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  className="resize-none rounded-xl"
                  placeholder="Alguma instrução para a equipe?"
                />
              </div>
            </div>
          )}

          {step === "pagamento" && (
            <div className="space-y-3">
              {PAYMENTS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPayment(p.key)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-sm font-medium transition ${
                    payment === p.key ? "border-primary bg-primary-soft" : "hover:bg-muted"
                  }`}
                >
                  {p.label}
                  <span
                    className={`size-4 rounded-full border-2 ${payment === p.key ? "border-primary bg-primary" : "border-border"}`}
                  />
                </button>
              ))}
              {payment === "dinheiro" && (
                <div className="space-y-1.5 rounded-xl border bg-muted/50 p-3">
                  <Label className="text-xs font-bold uppercase">Troco para quanto?</Label>
                  <Input
                    value={changeFor}
                    onChange={(e) => setChangeFor(e.target.value)}
                    inputMode="decimal"
                    placeholder="100,00"
                    className="rounded-xl bg-card"
                  />
                </div>
              )}
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                Pagamento online ainda não processado — ambiente de demonstração. A cobrança real será
                habilitada com o gateway configurado em Integrações.
              </p>
            </div>
          )}

          {step === "conferencia" && (
            <div className="space-y-4">
              <div className="surface-card space-y-2 p-4 text-sm">
                <Row label="Modalidade" value={MODE_LABEL[mode]} />
                {mode === "local" && <Row label="Mesa" value={form["table"] ?? "—"} />}
                {mode === "delivery" && (
                  <Row label="Endereço" value={`${form["address"] ?? ""}, ${form["number"] ?? ""} — ${form["district"] ?? ""}`} />
                )}
                <Row label="Cliente" value={form["name"] || "Não informado"} />
                <Row label="Pagamento" value={PAYMENTS.find((p) => p.key === payment)?.label ?? ""} />
                {payment === "dinheiro" && changeFor && <Row label="Troco para" value={`R$ ${changeFor}`} />}
              </div>
              <div className="surface-card divide-y p-4">
                {cart.lines.map((l) => (
                  <div key={l.line_id} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                    <span>
                      <strong>{l.quantity}x</strong> {l.name}
                      {l.variation && <span className="text-muted-foreground"> • {l.variation.name}</span>}
                    </span>
                    <span className="font-semibold">{brl(linePrice(l))}</span>
                  </div>
                ))}
              </div>
              <Totals {...{ subtotal, discount, deliveryFee, serviceFee, total, establishment, mode }} />
            </div>
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="border-t bg-card p-4">
            {step === "cart" && (
              <Button
                className="h-12 w-full rounded-full text-base font-semibold shadow-glow"
                disabled={subtotal < establishment.min_order}
                onClick={() => setStep("dados")}
              >
                {subtotal < establishment.min_order
                  ? `Pedido mínimo ${brl(establishment.min_order)}`
                  : `Continuar • ${brl(total)}`}
              </Button>
            )}
            {step === "dados" && (
              <Button
                className="h-12 w-full rounded-full text-base font-semibold"
                disabled={!requiredFilled}
                onClick={() => setStep("pagamento")}
              >
                Ir para pagamento
              </Button>
            )}
            {step === "pagamento" && (
              <Button className="h-12 w-full rounded-full text-base font-semibold" onClick={() => setStep("conferencia")}>
                Conferir pedido
              </Button>
            )}
            {step === "conferencia" && (
              <Button
                className="h-12 w-full rounded-full text-base font-semibold shadow-glow"
                onClick={() => void finish()}
                disabled={submitting}
              >
                Finalizar pedido • {brl(total)}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Totals({
  subtotal,
  discount,
  deliveryFee,
  serviceFee,
  total,
  establishment,
  mode,
}: {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  establishment: Establishment;
  mode: OrderMode;
}) {
  return (
    <div className="surface-card space-y-2 p-4 text-sm">
      <Row label="Subtotal" value={brl(subtotal)} />
      {discount > 0 && <Row label="Desconto" value={`- ${brl(discount)}`} />}
      {mode === "delivery" && <Row label="Taxa de entrega" value={brl(deliveryFee)} />}
      {mode === "local" && (
        <Row label={`Taxa de serviço (${establishment.service_fee_percent}%)`} value={brl(serviceFee)} />
      )}
      <div className="flex justify-between border-t pt-2 text-base font-bold">
        <span>Total</span>
        <span className="text-primary">{brl(total)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Field({
  label,
  k,
  form,
  set,
  placeholder,
}: {
  label: string;
  k: string;
  form: Record<string, string>;
  set: (k: string, v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase">{label}</Label>
      <Input
        value={form[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder ?? ""}
        className="h-11 rounded-xl"
      />
    </div>
  );
}
