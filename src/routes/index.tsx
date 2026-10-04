import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bike,
  ChefHat,
  QrCode,
  Smartphone,
  Store,
  Wallet,
} from "lucide-react";
import { establishments } from "@/data/demo";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/burger.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NexaCardápio — Cardápio digital e gestão para restaurantes" },
      {
        name: "description",
        content:
          "Plataforma completa para bares, restaurantes e delivery: cardápio digital, pedidos por QR Code, KDS, mesas, entregas e relatórios.",
      },
      { property: "og:title", content: "NexaCardápio — Cardápio digital e gestão para restaurantes" },
      {
        property: "og:description",
        content: "Plataforma completa para bares, restaurantes e delivery: cardápio digital, pedidos por QR Code, KDS, mesas, entregas e relatórios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Smartphone, title: "Cardápio digital", text: "Link próprio, fotos, variações e complementos com carrinho em tempo real." },
  { icon: QrCode, title: "Pedido na mesa", text: "QR Code por mesa, comanda aberta e divisão de conta." },
  { icon: ChefHat, title: "Cozinha (KDS)", text: "Painel por setor com tempo de preparo e alertas de atraso." },
  { icon: Bike, title: "Entregas", text: "Zonas, taxas, fila de despacho e equipe de entregadores." },
  { icon: Wallet, title: "Financeiro", text: "Caixa do dia, formas de pagamento e comissões de marketplace." },
  { icon: BarChart3, title: "Relatórios", text: "Curva de vendas, produtos campeões e participação por canal." },
];

function Landing() {
  const est = establishments[0]!;

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <span className="font-display text-xl font-bold tracking-tight">
          Nexa<span className="text-primary">Cardápio</span>
        </span>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/auth" search={{ redirect: "/admin" }}>Entrar</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/$slug" params={{ slug: est.slug }} search={{ mesa: undefined }}>
              Ver cardápio demo
            </Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:py-20">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            <Store className="size-3.5" /> Plataforma multiempresa
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            O sistema completo do seu <span className="text-primary">restaurante</span>, do pedido ao caixa.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Cardápio digital, pedidos por QR Code na mesa, cozinha em tempo real, entregas, cupons e relatórios —
            tudo isolado por estabelecimento.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/$slug" params={{ slug: est.slug }} search={{ mesa: undefined }}>
                Experimentar o cardápio <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/admin">Conhecer o painel</Link>
            </Button>
          </div>
        </div>

        <div className="animate-rise relative">
          <img
            src={heroImage}
            alt="Hambúrguer artesanal da Nexa Burger sobre tábua de madeira"
            width={1024}
            height={1024}
            className="aspect-square w-full rounded-[2rem] object-cover shadow-lift"
          />
          <div className="surface-card absolute -bottom-5 left-4 right-4 flex items-center gap-3 p-4 sm:left-auto sm:right-6 sm:w-64">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <QrCode className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Mesa 07 pediu</p>
              <p className="text-xs text-muted-foreground">2x Hambúrguer • enviado à cozinha</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl font-bold tracking-tight">Tudo que a operação precisa</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Um único painel para o salão, a cozinha, o delivery e a gestão.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="surface-card p-6 transition hover:shadow-lift">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} NexaCardápio</span>
          <Link to="/superadmin" className="font-semibold hover:text-foreground">
            Área do superadministrador
          </Link>
        </div>
      </footer>
    </main>
  );
}
