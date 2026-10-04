-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM (
  'PLATFORM_ADMIN','ESTABLISHMENT_ADMIN','MANAGER','CASHIER','ATTENDANT','KITCHEN','DELIVERY_DRIVER'
);
CREATE TYPE public.entity_status AS ENUM ('ACTIVE','SUSPENDED','TRIAL','INACTIVE');

-- ============ UTIL ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PLATFORM ADMINS ============
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admins_select_own" ON public.platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id);
$$;

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  document TEXT,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ESTABLISHMENTS ============
CREATE TABLE public.establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  legal_name TEXT,
  cnpj TEXT,
  logo_url TEXT,
  cover_url TEXT,
  description TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  is_open BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency TEXT NOT NULL DEFAULT 'BRL',
  primary_color TEXT NOT NULL DEFAULT '#E2603B',
  secondary_color TEXT NOT NULL DEFAULT '#1F1B18',
  minimum_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_time_min INTEGER NOT NULL DEFAULT 20,
  estimated_time_max INTEGER NOT NULL DEFAULT 45,
  service_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT establishments_slug_format CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  CONSTRAINT establishments_eta_check CHECK (estimated_time_max >= estimated_time_min)
);
CREATE INDEX idx_establishments_org ON public.establishments(organization_id);
GRANT SELECT, INSERT, UPDATE ON public.establishments TO authenticated;
GRANT SELECT ON public.establishments TO anon;
GRANT ALL ON public.establishments TO service_role;
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_est_updated BEFORE UPDATE ON public.establishments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ESTABLISHMENT USERS ============
CREATE TABLE public.establishment_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'ATTENDANT',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, user_id)
);
CREATE INDEX idx_est_users_user ON public.establishment_users(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_users TO authenticated;
GRANT ALL ON public.establishment_users TO service_role;
ALTER TABLE public.establishment_users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_est_users_updated BEFORE UPDATE ON public.establishment_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SECURITY DEFINER HELPERS (evitam recursão de RLS) ============
CREATE OR REPLACE FUNCTION public.has_establishment_access(_establishment_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.establishment_users eu
    WHERE eu.establishment_id = _establishment_id AND eu.user_id = _user_id AND eu.active
  );
$$;

CREATE OR REPLACE FUNCTION public.establishment_role(_establishment_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT eu.role FROM public.establishment_users eu
  WHERE eu.establishment_id = _establishment_id AND eu.user_id = _user_id AND eu.active
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_establishment_role(_establishment_id UUID, _roles public.app_role[], _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.establishment_users eu
    WHERE eu.establishment_id = _establishment_id AND eu.user_id = _user_id AND eu.active
      AND eu.role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_establishment(_establishment_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_establishment_role(_establishment_id, ARRAY['ESTABLISHMENT_ADMIN','MANAGER']::public.app_role[], _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_organization_access(_organization_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.establishment_users eu
    JOIN public.establishments e ON e.id = eu.establishment_id
    WHERE e.organization_id = _organization_id AND eu.user_id = _user_id AND eu.active
  );
$$;

-- ============ POLICIES ============
-- organizations
CREATE POLICY "orgs_select_members" ON public.organizations FOR SELECT TO authenticated
  USING (public.has_organization_access(id) OR created_by = auth.uid());
CREATE POLICY "orgs_insert_self" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs_update_members" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_organization_access(id)) WITH CHECK (public.has_organization_access(id));

-- establishments
CREATE POLICY "establishments_public_read" ON public.establishments FOR SELECT TO anon
  USING (status = 'ACTIVE');
CREATE POLICY "establishments_member_read" ON public.establishments FOR SELECT TO authenticated
  USING (status = 'ACTIVE' OR public.has_establishment_access(id));
CREATE POLICY "establishments_insert_owner" ON public.establishments FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_organization_access(organization_id) IS NOT NULL);
CREATE POLICY "establishments_update_manager" ON public.establishments FOR UPDATE TO authenticated
  USING (public.can_manage_establishment(id)) WITH CHECK (public.can_manage_establishment(id));

-- establishment_users
CREATE POLICY "est_users_select_self_or_manager" ON public.establishment_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_establishment(establishment_id));
CREATE POLICY "est_users_insert_manager" ON public.establishment_users FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE POLICY "est_users_update_manager" ON public.establishment_users FOR UPDATE TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE POLICY "est_users_delete_manager" ON public.establishment_users FOR DELETE TO authenticated
  USING (public.can_manage_establishment(establishment_id));

-- ============ BOOTSTRAP: primeiro usuário vira admin do estabelecimento criado ============
CREATE OR REPLACE FUNCTION public.handle_new_establishment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.establishment_users (establishment_id, user_id, role, active)
    VALUES (NEW.id, NEW.created_by, 'ESTABLISHMENT_ADMIN', true)
    ON CONFLICT (establishment_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_establishment_created AFTER INSERT ON public.establishments
FOR EACH ROW EXECUTE FUNCTION public.handle_new_establishment();