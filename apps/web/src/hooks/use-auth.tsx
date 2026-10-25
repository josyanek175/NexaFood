import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppRole } from "@nexafood/shared";
import {
  fetchAuthMe,
  logoutSession,
  setCurrentEstablishment as setCurrentEstablishmentApi,
  type AuthMeResponse,
} from "@/services/auth-api";

export type { AppRole };

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
}

export interface Membership {
  id: string;
  establishment_id: string;
  role: AppRole;
  active: boolean;
  establishment: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    is_open: boolean;
    status: string;
  };
}

interface AuthContextValue {
  /** True when authenticated (kept for RequireAuth / auth page compatibility). */
  session: { userId: string } | null;
  user: AuthUser | null;
  loading: boolean;
  memberships: Membership[];
  membershipsLoading: boolean;
  isPlatformAdmin: boolean;
  currentEstablishmentId: string | null;
  setCurrentEstablishmentId: (id: string) => void;
  currentMembership: Membership | null;
  refreshMemberships: () => Promise<void>;
  signOut: () => Promise<void>;
  applyMe: (me: AuthMeResponse) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapMemberships(me: AuthMeResponse): Membership[] {
  return me.memberships.map((m) => ({
    id: `${m.establishmentId}:${m.role}`,
    establishment_id: m.establishmentId,
    role: m.role,
    active: true,
    establishment: {
      id: m.establishmentId,
      name: m.establishmentName,
      slug: m.establishmentSlug,
      logo_url: m.logoUrl,
      is_open: m.isOpen,
      status: m.status,
    },
  }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [currentEstablishmentId, setCurrentId] = useState<string | null>(null);

  const applyMe = useCallback((me: AuthMeResponse) => {
    setUser(me.user);
    setMemberships(mapMemberships(me));
    setIsPlatformAdmin(me.isPlatformAdmin);
    setCurrentId(me.currentEstablishmentId);
    setMembershipsLoading(false);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setMemberships([]);
    setIsPlatformAdmin(false);
    setCurrentId(null);
    setMembershipsLoading(false);
  }, []);

  const refreshMemberships = useCallback(async () => {
    setMembershipsLoading(true);
    try {
      const me = await fetchAuthMe();
      if (!me) {
        clearAuth();
        return;
      }
      applyMe(me);
    } catch {
      clearAuth();
    } finally {
      setMembershipsLoading(false);
    }
  }, [applyMe, clearAuth]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchAuthMe();
        if (cancelled) return;
        if (me) applyMe(me);
        else clearAuth();
      } catch {
        if (!cancelled) clearAuth();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyMe, clearAuth]);

  const value: AuthContextValue = {
    session: user ? { userId: user.id } : null,
    user,
    loading,
    memberships,
    membershipsLoading,
    isPlatformAdmin,
    currentEstablishmentId,
    setCurrentEstablishmentId: (id) => {
      setCurrentId(id);
      void setCurrentEstablishmentApi(id)
        .then(applyMe)
        .catch(() => {
          void refreshMemberships();
        });
    },
    currentMembership:
      memberships.find((m) => m.establishment_id === currentEstablishmentId) ?? null,
    refreshMemberships,
    signOut: async () => {
      try {
        await logoutSession();
      } finally {
        clearAuth();
      }
    },
    applyMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
