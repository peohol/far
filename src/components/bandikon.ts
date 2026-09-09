import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CutoffIcon, PhoneIcon } from './icons'
import type { Kommentarvalg } from '../domain/valg'

const IKON = {
  under: ArrowDownIcon,
  innenfor: CheckIcon,
  over: ArrowUpIcon,
  ring: PhoneIcon,
  cutoff: CutoffIcon,
} as const

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
export function bandIkon(valg: Pick<Kommentarvalg, 'tone' | 'ring'>) {
  return IKON[valg.ring && valg.tone !== 'ring' ? 'ring' : valg.tone]
}
