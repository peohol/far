/**
 * Hva en kommentartråd kan festes til i en gren, og hvordan ankeret vises:
 * siden eller et kort på den, og et felt i kortet — de samme feltene som
 * sammenligningen viser (`sidesammenligning.ts`).
 */
import { innholdsfelter } from '../faginnhold/innholdsfelter'
import type { Stoffsidedata } from '../faginnhold/lesing'
import { panelFor } from '../faginnhold/paneler'
import { kortnavn, sidensKort } from '../faginnhold/sidesammenligning'
import type { Anker } from './modell'

/** Et objekt på siden en tråd kan festes til, med feltene i det. */
export interface Ankervalg {
  objekt: string
  tittel: string
  felter: string[]
}

const SIDEN = 'Siden'

/** Siden og kortene på den, i sidens rekkefølge. */
export function ankervalg(side: Stoffsidedata): Ankervalg[] {
  const ut: Ankervalg[] = []
  if (side.infoside) {
    ut.push({ objekt: side.infoside.id, tittel: SIDEN, felter: innholdsfelter('infoside', side.infoside.innhold).map((f) => f.navn) })
  }
  for (const kort of sidensKort(side)) {
    const felter = innholdsfelter('innholdselement', kort.innhold)
      .filter((f) => f.nokkel !== 'kilder')
      .map((f) => f.navn)
    ut.push({ objekt: kort.id, tittel: kortnavn(kort.innhold), felter: [...felter, 'Kilder'] })
  }
  return ut
}

/** Ankeret i ord, som «Dosering · kort 1 · Tekst». */
export function ankertekst(anker: Anker | undefined, valg: readonly Ankervalg[]): string {
  if (!anker) return 'Hele grenen'
  const deler = [
    anker.objekt && (valg.find((v) => v.objekt === anker.objekt)?.tittel ?? 'Et kort som ikke står på siden'),
    anker.seksjon && (panelFor(anker.seksjon)?.tittel ?? anker.seksjon),
    anker.felt,
    anker.referanse && 'Referanse',
    anker.kilde && `Kilde ${anker.kilde}`,
    anker.dokument && `Dokumentet ${anker.dokument}`,
  ]
  return deler.filter(Boolean).join(' · ') || 'Hele grenen'
}
