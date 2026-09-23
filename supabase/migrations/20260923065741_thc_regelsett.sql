-- THC-syreregelsettet: fagkunnskapen fortolkningen av THC-syre i urin bygger
-- på, som redigerbart faginnhold med utkast, publisering, revisjoner og
-- gjenoppretting.
--
-- Regelsettet er ett objekt. Alt i det — kurvene, måleusikkerheten,
-- sikkerhetsmarginene, konsentrasjonsnivåene, grensene per bruksmønster,
-- varselet og tekstbolkene — lagres, publiseres og gjenopprettes derfor
-- samlet, i én transaksjon, gjennom de fire vanlige funksjonene. Det finnes
-- bare ett THC-syreregelsett.
--
-- Innholdet ligger i vanlige tabeller med kontroller, ikke som JSON, og
-- skriv_thc_regelsett avviser alt som bryter reglene før noe lagres. De samme
-- reglene står i src/domain/thcRegelsett.ts og thcMotor.ts, slik at
-- redigeringen kan si fra før lagring. Bakgrunnen står i docs/thc-syre.md.

-- --- Typene ----------------------------------------------------------------

-- Samme verdier som THC_KURVEROLLER i src/domain/thcRegelsett.ts, fra raskest
-- til tregest utskillelse.
create type public.thc_kurverolle as enum ('gronn', 'gul', 'rod');

-- --- Tabellene -------------------------------------------------------------

create table public.thc_regelsett (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  konverteringsfaktor double precision not null,
  cv_thc double precision not null,
  cv_kreatinin double precision not null,
  faktor_under_cutoff double precision not null,
  standard_sikkerhetsmargin double precision not null,
  varsel_dager_mellom integer not null,
  constraint thc_regelsett_pkey primary key (objekt_id, tilstand),
  constraint thc_regelsett_tilstand_fkey
    foreign key (objekt_id, tilstand)
    references public.objekttilstander (objekt_id, tilstand) on delete cascade,
  constraint thc_regelsett_konverteringsfaktor check (konverteringsfaktor > 0 and konverteringsfaktor < 'Infinity'),
  constraint thc_regelsett_cv check (cv_thc > 0 and cv_thc < 1 and cv_kreatinin > 0 and cv_kreatinin < 1),
  constraint thc_regelsett_faktor check (faktor_under_cutoff >= 1 and faktor_under_cutoff < 'Infinity'),
  constraint thc_regelsett_varsel check (varsel_dager_mellom >= 1)
);

-- Ett regelsett per tilstand: fortolkningen bruker det ene som er publisert.
create unique index thc_regelsett_ett_idx on public.thc_regelsett (tilstand);

comment on table public.thc_regelsett is
  'THC-syreregelsettet: konverteringsfaktor, måleusikkerhet, standardmargin og varselgrense. Kurvene, marginene, nivåene, bruksmønstrene og tekstene står i tabellene thc_*.';
comment on column public.thc_regelsett.konverteringsfaktor is
  'Regner kurvenes amplituder fra kildedataenes enheter om til IRCAK.';
comment on column public.thc_regelsett.faktor_under_cutoff is
  'Hvor mye høyere måleusikkerheten legges til grunn når forrige prøve fortolkes under cut-off. Ganges inn i log-standardavviket.';
comment on column public.thc_regelsett.varsel_dager_mellom is
  'Mer enn så mange døgn mellom prøvene gir et varsel. Fortolkningen skjer likevel.';

create table public.thc_kurver (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  rolle public.thc_kurverolle not null,
  navn text not null,
  a1 double precision not null,
  k1 double precision not null,
  a2 double precision not null,
  k2 double precision not null,
  constraint thc_kurver_pkey primary key (objekt_id, tilstand, rolle),
  constraint thc_kurver_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.thc_regelsett (objekt_id, tilstand) on delete cascade,
  constraint thc_kurver_navn check (char_length(navn) between 1 and 100 and navn = btrim(navn)),
  constraint thc_kurver_parametre check (
    a1 > 0 and k1 > 0 and a2 > 0 and k2 > 0
    and a1 < 'Infinity' and k1 < 'Infinity' and a2 < 'Infinity' and k2 < 'Infinity'
  )
);

comment on table public.thc_kurver is
  'Utskillelseskurvene C(t) = a1·e^(−k1·t) + a2·e^(−k2·t), t i døgn. Amplitudene i kildedataenes enheter.';

create table public.thc_sikkerhetsmarginer (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  margin double precision not null,
  z double precision not null,
  constraint thc_sikkerhetsmarginer_pkey primary key (objekt_id, tilstand, margin),
  constraint thc_sikkerhetsmarginer_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.thc_regelsett (objekt_id, tilstand) on delete cascade,
  constraint thc_sikkerhetsmarginer_margin check (margin >= 0.5 and margin < 1),
  constraint thc_sikkerhetsmarginer_z check (z <= 0 and z > '-Infinity')
);

comment on table public.thc_sikkerhetsmarginer is
  'Sikkerhetsmarginene som kan velges, med kvantilet z = Φ⁻¹(1 − margin) i full presisjon.';

create table public.thc_konsentrasjonsnivaer (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  posisjon integer not null,
  navn text not null,
  nedre double precision,
  nylig_inntak boolean not null,
  constraint thc_konsentrasjonsnivaer_pkey primary key (objekt_id, tilstand, posisjon),
  constraint thc_konsentrasjonsnivaer_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.thc_regelsett (objekt_id, tilstand) on delete cascade,
  constraint thc_konsentrasjonsnivaer_navn_entydig unique (objekt_id, tilstand, navn),
  constraint thc_konsentrasjonsnivaer_navn check (char_length(navn) between 1 and 60 and navn = btrim(navn)),
  constraint thc_konsentrasjonsnivaer_posisjon check (posisjon >= 1),
  -- Det laveste nivået er åpent nedover; de andre har et skillepunkt.
  constraint thc_konsentrasjonsnivaer_nedre check (
    (posisjon = 1) = (nedre is null) and (nedre is null or (nedre > 0 and nedre < 'Infinity'))
  )
);

comment on table public.thc_konsentrasjonsnivaer is
  'Nivåene for IRCAK i denne prøven. Et nivå gjelder fra og med sin nedre grense og opp til, men ikke med, neste nivås.';
comment on column public.thc_konsentrasjonsnivaer.nylig_inntak is
  'Konsentrasjoner på nivået ses gjerne kort tid etter inntak. Styrer hvilke tekstbolker som tas med.';

create table public.thc_bruksmonstre (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  kronisk boolean not null,
  vanskelig_over public.thc_kurverolle not null,
  nytt_inntak_over public.thc_kurverolle not null,
  constraint thc_bruksmonstre_pkey primary key (objekt_id, tilstand, kronisk),
  constraint thc_bruksmonstre_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.thc_regelsett (objekt_id, tilstand) on delete cascade,
  constraint thc_bruksmonstre_rekkefolge check (vanskelig_over < nytt_inntak_over)
);

comment on table public.thc_bruksmonstre is
  'Kurven den korrigerte endringen må ligge over for «vanskelig å avgjøre» og for nytt inntak, med og uten kronisk bruk.';

create table public.thc_tekstbolker (
  objekt_id uuid not null,
  tilstand public.objekttilstand not null,
  nokkel text not null,
  tekst text not null,
  constraint thc_tekstbolker_pkey primary key (objekt_id, tilstand, nokkel),
  constraint thc_tekstbolker_regelsett_fkey
    foreign key (objekt_id, tilstand)
    references public.thc_regelsett (objekt_id, tilstand) on delete cascade,
  -- Samme nøkler som THC_TEKSTNOKLER i src/domain/thcRegelsett.ts.
  constraint thc_tekstbolker_nokkel check (nokkel in (
    'apning', 'nylig_inntak', 'nytt_inntak', 'inntak_har_skjedd', 'pavisningstid', 'vanskelig',
    'ikke_nodvendigvis', 'under_cutoff_vanskelig', 'under_cutoff_ikke_nodvendigvis', 'uten_forrige'
  )),
  constraint thc_tekstbolker_tekst check (char_length(tekst) between 1 and 2000 and tekst = btrim(tekst))
);

comment on table public.thc_tekstbolker is
  'Tekstbolkene kommentaren settes sammen av, med plassholderne {nivå} og {forrige prøvedato}. Bolkene bindes sammen med ett mellomrom.';

create trigger thc_regelsett_objekttype
before insert or update on public.thc_regelsett
for each row execute function intern.krev_objekttype('objekt_id', 'thc_regelsett');

-- --- Regnestykkene valideringen trenger ------------------------------------

-- Φ⁻¹(p), kvantilet i standard normalfordeling: Wichuras AS 241 (PPND16).
-- Samme algoritme som normalkvantil i src/domain/thcRegelsett.ts.
create function intern.normalkvantil(p double precision)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  q double precision := p - 0.5;
  r double precision;
  v double precision;
begin
  if p is null or not (p > 0 and p < 1) then
    return null;
  end if;
  if abs(q) <= 0.425 then
    r := 0.180625 - q * q;
    return q * (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r
      + 45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r
      + 133.14166789178437745) * r + 3.387132872796366608)
      / (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r
      + 21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r
      + 42.313330701600911252) * r + 1);
  end if;
  r := sqrt(-ln(case when q < 0 then p else 1 - p end));
  if r <= 5 then
    r := r - 1.6;
    v := (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r
      + 1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r
      + 4.6303378461565452959) * r + 1.42343711074968357734)
      / (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r
      + 0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r
      + 2.05319162663775882187) * r + 1);
  else
    r := r - 5;
    v := (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r
      + 0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r
      + 5.4637849111641143699) * r + 6.6579046435011037772)
      / (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r
      + 7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r
      + 0.59983220655588793769) * r + 1);
  end if;
  return case when q < 0 then -v else v end;
end;
$$;

-- Kurvens verdi etter t døgn. Eksponentene holdes innenfor det flyttall
-- tåler; Postgres feiler der JavaScript gir 0 eller uendelig, og kurvene er
-- uansett langt utenfor det som betyr noe for kontrollen der.
create function intern.thc_kurveverdi(
  a1 double precision, k1 double precision, a2 double precision, k2 double precision, t double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select a1 * exp(greatest(least(-k1 * t, 700), -700)) + a2 * exp(greatest(least(-k2 * t, 700), -700))
$$;

-- Forventet relativ endring fra `forrige` etter `dager` døgn langs kurven
-- a1·e^(−k1·t) + a2·e^(−k2·t): kurven leses av der forrige prøve ligger og
-- like mange døgn senere. Samme fremgangsmåte som forventetEndring i
-- src/domain/thcMotor.ts; her brukes den bare til å kontrollere at kurvene
-- står i rekkefølge, så 100 halveringer er mer enn nok.
create function intern.thc_forventet_endring(
  a1 double precision, k1 double precision, a2 double precision, k2 double precision,
  forrige double precision, dager double precision
)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  lav double precision := -1000;
  hoy double precision := 1000;
  midt double precision;
  t0 double precision;
begin
  for i in 1..100 loop
    midt := (lav + hoy) / 2;
    if intern.thc_kurveverdi(a1, k1, a2, k2, midt) > forrige then
      lav := midt;
    else
      hoy := midt;
    end if;
  end loop;
  t0 := (lav + hoy) / 2;
  return intern.thc_kurveverdi(a1, k1, a2, k2, t0 + dager) / forrige - 1;
end;
$$;

-- --- Lesing av det som sendes inn ------------------------------------------

-- Et endelig tall. JSON-tall i Postgres er alltid endelige.
create function intern.flyttall(p_innhold jsonb, p_felt text)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'number' then
    raise exception 'Feltet % må være et tall.', p_felt using errcode = '22023';
  end if;
  return (p_innhold ->> p_felt)::double precision;
end;
$$;

create function intern.liste(p_innhold jsonb, p_felt text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'array' then
    raise exception 'Feltet % må være en liste.', p_felt using errcode = '22023';
  end if;
  return p_innhold -> p_felt;
end;
$$;

-- En tekst som skal lagres slik den står: ikke tom, og uten mellomrom i
-- endene — tekstbolkene bindes sammen med ett mellomrom.
create function intern.thc_tekst(p_innhold jsonb, p_felt text, p_hva text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  tekst text;
begin
  if jsonb_typeof(p_innhold -> p_felt) is distinct from 'string' then
    raise exception '% må være tekst.', p_hva using errcode = '22023';
  end if;
  tekst := p_innhold ->> p_felt;
  if btrim(tekst) = '' then
    raise exception '% er tom.', p_hva using errcode = '22023';
  end if;
  if tekst <> btrim(tekst) then
    raise exception '% begynner eller slutter med mellomrom.', p_hva using errcode = '22023';
  end if;
  return tekst;
end;
$$;

-- --- Skriving og lesing -----------------------------------------------------

create function intern.skriv_thc_regelsett(
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
  tekster jsonb;
  nokkel text;
  tekst text;
  tittel text;
  funnet text[];
  pakrevd text[];
  tilgjengelig text[];
  forrige double precision;
  dager double precision;
  g double precision;
  y double precision;
  rd double precision;
  faktor double precision;
  nokler constant text[] := array[
    'apning', 'nylig_inntak', 'nytt_inntak', 'inntak_har_skjedd', 'pavisningstid', 'vanskelig',
    'ikke_nodvendigvis', 'under_cutoff_vanskelig', 'under_cutoff_ikke_nodvendigvis', 'uten_forrige'
  ];
  -- Bolkene som må nevne datoen for forrige prøve, og de som kan.
  med_dato constant text[] := array['nytt_inntak', 'vanskelig', 'ikke_nodvendigvis', 'under_cutoff_ikke_nodvendigvis'];
  kan_dato constant text[] := array[
    'nytt_inntak', 'vanskelig', 'ikke_nodvendigvis', 'under_cutoff_vanskelig', 'under_cutoff_ikke_nodvendigvis'
  ];
begin
  perform intern.krev_felt(p_innhold, array[
    'konverteringsfaktor', 'kurver', 'maleusikkerhet', 'sikkerhetsmarginer', 'standard_sikkerhetsmargin',
    'konsentrasjonsnivaer', 'bruksmonstre', 'varsel_dager_mellom', 'tekster'
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
      raise exception 'Den % kurven mangler navn.', case rolle when 'gronn' then 'grønne' when 'gul' then 'gule' else 'røde' end
        using errcode = '22023';
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

  -- Grønn skal aldri forvente mindre nedgang enn gul, og gul aldri mindre
  -- enn rød. Samme rutenett og toleranse som kurvefeil i thcMotor.ts: grønn
  -- og gul faller sammen langt ute på kurvene og skiller seg da bare i siste
  -- siffer.
  foreach forrige in array array[0.01, 0.1, 1, 5, 20, 100, 1000]::double precision[] loop
    foreach dager in array array[1, 3, 7, 14, 30, 90]::double precision[] loop
      select
        intern.thc_forventet_endring(g_.a1 * faktor, g_.k1, g_.a2 * faktor, g_.k2, forrige, dager),
        intern.thc_forventet_endring(y_.a1 * faktor, y_.k1, y_.a2 * faktor, y_.k2, forrige, dager),
        intern.thc_forventet_endring(r_.a1 * faktor, r_.k1, r_.a2 * faktor, r_.k2, forrige, dager)
      into g, y, rd
      from public.thc_kurver g_, public.thc_kurver y_, public.thc_kurver r_
      where g_.objekt_id = p_objekt and g_.tilstand = p_tilstand and g_.rolle = 'gronn'
        and y_.objekt_id = p_objekt and y_.tilstand = p_tilstand and y_.rolle = 'gul'
        and r_.objekt_id = p_objekt and r_.tilstand = p_tilstand and r_.rolle = 'rod';
      if not (g <= y + 1e-9 and y <= rd + 1e-9) then
        raise exception 'Kurvene må stå i rekkefølge: grønn gir raskest utskillelse, gul langsommere og rød langsomst. Det holder ikke for IRCAK % etter % døgn.', forrige, dager
          using errcode = '22023';
      end if;
    end loop;
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

  -- Tekstbolkene, med plassholderne.
  tekster := intern.objekt(p_innhold, 'tekster');
  perform intern.krev_felt(tekster, nokler);
  foreach nokkel in array nokler loop
    tittel := case nokkel
      when 'apning' then 'Åpning'
      when 'nylig_inntak' then 'Nylig inntak'
      when 'nytt_inntak' then 'Nytt inntak etter forrige prøve'
      when 'inntak_har_skjedd' then 'Inntak har skjedd'
      when 'pavisningstid' then 'Påvisningstid'
      when 'vanskelig' then 'Vanskelig å avgjøre'
      when 'ikke_nodvendigvis' then 'Ikke nødvendigvis nytt inntak'
      when 'under_cutoff_vanskelig' then 'Vanskelig å avgjøre, forrige prøve under cut-off'
      when 'under_cutoff_ikke_nodvendigvis' then 'Ikke nødvendigvis nytt inntak, forrige prøve under cut-off'
      else 'Uten forrige prøve'
    end;
    tekst := intern.thc_tekst(tekster, nokkel, format('Tekstbolken «%s»', tittel));
    funnet := array(select m[1] from regexp_matches(tekst, '(\{[^{}]*\})', 'g') as m);
    pakrevd := case
      when nokkel = 'apning' then array['{nivå}']
      when nokkel = any (med_dato) then array['{forrige prøvedato}']
      else array[]::text[]
    end;
    tilgjengelig := case
      when nokkel = any (kan_dato) then array['{nivå}', '{forrige prøvedato}']
      else array['{nivå}']
    end;
    if not funnet <@ tilgjengelig then
      raise exception 'Tekstbolken «%» har plassholdere den ikke kan bruke.', tittel using errcode = '22023';
    end if;
    if not pakrevd <@ funnet then
      raise exception 'Tekstbolken «%» må inneholde %.', tittel, array_to_string(pakrevd, ' og ') using errcode = '22023';
    end if;
    if regexp_replace(tekst, '\{[^{}]*\}', '', 'g') ~ '[{}]' then
      raise exception 'Tekstbolken «%» har en krøllparentes som ikke hører til en plassholder.', tittel
        using errcode = '22023';
    end if;
    insert into public.thc_tekstbolker (objekt_id, tilstand, nokkel, tekst)
    values (p_objekt, p_tilstand, nokkel, tekst);
  end loop;
end;
$$;

-- Øyeblikksbildet, på samme form som ThcRegelsett i src/domain/thcRegelsett.ts.
-- Tallene gis som JSON-tall med korteste eksakte skrivemåte, så de leses
-- tilbake til nøyaktig samme flyttall.
create function intern.les_thc_regelsett(p_objekt uuid, p_tilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
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
    'tekster', (
      select jsonb_object_agg(t.nokkel, t.tekst)
      from public.thc_tekstbolker t
      where t.objekt_id = r.objekt_id and t.tilstand = r.tilstand
    )
  )
  from public.thc_regelsett r
  where r.objekt_id = p_objekt and r.tilstand = p_tilstand
$$;

-- --- Lesingen appen gjør ---------------------------------------------------

create function public.les_thc_regelsett(regelsettilstand public.objekttilstand)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.utgave_som_json(u)
  from public.objektutgaver u
  join public.redigerbare_objekter o on o.id = u.objekt_id
  where o.type = 'thc_regelsett' and u.tilstand = regelsettilstand
$$;

comment on function public.les_thc_regelsett(public.objekttilstand) is
  'THC-syreregelsettet i én tilstand, med revisjonen det står på, eller null om det ikke finnes. Radsikkerheten gjelder.';

-- --- Radsikkerhet ----------------------------------------------------------

alter table public.thc_regelsett enable row level security;
alter table public.thc_kurver enable row level security;
alter table public.thc_sikkerhetsmarginer enable row level security;
alter table public.thc_konsentrasjonsnivaer enable row level security;
alter table public.thc_bruksmonstre enable row level security;
alter table public.thc_tekstbolker enable row level security;

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.thc_regelsett for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.thc_kurver for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.thc_sikkerhetsmarginer for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.thc_konsentrasjonsnivaer for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.thc_bruksmonstre for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

create policy "Innloggede ser det publiserte, administratorer utkastene også"
on public.thc_tekstbolker for select to authenticated
using (tilstand = 'publisert' or (select public.er_admin()));

-- --- Rettigheter -----------------------------------------------------------

revoke all on table
  public.thc_regelsett,
  public.thc_kurver,
  public.thc_sikkerhetsmarginer,
  public.thc_konsentrasjonsnivaer,
  public.thc_bruksmonstre,
  public.thc_tekstbolker
from anon, authenticated, service_role;

grant select on table
  public.thc_regelsett,
  public.thc_kurver,
  public.thc_sikkerhetsmarginer,
  public.thc_konsentrasjonsnivaer,
  public.thc_bruksmonstre,
  public.thc_tekstbolker
to authenticated, service_role;

revoke all on function public.les_thc_regelsett(public.objekttilstand)
from public, anon, authenticated, service_role;

grant execute on function public.les_thc_regelsett(public.objekttilstand) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
