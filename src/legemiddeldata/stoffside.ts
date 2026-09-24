/**
 * Hvor legemiddeldataene står på en stoffside: koblingen i «Preparater»,
 * detaljkortene preparatene står i, og tekstene søket finner der.
 *
 * Alt her er rene funksjoner, så søket på siden og søket i hele
 * kunnskapsbasen kan peke på det samme stedet.
 */
import type { Sideelement, Sidemodell } from '../faginnhold/analyttside'
import { ELEMENTTYPER, lesLegemiddelkobling, type Legemiddelkoblingdata, type Panelnokkel } from '../faginnhold/paneler'
import type { Tilleggstekst } from '../faginnhold/sok'
import type { Preparatvisning } from './preparatmodell'

/** Seksjonen koblingen og preparatene står i. */
export const PREPARATPANEL: Panelnokkel = 'preparater'

/** Detaljkortet for en legemiddelform. Nøkkelen står i direktelenker. */
export function preparatkort(formId: string): string {
  return `form-${formId}`
}

/** Ankeret til styrkene i detaljkortet for en legemiddelform. */
export function preparatsted(formId: string): string {
  return `preparater-${formId}`
}

/** Koblingen siden har til legemiddeldataene, og elementet den står i. */
export function finnKobling(modell: Sidemodell): { element: Sideelement | null; kobling: Legemiddelkoblingdata } {
  const element =
    (modell.paneler.get(PREPARATPANEL) ?? []).find((e) => e.elementtype === ELEMENTTYPER.legemiddelkobling) ?? null
  return { element, kobling: lesLegemiddelkobling(element?.data) }
}

/**
 * Preparatnavnene, én gang per legemiddelform, med detaljkortet de står i.
 * Et navn står i styrkekortene i formen, også i de lukkede, så søket finner
 * det der og åpner kortet.
 */
export function preparattekster({ former }: Preparatvisning): Tilleggstekst[] {
  return former.flatMap((f) =>
    [...new Set(f.styrker.flatMap((s) => s.preparater.map((p) => p.navn)))].map(
      (navn): Tilleggstekst => ({
        panel: PREPARATPANEL,
        element: { id: preparatsted(f.id), tittel: f.form },
        felt: 'preparat',
        tekst: navn,
      }),
    ),
  )
}
