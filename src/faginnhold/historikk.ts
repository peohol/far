/**
 * Historikken til et redigerbart objekt, og sammenligningen av to revisjoner.
 *
 * Databasen gir hendelsene (opprettet, endret, gjenopprettet, publisert) med
 * hvem og når, og det komplette øyeblikksbildet i hver revisjon
 * (`les_historikk`). Her gjøres de om til det historikkvisningen viser:
 * tidslinjen, og hva som er endret mellom to revisjoner.
 *
 * Sammenligningen er strukturert: innholdet deles i navngitte felt (se
 * {@link Felt}), feltene sammenlignes hver for seg, og bare teksten i et felt
 * sammenlignes ord for ord. Hver objekttype kan si hvordan den deles; alt
 * annet deles opp etter formen JSON-en har.
 *
 * Alt her er rene funksjoner.
 */
import type { Handling } from './modell'

/** Én hendelse i historikken. */
export interface Historikkhendelse {
  handling: Handling
  revisjon: number
  /** Revisjonen innholdet ble hentet fra, for en gjenoppretting. */
  gjenopprettet_fra?: number
  /** Revisjonen som var publisert før, for en publisering. */
  forrige_revisjon?: number
  utfort_av_fornavn: string
  utfort_av_etternavn: string
  utfort_kl: string
  /** Hvor innholdet kom fra, for en import. */
  kilde?: string
}

/** Øyeblikksbildet i én revisjon. */
export interface Revisjonsbilde<T> {
  revisjon: number
  innhold: T
}

/**
 * Historikken slik leseren får se den: administratorer alt, andre bare
 * revisjonene som har vært publisert.
 */
export interface Historikk<T> {
  /** Eldste først. */
  hendelser: Historikkhendelse[]
  /** Stigende. */
  revisjoner: Revisjonsbilde<T>[]
}

/* --- Tidspunkt og navn ----------------------------------------------------- */

const DATOFORMAT = new Intl.DateTimeFormat('nb-NO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Oslo',
})
const TIDSFORMAT = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' })

/** «22.09.2026 kl. 14:32», eller tomt når tidspunktet ikke kan leses. */
export function tidspunkt(iso: string): string {
  const tid = new Date(iso)
  return Number.isNaN(tid.getTime()) ? '' : `${DATOFORMAT.format(tid)} kl. ${TIDSFORMAT.format(tid)}`
}

/** For- og etternavn, slik de var da endringen ble gjort. */
export function fulltNavn(person: { fornavn?: string; etternavn?: string }): string {
  return [person.fornavn, person.etternavn].filter(Boolean).join(' ')
}

const HANDLINGSNAVN: Record<Handling, string> = {
  opprettet: 'Opprettet',
  endret: 'Endret',
  gjenopprettet: 'Gjenopprettet',
  publisert: 'Publisert',
}

/** «Gjenopprettet fra revisjon 2», «Publisert» og så videre. */
export function beskrivHandling(hendelse: Historikkhendelse): string {
  const navn = HANDLINGSNAVN[hendelse.handling]
  if (hendelse.handling === 'gjenopprettet' && hendelse.gjenopprettet_fra !== undefined) {
    return `${navn} fra revisjon ${hendelse.gjenopprettet_fra}`
  }
  return navn
}

/** «av Ada Adminsen 22.09.2026 kl. 14:32». */
export function hvemOgNar(hendelse: Historikkhendelse): string {
  const navn = fulltNavn({ fornavn: hendelse.utfort_av_fornavn, etternavn: hendelse.utfort_av_etternavn })
  return [navn && `av ${navn}`, tidspunkt(hendelse.utfort_kl)].filter(Boolean).join(' ')
}

/**
 * Revisjonen det er naturlig å sammenligne med: den nærmeste eldre leseren
 * kan se. For en vanlig bruker er det den forrige publiserte, ikke
 * utkastene imellom.
 */
export function forrigeSynlige<T>(historikk: Historikk<T>, revisjon: number): Revisjonsbilde<T> | null {
  let forrige: Revisjonsbilde<T> | null = null
  for (const bilde of historikk.revisjoner) {
    if (bilde.revisjon < revisjon && (!forrige || bilde.revisjon > forrige.revisjon)) forrige = bilde
  }
  return forrige
}

/** Den publiserte revisjonen etter siste publisering, eller `null`. */
export function sistPublisert(historikk: Historikk<unknown>): number | null {
  const publiseringer = historikk.hendelser.filter((h) => h.handling === 'publisert')
  return publiseringer.at(-1)?.revisjon ?? null
}

/* --- Tekst, ord for ord ---------------------------------------------------- */

export type Tekstdelslag = 'lik' | 'fjernet' | 'lagt_til'

export interface Tekstdel {
  slag: Tekstdelslag
  tekst: string
}

/**
 * Ordene med mellomrommet foran seg, og mellomrommet på slutten. Sammen er de
 * hele teksten. Mellomrommet følger ordet, så et ord som settes inn, ikke
 * river mellomrommene ut av sammenhengen.
 */
function ordOgMellomrom(tekst: string): string[] {
  return tekst.match(/\s*\S+|\s+$/g) ?? []
}

/**
 * Hva som er fjernet og lagt til fra én tekst til en annen, ord for ord.
 *
 * Den lengste felles delfølgen av ord står som lik; resten er fjernet fra den
 * første eller lagt til i den andre. De fjernede og de like delene gir
 * sammen den første teksten, de tilføyde og de like den andre.
 */
export function ordforskjell(for_: string, etter: string): Tekstdel[] {
  const a = ordOgMellomrom(for_)
  const b = ordOgMellomrom(etter)
  // Tabellen over lengste felles delfølge, bakfra. Tekstene er kommentarer og
  // korte fagtekster, så kvadratisk tid og plass er uproblematisk.
  const lengde = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengde[i]![j] =
        a[i] === b[j] ? lengde[i + 1]![j + 1]! + 1 : Math.max(lengde[i + 1]![j]!, lengde[i]![j + 1]!)
    }
  }

  const deler: Tekstdel[] = []
  const legg = (slag: Tekstdelslag, tekst: string) => {
    const siste = deler.at(-1)
    if (siste?.slag === slag) siste.tekst += tekst
    else deler.push({ slag, tekst })
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      legg('lik', a[i]!)
      i++
      j++
    } else if (lengde[i + 1]![j]! >= lengde[i]![j + 1]!) {
      legg('fjernet', a[i++]!)
    } else {
      legg('lagt_til', b[j++]!)
    }
  }
  while (i < a.length) legg('fjernet', a[i++]!)
  while (j < b.length) legg('lagt_til', b[j++]!)
  return deler
}

/* --- Felt for felt --------------------------------------------------------- */

/**
 * Ett navngitt felt i innholdet, slik sammenligningen ser det. `nokkel`
 * kjenner feltet igjen fra én revisjon til en annen; `navn` er det brukeren
 * ser, og `gruppe` samler felt som hører sammen, som reglene for ett
 * intervall.
 */
export interface Felt {
  nokkel: string
  navn: string
  verdi: string
  gruppe?: string
  /** Sant for fritekst, som sammenlignes ord for ord. */
  tekst?: boolean
}

export interface Feltendring {
  nokkel: string
  navn: string
  gruppe?: string
  /** `null` når feltet ikke fantes. */
  for: string | null
  etter: string | null
  endret: boolean
  tekst: boolean
}

/**
 * Feltene i to revisjoner, side om side. Rekkefølgen er den nyeste
 * revisjonens, med felt som bare fantes i den eldste der de sto.
 */
export function sammenlignFelter(for_: readonly Felt[], etter: readonly Felt[]): Feltendring[] {
  const forPerNokkel = new Map(for_.map((f) => [f.nokkel, f]))
  const etterNokler = new Set(etter.map((f) => f.nokkel))
  const endring = (f: Felt, gammel: Felt | undefined, ny: Felt | undefined): Feltendring => ({
    nokkel: f.nokkel,
    navn: f.navn,
    ...(f.gruppe !== undefined && { gruppe: f.gruppe }),
    for: gammel?.verdi ?? null,
    etter: ny?.verdi ?? null,
    endret: gammel?.verdi !== ny?.verdi,
    tekst: Boolean(f.tekst),
  })

  // Et felt som er borte, settes inn foran det feltet som fulgte etter det
  // og fortsatt finnes.
  const fjernetForan = new Map<string, Felt[]>()
  let fjernet: Felt[] = []
  for (const gammel of for_) {
    if (!etterNokler.has(gammel.nokkel)) fjernet.push(gammel)
    else if (fjernet.length > 0) {
      fjernetForan.set(gammel.nokkel, fjernet)
      fjernet = []
    }
  }

  const ut: Feltendring[] = []
  for (const ny of etter) {
    for (const gammel of fjernetForan.get(ny.nokkel) ?? []) ut.push(endring(gammel, gammel, undefined))
    ut.push(endring(ny, forPerNokkel.get(ny.nokkel), ny))
  }
  for (const gammel of fjernet) ut.push(endring(gammel, gammel, undefined))
  return ut
}

/**
 * Navnene på feltene som er endret, som «Intervall 2: Kommentar». Til en kort
 * oppsummering før noe publiseres.
 */
export function endredeFelt(for_: readonly Felt[], etter: readonly Felt[]): string[] {
  return sammenlignFelter(for_, etter)
    .filter((e) => e.endret)
    .map((e) => (e.gruppe ? `${e.gruppe}: ${e.navn}` : e.navn))
}

/**
 * Feltene i et hvilket som helst innhold, etter formen JSON-en har: ett felt
 * per verdi, med stien dit som navn. For objekttyper som ikke har en egen
 * oppdeling.
 */
export function jsonfelter(innhold: unknown, sti = ''): Felt[] {
  if (Array.isArray(innhold)) {
    if (innhold.length === 0) return sti ? [{ nokkel: sti, navn: sti, verdi: '–' }] : []
    return innhold.flatMap((v, i) => jsonfelter(v, `${sti}[${i + 1}]`))
  }
  if (innhold !== null && typeof innhold === 'object') {
    return Object.entries(innhold as Record<string, unknown>).flatMap(([nokkel, v]) =>
      jsonfelter(v, sti ? `${sti}.${nokkel}` : nokkel),
    )
  }
  const verdi = innhold === null || innhold === undefined ? '–' : String(innhold)
  return [{ nokkel: sti, navn: sti, verdi, tekst: typeof innhold === 'string' }]
}
