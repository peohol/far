-- Planlagte oppgaver får sin egen overskrift.
--
-- En oppgave begynner med overskriften på idéen den kom fra, men en
-- administrator kan endre den, så den sier hva oppgaven er. Det er den Claude
-- og administratoren viser til oppgaven med. Idéens egen overskrift står
-- uendret på idéen.

alter table public.oppgaver add column tittel text;

update public.oppgaver o set tittel = i.tittel from public.ideer i where i.id = o.ide_id;

alter table public.oppgaver
  alter column tittel set not null,
  add constraint oppgaver_tittel check (char_length(tittel) between 1 and 140 and tittel = btrim(tittel));

comment on column public.oppgaver.tittel is
  'Overskriften på oppgaven. Begynner som overskriften på idéen, og kan endres av en administrator.';

-- «Overfør til planlagte oppgaver»: idéen blir en oppgave som ikke er påbegynt,
-- med idéens overskrift.
create or replace function public.overfor_ide(ide uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ny uuid;
begin
  perform intern.krev_idevalg_admin();
  perform intern.las_apen_ide(overfor_ide.ide);
  insert into public.oppgaver (ide_id, tittel)
  select i.id, i.tittel from public.ideer i where i.id = overfor_ide.ide
  returning id into ny;
  return ny;
end;
$$;

-- Overskriften og prompten lagres sammen. Den første endringen setter en
-- oppgave som ikke var påbegynt, under arbeid, og en klar oppgave som mister
-- prompten, er ikke klar lenger.
drop function public.lagre_oppgaveprompt(uuid, text);

create function public.lagre_oppgave(oppgave uuid, tittel text, prompt text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ren_tittel text := btrim(coalesce(lagre_oppgave.tittel, ''));
  tom boolean := btrim(coalesce(lagre_oppgave.prompt, '')) = '';
begin
  perform intern.krev_idevalg_admin();
  if ren_tittel = '' then
    raise exception 'Skriv en overskrift.' using errcode = '23514';
  end if;
  update public.oppgaver o
  set tittel = ren_tittel,
    prompt = coalesce(lagre_oppgave.prompt, ''),
    endret_kl = now(),
    status = case when o.status = 'klar' and not tom then 'klar' else 'under_arbeid' end::public.oppgavestatus,
    klar_kl = case when o.status = 'klar' and not tom then o.klar_kl end
  where o.id = lagre_oppgave.oppgave and o.status <> 'utfort';
  if not found then
    raise exception 'Oppgaven finnes ikke, eller er utført.' using errcode = '55000';
  end if;
end;
$$;

comment on function public.lagre_oppgave(uuid, text, text) is
  'Lagrer overskriften og prompten til en oppgave som ikke er utført. Bare for administratorer.';

-- Lesingen gir oppgavens egen overskrift.
create or replace function public.oppgaveoversikt()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'ide_id', i.id,
      'tittel', o.tittel,
      'kategori', i.kategori,
      'forfatter_id', i.forfatter_id,
      'status', o.status,
      'nummer', o.nummer,
      'endringslogg', o.endringslogg,
      'har_prompt', btrim(o.prompt) <> '',
      'overfort_kl', o.overfort_kl,
      'endret_kl', o.endret_kl,
      'klar_kl', o.klar_kl,
      'utfort_kl', o.utfort_kl
    ) order by o.overfort_kl desc, o.id), '[]'::jsonb)
  from public.oppgaver o
  join public.ideer i on i.id = o.ide_id
  where (select auth.uid()) is not null
$$;

create or replace function public.oppgave(oppgave uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
      'id', o.id,
      'ide_id', i.id,
      'tittel', o.tittel,
      'kategori', i.kategori,
      'forfatter_id', i.forfatter_id,
      'status', o.status,
      'nummer', o.nummer,
      'endringslogg', o.endringslogg,
      'har_prompt', btrim(o.prompt) <> '',
      'prompt', o.prompt,
      'overfort_kl', o.overfort_kl,
      'endret_kl', o.endret_kl,
      'klar_kl', o.klar_kl,
      'utfort_kl', o.utfort_kl
    )
  from public.oppgaver o
  join public.ideer i on i.id = o.ide_id
  where o.id = oppgave.oppgave and (select auth.uid()) is not null
$$;

revoke all on function public.lagre_oppgave(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.lagre_oppgave(uuid, text, text) to authenticated;
