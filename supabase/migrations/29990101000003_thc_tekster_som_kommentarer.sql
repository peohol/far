-- THC-syreregelsettet, del 2: tekstene som egne kommentarer, og kurvenes
-- rekkefølge avgjort for hele domenet.
--
-- Kommentar og regel er ulike objekter (docs/analyttsider-og-redigering.md,
-- avsnitt 10). Tekstbolkene lå inne i regelsettet; nå er hver av dem en
-- kommentar (objekttypen `kommentar`), og regelsettet sier bare hvilken
-- kommentar hver bolk bruker. En tekst kan rettes og publiseres uten å røre
-- reglene, og reglene kan ikke publiseres før tekstene de peker på.
--
-- Rekkefølgen på kurvene ble prøvd på et rutenett av IRCAK og døgn. Den
-- avgjøres nå eksakt for enhver forrige prøve og ethvert tidsrom, med samme
-- fremgangsmåte og samme meldinger som src/domain/thcKurver.ts og
-- thcRegelsett.ts. Utledningen står i thcKurver.ts.
--
-- Til slutt flyttes det lagrede regelsettet over: tekstene blir publiserte
-- kommentarer, og regelsettet lagres og publiseres som en ny revisjon som
-- peker på dem. Tidligere revisjoner står urørt. I en database uten
-- regelsettet gjør den delen ingenting.

-- --- Tekstbolkene, som i src/domain/thcTekster.ts --------------------------

-- Bolkene, i den rekkefølgen de står i kommentaren (THC_TEKSTNOKLER).
create function intern.thc_tekstnokler()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'apning', 'nylig_inntak', 'nytt_inntak', 'inntak_har_skjedd', 'pavisningstid', 'vanskelig',
    'ikke_nodvendigvis', 'under_cutoff_vanskelig', 'under_cutoff_ikke_nodvendigvis', 'uten_forrige'
  ]
$$;

-- Tittelen på bolken, slik meldingene og kommentarnavnene bruker den.
create function intern.thc_tekstbolktittel(p_nokkel text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_nokkel
    when 'apning' then 'Åpning'
    when 'nylig_inntak' then 'Nylig inntak'
    when 'nytt_inntak' then 'Nytt inntak etter forrige prøve'
    when 'inntak_har_skjedd' then 'Inntak har skjedd'
    when 'pavisningstid' then 'Påvisningstid'
    when 'vanskelig' then 'Vanskelig å avgjøre'
    when 'ikke_nodvendigvis' then 'Ikke nødvendigvis nytt inntak'
    when 'under_cutoff_vanskelig' then 'Vanskelig å avgjøre, forrige prøve under cut-off'
    when 'under_cutoff_ikke_nodvendigvis' then 'Ikke nødvendigvis nytt inntak, forrige prøve under cut-off'
    when 'uten_forrige' then 'Uten forrige prøve'
  end
$$;

-- Plassholderne bolken må ha.
create function intern.thc_tekstbolk_krever(p_nokkel text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_nokkel = 'apning' then array['{nivå}']
    when p_nokkel in ('nytt_inntak', 'vanskelig', 'ikke_nodvendigvis', 'under_cutoff_ikke_nodvendigvis')
      then array['{forrige prøvedato}']
    else array[]::text[]
  end
$$;

-- Plassholderne bolken kan ha. Datoen for forrige prøve finnes bare i bolkene
-- som brukes når det er en forrige prøve.
create function intern.thc_tekstbolk_kan(p_nokkel text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_nokkel in (
      'nytt_inntak', 'vanskelig', 'ikke_nodvendigvis', 'under_cutoff_vanskelig', 'under_cutoff_ikke_nodvendigvis'
    ) then array['{nivå}', '{forrige prøvedato}']
    else array['{nivå}']
  end
$$;

-- «grønne», «gule», «røde», som KURVEFARGE i src/domain/thcRegelsett.ts.
create function intern.thc_kurvefarge(p_rolle public.thc_kurverolle)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_rolle when 'gronn' then 'grønne' when 'gul' then 'gule' else 'røde' end
$$;

-- --- Kurvenes rekkefølge ---------------------------------------------------
--
--
-- Samme bevis som sammenlign i src/domain/thcKurver.ts, der utledningen står:
-- kurve A forventer minst like stor nedgang som kurve B fra enhver forrige
-- prøve over ethvert tidsrom hvis og bare hvis utskillelsesraten λ_A(z) ≥
-- λ_B(z) for alle konsentrasjoner z > 0. Funksjonene under er en linje for
-- linje-oversettelse; testene krever samme svar som TypeScript-versjonen.

-- exp uten feil ved under- og overflyt: Postgres melder feil der JavaScript
-- gir 0 eller uendelig.
create function intern.thc_exp(x double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case when x < -745 then 0::double precision when x > 709.78 then 'Infinity'::double precision else exp(x) end
$$;

-- ln(1 + x) med full presisjon også for små x.
create function intern.thc_log1p(x double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case when u = 1 then x else ln(u) * x / (u - 1) end
  from (select 1 + x as u) s
$$;

create function intern.thc_softplus(u double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case when u > 0 then u + intern.thc_log1p(intern.thc_exp(-u)) else intern.thc_log1p(intern.thc_exp(u)) end
$$;

create function intern.thc_logistisk(u double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case when u >= 0 then 1 / (1 + intern.thc_exp(-u)) else intern.thc_exp(u) / (1 + intern.thc_exp(u)) end
$$;

-- Kurven slik raten leses: ett ledd (enkel), eller rask rate kf, langsom rate
-- ks, p = (kf − ks)/ks og ln K = ln A − (1 + p)·ln B.
create type intern.thc_rateform as (enkel boolean, kf double precision, ks double precision, p double precision, lnk double precision);

create function intern.thc_rateform(a1 double precision, k1 double precision, a2 double precision, k2 double precision)
returns intern.thc_rateform
language plpgsql
immutable
set search_path = ''
as $$
declare
  kf double precision;
  ks double precision;
  a double precision;
  b double precision;
  p double precision;
begin
  if k1 = k2 then
    return row(true, k1, k1, 0, 0)::intern.thc_rateform;
  end if;
  if k1 > k2 then
    kf := k1; a := a1; ks := k2; b := a2;
  else
    kf := k2; a := a2; ks := k1; b := a1;
  end if;
  p := (kf - ks) / ks;
  return row(false, kf, ks, p, ln(a) - (1 + p) * ln(b))::intern.thc_rateform;
end;
$$;

-- Utskillelsesraten λ når kurven står på konsentrasjonen e^lnz.
create function intern.thc_rate(f intern.thc_rateform, lnz double precision)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  c double precision;
  start double precision;
  lav double precision;
  hoy double precision;
  midt double precision;
begin
  if f.enkel then
    return f.kf;
  end if;
  c := f.lnk + f.p * lnz;
  start := c - f.p * ln(2);
  lav := case when start <= 0 then start else start / (1 + f.p) end;
  hoy := c;
  for i in 1..200 loop
    midt := (lav + hoy) / 2;
    if midt + f.p * intern.thc_softplus(midt) < c then lav := midt; else hoy := midt; end if;
  end loop;
  return f.ks + (f.kf - f.ks) * intern.thc_logistisk((lav + hoy) / 2);
end;
$$;

-- ln z der λ = ks + (kf − ks)·q, for 0 < q < 1.
create function intern.thc_lnz_for_andel(f intern.thc_rateform, q double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select (u + f.p * intern.thc_softplus(u) - f.lnk) / f.p
  from (select ln(q) - intern.thc_log1p(-q) as u) s
$$;

-- null når kurve A (a1, k1, a2, k2) alltid gir minst like rask utskillelse
-- som kurve B (b1, l1, b2, l2); ellers hvor det brytes, i samme ordlyd som
-- hvor() i src/domain/thcRegelsett.ts.
create function intern.thc_rekkefolgebrudd(
  a1 double precision, k1 double precision, a2 double precision, k2 double precision,
  b1 double precision, l1 double precision, b2 double precision, l2 double precision
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  a intern.thc_rateform := intern.thc_rateform(a1, k1, a2, k2);
  b intern.thc_rateform := intern.thc_rateform(b1, l1, b2, l2);
  toleranse double precision := 1e-12 * greatest(a.kf, b.kf);
  qb double precision;
  lnz0 double precision;
  lnz1 double precision;
  steg double precision;
  fra double precision[] := array[]::double precision[];
  til double precision[] := array[]::double precision[];
  dybde integer[] := array[]::integer[];
  f double precision;
  t double precision;
  d integer;
  n integer;
  midt double precision;
  lave constant text := 'ved lave konsentrasjoner, altså lang tid etter inntak';
  hoye constant text := 'ved høye konsentrasjoner';
begin
  if a.enkel and b.enkel then
    return case when a.kf >= b.kf then null else lave end;
  end if;
  if a.enkel then
    return case when a.kf >= b.kf then null else hoye end;
  end if;
  if b.enkel then
    return case when a.ks >= b.kf then null else lave end;
  end if;
  if a.kf = b.kf and a.ks = b.ks then
    return case when a.lnk >= b.lnk then null else 'noe sted' end;
  end if;
  if not a.ks > b.ks then return lave; end if;
  if not a.kf > b.kf then return hoye; end if;

  qb := (a.ks - b.ks) / (b.kf - b.ks);
  if qb >= 1 then return null; end if;
  lnz0 := intern.thc_lnz_for_andel(b, qb);
  lnz1 := intern.thc_lnz_for_andel(a, (b.kf - a.ks) / (a.kf - a.ks));
  if not lnz0 < lnz1 then return null; end if;

  steg := (lnz1 - lnz0) / 256;
  for i in 0..255 loop
    fra := fra || (lnz0 + i * steg);
    til := til || (case when i = 255 then lnz1 else lnz0 + (i + 1) * steg end);
    dybde := dybde || 0;
  end loop;
  while cardinality(fra) > 0 loop
    n := cardinality(fra);
    f := fra[n]; t := til[n]; d := dybde[n];
    fra := fra[1:n - 1]; til := til[1:n - 1]; dybde := dybde[1:n - 1];
    continue when intern.thc_rate(a, f) >= intern.thc_rate(b, t) - toleranse;
    if not intern.thc_rate(a, f) >= intern.thc_rate(b, f) - toleranse or d >= 60 then
      return 'rundt IRCAK ' || intern.thc_vis_ircak(intern.thc_exp(f));
    end if;
    if not intern.thc_rate(a, t) >= intern.thc_rate(b, t) - toleranse then
      return 'rundt IRCAK ' || intern.thc_vis_ircak(intern.thc_exp(t));
    end if;
    midt := (f + t) / 2;
    fra := fra || f || midt;
    til := til || midt || t;
    dybde := dybde || (d + 1) || (d + 1);
  end loop;
  return null;
end;
$$;

-- En IRCAK med to gjeldende sifre, som visIrcak i src/domain/thcRegelsett.ts:
-- 36, 1200, 0.0012; svært små og store med tierpotens (1.2e-7).
create function intern.thc_vis_ircak(x double precision)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  e integer;
begin
  if not (x > 0 and x < 'Infinity') then
    return case when x > 0 then '∞' else '0' end;
  end if;
  e := floor(log(x));
  if e < -6 or e > 20 then
    return to_char(round((x / power(10::double precision, e) * 10)::numeric) / 10, 'FM990.0') || 'e' || e;
  end if;
  return round(
    round((x / power(10::double precision, e - 1))::numeric) * power(10::numeric, e - 1),
    greatest(0, 1 - e)
  )::text;
end;
$$;

-- --- Tekstbolkene peker på kommentarer -------------------------------------

-- Tekstene flyttes ut før tabellen byttes. Koblingen mellom bolk og ny
-- kommentar holdes her til regelsettet er lagret på nytt.
create temporary table thc_flytting (nokkel text primary key, kommentar_id uuid not null);

do $flytt_tekstene$
declare
  objekt uuid;
  utkast public.objektrevisjoner;
  publisert integer;
  bolk record;
  status public.objektstatus;
begin
  select o.id into objekt from public.redigerbare_objekter o where o.type = 'thc_regelsett';
  if objekt is null then
    return;
  end if;
  select r.* into utkast
  from public.objekttilstander t
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = t.revisjon
  where t.objekt_id = objekt and t.tilstand = 'utkast';
  select t.revisjon into publisert
  from public.objekttilstander t
  where t.objekt_id = objekt and t.tilstand = 'publisert';
  if publisert is distinct from utkast.revisjon then
    raise exception 'THC-syreregelsettet har et utkast som ikke er publisert. Tekstene flyttes ikke før det er avklart.';
  end if;

  -- Som den som lagret regelsettet sist, gjennom de vanlige funksjonene.
  perform set_config('request.jwt.claims',
    json_build_object('sub', utkast.utfort_av, 'role', 'authenticated')::text, true);
  perform set_config('far.revisjonskilde', 'Tekstbolken i THC-syreregelsettet, flyttet ut som egen kommentar', true);
  for bolk in
    select b.nokkel, b.tekst
    from public.thc_tekstbolker b
    where b.objekt_id = objekt and b.tilstand = 'utkast'
    order by array_position(intern.thc_tekstnokler(), b.nokkel)
  loop
    status := public.opprett_utkast('kommentar', jsonb_build_object(
      'navn', 'THC-syre: ' || intern.thc_tekstbolktittel(bolk.nokkel),
      'tekst', bolk.tekst,
      'plassholdere', to_jsonb(intern.plassholdere_i(bolk.tekst))
    ));
    perform public.publiser_utkast(status.id, status.revisjon);
    insert into thc_flytting (nokkel, kommentar_id) values (bolk.nokkel, status.id);
  end loop;
end
$flytt_tekstene$;

drop table public.thc_tekstbolker;

create table public.thc_tekstbolker (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  nokkel text not null,
  kommentar_id uuid not null,
  constraint thc_tekstbolker_pkey primary key (objekt_id, tilstand, nokkel),
  constraint thc_tekstbolker_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.thc_regelsett (objekt_id, tilstand) on delete cascade,
  -- Samme nøkler som THC_TEKSTNOKLER i src/domain/thcTekster.ts.
  constraint thc_tekstbolker_nokkel check (nokkel in (
    'apning', 'nylig_inntak', 'nytt_inntak', 'inntak_har_skjedd', 'pavisningstid', 'vanskelig',
    'ikke_nodvendigvis', 'under_cutoff_vanskelig', 'under_cutoff_ikke_nodvendigvis', 'uten_forrige'
  ))
);

create index thc_tekstbolker_kommentar_idx on public.thc_tekstbolker (kommentar_id);

comment on table public.thc_tekstbolker is
  'Kommentaren hver tekstbolk bruker. Teksten står i kommentaren; bolkene bindes sammen med ett mellomrom, og plassholderne {nivå} og {forrige prøvedato} fylles inn.';

-- Bare kommentarer, og det publiserte regelsettet bare publiserte kommentarer.
create trigger thc_tekstbolker_objekttype
before insert or update on public.thc_tekstbolker
for each row execute function intern.krev_objekttype('kommentar_id', 'kommentar');

alter table public.thc_tekstbolker enable row level security;

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.thc_tekstbolker for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

revoke all on table public.thc_tekstbolker from anon, authenticated, service_role;
grant select on table public.thc_tekstbolker to authenticated, service_role;

-- --- Skriving og lesing -----------------------------------------------------

create or replace function intern.skriv_thc_regelsett(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  maleusikkerhet jsonb;
  kurver jsonb;
  kurve jsonb;
  rolle public.thc_kurverolle;
  element jsonb;
  nr integer;
  forrige_verdi double precision;
  verdi double precision;
  z double precision;
  standard double precision;
  varsel integer;
  monster text;
  monstre jsonb;
  vanskelig public.thc_kurverolle;
  nytt public.thc_kurverolle;
  bolker jsonb;
  nokkel text;
  kommentar uuid;
  plassholdere text[];
  avvik text;
  faktor double precision;
  roller constant public.thc_kurverolle[] := enum_range(null::public.thc_kurverolle);
  hvor text;
begin
  -- Revisjoner fra før tekstene ble egne kommentarer har tekstene i seg
  -- (`tekster`). De gjenopprettes med reglene fra revisjonen og kommentarene
  -- regelsettet bruker nå: tekstene har sin egen historikk.
  if p_innhold ? 'tekster' and not p_innhold ? 'tekstbolker' then
    select jsonb_object_agg(b.nokkel, b.kommentar_id) into bolker
    from public.thc_tekstbolker b
    where b.objekt_id = p_objekt and b.tilstand = 'utkast';
    if bolker is null then
      raise exception 'Utgaven er fra før tekstene ble egne kommentarer, og regelsettet har ingen kommentarer å bruke i stedet.'
        using errcode = '22023';
    end if;
    p_innhold := (p_innhold - 'tekster') || jsonb_build_object('tekstbolker', bolker);
  end if;

  perform intern.krev_felt(p_innhold, array[
    'konverteringsfaktor', 'kurver', 'maleusikkerhet', 'sikkerhetsmarginer', 'standard_sikkerhetsmargin',
    'konsentrasjonsnivaer', 'bruksmonstre', 'varsel_dager_mellom', 'tekstbolker'
  ]);

  faktor := intern.flyttall(p_innhold, 'konverteringsfaktor');
  if not faktor > 0 then
    raise exception 'Konverteringsfaktoren må være et tall større enn 0.' using errcode = '22023';
  end if;

  maleusikkerhet := intern.objekt(p_innhold, 'maleusikkerhet');
  perform intern.krev_felt(maleusikkerhet, array['cv_thc', 'cv_kreatinin', 'faktor_under_cutoff']);
  if not (intern.flyttall(maleusikkerhet, 'cv_thc') > 0 and intern.flyttall(maleusikkerhet, 'cv_thc') < 1) then
    raise exception 'CV for THC-syre må ligge mellom 0 og 1.' using errcode = '22023';
  end if;
  if not (intern.flyttall(maleusikkerhet, 'cv_kreatinin') > 0 and intern.flyttall(maleusikkerhet, 'cv_kreatinin') < 1) then
    raise exception 'CV for kreatinin må ligge mellom 0 og 1.' using errcode = '22023';
  end if;
  if not intern.flyttall(maleusikkerhet, 'faktor_under_cutoff') >= 1 then
    raise exception 'Faktoren for måleusikkerhet under cut-off må være minst 1.' using errcode = '22023';
  end if;

  -- Det finnes bare ett THC-syreregelsett.
  if exists (
    select 1 from public.thc_regelsett r
    where r.tilstand = p_tilstand and r.objekt_id <> p_objekt
  ) then
    raise exception 'Det finnes alt et THC-syreregelsett. Endre det i stedet for å lage et nytt.'
      using errcode = '22023';
  end if;

  standard := intern.flyttall(p_innhold, 'standard_sikkerhetsmargin');
  varsel := intern.heltall(p_innhold, 'varsel_dager_mellom');
  if varsel < 1 then
    raise exception 'Varselet om tid mellom prøvene må være et helt antall døgn, minst 1.' using errcode = '22023';
  end if;

  insert into public.thc_regelsett (
    objekt_id, tilstand, konverteringsfaktor, cv_thc, cv_kreatinin, faktor_under_cutoff,
    standard_sikkerhetsmargin, varsel_dager_mellom
  )
  values (
    p_objekt, p_tilstand, faktor,
    intern.flyttall(maleusikkerhet, 'cv_thc'),
    intern.flyttall(maleusikkerhet, 'cv_kreatinin'),
    intern.flyttall(maleusikkerhet, 'faktor_under_cutoff'),
    standard, varsel
  )
  on conflict on constraint thc_regelsett_pkey do update set
    konverteringsfaktor = excluded.konverteringsfaktor,
    cv_thc = excluded.cv_thc,
    cv_kreatinin = excluded.cv_kreatinin,
    faktor_under_cutoff = excluded.faktor_under_cutoff,
    standard_sikkerhetsmargin = excluded.standard_sikkerhetsmargin,
    varsel_dager_mellom = excluded.varsel_dager_mellom;

  delete from public.thc_kurver k where k.objekt_id = p_objekt and k.tilstand = p_tilstand;
  delete from public.thc_sikkerhetsmarginer m where m.objekt_id = p_objekt and m.tilstand = p_tilstand;
  delete from public.thc_konsentrasjonsnivaer n where n.objekt_id = p_objekt and n.tilstand = p_tilstand;
  delete from public.thc_bruksmonstre b where b.objekt_id = p_objekt and b.tilstand = p_tilstand;
  delete from public.thc_tekstbolker t where t.objekt_id = p_objekt and t.tilstand = p_tilstand;

  -- Kurvene.
  kurver := intern.objekt(p_innhold, 'kurver');
  perform intern.krev_felt(kurver, array['gronn', 'gul', 'rod']);
  foreach rolle in array enum_range(null::public.thc_kurverolle) loop
    kurve := intern.objekt(kurver, rolle::text);
    perform intern.krev_felt(kurve, array['navn', 'a1', 'k1', 'a2', 'k2']);
    if intern.tekst(kurve, 'navn') = '' then
      raise exception 'Den % kurven mangler navn.', intern.thc_kurvefarge(rolle) using errcode = '22023';
    end if;
    if not (intern.flyttall(kurve, 'a1') > 0 and intern.flyttall(kurve, 'k1') > 0
      and intern.flyttall(kurve, 'a2') > 0 and intern.flyttall(kurve, 'k2') > 0)
    then
      raise exception '%: a1, k1, a2 og k2 må være tall større enn 0.', intern.tekst(kurve, 'navn')
        using errcode = '22023';
    end if;
    insert into public.thc_kurver (objekt_id, tilstand, rolle, navn, a1, k1, a2, k2)
    values (
      p_objekt, p_tilstand, rolle, intern.tekst(kurve, 'navn'),
      intern.flyttall(kurve, 'a1'), intern.flyttall(kurve, 'k1'),
      intern.flyttall(kurve, 'a2'), intern.flyttall(kurve, 'k2')
    );
  end loop;

  -- Grønn skal gi minst like rask utskillelse som gul, og gul som rød, ved
  -- alle konsentrasjoner: da forventer den minst like stor nedgang fra enhver
  -- forrige prøve over ethvert tidsrom. Avgjort for hele domenet, som
  -- sammenlign i src/domain/thcKurver.ts, der beviset står.
  for nr in 1 .. cardinality(roller) - 1 loop
    select intern.thc_rekkefolgebrudd(
      r.a1 * faktor, r.k1, r.a2 * faktor, r.k2,
      t.a1 * faktor, t.k1, t.a2 * faktor, t.k2
    ) into hvor
    from public.thc_kurver r, public.thc_kurver t
    where r.objekt_id = p_objekt and r.tilstand = p_tilstand and r.rolle = roller[nr]
      and t.objekt_id = p_objekt and t.tilstand = p_tilstand and t.rolle = roller[nr + 1];
    if hvor is not null then
      raise exception 'Den % kurven må gi minst like rask utskillelse som den % ved alle konsentrasjoner, men gjør det ikke %.',
        intern.thc_kurvefarge(roller[nr]), intern.thc_kurvefarge(roller[nr + 1]), hvor
        using errcode = '22023';
    end if;
  end loop;

  -- Sikkerhetsmarginene.
  if jsonb_array_length(intern.liste(p_innhold, 'sikkerhetsmarginer')) = 0 then
    raise exception 'Det må finnes minst én sikkerhetsmargin.' using errcode = '22023';
  end if;
  forrige_verdi := null;
  for element in select e from jsonb_array_elements(p_innhold -> 'sikkerhetsmarginer') e loop
    perform intern.krev_felt(element, array['margin', 'z']);
    verdi := intern.flyttall(element, 'margin');
    z := intern.flyttall(element, 'z');
    if not (verdi >= 0.5 and verdi < 1) then
      raise exception 'En sikkerhetsmargin må være minst 50 %% og under 100 %%.' using errcode = '22023';
    end if;
    if forrige_verdi is not null and not verdi > forrige_verdi then
      raise exception 'Sikkerhetsmarginene må stå stigende, uten like.' using errcode = '22023';
    end if;
    if not abs(z - intern.normalkvantil(1 - verdi)) <= 1e-9 then
      raise exception 'z-verdien for % %% stemmer ikke med marginen.', verdi * 100 using errcode = '22023';
    end if;
    insert into public.thc_sikkerhetsmarginer (objekt_id, tilstand, margin, z)
    values (p_objekt, p_tilstand, verdi, z);
    forrige_verdi := verdi;
  end loop;
  if not exists (
    select 1 from public.thc_sikkerhetsmarginer m
    where m.objekt_id = p_objekt and m.tilstand = p_tilstand and m.margin = standard
  ) then
    raise exception 'Standardmarginen må være en av sikkerhetsmarginene.' using errcode = '22023';
  end if;

  -- Konsentrasjonsnivåene.
  if jsonb_array_length(intern.liste(p_innhold, 'konsentrasjonsnivaer')) = 0 then
    raise exception 'Det må finnes minst ett konsentrasjonsnivå.' using errcode = '22023';
  end if;
  forrige_verdi := null;
  for element, nr in
    select e, n from jsonb_array_elements(p_innhold -> 'konsentrasjonsnivaer') with ordinality as x(e, n)
  loop
    perform intern.krev_felt(element, array['navn', 'nedre', 'nylig_inntak']);
    if intern.tekst(element, 'navn') = '' then
      raise exception 'Et konsentrasjonsnivå mangler navn.' using errcode = '22023';
    end if;
    if nr = 1 then
      if jsonb_typeof(element -> 'nedre') <> 'null' then
        raise exception 'Det laveste konsentrasjonsnivået skal ikke ha nedre grense.' using errcode = '22023';
      end if;
      verdi := null;
    else
      if jsonb_typeof(element -> 'nedre') is distinct from 'number' or not (element ->> 'nedre')::double precision > 0 then
        raise exception 'Skillepunktet under «%» må være et tall større enn 0.', intern.tekst(element, 'navn')
          using errcode = '22023';
      end if;
      verdi := (element ->> 'nedre')::double precision;
      if forrige_verdi is not null and not verdi > forrige_verdi then
        raise exception 'Skillepunktene mellom konsentrasjonsnivåene må være stigende.' using errcode = '22023';
      end if;
      forrige_verdi := verdi;
    end if;
    if exists (
      select 1 from public.thc_konsentrasjonsnivaer n
      where n.objekt_id = p_objekt and n.tilstand = p_tilstand and n.navn = intern.tekst(element, 'navn')
    ) then
      raise exception 'To konsentrasjonsnivåer har samme navn.' using errcode = '22023';
    end if;
    insert into public.thc_konsentrasjonsnivaer (objekt_id, tilstand, posisjon, navn, nedre, nylig_inntak)
    values (
      p_objekt, p_tilstand, nr, intern.tekst(element, 'navn'), verdi,
      intern.sannhetsverdi(element, 'nylig_inntak')
    );
  end loop;

  -- Bruksmønstrene.
  monstre := intern.objekt(p_innhold, 'bruksmonstre');
  perform intern.krev_felt(monstre, array['kronisk', 'ikke_kronisk']);
  foreach monster in array array['kronisk', 'ikke_kronisk'] loop
    element := intern.objekt(monstre, monster);
    perform intern.krev_felt(element, array['vanskelig_over', 'nytt_inntak_over']);
    if intern.tekst(element, 'vanskelig_over') <> all (enum_range(null::public.thc_kurverolle)::text[])
      or intern.tekst(element, 'nytt_inntak_over') <> all (enum_range(null::public.thc_kurverolle)::text[])
    then
      raise exception 'Grensene % peker på en ukjent kurve.', replace(replace(monster, 'ikke_kronisk', 'uten kronisk bruk'), 'kronisk', 'ved kronisk bruk')
        using errcode = '22023';
    end if;
    vanskelig := intern.tekst(element, 'vanskelig_over')::public.thc_kurverolle;
    nytt := intern.tekst(element, 'nytt_inntak_over')::public.thc_kurverolle;
    if not vanskelig < nytt then
      raise exception 'Grensene %: nytt inntak må ligge på en tregere kurve enn «vanskelig å avgjøre».', case monster when 'kronisk' then 'ved kronisk bruk' else 'uten kronisk bruk' end
        using errcode = '22023';
    end if;
    insert into public.thc_bruksmonstre (objekt_id, tilstand, kronisk, vanskelig_over, nytt_inntak_over)
    values (p_objekt, p_tilstand, monster = 'kronisk', vanskelig, nytt);
  end loop;

  -- Kommentaren hver tekstbolk bruker. Plassholderne i en kommentar endres
  -- aldri, så det som godtas her, holder også etter senere tekstendringer.
  bolker := intern.objekt(p_innhold, 'tekstbolker');
  perform intern.krev_felt(bolker, intern.thc_tekstnokler());
  foreach nokkel in array intern.thc_tekstnokler() loop
    kommentar := intern.id(bolker, nokkel);
    select k.plassholdere into plassholdere
    from public.kommentarer k
    where k.objekt_id = kommentar
    limit 1;
    if not found then
      raise exception 'Tekstbolken «%» må peke på en kommentar.', intern.thc_tekstbolktittel(nokkel)
        using errcode = '22023';
    end if;
    select string_agg(p, ', ' order by p collate "C") into avvik
    from unnest(plassholdere) p where p <> all (intern.thc_tekstbolk_kan(nokkel));
    if avvik is not null then
      raise exception 'Tekstbolken «%» har plassholdere den ikke kan bruke: %.', intern.thc_tekstbolktittel(nokkel), avvik
        using errcode = '22023';
    end if;
    select p into avvik
    from unnest(intern.thc_tekstbolk_krever(nokkel)) with ordinality as x(p, n)
    where p <> all (plassholdere)
    order by n
    limit 1;
    if avvik is not null then
      raise exception 'Tekstbolken «%» må inneholde %.', intern.thc_tekstbolktittel(nokkel), avvik
        using errcode = '22023';
    end if;
    insert into public.thc_tekstbolker (objekt_id, tilstand, nokkel, kommentar_id)
    values (p_objekt, p_tilstand, nokkel, kommentar);
  end loop;
end;
$$;

-- Øyeblikksbildet, på samme form som ThcRegelsettinnhold i
-- src/domain/thcTekster.ts. Tallene gis med korteste eksakte skrivemåte.
create or replace function intern.les_thc_regelsett(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
set extra_float_digits = 1
as $$
  select jsonb_build_object(
    'konverteringsfaktor', to_jsonb(r.konverteringsfaktor),
    'kurver', (
      select jsonb_object_agg(k.rolle::text, jsonb_build_object(
        'navn', k.navn, 'a1', to_jsonb(k.a1), 'k1', to_jsonb(k.k1), 'a2', to_jsonb(k.a2), 'k2', to_jsonb(k.k2)
      ))
      from public.thc_kurver k
      where k.objekt_id = r.objekt_id and k.tilstand = r.tilstand
    ),
    'maleusikkerhet', jsonb_build_object(
      'cv_thc', to_jsonb(r.cv_thc),
      'cv_kreatinin', to_jsonb(r.cv_kreatinin),
      'faktor_under_cutoff', to_jsonb(r.faktor_under_cutoff)
    ),
    'sikkerhetsmarginer', (
      select coalesce(jsonb_agg(jsonb_build_object('margin', to_jsonb(m.margin), 'z', to_jsonb(m.z)) order by m.margin), '[]'::jsonb)
      from public.thc_sikkerhetsmarginer m
      where m.objekt_id = r.objekt_id and m.tilstand = r.tilstand
    ),
    'standard_sikkerhetsmargin', to_jsonb(r.standard_sikkerhetsmargin),
    'konsentrasjonsnivaer', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'navn', n.navn, 'nedre', to_jsonb(n.nedre), 'nylig_inntak', n.nylig_inntak
      ) order by n.posisjon), '[]'::jsonb)
      from public.thc_konsentrasjonsnivaer n
      where n.objekt_id = r.objekt_id and n.tilstand = r.tilstand
    ),
    'bruksmonstre', (
      select jsonb_object_agg(
        case when b.kronisk then 'kronisk' else 'ikke_kronisk' end,
        jsonb_build_object('vanskelig_over', b.vanskelig_over, 'nytt_inntak_over', b.nytt_inntak_over)
      )
      from public.thc_bruksmonstre b
      where b.objekt_id = r.objekt_id and b.tilstand = r.tilstand
    ),
    'varsel_dager_mellom', r.varsel_dager_mellom,
    'tekstbolker', (
      select jsonb_object_agg(t.nokkel, t.kommentar_id)
      from public.thc_tekstbolker t
      where t.objekt_id = r.objekt_id and t.tilstand = r.tilstand
    )
  )
  from public.thc_regelsett r
  where r.objekt_id = p_objekt and r.tilstand = p_tilstand
$$;

-- Rutenettet og tekstkontrollen i den første utgaven er erstattet.
drop function intern.thc_forventet_endring(
  double precision, double precision, double precision, double precision, double precision, double precision
);
drop function intern.thc_kurveverdi(
  double precision, double precision, double precision, double precision, double precision
);
drop function intern.thc_tekst(jsonb, text, text);

revoke all on all functions in schema intern from public, anon, authenticated, service_role;

-- --- Regelsettet lagres på nytt, med kommentarene --------------------------

do $lagre_regelsettet$
declare
  objekt uuid;
  utkast public.objektrevisjoner;
  status public.objektstatus;
begin
  select o.id into objekt from public.redigerbare_objekter o where o.type = 'thc_regelsett';
  if objekt is null then
    return;
  end if;
  select r.* into utkast
  from public.objekttilstander t
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = t.revisjon
  where t.objekt_id = objekt and t.tilstand = 'utkast';

  perform set_config('request.jwt.claims',
    json_build_object('sub', utkast.utfort_av, 'role', 'authenticated')::text, true);
  perform set_config('far.revisjonskilde', 'Tekstbolkene flyttet ut som egne kommentarer, som regelsettet peker på', true);
  status := public.lagre_utkast(objekt, utkast.revisjon, (utkast.innhold - 'tekster') || jsonb_build_object(
    'tekstbolker', (select jsonb_object_agg(f.nokkel, f.kommentar_id) from thc_flytting f)
  ));
  perform public.publiser_utkast(objekt, status.revisjon);
end
$lagre_regelsettet$;

drop table thc_flytting;