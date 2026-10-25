import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { EstablishmentSettings, PublicBusinessHour } from "@nexafood/shared";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api-client";
import { WEEKDAYS } from "@/lib/format";
import {
  fetchEstablishmentSettings,
  updateEstablishmentSettings,
} from "@/services/establishment-settings-api";

export const Route = createFileRoute("/admin/configuracoes")({
  component: SettingsPage,
});

const ROLES = [
  ["Administrador", "Acesso total ao estabelecimento"],
  ["Gerente", "Pedidos, cardápio, relatórios e caixa"],
  ["Caixa", "Pedidos, mesas e lançamento no balcão"],
  ["Atendente", "Pedidos, mesas e clientes"],
  ["Cozinha", "Somente o painel KDS"],
  ["Entregador", "Somente entregas atribuídas"],
];

type FormState = {
  name: string;
  legalName: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  description: string;
  logoUrl: string;
  primaryColor: string;
  isOpen: boolean;
  minimumOrder: string;
  estimatedTimeMin: string;
  estimatedTimeMax: string;
  serviceFeePercentage: string;
  businessHours: PublicBusinessHour[];
};

function fromSettings(data: EstablishmentSettings): FormState {
  return {
    name: data.name,
    legalName: data.legalName ?? "",
    cnpj: data.cnpj ?? "",
    phone: data.phone ?? "",
    whatsapp: data.whatsapp ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    description: data.description ?? "",
    logoUrl: data.logoUrl ?? "",
    primaryColor: data.primaryColor,
    isOpen: data.isOpen,
    minimumOrder: String(data.minimumOrder),
    estimatedTimeMin: String(data.estimatedTimeMin),
    estimatedTimeMax: String(data.estimatedTimeMax),
    serviceFeePercentage: String(data.serviceFeePercentage),
    businessHours: data.businessHours.map((hour) => ({ ...hour })),
  };
}

function SettingsPage() {
  const { currentEstablishmentId: estId } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["establishment-settings", estId],
    queryFn: fetchEstablishmentSettings,
    enabled: Boolean(estId),
  });

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados do estabelecimento, horários e operação do cardápio."
      />
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-72 rounded-full" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof ApiClientError ? error.message : "Não foi possível carregar as configurações."}
        </p>
      )}
      {data && estId && <SettingsForm key={estId} initial={data} />}
    </>
  );
}

function SettingsForm({ initial }: { initial: EstablishmentSettings }) {
  const { refreshMemberships } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => fromSettings(initial));

  const save = useMutation({
    mutationFn: () => {
      const minimumOrder = Number(form.minimumOrder.replace(",", "."));
      const estimatedTimeMin = Number(form.estimatedTimeMin);
      const estimatedTimeMax = Number(form.estimatedTimeMax);
      const serviceFeePercentage = Number(form.serviceFeePercentage.replace(",", "."));
      if ([minimumOrder, estimatedTimeMin, estimatedTimeMax, serviceFeePercentage].some((n) => Number.isNaN(n))) {
        throw new Error("VALIDATION_NUMBERS");
      }
      if (!form.name.trim()) throw new Error("VALIDATION_NAME");
      return updateEstablishmentSettings({
        name: form.name.trim(),
        legalName: form.legalName.trim() || null,
        cnpj: form.cnpj.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        primaryColor: form.primaryColor,
        isOpen: form.isOpen,
        minimumOrder,
        estimatedTimeMin,
        estimatedTimeMax,
        serviceFeePercentage,
        businessHours: form.businessHours,
      });
    },
    onSuccess: async (saved) => {
      setForm(fromSettings(saved));
      await qc.invalidateQueries({ queryKey: ["establishment-settings"] });
      await refreshMemberships();
      toast.success("Configurações salvas.");
    },
    onError: (error) => {
      const map: Record<string, string> = {
        VALIDATION_NAME: "Informe o nome do estabelecimento.",
        VALIDATION_NUMBERS: "Revise taxa, pedido mínimo e tempos.",
      };
      if (error instanceof Error && map[error.message]) {
        toast.error(map[error.message]);
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao salvar.");
    },
  });

  function patchHour(weekday: number, patch: Partial<PublicBusinessHour>) {
    setForm((prev) => ({
      ...prev,
      businessHours: prev.businessHours.map((hour) =>
        hour.weekday === weekday ? { ...hour, ...patch } : hour,
      ),
    }));
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button className="rounded-full" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList className="rounded-full">
          <TabsTrigger value="perfil" className="rounded-full">
            Perfil
          </TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-full">
            Horários
          </TabsTrigger>
          <TabsTrigger value="operacao" className="rounded-full">
            Operação
          </TabsTrigger>
          <TabsTrigger value="equipe" className="rounded-full">
            Equipe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Dados do estabelecimento">
            <div className="space-y-4">
              <Field label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} />
              <Field
                label="Razão social"
                value={form.legalName}
                onChange={(legalName) => setForm({ ...form, legalName })}
              />
              <Field label="CNPJ" value={form.cnpj} onChange={(cnpj) => setForm({ ...form, cnpj })} />
              <Field label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
              <Field
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(whatsapp) => setForm({ ...form, whatsapp })}
              />
              <Field label="E-mail" value={form.email} onChange={(email) => setForm({ ...form, email })} />
              <Field
                label="Endereço"
                value={form.address}
                onChange={(address) => setForm({ ...form, address })}
              />
              <div className="space-y-1.5">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  rows={3}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Cardápio digital">
            <div className="space-y-4">
              <Field label="Link público" value={`/${initial.slug}`} readOnly />
              <Field
                label="URL do logo"
                value={form.logoUrl}
                onChange={(logoUrl) => setForm({ ...form, logoUrl })}
              />
              <div className="space-y-1.5">
                <Label htmlFor="color">Cor principal</Label>
                <Input
                  id="color"
                  type="color"
                  value={form.primaryColor}
                  className="h-10 w-24 rounded-full px-2"
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                />
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="horarios" className="mt-4">
          <Panel title="Horários de funcionamento">
            <ul className="divide-y">
              {form.businessHours.map((hour) => (
                <li
                  key={hour.weekday}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3"
                >
                  <span className="truncate font-medium">{WEEKDAYS[hour.weekday]}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={hour.opens}
                      disabled={hour.closed}
                      className="h-9 w-28 rounded-full"
                      onChange={(e) => patchHour(hour.weekday, { opens: e.target.value })}
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={hour.closes}
                      disabled={hour.closed}
                      className="h-9 w-28 rounded-full"
                      onChange={(e) => patchHour(hour.weekday, { closes: e.target.value })}
                    />
                    <Switch
                      checked={!hour.closed}
                      aria-label={`Abrir ${WEEKDAYS[hour.weekday]}`}
                      onCheckedChange={(open) => patchHour(hour.weekday, { closed: !open })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="operacao" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Recebimento de pedidos">
            <div className="space-y-4">
              <ToggleRow
                label="Aceitar pedidos agora"
                description="Desative para pausar o cardápio público."
                checked={form.isOpen}
                onCheckedChange={(isOpen) => setForm({ ...form, isOpen })}
              />
              <Field
                label="Taxa de serviço (%)"
                value={form.serviceFeePercentage}
                onChange={(serviceFeePercentage) => setForm({ ...form, serviceFeePercentage })}
              />
              <p className="text-xs text-muted-foreground">
                Aplicada em pedidos no local (mesa e balcão).
              </p>
            </div>
          </Panel>
          <Panel title="Entrega e preparo">
            <div className="space-y-4">
              <Field
                label="Pedido mínimo (R$)"
                value={form.minimumOrder}
                onChange={(minimumOrder) => setForm({ ...form, minimumOrder })}
              />
              <Field
                label="Tempo mínimo (min)"
                value={form.estimatedTimeMin}
                onChange={(estimatedTimeMin) => setForm({ ...form, estimatedTimeMin })}
              />
              <Field
                label="Tempo máximo (min)"
                value={form.estimatedTimeMax}
                onChange={(estimatedTimeMax) => setForm({ ...form, estimatedTimeMax })}
              />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="equipe" className="mt-4">
          <Panel title="Papéis">
            <ul className="divide-y">
              {ROLES.map(([role, desc]) => (
                <li key={role} className="py-3">
                  <p className="font-semibold">{role}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        readOnly={readOnly}
        className="h-10 rounded-full"
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} aria-label={label} onCheckedChange={onCheckedChange} />
    </div>
  );
}
