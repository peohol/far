/**
 * Importdatasettet for referanseområdene og seksjonen om terapeutisk
 * legemiddelmonitorering (TDM).
 *
 * Datasettet ligger i `supabase/import/tdm/`: én fil per analyttkode, hentet
 * fra fire kilder, og referansene i `felles.json`:
 *
 * - Sluttrapporten fra referanseområdeprosjektet ved Diakonhjemmet sykehus og
 *   St. Olavs hospital (2008): antidepressiva, antipsykotika, lamotrigin og
 *   metadon.
 * - Helland et al., «Serumkonsentrasjonsmålinger av vanedannende legemidler»
 *   (Tidsskr Nor Legeforen 2016): opioider, benzodiazepiner og z-hypnotika.
 * - Frost et al., «Nye anbefalinger ved serumkonsentrasjonsmålinger av
 *   sentralstimulerende legemidler» (Tidsskr Nor Legeforen 2019): amfetamin.
 * - Fortolkningskommentarene i FAR: prøvetakingen ved depotinjeksjon av
 *   antipsykotika.
 *
 * Importen utvider sidene som finnes (`finnesFraFor: 'utvid'` i `import.ts`):
 * den legger til TDM-kortene, og kilden på referanseområdet når verdien er den
 * samme som i kilden. Et referanseområde med en annen verdi endres ikke. Koder
 * uten side får en ny side med referanseområdet og TDM-kortene.
 *
 * Modulen brukes av importskriptet og testene, ikke av appen.
 */
import { byggKatalog, FORTOLKNINGSOPPFORINGER, type Analyttkatalog } from '../domain/analyttkatalog'
import { byggImportplan, datasett, type Importkilde, type Importplan } from './import'

export const TDM_DATASETT = datasett(
  import.meta.glob<Record<string, unknown>>('../../supabase/import/tdm/*.json', { eager: true, import: 'default' }),
)

/** Sluttrapporten, som filene som ikke oppgir noe annet, er hentet fra. */
export const TDM_KILDE: Importkilde = {
  dokument: '080401 - Sluttrapport referanseområder antipsykotika og antidepressiva.pdf',
  felleskatalogen: '',
}

export function tdmplan(katalog: Analyttkatalog = byggKatalog(FORTOLKNINGSOPPFORINGER)): Importplan {
  return byggImportplan(TDM_DATASETT.filer, TDM_DATASETT.referanser, katalog, TDM_KILDE)
}
