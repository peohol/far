-- Kommentarene i de enkle konsentrasjonsreglene flyttes over i felles
-- kommentarobjekter, og den gamle kommentartabellen fjernes.
--
-- Hver kommentar blir et kommentarobjekt med den samme ID-en som reglene alt
-- peker på, og med teksten slik den står, tegn for tegn. Navnet sier hvilket
-- regelsett og hvilke intervaller den ble laget for, som «AMIS – innenfor
-- referanseområdet». Kommentarene publiseres når regelsettet er publisert.
--
-- Regelsettet lagres så på nytt uten tekstene, som en ny revisjon, og
-- publiseres. Reglene og det fortolkningen gir, er de samme. Den første
-- revisjonen står uendret i historikken og kan fortsatt gjenopprettes.
--
-- Endringene føres på den som sist endret regelsettet, med kilden på
-- revisjonen. I en ny, tom database er det ingen regelsett, og da skjer det
-- ingenting.

do $flytting$
declare
  regelsett record;
  kommentar record;
  forfatter uuid;
  opprinnelse text;
  navn text;
  innhold jsonb;
  status public.objektstatus;
begin
  -- Er noe endret uten å være publisert, kan ikke utkastet og det publiserte
  -- flyttes som ett. Slik er det ikke; stopp heller enn å gjette.
  if exists (
    select 1
    from public.intervallregelsett s
    join public.objekttilstander u on u.objekt_id = s.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = s.objekt_id and p.tilstand = 'publisert'
    where s.tilstand = 'utkast' and p.revisjon <> u.revisjon
  ) then
    raise exception 'Et regelsett har endringer som ikke er publisert. Publiser eller gjenopprett dem før kommentarene flyttes.';
  end if;

  for regelsett in
    select s.objekt_id, s.analyttkode, s.cutoff_innledning_id, u.revisjon,
      exists (
        select 1 from public.objekttilstander p where p.objekt_id = s.objekt_id and p.tilstand = 'publisert'
      ) as publisert
    from public.intervallregelsett s
    join public.objekttilstander u on u.objekt_id = s.objekt_id and u.tilstand = 'utkast'
    where s.tilstand = 'utkast'
    order by s.analyttkode
  loop
    select r.utfort_av into forfatter
    from public.objektrevisjoner r
    where r.objekt_id = regelsett.objekt_id
    order by r.revisjon desc
    limit 1;
    perform set_config(
      'request.jwt.claims', jsonb_build_object('sub', forfatter, 'role', 'authenticated')::text, true
    );

    select r.kilde into opprinnelse
    from public.objektrevisjoner r
    where r.objekt_id = regelsett.objekt_id and r.revisjon = 1;

    -- Kommentarene, i den rekkefølgen regelsettet hadde dem.
    for kommentar in
      select k.kommentar_id, k.tekst
      from public.regelsettkommentarer k
      where k.regelsett_id = regelsett.objekt_id and k.tilstand = 'utkast'
      order by k.posisjon
    loop
      -- Hva den ble brukt til: nivået for hvert intervall som ga den, med
      -- «ring rekvirent», nedenfra og opp, og til sist cut-off-innledningen.
      select regelsett.analyttkode || ' – ' || coalesce(string_agg(b.beskrivelse, ' og ' order by b.forste), 'kommentar')
      into navn
      from (
        select a.beskrivelse, min(a.plass) as forste
        from (
          select r.posisjon as plass,
            case r.niva
              when 'under' then 'under referanseområdet'
              when 'innenfor' then 'innenfor referanseområdet'
              else 'over referanseområdet'
            end || case when r.handling = 'ring_rekvirent' then ', ring rekvirent' else '' end as beskrivelse
          from public.intervallregler r
          where r.regelsett_id = regelsett.objekt_id and r.tilstand = 'utkast'
            and r.kommentar_id = kommentar.kommentar_id
          union all
          select 1000, 'innledning til «Til stede under cut-off»'
          where regelsett.cutoff_innledning_id = kommentar.kommentar_id
        ) a
        group by a.beskrivelse
      ) b;

      perform set_config(
        'far.revisjonskilde',
        btrim(left(
          format('Flyttet ut av fortolkningsreglene for %s, revisjon %s. %s',
            regelsett.analyttkode, regelsett.revisjon, coalesce(opprinnelse, '')),
          300
        )),
        true
      );
      status := intern.opprett_objekt(
        'kommentar',
        kommentar.kommentar_id,
        jsonb_build_object('navn', navn, 'tekst', kommentar.tekst, 'plassholdere', '[]'::jsonb)
      );
      if regelsett.publisert then
        perform public.publiser_utkast(status.id, status.revisjon);
      end if;
    end loop;

    -- Regelsettet uten tekstene, som en ny revisjon.
    perform set_config(
      'far.revisjonskilde',
      'Kommentarene er flyttet ut i egne kommentarobjekter. Reglene og tekstene er uendret.',
      true
    );
    innhold := intern.les_intervallregelsett(regelsett.objekt_id, 'utkast');
    status := public.lagre_utkast(regelsett.objekt_id, regelsett.revisjon, innhold);
    if regelsett.publisert then
      status := public.publiser_utkast(regelsett.objekt_id, status.revisjon);
      if intern.les_intervallregelsett(regelsett.objekt_id, 'publisert') is distinct from innhold then
        raise exception 'Det publiserte regelsettet for % ble ikke likt utkastet.', regelsett.analyttkode;
      end if;
    end if;
  end loop;

  perform set_config('far.revisjonskilde', '', true);
  perform set_config('request.jwt.claims', '', true);
end
$flytting$;

-- --- Det gamle tas bort ------------------------------------------------------

drop function intern.krev_brukte_kommentarer(uuid, public.objekttilstand, uuid[]);
drop function intern.les_regelsettkommentarer(uuid, public.objekttilstand);
drop function intern.skriv_regelsettkommentarer(uuid, public.objekttilstand, jsonb);
drop table public.regelsettkommentarer;
