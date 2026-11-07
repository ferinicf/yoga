-- Marea · ajustes a los pagos de profesores (mismas reglas que src/lib/payouts.ts y src/lib/store.ts).
--  · Cada falta guarda si gastó el crédito al marcarla (reservations.no_show_charged), con la
--    penalización vigente en ESE momento. Cambiar "Penalizar inasistencia" ya no reescribe
--    semanas pasadas (ni las ya pagadas) en teacher_balances.
--  · teacher_balances calcula en centavos enteros, igual que la app: cobro = alumnos × precio;
--    parte del profesor = round(cobro × % / 100) con el medio centavo hacia arriba.
--  · "Personal" de una clase = el admin, o el profesor DE ESA clase. Un profesor ya no puede
--    inscribir, quitar, pasar lista ni hacer check-in en clases de otros profesores (eso gastaba
--    el crédito del alumno y subía el pago de otro profesor). El profesor de la clase sí puede
--    registrar a quien llega sin reservar y pasar lista, aunque la clase ya haya empezado.

-- ---------------------------------------------------------------- faltas: ¿gastaron el crédito?
alter table public.reservations add column if not exists no_show_charged boolean;
comment on column public.reservations.no_show_charged is
  'Solo faltas (no_show): true si la falta gastó el crédito (penalización activa al marcarla). null en otros estados.';

-- Faltas que ya existían: se toma la configuración actual (lo más cercano a lo que pasó).
update public.reservations
set no_show_charged = coalesce((select no_show_penalty from public.settings where id = 1), true) or membership_id is null
where status = 'no_show' and no_show_charged is null;

-- ---------------------------------------------------------------- reservas
-- Igual que 0005, salvo la autorización: v_staff = admin, o el profesor de ESTA clase.
create or replace function public.book_session(
  p_session uuid, p_user uuid default null, p_spot text default null, p_guest text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := me();
  v_staff boolean;
  v_user uuid;
  -- El personal reserva por alguien más: los mensajes hablan del alumno en tercera persona.
  v_other boolean;
  v_name text;
  v_guest text := regexp_replace(trim(p_guest), '\s+', ' ', 'g');
  s sessions;
  st settings;
  m memberships;
  v_pending memberships;
  v_local timestamp;
  v_now_local timestamp;
  n int;
  v_spot text;
  v_id uuid;
begin
  if v_me is null then return json_build_object('ok', false, 'message', 'Inicia sesión para reservar.'); end if;
  v_user := coalesce(p_user, v_me);
  select * into s from sessions where id = p_session for update;
  if s.id is null then return json_build_object('ok', false, 'message', 'Clase no encontrada.'); end if;
  -- Personal de ESTA clase: el admin en todas; un profesor solo en las suyas.
  v_staff := is_admin() or (is_staff() and s.teacher_id = v_me);
  if v_user <> v_me and not v_staff then
    return json_build_object('ok', false, 'message', 'No autorizado.');
  end if;
  v_other := v_staff and v_user <> v_me;
  select name into v_name from profiles where id = v_user;
  select * into st from settings where id = 1;
  if s.status = 'cancelled' then return json_build_object('ok', false, 'message', 'Esta clase fue cancelada.'); end if;

  v_local := s.starts_at at time zone st.timezone;
  v_now_local := now() at time zone st.timezone;

  if not v_staff then
    if s.starts_at <= now() then return json_build_object('ok', false, 'message', 'La clase ya comenzó.'); end if;
    if v_local >= date_trunc('day', v_now_local) + make_interval(days => st.booking_window_days + 1) then
      return json_build_object('ok', false, 'message', format('Solo puedes reservar con %s días de anticipación.', st.booking_window_days));
    end if;
  end if;

  if p_guest is not null then
    -- Los límites por día/semana y "ya tienes lugar" son solo para el alumno, no para su invitado.
    if not st.allow_guests then
      return json_build_object('ok', false, 'message', 'El estudio no permite invitados.');
    end if;
    if v_guest = '' then
      return json_build_object('ok', false, 'message', 'Escribe el nombre de tu invitado/a.');
    end if;
    if length(v_guest) > 60 then
      return json_build_object('ok', false, 'message', 'El nombre de tu invitado/a es demasiado largo.');
    end if;
    if (select count(*) from reservations
        where session_id = s.id and user_id = v_user and guest_name is not null and status <> 'cancelled') >= 1 then
      return json_build_object('ok', false, 'message',
        'Ya tienes un invitado/a en esta clase. Solo puedes traer a 1 persona por clase.');
    end if;
    if exists (
      select 1 from reservations
      where session_id = s.id and guest_name is not null and status <> 'cancelled'
        and lower(regexp_replace(trim(guest_name), '\s+', ' ', 'g')) = lower(v_guest)
    ) then
      return json_build_object('ok', false, 'message', 'Ya hay un invitado/a con ese nombre en esta clase.');
    end if;
  else
    if exists (
      select 1 from reservations where session_id = s.id and user_id = v_user and guest_name is null and status <> 'cancelled'
    ) then
      return json_build_object('ok', false, 'message',
        case when v_other then format('%s ya tiene lugar en esta clase.', v_name) else 'Ya tienes un lugar en esta clase.' end);
    end if;
    if not v_staff then
      if st.day_limit is not null then
        select count(*) into n from reservations r join sessions x on x.id = r.session_id
        where r.user_id = v_user and r.guest_name is null and r.status in ('booked', 'attended', 'no_show')
          and date_trunc('day', x.starts_at at time zone st.timezone) = date_trunc('day', v_local);
        if n >= st.day_limit then
          return json_build_object('ok', false, 'message', format('Llegaste al límite de %s %s por día.',
            st.day_limit, case when st.day_limit = 1 then 'reservación' else 'reservaciones' end));
        end if;
      end if;
      if st.week_limit is not null then
        select count(*) into n from reservations r join sessions x on x.id = r.session_id
        where r.user_id = v_user and r.guest_name is null and r.status in ('booked', 'attended', 'no_show')
          and date_trunc('week', x.starts_at at time zone st.timezone) = date_trunc('week', v_local);
        if n >= st.week_limit then
          return json_build_object('ok', false, 'message', format('Llegaste al límite de %s %s por semana.',
            st.week_limit, case when st.week_limit = 1 then 'reservación' else 'reservaciones' end));
        end if;
      end if;
    end if;
  end if;

  m := public._pick_membership(v_user, s.id, p_guest is not null);
  if m.id is null then
    if p_guest is not null and (public._pick_membership(v_user, s.id)).id is not null then
      return json_build_object('ok', false, 'message',
        'Tu paquete ilimitado no incluye invitados. Para traer a alguien necesitas un paquete con créditos.');
    end if;
    v_pending := public._pending_membership(v_user, s.id);
    if v_pending.id is not null then
      return json_build_object('ok', false, 'pending', true, 'message',
        case when v_other
          then format('%s no tiene créditos activos: su %s está pendiente de pago.', v_name, v_pending.plan_name)
          else format('Tu %s está pendiente de pago en recepción. Podrás reservar en cuanto el estudio confirme tu pago.', v_pending.plan_name)
        end);
    end if;
    if v_other then
      return json_build_object('ok', false, 'message', format('%s no tiene créditos vigentes para esta clase.', v_name));
    end if;
    return json_build_object('ok', false, 'needsPlan', true,
      'message', 'No tienes créditos vigentes para esta clase. Compra un paquete para reservar.');
  end if;

  if public._occupied(s.id) >= s.capacity then
    if not st.waitlist_enabled then return json_build_object('ok', false, 'message', 'La clase está llena.'); end if;
    insert into reservations (session_id, user_id, status, guest_name)
    values (s.id, v_user, 'waitlist', v_guest) returning id into v_id;
    return json_build_object('ok', true, 'id', v_id, 'status', 'waitlist', 'message',
      case
        when p_guest is not null then format('La clase está llena. %s quedó en lista de espera.', v_guest)
        when v_other then format('La clase está llena. %s quedó en lista de espera.', v_name)
        else 'La clase está llena. Te agregamos a la lista de espera.'
      end);
  end if;

  if st.spot_selection then
    if p_spot is not null then
      if not (p_spot = any (public._free_spots(s.id))) then
        return json_build_object('ok', false, 'message', 'Ese lugar ya fue tomado, elige otro.');
      end if;
      v_spot := p_spot;
    else
      v_spot := (public._free_spots(s.id))[1];
    end if;
  end if;

  update memberships set credits_used = credits_used + 1 where id = m.id;
  insert into reservations (session_id, user_id, status, membership_id, spot, guest_name)
  values (s.id, v_user, 'booked', m.id, v_spot, v_guest) returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'status', 'booked', 'message',
    case
      when p_guest is not null then format('¡Listo! Reservamos un lugar para %s%s.', v_guest, coalesce(' (lugar ' || v_spot || ')', ''))
      when v_other then format('%s quedó inscrito/a en la clase.', v_name)
      else '¡Reservación confirmada!'
    end);
exception when unique_violation then
  return json_build_object('ok', false, 'message', 'Ese lugar ya fue tomado, elige otro.');
end $$;

-- Igual que 0005, salvo la autorización: en clases ajenas un profesor recibe "Reservación no
-- encontrada." (como un alumno con reservaciones de otros). Sin sesión tampoco se cancela nada.
create or replace function public.cancel_reservation(p_id uuid, p_refund boolean default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := me();
  v_staff boolean;
  v_other boolean;
  r reservations;
  s sessions;
  st settings;
  m memberships;
  v_owner text;
  v_who text;
  v_head text;
  v_wait boolean;
  v_refund boolean;
  v_credit boolean;
  v_third boolean;
begin
  select * into r from reservations where id = p_id for update;
  if r.id is null or v_me is null then
    return json_build_object('ok', false, 'message', 'Reservación no encontrada.');
  end if;
  select * into s from sessions where id = r.session_id for update;
  -- Personal de ESTA clase: el admin en todas; un profesor solo en las suyas.
  v_staff := is_admin() or (is_staff() and s.teacher_id = v_me);
  if r.user_id is distinct from v_me and not v_staff then
    return json_build_object('ok', false, 'message', 'Reservación no encontrada.');
  end if;
  if r.status = 'cancelled' then return json_build_object('ok', false, 'message', 'Ya estaba cancelada.'); end if;
  select * into st from settings where id = 1;
  if not v_staff and s.starts_at <= now() then
    return json_build_object('ok', false, 'message', 'La clase ya comenzó; no se puede cancelar.');
  end if;
  v_other := v_staff and r.user_id is distinct from v_me;
  select name into v_owner from profiles where id = r.user_id;
  v_owner := coalesce(v_owner, 'el alumno');
  v_who := coalesce(r.guest_name, v_owner);
  select * into m from memberships where id = r.membership_id;
  v_credit := m.id is not null and m.credits is not null;
  v_wait := r.status = 'waitlist';
  -- Solo el personal puede decidir el reembolso; para el alumno depende de las horas que faltan.
  v_refund := case
    when v_wait then false
    when v_staff and p_refund is not null then p_refund
    else extract(epoch from s.starts_at - now()) / 3600 >= st.cancel_hours
  end;
  if v_refund and r.membership_id is not null then
    update memberships set credits_used = greatest(0, credits_used - 1) where id = r.membership_id;
  end if;
  update reservations set status = 'cancelled', late_cancel = (not v_wait and not v_refund), updated_at = now()
  where id = r.id;
  perform public._promote_waitlist(s.id);

  -- Mismos textos que cancelMessage (src/lib/rules.ts).
  v_third := v_other or r.guest_name is not null;
  if v_wait then
    return json_build_object('ok', true, 'message',
      case when v_third then format('%s salió de la lista de espera.', v_who) else 'Saliste de la lista de espera.' end);
  end if;
  if not v_credit then
    return json_build_object('ok', true, 'message',
      case when v_third then format('Se canceló la reservación de %s.', v_who) else 'Reservación cancelada.' end);
  end if;
  if v_other then
    v_head := case when r.guest_name is not null then format('Se canceló la reservación de %s.', r.guest_name)
                   else 'Se canceló la reservación.' end;
    return json_build_object('ok', true, 'message',
      case when v_refund then format('%s Se devolvió el crédito a %s.', v_head, v_owner)
           else format('%s No se devolvió el crédito a %s (cancelación tardía).', v_head, v_owner) end);
  end if;
  v_head := case when r.guest_name is not null then format('Cancelamos la reservación de %s.', r.guest_name)
                 else 'Reservación cancelada.' end;
  return json_build_object('ok', true, 'message',
    case when v_refund then v_head || ' Te devolvimos tu crédito.'
         else format('%s Como faltaban menos de %s h, no se devolvió el crédito.', v_head, st.cancel_hours) end);
end $$;

-- ---------------------------------------------------------------- asistencia
-- Igual que 0005, salvo: solo el admin o el profesor de ESTA clase pasan lista, y cada falta
-- guarda si gastó el crédito (no_show_charged). Quitar una falta vuelve a cobrar el crédito solo
-- si esa falta lo devolvió (antes se decidía con la configuración de hoy).
create or replace function public.set_attendance(p_id uuid, p_status public.reservation_status) returns json
language plpgsql security definer set search_path = public as $$
declare
  r reservations;
  s sessions;
  st settings;
begin
  if not is_staff() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  if p_status not in ('attended', 'no_show', 'booked') then
    return json_build_object('ok', false, 'message', 'Estado inválido.');
  end if;
  select * into r from reservations where id = p_id for update;
  if r.id is null then return json_build_object('ok', true, 'message', 'Sin cambios.'); end if;
  select * into s from sessions where id = r.session_id;
  -- Solo el admin o el profesor de ESTA clase.
  if not is_admin() and s.teacher_id is distinct from me() then
    return json_build_object('ok', false, 'message', 'No autorizado.');
  end if;
  if r.status not in ('booked', 'attended', 'no_show') or r.status = p_status then
    return json_build_object('ok', true, 'message', 'Sin cambios.');
  end if;
  if p_status <> 'booked' then
    if s.status = 'cancelled' then
      return json_build_object('ok', false, 'message', 'Esta clase fue cancelada.');
    end if;
    if now() < s.starts_at - interval '60 minutes' then
      return json_build_object('ok', false, 'message',
        'El check-in y el pase de lista se habilitan 60 minutos antes de que empiece la clase.');
    end if;
  end if;
  select * into st from settings where id = 1;
  if r.membership_id is not null then
    if p_status = 'no_show' and not st.no_show_penalty then
      -- Sin penalización, marcar falta devuelve el crédito.
      update memberships set credits_used = greatest(0, credits_used - 1) where id = r.membership_id;
    elsif r.status = 'no_show' and not coalesce(r.no_show_charged, st.no_show_penalty) then
      -- Quitar una falta que devolvió el crédito lo vuelve a cobrar.
      update memberships set credits_used = credits_used + 1 where id = r.membership_id;
    end if;
  end if;
  update reservations set
    status = p_status,
    no_show_charged = case when p_status = 'no_show' then st.no_show_penalty or r.membership_id is null end,
    updated_at = now()
  where id = r.id;
  return json_build_object('ok', true, 'message', 'Asistencia actualizada.');
end $$;

-- Igual que 0005, salvo la autorización: solo el admin o el profesor de ESTA clase. El profesor de
-- la clase sigue pudiendo registrar a quien llega sin reservar (book_session lo deja como personal).
create or replace function public.check_in_by_code(p_session uuid, p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  s sessions;
  u profiles;
  r reservations;
  res json;
begin
  if not is_staff() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  select * into s from sessions where id = p_session;
  if s.id is null then return json_build_object('ok', false, 'message', 'Clase no encontrada.'); end if;
  -- Solo el admin o el profesor de ESTA clase.
  if not is_admin() and s.teacher_id is distinct from me() then
    return json_build_object('ok', false, 'message', 'No autorizado.');
  end if;
  if s.status = 'cancelled' then return json_build_object('ok', false, 'message', 'Esta clase fue cancelada.'); end if;
  if now() < s.starts_at - interval '60 minutes' then
    return json_build_object('ok', false, 'message',
      'El check-in y el pase de lista se habilitan 60 minutos antes de que empiece la clase.');
  end if;
  select * into u from profiles where code = trim(p_code) and role = 'student';
  if u.id is null then return json_build_object('ok', false, 'message', 'No encontramos un alumno con ese código.'); end if;
  select * into r from reservations
  where session_id = p_session and user_id = u.id and guest_name is null and status <> 'cancelled';
  if r.id is not null then
    if r.status = 'waitlist' then
      return json_build_object('ok', false, 'message', format('%s está en lista de espera, no tiene lugar confirmado.', u.name));
    end if;
    res := public.set_attendance(r.id, 'attended');
    if not (res->>'ok')::boolean then return res; end if;
    return json_build_object('ok', true, 'message',
      format('Check-in de %s%s.', u.name, coalesce(' · lugar ' || r.spot, '')));
  end if;
  -- Sin reservación: se le agrega a la clase (los mensajes de book_session ya traen su nombre).
  res := public.book_session(p_session, u.id);
  if not (res->>'ok')::boolean then
    return json_build_object('ok', false, 'message', res->>'message');
  end if;
  if res->>'status' = 'waitlist' then
    delete from reservations where id = (res->>'id')::uuid;
    return json_build_object('ok', false, 'message', format('La clase está llena; no se pudo agregar a %s.', u.name));
  end if;
  update reservations set status = 'attended', updated_at = now() where id = (res->>'id')::uuid;
  return json_build_object('ok', true, 'message', format('%s quedó agregado/a a la clase con check-in.', u.name));
end $$;

-- ---------------------------------------------------------------- saldo de profesores
-- Lo que le toca a cada profesor por TODAS sus clases ya dadas (la app solo baja los últimos meses).
-- Mismo cálculo que classEarning() en src/lib/payouts.ts, en centavos enteros y por clase:
--   cobro = alumnos × precio · parte del profesor = round(cobro × % / 100) (medio centavo hacia arriba).
-- Una falta cuenta si gastó el crédito al marcarla (no_show_charged); solo si está vacío
-- (filas viejas) se usa la configuración actual.
create or replace function public.teacher_balances()
returns table (teacher_id uuid, earned numeric)
language sql stable security definer set search_path = public as $$
  with st as (select no_show_penalty, teacher_share from settings where id = 1),
  per_class as (
    select s.teacher_id,
           count(*) as students,
           coalesce(sp.teacher_rate, tr.rate, 0) as rate,
           coalesce(sp.teacher_share, (select teacher_share from st), 70) as share
    from sessions s
    join reservations r on r.session_id = s.id
    left join session_pay sp on sp.session_id = s.id
    left join teacher_rates tr on tr.teacher_id = s.teacher_id
    where s.status <> 'cancelled'
      and s.starts_at <= now()
      and (r.status in ('attended', 'booked')
           or (r.status = 'no_show' and coalesce(r.no_show_charged, (select no_show_penalty from st)))
           or (r.status = 'cancelled' and r.late_cancel))
      and (is_admin() or s.teacher_id = me())
    group by s.id, s.teacher_id, sp.teacher_rate, tr.rate, sp.teacher_share
  ),
  cents as (
    -- Todo en numeric (exacto): con double precision el medio centavo podría redondear al par.
    select teacher_id,
           round(students::numeric * round(rate::numeric * 100) * round(share::numeric * 100) / 10000) as teacher_cents
    from per_class
  )
  select teacher_id, round(sum(teacher_cents) / 100, 2) as earned
  from cents
  group by teacher_id
$$;

revoke execute on function public.teacher_balances() from public, anon;
grant execute on function public.teacher_balances() to authenticated;
