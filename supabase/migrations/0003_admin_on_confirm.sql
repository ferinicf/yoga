-- El rol de administrador solo se otorga cuando el correo está confirmado,
-- para que nadie pueda registrarse con un correo de admin ajeno.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean;
  v_id uuid;
begin
  select new.email_confirmed_at is not null and exists (
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

create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null and exists (
    select 1 from settings, unnest(admin_emails) e where lower(e) = lower(new.email)
  ) then
    update profiles set role = 'admin' where auth_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

revoke execute on function public.handle_new_user, public.handle_user_confirmed from public, anon, authenticated;
