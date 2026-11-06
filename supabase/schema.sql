-- Esquema propuesto para producción (Postgres / Supabase).
-- Refleja 1:1 los tipos de src/lib/types.ts. Aún NO está conectado: la app corre en modo demo
-- con datos en el navegador. Para conectarla, cada acción de src/lib/store.ts se vuelve una
-- llamada a estas tablas (o a funciones RPC para las operaciones con reglas: reservar, cancelar, comprar).

create type role as enum ('admin', 'teacher', 'student');
create type session_status as enum ('scheduled', 'cancelled');
create type membership_status as enum ('active', 'pending_payment', 'cancelled');
create type payment_method as enum ('efectivo', 'tarjeta', 'transferencia', 'en_linea');
create type sale_status as enum ('paid', 'pending', 'refunded');
create type reservation_status as enum ('booked', 'waitlist', 'cancelled', 'attended', 'no_show');
create type discipline_level as enum ('Todos los niveles', 'Principiante', 'Intermedio', 'Avanzado');

create table settings (
  id int primary key default 1 check (id = 1),
  studio_name text not null,
  tagline text default '',
  brand_color text not null default '#5B7F6E',
  address text default '', phone text default '', whatsapp text default '', instagram text default '',
  cancel_hours int not null default 8,
  booking_window_days int not null default 14,
  day_limit int, week_limit int,
  waitlist_enabled boolean not null default true,
  spot_selection boolean not null default true,
  allow_guests boolean not null default true,
  allow_pay_at_studio boolean not null default true,
  no_show_penalty boolean not null default true,
  currency text not null default 'MXN'
);

-- Perfil ligado a auth.users de Supabase
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  phone text default '',
  role role not null default 'student',
  code text not null unique,            -- código de check-in
  color text not null default '#7C9A92',
  bio text, notes text, birthday date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table disciplines (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text default '', color text not null,
  duration_min int not null default 60, level discipline_level not null default 'Todos los niveles',
  active boolean not null default true
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null, rows int not null, cols int not null,
  blocked_spots text[] not null default '{}'
);

create table class_templates (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references disciplines,
  teacher_id uuid not null references profiles,
  room_id uuid not null references rooms,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  duration_min int not null,
  capacity int not null,
  active boolean not null default true
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references class_templates,
  detached boolean not null default false,
  discipline_id uuid not null references disciplines,
  teacher_id uuid not null references profiles,
  room_id uuid not null references rooms,
  starts_at timestamptz not null,
  duration_min int not null,
  capacity int not null,
  status session_status not null default 'scheduled',
  notes text,
  unique (template_id, starts_at)
);
create index on sessions (starts_at);

create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text default '',
  price numeric(10,2) not null,
  credits int,                          -- null = ilimitado
  validity_days int not null,
  discipline_ids uuid[] not null default '{}',
  max_per_member int,
  featured boolean not null default false,
  active boolean not null default true
);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent', 'amount')),
  value numeric(10,2) not null,
  active boolean not null default true,
  max_uses int, uses int not null default 0,
  expires_at timestamptz
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  concept text not null,
  subtotal numeric(10,2) not null, discount numeric(10,2) not null default 0, total numeric(10,2) not null,
  coupon_code text,
  method payment_method not null,
  status sale_status not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  plan_id uuid not null references plans,
  plan_name text not null,
  credits int, credits_used int not null default 0,
  discipline_ids uuid[] not null default '{}',
  starts_at timestamptz not null, expires_at timestamptz not null,
  status membership_status not null,
  sale_id uuid references sales,
  created_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions on delete cascade,
  user_id uuid not null references profiles,
  spot text,
  status reservation_status not null,
  membership_id uuid references memberships,
  guest_name text,
  late_cancel boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un lugar no puede estar ocupado dos veces en la misma clase
create unique index reservations_spot_unique on reservations (session_id, spot)
  where spot is not null and status in ('booked', 'attended', 'no_show');
-- Un alumno no puede reservar dos veces la misma clase (sin contar invitados)
create unique index reservations_user_unique on reservations (session_id, user_id)
  where guest_name is null and status <> 'cancelled';

-- Seguridad (RLS): alumnos ven y modifican solo lo suyo; profesores sus clases; admin todo.
alter table profiles enable row level security;
alter table reservations enable row level security;
alter table memberships enable row level security;
alter table sales enable row level security;

create function is_staff() returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'teacher'))
$$;

create policy "perfil propio o staff" on profiles for select using (id = auth.uid() or is_staff());
create policy "reservas propias o staff" on reservations for select using (user_id = auth.uid() or is_staff());
create policy "membresias propias o staff" on memberships for select using (user_id = auth.uid() or is_staff());
create policy "ventas propias o staff" on sales for select using (user_id = auth.uid() or is_staff());
-- Las escrituras de reservas/compras se hacen vía funciones RPC `security definer`
-- (book_session, cancel_reservation, purchase_plan) que aplican las reglas de src/lib/rules.ts.
