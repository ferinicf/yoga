-- Marea · pagos a profesores
-- Regla: cada profesor tiene su precio por alumno. Cada reservación que gastó crédito en una clase
-- ya empezada (asistió, reservada sin pase de lista, falta con penalización o cancelación tardía)
-- suma ese precio al cobro de la clase. El profesor se lleva teacher_share % (70 por omisión) y el
-- estudio el resto. Igual que src/lib/payouts.ts (modo demo).
-- Privacidad: los precios y pagos NO están en tablas públicas (sessions y settings se leen sin
-- sesión). El admin ve todo; cada profesor solo lo suyo; los alumnos nada.

-- ---------------------------------------------------------------- configuración
alter table public.settings
  add column if not exists teacher_share numeric(5,2) not null default 70 check (teacher_share between 0 and 100);

-- ---------------------------------------------------------------- precio de cada profesor
create table if not exists public.teacher_rates (
  teacher_id uuid primary key references public.profiles on delete cascade,
  rate numeric(10,2) not null default 0 check (rate >= 0),
  updated_at timestamptz not null default now()
);
alter table public.teacher_rates enable row level security;
drop policy if exists "admin todo" on public.teacher_rates;
create policy "admin todo" on public.teacher_rates for all using (is_admin()) with check (is_admin());
drop policy if exists "profesor ve el suyo" on public.teacher_rates;
create policy "profesor ve el suyo" on public.teacher_rates for select using (teacher_id = me());

-- ---------------------------------------------------------------- precio y % congelados por clase
create table if not exists public.session_pay (
  session_id uuid primary key references public.sessions on delete cascade,
  teacher_rate numeric(10,2) not null default 0,
  teacher_share numeric(5,2) not null default 70
);
alter table public.session_pay enable row level security;
drop policy if exists "admin todo" on public.session_pay;
create policy "admin todo" on public.session_pay for all using (is_admin()) with check (is_admin());
drop policy if exists "profesor ve sus clases" on public.session_pay;
create policy "profesor ve sus clases" on public.session_pay for select
  using (exists (select 1 from public.sessions s where s.id = session_id and s.teacher_id = me()));

-- Al crear una clase o cambiarle el profesor, se congela el precio y % vigentes.
create or replace function public._session_pay_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.teacher_id is distinct from old.teacher_id then
    insert into session_pay (session_id, teacher_rate, teacher_share)
    values (
      new.id,
      coalesce((select rate from teacher_rates where teacher_id = new.teacher_id), 0),
      coalesce((select teacher_share from settings where id = 1), 70)
    )
    on conflict (session_id) do update
      set teacher_rate = excluded.teacher_rate, teacher_share = excluded.teacher_share;
  end if;
  return new;
end $$;
drop trigger if exists sessions_pay_sync on public.sessions;
create trigger sessions_pay_sync
  after insert or update of teacher_id on public.sessions
  for each row execute function public._session_pay_sync();

-- Nuevo precio de un profesor: aplica a sus clases que aún no empiezan (las pasadas no cambian).
create or replace function public._rate_to_future_sessions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update session_pay sp set teacher_rate = new.rate
  from sessions s
  where s.id = sp.session_id and s.teacher_id = new.teacher_id and s.starts_at > now();
  return new;
end $$;
drop trigger if exists teacher_rates_future on public.teacher_rates;
create trigger teacher_rates_future
  after insert or update of rate on public.teacher_rates
  for each row execute function public._rate_to_future_sessions();

-- Nuevo % del profesor: aplica a clases que aún no empiezan.
create or replace function public._share_to_future_sessions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.teacher_share is distinct from old.teacher_share then
    update session_pay sp set teacher_share = new.teacher_share
    from sessions s
    where s.id = sp.session_id and s.starts_at > now();
  end if;
  return new;
end $$;
drop trigger if exists settings_share_future on public.settings;
create trigger settings_share_future
  after update of teacher_share on public.settings
  for each row execute function public._share_to_future_sessions();

-- Clases que ya existían: se les congela el precio actual (0 hasta que el admin lo defina).
insert into public.teacher_rates (teacher_id, rate)
select id, 0 from public.profiles where role = 'teacher'
on conflict (teacher_id) do nothing;
insert into public.session_pay (session_id, teacher_rate, teacher_share)
select s.id, coalesce(tr.rate, 0), coalesce((select teacher_share from public.settings where id = 1), 70)
from public.sessions s left join public.teacher_rates tr on tr.teacher_id = s.teacher_id
on conflict (session_id) do nothing;

-- ---------------------------------------------------------------- pagos
create table if not exists public.teacher_payouts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles,
  amount numeric(10,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  period_end date,
  method public.payment_method not null default 'transferencia',
  notes text,
  created_by uuid references public.profiles,
  created_at timestamptz not null default now()
);
create index if not exists teacher_payouts_teacher on public.teacher_payouts (teacher_id, paid_at desc);
alter table public.teacher_payouts enable row level security;
drop policy if exists "admin todo" on public.teacher_payouts;
create policy "admin todo" on public.teacher_payouts for all using (is_admin()) with check (is_admin());
drop policy if exists "profesor ve los suyos" on public.teacher_payouts;
create policy "profesor ve los suyos" on public.teacher_payouts for select using (teacher_id = me());

create or replace function public.record_payout(
  p_teacher uuid,
  p_amount numeric,
  p_method public.payment_method default 'transferencia',
  p_period_end date default null,
  p_notes text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_id uuid;
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  if p_amount is null or p_amount <= 0 then
    return json_build_object('ok', false, 'message', 'El monto debe ser mayor a cero.');
  end if;
  select name into v_name from profiles where id = p_teacher and role = 'teacher';
  if v_name is null then return json_build_object('ok', false, 'message', 'Profesor no encontrado.'); end if;
  insert into teacher_payouts (teacher_id, amount, method, period_end, notes, created_by)
  values (p_teacher, round(p_amount, 2), coalesce(p_method, 'transferencia'), p_period_end, nullif(trim(coalesce(p_notes, '')), ''), me())
  returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'message', format('Pago a %s registrado.', v_name));
end $$;

create or replace function public.delete_payout(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  delete from teacher_payouts where id = p_id;
  if not found then return json_build_object('ok', false, 'message', 'Pago no encontrado.'); end if;
  return json_build_object('ok', true, 'message', 'Pago eliminado.');
end $$;

-- Lo que le toca a cada profesor por TODAS sus clases ya dadas (la app solo baja los últimos meses).
-- Mismo redondeo que la app: por clase, cobro = alumnos × precio; parte del profesor = cobro × % / 100.
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
           or (r.status = 'no_show' and (select no_show_penalty from st))
           or (r.status = 'cancelled' and r.late_cancel))
      and (is_admin() or s.teacher_id = me())
    group by s.id, s.teacher_id, sp.teacher_rate, tr.rate, sp.teacher_share
  )
  select teacher_id, round(sum(round(round(students * rate, 2) * share / 100, 2)), 2) as earned
  from per_class
  group by teacher_id
$$;

-- ---------------------------------------------------------------- alta/edición de profesores con precio
create or replace function public.admin_save_profile(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_err text;
  v_rate numeric := nullif(p->>'rate', '')::numeric;
begin
  if not is_admin() then return json_build_object('ok', false, 'message', 'No autorizado.'); end if;
  v_err := public._profile_error(p->>'name', v_email, p->>'phone', nullif(p->>'birthday', '')::date);
  if v_err is not null then return json_build_object('ok', false, 'message', v_err); end if;
  if v_rate is not null and v_rate < 0 then
    return json_build_object('ok', false, 'message', 'El precio no puede ser negativo.');
  end if;
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
  if (p->>'role') = 'teacher' and v_rate is not null then
    insert into teacher_rates (teacher_id, rate, updated_at) values (v_id, v_rate, now())
    on conflict (teacher_id) do update set rate = excluded.rate, updated_at = now()
    where teacher_rates.rate is distinct from excluded.rate;
  end if;
  return json_build_object('ok', true, 'id', v_id, 'message', 'Guardado.');
exception when unique_violation then
  return json_build_object('ok', false, 'message', 'Ya existe una persona con ese correo o código.');
end $$;

revoke execute on function public._session_pay_sync(), public._rate_to_future_sessions(),
  public._share_to_future_sessions() from public, anon, authenticated;
revoke execute on function public.teacher_balances(), public.record_payout(uuid, numeric, public.payment_method, date, text),
  public.delete_payout(uuid) from public, anon;
grant execute on function public.teacher_balances(), public.record_payout(uuid, numeric, public.payment_method, date, text),
  public.delete_payout(uuid) to authenticated;
