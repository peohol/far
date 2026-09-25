/**
 * Indikasjonene for stoffsidene uten analyttkode (`stoffsider.ts`), hentet
 * fra preparatomtalene i Felleskatalogen, siden FEST ikke har indikasjoner.
 *
 * Datasettet ligger i `supabase/import/indikasjoner/`: én fil per stoff, med
 * et kort sammendrag av indikasjonsteksten og preparatomtalene det bygger på
 * som referanser (`fk-`-nøkler). Har Felleskatalogen ingen preparatomtale for
 * stoffet, sier kortet det, som for Sinequan.
 *
 * Importen utvider sidene som finnes, og lar et indikasjonskort som alt står
 * der, være. Modulen brukes av importskriptet og testene, ikke av appen.
 */
import { byggKatalog, FORTOLKNINGSOPPFORINGER, type Analyttkatalog } from '../domain/analyttkatalog'
import { byggImportplan, datasett, type Importkilde, type Importplan } from './import'

export const INDIKASJONSDATASETT = datasett(
  import.meta.glob<Record<string, unknown>>('../../supabase/import/indikasjoner/*.json', { eager: true, import: 'default' }),
)

export const INDIKASJONSKILDE: Importkilde = {
  dokument: 'Felleskatalogen',
  felleskatalogen: '2026-09-25',
}

export function indikasjonsplan(katalog: Analyttkatalog = byggKatalog(FORTOLKNINGSOPPFORINGER)): Importplan {
  return byggImportplan(INDIKASJONSDATASETT.filer, INDIKASJONSDATASETT.referanser, katalog, INDIKASJONSKILDE)
}
