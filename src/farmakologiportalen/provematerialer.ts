/**
 * Prøvematerialene laboratoriene oppgir i Farmakologiportalen, samlet i
 * matrisene fagsidene viser en tabell for (`docs/farmakologiportalen.md`).
 *
 * Det opprinnelige navnet beholdes alltid; matrisen er bare hvilken tabell
 * analysen står i. Serum og plasma står i samme tabell, som i portalen selv,
 * og navnet vises når det ikke er det samme for alle radene. Et prøvemateriale
 * OUSFAR ikke kjenner, får ingen matrise og meldes i «Datakilder».
 */

export interface Matrise {
  nokkel: string
  /** Overskriften for tabellen. */
  navn: string
  /** Prøvematerialene som hører hit, slik portalen skriver dem (små bokstaver). */
  kilder: readonly string[]
}

/** I den rekkefølgen tabellene står på fagsiden. */
export const MATRISER: readonly Matrise[] = [
  { nokkel: 'serum_plasma', navn: 'Serum og plasma', kilder: ['serum', 'plasma', 'plasma/serum', 'serum/plasma'] },
  { nokkel: 'fullblod', navn: 'Fullblod', kilder: ['fullblod', 'blod'] },
  { nokkel: 'kapillaerblod', navn: 'Kapillærblod', kilder: ['kapillærblod'] },
  { nokkel: 'erytrocytter', navn: 'Erytrocytter', kilder: ['erytrocytter'] },
  { nokkel: 'urin', navn: 'Urin', kilder: ['urin'] },
  { nokkel: 'spytt', navn: 'Spytt', kilder: ['spytt', 'munnvæske'] },
  { nokkel: 'har', navn: 'Hår', kilder: ['hår'] },
  { nokkel: 'spinalvaeske', navn: 'Spinalvæske', kilder: ['spinalvæske'] },
  { nokkel: 'utandingsluft', navn: 'Utåndingsluft', kilder: ['utåndingsluft'] },
  { nokkel: 'dna', navn: 'DNA', kilder: ['dna'] },
]

const ETTER_KILDE = new Map(MATRISER.flatMap((m) => m.kilder.map((k) => [k, m] as const)))

export const matrisenokkel = (navn: string): string => navn.normalize('NFC').replace(/ /g, ' ').trim().toLowerCase()

/** Matrisen et prøvemateriale hører til, eller `null` når OUSFAR ikke kjenner det. */
export function matriseFor(provemateriale: string | null | undefined): Matrise | null {
  return provemateriale ? (ETTER_KILDE.get(matrisenokkel(provemateriale)) ?? null) : null
}

export function finnMatrise(nokkel: string): Matrise | undefined {
  return MATRISER.find((m) => m.nokkel === nokkel)
}
