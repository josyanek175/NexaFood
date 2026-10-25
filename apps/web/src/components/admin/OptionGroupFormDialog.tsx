import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { AdminOptionGroup } from "@nexafood/shared";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/api-client";
import { createOptionGroup, getOptionGroup, updateOptionGroup } from "@/services/option-groups-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  open: boolean;
  groupId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

type ItemDraft = {
  key: string;
  id?: string | undefined;
  name: string;
  price: string;
  available: boolean;
};

type FormState = {
  name: string;
  required: boolean;
  minSelect: string;
  maxSelect: string;
  selection: "single" | "multiple";
  position: string;
  active: boolean;
  items: ItemDraft[];
};

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `oi-${keySeq}`;
}

function emptyForm(): FormState {
  return {
    name: "",
    required: false,
    minSelect: "0",
    maxSelect: "1",
    selection: "single",
    position: "0",
    active: true,
    items: [],
  };
}

function fromGroup(g: AdminOptionGroup): FormState {
  return {
    name: g.name,
    required: g.required,
    minSelect: String(g.minSelect),
    maxSelect: String(g.maxSelect),
    selection: g.selection,
    position: String(g.position),
    active: g.active,
    items: [...g.items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        key: i.id,
        id: i.id,
        name: i.name,
        price: String(i.price),
        available: i.available,
      })),
  };
}

export function OptionGroupFormDialog({ open, groupId, onOpenChange, onSaved }: Props) {
  const isEdit = Boolean(groupId);
  const [form, setForm] = useState<FormState>(emptyForm);

  const detail = useQuery({
    queryKey: ["admin-option-group", groupId],
    queryFn: () => getOptionGroup(groupId!),
    enabled: open && Boolean(groupId),
  });

  useEffect(() => {
    if (!open) return;
    if (!groupId) {
      setForm(emptyForm());
      return;
    }
    if (detail.data) setForm(fromGroup(detail.data));
  }, [open, groupId, detail.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("VALIDATION_NAME");
      const minSelect = Number(form.minSelect);
      const maxSelect = Number(form.maxSelect);
      const position = Number(form.position);
      if (!Number.isInteger(minSelect) || minSelect < 0) throw new Error("VALIDATION_MIN");
      if (!Number.isInteger(maxSelect) || maxSelect < 1) throw new Error("VALIDATION_MAX");
      if (minSelect > maxSelect) throw new Error("VALIDATION_RANGE");
      if (!Number.isInteger(position) || position < 0) throw new Error("VALIDATION_POSITION");

      for (const item of form.items) {
        if (!item.name.trim()) throw new Error("VALIDATION_ITEM_NAME");
        const price = Number(String(item.price).replace(",", "."));
        if (!Number.isFinite(price) || price < 0) throw new Error("VALIDATION_ITEM_PRICE");
      }

      const payload = {
        name: form.name.trim(),
        required: form.required,
        minSelect,
        maxSelect,
        selection: form.selection,
        position,
        active: form.active,
        items: form.items.map((item, index) => ({
          ...(item.id ? { id: item.id } : {}),
          name: item.name.trim(),
          price: Number(String(item.price).replace(",", ".")),
          available: item.available,
          position: index,
        })),
      };

      if (groupId) return updateOptionGroup(groupId, payload);
      return createOptionGroup(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Grupo atualizado." : "Grupo criado.");
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => {
      const map: Record<string, string> = {
        VALIDATION_NAME: "Informe o nome do grupo.",
        VALIDATION_MIN: "Mínimo inválido.",
        VALIDATION_MAX: "Máximo inválido.",
        VALIDATION_RANGE: "Mínimo não pode ser maior que o máximo.",
        VALIDATION_POSITION: "Posição inválida.",
        VALIDATION_ITEM_NAME: "Todo item precisa de nome.",
        VALIDATION_ITEM_PRICE: "Preço de item inválido.",
      };
      if (error instanceof Error && map[error.message]) {
        toast.error(map[error.message]);
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao salvar grupo.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>{isEdit ? "Editar adicionais" : "Novo grupo de adicionais"}</DialogTitle>
          <DialogDescription>
            Crie grupos reutilizáveis (ex.: ponto da carne, extras) e vincule nos produtos.
          </DialogDescription>
        </DialogHeader>

        {isEdit && detail.isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="space-y-1.5">
                <Label>Nome do grupo</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Extras"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Seleção</Label>
                  <Select
                    value={form.selection}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, selection: v as "single" | "multiple" }))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Única</SelectItem>
                      <SelectItem value="multiple">Múltipla</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Mínimo</Label>
                  <Input
                    value={form.minSelect}
                    onChange={(e) => setForm((f) => ({ ...f, minSelect: e.target.value }))}
                    inputMode="numeric"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Máximo</Label>
                  <Input
                    value={form.maxSelect}
                    onChange={(e) => setForm((f) => ({ ...f, maxSelect: e.target.value }))}
                    inputMode="numeric"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Obrigatório</p>
                    <p className="text-xs text-muted-foreground">Cliente precisa escolher.</p>
                  </div>
                  <Switch
                    checked={form.required}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Grupo ativo</p>
                    <p className="text-xs text-muted-foreground">Visível no cardápio.</p>
                  </div>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Itens do grupo</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        items: [
                          ...f.items,
                          { key: nextKey(), name: "", price: "0", available: true },
                        ],
                      }))
                    }
                  >
                    <Plus className="mr-1 size-4" />
                    Item
                  </Button>
                </div>
                {form.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum item ainda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {form.items.map((item, index) => (
                      <li
                        key={item.key}
                        className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_6rem_auto_auto]"
                      >
                        <Input
                          value={item.name}
                          onChange={(e) => {
                            const items = [...form.items];
                            items[index] = { ...item, name: e.target.value };
                            setForm((f) => ({ ...f, items }));
                          }}
                          placeholder="Nome"
                          className="h-10 rounded-xl"
                        />
                        <Input
                          value={item.price}
                          onChange={(e) => {
                            const items = [...form.items];
                            items[index] = { ...item, price: e.target.value };
                            setForm((f) => ({ ...f, items }));
                          }}
                          inputMode="decimal"
                          placeholder="0"
                          className="h-10 rounded-xl"
                        />
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.available}
                            onCheckedChange={(v) => {
                              const items = [...form.items];
                              items[index] = { ...item, available: v };
                              setForm((f) => ({ ...f, items }));
                            }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.available ? "OK" : "Off"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 rounded-full text-destructive"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              items: f.items.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                className="rounded-full"
                disabled={save.isPending}
                onClick={() => {
                  if (!save.isPending) save.mutate();
                }}
              >
                {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Salvar grupo
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
