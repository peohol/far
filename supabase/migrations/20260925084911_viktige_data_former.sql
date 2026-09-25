-- Viktige data: forbeholdene tas bort, og t½ og tss får typisk verdi, minimum og maksimum per legemiddelform
--
-- Peders ønske (2026-09-25): feltet «Forbehold» under verdiene i «Viktige
-- data» fjernes. For halveringstiden og tiden til steady state står det som
-- forbeholdene sa, i stedet i verdien: en typisk verdi, et område fra
-- minimum til maksimum, eller begge, og en verdi per legemiddelform
-- (`Formverdier` i src/faginnhold/paneler.ts).
--
-- * Konsentrasjonskortene beholder verdien; bare forbeholdet tas bort.
-- * t½ og tss skrives om. Kortene med et forbehold som sier noe om verdien,
--   står i tabellen under, skrevet om for hånd etter forbeholdet. «33 ± 4
--   timer» er blitt 33 (29–37). De andre — uten forbehold, eller med bare
--   «Omtrentlig.» — blir ett område når grensene er ulike, ellers en typisk
--   verdi, uten form.
--
-- Hver endring er en ny revisjon, publisert straks, så det som sto før, står i
-- historikken og kan hentes tilbake. Sjekksummen er tatt over kortene slik de
-- sto i produksjonen da migrasjonen ble laget; er noe endret siden, stopper
-- migrasjonen uten å endre noe. Uten administratoren (som i en tom database)
-- gjøres ingenting.
do $viktige_data$
declare
  administrator uuid;
  forventet constant text := 'f7587cc8f984cbafa637f901427fad22';
  sjekksum text;
  rad record;
  ny jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så omgjøringen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  create temporary table kort on commit drop as
  select e.objekt_id, u.revisjon, i.navn, e.elementtype, e.data, r.innhold, (u.revisjon = p.revisjon) as publisert
  from public.innholdselementer e
  join public.infosider i on i.objekt_id = e.infoside_id and i.tilstand = e.tilstand
  join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
  join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
  where e.tilstand = 'utkast' and e.panel = 'viktige_data'
    and (e.elementtype in ('halveringstid', 'steady_state') or coalesce(e.data ->> 'forbehold', '') <> '');

  select md5(string_agg(k.navn || '|' || k.elementtype || '|' || k.data::text, E'\n' order by k.navn collate "C", k.elementtype collate "C"))
  into sjekksum from kort k;
  if sjekksum is distinct from forventet then
    raise notice 'Kortene i viktige data er endret siden omgjøringen ble laget (sjekksum %), så den hoppes over.', sjekksum;
    return;
  end if;
  if exists (select 1 from kort where not publisert) then
    raise exception 'Et av kortene har et upublisert utkast; omgjøringen ville publisert det.';
  end if;

  -- t½ og tss med et forbehold som sier noe om verdien, skrevet om for hånd.
  create temporary table omskrevet (navn text, elementtype text, former jsonb) on commit drop;
  insert into omskrevet (navn, elementtype, former) values
    -- «Typisk 25 timer.»
    ('Amitriptylin', 'halveringstid', '[{"form": "", "typisk": 25, "min": 16, "maks": 40, "enhet": "timer"}]'),
    -- «Oppgitt som 33 ± 4 timer.»
    ('Citalopram', 'halveringstid', '[{"form": "", "typisk": 33, "min": 29, "maks": 37, "enhet": "timer"}]'),
    -- «Typisk 12 timer.»
    ('Duloksetin', 'halveringstid', '[{"form": "", "typisk": 12, "min": 6, "maks": 17, "enhet": "timer"}]'),
    -- «Peroralt. Ved depotinjeksjon ca. 3 uker.»
    ('Flupentiksol', 'halveringstid', '[{"form": "Peroralt", "typisk": null, "min": 20, "maks": 40, "enhet": "timer"}, {"form": "Depotinjeksjon", "typisk": 3, "min": null, "maks": null, "enhet": "uker"}]'),
    -- «Typisk 20 timer.»
    ('Fluvoksamin', 'halveringstid', '[{"form": "", "typisk": 20, "min": 17, "maks": 22, "enhet": "timer"}]'),
    -- «Peroralt. 21 timer ved i.m. injeksjon (ikke depot).»
    ('Haloperidol', 'halveringstid', '[{"form": "Peroralt", "typisk": 24, "min": null, "maks": null, "enhet": "timer"}, {"form": "Injeksjon i.m.", "typisk": 21, "min": null, "maks": null, "enhet": "timer"}]'),
    -- «Hydroksybupropion. Typisk 20 timer.»
    ('Hydroksybupropion', 'halveringstid', '[{"form": "", "typisk": 20, "min": 12, "maks": 65, "enhet": "timer"}]'),
    -- «Typisk 12 timer.»
    ('Klozapin', 'halveringstid', '[{"form": "", "typisk": 12, "min": 6, "maks": 26, "enhet": "timer"}]'),
    -- «Oppgitt som «12–40 (65) timer».» (65) har ingen plass i formen.
    ('Mirtazapin', 'halveringstid', '[{"form": "", "typisk": null, "min": 12, "maks": 40, "enhet": "timer"}]'),
    -- «Typisk 26 timer.»
    ('Nortriptylin', 'halveringstid', '[{"form": "", "typisk": 26, "min": 17, "maks": 93, "enhet": "timer"}]'),
    -- «Peroralt. Depot: ca. 30 dager.»
    ('Olanzapin', 'halveringstid', '[{"form": "Peroralt", "typisk": 33, "min": null, "maks": null, "enhet": "timer"}, {"form": "Depotinjeksjon", "typisk": 30, "min": null, "maks": null, "enhet": "dager"}]'),
    -- «Xeplion; avhengig av injeksjonssted. Trevicta: 84–139 dager.»
    ('Paliperidon (hydroksyrisperidon)', 'halveringstid', '[{"form": "Depotinjeksjon (Xeplion)", "typisk": null, "min": 25, "maks": 49, "enhet": "dager"}, {"form": "Depotinjeksjon (Trevicta)", "typisk": null, "min": 84, "maks": 139, "enhet": "dager"}]'),
    -- «Omtrentlig. Peroralt.»
    ('Perfenazin', 'halveringstid', '[{"form": "Peroralt", "typisk": 9, "min": null, "maks": null, "enhet": "timer"}]'),
    -- «Typisk 26 timer.»
    ('Sertralin', 'halveringstid', '[{"form": "", "typisk": 26, "min": 22, "maks": 36, "enhet": "timer"}]'),
    -- «Omtrentlig. Kilde: SPC.»
    ('Ziprasidon', 'halveringstid', '[{"form": "", "typisk": 6.6, "min": null, "maks": null, "enhet": "timer"}]'),
    -- «Peroralt. Acutard: 18-24 timer. Depot: 19 dager.»
    ('Zuklopentiksol', 'halveringstid', '[{"form": "Peroralt", "typisk": null, "min": 12, "maks": 26, "enhet": "timer"}, {"form": "Injeksjon (Acutard)", "typisk": null, "min": 18, "maks": 24, "enhet": "timer"}, {"form": "Depotinjeksjon", "typisk": 19, "min": null, "maks": null, "enhet": "dager"}]'),
    -- «Omtrentlig. Peroralt; ved depotinjeksjon etter 4 injeksjoner.»
    ('Aripiprazol', 'steady_state', '[{"form": "Peroralt", "typisk": 2, "min": null, "maks": null, "enhet": "uker"}, {"form": "Depotinjeksjon", "typisk": 4, "min": null, "maks": null, "enhet": "injeksjoner"}]'),
    -- «Peroralt. Ved depotinjeksjon 3 måneder.»
    ('Flupentiksol', 'steady_state', '[{"form": "Peroralt", "typisk": null, "min": 7, "maks": 10, "enhet": "døgn"}, {"form": "Depotinjeksjon", "typisk": 3, "min": null, "maks": null, "enhet": "måneder"}]'),
    -- «Ifølge SPC.»
    ('Fluvoksamin', 'steady_state', '[{"form": "", "typisk": null, "min": 10, "maks": 14, "enhet": "dager"}]'),
    -- «Peroralt. Ved depotinjeksjon 2–4 måneder.»
    ('Haloperidol', 'steady_state', '[{"form": "Peroralt", "typisk": 5, "min": null, "maks": null, "enhet": "døgn"}, {"form": "Depotinjeksjon", "typisk": null, "min": 2, "maks": 4, "enhet": "måneder"}]'),
    -- «Typisk 6 dager.»
    ('Mianserin', 'steady_state', '[{"form": "", "typisk": 6, "min": 1, "maks": 12, "enhet": "dager"}]'),
    -- «Typisk 5.5 dager.»
    ('Nortriptylin', 'steady_state', '[{"form": "", "typisk": 5.5, "min": 3.5, "maks": 19, "enhet": "dager"}]'),
    -- «Peroralt. Depot: ca. 3–4 måneder.»
    ('Olanzapin', 'steady_state', '[{"form": "Peroralt", "typisk": 7, "min": null, "maks": null, "enhet": "døgn"}, {"form": "Depotinjeksjon", "typisk": null, "min": 3, "maks": 4, "enhet": "måneder"}]'),
    -- «Peroralt. Depot: ca. 3 måneder.»
    ('Perfenazin', 'steady_state', '[{"form": "Peroralt", "typisk": 7, "min": null, "maks": null, "enhet": "døgn"}, {"form": "Depotinjeksjon", "typisk": 3, "min": null, "maks": null, "enhet": "måneder"}]'),
    -- «Peroralt.»
    ('Risperidon', 'steady_state', '[{"form": "Peroralt", "typisk": null, "min": 4, "maks": 5, "enhet": "dager"}]'),
    -- «Peroralt. Depot: ca. 3 måneder.»
    ('Zuklopentiksol', 'steady_state', '[{"form": "Peroralt", "typisk": null, "min": 3, "maks": 5, "enhet": "døgn"}, {"form": "Depotinjeksjon", "typisk": 3, "min": null, "maks": null, "enhet": "måneder"}]');

  for rad in select k.*, o.former from kort k left join omskrevet o using (navn, elementtype) order by k.navn, k.elementtype loop
    if rad.elementtype in ('halveringstid', 'steady_state') then
      if rad.former is null and coalesce(rad.data ->> 'forbehold', '') not in ('', 'Omtrentlig.') then
        raise exception 'Forbeholdet på % for % er ikke skrevet om: %', rad.elementtype, rad.navn, rad.data ->> 'forbehold';
      end if;
      ny := jsonb_build_object('former', coalesce(rad.former, case
        when rad.data -> 'nedre' = 'null'::jsonb and rad.data -> 'ovre' = 'null'::jsonb then '[]'::jsonb
        when rad.data -> 'nedre' <> rad.data -> 'ovre' and rad.data -> 'nedre' <> 'null'::jsonb and rad.data -> 'ovre' <> 'null'::jsonb then
          jsonb_build_array(jsonb_build_object('form', '', 'typisk', null, 'min', rad.data -> 'nedre', 'maks', rad.data -> 'ovre', 'enhet', rad.data -> 'enhet'))
        else
          jsonb_build_array(jsonb_build_object('form', '', 'typisk', coalesce(nullif(rad.data -> 'nedre', 'null'::jsonb), rad.data -> 'ovre'), 'min', null, 'maks', null, 'enhet', rad.data -> 'enhet'))
      end));
      perform set_config('far.revisjonskilde', 'Omgjort: forbeholdet er tatt bort, og verdien står som typisk, minimum og maksimum per legemiddelform', true);
    else
      ny := rad.data - 'forbehold';
      perform set_config('far.revisjonskilde', 'Tatt bort: forbeholdet under verdien', true);
    end if;
    perform public.lagre_utkast(rad.objekt_id, rad.revisjon, jsonb_set(rad.innhold, '{data}', ny));
    perform public.publiser_utkast(rad.objekt_id, rad.revisjon + 1);
  end loop;
end
$viktige_data$;