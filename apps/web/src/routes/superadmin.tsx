import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, CreditCard, Users } from "lucide-react";
import { api } from "@/services/api";
import { brl } from "@/lib/format";
import { DemoNotice, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RequireAuth } from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/superadmin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Superadministrador — NexaCardápio" },
      { name: "description", content: "Gestão de estabelecimentos, planos e assinaturas da plataforma NexaCardápio." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Superadministrador — NexaCardápio" },
      { property: "og:description", content: "Painel global de estabelecimentos e assinaturas." },
    ],
  }),
  component: SuperAdminRoute,
});

function SuperAdminRoute() {
  return (
    <RequireAuth platformAdmin>
      <SuperAdmin />
    </RequireAuth>
  );
}

const PLAN_LABEL: Record<string, string> = {
  starter: "Essencial",
  pro: "Profissional",
  enterprise: "Avançado",
};

function SuperAdmin() {
  const { data } = useQuery({ queryKey: ["establishments"], queryFn: () => api.listEstablishments() });
  const list = data ?? [];
  const mrr = list.length * 189;

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar ao painel do estabelecimento
        </Link>

        <PageHeader
          title="Superadministrador"
          description="Visão global da plataforma: estabelecimentos, planos, assinaturas e suporte."
        />
        <DemoNotice>este painel é exclusivo da operação NexaCardápio e não acessa dados operacionais sem permissão.</DemoNotice>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Estabelecimentos ativos" value={String(list.length)} trend={9.2} hint="no mês" icon={<Building2 className="size-4" />} />
          <StatCard label="Receita recorrente (MRR)" value={brl(mrr)} trend={14.7} hint="no mês" icon={<CreditCard className="size-4" />} />
          <StatCard label="Usuários da plataforma" value="38" hint="entre todos os planos" icon={<Users className="size-4" />} />
        </div>

        <div className="mt-4">
          <Panel title="Estabelecimentos">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Link público</th>
                    <th className="p-2">Plano</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/40">
                      <td className="p-2 font-medium">{e.name}</td>
                      <td className="p-2 text-muted-foreground">/{e.slug}</td>
                      <td className="p-2">{PLAN_LABEL[e.plan] ?? e.plan}</td>
                      <td className="p-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            e.status === "ativo" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="secondary" className="rounded-full" onClick={() => toast.info(`Gestão de ${e.name} (demonstração)`)}>
                          Gerenciar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {[
            ["Essencial", "R$ 129/mês", "Cardápio digital, pedidos e relatórios básicos"],
            ["Profissional", "R$ 189/mês", "Mesas, KDS, cupons, entregas e integrações"],
            ["Avançado", "R$ 299/mês", "Multiunidade, fiscal, API e suporte prioritário"],
          ].map(([name, price, desc]) => (
            <article key={name} className="surface-card p-5">
              <h3 className="font-display text-lg font-bold">{name}</h3>
              <p className="mt-1 text-2xl font-bold text-primary">{price}</p>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
