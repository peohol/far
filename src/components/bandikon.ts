import type { Ikonnavn } from './ikon/register'
import type { Kommentarvalg } from '../domain/valg'

const IKON = {
  under: 'bUnder',
  innenfor: 'bInnenfor',
  over: 'bOver',
  ring: 'phone',
  cutoff: 'cutoff',
} as const satisfies Record<Kommentarvalg['tone'] | 'ring', Ikonnavn>

/**
 * Ikonet valget bæres av. Knappen i steg 2 og beviset over lim-inn-kortet
 * bruker det samme, så det går fram at det er den samme knappen som fulgte med
 * videre.
 *
 * Skal rekvirenten ringes, er det telefonen som gjelder — også når båndet har
 * fargen til nivået sitt. Det er tilfellet nettopp når `ring` er satt uten at
 * tonen er den røde: den tonen er forbeholdt båndet som både ligger over
 * referanseområdet og over ringegrensen.
 */
export function bandIkon(valg: Pick<Kommentarvalg, 'tone' | 'ring'>): Ikonnavn {
  return IKON[valg.ring && valg.tone !== 'ring' ? 'ring' : valg.tone]
}
