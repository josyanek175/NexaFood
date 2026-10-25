import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, Settings2 } from "lucide-react";
import { api } from "@/services/api";
import { establishments } from "@/data/demo";
import { timeAgo } from "@/lib/format";
import { DemoNotice, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { IntegrationStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/integracoes")({
  component: IntegrationsPage,
});

const STATUS: Record<IntegrationStatus, { label: string; className: string }> = {
  conectado: { label: "Conectado", className: "bg-success/15 text-success" },
  em_configuracao: { label: "Em configuração", className: "bg-warning/20 text-warning-foreground" },
  erro: { label: "Erro", className: "bg-destructive/12 text-destructive" },
  nao_configurado: { label: "Não configurado", className: "bg-muted text-muted-foreground" },
};

function IntegrationsPage() {
  const est = establishments[0]!;
  const { data } = useQuery({ queryKey: ["integrations", est.id], queryFn: () => api.listIntegrations(est.id) });

  return (
    <>
      <PageHeader
        title="Integrações"
        description="iFood, 99Food, WhatsApp, Pix, gateway de pagamento e emissor fiscal."
      />
      <DemoNotice>
        as telas de conexão estão prontas; as credenciais reais serão armazenadas com segurança no Lovable Cloud.
      </DemoNotice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((i) => {
          const s = STATUS[i.status];
          return (
            <article key={i.id} className="surface-card flex flex-col p-5">
              <header className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold">{i.name}</h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${s.className}`}>{s.label}</span>
              </header>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{i.description}</p>

              {i.external_id && <p className="mt-3 text-xs text-muted-foreground">ID externo: {i.external_id}</p>}
              {i.last_sync_at && (
                <p className="text-xs text-muted-foreground">Última sincronização há {timeAgo(i.last_sync_at)}</p>
              )}
              {i.errors.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-xl bg-destructive/8 p-3 text-xs text-destructive">
                  {i.errors.map((e) => (
                    <li key={e} className="flex gap-1.5">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {e}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  variant={i.status === "conectado" ? "secondary" : "default"}
                  onClick={() => toast.info(`Configuração de ${i.name} (demonstração)`)}
                >
                  <Settings2 className="mr-1.5 size-4" />
                  {i.status === "conectado" ? "Gerenciar" : "Conectar"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-full"
                  aria-label={`Sincronizar ${i.name}`}
                  onClick={() => toast.success(`${i.name} sincronizado (demonstração)`)}
                >
                  {i.status === "conectado" ? <RefreshCw className="size-4" /> : <CheckCircle2 className="size-4" />}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
