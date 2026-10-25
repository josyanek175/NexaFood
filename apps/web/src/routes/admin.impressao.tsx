import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer as PrinterIcon } from "lucide-react";
import { api } from "@/services/api";
import { establishments } from "@/data/demo";
import { DemoNotice, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/impressao")({
  component: PrintingPage,
});

const TRIGGERS: Record<string, string> = {
  ao_receber: "Ao receber o pedido",
  ao_confirmar: "Ao confirmar o pedido",
  manual: "Somente manual",
};

function PrintingPage() {
  const est = establishments[0]!;
  const { data } = useQuery({ queryKey: ["printers", est.id], queryFn: () => api.listPrinters(est.id) });

  return (
    <>
      <PageHeader title="Impressão" description="Impressoras térmicas por setor, cópias e disparo automático." />
      <DemoNotice>o layout da comanda 58mm/80mm é pré-visualizado ao lado.</DemoNotice>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {(data ?? []).map((p) => (
            <article key={p.id} className="surface-card p-5">
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <PrinterIcon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-bold">{p.name}</h3>
                    <p className="text-xs capitalize text-muted-foreground">
                      {p.connection} • {p.width} • setor {p.sector}
                    </p>
                  </div>
                </div>
                <Switch defaultChecked={p.auto_print} aria-label={`Impressão automática ${p.name}`} />
              </header>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Cópias</dt>
                  <dd className="font-semibold">{p.copies}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Disparo</dt>
                  <dd className="font-semibold">{TRIGGERS[p.trigger]}</dd>
                </div>
              </dl>
              <Button
                size="sm"
                variant="secondary"
                className="mt-4 rounded-full"
                onClick={() => toast.success(`Teste enviado para ${p.name} (demonstração)`)}
              >
                Imprimir teste
              </Button>
            </article>
          ))}
        </div>

        <Panel title="Pré-visualização da comanda">
          <pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 font-mono text-[11px] leading-relaxed">
{`      ${est.name.toUpperCase()}
--------------------------------
PEDIDO #1042        MESA 07
20:41  •  Cardápio próprio
--------------------------------
2x Hambúrguer Artesanal
   + Bacon crocante
   - sem cebola
1x Chopp Pilsen 500ml
--------------------------------
Subtotal            R$ 105,80
Taxa de serviço     R$  10,58
TOTAL               R$ 116,38
--------------------------------
   Obrigado pela preferência!`}
          </pre>
        </Panel>
      </div>
    </>
  );
}
