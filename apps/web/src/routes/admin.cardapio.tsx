import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, Star } from "lucide-react";
import type { AdminCategory, AdminOptionGroup, AdminProduct } from "@nexafood/shared";
import { api } from "@/services/api";
import { listCategories, updateCategory } from "@/services/categories-api";
import { listOptionGroups, updateOptionGroup } from "@/services/option-groups-api";
import { listProducts } from "@/services/products-api";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";
import { CategoryFormDialog } from "@/components/admin/CategoryFormDialog";
import { OptionGroupFormDialog } from "@/components/admin/OptionGroupFormDialog";
import { ProductFormDialog } from "@/components/admin/ProductFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/api-client";

export const Route = createFileRoute("/admin/cardapio")({
  component: MenuAdmin,
});

type ActiveFilter = "all" | "true" | "false";
type AvailableFilter = "all" | "true" | "false";

function MenuAdmin() {
  const { currentEstablishmentId } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [availableFilter, setAvailableFilter] = useState<AvailableFilter>("all");
  const [view, setView] = useState<"tabela" | "cards">("cards");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const menuQuery = useQuery({
    queryKey: ["admin-menu", currentEstablishmentId],
    queryFn: () => api.getAdminMenuByEstablishmentId(currentEstablishmentId!),
    enabled: Boolean(currentEstablishmentId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories", currentEstablishmentId],
    queryFn: () => listCategories(),
    enabled: Boolean(currentEstablishmentId),
  });

  const optionGroupsQuery = useQuery({
    queryKey: ["admin-option-groups", currentEstablishmentId],
    queryFn: () => listOptionGroups(),
    enabled: Boolean(currentEstablishmentId),
  });

  const productFilters = useMemo(
    () => ({
      q: query.trim() || undefined,
      categoryId: categoryId === "all" ? undefined : categoryId,
      active: activeFilter === "all" ? undefined : activeFilter === "true",
      available: availableFilter === "all" ? undefined : availableFilter === "true",
    }),
    [query, categoryId, activeFilter, availableFilter],
  );

  const productsQuery = useQuery({
    queryKey: ["admin-products", currentEstablishmentId, productFilters],
    queryFn: () => listProducts(productFilters),
    enabled: Boolean(currentEstablishmentId),
  });

  const categories = categoriesQuery.data ?? [];
  const optionGroupsAdmin = optionGroupsQuery.data ?? [];
  const optionGroupsForProduct = menuQuery.data?.optionGroups ?? [];
  const sectors = menuQuery.data?.kitchenSectors ?? [];
  const products = productsQuery.data ?? [];
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  const toggleCategory = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateCategory(id, { active }),
    onSuccess: () => {
      invalidateCatalog();
      toast.success("Categoria atualizada.");
    },
    onError: (e: Error) =>
      toast.error(e instanceof ApiClientError ? e.message : "Falha ao atualizar categoria."),
  });

  const toggleGroup = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateOptionGroup(id, { active }),
    onSuccess: () => {
      invalidateCatalog();
      toast.success("Grupo atualizado.");
    },
    onError: (e: Error) =>
      toast.error(e instanceof ApiClientError ? e.message : "Falha ao atualizar grupo."),
  });

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  function invalidateCatalog() {
    void queryClient.invalidateQueries({ queryKey: ["admin-products", currentEstablishmentId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-menu", currentEstablishmentId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-categories", currentEstablishmentId] });
    void queryClient.invalidateQueries({
      queryKey: ["admin-option-groups", currentEstablishmentId],
    });
  }

  return (
    <>
      <PageHeader
        title="Cardápio"
        description="Categorias, produtos e grupos de complementos reutilizáveis."
        action={
          <Button className="rounded-full" onClick={openCreate}>
            <Plus className="mr-1.5 size-4" /> Novo produto
          </Button>
        }
      />

      <Tabs defaultValue="produtos">
        <TabsList className="rounded-full">
          <TabsTrigger value="produtos" className="rounded-full">
            Produtos
          </TabsTrigger>
          <TabsTrigger value="categorias" className="rounded-full">
            Categorias
          </TabsTrigger>
          <TabsTrigger value="complementos" className="rounded-full">
            Complementos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto"
                className="h-10 rounded-full pl-9"
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-10 w-[160px] rounded-full">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActiveFilter)}>
              <SelectTrigger className="h-10 w-[140px] rounded-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ativo/Inativo</SelectItem>
                <SelectItem value="true">Somente ativos</SelectItem>
                <SelectItem value="false">Somente inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={availableFilter}
              onValueChange={(v) => setAvailableFilter(v as AvailableFilter)}
            >
              <SelectTrigger className="h-10 w-[150px] rounded-full">
                <SelectValue placeholder="Disponibilidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Disp./Esgotado</SelectItem>
                <SelectItem value="true">Disponíveis</SelectItem>
                <SelectItem value="false">Esgotados</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-full border p-0.5">
              <button
                type="button"
                onClick={() => setView("cards")}
                aria-label="Ver em cards"
                className={`rounded-full p-2 ${view === "cards" ? "bg-primary text-primary-foreground" : ""}`}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("tabela")}
                aria-label="Ver em tabela"
                className={`rounded-full p-2 ${view === "tabela" ? "bg-primary text-primary-foreground" : ""}`}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          {productsQuery.isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          )}

          {productsQuery.isError && (
            <div className="surface-card p-6 text-sm text-destructive">
              Não foi possível carregar os produtos. Tente novamente.
            </div>
          )}

          {!productsQuery.isLoading && !productsQuery.isError && products.length === 0 && (
            <div className="surface-card p-10 text-center">
              <p className="font-medium">Nenhum produto encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajuste os filtros ou cadastre o primeiro item do cardápio.
              </p>
              <Button className="mt-4 rounded-full" onClick={openCreate}>
                <Plus className="mr-1.5 size-4" /> Novo produto
              </Button>
            </div>
          )}

          {!productsQuery.isLoading && view === "cards" && products.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <article key={p.id} className="surface-card animate-rise overflow-hidden">
                  <div className="relative h-36 bg-muted">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        width={800}
                        height={600}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-muted-foreground">
                        Sem imagem
                      </div>
                    )}
                    {p.featured && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold">
                        <Star className="size-3 text-primary" /> Destaque
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-bold">{p.name}</h3>
                      <StatusBadges product={p} />
                    </div>
                    <p className="text-xs text-muted-foreground">{categoryName(p.categoryId)}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-primary">{brl(p.promoPrice ?? p.price)}</span>
                      {p.promoPrice != null && (
                        <span className="text-xs text-muted-foreground line-through">
                          {brl(p.price)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 rounded-full"
                        onClick={() => openEdit(p.id)}
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!productsQuery.isLoading && view === "tabela" && products.length > 0 && (
            <div className="surface-card overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Produto</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Preço</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Disponibilidade</th>
                    <th className="p-3">Destaque</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="size-10 overflow-hidden rounded-lg bg-muted">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="size-full object-cover" />
                            ) : null}
                          </div>
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{categoryName(p.categoryId)}</td>
                      <td className="p-3">{brl(p.promoPrice ?? p.price)}</td>
                      <td className="p-3">
                        <BadgeTone tone={p.active ? "success" : "muted"}>
                          {p.active ? "Ativo" : "Inativo"}
                        </BadgeTone>
                      </td>
                      <td className="p-3">
                        <BadgeTone tone={!p.active ? "muted" : p.available ? "success" : "warn"}>
                          {!p.active ? "—" : p.available ? "Disponível" : "Esgotado"}
                        </BadgeTone>
                      </td>
                      <td className="p-3">{p.featured ? "Sim" : "Não"}</td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-full"
                          onClick={() => openEdit(p.id)}
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categorias" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              className="rounded-full"
              onClick={() => {
                setEditingCategory(null);
                setCategoryFormOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Nova categoria
            </Button>
          </div>
          {categoriesQuery.isLoading && <Skeleton className="h-40 rounded-2xl" />}
          {!categoriesQuery.isLoading && categories.length === 0 && (
            <div className="surface-card p-8 text-center text-sm text-muted-foreground">
              Nenhuma categoria cadastrada.
            </div>
          )}
          <div className="surface-card divide-y">
            {categories.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    posição {c.position + 1}
                    {c.availableFrom || c.availableTo
                      ? ` • ${c.availableFrom ?? "—"} às ${c.availableTo ?? "—"}`
                      : ""}
                  </p>
                </div>
                <Switch
                  checked={c.active}
                  onCheckedChange={(active) => toggleCategory.mutate({ id: c.id, active })}
                  aria-label={`Ativar ${c.name}`}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => {
                    setEditingCategory(c);
                    setCategoryFormOpen(true);
                  }}
                >
                  Editar
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="complementos" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              className="rounded-full"
              onClick={() => {
                setEditingGroupId(null);
                setGroupFormOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Novo grupo
            </Button>
          </div>
          {optionGroupsQuery.isLoading && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
            </div>
          )}
          {!optionGroupsQuery.isLoading && optionGroupsAdmin.length === 0 && (
            <div className="surface-card p-8 text-center text-sm text-muted-foreground">
              Nenhum grupo de adicionais cadastrado.
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {optionGroupsAdmin.map((g: AdminOptionGroup) => (
              <article key={g.id} className="surface-card p-5">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{g.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {g.required ? "Obrigatório" : "Opcional"} • mín. {g.minSelect} / máx.{" "}
                      {g.maxSelect} • seleção {g.selection === "single" ? "única" : "múltipla"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={g.active}
                      onCheckedChange={(active) => toggleGroup.mutate({ id: g.id, active })}
                      aria-label={`Ativar ${g.name}`}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => {
                        setEditingGroupId(g.id);
                        setGroupFormOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </header>
                <ul className="mt-3 divide-y text-sm">
                  {g.items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-2">
                      <span className={i.available ? "" : "text-muted-foreground line-through"}>
                        {i.name}
                      </span>
                      <span className="font-medium">{i.price > 0 ? brl(i.price) : "Grátis"}</span>
                    </li>
                  ))}
                  {g.items.length === 0 && (
                    <li className="py-2 text-xs text-muted-foreground">Sem itens</li>
                  )}
                </ul>
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <ProductFormDialog
        open={formOpen}
        productId={editingId}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        sectors={sectors}
        optionGroups={optionGroupsForProduct}
        onOpenChange={setFormOpen}
        onSaved={invalidateCatalog}
      />

      <CategoryFormDialog
        open={categoryFormOpen}
        category={editingCategory}
        onOpenChange={setCategoryFormOpen}
        onSaved={invalidateCatalog}
      />

      <OptionGroupFormDialog
        open={groupFormOpen}
        groupId={editingGroupId}
        onOpenChange={setGroupFormOpen}
        onSaved={invalidateCatalog}
      />
    </>
  );
}

function StatusBadges({ product }: { product: AdminProduct }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <BadgeTone tone={product.active ? "success" : "muted"}>
        {product.active ? "Ativo" : "Inativo"}
      </BadgeTone>
      {product.active && (
        <BadgeTone tone={product.available ? "success" : "warn"}>
          {product.available ? "Disponível" : "Esgotado"}
        </BadgeTone>
      )}
    </div>
  );
}

function BadgeTone({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warn" | "muted";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-bold",
        tone === "success" && "bg-success/15 text-success",
        tone === "warn" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
