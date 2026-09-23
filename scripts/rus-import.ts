/**
 * Importen av rusmiddelreglene til Supabase.
 *
 * Grunnlaget er de opprinnelige rusmiddelreglene skrevet som scenarioregelsett, og
 * kommentartekstene som egne kommentarobjekter
 * (`src/domain/__tests__/fasit/rus-import.json`, frosset slik det ble
 * importert; tekstene er de som sto i `src/data/rusmidler.json`, hentet fra
 * `originaldata/rusmidler.md`). Scenariene peker på kommentarene med en
 * nøkkel i grunnlaget; importen lager kommentarene først, publiserer dem, og
 * setter inn ID-ene de fikk før regelsettene lagres og publiseres. Alt går
 * gjennom de vanlige funksjonene, med de samme kontrollene som i appen, som
 * administratoren som kjører importen. Revisjonene får kilden satt, slik at
 * historikken viser hvor de kom fra.
 *
 * Importen ligger som en datamigrering (`*_rusregler_import.sql`), laget med
 * `rusImportSql('peohol')`. I en ny database uten den administratoren — som
 * testdatabasen — hopper den over seg selv; testene kjører den samme SQL-en
 * med sin egen administrator. Finnes regelsettene alt, gjør den ingenting.
 */
import { createHash } from 'node:crypto'
import importert from '../src/domain/__tests__/fasit/rus-import.json'

export const RUS_IMPORTKILDE = 'Importert fra rusmiddeltabellen i OUSFAR (rusmidler.json)'

/**
 * SQL-en som importerer og publiserer kommentarene og regelsettene, som
 * administratoren med brukernavnet `brukernavn`. Finnes ikke administratoren,
 * gjøres ingenting.
 */
export function rusImportSql(brukernavn: string): string {
  if (!/^[a-z0-9._-]+$/.test(brukernavn)) throw new Error('Ugyldig brukernavn.')
  const data = JSON.stringify(importert)
  if (data.includes('$data$')) throw new Error('Importdataene kan ikke inneholde $data$.')
  const kontrollsum = createHash('md5').update(data).digest('hex')
  return `-- Rusmiddelreglene som scenarioregelsett, med kommentarene som egne objekter.
-- Laget med rusImportSql('${brukernavn}') i scripts/rus-import.ts; testene
-- kontrollerer at fila er lik det den gir.
do $import$
declare
  importdata constant text := $data$${data}$data$;
  data jsonb := importdata::jsonb;
  admin uuid;
  kommentar jsonb;
  regelsett jsonb;
  ider jsonb := '{}';
  status public.objektstatus;
begin
  if md5(importdata) <> '${kontrollsum}' then
    raise exception 'Importdataene er ikke de som ble laget: kontrollsummen stemmer ikke.';
  end if;
  select id into admin from public.profiles where username = '${brukernavn}' and role = 'admin';
  if admin is null then
    raise notice 'Rusmiddelreglene er ikke importert: administratoren ${brukernavn} finnes ikke her.';
    return;
  end if;
  if exists (
    select 1 from public.scenarioregelsett s
    where s.modul in (select r ->> 'modul' from jsonb_array_elements(data -> 'regelsett') r)
  ) then
    raise notice 'Rusmiddelreglene er alt importert.';
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform set_config('far.revisjonskilde', '${RUS_IMPORTKILDE}', true);

  for kommentar in
    select k from jsonb_array_elements(data -> 'kommentarer') with ordinality as x(k, nr) order by nr
  loop
    status := public.opprett_utkast('kommentar', kommentar -> 'innhold');
    perform public.publiser_utkast(status.id, status.revisjon);
    ider := ider || jsonb_build_object(kommentar ->> 'id', status.id);
  end loop;

  for regelsett in
    select r from jsonb_array_elements(data -> 'regelsett') with ordinality as x(r, nr) order by nr
  loop
    -- Nøklene i grunnlaget byttes med ID-ene kommentarene fikk.
    regelsett := jsonb_set(regelsett, '{scenarier}', (
      select jsonb_agg(
        case when s #>> '{utfall,type}' = 'kommentarer' then jsonb_set(s, '{utfall,plasseringer}', (
          select coalesce(jsonb_agg(
            jsonb_set(p, '{kommentar}', coalesce(ider -> (p ->> 'kommentar'), 'null'::jsonb)) order by pn
          ), '[]')
          from jsonb_array_elements(s #> '{utfall,plasseringer}') with ordinality as y(p, pn)
        )) else s end
        order by sn
      )
      from jsonb_array_elements(regelsett -> 'scenarier') with ordinality as x(s, sn)
    ));
    status := public.opprett_utkast('scenarioregelsett', regelsett);
    perform public.publiser_utkast(status.id, status.revisjon);
  end loop;
end
$import$;`
}
