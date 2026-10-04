-- ENUMS
DO $$ BEGIN CREATE TYPE public.order_channel AS ENUM ('CARDAPIO','MESA','BALCAO','IFOOD','99FOOD','MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.order_mode AS ENUM ('DELIVERY','RETIRADA','LOCAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.order_status AS ENUM ('ENVIADO','CONFIRMADO','PREPARANDO','PRONTO','EM_ENTREGA','FINALIZADO','CANCELADO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('PIX','CREDITO','DEBITO','DINHEIRO','CAIXA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.table_status AS ENUM ('LIVRE','OCUPADA','AGUARDANDO_PEDIDO','PREPARANDO','AGUARDANDO_PAGAMENTO','FECHADA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLES (mesas)
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  number integer NOT NULL,
  seats integer NOT NULL DEFAULT 4,
  status public.table_status NOT NULL DEFAULT 'LIVRE',
  qr_token text NOT NULL DEFAULT replace(gen_random_uuid()::text,'-',''),
  current_total numeric NOT NULL DEFAULT 0,
  opened_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, number)
);
GRANT SELECT ON public.restaurant_tables TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY rt_public_read ON public.restaurant_tables FOR SELECT TO anon
  USING (active AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.status = 'ACTIVE'));
CREATE POLICY rt_member_read ON public.restaurant_tables FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id));
CREATE POLICY rt_manage ON public.restaurant_tables FOR ALL TO authenticated
  USING (public.has_establishment_access(establishment_id)) WITH CHECK (public.has_establishment_access(establishment_id));
CREATE TRIGGER trg_rt_updated BEFORE UPDATE ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  birthdate date,
  consent boolean NOT NULL DEFAULT false,
  notes text,
  orders_count integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_member_read ON public.customers FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id));
CREATE POLICY cust_manage ON public.customers FOR ALL TO authenticated
  USING (public.has_establishment_access(establishment_id)) WITH CHECK (public.has_establishment_access(establishment_id));
CREATE TRIGGER trg_cust_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  code text NOT NULL,
  channel public.order_channel NOT NULL DEFAULT 'CARDAPIO',
  mode public.order_mode NOT NULL DEFAULT 'DELIVERY',
  status public.order_status NOT NULL DEFAULT 'ENVIADO',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  table_number integer,
  address text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  service_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'PIX',
  change_for numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY ord_member_read ON public.orders FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id));
CREATE POLICY ord_manage ON public.orders FOR ALL TO authenticated
  USING (public.has_establishment_access(establishment_id)) WITH CHECK (public.has_establishment_access(establishment_id));
CREATE TRIGGER trg_ord_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_orders_est_created ON public.orders (establishment_id, created_at DESC);

-- ORDER ITEMS (snapshot)
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  variation_name text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  sector text NOT NULL DEFAULT 'cozinha',
  removed text[] NOT NULL DEFAULT '{}',
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY oitem_member_read ON public.order_items FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id));
CREATE POLICY oitem_manage ON public.order_items FOR ALL TO authenticated
  USING (public.has_establishment_access(establishment_id)) WITH CHECK (public.has_establishment_access(establishment_id));

-- ORDER ITEM OPTIONS (snapshot)
CREATE TABLE public.order_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  item_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_options TO authenticated;
GRANT ALL ON public.order_item_options TO service_role;
ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY oio_member_read ON public.order_item_options FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id));
CREATE POLICY oio_manage ON public.order_item_options FOR ALL TO authenticated
  USING (public.has_establishment_access(establishment_id)) WITH CHECK (public.has_establishment_access(establishment_id));

-- ORDER STATUS EVENTS
CREATE TABLE public.order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  changed_by uuid,
  changed_by_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_status_events TO authenticated;
GRANT ALL ON public.order_status_events TO service_role;
ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ose_member_read ON public.order_status_events FOR SELECT TO authenticated
  USING (public.has_establishment_access(establishment_id));
CREATE POLICY ose_insert ON public.order_status_events FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(establishment_id));

-- Registra automaticamente o histórico de status
CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_events (order_id, establishment_id, status, changed_by)
    VALUES (NEW.id, NEW.establishment_id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_order_status() FROM public, anon, authenticated;
CREATE TRIGGER trg_order_status AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

-- Criação segura de pedido pelo cardápio público (preços recalculados no servidor)
CREATE OR REPLACE FUNCTION public.place_order(
  _slug text,
  _mode public.order_mode,
  _payment_method public.payment_method,
  _customer_name text,
  _customer_phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _table_number integer DEFAULT NULL,
  _notes text DEFAULT NULL,
  _change_for numeric DEFAULT NULL,
  _items jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  est public.establishments%ROWTYPE;
  it jsonb; opt_id uuid;
  prod public.products%ROWTYPE;
  var public.product_variations%ROWTYPE;
  oi public.option_items%ROWTYPE;
  og_name text;
  sector_name text;
  qty integer; unit numeric; sub numeric := 0;
  new_order_id uuid; new_item_id uuid; new_code text;
  tbl public.restaurant_tables%ROWTYPE;
  svc numeric := 0;
BEGIN
  SELECT * INTO est FROM public.establishments WHERE slug = _slug AND status = 'ACTIVE';
  IF est.id IS NULL THEN RAISE EXCEPTION 'Estabelecimento indisponível'; END IF;
  IF jsonb_array_length(COALESCE(_items,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Pedido sem itens'; END IF;
  IF trim(COALESCE(_customer_name,'')) = '' THEN RAISE EXCEPTION 'Informe o nome do cliente'; END IF;

  IF _table_number IS NOT NULL THEN
    SELECT * INTO tbl FROM public.restaurant_tables WHERE establishment_id = est.id AND number = _table_number;
  END IF;

  new_code := to_char(now(),'YYMMDD') || lpad((floor(random()*10000))::text, 4, '0');

  INSERT INTO public.orders (establishment_id, code, channel, mode, status, customer_name, customer_phone,
                             table_id, table_number, address, payment_method, change_for, notes)
  VALUES (est.id, new_code,
          CASE WHEN _table_number IS NOT NULL THEN 'MESA'::public.order_channel ELSE 'CARDAPIO'::public.order_channel end,
          _mode, 'ENVIADO', left(trim(_customer_name),80), nullif(_customer_phone,''),
          tbl.id, _table_number, nullif(_address,''), _payment_method, _change_for, nullif(_notes,''))
  RETURNING id INTO new_order_id;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO prod FROM public.products
      WHERE id = (it->>'product_id')::uuid AND establishment_id = est.id AND available;
    IF prod.id IS NULL THEN RAISE EXCEPTION 'Produto indisponível'; END IF;

    qty := GREATEST(1, LEAST(99, COALESCE((it->>'quantity')::int, 1)));
    unit := COALESCE(prod.promo_price, prod.price);

    var := NULL;
    IF NULLIF(it->>'variation_id','') IS NOT NULL THEN
      SELECT * INTO var FROM public.product_variations
        WHERE id = (it->>'variation_id')::uuid AND product_id = prod.id;
      IF var.id IS NOT NULL THEN unit := unit + var.price_delta; END IF;
    END IF;

    SELECT ks.name INTO sector_name FROM public.kitchen_sectors ks WHERE ks.id = prod.sector_id;

    INSERT INTO public.order_items (order_id, establishment_id, product_id, product_name, variation_name,
                                    quantity, unit_price, sector, removed, notes)
    VALUES (new_order_id, est.id, prod.id, prod.name, var.name, qty, unit,
            lower(COALESCE(sector_name,'cozinha')),
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(it->'removed','[]'::jsonb))), '{}'),
            nullif(it->>'notes',''))
    RETURNING id INTO new_item_id;

    FOR opt_id IN SELECT (value #>> '{}')::uuid FROM jsonb_array_elements(COALESCE(it->'option_item_ids','[]'::jsonb)) LOOP
      SELECT * INTO oi FROM public.option_items WHERE id = opt_id AND establishment_id = est.id AND available;
      IF oi.id IS NOT NULL THEN
        SELECT name INTO og_name FROM public.option_groups WHERE id = oi.option_group_id;
        INSERT INTO public.order_item_options (order_item_id, establishment_id, group_name, item_name, price)
        VALUES (new_item_id, est.id, COALESCE(og_name,''), oi.name, oi.price);
        unit := unit + oi.price;
      END IF;
    END LOOP;

    UPDATE public.order_items SET unit_price = unit WHERE id = new_item_id;
    sub := sub + unit * qty;
  END LOOP;

  IF _mode = 'LOCAL' THEN svc := round(sub * est.service_fee_percentage / 100, 2); END IF;

  UPDATE public.orders
     SET subtotal = sub, service_fee = svc, total = sub + svc
   WHERE id = new_order_id;

  IF tbl.id IS NOT NULL THEN
    UPDATE public.restaurant_tables
       SET status = 'PREPARANDO',
           opened_at = COALESCE(opened_at, now()),
           current_total = current_total + sub + svc
     WHERE id = tbl.id;
  END IF;

  RETURN jsonb_build_object('code', new_code, 'total', sub + svc);
END; $$;
REVOKE EXECUTE ON FUNCTION public.place_order(text, public.order_mode, public.payment_method, text, text, text, integer, text, numeric, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(text, public.order_mode, public.payment_method, text, text, text, integer, text, numeric, jsonb) TO anon, authenticated;

-- Acompanhamento público por código (somente dados não sensíveis)
CREATE OR REPLACE FUNCTION public.get_order_tracking(_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'code', o.code,
    'status', o.status,
    'mode', o.mode,
    'created_at', o.created_at,
    'total', o.total,
    'subtotal', o.subtotal,
    'service_fee', o.service_fee,
    'delivery_fee', o.delivery_fee,
    'discount', o.discount,
    'table_number', o.table_number,
    'customer_first_name', split_part(o.customer_name,' ',1),
    'establishment', jsonb_build_object('name', e.name, 'slug', e.slug, 'eta_min', e.estimated_time_min, 'eta_max', e.estimated_time_max),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', i.product_name, 'variation', i.variation_name,
                'quantity', i.quantity, 'unit_price', i.unit_price) ORDER BY i.position)
              FROM public.order_items i WHERE i.order_id = o.id), '[]'::jsonb),
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', s.status, 'at', s.created_at) ORDER BY s.created_at)
              FROM public.order_status_events s WHERE s.order_id = o.id), '[]'::jsonb)
  )
  FROM public.orders o JOIN public.establishments e ON e.id = o.establishment_id
  WHERE o.code = _code
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_order_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(text) TO anon, authenticated;

-- Mesas demo do Nexa Burger
DO $$
DECLARE est uuid;
BEGIN
  SELECT id INTO est FROM public.establishments WHERE slug = 'nexa-burger' LIMIT 1;
  IF est IS NULL THEN RETURN; END IF;
  INSERT INTO public.restaurant_tables (establishment_id, number, seats)
  SELECT est, n, CASE WHEN n % 3 = 0 THEN 6 WHEN n % 2 = 0 THEN 4 ELSE 2 END
  FROM generate_series(1,12) n
  ON CONFLICT (establishment_id, number) DO NOTHING;
END $$;