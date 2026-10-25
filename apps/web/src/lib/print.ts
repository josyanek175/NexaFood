import { brl, hhmm } from "@/lib/format";
import type { KitchenSector, Order } from "@/lib/types";

type Kind = "comanda" | "cupom";

export type PrintReceiptOptions = {
  widthMm?: number;
  /** When set, only items from this kitchen sector are printed. */
  sector?: KitchenSector | "todos" | undefined;
};

const MODE_LABEL: Record<string, string> = {
  delivery: "ENTREGA",
  retirada: "RETIRADA",
  local: "CONSUMO NO LOCAL",
};

/** Monta o texto da comanda/cupom no formato de impressora térmica. */
export function receiptText(
  order: Order,
  establishmentName: string,
  kind: Kind = "cupom",
  options: PrintReceiptOptions = {},
): string {
  const sectorFilter = options.sector && options.sector !== "todos" ? options.sector : null;
  const items = sectorFilter
    ? order.items.filter((i) => i.sector === sectorFilter)
    : order.items;

  const line = "-".repeat(38);
  const out: string[] = [];
  out.push(establishmentName.toUpperCase());
  out.push(kind === "comanda" ? "COMANDA DE PRODUCAO" : "CUPOM NAO FISCAL");
  out.push(line);

  if (order.table_number) {
    out.push(`*** MESA ${order.table_number} ***`);
  } else {
    out.push(MODE_LABEL[order.mode] ?? order.mode.toUpperCase());
  }

  out.push(`Pedido #${order.code}`);
  out.push(`${hhmm(order.created_at)}  ${MODE_LABEL[order.mode] ?? order.mode}`);
  if (sectorFilter) out.push(`Setor: ${sectorFilter.toUpperCase()}`);
  out.push(`Cliente: ${order.customer_name}`);
  if (order.address) out.push(`Endereco: ${order.address}`);
  out.push(line);

  if (items.length === 0) {
    out.push("(sem itens neste setor)");
  }

  for (const item of items) {
    out.push(`${item.quantity}x ${item.product_name}${item.variation ? ` (${item.variation})` : ""}`);
    for (const op of item.options) out.push(`   + ${op.item_name}`);
    for (const rm of item.removed) out.push(`   - sem ${rm}`);
    if (item.notes) out.push(`   obs: ${item.notes}`);
    if (kind === "cupom") out.push(`   ${brl(item.unit_price * item.quantity)}`);
    if (kind === "comanda") out.push(`   [${item.sector}]`);
  }

  out.push(line);
  if (kind === "cupom") {
    out.push(`Subtotal        ${brl(order.subtotal)}`);
    if (order.discount > 0) out.push(`Desconto       -${brl(order.discount)}`);
    if (order.delivery_fee > 0) out.push(`Entrega         ${brl(order.delivery_fee)}`);
    if (order.service_fee > 0) out.push(`Servico         ${brl(order.service_fee)}`);
    out.push(`TOTAL           ${brl(order.total)}`);
    out.push(`Pagamento: ${order.payment_method.toUpperCase()}`);
    if (order.change_for) out.push(`Troco para: ${brl(order.change_for)}`);
  }
  if (order.notes) out.push(`Obs: ${order.notes}`);
  out.push(line);
  out.push("NexaCardapio");
  return out.join("\n");
}

/** Abre a janela de impressão com o layout de bobina (58/80mm). */
export function printReceipt(
  order: Order,
  establishmentName: string,
  kind: Kind = "cupom",
  options: PrintReceiptOptions | number = {},
) {
  // Back-compat: older callers passed widthMm as 4th argument.
  const opts: PrintReceiptOptions =
    typeof options === "number" ? { widthMm: options } : options;
  const widthMm = opts.widthMm ?? 80;

  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return false;
  const body = receiptText(order, establishmentName, kind, opts)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
  win.document.write(
    `<html><head><title>${kind} ${order.code}</title><style>
      @page { size: ${widthMm}mm auto; margin: 3mm; }
      body { font-family: ui-monospace, "Courier New", monospace; font-size: 12px; white-space: pre; }
      .mesa { font-size: 18px; font-weight: 700; }
    </style></head><body>${body}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
  return true;
}
