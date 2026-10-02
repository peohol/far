-- Stoffregisteret i databasen, del 3: stoffene, arkivet og papirkurven.
--
-- Det som holder plasseringene og statusen i takt med fagsidene, slettingen
-- for godt, og funksjonene som sletter kategorier og plasserer, arkiverer,
-- sletter og henter tilbake stoffer. Reglene står i `docs/stoffregister.md`.

-- --- Nøkkelen følger fagsiden -------------------------------------------------------

-- Når en publisert fagside får ny nøkkel, flytter plasseringene og statusen med.
create function intern.stoffregister_folg_nokkel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stoffplasseringer (stoff, kategori_id, plassert_kl)
  select new.slug, p.kategori_id, p.plassert_kl
  from public.stoffplasseringer p
  where p.stoff = old.slug
  on conflict do nothing;
  delete from public.stoffplasseringer p where p.stoff = old.slug;

  update public.stoffstatus s
  set stoff = new.slug
  where s.stoff = old.slug
    and not exists (select 1 from public.stoffstatus t where t.stoff = new.slug);
  delete from public.stoffstatus s where s.stoff = old.slug;
  return null;
end;
$$;

create trigger infosider_stoffregister_folger_nokkel
after update of slug on public.infosider
for each row
when (new.tilstand = 'publisert' and old.slug is distinct from new.slug)
execute function intern.stoffregister_folg_nokkel();

-- En ny fagside med nøkkelen til et stoff som er fjernet for godt, tar stoffet i bruk igjen.
create function intern.ny_stoffside_fjerner_gravstein()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.stoffstatus s where s.stoff = new.slug and s.status = 'fjernet';
  return null;
end;
$$;

create trigger infosider_fjerner_gravstein
after insert on public.infosider
for each row execute function intern.ny_stoffside_fjerner_gravstein();

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

-- --- Det appen kaller: slettingen av en kategori ----------------------------------

-- Sletter kategorien med underkategoriene. Stoffene i den mister bare den
-- plasseringen. Har den stoffer, kan bare en administrator slette den.
create function public.slett_stoffkategori(kategori uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rad public.stoffkategorier;
begin
  perform intern.krev_registerbruker();
  rad := intern.laas_stoffkategori(slett_stoffkategori.kategori);
  if not public.er_admin() and exists (
    select 1 from public.stoffplasseringer p
    join public.stoffkategorier k on k.id = p.kategori_id
    where k.id = rad.id or k.forelder_id = rad.id
  ) then
    raise exception 'Kategorien har stoffer. Flytt dem først, eller be en administrator slette den.' using errcode = '42501';
  end if;
  delete from public.stoffkategorier k where k.id = rad.id;
  perform intern.ordne_stoffkategorier(rad.forelder_id);
end;
$$;

comment on function public.slett_stoffkategori(uuid) is
  'Sletter kategorien med underkategoriene. En kategori med stoffer bare for administratorer.';

-- --- Det appen kaller: stoffene ----------------------------------------------------

-- Flytter stoffet fra kategorien `fra` til `til`. Uten `fra` legges det til
-- i `til` (og står der i tillegg); uten `til` tas det ut av `fra`.
create function public.plasser_stoff(stoff text, fra uuid, til uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_registerbruker();
  if plasser_stoff.til is not null then
    if not exists (
      select 1 from public.stoffkategorier k
      where k.id = plasser_stoff.til and k.arkivert_kl is null
        and not exists (select 1 from public.stoffkategorier f where f.id = k.forelder_id and f.arkivert_kl is not null)
    ) then
      raise exception 'Kategorien finnes ikke lenger, eller er arkivert.' using errcode = 'P0002';
    end if;
    insert into public.stoffplasseringer (stoff, kategori_id)
    values (plasser_stoff.stoff, plasser_stoff.til)
    on conflict do nothing;
  end if;
  if plasser_stoff.fra is not null and plasser_stoff.fra is distinct from plasser_stoff.til then
    delete from public.stoffplasseringer p where p.stoff = plasser_stoff.stoff and p.kategori_id = plasser_stoff.fra;
  end if;
end;
$$;

comment on function public.plasser_stoff(text, uuid, uuid) is
  'Flytter stoffet fra én kategori til en annen, legger det til i en kategori (uten fra) eller tar det ut (uten til).';

-- Arkiverer stoffet, eller henter det tilbake fra arkivet.
create function public.arkiver_stoff(stoff text, arkivert boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := intern.krev_registerbruker();
  naa text := (select s.status from public.stoffstatus s where s.stoff = arkiver_stoff.stoff for update);
begin
  if naa is not null and naa <> 'arkivert' then
    raise exception 'Fagsiden er slettet.' using errcode = '22023';
  end if;
  if arkiver_stoff.arkivert then
    insert into public.stoffstatus (stoff, status, endret_av)
    values (arkiver_stoff.stoff, 'arkivert', bruker)
    on conflict on constraint stoffstatus_pkey do nothing;
  else
    delete from public.stoffstatus s where s.stoff = arkiver_stoff.stoff and s.status = 'arkivert';
  end if;
end;
$$;

comment on function public.arkiver_stoff(text, boolean) is
  'Arkiverer stoffet eller henter det tilbake. Alle innloggede.';

-- Legger fagsiden i papirkurven. Bare en side i databasen kan slettes; en
-- side med innhold bare av en administrator.
create function public.slett_stoff(stoff text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := intern.krev_registerbruker();
  side uuid;
begin
  select s.objekt_id into side from public.infosider s where s.slug = slett_stoff.stoff limit 1;
  if side is null then
    raise exception 'Stoffet har ingen fagside å slette. Arkiver det i stedet.' using errcode = '22023';
  end if;
  if exists (select 1 from public.analyttkoblede_stoffer a where a.stoff = slett_stoff.stoff) then
    raise exception 'Fagsiden er koblet til laboratorieanalyser i fortolkningen og kan ikke slettes. Arkiver den i stedet.'
      using errcode = '22023';
  end if;
  if not public.er_admin() and intern.stoffside_har_innhold(side) then
    raise exception 'Bare administratorer kan slette en fagside med innhold. Arkiver den i stedet.' using errcode = '42501';
  end if;
  insert into public.stoffstatus (stoff, status, endret_av)
  values (slett_stoff.stoff, 'papirkurv', bruker)
  on conflict on constraint stoffstatus_pkey do update set status = 'papirkurv', endret_av = excluded.endret_av, endret_kl = now();
end;
$$;

comment on function public.slett_stoff(text) is
  'Legger fagsiden i papirkurven. Alle kan slette en side med bare navn; en side med innhold bare administratorer. En side fortolkningen lenker til, kan ikke slettes.';

-- Henter fagsiden tilbake fra papirkurven: en administrator, eller den som
-- la den der (så den som slettet, kan angre det uten å se papirkurven).
create function public.gjenopprett_stoff(stoff text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := intern.krev_registerbruker();
  rad public.stoffstatus;
begin
  select * into rad from public.stoffstatus s
  where s.stoff = gjenopprett_stoff.stoff and s.status = 'papirkurv'
  for update;
  if rad.stoff is null then
    raise exception 'Fagsiden ligger ikke i papirkurven.' using errcode = 'P0002';
  end if;
  if not public.er_admin() and rad.endret_av is distinct from bruker then
    raise exception 'Bare administratorer kan hente fagsider tilbake fra papirkurven.' using errcode = '42501';
  end if;
  delete from public.stoffstatus s where s.stoff = rad.stoff;
end;
$$;

comment on function public.gjenopprett_stoff(text) is
  'Henter fagsiden tilbake fra papirkurven. En administrator, eller den som la den der.';

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
  public.slett_stoffkategori(uuid),
  public.plasser_stoff(text, uuid, uuid),
  public.arkiver_stoff(text, boolean),
  public.slett_stoff(text),
  public.gjenopprett_stoff(text),
  public.slett_stoff_for_godt(text),
  public.tom_stoffpapirkurven(),
  public.rydd_stoffpapirkurven()
from public, anon, authenticated, service_role;

grant execute on function
  public.slett_stoffkategori(uuid),
  public.plasser_stoff(text, uuid, uuid),
  public.arkiver_stoff(text, boolean),
  public.slett_stoff(text),
  public.gjenopprett_stoff(text),
  public.slett_stoff_for_godt(text),
  public.tom_stoffpapirkurven(),
  public.rydd_stoffpapirkurven()
to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
