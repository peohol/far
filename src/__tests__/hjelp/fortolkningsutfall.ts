/**
 * All klinisk output fortolkningsmodulene kan gi, samlet i én struktur.
 *
 * Brukes av `fortolkningUendret.test.ts` til å vise at outputen er nøyaktig
 * den samme som før: kommentarene, knappene og referansetallene for hver
 * analytt med konsentrasjonsbånd, EtG/EtS-alternativene, rusmiddelmodulene
 * over et rutenett av påviste analytter og konsentrasjoner, og
 * THC-syrekommentarene over alle kombinasjonene av det de bygges av.
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
import { beregnKategori, byggKommentar, type Konsentrasjonsniva } from '../../domain/thc'
import { cutoffvalg, valgene } from '../../domain/valg'
import { RUS_KOMMENTARER, rusRegelsett } from './rusgrunnlag'

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
  const band = analytes.map((analyte) => ({
    kode: analyte.kode,
    valg: valgene(analyte),
    cutoff: cutoffvalg(analyte),
    piller: grensepiller(analyte),
  }))

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

  const nivaer: Konsentrasjonsniva[] = ['lav', 'middels høy', 'høy']
  const thc = nivaer.flatMap((niva) =>
    [0, 1, 2, 3, 4, 5].flatMap((kategori) =>
      [true, false].flatMap((medForrige) =>
        [true, false].map((underCutoff) => byggKommentar(niva, kategori, medForrige, '01.02.2026', underCutoff)),
      ),
    ),
  )
  const forventet = { gronn: 1, gul: 2, rod: 3 }
  const kategorier = [true, false].flatMap((medForrige) =>
    [true, false].flatMap((kronisk) =>
      [0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((korrigert) => beregnKategori(medForrige, kronisk, korrigert, forventet)),
    ),
  )

  return { band, etg: ETG_ALTERNATIVER, rus, thc, kategorier }
}
