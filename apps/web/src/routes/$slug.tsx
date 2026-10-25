import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Clock,
  Info,
  MapPin,
  MessageCircle,
  Search,
  ShoppingBag,
  Star,
  Utensils,
  Bike,
  ShoppingCart,
} from "lucide-react";
import { api } from "@/services/api";
import { CartProvider, useCart } from "@/context/cart";
import { ProductCard, ProductCardSkeleton } from "@/components/public/ProductCard";
import { ProductModal } from "@/components/public/ProductModal";
import { CartSheet } from "@/components/public/CartSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, WEEKDAYS } from "@/lib/format";
import type { Establishment, Product } from "@/lib/types";

export const Route = createFileRoute("/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    mesa: typeof search["mesa"] === "string" ? (search["mesa"] as string) : undefined,
  }),
  loader: async ({ params }) => {
    const establishment = await api.getEstablishmentBySlug(params.slug);
    if (!establishment) throw notFound();
    return { establishment };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.establishment.name ?? "Cardápio digital";
    const description =
      loaderData?.establishment.description ?? "Peça online pelo cardápio digital NexaCardápio.";
    return {
      meta: [
        { title: `${name} — Cardápio online | NexaCardápio` },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: `${name} — Cardápio online` },
        { property: "og:description", content: description.slice(0, 155) },
      ],
    };
  },
  component: () => (
    <CartProvider>
      <PublicMenu />
    </CartProvider>
  ),
});

function PublicMenu() {
  const { establishment } = Route.useLoaderData();
  const { mesa } = Route.useSearch();
  const cart = useCart();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["public-menu", establishment.slug],
    queryFn: () => api.getPublicMenuBySlug(establishment.slug),
  });

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];

  const filtered = useMemo(
    () =>
      products.filter((p) =>
        query ? (p.name + p.description).toLowerCase().includes(query.toLowerCase()) : true,
      ),
    [products, query],
  );

  const featured = filtered.filter((p) => p.featured);

  return (
    <div
      className="min-h-screen bg-background pb-28"
      style={{ ["--brand-hue" as string]: establishment.brand_hue }}
    >
      <Hero establishment={establishment} mesa={mesa} />

      <div className="mx-auto max-w-3xl px-4">
        <div className="sticky top-0 z-30 -mx-4 space-y-3 bg-background/90 px-4 py-3 backdrop-blur">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no cardápio"
              className="h-11 rounded-full pl-9"
            />
          </div>
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-muted"
                }`}
              >
                {c.name}
              </a>
            ))}
          </nav>
        </div>

        {isLoading && (
          <div className="space-y-3 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && featured.length > 0 && !query && (
          <section className="py-4">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Star className="size-4 text-primary" /> Destaques da casa
            </h2>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              {featured.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="group w-56 shrink-0 overflow-hidden rounded-2xl border bg-card text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <img
                    src={p.image_url}
                    alt={p.name}
                    width={800}
                    height={600}
                    loading="lazy"
                    className="h-32 w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="space-y-1 p-3">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{p.description}</p>
                    <p className="pt-1 text-sm font-bold text-primary">{brl(p.promo_price ?? p.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {!isLoading &&
          categories.map((c) => {
            const items = filtered.filter((p) => p.category_id === c.id);
            if (items.length === 0) return null;
            return (
              <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-36 py-4">
                <h2 className="mb-3 text-lg font-bold">{c.name}</h2>
                <div className="space-y-3">
                  {items.map((p) => (
                    <ProductCard key={p.id} product={p} onSelect={() => setSelected(p)} />
                  ))}
                </div>
              </section>
            );
          })}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-primary-soft">
              <Search className="size-7 text-primary" />
            </div>
            <h3 className="mt-4 font-bold">Nada encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">Tente buscar por outro nome de produto.</p>
          </div>
        )}

        <StoreInfo establishment={establishment} />
      </div>

      <a
        href={`https://wa.me/${establishment.whatsapp}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-24 right-4 z-40 grid size-12 place-items-center rounded-full bg-success text-success-foreground shadow-lift transition hover:scale-105 sm:bottom-6"
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle className="size-5" />
      </a>

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4">
          <Button
            onClick={() => setCartOpen(true)}
            className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between rounded-full px-6 text-base font-semibold shadow-glow"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="size-5" />
              {cart.count} {cart.count === 1 ? "item" : "itens"}
            </span>
            <span>{brl(cart.subtotal)}</span>
          </Button>
        </div>
      )}

      <ProductModal product={selected} groups={data?.optionGroups ?? []} onClose={() => setSelected(null)} />
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        establishment={establishment}
        {...(mesa ? { tableNumber: Number(mesa) } : {})}
      />
    </div>
  );
}

function Hero({ establishment, mesa }: { establishment: Establishment; mesa?: string | undefined }) {
  const today = establishment.business_hours.find((h) => h.weekday === new Date().getDay());
  return (
    <header className="relative">
      <div className="relative h-44 overflow-hidden sm:h-60">
        <img
          src={establishment.cover_url}
          alt={`Capa do ${establishment.name}`}
          width={800}
          height={600}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="mx-auto -mt-12 max-w-3xl px-4">
        <div className="surface-card animate-rise p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <img
              src={establishment.logo_url}
              alt={`Logotipo ${establishment.name}`}
              width={800}
              height={600}
              className="size-16 shrink-0 rounded-2xl border-2 border-card object-cover shadow-soft sm:size-20"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{establishment.name}</h1>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{establishment.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
                    establishment.is_open
                      ? "bg-success/12 text-success"
                      : "bg-destructive/12 text-destructive"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {establishment.is_open ? "Aberto agora" : "Fechado"}
                </span>
                {today && !today.closed && (
                  <span className="text-muted-foreground">
                    Hoje {today.opens} às {today.closes}
                  </span>
                )}
              </div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
            <Stat icon={<Clock className="size-4" />} label="Entrega em" value={`${establishment.eta_minutes[0]}-${establishment.eta_minutes[1]} min`} />
            <Stat icon={<Bike className="size-4" />} label="Taxa a partir de" value={brl(establishment.delivery_fee_from)} />
            <Stat icon={<ShoppingBag className="size-4" />} label="Pedido mínimo" value={brl(establishment.min_order)} />
            <Stat icon={<Utensils className="size-4" />} label="Modalidades" value={`${establishment.modes.length} opções`} />
          </dl>

          {mesa && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-primary-soft p-3.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
                {mesa}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary">Você está na Mesa {mesa}</p>
                <p className="text-xs text-muted-foreground">
                  Seu pedido será enviado direto para a cozinha e lançado nesta mesa.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{icon}</span>
      <div className="min-w-0">
        <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-semibold">{value}</dd>
      </div>
    </div>
  );
}

function StoreInfo({ establishment }: { establishment: Establishment }) {
  return (
    <section className="space-y-4 py-8">
      <div className="surface-card space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Info className="size-4 text-primary" /> Sobre o estabelecimento
        </h2>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" /> {establishment.address}
        </p>
        {establishment.business_hours.length > 0 && (
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {establishment.business_hours.map((h) => (
              <li key={h.weekday} className="flex justify-between gap-3 rounded-lg px-2 py-1 odd:bg-muted/50">
                <span className="text-muted-foreground">{WEEKDAYS[h.weekday]}</span>
                <span className="font-medium">{h.closed ? "Fechado" : `${h.opens} — ${h.closes}`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="surface-card space-y-2 p-5">
        <h2 className="text-base font-bold">Política de entrega</h2>
        <p className="text-sm text-muted-foreground">{establishment.delivery_policy}</p>
      </div>
      <p className="pb-4 text-center text-xs text-muted-foreground">
        Cardápio digital por{" "}
        <Link to="/" className="font-semibold text-primary">
          NexaCardápio
        </Link>
      </p>
    </section>
  );
}
