import { createFileRoute } from "@tanstack/react-router";
import { establishments } from "@/data/demo";
import { WEEKDAYS } from "@/lib/format";
import { DemoNotice, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes")({
  component: SettingsPage,
});

const ROLES = [
  ["Administrador", "Acesso total ao estabelecimento"],
  ["Gerente", "Pedidos, cardápio, relatórios e caixa"],
  ["Atendente", "Pedidos, mesas e clientes"],
  ["Cozinha", "Somente o painel KDS"],
  ["Entregador", "Somente entregas atribuídas"],
];

function SettingsPage() {
  const est = establishments[0]!;

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados do estabelecimento, horários, pagamentos, equipe e aparência do cardápio."
        action={
          <Button className="rounded-full" onClick={() => toast.success("Configurações salvas (demonstração)")}>
            Salvar alterações
          </Button>
        }
      />
      <DemoNotice>cada estabelecimento tem configurações isoladas por establishment_id.</DemoNotice>

      <Tabs defaultValue="perfil">
        <TabsList className="rounded-full">
          <TabsTrigger value="perfil" className="rounded-full">Perfil</TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-full">Horários</TabsTrigger>
          <TabsTrigger value="pagamentos" className="rounded-full">Pagamentos</TabsTrigger>
          <TabsTrigger value="equipe" className="rounded-full">Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Dados do estabelecimento">
            <div className="space-y-4">
              <Field label="Nome" defaultValue={est.name} />
              <Field label="CNPJ" defaultValue={est.cnpj} />
              <Field label="Telefone" defaultValue={est.whatsapp} />
              <Field label="Endereço" defaultValue={est.address} />
              <div className="space-y-1.5">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea id="desc" defaultValue={est.description} rows={3} />
              </div>
            </div>
          </Panel>

          <Panel title="Cardápio digital">
            <div className="space-y-4">
              <Field label="Link público" defaultValue={`nexacardapio.app/${est.slug}`} />
              <ToggleRow label="Aceitar pedidos agora" description="Desative para pausar o recebimento." defaultChecked />
              <ToggleRow label="Exibir produtos esgotados" description="Mostrar itens indisponíveis em cinza." />
              <ToggleRow label="Pedido em mesa via QR Code" description="Permitir pedidos direto pela mesa." defaultChecked />
              <ToggleRow label="Taxa de serviço 10%" description="Aplicada apenas em pedidos de mesa." defaultChecked />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="horarios" className="mt-4">
          <Panel title="Horários de funcionamento">
            <ul className="divide-y">
              {WEEKDAYS.map((d, i) => (
                <li key={d} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
                  <span className="truncate font-medium">{d}</span>
                  <div className="flex items-center gap-2">
                    <Input type="time" defaultValue={i === 1 ? "" : "18:00"} className="h-9 w-28 rounded-full" />
                    <span className="text-muted-foreground">às</span>
                    <Input type="time" defaultValue={i === 1 ? "" : "23:30"} className="h-9 w-28 rounded-full" />
                    <Switch defaultChecked={i !== 1} aria-label={`Abrir ${d}`} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Formas aceitas">
            <div className="space-y-4">
              <ToggleRow label="Pix" description="Chave e QR Code dinâmico." defaultChecked />
              <ToggleRow label="Cartão de crédito" description="Online e na entrega." defaultChecked />
              <ToggleRow label="Cartão de débito" description="Maquininha na entrega." defaultChecked />
              <ToggleRow label="Dinheiro" description="Com cálculo de troco." defaultChecked />
              <ToggleRow label="Pagar no caixa" description="Somente pedidos de mesa." defaultChecked />
            </div>
          </Panel>
          <Panel title="Entrega">
            <div className="space-y-4">
              <Field label="Pedido mínimo" defaultValue="R$ 25,00" />
              <Field label="Raio máximo de entrega" defaultValue="6 km" />
              <Field label="Tempo médio de preparo" defaultValue="25 minutos" />
              <ToggleRow label="Frete grátis acima de R$ 120" description="Aplicado automaticamente." />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="equipe" className="mt-4">
          <Panel title="Papéis e permissões">
            <ul className="divide-y">
              {ROLES.map(([role, desc]) => (
                <li key={role} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{role}</p>
                    <p className="truncate text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Button size="sm" variant="secondary" className="rounded-full" onClick={() => toast.info("Gestão de permissões (demonstração)")}>
                    Editar
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue?: string }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} defaultValue={defaultValue} className="h-10 rounded-full" />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked ?? false} aria-label={label} />
    </div>
  );
}
