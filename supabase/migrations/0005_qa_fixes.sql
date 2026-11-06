-- Marea · correcciones de QA (las mismas reglas que el modo demo en src/lib/rules.ts y src/lib/store.ts).
--  · Invitados: 1 por alumno y clase, sin nombres repetidos, solo con paquete de créditos.
--  · Paquete pendiente de pago: mensaje propio en lugar de "Compra un paquete".
--  · Mensajes para el personal en tercera persona.
--  · Check-in y pase de lista desde 60 min antes de la clase; nada en clases canceladas.
--  · "Quitar crédito" ya no responde ok cuando no cambia nada.
--  · Un alumno no aparta dos veces el mismo paquete sin pagarlo.
--  · Perfiles: nombre obligatorio, correo y teléfono válidos, cumpleaños no futuro.
--  · Privacidad: un alumno solo lee su perfil; del personal hay un directorio público
--    (nombre, rol, color y bio). Los correos de administradores dejan de ser públicos.

-- ---------------------------------------------------------------- membresías
-- Para un invitado solo sirve un paquete con créditos (el ilimitado es personal).
drop function if exists public._pick_membership(uuid, uuid);
create or replace function public._pick_membership(p_user uuid, p_session uuid, p_credits_only boolean default false)
returns public.memberships
language sql stable set search_path = public as $$
  select m.* from memberships m, sessions s
  where s.id = p_session and m.user_id = p_user and m.status = 'active'
    and m.starts_at::date <= s.starts_at::date
    and m.expires_at >= s.starts_at
    and (m.credits is null or m.credits_used < m.credits)
    and (not p_credits_only or m.credits is not null)
    and (cardinality(m.discipline_ids) = 0 or s.discipline_id = any (m.discipline_ids))
  order by m.expires_at
  limit 1
$$;

-- Paquete apartado (pendiente de pago en recepción) que cubriría la clase.
create or replace function public._pending_membership(p_user uuid, p_session uuid) returns public.memberships
language sql stable set search_path = public as $$
  select m.* from memberships m, sessions s
  where s.id = p_session and m.user_id = p_user and m.status = 'pending_payment'
    and (cardinality(m.discipline_ids) = 0 or s.discipline_id = any (m.discipline_ids))
  order by m.created_at
  limit 1
$$;

create or replace function public._promote_waitlist(p_session uuid) returns void
language plpgsql set search_path = public as $$
declare
  s sessions;
  w reservations;
  m memberships;
  st settings;
begin
  select * into st from settings where id = 1;
  if not st.waitlist_enabled then return; end if;
  select * into s from sessions where id = p_session;
  for w in
    select * from reservations where session_id = p_session and status = 'waitlist' order by created_at
  loop
    exit when public._occupied(p_session) >= s.capacity;
    m := public._pick_membership(w.user_id, p_session, w.guest_name is not null);
    continue when m.id is null;
    update memberships set credits_used = credits_used + 1 where id = m.id;
    update reservations set
      status = 'booked',
      membership_id = m.id,
      spot = case when st.spot_selection then (public._free_spots(p_session))[1] end,
      updated_at = now()
    where id = w.id;
  end loop;
end $$;

-- ---------------------------------------------------------------- reservas
create or replace function public.book_session(
  p_session uuid, p_user uuid default null, p_spot text default null, p_guest text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := me();
  v_staff boolean := is_staff();
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
  if v_user <> v_me and not v_staff then
    return json_build_object('ok', false, 'message', 'No autorizado.');
  end if;
  v_other := v_staff and v_user <> v_me;
  select name into v_name from profiles where id = v_user;
  select * into st from settings where id = 1;
  select * into s from sessions where id = p_session for update;
  if s.id is null then return json_build_object('ok', false, 'message', 'Clase no encontrada.'); end if;
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

create or replace function public.cancel_reservation(p_id uuid, p_refund boolean default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_staff boolean := is_staff();
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
  if r.id is null or (r.user_id <> me() and not v_staff) then
    return json_build_object('ok', false, 'message', 'Reservación no encontrada.');
  end if;
  if r.status = 'cancelled' then return json_build_object('ok', false, 'message', 'Ya estaba cancelada.'); end if;
  select * into s from sessions where id = r.session_id for update;
  select * into st from settings where id = 1;
  if not v_staff and s.starts_at <= now() then
    return json_build_object('ok', false, 'message', 'La clase ya comenzó; no se puede cancelar.');
  end if;
  v_other := v_staff and r.user_id is distinct from me();
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
-- Asistencia o falta solo desde 60 min antes de la clase (quitar la marca se puede siempre).
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
  if r.id is null or r.status not in ('booked', 'attended', 'no_show') or r.status = p_status then
    return json_build_object('ok', true, 'message', 'Sin cambios.');
  end if;
  select * into s from sessions where id = r.session_id;
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
  if not st.no_show_penalty and r.membership_id is not null then
    if p_status = 'no_show' then
      update memberships set credits_used = greatest(0, credits_used - 1) where id = r.membership_id;
    elsif r.status = 'no_show' then
      update memberships set credits_used = credits_used + 1 where id = r.membership_id;
    end if;
  end if;
  update reservations set status = p_status, updated_at = now() where id = r.id;
  return json_build_object('ok', true, 'message', 'Asistencia actualizada.');
end $$;

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

-- ---------------------------------------------------------------- créditos
create or replace function public.adjust_credits(p_membership uuid, p_delta int) returns json
language plpgsql security definer set search_path = public as $$
declare m memberships;
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  select * into m from memberships where id = p_membership for update;
  if m.id is null then return json_build_object('ok', false, 'message', 'Paquete no encontrado.'); end if;
  if m.credits is null then
    return json_build_object('ok', false, 'message', 'Este paquete es ilimitado; no tiene créditos que ajustar.');
  end if;
  if m.credits + p_delta < m.credits_used then
    return json_build_object('ok', false, 'message', 'Este paquete ya no tiene créditos disponibles que quitar.');
  end if;
  update memberships set credits = credits + p_delta where id = m.id;
  return json_build_object('ok', true, 'message',
    case when p_delta > 0 then 'Crédito agregado.' when p_delta < 0 then 'Crédito retirado.' else 'Sin cambios.' end);
end $$;

-- ---------------------------------------------------------------- privacidad
-- Perfiles: cada quien el suyo; el personal ve a todos. Antes cualquiera (incluso sin sesión)
-- podía leer correo, teléfono, código, cumpleaños y notas del personal.
drop policy if exists "ver perfiles" on public.profiles;
drop policy if exists "propio o staff" on public.profiles;
create policy "propio o staff" on public.profiles for select using (auth_id = auth.uid() or is_staff());

-- Directorio público del personal: solo nombre, rol, color y bio.
create or replace function public.staff_directory()
returns table (id uuid, name text, role public.role, color text, bio text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.role, p.color, p.bio
  from profiles p
  where p.role in ('teacher', 'admin')
    and (p.active
         or exists (select 1 from sessions x where x.teacher_id = p.id)
         or exists (select 1 from class_templates t where t.teacher_id = p.id))
  order by p.name
$$;
revoke execute on function public.staff_directory() from public;
grant execute on function public.staff_directory() to anon, authenticated;

-- Correos que entran como administrador: ya no viven en settings (lectura pública).
create table if not exists public.private_settings (
  id int primary key default 1 check (id = 1),
  admin_emails text[] not null default '{}'
);
alter table public.private_settings enable row level security;
drop policy if exists "solo admin" on public.private_settings;
create policy "solo admin" on public.private_settings for all using (is_admin()) with check (is_admin());

insert into public.private_settings (id, admin_emails)
select 1, coalesce(admin_emails, '{}') from public.settings where id = 1
on conflict (id) do update set admin_emails = (
  select coalesce(array_agg(distinct e), '{}')
  from unnest(public.private_settings.admin_emails || excluded.admin_emails) e
);
update public.settings set admin_emails = '{}' where id = 1 and admin_emails <> '{}';

-- Si una versión anterior de la app guarda correos en settings, se mueven a private_settings.
create or replace function public._divert_admin_emails() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.admin_emails is not null and cardinality(new.admin_emails) > 0 then
    insert into private_settings (id, admin_emails) values (1, new.admin_emails)
    on conflict (id) do update set admin_emails = excluded.admin_emails;
    new.admin_emails := '{}';
  end if;
  return new;
end $$;
drop trigger if exists settings_divert_admin_emails on public.settings;
create trigger settings_divert_admin_emails
  before insert or update of admin_emails on public.settings
  for each row execute function public._divert_admin_emails();

create or replace function public._is_admin_email(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from private_settings, unnest(admin_emails) e where lower(e) = lower(p_email)
  ) or exists (
    select 1 from settings, unnest(admin_emails) e where lower(e) = lower(p_email)
  )
$$;

-- El rol de administrador solo se otorga cuando el correo está confirmado (igual que 0003).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean;
  v_id uuid;
begin
  v_admin := new.email_confirmed_at is not null and public._is_admin_email(new.email);

  update profiles set auth_id = new.id
  where lower(email) = lower(new.email) and auth_id is null
  returning id into v_id;

  if v_id is null then
    insert into profiles (auth_id, name, email, phone, role, code, color)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
      lower(new.email),
      coalesce(new.raw_user_meta_data->>'phone', ''),
      case when v_admin then 'admin'::role else 'student'::role end,
      public._new_code(),
      (array['#7C9A92','#C98B6B','#8E7CC3','#D4A373','#6B9AC4','#B5838D','#6D8B74','#E09F7D'])[1 + floor(random() * 8)::int]
    );
  elsif v_admin then
    update profiles set role = 'admin' where id = v_id;
  end if;
  return new;
end $$;

create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null and public._is_admin_email(new.email) then
    update profiles set role = 'admin' where auth_id = new.id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- compras
-- Igual que el modo demo: quien aparta un paquete no puede apartar el mismo otra vez sin pagarlo.
create or replace function public.purchase_plan(
  p_plan uuid,
  p_user uuid default null,
  p_method public.payment_method default 'efectivo',
  p_coupon text default null,
  p_pending boolean default true,
  p_starts_at timestamptz default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := me();
  v_staff boolean := is_staff();
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
  if v_user <> v_me and not v_staff then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  -- Sin pasarela de pago todavía: lo que compra un alumno queda pendiente hasta que recepción lo confirme.
  v_pending := case when v_staff then p_pending else true end;
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
end $$;

-- ---------------------------------------------------------------- perfiles
-- Mismas validaciones que profileError (src/lib/rules.ts): nombre, correo, teléfono y cumpleaños.
create or replace function public._profile_error(p_name text, p_email text, p_phone text, p_birthday date)
returns text
language plpgsql stable set search_path = public as $$
declare
  v_phone text := trim(coalesce(p_phone, ''));
  v_digits int := length(regexp_replace(v_phone, '\D', '', 'g'));
begin
  if trim(coalesce(p_name, '')) = '' then return 'El nombre no puede quedar vacío.'; end if;
  if p_email is not null and lower(trim(p_email)) !~ '^\S+@\S+\.\S+$' then return 'Escribe un correo válido.'; end if;
  if v_phone <> '' and (v_phone !~ '^[0-9 +()-]+$' or v_digits < 10 or v_digits > 15) then
    return 'Escribe un teléfono válido: 10 dígitos (puedes usar espacios, guiones o +52).';
  end if;
  if p_birthday > (now() at time zone coalesce((select timezone from settings where id = 1), 'America/Mexico_City'))::date then
    return 'La fecha de cumpleaños no puede ser futura.';
  end if;
  return null;
end $$;

-- El correo de la cuenta no se cambia aquí (es el del inicio de sesión).
create or replace function public.update_my_profile(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  v profiles;
  v_name text;
  v_phone text;
  v_birthday date;
  v_err text;
begin
  select * into v from profiles where auth_id = auth.uid();
  if v.id is null then return json_build_object('ok', false, 'message', 'Inicia sesión.'); end if;
  v_name := case when p ? 'name' then trim(p->>'name') else v.name end;
  v_phone := case when p ? 'phone' then trim(coalesce(p->>'phone', '')) else v.phone end;
  v_birthday := nullif(p->>'birthday', '')::date;
  v_err := public._profile_error(v_name, null, v_phone, v_birthday);
  if v_err is not null then return json_build_object('ok', false, 'message', v_err); end if;
  update profiles set
    name = v_name,
    phone = v_phone,
    birthday = v_birthday,
    bio = case when role = 'student' then bio else coalesce(p->>'bio', bio) end
  where id = v.id;
  return json_build_object('ok', true, 'message', 'Datos actualizados.');
end $$;

create or replace function public.admin_save_profile(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_err text;
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  v_err := public._profile_error(p->>'name', v_email, p->>'phone', nullif(p->>'birthday', '')::date);
  if v_err is not null then return json_build_object('ok', false, 'message', v_err); end if;
  if exists (select 1 from profiles where lower(email) = v_email and id is distinct from (p->>'id')::uuid) then
    return json_build_object('ok', false, 'message', 'Ya existe una persona con ese correo.');
  end if;
  if p->>'id' is not null and exists (select 1 from profiles where id = (p->>'id')::uuid) then
    update profiles set
      name = trim(p->>'name'), email = v_email, phone = trim(coalesce(p->>'phone', '')),
      role = (p->>'role')::role, color = coalesce(p->>'color', color),
      bio = p->>'bio', notes = p->>'notes', birthday = nullif(p->>'birthday', '')::date,
      active = coalesce((p->>'active')::boolean, true),
      code = coalesce(nullif(p->>'code', ''), code)
    where id = (p->>'id')::uuid
    returning id into v_id;
  else
    insert into profiles (id, name, email, phone, role, color, bio, notes, birthday, active, code)
    values (coalesce((p->>'id')::uuid, gen_random_uuid()), trim(p->>'name'), v_email, trim(coalesce(p->>'phone', '')),
            coalesce((p->>'role')::role, 'student'), coalesce(p->>'color', '#7C9A92'), p->>'bio', p->>'notes',
            nullif(p->>'birthday', '')::date, coalesce((p->>'active')::boolean, true),
            case when exists (select 1 from profiles where code = p->>'code') or coalesce(p->>'code', '') = ''
                 then public._new_code() else p->>'code' end)
    returning id into v_id;
  end if;
  return json_build_object('ok', true, 'id', v_id, 'message', 'Guardado.');
exception when unique_violation then
  return json_build_object('ok', false, 'message', 'Ya existe una persona con ese correo o código.');
end $$;

-- ---------------------------------------------------------------- datos
-- Check-ins hechos antes de tiempo (la app lo permitía): vuelven a "reservado".
update public.reservations r set status = 'booked', updated_at = now()
from public.sessions s
where s.id = r.session_id and r.status = 'attended' and now() < s.starts_at - interval '60 minutes';

-- Funciones internas: no se exponen.
revoke execute on function public._pick_membership(uuid, uuid, boolean), public._pending_membership(uuid, uuid),
  public._promote_waitlist(uuid), public._divert_admin_emails(), public._is_admin_email(text),
  public._profile_error(text, text, text, date),
  public.handle_new_user(), public.handle_user_confirmed() from public, anon, authenticated;
