REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_establishment_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.establishment_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_establishment_role(uuid, public.app_role[], uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_establishment(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_organization_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_establishment() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_establishment_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.establishment_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_establishment_role(uuid, public.app_role[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_establishment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_organization_access(uuid, uuid) TO authenticated;

INSERT INTO public.organizations (id, name, legal_name, document, status)
VALUES ('11111111-1111-4111-8111-111111111111', 'Nexa Alimentos', 'Nexa Alimentos LTDA', '12.345.678/0001-90', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.establishments (
  id, organization_id, name, slug, legal_name, cnpj, description, address, phone, whatsapp, email,
  status, is_open, minimum_order, estimated_time_min, estimated_time_max, service_fee_percentage
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Nexa Burger', 'nexa-burger', 'Nexa Burger Alimentacao LTDA', '12.345.678/0001-90',
  'Hamburgueria artesanal com blends exclusivos, porções e drinks autorais.',
  'Rua das Brasas, 240 — Vila Madalena, São Paulo/SP',
  '1133334444', '5511999998888', 'contato@nexaburger.com.br',
  'ACTIVE', true, 25, 35, 50, 10
) ON CONFLICT (slug) DO NOTHING;