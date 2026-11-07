-- Marea · 0009: solo la administración vende paquetes a otras personas o registra ventas ya pagadas.
-- Antes purchase_plan usaba is_staff() (admin O profesor): un profesor podía crear por la API una venta
-- "pagada" y un paquete activo para cualquier alumno (o para sí) sin cobrar, inscribirlo en sus clases y
-- así subir lo que se le paga. Ahora un profesor, como un alumno, solo aparta un paquete propio en estado
-- pendiente, que la administración confirma con confirm_sale (ya exigía is_admin()).
-- También quita el Instagram de ejemplo ("marea") que venía en la semilla de 0002.

CREATE OR REPLACE FUNCTION public.purchase_plan(p_plan uuid, p_user uuid DEFAULT NULL::uuid, p_method payment_method DEFAULT 'efectivo'::payment_method, p_coupon text DEFAULT NULL::text, p_pending boolean DEFAULT true, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := me();
  v_admin boolean := is_admin();
  v_user uuid;
  v_pending boolean;
  p plans;
  q json;
  v_disc numeric := 0;
  v_sale uuid;
  v_mem uuid;
  v_start timestamptz := coalesce(p_starts_at, now());
begin
  if v_me is null then return json_build_object('ok', false, 'message', 'Inicia sesión.'); end if;
  v_user := coalesce(p_user, v_me);
  if v_user <> v_me and not v_admin then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  -- Sin pasarela de pago todavía: lo que compra un alumno (o un profesor para sí) queda pendiente
  -- hasta que la administración lo confirme. Solo la administración vende a otros o registra ventas pagadas.
  v_pending := case when v_admin then p_pending else true end;
  select * into p from plans where id = p_plan and active;
  if p.id is null then return json_build_object('ok', false, 'message', 'Paquete no disponible.'); end if;
  if p.max_per_member is not null and (
    select count(*) from memberships where user_id = v_user and plan_id = p.id and status <> 'cancelled'
  ) >= p.max_per_member then
    return json_build_object('ok', false, 'message', format('Este paquete solo se puede comprar %s vez.', p.max_per_member));
  end if;
  if v_user = v_me and exists (
    select 1 from memberships where user_id = v_user and plan_id = p.id and status = 'pending_payment'
  ) then
    return json_build_object('ok', false, 'message', 'Ya tienes este paquete apartado. Págalo en recepción para activarlo.');
  end if;
  q := public.quote_coupon(p_coupon, p.price);
  if q->>'error' is not null then return json_build_object('ok', false, 'message', q->>'error'); end if;
  v_disc := (q->>'discount')::numeric;
  insert into sales (user_id, concept, subtotal, discount, total, coupon_code, method, status, created_by)
  values (v_user, p.name, p.price, v_disc, p.price - v_disc,
          case when q->>'couponId' is not null then upper(trim(p_coupon)) end,
          p_method, case when v_pending then 'pending'::sale_status else 'paid'::sale_status end, v_me)
  returning id into v_sale;
  insert into memberships (user_id, plan_id, plan_name, credits, discipline_ids, starts_at, expires_at, status, sale_id)
  values (v_user, p.id, p.name, p.credits, p.discipline_ids, v_start, v_start + make_interval(days => p.validity_days),
          case when v_pending then 'pending_payment'::membership_status else 'active'::membership_status end, v_sale)
  returning id into v_mem;
  if q->>'couponId' is not null then
    update coupons set uses = uses + 1 where id = (q->>'couponId')::uuid;
  end if;
  return json_build_object('ok', true, 'id', v_mem, 'message',
    case when v_pending then 'Tu paquete quedó apartado. Paga en recepción para activarlo.'
         else '¡Venta registrada! Los créditos ya están disponibles.' end);
end $function$;

update public.settings set instagram = '' where id = 1 and instagram = 'marea';
