/**
 * Metabolittsidene som slås sammen med moderstoffets side
 * (`SAMMENSLATTE` i `src/domain/analyttkatalog.ts`), i databasen.
 *
 * Appen viser alt moderstoffets side for metabolittens kode. Hadde
 * metabolitten en egen side i databasen — O-desmetyltramadol, med
 * referanseområdet og TDM-kortene fra Tidsskriftet — flyttes den over:
 *
 * - Datakortene (viktige data) flyttes til moderstoffets side, merket med
 *   koden (`gjelder`, se `datakortGjelder`), så koden beholder sine egne tall.
 * - Et kort som står likt på moderstoffets side, tas bort (`fjernet`).
 * - Et kinetikkort som er ulikt, flyttes til moderstoffets side, sist i
 *   panelet, med metabolitten i tittelen: «Referansegrense for
 *   O-desmetyltramadol».
 * - Andre kort blir stående på metabolittsiden, som ikke vises lenger, og
 *   migrasjonen sier fra.
 * - Analytten får moderstoffets side som hovedside. Metabolittsiden blir
 *   stående som komponent, så analysen fortsatt sier hvilket stoff den måler.
 *
 * Alt skjer som nye, publiserte revisjoner, så det står i historikken og kan
 * hentes tilbake. Et objekt med et upublisert utkast røres ikke. Kjøres den
 * igjen, gjør den ingenting. Uten administratoren gjør den ingenting, som i
 * testdatabasen før importene. Modulen brukes av skriptet som lager
 * migrasjonen og av testene, ikke av appen.
 */
import { SAMMENSLATTE } from '../domain/analyttkatalog'
import { innlogging, lit } from './import'
import { DATAKORT, ELEMENTTYPER, FJERNET } from './paneler'

/** Kilden revisjonene får i historikken. */
export const SAMMENSLAINGSKILDE = 'Slått sammen med moderstoffets side'

export function sammenslaingSql(admin: string, sammenslatte: Readonly<Record<string, string>> = SAMMENSLATTE): string {
  const rader = Object.entries(sammenslatte)
    .map(([metabolitt, moderstoff]) => `      (${lit(metabolitt)}, ${lit(moderstoff)})`)
    .join(',\n')
  const datakort = DATAKORT.map((k) => lit(k.type)).join(', ')
  return `-- Metabolittsidene slås sammen med moderstoffets side
do $sammenslaing$
declare
  administrator uuid;
  m record;
  a record;
  e record;
  metabolittside uuid;
  moderside uuid;
  innhold jsonb;
begin
${innlogging(admin, 'hopp over')}
  perform set_config('far.revisjonskilde', ${lit(SAMMENSLAINGSKILDE)}, true);

  for m in
    select * from (values
${rader}
    ) as t(metabolitt, moderstoff)
  loop
    select s.objekt_id into metabolittside from public.infosider s
      where s.tilstand = 'publisert' and lower(s.navn) = lower(m.metabolitt);
    select s.objekt_id into moderside from public.infosider s
      where s.tilstand = 'publisert' and lower(s.navn) = lower(m.moderstoff);
    if metabolittside is null or moderside is null then
      raise notice 'Ingen egen side for %, eller ingen side for %: ingenting å slå sammen.', m.metabolitt, m.moderstoff;
      continue;
    end if;

    -- Analyttene som har metabolittsiden som hovedside, uten upubliserte utkast.
    for a in
      select la.objekt_id as id, la.kode, u.revisjon, r.innhold
      from public.laboratorieanalytter la
      join public.objekttilstander u on u.objekt_id = la.objekt_id and u.tilstand = 'utkast'
      join public.objekttilstander p on p.objekt_id = la.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
      join public.objektrevisjoner r on r.objekt_id = la.objekt_id and r.revisjon = u.revisjon
      where la.tilstand = 'utkast' and la.hovedside_id = metabolittside
    loop
      for e in
        select el.objekt_id as id, u.revisjon, r.innhold
        from public.innholdselementer el
        join public.objekttilstander u on u.objekt_id = el.objekt_id and u.tilstand = 'utkast'
        join public.objekttilstander p on p.objekt_id = el.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
        join public.objektrevisjoner r on r.objekt_id = el.objekt_id and r.revisjon = u.revisjon
        where el.tilstand = 'utkast' and el.infoside_id = metabolittside and el.panel <> ${lit(FJERNET)}
        order by el.panel, el.posisjon, el.objekt_id
      loop
        innhold := null;
        if e.innhold ->> 'elementtype' in (${datakort}) then
          if exists (
            select 1 from public.innholdselementer x
            where x.infoside_id = moderside and x.tilstand = 'utkast' and x.panel <> ${lit(FJERNET)}
              and x.elementtype = e.innhold ->> 'elementtype' and x.data ->> 'gjelder' = a.kode
          ) then
            raise notice '%: moderstoffets side har alt kortet % for %.', m.metabolitt, e.innhold ->> 'elementtype', a.kode;
          else
            innhold := e.innhold || jsonb_build_object(
              'infoside', moderside,
              'data', (e.innhold -> 'data') || jsonb_build_object('gjelder', a.kode));
          end if;
        elsif exists (
          select 1 from public.innholdselementer x
          where x.infoside_id = moderside and x.tilstand = 'utkast' and x.panel = e.innhold ->> 'panel'
            and x.elementtype = e.innhold ->> 'elementtype' and x.data = e.innhold -> 'data'
        ) then
          innhold := e.innhold || jsonb_build_object('panel', ${lit(FJERNET)});
        elsif e.innhold ->> 'elementtype' = ${lit(ELEMENTTYPER.kinetikk)} then
          innhold := e.innhold || jsonb_build_object(
            'infoside', moderside,
            'posisjon', coalesce((
              select max(x.posisjon) + 1 from public.innholdselementer x
              where x.infoside_id = moderside and x.tilstand = 'utkast' and x.panel = e.innhold ->> 'panel'), 0),
            'data', (e.innhold -> 'data') || jsonb_build_object(
              'tittel', concat_ws(' for ', e.innhold -> 'data' ->> 'tittel', m.metabolitt)));
        else
          raise notice '%: kortet % i % står igjen på metabolittsiden.', m.metabolitt, e.innhold ->> 'elementtype', e.innhold ->> 'panel';
        end if;
        if innhold is not null then
          perform public.lagre_utkast(e.id, e.revisjon, innhold);
          perform public.publiser_utkast(e.id, e.revisjon + 1);
        end if;
      end loop;

      perform public.lagre_utkast(a.id, a.revisjon, a.innhold || jsonb_build_object('hovedside', moderside));
      perform public.publiser_utkast(a.id, a.revisjon + 1);
    end loop;
  end loop;
end
$sammenslaing$;`
}
