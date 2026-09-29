-- Stoffet er fagsidens identitet.
--
-- En fagside (informasjonsside, `infoside`) handler om et stoff i
-- stoffregisteret og har nå en stabil, URL-vennlig nøkkel: `slug`. Appen
-- finner siden etter nøkkelen (#/stoff/bupropion), ikke etter navnet og aldri
-- gjennom en laboratorieanalytt. Nøkkelen settes av navnet når siden lages,
-- og står når navnet endres; den kan bare endres uttrykkelig, i innholdet.
--
-- Laboratorieanalyttene hører til fortolkningssystemet. Koblingen mellom et
-- stoff og analyttene er eksplisitt og står i stoffregisteret
-- (src/data/stoffregister.json), ikke i sidens identitet. Funksjonene her
-- leser derfor fagsidene uten å gå veien om noen analytt:
--
-- - les_stoff: én fagside etter nøkkelen
-- - les_stoffer: alle fagsidene, til søket i hele kunnskapsbasen
-- - les_stoffliste: nøkkelen og navnet til hver fagside, til stoffregisteret
-- - les_stoffreferanseomrader: referanseområdekortene per stoff, som appen
--   knytter til analyttkodene gjennom koblingene i registeret
--
-- Funksjonene som leste en side gjennom en analyttkode (les_analyttside,
-- les_analyttsider, les_stoffside, les_stoffsider, les_stoffsidenavn,
-- les_referanseomrader, finn_infosider) blir stående for eldre utgaver av
-- appen som fortsatt er åpne i en nettleser, men appen bruker dem ikke lenger.
--
-- Ingen historiske revisjoner endres. Nøkkelen fylles inn i tabellen for
-- sidene som finnes, av navnet. Innholdet har den bare med når den er en
-- annen enn den navnet gir, så sidene står likt revisjonen sin som før.
-- Bakgrunnen står i docs/faginnhold.md.

-- --- Nøkkelen --------------------------------------------------------------

-- Den URL-vennlige nøkkelen et navn gir. Samme regel som stoffslug() i
-- src/domain/stoffregister.ts: små bokstaver, æ, ø og å skrevet om, og alt
-- annet enn a–z og 0–9 som én bindestrek.
create function intern.stoffslug(navn text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        replace(replace(replace(replace(lower(navn), 'æ', 'ae'), 'ø', 'o'), 'å', 'a'), 'ß', 'ss'),
        'áàâäãéèêëíìîïóòôöõúùûüýñç',
        'aaaaaeeeeiiiiooooouuuuync'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  )
$$;

comment on function intern.stoffslug(text) is
  'Den URL-vennlige nøkkelen et navn gir. Samme regel som stoffslug() i src/domain/stoffregister.ts.';

alter table public.infosider add column slug text;

-- Nøkkelen per side, av navnet i utkastet, så utkastet og det publiserte får
-- den samme: nøkkelen er stoffets identitet og skal ikke byttes når et utkast
-- publiseres. To sider som ville fått samme nøkkel, skilles med et tall, og
-- den eldste siden beholder nøkkelen uten tall.
--
-- Bare en side der nøkkelen ikke er den navnet i tilstanden gir — et
-- upublisert navnebytte, eller en side som fikk et tall — får nøkkelen med i
-- innholdet den leses med (se les_infoside), og står da ikke likt revisjonen
-- sin før den lagres igjen. Produksjonen hadde ingen slike sider 29.09.2026.
with kandidater as (
  select
    s.objekt_id,
    coalesce(nullif(intern.stoffslug(s.navn), ''), 'side') as nokkel,
    (select min(r.utfort_kl) from public.objektrevisjoner r where r.objekt_id = s.objekt_id) as laget
  from public.infosider s
  where s.tilstand = 'utkast'
),
nummerert as (
  select
    k.objekt_id,
    k.nokkel,
    row_number() over (partition by k.nokkel order by k.laget, k.objekt_id) as nr
  from kandidater k
)
update public.infosider s
set slug = case when n.nr = 1 then n.nokkel else n.nokkel || '-' || n.nr end
from nummerert n
where n.objekt_id = s.objekt_id;

alter table public.infosider
  alter column slug set not null,
  add constraint infosider_slug check (char_length(slug) <= 200 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

create unique index infosider_slug_idx on public.infosider (tilstand, slug);

comment on column public.infosider.slug is
  'Stoffets stabile nøkkel i adressen (#/stoff/<slug>). Settes av navnet når siden lages, og endres ikke når navnet endres.';

comment on table public.infosider is
  'Fagsiden (monografien) om et stoff i stoffregisteret, f.eks. Bupropion, med stoffets nøkkel. Innholdet ligger i innholdselementer. Laboratorieanalytter kobles til stoffet i stoffregisteret, ikke her.';

-- Siden får nøkkelen i innholdet. Mangler den — i eldre revisjoner, og når
-- appen bare endrer navnet eller referansene — beholder siden nøkkelen den
-- har, og en ny side får den navnet gir. En nøkkel som alt tilhører en annen
-- side, i noen av tilstandene, avvises.
create or replace function intern.skriv_infoside(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  nytt_navn text;
  ny_slug text;
  paneler jsonb;
  panelet text;
  teller integer := 0;
begin
  p_innhold := intern.med_standard(p_innhold, 'panelreferanser', '{}');
  if jsonb_typeof(p_innhold) = 'object' and not p_innhold ? 'slug' and jsonb_typeof(p_innhold -> 'navn') = 'string' then
    p_innhold := p_innhold || jsonb_build_object(
      'slug',
      coalesce(
        (
          select s.slug from public.infosider s
          where s.objekt_id = p_objekt
          order by s.tilstand = 'utkast' desc
          limit 1
        ),
        intern.stoffslug(p_innhold ->> 'navn')
      )
    );
  end if;
  perform intern.krev_felt(p_innhold, array['navn', 'slug', 'panelreferanser']);
  nytt_navn := intern.tekst(p_innhold, 'navn');
  ny_slug := intern.tekst(p_innhold, 'slug');
  paneler := intern.objekt(p_innhold, 'panelreferanser');

  -- Et tomt navn avvises av tabellen, som før; da er det ikke nøkkelen som er feil.
  if btrim(nytt_navn) <> '' and ny_slug = '' then
    raise exception 'Navnet % må ha minst én bokstav eller ett tall.', nytt_navn
      using errcode = '22023';
  end if;
  if ny_slug <> '' and (char_length(ny_slug) > 200 or ny_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$') then
    raise exception 'Adressen «%» kan bare ha små bokstaver a–z, tall og enkle bindestreker.', ny_slug
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.infosider s
    where s.tilstand = p_tilstand and lower(s.navn) = lower(nytt_navn) and s.objekt_id <> p_objekt
  ) then
    raise exception 'Det finnes alt en informasjonsside som heter %.', nytt_navn
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.infosider s
    where s.slug = ny_slug and s.objekt_id <> p_objekt
  ) then
    raise exception 'Det finnes alt en stoffside med adressen %.', ny_slug
      using errcode = '22023';
  end if;

  insert into public.infosider (objekt_id, tilstand, navn, slug)
  values (p_objekt, p_tilstand, nytt_navn, ny_slug)
  on conflict on constraint infosider_pkey do update set navn = excluded.navn, slug = excluded.slug;

  delete from public.referansekoblinger k
  where k.objekt_id = p_objekt and k.tilstand = p_tilstand;

  for panelet in select p from jsonb_object_keys(paneler) p order by p loop
    if char_length(panelet) > 60 or panelet !~ '^[a-z][a-z0-9_]*$' then
      raise exception 'Panelet % har ikke en gyldig nøkkel.', panelet using errcode = '22023';
    end if;

    insert into public.referansekoblinger (objekt_id, tilstand, nr, niva, panel, referanse_id)
    select p_objekt, p_tilstand, teller + r.nr, 'panel', panelet, r.id
    from unnest(intern.id_liste(paneler, panelet)) with ordinality as r(id, nr);
    teller := teller + jsonb_array_length(paneler -> panelet);
  end loop;
end;
$$;

-- Innholdet til siden. Nøkkelen står bare med når den er en annen enn den
-- navnet gir: slik står sidene som finnes, fortsatt likt revisjonen sin, og en
-- side som beholder nøkkelen sin når den får nytt navn, får den med.
create or replace function intern.les_infoside(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('navn', s.navn)
    || case when s.slug = intern.stoffslug(s.navn) then '{}'::jsonb else jsonb_build_object('slug', s.slug) end
    || coalesce(
    (
      select jsonb_build_object('panelreferanser', jsonb_object_agg(p.panel, p.ider))
      from (
        select k.panel, jsonb_agg(k.referanse_id order by k.nr) as ider
        from public.referansekoblinger k
        where k.objekt_id = s.objekt_id and k.tilstand = s.tilstand and k.niva = 'panel'
        group by k.panel
      ) p
      having count(*) > 0
    ),
    '{}'::jsonb
  )
  from public.infosider s
  where s.objekt_id = p_objekt and s.tilstand = p_tilstand
$$;

-- --- Lesingen etter stoffet ------------------------------------------------

-- Sidene med disse ID-ene: stoffet (ID, nøkkel og navn), siden, elementene og
-- ID-ene til referansene den siterer, med referansene én gang i `referanser`.
-- Erstatter formen fra stoffsider_uten_kode, som også hadde de tomme feltene
-- `analytt` og `komponenter`; eldre klienter fyller dem inn selv.
create or replace function public.stoffsider_som_json(sider uuid[], sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with utgaver as (
    select u.objekt_id, public.utgave_som_json(u) as json
    from public.objektutgaver u
    where u.tilstand = sidetilstand
  ),
  valgte as (
    select s.objekt_id, s.navn, s.slug
    from public.infosider s
    where s.tilstand = sidetilstand and s.objekt_id = any (stoffsider_som_json.sider)
  ),
  elementer as (
    select e.infoside_id, e.objekt_id
    from valgte v
    join public.innholdselementer e on e.infoside_id = v.objekt_id and e.tilstand = sidetilstand
  ),
  -- Referansene siden siterer: fra panelene (på siden), kortene og teksten.
  siteringer as (
    select v.objekt_id as infoside_id, k.referanse_id
    from valgte v
    join public.referansekoblinger k on k.objekt_id = v.objekt_id and k.tilstand = sidetilstand
    union
    select e.infoside_id, k.referanse_id
    from elementer e
    join public.referansekoblinger k on k.objekt_id = e.objekt_id and k.tilstand = sidetilstand
  ),
  elementer_per_side as (
    select e.infoside_id, jsonb_agg(u.json order by u.objekt_id) as elementer
    from elementer e
    join utgaver u on u.objekt_id = e.objekt_id
    group by e.infoside_id
  ),
  referanser_per_side as (
    select s.infoside_id, jsonb_agg(s.referanse_id order by s.referanse_id) as referanser
    from siteringer s
    group by s.infoside_id
  )
  select jsonb_build_object(
    'sider', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'stoff', jsonb_build_object('id', v.objekt_id, 'slug', v.slug, 'navn', v.navn),
            'infoside', ui.json,
            'elementer', coalesce(e.elementer, '[]'::jsonb),
            'referanser', coalesce(r.referanser, '[]'::jsonb)
          )
          order by lower(v.navn)
        )
        from valgte v
        join utgaver ui on ui.objekt_id = v.objekt_id
        left join elementer_per_side e on e.infoside_id = v.objekt_id
        left join referanser_per_side r on r.infoside_id = v.objekt_id
      ),
      '[]'::jsonb
    ),
    'referanser', coalesce(
      (
        select jsonb_agg(u.json order by u.objekt_id)
        from utgaver u
        where u.objekt_id in (select referanse_id from siteringer)
      ),
      '[]'::jsonb
    )
  )
$$;

comment on function public.stoffsider_som_json(uuid[], public.objekttilstand) is
  'Fagsidene med disse ID-ene i én tilstand: stoffet, siden, elementene og referansene, med referansene én gang. Radsikkerheten gjelder.';

-- Fagsiden for stoffet med denne nøkkelen, i én tilstand: stoffet, siden,
-- elementene og referansene den siterer. `null` når ingen side har nøkkelen.
create function public.les_stoff(stoff text, sidetilstand public.objekttilstand)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  side_id uuid;
  sider jsonb;
begin
  select s.objekt_id into side_id
  from public.infosider s
  where s.tilstand = sidetilstand and s.slug = btrim(les_stoff.stoff);
  if side_id is null then
    return null;
  end if;

  sider := public.stoffsider_som_json(array[side_id], sidetilstand);
  return (sider -> 'sider' -> 0) || jsonb_build_object('referanser', sider -> 'referanser');
end
$$;

comment on function public.les_stoff(text, public.objekttilstand) is
  'Fagsiden for stoffet med denne nøkkelen i én tilstand, med referansene. Radsikkerheten gjelder.';

-- Alle fagsidene i én tilstand, til søket i hele kunnskapsbasen.
create function public.les_stoffer(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.stoffsider_som_json(coalesce(array_agg(s.objekt_id), '{}'), sidetilstand)
  from public.infosider s
  where s.tilstand = sidetilstand
$$;

comment on function public.les_stoffer(public.objekttilstand) is
  'Alle fagsidene i én tilstand, på samme form som les_stoff, med referansene én gang. Radsikkerheten gjelder.';

-- ID-en, nøkkelen og navnet til hver fagside, alfabetisk, til stoffregisteret.
create function public.les_stoffliste(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('id', s.objekt_id, 'slug', s.slug, 'navn', s.navn) order by lower(s.navn)),
    '[]'::jsonb
  )
  from public.infosider s
  where s.tilstand = sidetilstand
$$;

comment on function public.les_stoffliste(public.objekttilstand) is
  'Nøkkelen og navnet til hver fagside i én tilstand, alfabetisk. Radsikkerheten gjelder.';

-- Referanseområdekortene på fagsidene: stoffet, koden kortet gjelder (`null`
-- for stoffets hovedanalytt) og verdien. Hvilken analyttkode et kort gjelder,
-- avgjør appen av koblingene i stoffregisteret.
create function public.les_stoffreferanseomrader(sidetilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('stoff', s.slug, 'gjelder', nullif(e.data ->> 'gjelder', ''), 'verdi', e.data)
      order by s.slug, e.data ->> 'gjelder' nulls first
    ),
    '[]'::jsonb
  )
  from public.infosider s
  join public.innholdselementer e on e.infoside_id = s.objekt_id and e.tilstand = s.tilstand
  where s.tilstand = sidetilstand
    and e.panel = 'viktige_data'
    and e.elementtype = 'referanseomrade'
$$;

comment on function public.les_stoffreferanseomrader(public.objekttilstand) is
  'Referanseområdekortene på fagsidene i én tilstand, med stoffets nøkkel og koden kortet gjelder. Radsikkerheten gjelder.';

-- --- Det som ble lest gjennom analyttkoden ----------------------------------

comment on function public.les_analyttside(text, public.objekttilstand) is
  'Utgått: leste en fagside gjennom en analyttkode. Står for eldre klienter; appen bruker les_stoff.';
comment on function public.les_analyttsider(public.objekttilstand) is
  'Utgått: leste fagsidene gjennom analyttkodene. Står for eldre klienter; appen bruker les_stoffer.';
comment on function public.les_stoffside(text, public.objekttilstand) is
  'Utgått: leste en fagside etter navnet. Står for eldre klienter; appen bruker les_stoff.';
comment on function public.les_stoffsider(public.objekttilstand) is
  'Utgått: leste fagsidene uten analyttkode. Står for eldre klienter; appen bruker les_stoffer.';
comment on function public.les_stoffsidenavn(public.objekttilstand) is
  'Utgått: navnene på fagsidene uten analyttkode. Står for eldre klienter; appen bruker les_stoffliste.';
comment on function public.les_referanseomrader(public.objekttilstand) is
  'Utgått: referanseområdet per analyttkode gjennom hovedsiden. Står for eldre klienter; appen bruker les_stoffreferanseomrader.';
comment on function public.finn_infosider(text[], public.objekttilstand) is
  'Utgått: informasjonssidene etter navn. Står for eldre klienter; appen finner sidene etter nøkkelen.';

-- --- Rettigheter -----------------------------------------------------------

revoke all on function
  public.les_stoff(text, public.objekttilstand),
  public.les_stoffer(public.objekttilstand),
  public.les_stoffliste(public.objekttilstand),
  public.les_stoffreferanseomrader(public.objekttilstand)
from public, anon, authenticated, service_role;

grant execute on function
  public.les_stoff(text, public.objekttilstand),
  public.les_stoffer(public.objekttilstand),
  public.les_stoffliste(public.objekttilstand),
  public.les_stoffreferanseomrader(public.objekttilstand)
to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;