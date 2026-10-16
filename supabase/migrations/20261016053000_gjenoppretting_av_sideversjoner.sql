-- Gjenoppretting av en eldre versjon av en fagside, og bivirkningene i en versjon
-- (docs/kurateringsgrener.md, fase C i docs/kurateringsgrener-fremdrift.md).
--
-- En administrator tar en eldre sideversjon tilbake som en gren
-- (`art = 'gjenoppretting'`): forskjellen mellom den og siden slik den står nå
-- regnes ut som endringer, prøvepubliseres, kan forhåndsvises og sammenlignes,
-- og publiseres samlet som en ny sideversjon med opphavet `gjenoppretting`.
-- Ingenting i historikken skrives om.
--
-- Det som ikke tas tilbake, sies fra om: navnet og nøkkelen til siden (siden
-- er den samme), referansene (de deles med andre sider og står som nå), og
-- kort som er slettet for godt eller står på en annen side.

-- Endringene som tar siden tilbake til den gamle versjonen, i samme form som
-- en grens tilstand, og merknadene om det som står som nå.
create function kuratering.gjenoppretting(p_gammel public.sideversjoner, p_siste public.sideversjoner)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  side uuid := p_siste.infoside;
  objekter jsonb := '{}';
  merknader text[] := '{}';
  importer jsonb := '[]';
  trekk jsonb := '[]';
  e record;
  gammelt jsonb;
  naa jsonb;
  publisert integer;
  innhold jsonb;
  utenfor integer := 0;
  flyttet integer := 0;
  referanser integer;
begin
  -- Siden selv, med navnet og nøkkelen den har nå.
  select r.innhold into gammelt from public.objektrevisjoner r
  where r.objekt_id = side and r.revisjon = kuratering.revisjon_i_versjon(p_gammel, side);
  select r.innhold into naa from public.objektrevisjoner r
  where r.objekt_id = side and r.revisjon = kuratering.revisjon_i_versjon(p_siste, side);
  innhold := (gammelt - 'navn' - 'slug') || jsonb_strip_nulls(jsonb_build_object('navn', naa -> 'navn', 'slug', naa -> 'slug'));
  if innhold <> naa then
    objekter := objekter || jsonb_build_object(side::text, jsonb_build_object('type', 'infoside', 'ny', false, 'innhold', innhold));
  end if;
  if gammelt ->> 'navn' is distinct from naa ->> 'navn' then
    merknader := merknader || format('Fagsiden heter «%s» som nå, ikke «%s» som i versjonen.', naa ->> 'navn', gammelt ->> 'navn');
  end if;

  -- Kortene i den gamle versjonen, slik de var der.
  for e in
    select (x ->> 'id')::uuid as id, (x ->> 'revisjon')::integer as revisjon
    from jsonb_array_elements(p_gammel.manifest -> 'elementer') x
  loop
    select s.publisert_revisjon into publisert from public.objektstatus s where s.id = e.id;
    if publisert is null then
      utenfor := utenfor + 1;
      continue;
    end if;
    select r.innhold into naa from public.objektrevisjoner r where r.objekt_id = e.id and r.revisjon = publisert;
    if (naa ->> 'infoside')::uuid is distinct from side then
      flyttet := flyttet + 1;
      continue;
    end if;
    select r.innhold into gammelt from public.objektrevisjoner r where r.objekt_id = e.id and r.revisjon = e.revisjon;
    if gammelt <> naa then
      objekter := objekter || jsonb_build_object(e.id::text, jsonb_build_object(
        'type', 'innholdselement', 'ny', false, 'innhold', gammelt, 'grunnrevisjon', publisert));
    end if;
  end loop;
  if utenfor > 0 then
    merknader := merknader || format('%s kort fra versjonen er slettet for godt og kan ikke tas tilbake.', utenfor);
  end if;
  if flyttet > 0 then
    merknader := merknader || format('%s kort fra versjonen står nå på en annen fagside og blir der.', flyttet);
  end if;

  -- Kortene som er kommet til siden, fjernes.
  for e in
    select (x ->> 'id')::uuid as id, (x ->> 'revisjon')::integer as revisjon
    from jsonb_array_elements(p_siste.manifest -> 'elementer') x
    where kuratering.revisjon_i_versjon(p_gammel, (x ->> 'id')::uuid) is null
  loop
    select r.innhold into naa from public.objektrevisjoner r where r.objekt_id = e.id and r.revisjon = e.revisjon;
    objekter := objekter || jsonb_build_object(e.id::text, jsonb_build_object(
      'type', 'innholdselement', 'ny', false, 'innhold', naa || '{"panel": "fjernet"}'));
  end loop;

  -- Referansene deles med andre sider og står som nå.
  select count(*) into referanser
  from jsonb_array_elements(p_gammel.manifest -> 'referanser') x
  join public.objektstatus s on s.id = (x ->> 'id')::uuid
  where s.publisert_revisjon is distinct from (x ->> 'revisjon')::integer;
  if referanser > 0 then
    merknader := merknader || format('%s referanser er endret etter versjonen. De deles med andre sider og står som nå.', referanser);
  end if;

  -- Bivirkningsimportene: den gamle importen av hver kilde legges inn på nytt,
  -- og kildene som er kommet til, trekkes tilbake.
  for e in
    select coalesce(g.nokkel, n.nokkel) as nokkel, g.id as gammel, n.id as naa
    from (select x ->> 'nokkel' as nokkel, (x ->> 'id')::uuid as id from jsonb_array_elements(p_gammel.manifest -> 'bivirkninger') x) g
    full join (select x ->> 'nokkel' as nokkel, (x ->> 'id')::uuid as id from jsonb_array_elements(p_siste.manifest -> 'bivirkninger') x) n
      on n.nokkel = g.nokkel
    where g.id is distinct from n.id
    order by 1
  loop
    if e.gammel is not null then
      importer := importer || coalesce((select jsonb_build_array(k.importen) from bivirkninger.kilder k where k.id = e.gammel), '[]');
    else
      trekk := trekk || jsonb_build_array(jsonb_build_object(
        'nokkel', e.nokkel, 'begrunnelse', format('Gjenoppretting av versjon %s av fagsiden.', p_gammel.nr)));
    end if;
  end loop;

  return jsonb_build_object(
    'tilstand', kuratering.tom_tilstand() || jsonb_build_object(
      'objekter', objekter,
      'bivirkninger', jsonb_build_object('importer', importer, 'trekk', trekk)),
    'merknader', to_jsonb(merknader)
  );
end;
$$;

-- En administrator tar en eldre versjon av fagsiden tilbake. Grenen får én
-- revisjon med endringene, prøvepublisert, og publiseres av en administrator
-- når forhåndsvisningen er sett (`publiser`).
create function kuratering.h_gjenopprett_versjon(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  side uuid;
  stoff text := btrim(coalesce(p_data ->> 'stoff', ''));
  gammel public.sideversjoner;
  siste public.sideversjoner;
  beregnet jsonb;
  g kuratering.grener;
begin
  if not p_aktor.admin then
    raise exception 'Bare administratorene gjenoppretter en versjon.' using errcode = '42501';
  end if;
  select s.objekt_id into side from public.infosider s where s.tilstand = 'publisert' and s.slug = stoff;
  if side is null then
    raise exception 'Fant ingen publisert fagside «%».', stoff using errcode = 'PT404';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sideversjon:' || side::text, 0));
  select v.* into gammel from public.sideversjoner v where v.infoside = side and v.nr = (p_data ->> 'nr')::integer;
  if gammel.id is null then
    raise exception 'Fagsiden har ingen versjon %.', p_data ->> 'nr' using errcode = 'PT404';
  end if;
  siste := kuratering.siste_versjon(side);
  if gammel.id = siste.id then
    raise exception 'Versjon % er den gjeldende.', gammel.nr using errcode = '22023';
  end if;
  if exists (select 1 from kuratering.grener x where x.infoside = side and kuratering.er_aktiv(x.status)) then
    raise exception 'Fagsiden har en aktiv kurateringsgren. Den må publiseres eller forkastes først.' using errcode = 'PT409';
  end if;

  beregnet := kuratering.gjenoppretting(gammel, siste);
  if beregnet -> 'tilstand' = kuratering.tom_tilstand() then
    raise exception 'Versjon % er lik den gjeldende i alt som kan tas tilbake.', gammel.nr using errcode = '22023';
  end if;

  insert into kuratering.grener (infoside, stoff, art, formaal, opprettet_av, opprettet_av_navn, grunnversjon)
  values (
    side, stoff, 'gjenoppretting',
    left(btrim('Gjenoppretting av versjon ' || gammel.nr || coalesce(': ' || nullif(btrim(p_data ->> 'grunn'), ''), '')), 500),
    (p_aktor.profil).id, kuratering.aktornavn(p_aktor), siste.id
  )
  returning * into g;
  perform kuratering.ny_hendelse(g, 'apnet', p_aktor, null, 'arbeid', jsonb_build_object(
    'grunnversjon', siste.nr, 'art', 'gjenoppretting', 'fra_versjon', gammel.nr, 'merknader', beregnet -> 'merknader'));
  g := kuratering.ny_revisjon(g, beregnet -> 'tilstand', siste.id, p_aktor, 'Versjon ' || gammel.nr || ' tatt tilbake');
  return kuratering.detaljer(g, null, false) || jsonb_build_object('fra_versjon', gammel.nr, 'merknader', beregnet -> 'merknader');
end;
$$;

-- --- Bivirkningene i en versjon ------------------------------------------------

-- Bivirkningene fra bestemte kilder, i samme form som `les_bivirkninger`. En
-- kilde som er erstattet eller trukket tilbake, har radene sine fortsatt.
create function bivirkninger.les_kilder(p_kilder uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  with kilder as (
    select k.* from bivirkninger.kilder k where k.id = any (p_kilder)
  )
  select jsonb_build_object(
    'kilder', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'nokkel', k.nokkel, 'type', k.type, 'tittel', k.tittel, 'preparat', k.preparat,
        'innehaver', k.innehaver, 'spc_versjon', k.spc_versjon, 'revisjonsdato', k.revisjonsdato,
        'lenke', k.lenke, 'kontrollert', k.kontrollert, 'kontrollert_av', k.kontrollert_av,
        'merknad', k.merknad, 'importert_kl', k.importert_kl, 'importert_av', k.importert_av,
        'kontekster', coalesce((
          select jsonb_agg(jsonb_build_object(
            'nokkel', t.nokkel, 'navn', t.navn, 'frekvensgrunnlag', t.frekvensgrunnlag, 'merknad', t.merknad)
            order by t.posisjon)
          from bivirkninger.kontekster t
          where t.kilde = k.id), '[]'))
        order by k.importert_kl, k.nokkel)
      from kilder k), '[]'),
    'bivirkninger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kilde', b.kilde, 'kontekst', t.nokkel, 'organsystem', b.organsystem, 'frekvens', b.frekvens,
        'tekst', b.tekst, 'fotnote', b.fotnote, 'posisjon', b.posisjon)
        order by o.rang, f.rang, k.importert_kl, k.nokkel, t.posisjon nulls first, b.posisjon)
      from bivirkninger.bivirkninger b
      join kilder k on k.id = b.kilde
      left join bivirkninger.kontekster t on t.id = b.kontekst
      join bivirkninger.organsystemer o on o.kode = b.organsystem
      join bivirkninger.frekvenser f on f.kode = b.frekvens), '[]')
  )
$$;

create or replace function public.les_bivirkninger(stoff text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select bivirkninger.les_kilder(array(
    select k.id
    from bivirkninger.kilder k
    where k.erstattet_av is null
      and k.trukket_kl is null
      and k.infoside in (select s.objekt_id from public.infosider s where s.slug = les_bivirkninger.stoff)
  ))
$$;

-- Bivirkningene på fagsiden slik de var i en versjon av den, i samme form som
-- `les_bivirkninger`. `null` når versjonen ikke finnes.
create function public.les_sideversjon_bivirkninger(stoff text, nr integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select bivirkninger.les_kilder(array(
    select (x ->> 'id')::uuid from jsonb_array_elements(v.manifest -> 'bivirkninger') x
  ))
  from public.sideversjoner v
  join public.infosider s on s.objekt_id = v.infoside and s.tilstand = 'publisert'
  where s.slug = btrim(les_sideversjon_bivirkninger.stoff) and v.nr = les_sideversjon_bivirkninger.nr
$$;

comment on function public.les_sideversjon_bivirkninger(text, integer) is
  'Bivirkningene på fagsiden slik de var i en versjon, i samme form som les_bivirkninger. For alle innloggede.';

create or replace function kuratering.handlinger(p_admin boolean)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case when p_admin
    then array['oversikt', 'les', 'les_dokument', 'vurder', 'publiser', 'stans', 'gjenoppta', 'forkast', 'agenter', 'ny_agentnokkel',
      'gjenopprett_versjon']
    else array['oversikt', 'apne', 'les', 'skriv', 'aktivitet', 'dokument', 'les_dokument', 'avslutt_blindfase',
      'til_kontroll', 'trekk_fra_kontroll', 'vurder', 'oppdater_grunnlag', 'publiser', 'forkast']
  end
$$;

revoke all on all functions in schema kuratering from public, anon, authenticated, service_role;
revoke all on function bivirkninger.les_kilder(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.les_sideversjon_bivirkninger(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.les_sideversjon_bivirkninger(text, integer) to authenticated;
