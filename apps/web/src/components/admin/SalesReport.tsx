import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fetchOrders, computeAnalytics } from "@/services/orders";
import { filterSalesPeriod, localDateKey, salesCsv, salesTotals } from "@/lib/sales-report";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard } from "./ui";

export function SalesReport({ title }: { title: string }) {
  const { currentEstablishmentId } = useAuth();
  const [from, setFrom] = useState(() => localDateKey(new Date()));
  const [to, setTo] = useState(() => localDateKey(new Date()));
  const { data = [], isPending, error } = useQuery({ queryKey: ["orders", currentEstablishmentId], queryFn: () => fetchOrders(currentEstablishmentId!), enabled: Boolean(currentEstablishmentId) });
  const selected = filterSalesPeriod(data, from, to);
  const totals = salesTotals(selected);
  const analytics = computeAnalytics(selected);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([salesCsv(selected)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `pedidos-${from}-${to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <PageHeader title={title} description="Resumo dos pedidos reais do estabelecimento selecionado." action={<Button onClick={exportCsv} disabled={!selected.length || Boolean(error)}>Exportar CSV</Button>} />
    <div className="mb-5 flex flex-wrap gap-4">
      <label>De<input className="ml-2 rounded border p-2" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>Até<input className="ml-2 rounded border p-2" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
    </div>
    {!currentEstablishmentId ? <p role="status">Selecione um estabelecimento.</p> : error ? <p role="alert">Não foi possível carregar os pedidos. Tente novamente.</p> : isPending ? <p role="status">Carregando pedidos…</p> : <>
      {from > to && <p role="alert">A data inicial deve ser anterior à data final.</p>}
      <p className="mb-4 text-sm text-muted-foreground">Consulta limitada aos últimos 200 pedidos. Valores representam pedidos, sem conciliação de recebimentos, custos ou comissões.</p>
      {data.length >= 200 && <p role="alert" className="mb-4">O limite da consulta foi atingido. Este resumo pode não incluir todo o período escolhido.</p>}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Valor dos pedidos" value={brl(totals.value)} hint="Cancelados excluídos" />
        <StatCard label="Pedidos válidos" value={String(totals.count)} />
        <StatCard label="Ticket médio" value={brl(totals.average)} />
        <StatCard label="Cancelados" value={String(totals.canceled)} />
      </div>
      {!selected.length ? <p role="status">Nenhum pedido carregado neste período.</p> : <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pedidos por forma de pagamento"><ul>{analytics.paymentsBreakdown.map(p => <li key={p.method} className="flex justify-between py-2"><span>{p.method}</span><strong>{brl(p.value)}</strong></li>)}</ul></Panel>
        <Panel title="Produtos mais vendidos"><ul>{analytics.topProducts.map(p => <li key={p.name} className="flex justify-between py-2"><span>{p.name} · {p.qty} un.</span><strong>{brl(p.revenue)}</strong></li>)}</ul></Panel>
      </div>}
    </>}
  </>;
}
