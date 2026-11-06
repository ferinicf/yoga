-- Marea · esquema inicial
-- Un solo estudio. Las reglas de negocio viven en funciones (RPC) `security definer`
-- para que un alumno no pueda darse créditos ni saltarse límites desde el navegador.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tipos
create type public.role as enum ('admin', 'teacher', 'student');
create type public.session_status as enum ('scheduled', 'cancelled');
create type public.membership_status as enum ('active', 'pending_payment', 'cancelled');
create type public.payment_method as enum ('efectivo', 'tarjeta', 'transferencia', 'en_linea');
create type public.sale_status as enum ('paid', 'pending', 'refunded');
create type public.reservation_status as enum ('booked', 'waitlist', 'cancelled', 'attended', 'no_show');

-- ---------------------------------------------------------------- tablas
create table public.settings (
  id int primary key default 1 check (id = 1),
  studio_name text not null,
  tagline text not null default '',
  brand_color text not null default '#5B7F6E',
  address text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  instagram text not null default '',
  cancel_hours int not null default 8,
  booking_window_days int not null default 14,
  day_limit int,
  week_limit int,
  waitlist_enabled boolean not null default true,
  spot_selection boolean not null default true,
  allow_guests boolean not null default true,
  allow_pay_at_studio boolean not null default true,
  no_show_penalty boolean not null default true,
  currency text not null default 'MXN',
  timezone text not null default 'America/Mexico_City',
  -- Quien se registre con uno de estos correos entra como administrador.
  admin_emails text[] not null default '{}'
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users on delete set null,
  name text not null,
  email text not null unique,
  phone text not null default '',
  role public.role not null default 'student',
  code text not null unique,
  color text not null default '#7C9A92',
  bio text,
  notes text,
  birthday date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.disciplines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  color text not null,
  duration_min int not null default 60,
  level text not null default 'Todos los niveles',
  active boolean not null default true
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rows int not null check (rows between 1 and 26),
  cols int not null check (cols between 1 and 30),
  blocked_spots text[] not null default '{}'
);

create table public.class_templates (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines,
  teacher_id uuid not null references public.profiles,
  room_id uuid not null references public.rooms,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  duration_min int not null,
  capacity int not null,
  active boolean not null default true
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.class_templates on delete set null,
  detached boolean not null default false,
  discipline_id uuid not null references public.disciplines,
  teacher_id uuid not null references public.profiles,
  room_id uuid not null references public.rooms,
  starts_at timestamptz not null,
  duration_min int not null,
  capacity int not null,
  status public.session_status not null default 'scheduled',
  notes text
);
create index on public.sessions (starts_at);
create unique index sessions_template_day on public.sessions (template_id, starts_at);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null,
  credits int,
  validity_days int not null,
  discipline_ids uuid[] not null default '{}',
  max_per_member int,
  featured boolean not null default false,
  active boolean not null default true
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent', 'amount')),
  value numeric(10,2) not null,
  active boolean not null default true,
  max_uses int,
  uses int not null default 0,
  expires_at timestamptz
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  concept text not null,
  subtotal numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  coupon_code text,
  method public.payment_method not null,
  status public.sale_status not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  plan_id uuid not null references public.plans,
  plan_name text not null,
  credits int,
  credits_used int not null default 0,
  discipline_ids uuid[] not null default '{}',
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status public.membership_status not null,
  sale_id uuid references public.sales,
  created_at timestamptz not null default now()
);
create index on public.memberships (user_id);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  user_id uuid not null references public.profiles,
  spot text,
  status public.reservation_status not null,
  membership_id uuid references public.memberships,
  guest_name text,
  late_cancel boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.reservations (session_id);
create index on public.reservations (user_id);
create unique index reservations_spot_unique on public.reservations (session_id, spot)
  where spot is not null and status in ('booked', 'attended', 'no_show');
create unique index reservations_user_unique on public.reservations (session_id, user_id)
  where guest_name is null and status <> 'cancelled';

-- ---------------------------------------------------------------- utilidades
create or replace function public.me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where auth_id = auth.uid()
$$;

create or replace function public.my_role() returns public.role
language sql stable security definer set search_path = public as $$
  select role from profiles where auth_id = auth.uid() and active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'admin', false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('admin', 'teacher'), false)
$$;

create or replace function public._new_code() returns text
language plpgsql volatile set search_path = public as $$
declare c text;
begin
  loop
    c := (1000 + floor(random() * 9000))::int::text;
    exit when not exists (select 1 from profiles where code = c);
  end loop;
  return c;
end $$;

create or replace function public._room_spots(p_room uuid) returns text[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(s order by r, c), '{}')
  from rooms rm,
       generate_series(0, rm.rows - 1) r,
       generate_series(0, rm.cols - 1) c,
       lateral (select chr(65 + r) || (c + 1)::text as s) x
  where rm.id = p_room and not (x.s = any (rm.blocked_spots))
$$;

create or replace function public._occupied(p_session uuid) returns int
language sql stable set search_path = public as $$
  select count(*)::int from reservations
  where session_id = p_session and status in ('booked', 'attended', 'no_show')
$$;

create or replace function public._free_spots(p_session uuid) returns text[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(s order by n), '{}') from unnest(
    public._room_spots((select room_id from sessions where id = p_session))
  ) with ordinality as t(s, n)
  where s not in (
    select spot from reservations
    where session_id = p_session and spot is not null and status in ('booked', 'attended', 'no_show')
  )
$$;

create or replace function public._pick_membership(p_user uuid, p_session uuid) returns public.memberships
language sql stable set search_path = public as $$
  select m.* from memberships m, sessions s
  where s.id = p_session and m.user_id = p_user and m.status = 'active'
    and m.starts_at::date <= s.starts_at::date
    and m.expires_at >= s.starts_at
    and (m.credits is null or m.credits_used < m.credits)
    and (cardinality(m.discipline_ids) = 0 or s.discipline_id = any (m.discipline_ids))
  order by m.expires_at
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
    m := public._pick_membership(w.user_id, p_session);
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

-- ---------------------------------------------------------------- alta de usuarios
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean;
  v_id uuid;
begin
  select exists (
    select 1 from settings, unnest(admin_emails) e where lower(e) = lower(new.email)
  ) into v_admin;

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- horario
-- Genera las clases de los próximos días a partir del horario recurrente (idempotente).
create or replace function public.ensure_sessions(p_days int default 42) returns int
language plpgsql security definer set search_path = public as $$
declare
  tz text := (select timezone from settings where id = 1);
  n int;
begin
  insert into sessions (template_id, discipline_id, teacher_id, room_id, starts_at, duration_min, capacity)
  select t.id, t.discipline_id, t.teacher_id, t.room_id,
         (d::date + t.start_time) at time zone tz,
         t.duration_min, t.capacity
  from class_templates t,
       generate_series((now() at time zone tz)::date, (now() at time zone tz)::date + p_days, interval '1 day') d
  where t.active and extract(dow from d) = t.weekday
    and (d::date + t.start_time) at time zone tz > now()
  on conflict (template_id, starts_at) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Información pública de ocupación (sin datos personales de otros alumnos).
create or replace function public.session_stats(p_from timestamptz, p_to timestamptz)
returns table (session_id uuid, occupied int, waitlist int, taken_spots text[])
language sql stable security definer set search_path = public as $$
  select s.id,
    count(*) filter (where r.status in ('booked', 'attended', 'no_show'))::int,
    count(*) filter (where r.status = 'waitlist')::int,
    coalesce(array_agg(r.spot) filter (where r.spot is not null and r.status in ('booked', 'attended', 'no_show')), '{}')
  from sessions s
  left join reservations r on r.session_id = s.id
  where s.starts_at between p_from and p_to
  group by s.id
$$;

-- ---------------------------------------------------------------- reservas
create or replace function public.book_session(
  p_session uuid, p_user uuid default null, p_spot text default null, p_guest text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := me();
  v_staff boolean := is_staff();
  v_user uuid;
  s sessions;
  st settings;
  m memberships;
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

  if p_guest is null and exists (
    select 1 from reservations where session_id = s.id and user_id = v_user and guest_name is null and status <> 'cancelled'
  ) then
    return json_build_object('ok', false, 'message', 'Ya tienes un lugar en esta clase.');
  end if;

  if p_guest is null and not v_staff then
    if st.day_limit is not null then
      select count(*) into n from reservations r join sessions x on x.id = r.session_id
      where r.user_id = v_user and r.guest_name is null and r.status in ('booked', 'attended', 'no_show')
        and date_trunc('day', x.starts_at at time zone st.timezone) = date_trunc('day', v_local);
      if n >= st.day_limit then
        return json_build_object('ok', false, 'message', format('Límite de %s reservación(es) por día.', st.day_limit));
      end if;
    end if;
    if st.week_limit is not null then
      select count(*) into n from reservations r join sessions x on x.id = r.session_id
      where r.user_id = v_user and r.guest_name is null and r.status in ('booked', 'attended', 'no_show')
        and date_trunc('week', x.starts_at at time zone st.timezone) = date_trunc('week', v_local);
      if n >= st.week_limit then
        return json_build_object('ok', false, 'message', format('Límite de %s reservaciones por semana.', st.week_limit));
      end if;
    end if;
  end if;

  if p_guest is not null and not st.allow_guests then
    return json_build_object('ok', false, 'message', 'El estudio no permite invitados.');
  end if;

  m := public._pick_membership(v_user, s.id);
  if m.id is null then
    return json_build_object('ok', false, 'needsPlan', true,
      'message', 'No tienes créditos vigentes para esta clase. Compra un paquete para reservar.');
  end if;

  if public._occupied(s.id) >= s.capacity then
    if not st.waitlist_enabled then return json_build_object('ok', false, 'message', 'La clase está llena.'); end if;
    insert into reservations (session_id, user_id, status, guest_name)
    values (s.id, v_user, 'waitlist', p_guest) returning id into v_id;
    return json_build_object('ok', true, 'id', v_id, 'status', 'waitlist',
      'message', 'La clase está llena. Te agregamos a la lista de espera.');
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
  values (s.id, v_user, 'booked', m.id, v_spot, p_guest) returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'status', 'booked', 'message', '¡Reservación confirmada!');
exception when unique_violation then
  return json_build_object('ok', false, 'message', 'Ese lugar ya fue tomado, elige otro.');
end $$;

create or replace function public.cancel_reservation(p_id uuid, p_refund boolean default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_staff boolean := is_staff();
  r reservations;
  s sessions;
  st settings;
  v_wait boolean;
  v_refund boolean;
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
  v_wait := r.status = 'waitlist';
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
  if v_wait then return json_build_object('ok', true, 'message', 'Saliste de la lista de espera.'); end if;
  if v_refund then return json_build_object('ok', true, 'message', 'Reservación cancelada. Te devolvimos tu crédito.'); end if;
  return json_build_object('ok', true, 'message',
    format('Cancelación tardía (menos de %s h): el crédito no se reembolsa.', st.cancel_hours));
end $$;

create or replace function public.set_attendance(p_id uuid, p_status public.reservation_status) returns json
language plpgsql security definer set search_path = public as $$
declare
  r reservations;
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
  u profiles;
  r reservations;
  res json;
begin
  if not is_staff() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  select * into u from profiles where code = trim(p_code) and role = 'student';
  if u.id is null then return json_build_object('ok', false, 'message', 'No encontramos un alumno con ese código.'); end if;
  select * into r from reservations
  where session_id = p_session and user_id = u.id and guest_name is null and status <> 'cancelled';
  if r.id is not null then
    if r.status = 'waitlist' then
      return json_build_object('ok', false, 'message', format('%s está en lista de espera, no tiene lugar confirmado.', u.name));
    end if;
    perform public.set_attendance(r.id, 'attended');
    return json_build_object('ok', true, 'message',
      format('Check-in de %s%s.', u.name, coalesce(' · lugar ' || r.spot, '')));
  end if;
  res := public.book_session(p_session, u.id);
  if not (res->>'ok')::boolean then
    return json_build_object('ok', false, 'message', u.name || ': ' || (res->>'message'));
  end if;
  if res->>'status' = 'waitlist' then
    delete from reservations where id = (res->>'id')::uuid;
    return json_build_object('ok', false, 'message', 'La clase está llena.');
  end if;
  update reservations set status = 'attended', updated_at = now() where id = (res->>'id')::uuid;
  return json_build_object('ok', true, 'message', format('%s agregado/a a la clase y con check-in.', u.name));
end $$;

-- ---------------------------------------------------------------- ventas
create or replace function public.quote_coupon(p_code text, p_subtotal numeric) returns json
language plpgsql stable security definer set search_path = public as $$
declare c coupons; d numeric;
begin
  if p_code is null or trim(p_code) = '' then return json_build_object('discount', 0); end if;
  select * into c from coupons where upper(code) = upper(trim(p_code));
  if c.id is null or not c.active then return json_build_object('discount', 0, 'error', 'Cupón no válido.'); end if;
  if c.expires_at is not null and c.expires_at < now() then return json_build_object('discount', 0, 'error', 'El cupón ya venció.'); end if;
  if c.max_uses is not null and c.uses >= c.max_uses then return json_build_object('discount', 0, 'error', 'El cupón ya se agotó.'); end if;
  d := case when c.kind = 'percent' then round(p_subtotal * c.value / 100) else c.value end;
  return json_build_object('discount', least(d, p_subtotal), 'couponId', c.id);
end $$;

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

create or replace function public.confirm_sale(p_sale uuid, p_method public.payment_method default null) returns json
language plpgsql security definer set search_path = public as $$
declare s sales; m memberships; p plans;
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  update sales set status = 'paid', method = coalesce(p_method, method) where id = p_sale returning * into s;
  if s.id is null then return json_build_object('ok', false, 'message', 'Venta no encontrada.'); end if;
  select * into m from memberships where sale_id = s.id and status = 'pending_payment';
  if m.id is not null then
    select * into p from plans where id = m.plan_id;
    update memberships set status = 'active', starts_at = now(),
      expires_at = now() + make_interval(days => coalesce(p.validity_days, 30))
    where id = m.id;
  end if;
  return json_build_object('ok', true, 'message', 'Pago confirmado.');
end $$;

create or replace function public.refund_sale(p_sale uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  update sales set status = 'refunded' where id = p_sale;
  update memberships set status = 'cancelled' where sale_id = p_sale;
  return json_build_object('ok', true, 'message', 'Venta reembolsada.');
end $$;

create or replace function public.adjust_credits(p_membership uuid, p_delta int) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  update memberships set credits = greatest(credits_used, credits + p_delta)
  where id = p_membership and credits is not null;
  return json_build_object('ok', true, 'message', 'Créditos actualizados.');
end $$;

create or replace function public.extend_membership(p_membership uuid, p_days int) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  update memberships set expires_at = expires_at + make_interval(days => p_days) where id = p_membership;
  return json_build_object('ok', true, 'message', 'Vigencia extendida.');
end $$;

-- ---------------------------------------------------------------- perfiles
create or replace function public.update_my_profile(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
begin
  update profiles set
    name = coalesce(nullif(p->>'name', ''), name),
    phone = coalesce(p->>'phone', phone),
    birthday = nullif(p->>'birthday', '')::date,
    bio = case when role = 'student' then bio else coalesce(p->>'bio', bio) end
  where auth_id = auth.uid();
  return json_build_object('ok', true, 'message', 'Datos actualizados.');
end $$;

create or replace function public.admin_save_profile(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  if p->>'id' is not null and exists (select 1 from profiles where id = (p->>'id')::uuid) then
    update profiles set
      name = p->>'name', email = lower(p->>'email'), phone = coalesce(p->>'phone', ''),
      role = (p->>'role')::role, color = coalesce(p->>'color', color),
      bio = p->>'bio', notes = p->>'notes', birthday = nullif(p->>'birthday', '')::date,
      active = coalesce((p->>'active')::boolean, true),
      code = coalesce(nullif(p->>'code', ''), code)
    where id = (p->>'id')::uuid
    returning id into v_id;
  else
    insert into profiles (name, email, phone, role, color, bio, notes, birthday, active, code)
    values (p->>'name', lower(p->>'email'), coalesce(p->>'phone', ''), coalesce((p->>'role')::role, 'student'),
            coalesce(p->>'color', '#7C9A92'), p->>'bio', p->>'notes', nullif(p->>'birthday', '')::date,
            coalesce((p->>'active')::boolean, true),
            case when exists (select 1 from profiles where code = p->>'code') or coalesce(p->>'code', '') = ''
                 then public._new_code() else p->>'code' end)
    returning id into v_id;
  end if;
  return json_build_object('ok', true, 'id', v_id, 'message', 'Guardado.');
exception when unique_violation then
  return json_build_object('ok', false, 'message', 'Ya existe una persona con ese correo o código.');
end $$;

-- ---------------------------------------------------------------- administración de clases
create or replace function public.save_template(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  t class_templates;
  prev class_templates;
  v_moved boolean;
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  if p->>'id' is not null then select * into prev from class_templates where id = (p->>'id')::uuid; end if;
  if prev.id is not null then
    update class_templates set
      discipline_id = (p->>'disciplineId')::uuid, teacher_id = (p->>'teacherId')::uuid, room_id = (p->>'roomId')::uuid,
      weekday = (p->>'weekday')::smallint, start_time = (p->>'startTime')::time,
      duration_min = (p->>'durationMin')::int, capacity = (p->>'capacity')::int,
      active = coalesce((p->>'active')::boolean, true)
    where id = prev.id returning * into t;
  else
    insert into class_templates (discipline_id, teacher_id, room_id, weekday, start_time, duration_min, capacity, active)
    values ((p->>'disciplineId')::uuid, (p->>'teacherId')::uuid, (p->>'roomId')::uuid, (p->>'weekday')::smallint,
            (p->>'startTime')::time, (p->>'durationMin')::int, (p->>'capacity')::int, coalesce((p->>'active')::boolean, true))
    returning * into t;
  end if;

  v_moved := prev.id is not null and (prev.weekday <> t.weekday or prev.start_time <> t.start_time or not t.active);
  if v_moved then
    delete from sessions s where s.template_id = t.id and not s.detached and s.starts_at > now()
      and not exists (select 1 from reservations r where r.session_id = s.id and r.status <> 'cancelled');
  else
    update sessions set discipline_id = t.discipline_id, teacher_id = t.teacher_id, room_id = t.room_id,
      duration_min = t.duration_min, capacity = t.capacity
    where template_id = t.id and not detached and starts_at > now();
  end if;
  perform public.ensure_sessions(42);
  return json_build_object('ok', true, 'id', t.id, 'message', 'Horario guardado.');
end $$;

create or replace function public.delete_template(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  update class_templates set active = false where id = p_id;
  delete from sessions s where s.template_id = p_id and not s.detached and s.starts_at > now()
    and not exists (select 1 from reservations r where r.session_id = s.id and r.status <> 'cancelled');
  return json_build_object('ok', true, 'message', 'Clase recurrente desactivada.');
end $$;

create or replace function public.save_session(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  prev sessions;
  v_id uuid;
  v_valid text[];
  r record;
  v_used text[] := '{}';
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  if p->>'id' is not null then select * into prev from sessions where id = (p->>'id')::uuid; end if;
  if prev.id is not null then
    update sessions set
      discipline_id = (p->>'disciplineId')::uuid, teacher_id = (p->>'teacherId')::uuid, room_id = (p->>'roomId')::uuid,
      starts_at = (p->>'startsAt')::timestamptz, duration_min = (p->>'durationMin')::int,
      capacity = (p->>'capacity')::int, notes = p->>'notes',
      detached = (template_id is not null) or detached
    where id = prev.id returning id into v_id;
    -- Si cambió el salón, conserva los lugares válidos y reasigna el resto.
    if prev.room_id <> (p->>'roomId')::uuid then
      v_valid := public._room_spots((p->>'roomId')::uuid);
      for r in select id, spot from reservations
               where session_id = v_id and status in ('booked', 'attended', 'no_show') order by created_at loop
        if r.spot = any (v_valid) and not (r.spot = any (v_used)) then
          v_used := v_used || r.spot;
        else
          update reservations set spot = (select s from unnest(v_valid) s where not (s = any (v_used)) limit 1)
          where id = r.id;
          v_used := v_used || (select spot from reservations where id = r.id);
        end if;
      end loop;
    end if;
  else
    insert into sessions (discipline_id, teacher_id, room_id, starts_at, duration_min, capacity, notes)
    values ((p->>'disciplineId')::uuid, (p->>'teacherId')::uuid, (p->>'roomId')::uuid, (p->>'startsAt')::timestamptz,
            (p->>'durationMin')::int, (p->>'capacity')::int, p->>'notes')
    returning id into v_id;
  end if;
  return json_build_object('ok', true, 'id', v_id, 'message', 'Clase guardada.');
end $$;

create or replace function public.cancel_session(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  update memberships m set credits_used = greatest(0, m.credits_used - x.n)
  from (select membership_id, count(*)::int n from reservations
        where session_id = p_id and status in ('booked', 'attended', 'no_show') and membership_id is not null
        group by membership_id) x
  where m.id = x.membership_id;
  update reservations set status = 'cancelled', updated_at = now() where session_id = p_id and status <> 'cancelled';
  update sessions set status = 'cancelled', detached = true where id = p_id;
  return json_build_object('ok', true, 'message', 'Clase cancelada y créditos devueltos.');
end $$;

create or replace function public.restore_session(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  update sessions set status = 'scheduled' where id = p_id;
  return json_build_object('ok', true, 'message', 'Clase reactivada.');
end $$;

-- ---------------------------------------------------------------- seguridad (RLS)
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.disciplines enable row level security;
alter table public.rooms enable row level security;
alter table public.class_templates enable row level security;
alter table public.sessions enable row level security;
alter table public.plans enable row level security;
alter table public.coupons enable row level security;
alter table public.sales enable row level security;
alter table public.memberships enable row level security;
alter table public.reservations enable row level security;

-- Catálogo público (horario, precios, disciplinas); solo admin escribe.
create policy "lectura publica" on public.settings for select using (true);
create policy "lectura publica" on public.disciplines for select using (true);
create policy "lectura publica" on public.rooms for select using (true);
create policy "lectura publica" on public.class_templates for select using (true);
create policy "lectura publica" on public.sessions for select using (true);
create policy "lectura publica" on public.plans for select using (true);
create policy "admin escribe" on public.settings for update using (is_admin()) with check (is_admin());
create policy "admin escribe" on public.disciplines for all using (is_admin()) with check (is_admin());
create policy "admin escribe" on public.rooms for all using (is_admin()) with check (is_admin());
create policy "admin escribe" on public.plans for all using (is_admin()) with check (is_admin());
create policy "admin todo" on public.coupons for all using (is_admin()) with check (is_admin());

-- Perfiles: cada quien el suyo; staff ve a todos; todos ven a los profesores.
create policy "ver perfiles" on public.profiles for select
  using (auth_id = auth.uid() or is_staff() or role in ('teacher', 'admin'));

-- Datos personales: el dueño o el staff.
create policy "propias o staff" on public.reservations for select using (user_id = me() or is_staff());
create policy "propias o staff" on public.memberships for select using (user_id = me() or is_staff());
create policy "propias o staff" on public.sales for select using (user_id = me() or is_staff());

-- Funciones internas: no se exponen.
revoke execute on function public._new_code, public._room_spots, public._occupied, public._free_spots,
  public._pick_membership, public._promote_waitlist, public.handle_new_user from public, anon, authenticated;
