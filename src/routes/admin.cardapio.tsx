import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, GripVertical, LayoutGrid, List, Plus, Search } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/format";
import { DemoNotice, PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cardapio")({
  component: MenuAdmin,
});

function MenuAdmin() {
  const { currentEstablishmentId } = useAuth();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"tabela" | "cards">("cards");
  const { data, isLoading } = useQuery({
    queryKey: ["menu", currentEstablishmentId],
    queryFn: () => api.getMenu(currentEstablishmentId!),
    enabled: Boolean(currentEstablishmentId),
  });

  const products = (data?.products ?? []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Cardápio"
        description="Categorias, produtos e grupos de complementos reutilizáveis."
        action={
          <Button className="rounded-full" onClick={() => toast.info("Formulário de novo produto (demonstração)")}>
            <Plus className="mr-1.5 size-4" /> Novo produto
          </Button>
        }
      />
      <DemoNotice>o cardápio da Nexa Burger é carregado pela camada de serviços e será persistido no Lovable Cloud.</DemoNotice>

      <Tabs defaultValue="produtos">
        <TabsList className="rounded-full">
          <TabsTrigger value="produtos" className="rounded-full">Produtos</TabsTrigger>
          <TabsTrigger value="categorias" className="rounded-full">Categorias</TabsTrigger>
          <TabsTrigger value="complementos" className="rounded-full">Complementos</TabsTrigger>
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
            <div className="flex rounded-full border p-0.5">
              <button
                onClick={() => setView("cards")}
                aria-label="Ver em cards"
                className={`rounded-full p-2 ${view === "cards" ? "bg-primary text-primary-foreground" : ""}`}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setView("tabela")}
                aria-label="Ver em tabela"
                className={`rounded-full p-2 ${view === "tabela" ? "bg-primary text-primary-foreground" : ""}`}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          )}

          {!isLoading && view === "cards" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <article key={p.id} className="surface-card animate-rise overflow-hidden">
                  <img src={p.image_url} alt={p.name} width={800} height={600} loading="lazy" className="h-36 w-full object-cover" />
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-bold">{p.name}</h3>
                      <Switch defaultChecked={p.available} aria-label="Disponível" />
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-primary">{brl(p.promo_price ?? p.price)}</span>
                      {p.promo_price && <span className="text-xs text-muted-foreground line-through">{brl(p.price)}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <Tag>{p.sku}</Tag>
                      <Tag>{p.prep_minutes} min</Tag>
                      <Tag>setor: {p.sector}</Tag>
                      {p.featured && <Tag highlight>Destaque</Tag>}
                      {p.track_stock && <Tag>{p.stock} em estoque</Tag>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="secondary" className="flex-1 rounded-full" onClick={() => toast.info("Edição de produto (demonstração)")}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => toast.success(`${p.name} duplicado (demonstração)`)}>
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!isLoading && view === "tabela" && (
            <div className="surface-card overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Produto</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Preço</th>
                    <th className="p-3">Setor</th>
                    <th className="p-3">Preparo</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-muted-foreground">
                        {data?.categories.find((c) => c.id === p.category_id)?.name}
                      </td>
                      <td className="p-3">{brl(p.promo_price ?? p.price)}</td>
                      <td className="p-3 capitalize text-muted-foreground">{p.sector}</td>
                      <td className="p-3 text-muted-foreground">{p.prep_minutes} min</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            p.available ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.available ? "✓ Disponível" : "✕ Indisponível"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
          <div className="surface-card divide-y">
            {(data?.categories ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4">
                <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                <span className="flex-1 font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">posição {c.position + 1}</span>
                <Switch defaultChecked={c.active} aria-label={`Ativar ${c.name}`} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="complementos" className="mt-4 grid gap-4 lg:grid-cols-2">
          {(data?.optionGroups ?? []).map((g) => (
            <article key={g.id} className="surface-card p-5">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{g.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {g.required ? "Obrigatório" : "Opcional"} • mín. {g.min} / máx. {g.max} • seleção{" "}
                    {g.selection === "single" ? "única" : "múltipla"}
                  </p>
                </div>
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => toast.info("Edição de grupo (demonstração)")}>
                  Editar
                </Button>
              </header>
              <ul className="mt-3 divide-y text-sm">
                {g.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2">
                    <span className={i.available ? "" : "text-muted-foreground line-through"}>{i.name}</span>
                    <span className="font-medium">{i.price > 0 ? brl(i.price) : "Grátis"}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </TabsContent>
      </Tabs>
    </>
  );
}

function Tag({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-semibold ${
        highlight ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}
