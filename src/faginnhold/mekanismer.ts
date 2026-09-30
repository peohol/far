/**
 * Mekanismene i farmakodynamikken: hva et mekanismekort kan si om hvordan
 * stoffet virker på målet sitt, og i hvilken retning.
 *
 * Taksonomien skal aldri gjøre innholdet mer presist enn kilden. Sier kilden
 * bare «antagonist», er kortet `antagonisme` — antagonisme der subtypen ikke
 * er angitt — og ikke `kompetitiv_antagonisme`. De generelle typene
 * (`spesifikk: false`) finnes for å kunne gjengi en kilde uten å gjette; de
 * er ikke egne farmakologiske påstander. Grunnlaget står i
 * `docs/farmakodynamikk-kort-kartlegging.md`.
 *
 * Listen har bare typene innholdet faktisk bruker. En ny type legges til her
 * når en kilde trenger den, sammen med ikonet sitt (`mekanismeikon` i
 * `src/components/stoffside/panelvisning.ts`).
 */

/** Hva slags mål mekanismen virker på. */
export const MEKANISMEFAMILIER = [
  { nokkel: 'reseptor', navn: 'Reseptor' },
  { nokkel: 'ionekanal', navn: 'Ionekanal' },
  { nokkel: 'transportor', navn: 'Transportør' },
  { nokkel: 'enzym', navn: 'Enzym' },
  { nokkel: 'ingen', navn: 'Uten effekt' },
] as const

export type Mekanismefamilie = (typeof MEKANISMEFAMILIER)[number]['nokkel']

export interface Mekanismedefinisjon {
  nokkel: string
  familie: Mekanismefamilie
  /** Navnet slik det vises, med presiseringen i parentes når typen er generell. */
  navn: string
  /**
   * Om typen er en bestemt mekanisme (`true`), eller en generell kategori
   * for en kilde som ikke sier mer (`false`).
   */
  spesifikk: boolean
}

/** Mekanismetypene, gruppert etter familie, i den rekkefølgen redigeringen viser dem. */
export const MEKANISMER = [
  { nokkel: 'antagonisme', familie: 'reseptor', navn: 'Antagonisme (subtype ikke angitt)', spesifikk: false },
  { nokkel: 'kompetitiv_antagonisme', familie: 'reseptor', navn: 'Kompetitiv antagonisme', spesifikk: true },
  { nokkel: 'agonisme', familie: 'reseptor', navn: 'Agonisme (grad ikke angitt)', spesifikk: false },
  { nokkel: 'partiell_agonisme', familie: 'reseptor', navn: 'Partiell agonisme', spesifikk: true },
  {
    nokkel: 'reseptorbinding',
    familie: 'reseptor',
    navn: 'Binding/affinitet (funksjonell effekt ikke angitt)',
    spesifikk: false,
  },
  { nokkel: 'reseptorpavirkning', familie: 'reseptor', navn: 'Reseptorpåvirkning (mekanisme ikke angitt)', spesifikk: false },
  { nokkel: 'kanalblokkering', familie: 'ionekanal', navn: 'Kanalblokkering', spesifikk: true },
  { nokkel: 'bruksavhengig_blokkering', familie: 'ionekanal', navn: 'Bruks-/frekvensavhengig blokkering', spesifikk: true },
  { nokkel: 'ionekanalpavirkning', familie: 'ionekanal', navn: 'Ionekanalpåvirkning (mekanisme ikke angitt)', spesifikk: false },
  { nokkel: 'reopptakshemming', familie: 'transportor', navn: 'Reopptakshemming', spesifikk: true },
  { nokkel: 'transporterhemming', familie: 'transportor', navn: 'Transporterhemming', spesifikk: true },
  { nokkel: 'kotransporterhemming', familie: 'transportor', navn: 'Hemming/modulering av kotransportør', spesifikk: true },
  {
    nokkel: 'transportorpavirkning',
    familie: 'transportor',
    navn: 'Transportørpåvirkning (funksjonell effekt ikke angitt)',
    spesifikk: false,
  },
  { nokkel: 'enzymhemming', familie: 'enzym', navn: 'Enzymhemming (subtype ikke angitt)', spesifikk: false },
  { nokkel: 'ingen_effekt', familie: 'ingen', navn: 'Ingen effekt', spesifikk: true },
] as const satisfies readonly Mekanismedefinisjon[]

export type Mekanisme = (typeof MEKANISMER)[number]['nokkel']

/** Mekanismen et kort har når kilden sier uttrykkelig at stoffet ikke virker på målet. */
export const INGEN_EFFEKT: Mekanisme = 'ingen_effekt'

const MEKANISME_PER_NOKKEL = new Map<string, Mekanismedefinisjon>(MEKANISMER.map((m) => [m.nokkel, m]))

export function mekanismeFor(nokkel: string | null | undefined): Mekanismedefinisjon | undefined {
  return nokkel ? MEKANISME_PER_NOKKEL.get(nokkel) : undefined
}

export function erMekanisme(verdi: unknown): verdi is Mekanisme {
  return typeof verdi === 'string' && MEKANISME_PER_NOKKEL.has(verdi)
}

/**
 * Retningen på den direkte prosessen kortet beskriver — reseptoraktiviteten,
 * transporten, kanalstrømmen eller enzymaktiviteten — ikke de nedstrøms
 * virkningene. En α2-antagonist reduserer α2-aktiviteten (`ned`), selv om
 * den nedstrøms øker noradrenerg transmisjon.
 *
 * `tone` er fargen: rødt når prosessen reduseres, grønt når den økes, og
 * nøytralt ellers.
 */
export const RETNINGER = [
  { nokkel: 'ned', navn: 'Reduseres', symbol: '↓', tone: 'ned' },
  { nokkel: 'opp', navn: 'Økes', symbol: '↑', tone: 'opp' },
  { nokkel: 'ingen', navn: 'Ingen effekt', symbol: '0', tone: 'noytral' },
  { nokkel: 'ukjent', navn: 'Retning ikke angitt', symbol: '?', tone: 'noytral' },
] as const

export type Retning = (typeof RETNINGER)[number]['nokkel']
export type Retningstone = (typeof RETNINGER)[number]['tone']

const RETNING_PER_NOKKEL = new Map<string, (typeof RETNINGER)[number]>(RETNINGER.map((r) => [r.nokkel, r]))

export function retningFor(nokkel: Retning): (typeof RETNINGER)[number] {
  return RETNING_PER_NOKKEL.get(nokkel)!
}

export function erRetning(verdi: unknown): verdi is Retning {
  return typeof verdi === 'string' && RETNING_PER_NOKKEL.has(verdi)
}
