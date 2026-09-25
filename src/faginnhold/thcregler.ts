/**
 * THC-syreregelsettet slik fortolkningen og analyttsiden bruker det: reglene
 * og teksten til hver tekstbolk, kontrollert og satt sammen til en
 * {@link ThcModell}.
 *
 * Databasen godtar bare gyldige regelsett, men appen kontrollerer dem likevel
 * før de tas i bruk: et regelsett som ikke består kontrollen, brukes ikke, og
 * modulen sier fra i stedet for å gi en kommentar som kan være feil.
 */
import { validerKommentar, type Kommentarinnhold } from '../domain/kommentarobjekt'
import { lagThcModell, type ThcModell, type ThcRegler } from '../domain/thcMotor'
import { validerThcRegelsett, type ThcRegelsett } from '../domain/thcRegelsett'
import {
  THC_TEKSTBOLKER,
  THC_TEKSTNOKLER,
  thcTeksterFra,
  validerThcTekst,
  type ThcRegelsettinnhold,
  type ThcTekster,
} from '../domain/thcTekster'
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

/* --- Redigeringen ----------------------------------------------------------- */

/** Reglene og tekstene slik de står i utkastet, klare til å redigeres. */
export function thcUtkastFra(utgave: ThcRegelsettutgave): { regler: ThcRegelsett; tekster: ThcTekster } | null {
  const { tekstbolker, ...regler } = utgave.regelsett.innhold
  const tekster = thcTeksterFra(tekstbolker, new Map(utgave.kommentarer.map((k) => [k.id, k.innhold.tekst])))
  return tekster.ok ? { regler, tekster: tekster.tekster } : null
}

/** Ett objekt som skal lagres som utkast, mot revisjonen redigeringen startet fra. */
export interface Thclagring<T> {
  id: string
  revisjon: number
  innhold: T
}

/** Det som må lagres: kommentarene med endret tekst, og regelsettet om reglene er endret. */
export interface Thcendringer {
  kommentarer: Thclagring<Kommentarinnhold>[]
  regelsett: Thclagring<ThcRegelsettinnhold> | null
}

/**
 * Hva som er endret fra utgaven. Tekstene lagres i kommentarene bolkene peker
 * på, så en tekstendring rører ikke regelsettet; bolkene peker på de samme
 * kommentarene som før.
 */
export function thcEndringer(utgave: ThcRegelsettutgave, regler: ThcRegelsett, tekster: ThcTekster): Thcendringer {
  const { tekstbolker, ...lagrede } = utgave.regelsett.innhold
  const kommentarer = THC_TEKSTNOKLER.flatMap((nokkel): Thclagring<Kommentarinnhold>[] => {
    const kommentar = utgave.kommentarer.find((k) => k.id === tekstbolker[nokkel])
    if (!kommentar || kommentar.innhold.tekst === tekster[nokkel]) return []
    return [
      { id: kommentar.id, revisjon: kommentar.revisjon, innhold: { ...kommentar.innhold, tekst: tekster[nokkel] } },
    ]
  })
  const regelsett = likt(lagrede, regler)
    ? null
    : { id: utgave.regelsett.id, revisjon: utgave.regelsett.revisjon, innhold: { ...regler, tekstbolker } }
  return { kommentarer, regelsett }
}

/**
 * Alt som hindrer at utkastet kan lagres, i vanlig språk: feilene i reglene,
 * i hver tekst, og plassholdere som ikke stemmer med kommentaren teksten står
 * i — de kan ikke endres. Databasen avviser det samme.
 */
export function thcUtkastfeil(utgave: ThcRegelsettutgave, regler: ThcRegelsett, tekster: ThcTekster): string[] {
  const { kommentarer } = thcEndringer(utgave, regler, tekster)
  const tekstfeil = THC_TEKSTNOKLER.flatMap((nokkel) => {
    const feil = validerThcTekst(nokkel, tekster[nokkel])
    if (feil.length > 0) return feil
    const kommentar = kommentarer.find((k) => k.id === utgave.regelsett.innhold.tekstbolker[nokkel])
    if (!kommentar) return []
    const tidligere = utgave.kommentarer.find((k) => k.id === kommentar.id)!.innhold.plassholdere
    return validerKommentar(kommentar.innhold, tidligere).map(
      (melding) => `Tekstbolken «${THC_TEKSTBOLKER[nokkel].tittel}»: ${melding}`,
    )
  })
  return [...validerThcRegelsett(regler), ...tekstfeil]
}

/** Sant når to JSON-verdier har samme innhold, uansett rekkefølgen på nøklene. */
function likt(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  return (
    ak.length === bk.length &&
    ak.every((k) => likt((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  )
}
