import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "PLATFORM_ADMIN"
  | "ESTABLISHMENT_ADMIN"
  | "MANAGER"
  | "CASHIER"
  | "ATTENDANT"
  | "KITCHEN"
  | "DELIVERY_DRIVER";

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
  session: Session | null;
  user: User | null;
  loading: boolean;
  memberships: Membership[];
  membershipsLoading: boolean;
  isPlatformAdmin: boolean;
  currentEstablishmentId: string | null;
  setCurrentEstablishmentId: (id: string) => void;
  currentMembership: Membership | null;
  refreshMemberships: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "nexa.establishment_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [currentEstablishmentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const loadMemberships = useMemo(
    () => async () => {
      if (!userId) {
        setMemberships([]);
        setIsPlatformAdmin(false);
        return;
      }
      setMembershipsLoading(true);
      const [{ data: rows }, { data: admin }] = await Promise.all([
        supabase
          .from("establishment_users")
          .select(
            "id, establishment_id, role, active, establishment:establishments(id, name, slug, logo_url, is_open, status)",
          )
          .eq("user_id", userId)
          .eq("active", true),
        supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      ]);
      const list = (rows ?? []).filter((r) => r.establishment) as unknown as Membership[];
      setMemberships(list);
      setIsPlatformAdmin(Boolean(admin));
      setMembershipsLoading(false);

      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      const valid = list.find((m) => m.establishment_id === stored);
      const next = valid?.establishment_id ?? list[0]?.establishment_id ?? null;
      setCurrentId(next);
      if (next && typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
    },
    [userId],
  );

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    memberships,
    membershipsLoading,
    isPlatformAdmin,
    currentEstablishmentId,
    setCurrentEstablishmentId: (id) => {
      setCurrentId(id);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
    },
    currentMembership: memberships.find((m) => m.establishment_id === currentEstablishmentId) ?? null,
    refreshMemberships: loadMemberships,
    signOut: async () => {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      setMemberships([]);
      setCurrentId(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
