/**
 * Importdatasettet for psykofarmakasidene (arbeidspakke 4).
 *
 * Datasettet ligger i `supabase/import/psykofarmaka/`: én fil per analyttkode,
 * hentet fra `originaldata/Psykofarmaka.pdf` og kontrollert mot de renderte
 * sidene, med preparatnavn og indikasjoner fra Felleskatalogen, og
 * referansene flere sider deler i `felles.json`. Hvordan det gjøres om til
 * innhold i databasen, står i `import.ts`.
 *
 * Modulen brukes av importskriptet og testene, ikke av appen.
 */
import { byggKatalog, FORTOLKNINGSOPPFORINGER, type Analyttkatalog } from '../domain/analyttkatalog'
import { byggImportplan, datasett, type Importkilde, type Importplan } from './import'

const DATASETT = datasett(
  import.meta.glob<Record<string, unknown>>('../../supabase/import/psykofarmaka/*.json', { eager: true, import: 'default' }),
)

export const PSYKOFARMAKA_KILDE: Importkilde = {
  dokument: 'Psykofarmaka.pdf',
  felleskatalogen: '2026-09-23',
}

/** Filene for hver analyttkode, sortert på koden. */
export const PSYKOFARMAKA_FILER = DATASETT.filer

/** Referansene flere sider deler, med nøklene filene bruker. */
export const PSYKOFARMAKA_REFERANSER = DATASETT.referanser

export function psykofarmakaplan(katalog: Analyttkatalog = byggKatalog(FORTOLKNINGSOPPFORINGER)): Importplan {
  return byggImportplan(PSYKOFARMAKA_FILER, PSYKOFARMAKA_REFERANSER, katalog, PSYKOFARMAKA_KILDE)
}
