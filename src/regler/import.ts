/**
 * Importen av regelsett, som en kontrollert datamigrering.
 *
 * Regelsettene ligger først i et importdatasett (`supabase/import/`), hvert med
 * kilden sin og kommentarene det bruker, og legges inn med SQL som går gjennom
 * de samme kontrollene som appen — som administratoren som har bestilt
 * importen. Hver kommentar blir et kommentarobjekt med ID-en regelsettet
 * peker på, og publiseres før regelsettet. Hver revisjon får kilden sin
 * (`far.revisjonskilde`), så historikken viser hvor innholdet kom fra.
 *
 * Samme fremgangsmåte som importen av faginnholdet (`src/faginnhold/import.ts`):
 * SQL-en kjøres med databasens egne rettigheter. Alt er én transaksjon, og en
 * analyttkode som alt har et regelsett, hoppes over, så importen kan kjøres
 * igjen.
 *
 * Importen til produksjon ble gjort før kommentarene ble egne objekter
 * (`supabase/migrations/*_importer_intervallregelsett_*.sql`), og flyttet over
 * av `*_flytt_regelsettkommentarer.sql`. Den gjør ingenting når
 * administratoren ikke finnes — slik som i en ny, tom database — i stedet for
 * å stoppe migreringen, og det kan importen herfra også.
 *
 * SQL-en har en kontrollsum for dataene og stopper før noe er lagt inn hvis
 * de ikke er nøyaktig det som ble laget her — for eksempel om noe har gått
 * tapt da SQL-en ble kopiert.
 */
import { createHash } from 'node:crypto'
import type { Kommentarinnhold } from '../domain/kommentarobjekt'
import { kommentarnavn, utenKommentarer } from './kommentarer'
import type { Intervallregelsett, Intervallregelsettinnhold } from './modell'

/** Ett regelsett i importdatasettet, med tekstene, og kilden revisjonene skal vise. */
export interface Regelkilde {
  kilde: string
  regelsett: Intervallregelsett
}

/** Ett regelsett slik det importeres: reglene og kommentarobjektene de peker på. */
export interface Regelimport {
  kilde: string
  regelsett: Intervallregelsettinnhold
  kommentarer: { id: string; innhold: Kommentarinnhold }[]
}

/** Regelsettet delt i reglene og kommentarobjektene, med navnene kommentarene får. */
export function tilRegelimport({ kilde, regelsett }: Regelkilde): Regelimport {
  return {
    kilde,
    regelsett: utenKommentarer(regelsett),
    kommentarer: regelsett.kommentarer.map(({ id, tekst }) => ({
      id,
      innhold: { navn: kommentarnavn(regelsett, id), tekst, plassholdere: [] },
    })),
  }
}

/** En tekst som SQL-literal. */
function lit(tekst: string): string {
  return `'${tekst.replace(/'/g, "''")}'`
}

/**
 * Del nummer `del` (fra 1) når importen deles i `antall` sammenhengende
 * porsjoner så jevnt som mulig.
 */
export function importdel<T>(importer: T[], del: number, antall: number): T[] {
  if (!Number.isInteger(antall) || antall < 1 || !Number.isInteger(del) || del < 1 || del > antall) {
    throw new Error(`Ugyldig del ${del} av ${antall}.`)
  }
  const grense = (n: number) => Math.round((importer.length * n) / antall)
  return importer.slice(grense(del - 1), grense(del))
}

/** Hva importen gjør når administratoren ikke finnes. */
export type UtenAdministrator = 'stopp' | 'hopp over'

/**
 * SQL-en som legger inn og publiserer regelsettene. `admin` er brukernavnet
 * til administratoren revisjonene føres på.
 */
export function regelimportSql(
  importer: Regelimport[],
  admin: string,
  utenAdministrator: UtenAdministrator = 'stopp',
): string {
  // Ett regelsett per linje, så SQL-en kan leses og sammenlignes linje for linje.
  const data = `[\n${importer.map((i) => JSON.stringify(i)).join(',\n')}\n]`
  if (data.includes('$data$')) throw new Error('Importdatasettet kan ikke inneholde $data$.')
  const melding = `'Fant ingen administrator med brukernavnet %.', ${lit(admin)};`
  const kontrollsum = createHash('md5').update(data, 'utf8').digest('hex')
  const utenAdmin =
    utenAdministrator === 'stopp'
      ? `    raise exception ${melding}`
      : `    raise notice ${melding}\n    return;`
  return `-- Regelsettene for de enkle konsentrasjonsreglene, med kommentarene
do $import$
declare
  importdata constant text := $data$${data}$data$;
  administrator uuid;
  import jsonb;
  kommentar jsonb;
  status public.objektstatus;
begin
  if md5(importdata) <> '${kontrollsum}' then
    raise exception 'Importdataene er ikke de som ble laget: kontrollsummen stemmer ikke.';
  end if;
  select p.id into administrator from public.profiles p where p.username = ${lit(admin)} and p.role = 'admin';
  if administrator is null then
${utenAdmin}
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  for import in
    select e.v from jsonb_array_elements(importdata::jsonb) with ordinality e(v, nr) order by e.nr
  loop
    if exists (
      select 1 from public.intervallregelsett s
      where s.tilstand = 'utkast' and s.analyttkode = import #>> '{regelsett,analyttkode}'
    ) then
      raise notice '% har alt et regelsett og hoppes over.', import #>> '{regelsett,analyttkode}';
      continue;
    end if;
    perform set_config('far.revisjonskilde', import ->> 'kilde', true);
    for kommentar in select e.v from jsonb_array_elements(import -> 'kommentarer') e(v) loop
      status := intern.opprett_objekt('kommentar', (kommentar ->> 'id')::uuid, kommentar -> 'innhold');
      perform public.publiser_utkast(status.id, status.revisjon);
    end loop;
    status := public.opprett_utkast('intervallregelsett', import -> 'regelsett');
    perform public.publiser_utkast(status.id, status.revisjon);
  end loop;

  perform set_config('far.revisjonskilde', '', true);
end
$import$;`
}
