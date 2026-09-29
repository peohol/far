/**
 * All klinisk output fortolkningsmodulene kan gi, samlet i én struktur.
 *
 * Brukes av `fortolkningUendret.test.ts` til å vise at outputen er nøyaktig
 * den samme som før: kommentarene, knappene og referansetallene for hver
 * analytt med konsentrasjonsbånd, EtG/EtS-alternativene, rusmiddelmodulene
 * over et rutenett av påviste analytter og konsentrasjoner, og
 * THC-syrekommentarene over alle kombinasjonene av det de bygges av.
 *
 * Knappene og pillene for konsentrasjonsbåndene lages av regelsettene fra før
 * byttet (se `dagensregler.ts`) og referanseområdene på stoffsidene
 * (`data/referanseomrader.json`), slik steg 2 lager dem av de publiserte —
 * med den samme koden.
 *
 * THC-syre fortolkes med regelsettet og tekstene som er publisert i Supabase.
 * Uten database brukes det de ble importert fra (`fasit/thc-*-import.json`),
 * som `thcRegelsettlagring.test.ts` viser at databasen gir tilbake uendret.
 *
 * Rusmiddelmodulene fortolkes med regelsettene som er publisert i Supabase.
 * Uten database brukes grunnlaget de ble importert fra (`rusgrunnlag.ts`),
 * som `rusimport.test.ts` viser at databasen gir tilbake uendret. Rutenettet
 * tar med verdiene rett på og rundt grensene reglene bruker (10 %, 20 % og
 * 100 %), så en endring der slår ut.
 */
import { analytes } from '../../domain/analytes'
import { ETG_ALTERNATIVER } from '../../domain/etg'
import { grensepiller } from '../../domain/piller'
import { RUS_MODULER } from '../../domain/rus'
import { kjorScenarier, verdifelter } from '../../domain/scenario'
import { konklusjon, settSammen, velgTekstbolker, THC_KONKLUSJONER } from '../../domain/thcMotor'
import { cutoffvalg, regelsettvalg } from '../../domain/valg'
import { dagensRegelsett } from './dagensregler'
import { referanseomradeFor } from './referanseomrader'
import { RUS_KOMMENTARER, rusRegelsett } from './rusgrunnlag'
import { THC_MODELL } from './thcgrunnlag'

/** Konsentrasjonene som prøves i hvert felt en rusmiddelmodul ber om. */
const RUSVERDIER = ['', '0', '0,05', '0,1', '0,19', '0,2', '0,21', '0,5', '0,99', '1', '1,01', '2', '10', '100']

/** Alle delmengder av kodene, i fast rekkefølge. */
function delmengder(koder: string[]): string[][] {
  return koder.reduce<string[][]>((alle, kode) => [...alle, ...alle.map((d) => [...d, kode])], [[]])
}

/** Alle kombinasjoner av verdier i feltene, som felt → verdi. */
function kombinasjoner(felt: string[]): Record<string, string>[] {
  return felt.reduce<Record<string, string>[]>(
    (alle, navn) => alle.flatMap((k) => RUSVERDIER.map((v) => ({ ...k, [navn]: v }))),
    [{}],
  )
}

export function fortolkningsutfall() {
  const band = analytes.map((analyte) => {
    const regelsett = dagensRegelsett(analyte.kode)
    return {
      kode: analyte.kode,
      valg: regelsettvalg(regelsett),
      cutoff: cutoffvalg(regelsett),
      piller: grensepiller(analyte, regelsett, referanseomradeFor(analyte.kode)),
    }
  })

  const rus = RUS_MODULER.map((modul) => {
    const regelsett = rusRegelsett(modul.id)
    return {
      id: modul.id,
      utfall: delmengder(modul.analytter.map((a) => a.kode)).flatMap((pavist) =>
        kombinasjoner(verdifelter(regelsett, pavist)).map((verdier) => ({
          pavist,
          verdier,
          resultat: kjorScenarier(regelsett, RUS_KOMMENTARER, { pavist, verdier }).resultat,
        })),
      ),
    }
  })

  // Kommentaren for hvert nivå og hver konklusjon, med og uten at forrige
  // prøve lå under cut-off — alle kombinasjonene tekstbolkene velges etter.
  const { regler, tekster } = THC_MODELL
  const thc = regler.konsentrasjonsnivaer.flatMap((niva) =>
    THC_KONKLUSJONER.flatMap((utfall) =>
      [true, false].map((underCutoff) =>
        settSammen(tekster, velgTekstbolker(niva, utfall, underCutoff), {
          niva: niva.navn,
          forrigeDato: '01.02.2026',
        }),
      ),
    ),
  )
  const forventet = { gronn: 1, gul: 2, rod: 3 }
  const kategorier = [true, false].flatMap((kronisk) =>
    [0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((korrigert) => konklusjon(regler, kronisk, korrigert, forventet)),
  )

  return { band, etg: ETG_ALTERNATIVER, rus, thc, kategorier }
}
