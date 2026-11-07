-- Marea · eliminar la cuenta desde la app
-- (App Store 5.1.1(v) y Google Play: si la app permite crear cuenta, debe permitir eliminarla).
--
-- Un ALUMNO puede eliminar su propia cuenta:
--  · se cancelan sus reservaciones y lugares en lista de espera (también los de sus invitados)
--    en clases que aún no empiezan, sin devolver créditos, y el lugar pasa a la lista de espera;
--  · su perfil se anonimiza (nombre, correo, teléfono, notas, cumpleaños, código de acceso)
--    y queda inactivo; ventas, membresías y asistencias pasadas se conservan para la
--    contabilidad del estudio, ya sin datos personales;
--  · se borra su usuario de acceso (auth.users), con lo que se cierran todas sus sesiones.
--    Si después se registra con el mismo correo, empieza como una cuenta nueva.
-- PROFESORES y ADMINISTRADORES no se eliminan desde aquí (tienen clases, horarios y pagos ligados):
-- los da de baja la administración.
--
-- No se aplica sola: el integrador decide cuándo correrla en el proyecto Supabase "Marea".

create or replace function public.delete_my_account() returns json
language plpgsql security definer set search_path = public as $$
declare
  v profiles;
  v_sessions uuid[];
  v_session uuid;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'message', 'Inicia sesión para eliminar tu cuenta.');
  end if;

  select * into v from profiles where auth_id = auth.uid() for update;

  if v.id is not null and v.role <> 'student' then
    return json_build_object('ok', false, 'message', 'Pide a la administración que dé de baja tu cuenta.');
  end if;

  if v.id is not null then
    -- Clases futuras con reservación o lista de espera de esta persona (o de sus invitados).
    select coalesce(array_agg(distinct r.session_id), '{}') into v_sessions
    from reservations r
    join sessions s on s.id = r.session_id
    where r.user_id = v.id and r.status in ('booked', 'waitlist') and s.starts_at > now();

    -- Mismo orden de bloqueo que cancel_reservation: primero la clase, luego sus reservaciones.
    perform 1 from sessions where id = any (v_sessions) order by id for update;

    update reservations r set status = 'cancelled', late_cancel = false, updated_at = now()
    from sessions s
    where s.id = r.session_id
      and r.user_id = v.id
      and r.status in ('booked', 'waitlist')
      and s.starts_at > now();

    -- Los lugares liberados pasan a quien esté en lista de espera.
    foreach v_session in array v_sessions loop
      perform public._promote_waitlist(v_session);
    end loop;

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
  end if;

  -- Usuario de acceso: se borran también sus sesiones e identidades (cascada de Supabase Auth).
  delete from auth.users where id = auth.uid();

  return json_build_object('ok', true, 'message', 'Tu cuenta fue eliminada.');
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
