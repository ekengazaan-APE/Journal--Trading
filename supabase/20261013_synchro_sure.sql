-- Synchro sûre et codes lecture seule (étape 1, 13/10/2026)
-- Ajouts uniquement : save_journal et get_journal restent inchangées (anciennes versions du journal, journal de l'ami).

-- 1. Sauvegarde avec contrôle de version.
-- Le journal envoie la date de la version qu'il a lue (p_expected). Si le cloud a changé depuis
-- (autre appareil), rien n'est écrit et la fonction renvoie conflict = true avec la date du cloud.
create or replace function public.save_journal_v2(p_code text, p_data jsonb, p_expected timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cur timestamptz;
  ts timestamptz := clock_timestamp();
begin
  if p_code is null or length(p_code) < 8 then
    raise exception 'code invalide';
  end if;
  select j.updated_at into cur from public.journaux j where j.code = p_code for update;
  if found and (p_expected is null or cur is distinct from p_expected) then
    return jsonb_build_object('ok', false, 'conflict', true, 'updated_at', cur);
  end if;
  insert into public.journaux(code, data, updated_at)
  values (p_code, p_data, ts)
  on conflict (code) do update set data = excluded.data, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'updated_at', ts);
end;
$$;

-- 2. Codes lecture seule : lisent un journal, ne peuvent rien écrire.
-- Servent aux rapports automatiques, pour ne jamais y écrire le code de synchro.
create table if not exists public.lecteurs (
  code_lecture text primary key,
  code text not null references public.journaux(code) on delete cascade,
  libelle text not null default '',
  cree_le timestamptz not null default now()
);
alter table public.lecteurs enable row level security;
revoke all on table public.lecteurs from anon, authenticated;

create or replace function public._code_lecture_aleatoire()
returns text
language plpgsql
volatile
set search_path to 'public', 'extensions'
as $$
declare
  a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(24);
  r text := 'L';
  i int;
begin
  for i in 0..23 loop
    if i % 4 = 0 then r := r || '-'; end if;
    r := r || substr(a, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return r;
end;
$$;
revoke all on function public._code_lecture_aleatoire() from public, anon, authenticated;

-- Crée un code lecture pour le journal du code de synchro donné (5 au maximum).
create or replace function public.creer_code_lecture(p_code text, p_libelle text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  c text;
begin
  if not exists (select 1 from public.journaux j where j.code = p_code) then
    raise exception 'journal introuvable';
  end if;
  if (select count(*) from public.lecteurs l where l.code = p_code) >= 5 then
    raise exception '5 codes lecture au maximum : révoque les anciens';
  end if;
  c := public._code_lecture_aleatoire();
  insert into public.lecteurs(code_lecture, code, libelle) values (c, p_code, left(coalesce(p_libelle, ''), 60));
  return c;
end;
$$;

-- Liste les codes lecture d'un journal, sans jamais renvoyer les codes eux-mêmes.
create or replace function public.codes_lecture(p_code text)
returns table(libelle text, cree_le timestamptz, fin text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.libelle, l.cree_le, right(l.code_lecture, 4) from public.lecteurs l where l.code = p_code order by l.cree_le;
$$;

-- Révoque tous les codes lecture d'un journal.
create or replace function public.revoquer_codes_lecture(p_code text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  delete from public.lecteurs l where l.code = p_code;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Lecture seule d'un journal par un code lecture.
create or replace function public.get_journal_lecture(p_lecture text)
returns table(data jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select j.data, j.updated_at
  from public.lecteurs l join public.journaux j on j.code = l.code
  where l.code_lecture = p_lecture;
$$;

-- Après un changement de code de synchro : les codes lecture suivent le journal.
-- Il faut connaître l'ancien ET le nouveau code, et les deux lignes doivent exister.
create or replace function public.lecture_suivre(p_ancien text, p_nouveau text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  if p_ancien = p_nouveau
     or not exists (select 1 from public.journaux j where j.code = p_ancien)
     or not exists (select 1 from public.journaux j where j.code = p_nouveau) then
    return 0;
  end if;
  update public.lecteurs l set code = p_nouveau where l.code = p_ancien;
  get diagnostics n = row_count;
  return n;
end;
$$;
