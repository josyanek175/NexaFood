import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Download, Wallet } from "lucide-react";
import { api } from "@/services/api";
import { establishments } from "@/data/demo";
import { brl } from "@/lib/format";
import { DemoNotice, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/financeiro")({
  component: FinancePage,
});

function FinancePage() {
  const est = establishments[0]!;
  const { data } = useQuery({ queryKey: ["analytics", est.id], queryFn: () => api.analytics(est.id) });
  const payments = data?.paymentsBreakdown ?? [];
  const revenue = payments.reduce((s, p) => s + p.value, 0);
  const commissions = revenue * 0.062;
  const costs = revenue * 0.31;

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Caixa do dia, formas de pagamento, comissões de marketplace e sangrias."
        action={
          <Button variant="secondary" className="rounded-full" onClick={() => toast.success("Exportação CSV gerada (demonstração)")}>
            <Download className="mr-1.5 size-4" /> Exportar CSV
          </Button>
        }
      />
      <DemoNotice>valores calculados sobre os pedidos simulados do dia.</DemoNotice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento bruto" value={brl(revenue)} trend={12.4} hint="vs. ontem" icon={<Wallet className="size-4" />} />
        <StatCard label="Comissões marketplace" value={brl(commissions)} hint="6,2% do bruto" icon={<ArrowDownRight className="size-4" />} />
        <StatCard label="Custo de mercadoria (CMV)" value={brl(costs)} hint="31% do bruto" icon={<ArrowDownRight className="size-4" />} />
        <StatCard label="Resultado líquido" value={brl(revenue - commissions - costs)} trend={8.1} hint="vs. ontem" icon={<ArrowUpRight className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Recebimentos por forma de pagamento">
          <ul className="space-y-3">
            {payments.map((p) => {
              const pct = revenue ? (p.value / revenue) * 100 : 0;
              return (
                <li key={p.method}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.method}</span>
                    <span className="font-semibold">{brl(p.value)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{pct.toFixed(1)}% do faturamento</p>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Movimentações do caixa">
          <ul className="divide-y text-sm">
            {[
              ["Abertura de caixa", 200, "08:00"],
              ["Sangria — depósito bancário", -1500, "15:20"],
              ["Suprimento — troco", 300, "18:05"],
              ["Sangria — pagamento fornecedor", -640, "21:10"],
            ].map(([label, value, time]) => (
              <li key={String(label)} className="flex items-center justify-between py-3 first:pt-0">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{time}</p>
                </div>
                <span className={`font-semibold ${Number(value) < 0 ? "text-destructive" : "text-success"}`}>
                  {Number(value) < 0 ? "−" : "+"}
                  {brl(Math.abs(Number(value)))}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
