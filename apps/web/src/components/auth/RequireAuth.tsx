import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";

/**
 * Guarda de acesso client-side: exige sessão ativa e, opcionalmente,
 * vínculo com um estabelecimento ou perfil de plataforma.
 */
export function RequireAuth({
  children,
  roles,
  platformAdmin = false,
}: {
  children: ReactNode;
  roles?: AppRole[];
  platformAdmin?: boolean;
}) {
  const { session, loading, membershipsLoading, currentMembership, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const redirected = useRef(false);

  useEffect(() => {
    if (!loading && !session && !redirected.current) {
      redirected.current = true;
      void navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
    }
    if (session) redirected.current = false;
  }, [loading, session, pathname, navigate]);

  if (loading || !session || membershipsLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (platformAdmin && !isPlatformAdmin) return <Denied message="Área exclusiva de administradores da plataforma." />;

  if (roles && !isPlatformAdmin && (!currentMembership || !roles.includes(currentMembership.role))) {
    return <Denied message="Seu perfil não tem permissão para acessar esta área." />;
  }

  return <>{children}</>;
}

function Denied({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="surface-card max-w-sm p-6 text-center">
        <h1 className="font-display text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
