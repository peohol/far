/**
 * Referanseområdene stoffsidene har i produksjon: kortet
 * «Referanseområde» i «Viktige data» for hovedsiden til hver analytt, fra
 * psykofarmaka-PDF-en (arbeidspakke 4). Steg 2 viser de samme, lest fra
 * databasen (`les_stoffreferanseomrader`, se `stoffreferanseomrader.ts`).
 *
 * Fasiten for klinisk output bruker disse. Tre av dem er ulike det de gamle
 * datasettene hadde: BREK (50–330), DOKSUM (18–550) og LMP (< 300).
 */
import type { Referanseomrade } from '../../domain/piller'
import data from '../data/referanseomrader.json'

export const REFERANSEOMRADER: Readonly<Record<string, Referanseomrade>> = data

export function referanseomradeFor(kode: string): Referanseomrade | null {
  return REFERANSEOMRADER[kode] ?? null
}
