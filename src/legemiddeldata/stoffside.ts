/**
 * Hvor legemiddeldataene står på en stoffside: koblingen i «Preparater»,
 * seksjonene og detaljkortene preparatene og interaksjonene står i, og
 * tekstene søket finner der.
 *
 * Alt her er rene funksjoner. Søket på siden (`Stoffside.tsx`) og søket i
 * hele kunnskapsbasen (`src/faginnhold/globaltSok.ts`) bruker de samme, så et
 * treff peker på det samme stedet uansett hvilket søk som fant det.
 */
import type { Sideelement, Sidemodell } from '../faginnhold/stoffside'
import { alfabetisk, ELEMENTTYPER, lesLegemiddelkobling, type Legemiddelkoblingdata, type Panelnokkel } from '../faginnhold/paneler'
import type { Tilleggstekst } from '../faginnhold/sok'
import { relevansgrad, sammenlignInteraksjoner, type Interaksjon } from './interaksjoner'
import type { Interaksjonssokerad, Preparatsokerad } from './lesing'
import { legemiddelform, type Preparatvisning } from './preparatmodell'
import { interaksjonssted } from './referanser'

/** Seksjonen koblingen og preparatene står i. */
export const PREPARATPANEL: Panelnokkel = 'preparater'

/** Seksjonen interaksjonene står i. */
export const INTERAKSJONSPANEL: Panelnokkel = 'interaksjoner'

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

/** FEST-ID-ene til virkestoffene siden er koblet til. */
export function koblede(modell: Sidemodell): string[] {
  return finnKobling(modell).kobling.virkestoff.map((v) => v.fest_id)
}

/** Preparatnavnene i én legemiddelform, det søket finner i formens detaljkort. */
export interface Preparatform {
  id: string
  form: string
  navn: readonly string[]
}

/** Preparatnavnene i hver legemiddelform seksjonen viser. */
export function preparatformer({ former }: Pick<Preparatvisning, 'former'>): Preparatform[] {
  return former.map((f) => ({ id: f.id, form: f.form, navn: f.styrker.flatMap((s) => s.preparater.map((p) => p.navn)) }))
}

/**
 * Preparatnavnene i hver legemiddelform fra søkedataene (`les_preparatsok`),
 * gruppert som {@link byggPreparatvisning} grupperer merkevarene.
 */
export function preparatformerFraSok(rader: readonly Preparatsokerad[]): Preparatform[] {
  const former = new Map<string, { id: string; form: string; navn: string[] }>()
  for (const [kode, tekst, navn] of rader) {
    const { id, form } = legemiddelform({ kode, tekst })
    const f = former.get(id) ?? former.set(id, { id, form, navn: [] }).get(id)!
    f.navn.push(navn)
  }
  return [...former.values()]
}

/**
 * Preparatnavnene, én gang per legemiddelform, med detaljkortet de står i.
 * Et navn står i styrkekortene i formen, også i de lukkede, så søket finner
 * det der og åpner kortet. Formene og navnene står alfabetisk.
 */
export function preparattekster(former: readonly Preparatform[]): Tilleggstekst[] {
  return [...former]
    .sort((a, b) => alfabetisk(a.form, b.form) || sammenlign(a.id, b.id))
    .flatMap((f) =>
      [...new Set(f.navn)]
        .sort((a, b) => alfabetisk(a, b) || sammenlign(a, b))
        .map(
          (navn): Tilleggstekst => ({
            panel: PREPARATPANEL,
            element: { id: preparatsted(f.id), tittel: f.form },
            detaljkort: preparatkort(f.id),
            felt: 'preparat',
            tekst: navn,
          }),
        ),
    )
}

/** Stoffene siden interagerer med, med detaljkortet de står i, i rekkefølgen seksjonen viser dem. */
export function interaksjonstekster(interaksjoner: readonly Pick<Interaksjon, 'id' | 'med'>[]): Tilleggstekst[] {
  return interaksjoner.map((i): Tilleggstekst => {
    const kort = interaksjonssted(i)
    return { panel: INTERAKSJONSPANEL, element: { id: kort, tittel: i.med }, detaljkort: kort, felt: 'overskrift', tekst: i.med }
  })
}

/**
 * Interaksjonene seksjonen viser, fra søkedataene (`les_interaksjonssok`),
 * i samme rekkefølge som {@link byggInteraksjoner}.
 */
export function interaksjonerFraSok(rader: readonly Interaksjonssokerad[]): Pick<Interaksjon, 'id' | 'relevans' | 'med'>[] {
  return rader
    .flatMap(([id, kode, med]) => {
      const relevans = relevansgrad(kode)
      return relevans ? [{ id, relevans, med }] : []
    })
    .sort(sammenlignInteraksjoner)
}

const sammenlign = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
