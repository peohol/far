/**
 * Hvordan informasjonssidene i databasen var lagt opp før stoffet ble fagsidens
 * identitet: én side per analyttkode, etter navnet, med noen metabolitter slått
 * sammen med moderstoffet.
 *
 * Bare importene som lager historiske datamigrasjoner (`import.ts`,
 * `sammenslatte.ts`), bruker dette. De må lage den samme SQL-en som da
 * migrasjonene ble skrevet, så en migrasjon som alt er kjørt, ikke endres.
 * Appen finner sidene etter stoffets nøkkel (`src/domain/stoffregister.ts`).
 */
import type { Laboratorieanalytt } from '../domain/analyttkatalog'
import { splitName } from '../domain/names'

/**
 * Metabolittsidene den historiske migrasjonen fra PR #111 slo sammen med
 * moderstoffets side, i databasen.
 */
export const MIGRERTE_SAMMENSLATTE: Readonly<Record<string, string>> = {
  'N-desmetyldiazepam': 'Diazepam',
  'O-desmetyltramadol': 'Tramadol',
  'THC-syre': 'THC',
}

const SAMMENSLATT_PER_NAVN = new Map(
  Object.entries(MIGRERTE_SAMMENSLATTE).map(([metabolitt, side]) => [metabolitt.toLocaleLowerCase('nb'), side]),
)

/**
 * Navnet på informasjonssiden analyttkoden hørte til: moderstoffet når koden
 * står for hele fortolkningsoppføringen (en sumanalyse hørte til moderstoffet),
 * ellers analyttens eget navn — og moderstoffets side for metabolittene som ble
 * slått sammen med det.
 */
export function historiskSidenavn(analytt: Laboratorieanalytt): string {
  const navn = analytt.kode === analytt.fortolkning.kode ? splitName(analytt.fortolkning).moderstoff : analytt.navn
  return SAMMENSLATT_PER_NAVN.get(navn.toLocaleLowerCase('nb')) ?? navn
}
