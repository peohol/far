/**
 * De korte oppsummeringene en lukket seksjon eller et lukket detaljkort viser
 * (se `src/components/seksjoner/`).
 *
 * En oppsummering sier hva som står inne i skuffen, med innholdets egne ord:
 * titlene på kortene, dosene i tabellen, begynnelsen av teksten. Den legger
 * ingenting til og tolker ingenting, og står aldri i stedet for innholdet.
 */

/** Skillet mellom delene i en oppsummering. */
export const OPPSUMMERINGSSKILLE = ' · '

/** Delene satt sammen, uten tomme og uten gjentakelser. Tom når ingen er igjen. */
export function ramsOpp(deler: readonly (string | null | undefined | false)[]): string {
  const sett = new Set<string>()
  for (const del of deler) {
    const renset = typeof del === 'string' ? del.replace(/\s+/g, ' ').trim() : ''
    if (renset) sett.add(renset)
  }
  return [...sett].join(OPPSUMMERINGSSKILLE)
}

/** Tegn en forhåndsvisning av fritekst tar med, omtrent. */
export const FORHANDSVISNINGSLENGDE = 140

/**
 * Begynnelsen av en tekst, på én linje: kuttet ved et ordskille før
 * `lengde`, med «…» når noe er utelatt. Skal vises som en smakebit og leses
 * som ufullstendig.
 */
export function forhandsvisning(tekst: string, lengde = FORHANDSVISNINGSLENGDE): string {
  const flat = tekst.replace(/\s+/g, ' ').trim()
  if (flat.length <= lengde) return flat
  const kuttet = flat.slice(0, lengde + 1)
  const ordskille = kuttet.lastIndexOf(' ')
  return `${(ordskille > lengde / 2 ? kuttet.slice(0, ordskille) : flat.slice(0, lengde)).replace(/[\s,;:.–-]+$/, '')} …`
}

/** «1 rad», «3 rader»: et antall med riktig bøyning. */
export function antall(n: number, entall: string, flertall: string): string {
  return `${n} ${n === 1 ? entall : flertall}`
}
