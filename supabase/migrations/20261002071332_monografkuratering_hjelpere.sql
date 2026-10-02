-- Hjelpefunksjoner for sikre monografkurateringer (`docs/monografkuratering.md`).
--
-- En monografkuratering endrer innholdselementer på en stoffside med en
-- datamigrasjon. Kuratoren kontrollerer først elementene slik de står i
-- produksjonen (preflight), og migrasjonen skal bare endre nøyaktig de
-- objektene og revisjonene som ble kontrollert. Funksjonene her gjør det til
-- en del av hvert kall:
--
--   * `kuratering_start` logger inn som kuratoren. Uten kuratorprofil — en tom
--     database i testene eller en ny gren — gjør migrasjonen ingenting; men
--     finnes siden uten kuratoren, stopper den, så produksjonen aldri hopper
--     over en kuratering i stillhet.
--   * `kuratering_antall` og `kuratering_element` er preflighten: et panel
--     skal ha det antallet elementer kuratoren så, og et element skal finnes
--     nøyaktig én gang, publisert, uten upublisert utkast, på revisjonen (og
--     med kilden) kuratoren kontrollerte. Et duplikat eller et parallelt
--     redaksjonelt element stopper migrasjonen i stedet for at et tilfeldig
--     objekt blir valgt.
--   * `kuratering_lagre` lagrer og publiserer én endring mot den revisjonen,
--     med kilden i historikken; `kuratering_nytt` og `kuratering_referanse`
--     legger til et element eller en kilde som ikke finnes fra før.
--   * `kuratering_utfort` sier om en kuratering med denne kilden alt er gjort.
--
-- Funksjonene ligger i `intern`, som ingen av API-rollene når, og skriver bare
-- gjennom de vanlige operasjonene (`opprett_utkast`, `lagre_utkast`,
-- `publiser_utkast`), med de samme kontrollene som appen. En feil stopper hele
-- migrasjonen, som er én transaksjon, så ingenting blir halvveis endret.

create function intern.kuratering_start(p_slug text, p_kurator text default 'peohol')
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  kurator uuid;
  side uuid;
begin
  select p.id into kurator from public.profiles p where p.username = p_kurator and p.role = 'admin';
  select s.objekt_id into side from public.infosider s where s.tilstand = 'publisert' and s.slug = p_slug;

  if kurator is null then
    if side is not null then
      raise exception 'Stoffsiden «%» finnes, men ikke administratoren %, som kurateringen føres på.', p_slug, p_kurator;
    end if;
    raise notice 'Fant ingen administrator %, så kurateringen av «%» hoppes over.', p_kurator, p_slug;
    return null;
  end if;
  if side is null then
    raise exception 'Fant ingen publisert stoffside med nøkkelen «%».', p_slug;
  end if;

  -- Ingen andre kan legge til, endre eller fjerne elementer eller referanser
  -- før kurateringen er ferdig, så det preflighten fant, står til den er
  -- skrevet. Lesing går som før.
  lock table public.innholdselementer, public.referanser in share row exclusive mode;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', kurator, 'role', 'authenticated')::text, true);
  return side;
end;
$$;

comment on function intern.kuratering_start(text, text) is
  'Logger inn som kuratoren, låser elementene og referansene mot andre endringer til migrasjonen er ferdig, og gir den publiserte stoffsiden med nøkkelen. Null uten kuratorprofil (tom database), feil om siden finnes uten den.';

-- Elementene på siden i et panel med en elementtype, utkast og publisert
-- sammen, der `data` inneholder `p_nokkel`. Et element som bare finnes som
-- utkast, eller som er flyttet i utkastet, telles med: det er også
-- redaksjonelt arbeid kurateringen ikke skal gå forbi.
create function intern.kuratering_kandidater(p_side uuid, p_panel text, p_elementtype text, p_nokkel jsonb)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct e.objekt_id
  from public.innholdselementer e
  where e.infoside_id = p_side and e.panel = p_panel and e.elementtype = p_elementtype
    and e.data @> coalesce(p_nokkel, '{}'::jsonb)
$$;

create function intern.kuratering_antall(p_side uuid, p_panel text, p_elementtype text, p_forventet integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  antall integer;
begin
  select count(*) into antall from intern.kuratering_kandidater(p_side, p_panel, p_elementtype, '{}'::jsonb);
  if antall is distinct from p_forventet then
    raise exception 'Forventet % % i panelet %, fant %. Siden er endret etter preflighten.',
      p_forventet, p_elementtype, p_panel, antall;
  end if;
end;
$$;

comment on function intern.kuratering_antall(uuid, text, text, integer) is
  'Preflight: stopper hvis panelet ikke har nøyaktig så mange elementer av typen (utkast og publiserte sammen).';

create function intern.kuratering_element(
  p_side uuid,
  p_panel text,
  p_elementtype text,
  p_nokkel jsonb,
  p_revisjon integer,
  p_kilde text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  treff uuid[];
  objekt uuid;
  utkast integer;
  publisert integer;
  kilde text;
  beskrivelse text := format('%s %s %s', p_panel, p_elementtype, coalesce(p_nokkel, '{}'::jsonb));
begin
  select array_agg(k) into treff from intern.kuratering_kandidater(p_side, p_panel, p_elementtype, p_nokkel) k;
  if coalesce(cardinality(treff), 0) <> 1 then
    raise exception 'Forventet nøyaktig ett element % på siden, fant %. Et duplikat eller parallelt redaksjonelt element må avklares først.',
      beskrivelse, coalesce(cardinality(treff), 0);
  end if;
  objekt := treff[1];

  -- Låst til transaksjonen er ferdig, så ingen lagring kommer imellom.
  select t.revisjon into utkast
  from public.objekttilstander t
  where t.objekt_id = objekt and t.tilstand = 'utkast'
  for update;
  select t.revisjon into publisert
  from public.objekttilstander t
  where t.objekt_id = objekt and t.tilstand = 'publisert';

  if publisert is null then
    raise exception 'Elementet % er ikke publisert.', beskrivelse;
  end if;
  if utkast is distinct from publisert then
    raise exception 'Elementet % har et upublisert utkast (revisjon %, publisert %).', beskrivelse, utkast, publisert;
  end if;
  if publisert is distinct from p_revisjon then
    raise exception 'Elementet % står på revisjon %, ikke % som preflighten kontrollerte.', beskrivelse, publisert, p_revisjon;
  end if;

  if p_kilde is not null then
    select r.kilde into kilde from public.objektrevisjoner r where r.objekt_id = objekt and r.revisjon = publisert;
    if kilde is distinct from p_kilde then
      raise exception 'Revisjon % av elementet % har kilden «%», ikke «%».', publisert, beskrivelse, kilde, p_kilde;
    end if;
  end if;
  return objekt;
end;
$$;

comment on function intern.kuratering_element(uuid, text, text, jsonb, integer, text) is
  'Preflight: det ene elementet i panelet der data inneholder nøkkelen, publisert og uten utkast, på revisjonen (og med kilden) kuratoren kontrollerte. Stopper ellers.';

create function intern.kuratering_lagre(p_objekt uuid, p_revisjon integer, p_endring jsonb, p_kilde text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  innhold jsonb;
  publisert integer;
  status public.objektstatus;
begin
  if nullif(btrim(p_kilde), '') is null then
    raise exception 'En kuratering må ha en kilde i historikken.';
  end if;

  select r.innhold into innhold from public.objektrevisjoner r where r.objekt_id = p_objekt and r.revisjon = p_revisjon;
  select t.revisjon into publisert from public.objekttilstander t where t.objekt_id = p_objekt and t.tilstand = 'publisert';
  if innhold is null or publisert is distinct from p_revisjon then
    raise exception 'Objektet % er ikke publisert på revisjon %.', p_objekt, p_revisjon;
  end if;

  perform set_config('far.revisjonskilde', p_kilde, true);
  -- `lagre_utkast` avviser med PT409 om utkastet ikke lenger står på revisjonen.
  status := public.lagre_utkast(p_objekt, p_revisjon, innhold || p_endring);
  if status.revisjon = p_revisjon then
    raise notice 'Objektet % sto allerede slik kurateringen gir det.', p_objekt;
    return p_revisjon;
  end if;
  status := public.publiser_utkast(p_objekt, status.revisjon);
  return status.revisjon;
end;
$$;

comment on function intern.kuratering_lagre(uuid, integer, jsonb, text) is
  'Lagrer innholdet i revisjonen med endringen (feltene på øverste nivå byttes ut) og publiserer det, med kilden i historikken. Gir den nye revisjonen.';

create function intern.kuratering_nytt(p_side uuid, p_innhold jsonb, p_nokkel jsonb, p_kilde text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  antall integer;
  objekt uuid;
begin
  if nullif(btrim(p_kilde), '') is null then
    raise exception 'En kuratering må ha en kilde i historikken.';
  end if;
  select count(*) into antall
  from intern.kuratering_kandidater(p_side, p_innhold->>'panel', p_innhold->>'elementtype', p_nokkel);
  if antall > 0 then
    raise exception 'Det finnes alt % element(er) % % % på siden.',
      antall, p_innhold->>'panel', p_innhold->>'elementtype', p_nokkel;
  end if;

  perform set_config('far.revisjonskilde', p_kilde, true);
  objekt := (public.opprett_utkast('innholdselement', p_innhold || jsonb_build_object('infoside', p_side))).id;
  perform public.publiser_utkast(objekt, 1);
  return objekt;
end;
$$;

comment on function intern.kuratering_nytt(uuid, jsonb, jsonb, text) is
  'Oppretter og publiserer et nytt innholdselement på siden. Stopper hvis panelet alt har et element der data inneholder nøkkelen.';

create function intern.kuratering_referanse(p_innhold jsonb, p_kilde text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  treff uuid[];
  objekt uuid;
begin
  if nullif(btrim(p_kilde), '') is null then
    raise exception 'En kuratering må ha en kilde i historikken.';
  end if;
  if coalesce(p_innhold->>'lenke', '') = '' then
    raise exception 'En kilde i en kuratering må ha en lenke.';
  end if;
  select array_agg(r.objekt_id order by r.objekt_id) into treff
  from public.referanser r
  where r.tilstand = 'publisert' and not r.arkivert and r.lenke = p_innhold->>'lenke';

  if cardinality(treff) > 1 then
    raise exception 'Lenken % står på % referanser. Duplikatene må avklares først.', p_innhold->>'lenke', cardinality(treff);
  end if;
  if cardinality(treff) = 1 then
    return treff[1];
  end if;

  perform set_config('far.revisjonskilde', p_kilde, true);
  objekt := (public.opprett_utkast('referanse', p_innhold)).id;
  perform public.publiser_utkast(objekt, 1);
  return objekt;
end;
$$;

comment on function intern.kuratering_referanse(jsonb, text) is
  'Den publiserte referansen med lenken, eller en ny, publisert referanse. Stopper hvis lenken står på flere.';

create function intern.kuratering_utfort(p_kilde text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.objektrevisjoner r where r.kilde = p_kilde)
$$;

comment on function intern.kuratering_utfort(text) is
  'Om noen revisjon har denne kilden, altså om kurateringen alt er gjort.';

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
