-- Stoffregisteret i databasen, del 4: papirkurven.
--
-- Slettingen for godt fra papirkurven, enkeltvis, alt på en gang eller det
-- som har ligget der i mer enn 30 dager. Reglene står i
-- `docs/stoffregister.md`.

-- --- Sletting for godt ---------------------------------------------------------

-- Historikken er fortsatt uforanderlig. Unntakene er en referanse som aldri
-- har vært publisert eller sitert (slett_referanse), og fagsidene og kortene
-- på dem som slettes for godt fra papirkurven (intern.fjern_stoff) — og bare
-- de objektene, i transaksjonen som sletter dem.
create or replace function intern.avvis_endring()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slettes text := nullif(current_setting('intern.sletter_referanse', true), '');
  sider text := nullif(current_setting('intern.sletter_stoffside', true), '');
  objekt text := coalesce(to_jsonb(old) ->> 'objekt_id', to_jsonb(old) ->> 'id');
begin
  if tg_op = 'DELETE'
    and slettes is not null
    and tg_table_name in ('redigerbare_objekter', 'objektrevisjoner')
    and slettes = objekt
    and exists (
      select 1 from public.redigerbare_objekter o
      where o.id = slettes::uuid and o.type = 'referanse'
    )
  then
    return old;
  end if;
  if tg_op = 'DELETE'
    and sider is not null
    and tg_table_name in ('redigerbare_objekter', 'objektrevisjoner', 'objektpubliseringer')
    and objekt = any (string_to_array(sider, ','))
    and exists (
      select 1 from public.redigerbare_objekter o
      where o.id = objekt::uuid and o.type in ('infoside', 'innholdselement')
    )
  then
    return old;
  end if;
  raise exception 'Historikken for faginnholdet kan ikke endres eller slettes.'
    using errcode = '42501';
end;
$$;

-- Sletter stoffet for godt: fagsiden med kortene, revisjonene og
-- publiseringene, diskusjonene på siden, favorittene, varslene om siden og
-- plasseringene i registeret. Statusen blir `fjernet`. Gir tilbake antall
-- objekter som ble slettet. Avviser når noe utenfor siden peker på den.
create function intern.fjern_stoff(stoff text, bruker uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  side uuid;
  sidenavn text;
  objekter uuid[];
  tekster text[];
begin
  select s.objekt_id, s.navn into side, sidenavn
  from public.infosider s
  where s.slug = fjern_stoff.stoff
  order by (s.tilstand = 'publisert') desc
  limit 1;

  if side is not null then
    perform 1 from public.redigerbare_objekter o where o.id = side for update;
    objekter := array[side] || coalesce(
      (select array_agg(distinct e.objekt_id) from public.innholdselementer e where e.infoside_id = side),
      '{}'
    );
    tekster := (select array_agg(o::text) from unnest(objekter) o);

    -- Det som skal kunne gjenopprettes, må finnes: står noen av objektene i
    -- historikken til noe annet, blir siden liggende.
    if exists (
      select 1
      from public.objektrevisjoner r
      cross join unnest(tekster) t(id)
      where r.objekt_id <> all (objekter)
        and strpos(r.innhold::text, t.id) > 0
    ) then
      raise exception 'Fagsiden kan ikke slettes for godt, fordi noe annet i historikken peker på den. Den blir liggende i papirkurven.'
        using errcode = '22023';
    end if;

    insert into public.slettede_stoffsider (stoff, navn, objekt_id, objekter, slettet_av)
    values (fjern_stoff.stoff, sidenavn, side, cardinality(objekter), bruker);

    delete from public.varsler v where v.gruppe = 'favoritter:' || side::text;

    perform set_config('intern.sletter_stoffside', array_to_string(tekster, ','), true);
    delete from public.objektpubliseringer p where p.objekt_id = any (objekter);
    delete from public.objekttilstander t where t.objekt_id = any (objekter);
    delete from public.objektrevisjoner r where r.objekt_id = any (objekter);
    delete from public.redigerbare_objekter o where o.id = any (objekter);
    perform set_config('intern.sletter_stoffside', '', true);
  end if;

  delete from public.diskusjoner d where d.side = 'stoff:' || fjern_stoff.stoff;
  delete from public.diskusjonskategorier k where k.side = 'stoff:' || fjern_stoff.stoff;
  delete from public.stoffavoritter f where f.stoff = fjern_stoff.stoff;
  delete from public.stoffplasseringer p where p.stoff = fjern_stoff.stoff;
  insert into public.stoffstatus (stoff, status, endret_av)
  values (fjern_stoff.stoff, 'fjernet', bruker)
  on conflict on constraint stoffstatus_pkey do update set status = 'fjernet', endret_av = excluded.endret_av, endret_kl = now();

  return coalesce(cardinality(objekter), 0);
end;
$$;

-- Sletter fagsiden i papirkurven for godt.
create function public.slett_stoff_for_godt(stoff text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin public.profiles := intern.krev_admin();
begin
  if not exists (
    select 1 from public.stoffstatus s
    where s.stoff = slett_stoff_for_godt.stoff and s.status = 'papirkurv'
    for update
  ) then
    raise exception 'Fagsiden ligger ikke i papirkurven.' using errcode = 'P0002';
  end if;
  perform intern.fjern_stoff(slett_stoff_for_godt.stoff, admin.id);
end;
$$;

comment on function public.slett_stoff_for_godt(text) is
  'Sletter fagsiden i papirkurven for godt, med kortene, historikken og diskusjonene. Krever administrator.';

-- Sletter alt i papirkurven som er eldre enn `alder`, eller alt. Det som ikke
-- kan slettes for godt, blir liggende. Gir tilbake antallet som ble slettet.
create function intern.tom_papirkurv(alder interval, bruker uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rad record;
  antall integer := 0;
begin
  for rad in
    select s.stoff from public.stoffstatus s
    where s.status = 'papirkurv' and (tom_papirkurv.alder is null or s.endret_kl < now() - tom_papirkurv.alder)
    order by s.endret_kl
    for update skip locked
  loop
    begin
      perform intern.fjern_stoff(rad.stoff, tom_papirkurv.bruker);
      antall := antall + 1;
    exception when sqlstate '22023' then
      -- Noe annet peker på siden; den blir liggende.
      null;
    end;
  end loop;
  return antall;
end;
$$;

-- Tømmer papirkurven.
create function public.tom_stoffpapirkurven()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin public.profiles := intern.krev_admin();
begin
  return intern.tom_papirkurv(null, admin.id);
end;
$$;

comment on function public.tom_stoffpapirkurven() is
  'Sletter alt i papirkurven for godt, utenom det noe annet peker på. Krever administrator.';

-- Sletter det som har ligget i papirkurven i mer enn 30 dager. Appen kaller
-- den når registeret hentes, så alle innloggede kan; den gjør ikke annet.
create function public.rydd_stoffpapirkurven()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_registerbruker();
  return intern.tom_papirkurv(interval '30 days', null);
end;
$$;

comment on function public.rydd_stoffpapirkurven() is
  'Sletter det som har ligget i papirkurven i mer enn 30 dager.';

-- --- Rettighetene ------------------------------------------------------------------------

revoke all on function
  public.slett_stoff_for_godt(text),
  public.tom_stoffpapirkurven(),
  public.rydd_stoffpapirkurven()
from public, anon, authenticated, service_role;

grant execute on function
  public.slett_stoff_for_godt(text),
  public.tom_stoffpapirkurven(),
  public.rydd_stoffpapirkurven()
to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
