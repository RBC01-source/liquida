-- Liquida · esquema de Supabase
-- Pega este archivo completo en: Supabase → SQL Editor → New query → Run.
-- Las contraseñas las guarda Supabase Auth (cifradas); aquí no hay ninguna tabla de contraseñas.

-- 1) Suscripciones: las crea SOLO el dueño del proyecto desde el panel (Table Editor).
create table if not exists public.suscripciones (
  email   text primary key,
  plan    text not null check (plan in ('mensual', 'anual')),
  vence   date not null,
  creado  timestamptz not null default now(),
  nota    text
);
alter table public.suscripciones enable row level security;

-- Cada usuario autenticado puede LEER únicamente su propia suscripción (por el correo de su cuenta).
drop policy if exists "leer_mi_suscripcion" on public.suscripciones;
create policy "leer_mi_suscripcion" on public.suscripciones
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
-- No hay políticas de insert/update/delete: nadie desde la web puede crear ni cambiar suscripciones.

-- 2) Datos del usuario (trabajadores, novedades, empleador). Solo el propio usuario.
create table if not exists public.datos (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  estado      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.datos enable row level security;

drop policy if exists "datos_select" on public.datos;
create policy "datos_select" on public.datos for select to authenticated using (user_id = auth.uid());
drop policy if exists "datos_insert" on public.datos;
create policy "datos_insert" on public.datos for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "datos_update" on public.datos;
create policy "datos_update" on public.datos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "datos_delete" on public.datos;
create policy "datos_delete" on public.datos for delete to authenticated using (user_id = auth.uid());

-- Límite razonable de tamaño por usuario (1 MB de JSON)
alter table public.datos drop constraint if exists datos_tamano;
alter table public.datos add constraint datos_tamano check (pg_column_size(estado) < 1048576);

-- 3) Cierra el acceso anónimo a las dos tablas
revoke all on public.suscripciones from anon;
revoke all on public.datos from anon;

-- 4) Permisos explícitos para usuarios con sesión (las políticas de arriba limitan a cada quien a lo suyo)
grant select on public.suscripciones to authenticated;
grant select, insert, update, delete on public.datos to authenticated;
