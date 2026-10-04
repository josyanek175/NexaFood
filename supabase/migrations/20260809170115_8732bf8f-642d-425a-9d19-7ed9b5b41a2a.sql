-- ENUM
DO $$ BEGIN
  CREATE TYPE public.kitchen_sector_type AS ENUM ('COZINHA','BAR','CHAPA','PIZZARIA','SOBREMESAS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BUSINESS HOURS
CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens time NOT NULL DEFAULT '18:00',
  closes time NOT NULL DEFAULT '23:00',
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, weekday)
);
GRANT SELECT ON public.business_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;
GRANT ALL ON public.business_hours TO service_role;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY bh_public_read ON public.business_hours FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY bh_member_read ON public.business_hours FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id) OR EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY bh_manage ON public.business_hours FOR ALL TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE TRIGGER trg_bh_updated BEFORE UPDATE ON public.business_hours FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- KITCHEN SECTORS
CREATE TABLE public.kitchen_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.kitchen_sector_type NOT NULL DEFAULT 'COZINHA',
  printer_name text,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kitchen_sectors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_sectors TO authenticated;
GRANT ALL ON public.kitchen_sectors TO service_role;
ALTER TABLE public.kitchen_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY ks_public_read ON public.kitchen_sectors FOR SELECT TO anon
  USING (active AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY ks_member_read ON public.kitchen_sectors FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id) OR (active AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE')));
CREATE POLICY ks_manage ON public.kitchen_sectors FOR ALL TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE TRIGGER trg_ks_updated BEFORE UPDATE ON public.kitchen_sectors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  available_from time,
  available_to time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_public_read ON public.categories FOR SELECT TO anon
  USING (active AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY cat_member_read ON public.categories FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id) OR (active AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE')));
CREATE POLICY cat_manage ON public.categories FOR ALL TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE TRIGGER trg_cat_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- OPTION GROUPS
CREATE TABLE public.option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  min_select integer NOT NULL DEFAULT 0,
  max_select integer NOT NULL DEFAULT 1,
  selection text NOT NULL DEFAULT 'single' CHECK (selection IN ('single','multiple')),
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.option_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.option_groups TO authenticated;
GRANT ALL ON public.option_groups TO service_role;
ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY og_public_read ON public.option_groups FOR SELECT TO anon
  USING (active AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY og_member_read ON public.option_groups FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id) OR (active AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE')));
CREATE POLICY og_manage ON public.option_groups FOR ALL TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE TRIGGER trg_og_updated BEFORE UPDATE ON public.option_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- OPTION ITEMS
CREATE TABLE public.option_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id uuid NOT NULL REFERENCES public.option_groups(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.option_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.option_items TO authenticated;
GRANT ALL ON public.option_items TO service_role;
ALTER TABLE public.option_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY oi_public_read ON public.option_items FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY oi_member_read ON public.option_items FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id) OR EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY oi_manage ON public.option_items FOR ALL TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE TRIGGER trg_oi_updated BEFORE UPDATE ON public.option_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES public.kitchen_sectors(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  price numeric NOT NULL DEFAULT 0,
  promo_price numeric,
  sku text,
  prep_minutes integer NOT NULL DEFAULT 15,
  available boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  track_stock boolean NOT NULL DEFAULT false,
  stock integer,
  removable_ingredients text[] NOT NULL DEFAULT '{}',
  channels text[] NOT NULL DEFAULT '{cardapio,mesa,balcao}',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY prod_public_read ON public.products FOR SELECT TO anon
  USING (available AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY prod_member_read ON public.products FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id) OR (available AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE')));
CREATE POLICY prod_manage ON public.products FOR ALL TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE TRIGGER trg_prod_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_products_est_cat ON public.products (establishment_id, category_id);

-- PRODUCT VARIATIONS
CREATE TABLE public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_variations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variations TO authenticated;
GRANT ALL ON public.product_variations TO service_role;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY pv_public_read ON public.product_variations FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY pv_member_read ON public.product_variations FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id) OR EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY pv_manage ON public.product_variations FOR ALL TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));
CREATE TRIGGER trg_pv_updated BEFORE UPDATE ON public.product_variations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCT <-> OPTION GROUPS
CREATE TABLE public.product_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_group_id uuid NOT NULL REFERENCES public.option_groups(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, option_group_id)
);
GRANT SELECT ON public.product_option_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_groups TO authenticated;
GRANT ALL ON public.product_option_groups TO service_role;
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY pog_public_read ON public.product_option_groups FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY pog_member_read ON public.product_option_groups FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id) OR EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY pog_manage ON public.product_option_groups FOR ALL TO authenticated
  USING (public.can_manage_establishment(establishment_id)) WITH CHECK (public.can_manage_establishment(establishment_id));

-- ============ SEED (Nexa Burger) ============
DO $$
DECLARE
  est uuid;
  c_burgers uuid; c_combos uuid; c_porcoes uuid; c_bebidas uuid; c_sobremesas uuid;
  s_chapa uuid; s_cozinha uuid; s_bar uuid; s_sobremesas uuid;
  g_ponto uuid; g_extras uuid; g_acomp uuid; g_bebida uuid;
  p_artesanal uuid; p_smash uuid; p_veggie uuid; p_duo uuid; p_solo uuid;
  p_onion uuid; p_fritas uuid; p_limonada uuid; p_chopp uuid; p_petit uuid;
BEGIN
  SELECT id INTO est FROM public.establishments WHERE slug = 'nexa-burger' LIMIT 1;
  IF est IS NULL THEN RETURN; END IF;

  INSERT INTO public.business_hours (establishment_id, weekday, opens, closes, closed) VALUES
    (est,0,'18:00','23:00',false),(est,1,'18:00','23:00',true),(est,2,'18:00','23:30',false),
    (est,3,'18:00','23:30',false),(est,4,'18:00','23:30',false),(est,5,'18:00','00:30',false),
    (est,6,'12:00','00:30',false)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.kitchen_sectors (establishment_id, name, type, position) VALUES (est,'Chapa','CHAPA',0) RETURNING id INTO s_chapa;
  INSERT INTO public.kitchen_sectors (establishment_id, name, type, position) VALUES (est,'Cozinha','COZINHA',1) RETURNING id INTO s_cozinha;
  INSERT INTO public.kitchen_sectors (establishment_id, name, type, position) VALUES (est,'Bar','BAR',2) RETURNING id INTO s_bar;
  INSERT INTO public.kitchen_sectors (establishment_id, name, type, position) VALUES (est,'Sobremesas','SOBREMESAS',3) RETURNING id INTO s_sobremesas;

  INSERT INTO public.categories (establishment_id, name, position) VALUES (est,'Hambúrgueres',1) RETURNING id INTO c_burgers;
  INSERT INTO public.categories (establishment_id, name, position) VALUES (est,'Combos',2) RETURNING id INTO c_combos;
  INSERT INTO public.categories (establishment_id, name, position) VALUES (est,'Porções',3) RETURNING id INTO c_porcoes;
  INSERT INTO public.categories (establishment_id, name, position) VALUES (est,'Bebidas',4) RETURNING id INTO c_bebidas;
  INSERT INTO public.categories (establishment_id, name, position) VALUES (est,'Sobremesas',5) RETURNING id INTO c_sobremesas;

  INSERT INTO public.option_groups (establishment_id, name, required, min_select, max_select, selection, position)
    VALUES (est,'Escolha o ponto da carne',true,1,1,'single',0) RETURNING id INTO g_ponto;
  INSERT INTO public.option_groups (establishment_id, name, required, min_select, max_select, selection, position)
    VALUES (est,'Adicione extras',false,0,5,'multiple',1) RETURNING id INTO g_extras;
  INSERT INTO public.option_groups (establishment_id, name, required, min_select, max_select, selection, position)
    VALUES (est,'Acompanhamento incluso',true,1,1,'single',2) RETURNING id INTO g_acomp;
  INSERT INTO public.option_groups (establishment_id, name, required, min_select, max_select, selection, position)
    VALUES (est,'Bebida do combo',true,1,1,'single',3) RETURNING id INTO g_bebida;

  INSERT INTO public.option_items (establishment_id, option_group_id, name, price, available, position) VALUES
    (est,g_ponto,'Mal passado',0,true,0),(est,g_ponto,'Ao ponto',0,true,1),(est,g_ponto,'Bem passado',0,true,2),
    (est,g_extras,'Bacon crocante',6,true,0),(est,g_extras,'Cheddar extra',5,true,1),(est,g_extras,'Ovo caipira',4,true,2),
    (est,g_extras,'Molho especial da casa',3.5,true,3),(est,g_extras,'Cebola caramelizada',4.5,false,4),
    (est,g_acomp,'Batata rústica',0,true,0),(est,g_acomp,'Onion rings',4,true,1),(est,g_acomp,'Salada verde',0,true,2),
    (est,g_bebida,'Refrigerante lata',0,true,0),(est,g_bebida,'Limonada suíça',3,true,1),(est,g_bebida,'Long neck',6,true,2);

  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, promo_price, featured, prep_minutes, removable_ingredients, position)
    VALUES (est,c_burgers,s_chapa,'Hambúrguer Artesanal','Blend 180g, queijo prato, alface, tomate e molho da casa no pão brioche.',38.9,32.9,true,18,ARRAY['Alface','Tomate','Cebola','Molho da casa'],0) RETURNING id INTO p_artesanal;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, featured, prep_minutes, removable_ingredients, position)
    VALUES (est,c_burgers,s_chapa,'Smash Duplo na Chapa','Dois smashs de 90g, cheddar duplo e picles.',34.9,true,15,ARRAY['Picles','Cebola'],1) RETURNING id INTO p_smash;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, prep_minutes, position)
    VALUES (est,c_burgers,s_chapa,'Veggie da Horta','Hambúrguer de grão-de-bico, rúcula e maionese vegana.',32.9,16,2) RETURNING id INTO p_veggie;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, promo_price, featured, prep_minutes, position)
    VALUES (est,c_combos,s_chapa,'Combo Nexa Duo','2 hambúrgueres artesanais, 2 porções de batata e 2 bebidas.',89.9,74.9,true,25,0) RETURNING id INTO p_duo;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, prep_minutes, position)
    VALUES (est,c_combos,s_chapa,'Combo Solo','Hambúrguer, acompanhamento e bebida.',49.9,20,1) RETURNING id INTO p_solo;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, featured, prep_minutes, position)
    VALUES (est,c_porcoes,s_cozinha,'Onion Rings com Cheddar','Anéis de cebola empanados com cheddar cremoso.',28.9,true,12,0) RETURNING id INTO p_onion;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, prep_minutes, position)
    VALUES (est,c_porcoes,s_cozinha,'Batata Rústica Trufada','Batatas rústicas com azeite trufado e parmesão.',26.9,12,1) RETURNING id INTO p_fritas;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, prep_minutes, position)
    VALUES (est,c_bebidas,s_bar,'Limonada Suíça','Limão siciliano batido com leite condensado.',14.9,6,0) RETURNING id INTO p_limonada;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, prep_minutes, position)
    VALUES (est,c_bebidas,s_bar,'Chopp Artesanal Pilsen 500ml','Chopp gelado tirado na hora.',18.9,4,1) RETURNING id INTO p_chopp;
  INSERT INTO public.products (establishment_id, category_id, sector_id, name, description, price, prep_minutes, position)
    VALUES (est,c_sobremesas,s_sobremesas,'Petit Gâteau de Doce de Leite','Servido com sorvete de creme.',24.9,10,0) RETURNING id INTO p_petit;

  INSERT INTO public.product_variations (establishment_id, product_id, name, price_delta, position) VALUES
    (est,p_artesanal,'Individual',0,0),(est,p_artesanal,'Duplo',12,1),
    (est,p_smash,'Individual',0,0),(est,p_smash,'Triplo',10,1);

  INSERT INTO public.product_option_groups (establishment_id, product_id, option_group_id, position) VALUES
    (est,p_artesanal,g_ponto,0),(est,p_artesanal,g_extras,1),
    (est,p_smash,g_ponto,0),(est,p_smash,g_extras,1),
    (est,p_veggie,g_extras,0),
    (est,p_duo,g_acomp,0),(est,p_duo,g_bebida,1),
    (est,p_solo,g_acomp,0),(est,p_solo,g_bebida,1);
END $$;