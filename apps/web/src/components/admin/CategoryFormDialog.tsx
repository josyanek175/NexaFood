import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { AdminCategory } from "@nexafood/shared";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/api-client";
import { createCategory, updateCategory } from "@/services/categories-api";
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
import { Switch } from "@/components/ui/switch";

type Props = {
  open: boolean;
  category: AdminCategory | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

type FormState = {
  name: string;
  position: string;
  active: boolean;
  availableFrom: string;
  availableTo: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    position: "0",
    active: true,
    availableFrom: "",
    availableTo: "",
  };
}

function fromCategory(c: AdminCategory): FormState {
  return {
    name: c.name,
    position: String(c.position),
    active: c.active,
    availableFrom: c.availableFrom ?? "",
    availableTo: c.availableTo ?? "",
  };
}

export function CategoryFormDialog({ open, category, onOpenChange, onSaved }: Props) {
  const isEdit = Boolean(category);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!open) return;
    setForm(category ? fromCategory(category) : emptyForm());
  }, [open, category]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("VALIDATION_NAME");
      const position = Number(form.position);
      if (!Number.isInteger(position) || position < 0) throw new Error("VALIDATION_POSITION");

      const payload = {
        name: form.name.trim(),
        position,
        active: form.active,
        availableFrom: form.availableFrom.trim() || null,
        availableTo: form.availableTo.trim() || null,
      };

      if (category) return updateCategory(category.id, payload);
      return createCategory(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Categoria atualizada." : "Categoria criada.");
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message.startsWith("VALIDATION_")) {
        toast.error(
          error.message === "VALIDATION_NAME"
            ? "Informe o nome da categoria."
            : "Posição inválida.",
        );
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Falha ao salvar categoria.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>
            Organize os produtos do cardápio. Categorias inativas não aparecem no público.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Burgers"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Posição</Label>
            <Input
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              inputMode="numeric"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Disponível de</Label>
              <Input
                value={form.availableFrom}
                onChange={(e) => setForm((f) => ({ ...f, availableFrom: e.target.value }))}
                placeholder="18:00"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Disponível até</Label>
              <Input
                value={form.availableTo}
                onChange={(e) => setForm((f) => ({ ...f, availableTo: e.target.value }))}
                placeholder="23:00"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Categoria ativa</p>
              <p className="text-xs text-muted-foreground">Aparece no cardápio público.</p>
            </div>
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
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
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
