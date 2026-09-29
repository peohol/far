-- Planlagte oppgaver: «Håndteres nå av en agent», og nummeret fra start.
--
-- Når Claude begynner på oppgavene (`/utfor-oppgaver`), tar den dem med en
-- migrering administratoren godkjenner (`ta_oppgaver`). Oppgavene står da som
-- «Håndteres nå av en agent», og en annen økt kan ikke ta dem. Stopper
-- agenten, kan en administrator frigi oppgaven, så den er klar igjen.
--
-- Hver oppgave får nummeret sitt (OPG-001) når den overføres, ikke først når
-- den er utført, så den kan omtales og gjenopptas med nummeret hele veien.

alter type public.oppgavestatus add value 'haandteres' before 'utfort';

-- Den nye verdien kan ikke brukes i samme transaksjon som den legges til.
-- Reglene nedenfor nevner derfor bare de gamle verdiene; funksjonene leser
-- den først når de kjøres.

alter table public.oppgaver add column tatt_kl timestamptz;

comment on column public.oppgaver.tatt_kl is
  'Når en agent tok oppgaven og den ble «Håndteres nå av en agent», eller null.';

-- Nummeret for oppgavene som fantes, i den rekkefølgen de ble overført. Et
-- nummer brukes aldri på nytt, så en migrering som nevner det, kan ikke treffe
-- en annen oppgave; sekvensen fortsetter etter det høyeste.
with nye as (
  select o.id,
    (select coalesce(max(u.nummer), 0) from public.oppgaver u)
      + row_number() over (order by o.overfort_kl, o.id) as nummer
  from public.oppgaver o
  where o.nummer is null
)
update public.oppgaver o set nummer = nye.nummer from nye where nye.id = o.id;

select setval('intern.oppgavenummer', coalesce(max(nummer), 1), max(nummer) is not null) from public.oppgaver;

alter table public.oppgaver
  alter column nummer set not null,
  drop constraint oppgaver_utfort,
  add constraint oppgaver_utfort check ((status = 'utfort') = (endringslogg is not null and utfort_kl is not null)),
  drop constraint oppgaver_klar,
  add constraint oppgaver_klar check ((status in ('ikke_paabegynt', 'under_arbeid')) = (klar_kl is null)),
  -- Tatt bare når den håndteres av en agent eller er utført.
  add constraint oppgaver_tatt check (
    case when status in ('ikke_paabegynt', 'under_arbeid', 'klar') then tatt_kl is null
    when status = 'utfort' then true
    else tatt_kl is not null end
  );

comment on column public.oppgaver.nummer is
  'Løpenummeret oppgaven omtales med, vist som «OPG-001». Settes når den overføres.';

-- --- Overføringen gir nummeret ------------------------------------------------

-- «Overfør til planlagte oppgaver»: idéen blir en oppgave som ikke er påbegynt,
-- med idéens overskrift og neste nummer. Et nummer som er gitt, gis aldri
-- igjen, heller ikke når oppgaven flyttes tilbake.
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
  insert into public.oppgaver (ide_id, tittel, nummer)
  select i.id, i.tittel, nextval('intern.oppgavenummer')
  from public.ideer i where i.id = overfor_ide.ide
  returning id into ny;
  return ny;
end;
$$;

-- --- Det en administrator gjør med en oppgave ------------------------------------

-- Låser oppgaven og krever at en administrator kan endre den: den finnes, er
-- ikke utført, og håndteres ikke av en agent.
create function intern.las_oppgave_for_endring(oppgave uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  naa public.oppgavestatus;
begin
  select o.status into naa from public.oppgaver o where o.id = las_oppgave_for_endring.oppgave for update;
  if naa is null or naa = 'utfort' then
    raise exception 'Oppgaven finnes ikke, eller er utført.' using errcode = '55000';
  elsif naa = 'haandteres' then
    raise exception 'Oppgaven håndteres av en agent. Frigi den først.' using errcode = '55000';
  end if;
end;
$$;

-- Overskriften og prompten lagres sammen. Den første endringen gjør en oppgave
-- som ikke var påbegynt, påbegynt, og en klar oppgave som mister prompten, er
-- ikke klar lenger.
create or replace function public.lagre_oppgave(oppgave uuid, tittel text, prompt text)
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
  perform intern.las_oppgave_for_endring(lagre_oppgave.oppgave);
  update public.oppgaver o
  set tittel = ren_tittel,
    prompt = coalesce(lagre_oppgave.prompt, ''),
    endret_kl = now(),
    status = case when o.status = 'klar' and not tom then 'klar' else 'under_arbeid' end::public.oppgavestatus,
    klar_kl = case when o.status = 'klar' and not tom then o.klar_kl end
  where o.id = lagre_oppgave.oppgave;
end;
$$;

-- Klar til implementering, eller tilbake til påbegynt. En oppgave uten prompt
-- kan ikke være klar.
create or replace function public.sett_oppgave_klar(oppgave uuid, klar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_idevalg_admin();
  perform intern.las_oppgave_for_endring(sett_oppgave_klar.oppgave);
  if sett_oppgave_klar.klar and exists (
    select 1 from public.oppgaver o where o.id = sett_oppgave_klar.oppgave and btrim(o.prompt) = ''
  ) then
    raise exception 'Skriv prompten før oppgaven merkes klar.' using errcode = '23514';
  end if;
  update public.oppgaver o
  set status = case when sett_oppgave_klar.klar then 'klar' else 'under_arbeid' end::public.oppgavestatus,
    klar_kl = case when sett_oppgave_klar.klar then coalesce(o.klar_kl, now()) end
  where o.id = sett_oppgave_klar.oppgave;
end;
$$;

-- Oppgaven flyttes tilbake til idélista. Det er den eneste måten en oppgave kan
-- fjernes på. En utført oppgave, eller en en agent håndterer, kan ikke flyttes.
create or replace function public.flytt_oppgave_tilbake(oppgave uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_idevalg_admin();
  perform intern.las_oppgave_for_endring(flytt_oppgave_tilbake.oppgave);
  delete from public.oppgaver o where o.id = flytt_oppgave_tilbake.oppgave;
end;
$$;

-- En oppgave agenten har tatt, blir klar igjen, så en ny økt kan ta den. For
-- når agenten er stoppet før arbeidet ble ferdig.
create function public.frigi_oppgave(oppgave uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_idevalg_admin();
  update public.oppgaver o set status = 'klar', tatt_kl = null
  where o.id = frigi_oppgave.oppgave and o.status = 'haandteres';
  if not found then
    raise exception 'Oppgaven håndteres ikke av en agent.' using errcode = '55000';
  end if;
end;
$$;

-- --- Det Claude gjør, som migreringer ----------------------------------------------

-- Nummeret slik det vises, som «OPG-007». Samme som `oppgavekode()` i appen.
create function intern.oppgavekode(nummer integer)
returns text
language sql
immutable
set search_path = ''
as $$ select 'OPG-' || case when nummer < 1000 then lpad(nummer::text, 3, '0') else nummer::text end $$;

-- Claude tar oppgavene den skal utføre, med numrene, rett etter at arbeidet
-- er planlagt. Enten tas alle, eller ingen: står én av dem ikke klar, fordi en
-- annen økt har tatt den eller den er flyttet tilbake, stopper migreringen.
create function public.ta_oppgaver(numre integer[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ikke_klare text;
begin
  if coalesce(cardinality(ta_oppgaver.numre), 0) = 0 then
    raise exception 'Nevn oppgavene som skal tas.' using errcode = '22023';
  end if;
  perform 1 from public.oppgaver o where o.nummer = any (ta_oppgaver.numre) for update;
  select string_agg(format('%s (%s)', intern.oppgavekode(n), coalesce(o.status::text, 'finnes ikke')), ', ' order by n)
  into ikke_klare
  from unnest(ta_oppgaver.numre) n
  left join public.oppgaver o on o.nummer = n
  where o.status is distinct from 'klar';
  if ikke_klare is not null then
    raise exception 'Ikke klar til implementering: %', ikke_klare using errcode = '55000';
  end if;
  update public.oppgaver o set status = 'haandteres', tatt_kl = now()
  where o.nummer = any (ta_oppgaver.numre);
end;
$$;

-- Claude merker oppgaven utført når arbeidet er slått sammen, med versjonen i
-- endringsloggen der det står hva som ble gjort.
drop function public.fullfor_oppgave(uuid, text);

create function public.fullfor_oppgave(nummer integer, endringslogg text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.oppgaver o
  set status = 'utfort', endringslogg = fullfor_oppgave.endringslogg, utfort_kl = now(), tatt_kl = coalesce(o.tatt_kl, now())
  where o.nummer = fullfor_oppgave.nummer and o.status in ('klar', 'haandteres');
  if not found then
    raise exception '% finnes ikke, eller er ikke klar til implementering.', intern.oppgavekode(fullfor_oppgave.nummer)
      using errcode = '55000';
  end if;
end;
$$;

comment on function public.overfor_ide(uuid) is 'Gjør idéen til en planlagt oppgave med neste nummer, og gir ID-en til oppgaven. Bare for administratorer.';
comment on function public.lagre_oppgave(uuid, text, text) is
  'Lagrer overskriften og prompten til en oppgave som ikke er utført eller håndteres av en agent. Bare for administratorer.';
comment on function public.sett_oppgave_klar(uuid, boolean) is 'Merker oppgaven klar til implementering, eller tilbake til påbegynt. Bare for administratorer.';
comment on function public.flytt_oppgave_tilbake(uuid) is
  'Flytter en oppgave som ikke er utført eller håndteres av en agent, tilbake til idélista. Bare for administratorer.';
comment on function public.frigi_oppgave(uuid) is 'Gjør en oppgave en agent har tatt, klar igjen. Bare for administratorer.';
comment on function public.ta_oppgaver(integer[]) is
  'Setter de klare oppgavene med numrene til «Håndteres nå av en agent», alle eller ingen. Kjøres av Claude som migrering.';
comment on function public.fullfor_oppgave(integer, text) is
  'Merker oppgaven med nummeret utført, med versjonen i endringsloggen. Kjøres av Claude som migrering.';

-- --- Lesing ----------------------------------------------------------------------

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
      'tatt_kl', o.tatt_kl,
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
      'tatt_kl', o.tatt_kl,
      'utfort_kl', o.utfort_kl
    )
  from public.oppgaver o
  join public.ideer i on i.id = o.ide_id
  where o.id = oppgave.oppgave and (select auth.uid()) is not null
$$;

-- --- Rettigheter ---------------------------------------------------------------------

revoke all on function public.frigi_oppgave(uuid) from public, anon, authenticated, service_role;
revoke all on function public.ta_oppgaver(integer[]) from public, anon, authenticated, service_role;
revoke all on function public.fullfor_oppgave(integer, text) from public, anon, authenticated, service_role;
grant execute on function public.frigi_oppgave(uuid) to authenticated;
-- ta_oppgaver og fullfor_oppgave får ingen: de kjøres bare som migrering.

revoke all on all functions in schema intern from public, anon, authenticated, service_role;