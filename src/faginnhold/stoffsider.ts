/**
 * Importdatasettet for stoffene uten analyttkode som kildene for
 * referanseområdene og TDM har anbefalinger for.
 *
 * Datasettet ligger i `supabase/import/stoffsider/`: én fil per stoff (`side`
 * i stedet for `kode`), og referansene i `felles.json`. Kildene er de samme
 * som for TDM-seksjonen (`tdm.ts`):
 *
 * - Sluttrapporten fra referanseområdeprosjektet (2008): antiepileptika,
 *   sertindol og litium, og det tidligere området for atomoksetin og
 *   metylfenidat.
 * - Helland et al. (Tidsskr Nor Legeforen 2016): ketobemidon, petidin og
 *   flunitrazepam.
 * - Frost et al. (Tidsskr Nor Legeforen 2019): atomoksetin og metylfenidat,
 *   og at det kom nasjonale referanseområder for antiepileptika i 2017.
 *
 * Sidene ble importert som stoffsider uten laboratorieanalytt, og vises på
 * `#/stoff/<nøkkel>` som alle stoffsider. Får et stoff en analyttkode senere,
 * kobles koden til stoffet i stoffregisteret. Importen utvider en side som
 * alt finnes, som TDM-importen.
 *
 * Modulen brukes av importskriptet og testene, ikke av appen.
 */
import { byggKatalog, FORTOLKNINGSOPPFORINGER, type Analyttkatalog } from '../domain/analyttkatalog'
import { byggImportplan, datasett, type Importplan } from './import'
import { TDM_KILDE } from './tdm'

export const STOFFSIDE_DATASETT = datasett(
  import.meta.glob<Record<string, unknown>>('../../supabase/import/stoffsider/*.json', { eager: true, import: 'default' }),
)

export function stoffsideplan(katalog: Analyttkatalog = byggKatalog(FORTOLKNINGSOPPFORINGER)): Importplan {
  return byggImportplan(STOFFSIDE_DATASETT.filer, STOFFSIDE_DATASETT.referanser, katalog, TDM_KILDE)
}
