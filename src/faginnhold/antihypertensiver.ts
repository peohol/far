/**
 * Importdatasettet for antihypertensivene, fra oversikten over
 * serumkonsentrasjoner av antihypertensiver (`originaldata/antihypertensiver.docx`).
 *
 * Datasettet ligger i `supabase/import/antihypertensiver/`: én fil per stoff,
 * med stoffets nøkkel i stoffregisteret (`stoff`), og referansene i
 * `felles.json`. Sidene får samme oppsett som sidene om antidepressiva:
 * viktige data, farmakodynamikk, indikasjon, dosering, interaksjoner,
 * farmakokinetikk, farmakogenetikk og TDM med serumkonsentrasjoner. Filene er
 * laget fra dokumentet, og avvikene mellom kildene i det er nevnt i
 * `docs/faginnhold.md`.
 *
 * Importen utvider en side som alt finnes, og lager den som mangler, med
 * navnet og nøkkelen stoffregisteret gir.
 *
 * Modulen brukes av importskriptet og testene, ikke av appen.
 */
import { byggKatalog, FORTOLKNINGSOPPFORINGER, type Analyttkatalog } from '../domain/analyttkatalog'
import { byggImportplan, datasett, type Importkilde, type Importplan } from './import'

export const ANTIHYPERTENSIV_DATASETT = datasett(
  import.meta.glob<Record<string, unknown>>('../../supabase/import/antihypertensiver/*.json', {
    eager: true,
    import: 'default',
  }),
)

export const ANTIHYPERTENSIV_KILDE: Importkilde = {
  dokument: 'antihypertensiver.docx',
  felleskatalogen: '',
}

export function antihypertensivplan(katalog: Analyttkatalog = byggKatalog(FORTOLKNINGSOPPFORINGER)): Importplan {
  return byggImportplan(ANTIHYPERTENSIV_DATASETT.filer, ANTIHYPERTENSIV_DATASETT.referanser, katalog, ANTIHYPERTENSIV_KILDE)
}
