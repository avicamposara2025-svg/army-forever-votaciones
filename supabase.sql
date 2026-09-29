-- ARMY FOREVER · CONTROL DE VOTACIONES · SUPABASE
-- 1) Ejecuta TODO este archivo en Supabase > SQL Editor.
-- 2) Luego crea el usuario administrador en Authentication > Users.
-- 3) Crea el bucket "vote-receipts" como PUBLIC en Storage.
--    (Si quieres bucket privado, después ajustamos las políticas y URLs firmadas.)

create extension if not exists pgcrypto;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  vote_date date not null,
  status text not null default 'pending' check (status in ('voted','justified','pending')),
  reason_id uuid references public.reasons(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(participant_id, vote_date)
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.daily_records(id) on delete cascade,
  file_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists daily_records_updated_at on public.daily_records;
create trigger daily_records_updated_at before update on public.daily_records
for each row execute function public.touch_updated_at();

alter table public.participants enable row level security;
alter table public.reasons enable row level security;
alter table public.daily_records enable row level security;
alter table public.receipts enable row level security;

drop policy if exists "auth participants all" on public.participants;
create policy "auth participants all" on public.participants for all to authenticated using (true) with check (true);

drop policy if exists "auth reasons all" on public.reasons;
create policy "auth reasons all" on public.reasons for all to authenticated using (true) with check (true);

drop policy if exists "auth records all" on public.daily_records;
create policy "auth records all" on public.daily_records for all to authenticated using (true) with check (true);

drop policy if exists "auth receipts all" on public.receipts;
create policy "auth receipts all" on public.receipts for all to authenticated using (true) with check (true);

-- Storage policies for authenticated users.
-- First create a PUBLIC bucket named vote-receipts in Storage.
drop policy if exists "auth upload vote receipts" on storage.objects;
create policy "auth upload vote receipts" on storage.objects
for insert to authenticated with check (bucket_id = 'vote-receipts');

drop policy if exists "auth update vote receipts" on storage.objects;
create policy "auth update vote receipts" on storage.objects
for update to authenticated using (bucket_id = 'vote-receipts') with check (bucket_id = 'vote-receipts');

drop policy if exists "auth delete vote receipts" on storage.objects;
create policy "auth delete vote receipts" on storage.objects
for delete to authenticated using (bucket_id = 'vote-receipts');

insert into public.reasons(name) values
('Trabajo'),('Problemas de internet'),('Problemas con el celular'),('Situación personal')
on conflict do nothing;


-- Migración segura si la tabla ya fue creada antes de esta versión
alter table public.daily_records add column if not exists notes text;
