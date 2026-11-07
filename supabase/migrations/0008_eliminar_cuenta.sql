-- Marea · eliminar la cuenta desde la app
-- (App Store 5.1.1(v) y Google Play: quien puede crear una cuenta debe poder eliminarla desde la app).
-- Mismo comportamiento que explica src/components/delete-account.tsx.
--
-- delete_my_account() no recibe parámetros: SOLO actúa sobre la persona de la sesión (auth.uid()).
-- No hay manera de pedirle que borre a otra persona. Sin sesión no se puede llamar (anon no tiene
-- permiso de ejecutarla).
--
-- ALUMNO
--  · Se cancelan sus reservaciones y lugares en lista de espera (también los de sus invitados) en
--    clases que aún no empiezan, SIN devolver créditos (la cuenta se borra) y sin contarlas como
--    cancelación tardía. Los lugares que se liberan pasan a quien siga en la lista de espera.
--  · Se anulan sus compras apartadas sin pagar: la venta 'pending' pasa a 'refunded' (no se cobró
--    nada) y su paquete 'pending_payment' a 'cancelled', para que recepción no confirme el pago de
--    una cuenta que ya no existe. Las ventas pagadas y sus paquetes NO se tocan.
--  · Su perfil se anonimiza: nombre «Cuenta eliminada», correo deleted+<id>@marea.invalid (único),
--    sin teléfono, notas, bio ni cumpleaños, código de acceso nuevo (el anterior deja de servir
--    para el check-in), inactivo y sin usuario de acceso. Ventas, paquetes y asistencias pasadas se
--    conservan para la contabilidad del estudio, ya sin datos personales.
--  · Si después se registra con el mismo correo, empieza con una cuenta nueva.
-- PROFESOR
--  · Se le quita el acceso (usuario borrado, perfil inactivo y sin auth_id), pero se conservan su
--    nombre y su perfil para el historial de clases, saldo y pagos. Sus clases futuras siguen
--    asignadas hasta que la administración las reasigne.
-- ADMINISTRADOR
--  · Igual que el profesor, y su correo sale de la lista de correos de administración
--    (private_settings.admin_emails). Se RECHAZA si es la última administradora activa.
--  · Si alguien del personal vuelve a registrarse con su correo, queda ligado a su perfil inactivo
--    (sin acceso) hasta que la administración lo reactive.
-- En todos los casos se borra el usuario de acceso (auth.users) y, en cascada, sus sesiones,
-- identidades y factores de Supabase Auth.
--
-- Idempotente (create or replace + revoke/grant): se puede correr más de una vez.
-- No se aplica sola: hay que correrla en el proyecto Supabase «Marea» (SQL Editor) antes de
-- publicar la app. Comprobación: sin sesión, POST /rest/v1/rpc/delete_my_account debe responder
-- 401 (42501, permiso denegado), no 404 (PGRST202, la función no existe).

create or replace function public.delete_my_account() returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v profiles;
  v_sessions uuid[];
  v_session uuid;
  v_auth_deleted int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'message', 'Inicia sesión para eliminar tu cuenta.');
  end if;

  -- Solo el perfil de esta sesión.
  select * into v from profiles where auth_id = v_uid for update;

  -- Última administradora activa: no se puede quedar el estudio sin nadie que lo administre.
  -- El candado hace que dos administradoras que se eliminan a la vez se revisen una después de la otra.
  if v.id is not null and v.role = 'admin' and v.active then
    perform pg_advisory_xact_lock(hashtext('marea.delete_my_account.admin'));
    if not exists (select 1 from profiles where role = 'admin' and active and id <> v.id) then
      return json_build_object('ok', false, 'message',
        'Eres la única administradora; agrega otra antes de eliminar tu cuenta.');
    end if;
  end if;

  if v.id is not null and v.role = 'student' then
    -- Clases que aún no empiezan con reservación o lista de espera de esta persona (o de sus invitados).
    select coalesce(array_agg(distinct r.session_id), '{}') into v_sessions
    from reservations r
    join sessions s on s.id = r.session_id
    where r.user_id = v.id and r.status in ('booked', 'waitlist') and s.starts_at > now();

    -- Mismo orden que book_session: primero la clase, luego sus reservaciones.
    perform 1 from sessions where id = any (v_sessions) order by id for update;

    -- Sin devolver créditos (la cuenta se borra) y sin marcarla como cancelación tardía.
    update reservations r set status = 'cancelled', late_cancel = false, no_show_charged = null, updated_at = now()
    from sessions s
    where s.id = r.session_id
      and r.user_id = v.id
      and r.status in ('booked', 'waitlist')
      and s.starts_at > now();

    -- Los lugares liberados pasan a quien esté en lista de espera.
    foreach v_session in array v_sessions loop
      perform public._promote_waitlist(v_session);
    end loop;

    -- Compras apartadas sin pagar: se anulan (no se cobró nada). Las pagadas no se tocan.
    update memberships set status = 'cancelled' where user_id = v.id and status = 'pending_payment';
    update sales set status = 'refunded' where user_id = v.id and status = 'pending';

    update profiles set
      name = 'Cuenta eliminada',
      email = 'deleted+' || v.id::text || '@marea.invalid',
      phone = '',
      notes = null,
      bio = null,
      birthday = null,
      active = false,
      auth_id = null,
      code = public._new_code()
    where id = v.id;

  elsif v.id is not null then
    -- Personal (profesor o administradora): sin acceso, pero con su nombre en el historial.
    update profiles set active = false, auth_id = null where id = v.id;

    if v.role = 'admin' then
      -- Su correo ya no da acceso de administración si se vuelve a registrar.
      update private_settings ps set admin_emails = coalesce(
        (select array_agg(e) from unnest(ps.admin_emails) e where lower(e) <> lower(v.email)), '{}')
      where ps.id = 1 and exists (select 1 from unnest(ps.admin_emails) e where lower(e) = lower(v.email));
    end if;
  end if;

  -- Usuario de acceso: en cascada se borran sus sesiones, identidades y factores (Supabase Auth).
  delete from auth.users where id = v_uid;
  get diagnostics v_auth_deleted = row_count;

  if v.id is null and v_auth_deleted = 0 then
    return json_build_object('ok', false, 'message', 'No encontramos tu cuenta.');
  end if;

  return json_build_object('ok', true, 'role', v.role, 'message', 'Tu cuenta fue eliminada.');
end $$;

comment on function public.delete_my_account() is
  'Elimina la cuenta de la persona con sesión (auth.uid()). Alumno: anonimiza; personal: quita el acceso. Ver 0008_eliminar_cuenta.sql.';

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
