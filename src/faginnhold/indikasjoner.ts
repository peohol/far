/**
 * Indikasjoner hentet fra preparatomtalene i Felleskatalogen for sider som
 * ikke fikk dem med importen av Psykofarmaka, siden FEST ikke har
 * indikasjoner.
 *
 * Datasettet ligger i `supabase/import/indikasjoner/`: én fil per side
 * (`side`) eller analyttkode (`kode`), med et kort sammendrag av
 * indikasjonsteksten og preparatomtalene det bygger på som referanser
 * (`fk-`-nøkler). Har Felleskatalogen ingen preparatomtale for stoffet, sier
 * kortet det, som for Sinequan.
 *
 * Filene legges inn i omganger, hver med sin migrasjon
 * ({@link INDIKASJONSIMPORTER}), så en ny omgang ikke endrer migrasjonene som
 * alt er kjørt. Importen utvider sidene som finnes, og lar et indikasjonskort
 * som alt står der, være. Modulen brukes av importskriptet og testene, ikke
 * av appen.
 */
import { byggKatalog, FORTOLKNINGSOPPFORINGER, type Analyttkatalog } from '../domain/analyttkatalog'
import { byggImportplan, datasett, filnokkel, type Importkilde, type Importplan } from './import'
import { STOFFSIDE_DATASETT } from './stoffsider'

/**
 * Stoffsidene indikasjonsimporten lager, fordi de ikke fantes fra før: GHB
 * (natriumoksybat) og ketamin (racemisk ketamin og esketamin). De har ingen
 * analyttkode og ingen referanseområder i kildene, så indikasjonen er det
 * første kortet på siden; preparatene og farmakogenetikken kobles etterpå
 * (`festkoblinger.ts`, `clinpgxkoblinger.ts`).
 */
export const NYE_STOFFSIDER: readonly string[] = ['GHB', 'Ketamin']

/**
 * Analyttkodene indikasjonsimporten lager siden for, fordi koden ikke hadde
 * noen: THC, der indikasjonen er Sativex (THC og cannabidiol), og preparatene
 * kobles etterpå (`festkoblinger.ts`). Siden får navnet og koden fra
 * analyttkatalogen.
 */
export const NYE_ANALYTTSIDER: readonly string[] = ['THC']

/**
 * Cannabidiol (CBD), som legemiddel alene i Epidyolex og sammen med THC i
 * Sativex. Stoffet har ingen analyttkode, så siden lages uten, som GHB og
 * ketamin.
 */
export const CBD_STOFFSIDER: readonly string[] = ['Cannabidiol']

/**
 * Rusmiddelkodene som er legemidler, uten indikasjon til nå: benzodiazepinene,
 * z-hypnotikaene og opioidene. Tapentadol hadde ingen side, så importen lager
 * den, som THC. Metabolittene som er slått sammen med moderstoffets side
 * (`sammenslatte` i `src/data/stoffregister.json`), får moderstoffets.
 */
export const RUSMIDLER_INDIKASJONER: readonly string[] = [
  'APR', 'DIAZ', 'OXA', 'CZP', 'NIT', 'ZOLP', 'ZOPI', 'BUP', 'FYL', 'KOD', 'MDO', 'MOR', 'OKSY', 'TRAM', 'TAP',
]

export const INDIKASJONSDATASETT = datasett(
  import.meta.glob<Record<string, unknown>>('../../supabase/import/indikasjoner/*.json', { eager: true, import: 'default' }),
)

/** Én omgang: migrasjonsnavnet, datoen indikasjonene ble hentet, og filene (side eller kode). */
export interface Indikasjonsimport {
  migrasjon: string
  hentet: string
  filer: readonly string[]
}

export const INDIKASJONSIMPORTER: readonly Indikasjonsimport[] = [
  { migrasjon: 'stoffsider_indikasjoner', hentet: '2026-09-25', filer: STOFFSIDE_DATASETT.filer.map(filnokkel) },
  { migrasjon: 'amfetamin_indikasjoner', hentet: '2026-09-25', filer: ['AMF1'] },
  { migrasjon: 'ghb_ketamin_indikasjoner', hentet: '2026-09-27', filer: NYE_STOFFSIDER },
  { migrasjon: 'thc_indikasjoner', hentet: '2026-09-27', filer: NYE_ANALYTTSIDER },
  { migrasjon: 'cbd_indikasjoner', hentet: '2026-09-27', filer: CBD_STOFFSIDER },
  { migrasjon: 'rusmidler_indikasjoner', hentet: '2026-09-28', filer: RUSMIDLER_INDIKASJONER },
]

export function indikasjonskilde(omgang: Indikasjonsimport): Importkilde {
  return { dokument: 'Felleskatalogen', felleskatalogen: omgang.hentet }
}

export function indikasjonsplan(
  omgang: Indikasjonsimport,
  katalog: Analyttkatalog = byggKatalog(FORTOLKNINGSOPPFORINGER),
): Importplan {
  const filer = INDIKASJONSDATASETT.filer.filter((f) => omgang.filer.includes(filnokkel(f)))
  return byggImportplan(filer, INDIKASJONSDATASETT.referanser, katalog, indikasjonskilde(omgang))
}
