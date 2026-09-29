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
import { ELEMENTTYPER, lesLegemiddelkobling, type Legemiddelkoblingdata, type Panelnokkel } from '../faginnhold/paneler'
import type { Tilleggstekst } from '../faginnhold/sok'
import type { Interaksjonsoversikt } from './interaksjoner'
import type { Legemiddelutvalg } from './lesing'
import type { Preparatvisning } from './preparatmodell'
import { egneVirkestoff, virkestoffI } from './preparater'
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
        detaljkort: preparatkort(f.id),
        felt: 'preparat',
        tekst: navn,
      }),
    ),
  )
}

/** Stoffene siden interagerer med, med detaljkortet de står i. */
export function interaksjonstekster({ interaksjoner }: Interaksjonsoversikt): Tilleggstekst[] {
  return interaksjoner.map((i): Tilleggstekst => {
    const kort = interaksjonssted(i)
    return { panel: INTERAKSJONSPANEL, element: { id: kort, tittel: i.med }, detaljkort: kort, felt: 'overskrift', tekst: i.med }
  })
}

/**
 * Den delen av et utvalg som hører til én side: det `les_legemidler` gir for
 * sidens egne virkestoff. Da kan legemiddeldataene for mange sider leses i ett
 * kall og deles opp etterpå, med de samme preparatene hver side viser.
 *
 * Et preparat hører til siden når det har et av sidens virkestoff, eller et
 * salt av det, med eller uten styrke — som i `les_legemidler`. Pakningene og
 * byttegruppene følger preparatene.
 */
export function utvalgFor(utvalg: Legemiddelutvalg, koblet: readonly string[]): Legemiddelutvalg {
  const { egne } = egneVirkestoff(utvalg, koblet)
  const styrker = new Map(utvalg.styrker.map((s) => [s.id, s]))
  const merkevarer = utvalg.merkevarer.filter((m) => virkestoffI(m, styrker).some((id) => egne.has(id)))
  const merkevareider = new Set(merkevarer.map((m) => m.id))
  const pakninger = utvalg.pakninger.filter((p) => p.merkevarer.some((id) => merkevareider.has(id)))
  const byttegrupper = new Set(pakninger.flatMap((p) => p.byttegrupper))
  const styrkeider = new Set(merkevarer.flatMap((m) => m.virkestoff_med_styrke))
  const alleStyrker = utvalg.styrker.filter((s) => styrkeider.has(s.id))
  const stoff = new Set([...koblet, ...merkevarer.flatMap((m) => virkestoffI(m, styrker))])
  return {
    ...utvalg,
    virkestoff: utvalg.virkestoff.filter((v) => stoff.has(v.id)),
    styrker: alleStyrker,
    merkevarer,
    pakninger,
    byttegrupper: utvalg.byttegrupper.filter((b) => byttegrupper.has(b.id)),
  }
}
