-- Al crear una persona desde el panel, respeta el id que manda la app (para poder abrir su ficha).
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
    insert into profiles (id, name, email, phone, role, color, bio, notes, birthday, active, code)
    values (coalesce((p->>'id')::uuid, gen_random_uuid()), p->>'name', lower(p->>'email'), coalesce(p->>'phone', ''),
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
