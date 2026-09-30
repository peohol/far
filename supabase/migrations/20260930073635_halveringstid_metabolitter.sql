-- Viktige data: t½ for moderstoffet og metabolittene øverst på sidene som oppgir begge
--
-- Peders ønske (2026-09-30): alle fagsider som har t½ og tss i
-- farmakokinetikken, skal også vise dem øverst, og der kilden oppgir
-- halveringstiden for metabolitter også, tas de med — som verdiene per
-- legemiddelform, én per stoff (`Formverdi.stoff` i src/faginnhold/paneler.ts).
--
-- Seks sider manglet kortet for t½ fordi teksten i farmakokinetikken oppgir
-- flere stoffer (venlafaksin og O-desmetylvenlafaksin), og de får det nå, med
-- verdiene fra den teksten. Bupropionsiden hadde kortet, men uten å si at tallet
-- er hydroksybupropions halveringstid, slik teksten gjør; det får stoffet.
-- «Ca.» står ikke på kortene, som for de andre (`viktige_data_former`). tss
-- står alt på alle sidene som har det i farmakokinetikken.
--
-- Hver endring er en ny revisjon, publisert straks. Sjekksummen er tatt over
-- t½-teksten i farmakokinetikken og t½-kortet på sidene, slik de sto i
-- produksjonen da migrasjonen ble laget; er noe endret siden, stopper
-- migrasjonen uten å endre noe. Uten administratoren (som i en tom database)
-- gjøres ingenting.
do $halveringstid$
declare
  administrator uuid;
  forventet constant text := '7d0ff6662c7616345c9d1258749b90e4';
  sjekksum text;
  rad record;
  kort record;
  objekt uuid;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så t½-kortene hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  create temporary table halveringstider (navn text, former jsonb) on commit drop;
  insert into halveringstider (navn, former) values
    -- «Hydroksybupropion: 20 (12–65) timer»
    ('Bupropion', '[{"stoff": "Hydroksybupropion", "form": "", "typisk": 20, "min": 12, "maks": 65, "enhet": "timer"}]'),
    -- «Doksepin: 17 (8–24) timer» / «Desmetyldoksepin: 50 (33–80) timer»
    ('Doksepin', '[{"stoff": "Doksepin", "form": "", "typisk": 17, "min": 8, "maks": 24, "enhet": "timer"}, {"stoff": "Desmetyldoksepin", "form": "", "typisk": 50, "min": 33, "maks": 80, "enhet": "timer"}]'),
    -- «Fluoksetin: 0,5–6 døgn» / «Norfluoksetin: 4–6 døgn»
    ('Fluoksetin', '[{"stoff": "Fluoksetin", "form": "", "typisk": null, "min": 0.5, "maks": 6, "enhet": "døgn"}, {"stoff": "Norfluoksetin", "form": "", "typisk": null, "min": 4, "maks": 6, "enhet": "døgn"}]'),
    -- «Kariprazin: 1-3 dager» / «Desmetylkariprazin: 1-3 dager» / «Didesmetylkariprazin: 13-19 dager»
    ('Kariprazin', '[{"stoff": "Kariprazin", "form": "", "typisk": null, "min": 1, "maks": 3, "enhet": "dager"}, {"stoff": "Desmetylkariprazin", "form": "", "typisk": null, "min": 1, "maks": 3, "enhet": "dager"}, {"stoff": "Didesmetylkariprazin", "form": "", "typisk": null, "min": 13, "maks": 19, "enhet": "dager"}]'),
    -- «Klomipramin: 21 (12–36) timer» / «Desmetylklomipramin: ca. 36 timer»
    ('Klomipramin', '[{"stoff": "Klomipramin", "form": "", "typisk": 21, "min": 12, "maks": 36, "enhet": "timer"}, {"stoff": "Desmetylklomipramin", "form": "", "typisk": 36, "min": null, "maks": null, "enhet": "timer"}]'),
    -- «Risperidon: 3 timer» / «Paliperidon: 24 timer.»
    ('Risperidon', '[{"stoff": "Risperidon", "form": "", "typisk": 3, "min": null, "maks": null, "enhet": "timer"}, {"stoff": "Paliperidon", "form": "", "typisk": 24, "min": null, "maks": null, "enhet": "timer"}]'),
    -- «Venlafaksin: 5 (3–7) timer» / «O-desmetylvenlafaksin: 11 timer»
    ('Venlafaksin', '[{"stoff": "Venlafaksin", "form": "", "typisk": 5, "min": 3, "maks": 7, "enhet": "timer"}, {"stoff": "O-desmetylvenlafaksin", "form": "", "typisk": 11, "min": null, "maks": null, "enhet": "timer"}]');

  -- Sidene, t½-teksten i farmakokinetikken og t½-kortet slik de står nå.
  create temporary table sider on commit drop as
  select h.navn, h.former, i.objekt_id as side,
    (select string_agg(e.data::text, E'\n' order by e.objekt_id)
       from public.innholdselementer e
       where e.infoside_id = i.objekt_id and e.tilstand = 'utkast' and e.panel = 'farmakokinetikk'
         and e.elementtype = 'kinetikkort' and e.data ->> 'tittel' = 't½') as tekst,
    (select string_agg(e.data::text, E'\n' order by e.objekt_id)
       from public.innholdselementer e
       where e.infoside_id = i.objekt_id and e.tilstand = 'utkast' and e.panel = 'viktige_data'
         and e.elementtype = 'halveringstid') as kortdata
  from halveringstider h
  left join public.infosider i on i.navn = h.navn and i.tilstand = 'utkast';

  select md5(string_agg(s.navn || '|' || coalesce(s.tekst, '') || '|' || coalesce(s.kortdata, ''), E'\n' order by s.navn collate "C"))
  into sjekksum from sider s;
  if sjekksum is distinct from forventet then
    raise notice 't½-teksten eller -kortene er endret siden migrasjonen ble laget (sjekksum %), så den hoppes over.', sjekksum;
    return;
  end if;

  for rad in select * from sider order by navn loop
    select e.objekt_id, u.revisjon, r.innhold, u.revisjon = p.revisjon as publisert into kort
      from public.innholdselementer e
      join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
      left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
      join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
      where e.infoside_id = rad.side and e.tilstand = 'utkast' and e.panel = 'viktige_data'
        and e.elementtype = 'halveringstid' and coalesce(e.data ->> 'gjelder', '') = '';
    if kort.objekt_id is null then
      perform set_config('far.revisjonskilde', 'Lagt til: t½ for stoffet og metabolittene, fra teksten i farmakokinetikken', true);
      objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
        'infoside', rad.side,
        'panel', 'viktige_data',
        'posisjon', 3,
        'elementtype', 'halveringstid',
        'data', jsonb_build_object('former', rad.former)
      ))).id;
      perform public.publiser_utkast(objekt, 1);
    elsif kort.publisert then
      perform set_config('far.revisjonskilde', 'Omgjort: t½ sier hvilket stoff tallet gjelder, som teksten i farmakokinetikken', true);
      perform public.lagre_utkast(kort.objekt_id, kort.revisjon, jsonb_set(kort.innhold, '{data}', jsonb_build_object('former', rad.former)));
      perform public.publiser_utkast(kort.objekt_id, kort.revisjon + 1);
    else
      raise exception 't½-kortet på % har et upublisert utkast; migrasjonen ville publisert det.', rad.navn;
    end if;
  end loop;
end
$halveringstid$;