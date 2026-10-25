import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DollarSign, ShoppingBag, TrendingUp, CookingPot, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { computeAnalytics, fetchOrders } from "@/services/orders";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { brl } from "@/lib/format";
import { Panel, PageHeader, StatCard } from "@/components/admin/ui";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Dashboard() {
  const { currentEstablishmentId: estId } = useAuth();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", estId],
    queryFn: () => fetchOrders(estId!),
    enabled: Boolean(estId),
  });
  useRealtimeOrders(estId);

  const data = computeAnalytics(orders ?? []);

  const preparing = orders?.filter((o) => o.status === "preparando").length ?? 0;
  const canceled = orders?.filter((o) => o.status === "cancelado").length ?? 0;
  const revenue = orders?.filter((o) => o.status !== "cancelado").reduce((s, o) => s + o.total, 0) ?? 0;
  const count = orders?.filter(o => o.status !== "cancelado").length ?? 0;


  return (
    <>
      <PageHeader title="Visão geral" description="Resumo dos últimos pedidos carregados (até 200)." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Valor dos pedidos" value={brl(revenue)} hint="Pedidos carregados" icon={<DollarSign className="size-4" />} />
        <StatCard label="Pedidos" value={String(count)} hint="Pedidos carregados" icon={<ShoppingBag className="size-4" />} />
        <StatCard label="Ticket médio" value={brl(count ? revenue / count : 0)} hint="Pedidos carregados" icon={<TrendingUp className="size-4" />} />
        <StatCard label="Em preparação" value={String(preparing)} hint="na cozinha agora" icon={<CookingPot className="size-4" />} />
        <StatCard label="Cancelados" value={String(canceled)} hint="Pedidos carregados" icon={<XCircle className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Vendas por horário">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.salesByHour ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Bar dataKey="vendas" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        <Panel title="Origem dos pedidos">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={data?.salesByChannel ?? []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {(data?.salesByChannel ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1.5 text-sm">
                {(data?.salesByChannel ?? []).map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {c.name}
                    </span>
                    <span className="font-semibold">{c.value}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Produtos mais vendidos">
          <ul className="divide-y">
            {(data?.topProducts ?? []).map((p, i) => (
              <li key={p.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.qty} un.</span>
                <span className="w-24 text-right text-sm font-semibold">{brl(p.revenue)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Formas de pagamento">
          <ul className="space-y-3">
            {(data?.paymentsBreakdown ?? []).map((p, i) => {
              const max = Math.max(...(data?.paymentsBreakdown ?? []).map((x) => x.value));
              return (
                <li key={p.method}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{p.method}</span>
                    <span className="font-semibold">{brl(p.value)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(p.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
