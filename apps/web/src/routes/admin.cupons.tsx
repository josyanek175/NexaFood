import { ModulePending } from "@/components/admin/ModulePending";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Ticket } from "lucide-react";
import { api } from "@/services/api";
import { establishments } from "@/data/demo";
import { brl } from "@/lib/format";
import { DemoNotice, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cupons")({
  component: () => <ModulePending title="Cupons" />,
});

export function CouponsPage() {
  const est = establishments[0]!;
  const { data } = useQuery({ queryKey: ["coupons", est.id], queryFn: () => api.listCoupons(est.id) });

  return (
    <>
      <PageHeader
        title="Cupons"
        description="Descontos percentuais ou fixos, com pedido mínimo e controle de uso."
        action={
          <Button className="rounded-full" onClick={() => toast.info("Novo cupom (demonstração)")}>
            <Plus className="mr-1.5 size-4" /> Novo cupom
          </Button>
        }
      />
      <DemoNotice>teste os cupons NEXA10 e FRETEGRATIS no cardápio público.</DemoNotice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((c) => (
          <article key={c.id} className="surface-card p-5">
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Ticket className="size-4" />
                </span>
                <div>
                  <h3 className="font-display font-bold">{c.code}</h3>
                  <p className="text-xs text-muted-foreground">
                    {c.type === "percent" ? `${c.value}% de desconto` : `${brl(c.value)} de desconto`}
                  </p>
                </div>
              </div>
              <Switch defaultChecked={c.active} aria-label={`Ativar ${c.code}`} />
            </header>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Pedido mínimo</dt>
                <dd className="font-semibold">{brl(c.min_order)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Utilizações</dt>
                <dd className="font-semibold">{c.uses}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
