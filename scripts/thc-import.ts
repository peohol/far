/**
 * Importen av THC-syreregelsettet til Supabase.
 *
 * Regelsettet er det den opprinnelige THC-syremodulen hadde i koden
 * (`src/domain/__tests__/fasit/thc-regelsett-import.json`). Det legges inn
 * gjennom de vanlige funksjonene — med de samme kontrollene som i appen — som
 * administratoren som kjører importen, og publiseres med en gang: innholdet
 * er det fortolkningen allerede bruker. Revisjonen får kilden satt, slik at
 * historikken viser hvor den kom fra.
 *
 * Importen ligger som en datamigrering (`*_thc_regelsett_import.sql`), laget
 * med `thcImportSql('peohol')`. I en ny database uten den administratoren —
 * som testdatabasen — hopper den over seg selv; testene kjører den samme
 * SQL-en med sin egen administrator.
 */
import importert from '../src/domain/__tests__/fasit/thc-regelsett-import.json'

export const THC_IMPORTKILDE =
  'Importert fra den opprinnelige THC-syremodulen (regnearket THC-COOH.xlsm med eierens senere tillegg)'

/**
 * SQL-en som importerer og publiserer regelsettet, som administratoren med
 * brukernavnet `brukernavn`. Finnes ikke administratoren, gjøres ingenting.
 */
export function thcImportSql(brukernavn: string): string {
  if (!/^[a-z0-9._-]+$/.test(brukernavn)) throw new Error('Ugyldig brukernavn.')
  return `do $import$
declare
  admin uuid;
  status public.objektstatus;
begin
  select id into admin from public.profiles where username = '${brukernavn}' and role = 'admin';
  if admin is null then
    raise notice 'THC-syreregelsettet er ikke importert: administratoren ${brukernavn} finnes ikke her.';
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform set_config('far.revisjonskilde', '${THC_IMPORTKILDE}', true);
  status := public.opprett_utkast('thc_regelsett', $json$${JSON.stringify(importert)}$json$::jsonb);
  perform public.publiser_utkast(status.id, status.revisjon);
end
$import$;`
}
