-- En ny referanse i en kurateringsgren som en annen gren alt har publisert
-- (samme kilde lagt inn på to sider som står til kontroll samtidig), brukes
-- ved publiseringen og prøvepubliseringen i stedet for å lages på nytt
-- (docs/kurateringsgrener.md, «Publiseringen»). Før stoppet publiseringen da
-- med en teknisk feil (ID-en fantes) eller la inn en dobbel referanse med
-- samme lenke (en annen ID). Bare kuratering.utfor endres; resten står som i
-- 20261016051000_kurateringsgrener.sql.

-- Skriver hele grenen inn gjennom den vanlige veien og publiserer den, i
-- rekkefølgen databasen krever: nye referanser, siden, kortene som fjernes, de
-- som endres og de nye, og bivirkningene. En kuratering avsluttes med
-- rapporten, kontrollert mot det som faktisk ble endret.
--
-- Stopper med PT409 når siden er publisert på nytt etter grunnversjonen, når
-- noe grenen endrer har et upublisert utkast fra vanlig redigering (det
-- utkastet skal ikke overtas eller overskrives i stillhet), og når en ny
-- referanse ikke kan lages eller brukes: lenken står på en referanse under
-- redigering eller på flere, eller ID-en er tatt av noe annet.
--
-- Med p_prov = true (prøvepubliseringen) stopper en feil i rapporten ikke
-- publiseringen, men gis tilbake, så resten kan prøves.
create or replace function kuratering.utfor(
  p_gren kuratering.grener, p_tilstand jsonb, p_publiserer public.profiles, p_prov boolean
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  side uuid := p_gren.infoside;
  siste public.sideversjoner;
  forfatter public.profiles := kuratering.forfatter(p_gren);
  o record;
  t public.objekttilstander;
  utkast integer;
  publisert integer;
  status public.objektstatus;
  imp jsonb;
  endring uuid;
  ryddet jsonb;
  rapportfeil text;
  agentnokkel text;
  grentilstand jsonb := p_tilstand;
  delt uuid;
  treff uuid[];
  v_lenke text;
begin
  perform pg_advisory_xact_lock(hashtextextended('sideversjon:' || side::text, 0));
  siste := kuratering.siste_versjon(side);
  if siste.id is distinct from p_gren.grunnversjon then
    raise exception 'Fagsiden er publisert på nytt etter at grenen ble laget. Grenen må oppdateres til den nye versjonen og kontrolleres på nytt.'
      using errcode = 'PT409', detail = jsonb_build_object('grunnversjon', p_gren.grunnversjon, 'gjeldende', siste.id)::text;
  end if;

  -- En ny referanse i grenen kan være publisert i mellomtiden av en annen gren
  -- som la inn den samme kilden; referansene deles mellom sidene. Da brukes den
  -- publiserte i stedet for å lage referansen på nytt. Med samme ID siterer
  -- kortene den alt. Med en annen ID byttes grenens ID med den publiserte i
  -- objektene grenen skriver: siteringene (panelreferanser, kortenes
  -- referanser og siteringsnodene i dataene) er ID-en som en hel JSON-tekst,
  -- og en UUID står ikke for noe annet. Den publiserte referansen står som den
  -- er; den kan ikke endres i en gren.
  --
  -- Lenken slås opp etter samme regel som intern.kuratering_referanse (som
  -- ikke kan brukes her, siden den lager referansen når den mangler): utkast og
  -- publiserte sammen, og bare en referanse som er arkivert i begge, er lagt
  -- bort. Den som brukes, må være publisert, og både utkastet og den publiserte
  -- må ha lenken og ikke være arkivert; ellers er referansen under redigering.
  -- Det, flere referanser med lenken, og en ID som er tatt av noe annet, er
  -- konflikter.
  --
  -- Oppslaget og opprettelsen låses per lenke på tvers av sidene (låsen på
  -- siden over gjelder bare én side), så to grener med den samme nye kilden
  -- ikke kan publiseres samtidig og begge lage den. Låsene tas i sortert
  -- rekkefølge, så to publiseringer ikke venter på hverandre.
  for v_lenke in
    select distinct lower(btrim(x.value -> 'innhold' ->> 'lenke'))
    from jsonb_each(p_tilstand -> 'objekter') x
    where x.value ->> 'type' = 'referanse' and (x.value ->> 'ny')::boolean
      and nullif(btrim(x.value -> 'innhold' ->> 'lenke'), '') is not null
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('referanselenke:' || v_lenke, 0));
  end loop;

  for o in
    select (x.key)::uuid as id, x.value as v
    from jsonb_each(p_tilstand -> 'objekter') x
    where x.value ->> 'type' = 'referanse' and (x.value ->> 'ny')::boolean
  loop
    v_lenke := nullif(btrim(o.v -> 'innhold' ->> 'lenke'), '');
    select array_agg(distinct r.objekt_id) into treff
    from public.referanser r
    where btrim(r.lenke) = v_lenke
      and exists (select 1 from public.referanser x where x.objekt_id = r.objekt_id and not x.arkivert);
    delt := null;
    if cardinality(treff) > 1 then
      raise exception 'Lenken til den nye referansen % står alt på % referanser. Duplikatene må avklares før grenen kan publiseres.', o.id, cardinality(treff)
        using errcode = 'PT409';
    elsif cardinality(treff) = 1 then
      if not exists (select 1 from public.referanser r where r.objekt_id = treff[1] and r.tilstand = 'publisert')
        or exists (
          select 1 from public.referanser r
          where r.objekt_id = treff[1] and (r.arkivert or btrim(r.lenke) is distinct from v_lenke)
        )
      then
        raise exception 'Lenken til den nye referansen % står på en referanse som er under redigering (et upublisert utkast med en annen lenke eller en arkivering). Utkastet må avklares før grenen kan publiseres.', o.id
          using errcode = 'PT409';
      end if;
      delt := treff[1];
    end if;
    if exists (select 1 from public.redigerbare_objekter x where x.id = o.id) and delt is distinct from o.id then
      raise exception 'Den nye referansen % i grenen har en ID som alt er i bruk, men ikke av en publisert referanse med samme lenke. Grenen må oppdateres med en ny ID for referansen.', o.id
        using errcode = 'PT409';
    end if;
    if delt is not null then
      grentilstand := grentilstand #- array['objekter', o.id::text];
      if delt <> o.id then
        grentilstand := jsonb_set(grentilstand, '{objekter}', regexp_replace(
          (grentilstand -> 'objekter')::text, '"' || o.id::text || '"', '"' || delt::text || '"', 'gi'
        )::jsonb);
      end if;
    end if;
  end loop;

  for o in
    select (x.key)::uuid as id, x.value as v
    from jsonb_each(grentilstand -> 'objekter') x
    where not (x.value ->> 'ny')::boolean
  loop
    select s.revisjon, s.publisert_revisjon into utkast, publisert
    from public.objektstatus s where s.id = o.id;
    if publisert is distinct from kuratering.forventet_revisjon(siste, o.id, o.v) then
      raise exception 'Objektet % er publisert på nytt etter grunnversjonen.', o.id using errcode = 'PT409';
    end if;
    if utkast is distinct from publisert then
      raise exception 'Objektet % har et upublisert utkast fra vanlig redigering. Det må publiseres eller tilbakestilles i appen før grenen kan publiseres.', o.id
        using errcode = 'PT409';
    end if;
  end loop;

  if p_gren.kurator is not null then
    select a.agent into agentnokkel from kuratering.agenter a where a.id = p_gren.kurator;
    perform set_config('far.kuratering', p_gren.stoff, true);
    perform set_config('far.endring', '', true);
    perform set_config('far.endringsvalg', jsonb_build_object('agent', agentnokkel)::text, true);
  end if;
  perform set_config('far.revisjonskilde', left('Kurateringsgren: ' || p_gren.formaal, 300) || ' (grenrevisjon ' || p_gren.revisjon || ')', true);
  perform set_config('far.sideversjonsopphav', case when p_gren.art = 'gjenoppretting' then 'gjenoppretting' else 'gren' end, true);

  -- Nye referanser først, så kortene kan sitere dem; deretter siden, og
  -- kortene som fjernes før de som endres og de nye, så et kort som erstatter
  -- et annet på en fast plass, får plassen.
  for o in
    select (x.key)::uuid as id, x.value as v,
      case
        when x.value ->> 'type' = 'referanse' then 0
        when x.value ->> 'type' = 'infoside' then 1
        when x.value -> 'innhold' ->> 'panel' = 'fjernet' then 2
        when not (x.value ->> 'ny')::boolean then 3
        else 4
      end as rekke
    from jsonb_each(grentilstand -> 'objekter') x
    order by 3, 1
  loop
    if (o.v ->> 'ny')::boolean then
      perform intern.opprett_objekt_som((o.v ->> 'type')::public.objekttype, o.id, o.v -> 'innhold', forfatter);
      status := intern.publiser_objekt(o.id, 1, p_publiserer);
    else
      select x.* into t from public.objekttilstander x where x.objekt_id = o.id and x.tilstand = 'utkast';
      status := intern.lagre_objekt(o.id, t.revisjon, o.v -> 'innhold', forfatter);
      status := intern.publiser_objekt(o.id, status.revisjon, p_publiserer);
    end if;
  end loop;

  for imp in select x from jsonb_array_elements(coalesce(grentilstand -> 'bivirkninger' -> 'trekk', '[]')) x loop
    perform bivirkninger.trekk_tilbake(p_gren.stoff, imp ->> 'nokkel', imp ->> 'begrunnelse');
  end loop;
  for imp in select x from jsonb_array_elements(coalesce(grentilstand -> 'bivirkninger' -> 'importer', '[]')) x loop
    perform bivirkninger.importer(imp);
  end loop;

  endring := nullif(current_setting('far.endring', true), '')::uuid;
  if endring is null then
    raise exception 'Grenen endrer ingenting på fagsiden.' using errcode = '22023';
  end if;

  if p_gren.kurator is not null then
    begin
      ryddet := intern.kontroller_rapport(endring, grentilstand -> 'rapport');
    exception when others then
      if not p_prov then
        raise;
      end if;
      get stacked diagnostics rapportfeil = message_text;
    end;
    update public.innholdsendringer x
    set agent = agentnokkel,
        oppsummering = coalesce(ryddet ->> 'oppsummering', left(p_gren.formaal, 500)),
        rapport = coalesce(ryddet - 'oppsummering' - 'lenker', '{}'::jsonb),
        lenker = array(
          select distinct l
          from unnest(x.lenker || array(select jsonb_array_elements_text(coalesce(ryddet -> 'lenker', '[]'::jsonb)))) l
          order by l),
        gren = p_gren.id,
        deler_ved_rapport = intern.antall_deler(endring)
    where x.id = endring;
  else
    update public.innholdsendringer x
    set gren = p_gren.id, oppsummering = coalesce(x.oppsummering, left(p_gren.formaal, 500))
    where x.id = endring;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'endring', endring,
    'seksjoner', (
      select coalesce(jsonb_agg(jsonb_build_object('seksjon', s.seksjon, 'art', s.art) order by s.seksjon, s.art), '[]'::jsonb)
      from intern.endringens_seksjoner(endring) s
    ),
    'rapport_ok', p_gren.kurator is null or rapportfeil is null,
    'rapportfeil', rapportfeil
  ));
end;
$$;

revoke all on function kuratering.utfor(kuratering.grener, jsonb, public.profiles, boolean)
  from public, anon, authenticated, service_role;
