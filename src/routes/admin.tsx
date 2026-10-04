import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  ReceiptText,
  ChefHat,
  BookOpen,
  Table2,
  Users,
  Ticket,
  Bike,
  Wallet,
  BarChart3,
  Plug,
  Printer,
  Settings,
  Bell,
  ExternalLink,
  Menu,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { establishments } from "@/data/demo";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth, type AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel do estabelecimento — NexaCardápio" },
      { name: "description", content: "Gerencie pedidos, cardápio, mesas, entregas e relatórios." },
      { property: "og:title", content: "Painel do estabelecimento — NexaCardápio" },
      { property: "og:description", content: "Operação completa de bares e restaurantes em um só lugar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <RequireAuth>
      <AdminLayout />
    </RequireAuth>
  );
}

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/pedidos", label: "Pedidos", icon: ReceiptText },
  { to: "/admin/cozinha", label: "Cozinha (KDS)", icon: ChefHat },
  { to: "/admin/cardapio", label: "Cardápio", icon: BookOpen },
  { to: "/admin/mesas", label: "Mesas", icon: Table2 },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/cupons", label: "Cupons", icon: Ticket },
  { to: "/admin/entregas", label: "Entregas", icon: Bike },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/admin/integracoes", label: "Integrações", icon: Plug },
  { to: "/admin/impressao", label: "Impressão", icon: Printer },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

const ROLE_LABEL: Record<AppRole, string> = {
  PLATFORM_ADMIN: "Administrador da plataforma",
  ESTABLISHMENT_ADMIN: "Administrador",
  MANAGER: "Gerente",
  CASHIER: "Caixa",
  ATTENDANT: "Atendente",
  KITCHEN: "Cozinha",
  DELIVERY_DRIVER: "Entregador",
};

function AdminLayout() {
  const navigate = useNavigate();
  const {
    user,
    memberships,
    currentEstablishmentId,
    setCurrentEstablishmentId,
    currentMembership,
    isPlatformAdmin,
    signOut,
  } = useAuth();
  const establishment = currentMembership?.establishment ?? establishments[0]!;
  const displayName =
    (user?.user_metadata?.["full_name"] as string | undefined) || user?.email || "Usuário";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() ?? "")
    .join("");
  const roleLabel = currentMembership
    ? ROLE_LABEL[currentMembership.role]
    : isPlatformAdmin
      ? ROLE_LABEL["PLATFORM_ADMIN"]
      : "Sem vínculo ativo";

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  };

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [openMobile, setOpenMobile] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-xl gradient-warm text-primary-foreground font-display font-bold">
          N
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold">NexaCardápio</p>
          <p className="truncate text-[11px] text-sidebar-foreground/60">Painel do estabelecimento</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpenMobile(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <Link
          to="/superadmin"
          onClick={() => setOpenMobile(false)}
          className="mt-3 flex items-center gap-3 rounded-xl border border-sidebar-border px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition hover:bg-sidebar-accent"
        >
          <ShieldCheck className="size-4 shrink-0" />
          Superadministrador
        </Link>
      </nav>
      <div className="space-y-3 border-t border-sidebar-border p-4">
        {memberships.length > 1 && (
          <select
            aria-label="Trocar de estabelecimento"
            value={currentEstablishmentId ?? ""}
            onChange={(e) => setCurrentEstablishmentId(e.target.value)}
            className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent px-2.5 py-2 text-xs font-semibold text-sidebar-foreground"
          >
            {memberships.map((m: (typeof memberships)[number]) => (
              <option key={m.establishment_id} value={m.establishment_id}>
                {m.establishment.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-bold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">{roleLabel}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Sair"
            className="shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
      {openMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpenMobile(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 lg:hidden"
              onClick={() => setOpenMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{establishment.name}</p>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                  establishment.is_open ? "text-success" : "text-destructive"
                }`}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {establishment.is_open ? "Aberto" : "Fechado"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="icon" variant="ghost" aria-label="Alertas" className="relative">
              <Bell className="size-5" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
            </Button>
            <Button asChild variant="secondary" className="rounded-full">
              <Link to="/$slug" params={{ slug: establishment.slug }} search={{ mesa: undefined }}>
                <ExternalLink className="mr-1.5 size-4" />
                <span className="hidden sm:inline">Ver cardápio</span>
              </Link>
            </Button>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
