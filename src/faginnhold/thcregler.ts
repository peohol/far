/**
 * THC-syreregelsettet slik fortolkningen og stoffsiden bruker det: reglene
 * og teksten til hver tekstbolk, kontrollert og satt sammen til en
 * {@link ThcModell}.
 *
 * Databasen godtar bare gyldige regelsett, men appen kontrollerer dem likevel
 * før de tas i bruk: et regelsett som ikke består kontrollen, brukes ikke, og
 * modulen sier fra i stedet for å gi en kommentar som kan være feil.
 */
import { validerKommentar, type Kommentarinnhold } from '../domain/kommentarobjekt'
import { lagThcModell, type ThcModell, type ThcRegler } from '../domain/thcMotor'
import { KURVEFARGE, THC_KURVEROLLER, validerThcRegelsett, type ThcBruksmonster, type ThcKurverolle, type ThcRegelsett } from '../domain/thcRegelsett'
import {
  THC_TEKSTBOLKER,
  THC_TEKSTNOKLER,
  thcTeksterFra,
  validerThcTekst,
  type ThcRegelsettinnhold,
  type ThcTekster,
  type ThcTekstnokkel,
} from '../domain/thcTekster'
import type { Henting } from '../hooks/useHenting'
import type { Felt } from './historikk'
import type { Faginnholdslager } from './lagring'
import type { Regelsettutgave } from './lesing'
import { tallTilFelt } from './paneler'
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

/** Tallene i hver utskillelseskurve. */
export const THC_KURVEFELT = ['a1', 'k1', 'a2', 'k2'] as const

/**
 * Delene av reglene som er låst i redigeringen: utskillelseskurvene og
 * konverteringsfaktoren som skalerer dem. De endres bare i koden (med en
 * migrasjon), aldri i appen.
 */
export const THC_LASTE_DELER = ['kurver', 'konverteringsfaktor'] as const satisfies readonly (keyof ThcRegelsett)[]

/** `regler` med de låste delene slik de står i `fra`, det som er lagret. */
export function medLasteDeler(regler: ThcRegelsett, fra: ThcRegelsett): ThcRegelsett {
  const laste = Object.fromEntries(THC_LASTE_DELER.map((del) => [del, fra[del]]))
  return { ...regler, ...laste }
}

/** Reglene og tekstene slik redigeringen holder dem. */
export interface ThcUtkast {
  regler: ThcRegelsett
  tekster: ThcTekster
}

/** Reglene og tekstene slik de står i utkastet, klare til å redigeres. */
export function thcUtkastFra(utgave: ThcRegelsettutgave): ThcUtkast | null {
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
 * Lagrer endringene fra `mot` som utkast: kommentarene med endret tekst og
 * regelsettet, i én transaksjon og mot revisjonene i `mot`. Står noe av det
 * på en nyere revisjon, avvises alt med en samtidighetskonflikt, og ingenting
 * er lagret. `mot` er utgaven brukeren åpnet, eller den nyeste når hen har
 * sammenlignet og valgt å lagre sitt over den; da lagres bare det som er
 * forskjellig fra den. De låste delene ({@link THC_LASTE_DELER}) lagres
 * alltid slik de står i `mot`, uansett hva utkastet har, og databasen avviser
 * dem om de er forskjellige fra det publiserte.
 */
export async function lagreThcUtkast(
  lager: Pick<Faginnholdslager, 'lagreThcRegelsett'>,
  mot: ThcRegelsettutgave,
  { regler, tekster }: ThcUtkast,
): Promise<void> {
  const { kommentarer, regelsett } = thcEndringer(mot, medLasteDeler(regler, mot.regelsett.innhold), tekster)
  if (!regelsett && kommentarer.length === 0) return
  const { id, revisjon, innhold } = mot.regelsett
  await lager.lagreThcRegelsett(id, revisjon, regelsett?.innhold ?? innhold, kommentarer)
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

/* --- Feltene ---------------------------------------------------------------- */

/**
 * Et tall i reglene slik feltet i redigeringen og historikken viser det.
 * Andeler (`skala` 100) står som prosent, rundet bare så 0,2 står som 20 og
 * ikke som 20,000000000000004; et tall som ikke kan leses, er tomt.
 */
export function tallSomFelt(verdi: number, skala = 1): string {
  if (!Number.isFinite(verdi)) return ''
  return tallTilFelt(skala === 1 ? verdi : Math.round(verdi * skala * 1e9) / 1e9)
}

const prosent = (andel: number) => `${tallSomFelt(andel, 100)} %`
const kurve = (rolle: ThcKurverolle) => `Den ${KURVEFARGE[rolle]} kurven`

/**
 * Feltene historikken og sammenligningene deler THC-syrereglene i, med navn
 * som i redigeringen: nivåene, marginene, måleusikkerheten, kurvene
 * bruksmønstrene avgjøres av, utskillelseskurvene og tekstbolkene. `tekst`
 * gir det som står for hver bolk: teksten i et utkast, eller navnet på
 * kommentaren bolken peker på i historikken for regelsettet.
 *
 * Tallene står med alle sifrene, så også en endring i siste siffer vises.
 */
export function thcfelter(regler: ThcRegelsett, tekst: (nokkel: ThcTekstnokkel) => string): Felt[] {
  const felter: Felt[] = []
  regler.konsentrasjonsnivaer.forEach((niva, i) => {
    const gruppe = `Nivå ${i + 1}`
    felter.push({ nokkel: `niva-${i}-navn`, gruppe, navn: 'Navn', verdi: niva.navn })
    if (niva.nedre !== null) {
      felter.push({ nokkel: `niva-${i}-nedre`, gruppe, navn: 'Fra og med (IRCAK)', verdi: tallSomFelt(niva.nedre) })
    }
    felter.push({ nokkel: `niva-${i}-nylig`, gruppe, navn: 'Tyder på nylig inntak', verdi: niva.nylig_inntak ? 'Ja' : 'Nei' })
  })
  regler.sikkerhetsmarginer.forEach(({ margin, z }, i) =>
    felter.push({
      nokkel: `margin-${i}`,
      gruppe: 'Sikkerhetsmargin',
      navn: `Margin ${i + 1}`,
      verdi: `${prosent(margin)} (z ${tallSomFelt(z)})`,
    }),
  )
  felter.push(
    { nokkel: 'margin-standard', gruppe: 'Sikkerhetsmargin', navn: 'Standard', verdi: prosent(regler.standard_sikkerhetsmargin) },
    { nokkel: 'cv-thc', gruppe: 'Måleusikkerhet', navn: 'CV for THC-syre', verdi: prosent(regler.maleusikkerhet.cv_thc) },
    { nokkel: 'cv-kreatinin', gruppe: 'Måleusikkerhet', navn: 'CV for kreatinin', verdi: prosent(regler.maleusikkerhet.cv_kreatinin) },
    {
      nokkel: 'faktor-under-cutoff',
      gruppe: 'Måleusikkerhet',
      navn: 'Faktor under cut-off',
      verdi: tallSomFelt(regler.maleusikkerhet.faktor_under_cutoff),
    },
  )
  const monster = (nokkel: string, gruppe: string, m: ThcBruksmonster) =>
    felter.push(
      { nokkel: `${nokkel}-vanskelig`, gruppe, navn: 'Vanskelig å avgjøre over', verdi: kurve(m.vanskelig_over) },
      { nokkel: `${nokkel}-nytt`, gruppe, navn: 'Nytt inntak over', verdi: kurve(m.nytt_inntak_over) },
    )
  monster('kronisk', 'Kronisk bruk', regler.bruksmonstre.kronisk)
  monster('enkeltinntak', 'Enkeltinntak', regler.bruksmonstre.ikke_kronisk)
  felter.push({ nokkel: 'varsel', navn: 'Varsel ved mer enn (dager mellom prøvene)', verdi: tallSomFelt(regler.varsel_dager_mellom) })
  for (const rolle of THC_KURVEROLLER) {
    const k = regler.kurver[rolle]
    const gruppe = kurve(rolle)
    felter.push(
      { nokkel: `kurve-${rolle}-navn`, gruppe, navn: 'Navn', verdi: k.navn },
      ...THC_KURVEFELT.map((felt) => ({
        nokkel: `kurve-${rolle}-${felt}`,
        gruppe,
        navn: felt,
        verdi: tallSomFelt(k[felt]),
      })),
    )
  }
  felter.push({ nokkel: 'konverteringsfaktor', navn: 'Konverteringsfaktor', verdi: tallSomFelt(regler.konverteringsfaktor) })
  for (const nokkel of THC_TEKSTNOKLER) {
    felter.push({ nokkel: `tekst-${nokkel}`, gruppe: 'Tekstbolkene', navn: THC_TEKSTBOLKER[nokkel].tittel, verdi: tekst(nokkel), tekst: true })
  }
  return felter
}

/** Feltene i et utkast slik redigeringen holder det, med tekstene. */
export function thcUtkastfelter({ regler, tekster }: ThcUtkast): Felt[] {
  return thcfelter(regler, (nokkel) => tekster[nokkel])
}

/** Feltene i en utgave, med tekstene i kommentarene bolkene peker på. */
export function thcUtgavefelter(utgave: ThcRegelsettutgave): Felt[] {
  const { tekstbolker, ...regler } = utgave.regelsett.innhold
  const tekster = new Map(utgave.kommentarer.map((k) => [k.id, k.innhold.tekst]))
  return thcfelter(regler, (nokkel) => tekster.get(tekstbolker[nokkel]) ?? '')
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
