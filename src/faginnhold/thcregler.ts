/**
 * THC-syreregelsettet slik fortolkningen og analyttsiden bruker det: reglene
 * og teksten til hver tekstbolk, kontrollert og satt sammen til en
 * {@link ThcModell}.
 *
 * Databasen godtar bare gyldige regelsett, men appen kontrollerer dem likevel
 * før de tas i bruk: et regelsett som ikke består kontrollen, brukes ikke, og
 * modulen sier fra i stedet for å gi en kommentar som kan være feil.
 */
import { lagThcModell, type ThcModell, type ThcRegler } from '../domain/thcMotor'
import { thcTeksterFra, type ThcRegelsettinnhold } from '../domain/thcTekster'
import type { Henting } from '../hooks/useHenting'
import type { Regelsettutgave } from './lesing'
import { REGLENE_KUNNE_IKKE_HENTES } from './scenarioregler'

export type ThcRegelsettutgave = Regelsettutgave<ThcRegelsettinnhold>

/** Modellen utgaven gir, eller feilene som gjør at den ikke kan brukes. */
export function tilThcModell(
  utgave: ThcRegelsettutgave,
): { ok: true; modell: ThcModell } | { ok: false; feil: string[] } {
  const { tekstbolker, ...regler } = utgave.regelsett.innhold
  const kommentarer = new Map(utgave.kommentarer.map((k) => [k.id, k.innhold.tekst]))
  const tekster = thcTeksterFra(tekstbolker, kommentarer)
  return tekster.ok ? lagThcModell(regler, tekster.tekster) : tekster
}

const SI_FRA = 'Si fra til den som redigerer fortolkningsreglene.'

/**
 * Reglene i den formen fortolkningsmodulen tar imot dem. Et regelsett som
 * mangler eller ikke er gyldig, gir en feil med forklaring; da fortolkes det
 * ikke.
 */
export function thcReglerFra(henting: Henting<ThcRegelsettutgave | null>, provIgjen: () => void): ThcRegler {
  if (henting.status === 'laster') return henting
  if (henting.status === 'feil') {
    return { status: 'feil', melding: `${REGLENE_KUNNE_IKKE_HENTES} ${henting.melding}`, provIgjen }
  }
  if (!henting.data) {
    return {
      status: 'feil',
      melding: `Det finnes ingen publiserte regler for THC-syre i urin. ${SI_FRA}`,
      provIgjen,
    }
  }
  const modell = tilThcModell(henting.data)
  if (modell.ok) return { status: 'klar', modell: modell.modell }
  return {
    status: 'feil',
    melding: `Reglene for THC-syre i urin er ikke gyldige og brukes ikke. ${SI_FRA}`,
    provIgjen,
  }
}
