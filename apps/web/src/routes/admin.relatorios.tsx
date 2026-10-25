import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/services/api";
import { establishments } from "@/data/demo";
import { brl } from "@/lib/format";
import { DemoNotice, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/relatorios")({
  component: ReportsPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function ReportsPage() {
  const est = establishments[0]!;
  const { data } = useQuery({ queryKey: ["analytics", est.id], queryFn: () => api.analytics(est.id) });

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Vendas por período, produtos mais vendidos, canais e horários de pico."
        action={
          <Button variant="secondary" className="rounded-full" onClick={() => toast.success("Relatório exportado (demonstração)")}>
            <Download className="mr-1.5 size-4" /> Exportar
          </Button>
        }
      />
      <DemoNotice>gráficos alimentados pela camada de serviços com dados simulados.</DemoNotice>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Curva de vendas por horário">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.salesByHour ?? []}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Area type="monotone" dataKey="vendas" stroke="var(--primary)" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel title="Participação por canal">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.salesByChannel ?? []} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={3}>
                  {(data?.salesByChannel ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={60} iconType="circle" />
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Produtos mais vendidos">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Produto</th>
                  <th className="p-2">Quantidade</th>
                  <th className="p-2">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.topProducts ?? []).map((p, i) => (
                  <tr key={p.name}>
                    <td className="p-2 font-bold text-muted-foreground">{i + 1}</td>
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2">{p.qty}</td>
                    <td className="p-2 font-semibold">{brl(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
