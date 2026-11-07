-- Marea · datos iniciales (editables desde el panel de administración).
-- Profesores y horario son de ejemplo: cámbialos por los reales en Admin → Profesores / Calendario.

insert into public.settings (id, studio_name, tagline, brand_color, address, phone, whatsapp, instagram,
  cancel_hours, booking_window_days, day_limit, week_limit, admin_emails)
values (1, 'Marea', 'Respira, muévete, conecta.', '#5B7F6E', '', '', '', '',
  8, 14, 2, null, array['desarrolladorfero@gmail.com', 'coronadofero@gmail.com']);

insert into public.disciplines (id, name, description, color, duration_min, level) values
  ('00000000-0000-4000-8000-0000000000d1', 'Vinyasa Flow', 'Secuencias fluidas sincronizadas con la respiración.', '#C98B6B', 60, 'Todos los niveles'),
  ('00000000-0000-4000-8000-0000000000d2', 'Hatha', 'Posturas sostenidas con énfasis en alineación.', '#7C9A92', 60, 'Principiante'),
  ('00000000-0000-4000-8000-0000000000d3', 'Yin Yoga', 'Posturas pasivas y largas para tejido conectivo.', '#8E7CC3', 75, 'Todos los niveles'),
  ('00000000-0000-4000-8000-0000000000d4', 'Pilates Mat', 'Fuerza de centro, control y movilidad en tapete.', '#D4A373', 50, 'Todos los niveles'),
  ('00000000-0000-4000-8000-0000000000d5', 'Prenatal', 'Práctica segura para el embarazo.', '#B5838D', 60, 'Todos los niveles'),
  ('00000000-0000-4000-8000-0000000000d6', 'Meditación', 'Respiración (pranayama) y meditación guiada.', '#6B9AC4', 45, 'Todos los niveles');

insert into public.rooms (id, name, rows, cols) values
  ('00000000-0000-4000-8000-0000000000a1', 'Salón principal', 3, 5),
  ('00000000-0000-4000-8000-0000000000a2', 'Salón pequeño', 2, 4);

insert into public.plans (name, description, price, credits, validity_days, discipline_ids, max_per_member, featured) values
  ('Clase de prueba', 'Tu primera clase para conocernos.', 150, 1, 7, '{}', 1, false),
  ('Clase suelta', 'Una clase, cualquier disciplina.', 250, 1, 30, '{}', null, false),
  ('Paquete 4 clases', 'Ideal para practicar una vez por semana.', 850, 4, 30, '{}', null, false),
  ('Paquete 8 clases', 'Dos clases por semana.', 1500, 8, 35, '{}', null, true),
  ('Paquete 12 clases', 'Tres clases por semana.', 2000, 12, 45, '{}', null, false),
  ('Ilimitado mensual', 'Todas las clases que quieras durante 30 días.', 2400, null, 30, '{}', null, false);

insert into public.coupons (code, kind, value) values ('BIENVENIDA', 'percent', 15);

insert into public.profiles (id, name, email, role, code, color, bio) values
  ('00000000-0000-4000-8000-0000000000b1', 'Profesora de ejemplo 1', 'profe1@ejemplo.mx', 'teacher', '2001', '#C98B6B', 'Vinyasa y Power Yoga.'),
  ('00000000-0000-4000-8000-0000000000b2', 'Profesor de ejemplo 2', 'profe2@ejemplo.mx', 'teacher', '2002', '#8E7CC3', 'Hatha, Yin y meditación.'),
  ('00000000-0000-4000-8000-0000000000b3', 'Profesora de ejemplo 3', 'profe3@ejemplo.mx', 'teacher', '2003', '#D4A373', 'Pilates mat y prenatal.');

-- Horario semanal de ejemplo (0 = domingo).
insert into public.class_templates (discipline_id, teacher_id, room_id, weekday, start_time, duration_min, capacity)
select d.id, t.teacher::uuid, t.room::uuid, wd, t.start_time::time, d.duration_min,
       (select cardinality(public._room_spots(t.room::uuid)))
from (values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', '{1,2,3,4,5}', '07:00'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', '{1,3,5}', '09:00'),
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a1', '{2,4}', '09:00'),
  ('00000000-0000-4000-8000-0000000000d5', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a2', '{2,4}', '11:00'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', '{1,3}', '18:00'),
  ('00000000-0000-4000-8000-0000000000d6', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', '{2,4}', '18:00'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', '{1,2,3,4,5}', '19:30'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', '{6}', '09:00'),
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a1', '{6}', '11:00'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', '{0}', '10:00')
) as t(disc, teacher, room, days, start_time)
join public.disciplines d on d.id = t.disc::uuid
cross join lateral unnest(t.days::int[]) wd;

select public.ensure_sessions(42);
