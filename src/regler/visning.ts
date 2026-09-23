/**
 * Et regelsett slik det vises og prøves: navnene på nivåene og handlingene,
 * feltene historikken sammenligner, og simulatoren.
 */
import { formatNumber } from '../domain/bands'
import { finnRegel, grensene, intervallmerke } from '../domain/intervallregler'
import { CUTOFF_NOKKEL, regelsettvalg, type Kommentarvalg } from '../domain/valg'
import type { Felt } from '../faginnhold/historikk'
import type { Level } from '../types'
import type { Intervallregelsett, Intervallregelsettinnhold, Regelhandling } from './modell'

export const NIVANAVN: Record<Level, string> = {
  under: 'Under referanseområdet',
  innenfor: 'Innenfor referanseområdet',
  over: 'Over referanseområdet',
}

export const HANDLINGSNAVN: Record<Regelhandling, string> = {
  ring_rekvirent: 'Ring rekvirent',
}

/** Ringegrensen slik den står under tabellen, eller `null`. */
export function visRingegrense(regelsett: Intervallregelsettinnhold): string | null {
  if (regelsett.ringegrense === null) return null
  return `${formatNumber(regelsett.ringegrense, regelsett.desimaler)} ${regelsett.enhet}`
}

/**
 * Hvordan en kommentar står i feltene: teksten, eller navnet på
 * kommentarobjektet der det er regelsettet selv som sammenlignes.
 */
export type Kommentarvisning = (id: string) => string

/** Tekstene regelsettet har slått opp. */
export function tekstene(regelsett: Intervallregelsett): Kommentarvisning {
  const oppslag = new Map(regelsett.kommentarer.map((k) => [k.id, k.tekst]))
  return (id) => oppslag.get(id) ?? ''
}

/**
 * Feltene i et regelsett, slik historikken og oppsummeringene sammenligner
 * dem: enheten og oppløsningen, så grensene, nivået, kommentaren og
 * handlingen for hvert intervall nedenfra og opp, og til sist ringegrensen og
 * «Til stede under cut-off».
 *
 * Intervallene kjennes igjen på plassen: et intervall som er delt i to, gir
 * endringer i alle over det.
 */
export function regelsettfelter(regelsett: Intervallregelsettinnhold, kommentar: Kommentarvisning): Felt[] {
  const felter: Felt[] = [
    { nokkel: 'enhet', navn: 'Enhet', verdi: regelsett.enhet },
    { nokkel: 'desimaler', navn: 'Desimaler', verdi: String(regelsett.desimaler) },
  ]
  for (const intervall of grensene(regelsett)) {
    const i = intervall.indeks
    const gruppe = `Intervall ${i + 1}`
    felter.push(
      {
        nokkel: `intervall-${i}-grenser`,
        gruppe,
        navn: 'Konsentrasjon',
        verdi: `${intervallmerke(intervall, regelsett.desimaler)} ${regelsett.enhet}`,
      },
      { nokkel: `intervall-${i}-niva`, gruppe, navn: 'Nivå', verdi: NIVANAVN[intervall.niva] },
      { nokkel: `intervall-${i}-kommentar`, gruppe, navn: 'Kommentar', verdi: kommentar(intervall.kommentarId), tekst: true },
      {
        nokkel: `intervall-${i}-handling`,
        gruppe,
        navn: 'Ekstra handling',
        verdi: intervall.handling ? HANDLINGSNAVN[intervall.handling] : 'Ingen',
      },
    )
  }
  const { cutoff } = regelsett
  const gruppe = 'Til stede under cut-off'
  felter.push(
    { nokkel: 'ringegrense', navn: 'Ringegrense', verdi: visRingegrense(regelsett) ?? 'Ingen' },
    {
      nokkel: 'cutoff-innledning',
      gruppe,
      navn: 'Innledning',
      verdi: cutoff ? kommentar(cutoff.innledning) : 'Ingen',
      tekst: true,
    },
    {
      nokkel: 'cutoff-kommentar',
      gruppe,
      navn: 'Settes foran',
      verdi: cutoff ? kommentar(cutoff.kommentar) : 'Ingen',
      tekst: true,
    },
  )
  return felter
}

/* --- Simulatoren --------------------------------------------------------- */

/** Det som prøves: en målt konsentrasjon, eller «til stede under cut-off». */
export type Proveverdi = number | 'cutoff'

export interface Simulering {
  /** Knappen steg 2 ville gitt — kommentaren, fargen, «ring rekvirent». */
  valg: Kommentarvalg
  /** Plassen til intervallet som traff, fra 0. `null` for cut-off. */
  intervall: number | null
}

/**
 * Hva regelsettet gir for en verdi: det samme valget steg 2 ville gitt, med
 * den samme kommentaren. `null` når regelsettet ikke har cut-off og det er
 * cut-off som prøves.
 */
export function simuler(regelsett: Intervallregelsett, verdi: Proveverdi): Simulering | null {
  const valg = regelsettvalg(regelsett)
  if (verdi === 'cutoff') {
    const cutoff = valg.find((v) => v.key === CUTOFF_NOKKEL)
    return cutoff ? { valg: cutoff, intervall: null } : null
  }
  const { indeks } = finnRegel(regelsett, verdi)
  return { valg: valg[indeks]!, intervall: indeks }
}
