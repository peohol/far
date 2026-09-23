/**
 * Interaksjonene på en stoffside, slik seksjonen «Interaksjoner» viser dem.
 *
 * Interaksjonene er DMPs egne vurderinger i FEST. Hver er et par av to
 * substansgrupper; stoffene er angitt med ATC-kode (også på overordnet nivå,
 * som gjelder alle kodene under) eller med virkestoffets ID. Visningen følger
 * FESTs implementeringsveiledning (kapittel 8):
 *
 * - Siden slår opp på ATC-kodene til **preparatene med bare sidens
 *   virkestoff** (med saltene). FEST har ingen kobling mellom virkestoff og
 *   ATC-kode, og kombinasjonspreparatenes koder ville tatt med interaksjonene
 *   til de andre virkestoffene.
 * - Bare «Bør unngås» og «Forholdsregler bør tas» vises. «Ingen tiltak
 *   nødvendig» skal ifølge veiledningen ikke gi interaksjonsmelding.
 * - De alvorligste står først. Klinisk konsekvens, situasjonskriterium,
 *   mekanisme, håndtering (i avsnitt med overskrift), kildegrunnlag og
 *   referanser vises for hver.
 * - ATC-koder DMP ikke har vurdert, sies fra om, så en tom liste ikke leses
 *   som «ingen interaksjoner».
 *
 * Ingenting her endrer FESTs tekst; den deles bare opp og sorteres.
 */
import { ramsOpp } from '../faginnhold/oppsummering'
import { alfabetisk } from '../faginnhold/paneler'
import type { Interaksjonssubstans, Substansgruppe } from './fest'
import type { Interaksjonsnokler, Interaksjonsutvalg, Legemiddelutvalg } from './lesing'
import { egneVirkestoff, trygLenke, virkestoffI } from './preparater'

/** Relevansene som vises, i den rekkefølgen de vises, med fargen de får. */
const VISTE_RELEVANSER = new Map([
  ['1', 'unnga'],
  ['2', 'forholdsregler'],
] as const)

export type Relevansgrad = 'unnga' | 'forholdsregler'

/** Overskriftene håndteringen er delt i, etter implementeringsveiledningen. */
const HANDTERINGSAVSNITT = ['Dosetilpasning', 'Justering av administrering', 'Monitorering', 'Legemiddelalternativer']

export interface Handteringsavsnitt {
  overskrift: string | null
  tekst: string
}

export interface Interaksjon {
  id: string
  relevans: Relevansgrad
  /** FESTs tekst for relevansen, f.eks. «Bør unngås». */
  relevanstekst: string
  /** Stoffet eller gruppen siden interagerer med. */
  med: string
  /** Stoffet eller gruppen på sidens side av interaksjonen, f.eks. en legemiddelklasse. */
  gjelder: string
  situasjonskriterier: string[]
  klinisk_konsekvens: string | null
  mekanisme: string | null
  handtering: Handteringsavsnitt[]
  kildegrunnlag: string | null
  referanser: { kilde: string; lenke?: string }[]
}

export interface Interaksjonsoversikt {
  /** De viste interaksjonene, alvorligste først. */
  interaksjoner: Interaksjon[]
  /** ATC-kodene siden slo opp på. */
  atc: string[]
  /** ATC-kodene DMP ikke har vurdert, som «Betanekol (N07AB02)». */
  ikke_vurdert: string[]
}

/**
 * ATC-kodene og virkestoffene interaksjonene slås opp på: kodene til
 * preparatene som bare har sidens virkestoff, og virkestoffene selv.
 */
export function interaksjonsnokler(utvalg: Legemiddelutvalg, koblet: readonly string[]): Interaksjonsnokler {
  const { egne } = egneVirkestoff(utvalg, koblet)
  const styrker = new Map(utvalg.styrker.map((s) => [s.id, s]))
  const atc = new Set<string>()
  for (const m of utvalg.merkevarer) {
    const stoff = virkestoffI(m, styrker)
    if (m.atc?.kode && stoff.length > 0 && stoff.every((id) => egne.has(id))) atc.add(m.atc.kode)
  }
  return { atc: [...atc].sort(), virkestoff: [...egne].sort() }
}

/** Om stoffet hører til siden: samme virkestoff, eller en ATC-kode som omfatter sidens. */
function treffer(substans: Interaksjonssubstans, nokler: Interaksjonsnokler): boolean {
  if (substans.virkestoff_id && nokler.virkestoff.includes(substans.virkestoff_id)) return true
  const kode = substans.atc?.kode
  return !!kode && nokler.atc.some((a) => a.startsWith(kode))
}

/**
 * Navnet på en substansgruppe: gruppens eget, ellers stoffet med den
 * overordnede ATC-koden som omfatter alle de andre (f.eks. en
 * legemiddelklasse), ellers stoffene etter hverandre.
 */
function gruppenavn(gruppe: Substansgruppe | undefined): string {
  if (!gruppe) return ''
  if (gruppe.navn) return gruppe.navn
  const koder = gruppe.substanser.map((s) => s.atc?.kode ?? '')
  const overordnet = gruppe.substanser.find(
    (s) => s.atc?.kode && s.navn && koder.every((k) => !k || k.startsWith(s.atc!.kode)),
  )
  return overordnet?.navn ?? [...new Set(gruppe.substanser.map((s) => s.navn).filter(Boolean))].join(', ')
}

/** Håndteringen delt i avsnitt, med overskriften når linjen begynner med en av dem. */
export function handteringsavsnitt(tekst: string | null): Handteringsavsnitt[] {
  return (tekst ?? '')
    .split('\n')
    .map((linje) => linje.trim())
    .filter(Boolean)
    .map((linje) => {
      const overskrift = HANDTERINGSAVSNITT.find((o) => linje.startsWith(`${o}:`))
      return overskrift
        ? { overskrift, tekst: linje.slice(overskrift.length + 1).trim() }
        : { overskrift: null, tekst: linje }
    })
}

export function byggInteraksjoner(utvalg: Interaksjonsutvalg, nokler: Interaksjonsnokler): Interaksjonsoversikt {
  const interaksjoner: Interaksjon[] = []
  for (const i of utvalg.interaksjoner) {
    const relevans = VISTE_RELEVANSER.get(i.relevans?.kode as '1' | '2')
    if (!relevans) continue
    const egen = i.substansgrupper.findIndex((g) => g.substanser.some((s) => treffer(s, nokler)))
    if (egen === -1) continue
    const annen = i.substansgrupper.find((_, n) => n !== egen)
    interaksjoner.push({
      id: i.id,
      relevans,
      relevanstekst: i.relevans!.tekst,
      med: gruppenavn(annen),
      gjelder: gruppenavn(i.substansgrupper[egen]),
      situasjonskriterier: i.situasjonskriterier,
      klinisk_konsekvens: i.klinisk_konsekvens,
      mekanisme: i.mekanisme,
      handtering: handteringsavsnitt(i.handtering),
      kildegrunnlag: i.kildegrunnlag?.tekst || null,
      referanser: i.referanser.map((r) => {
        const lenke = trygLenke(r.lenke, { http: true })
        return { kilde: r.kilde || lenke || '', ...(lenke && { lenke }) }
      }),
    })
  }
  const rekkefolge = [...VISTE_RELEVANSER.values()]
  interaksjoner.sort(
    (a, b) =>
      rekkefolge.indexOf(a.relevans) - rekkefolge.indexOf(b.relevans) || alfabetisk(a.med, b.med) || alfabetisk(a.id, b.id),
  )
  const ikkeVurdert = new Set(
    utvalg.ikke_vurdert.flatMap((v) =>
      v.atc.filter((k) => k.kode && nokler.atc.some((a) => a.startsWith(k.kode))).map((k) => `${k.tekst} (${k.kode})`),
    ),
  )
  return { interaksjoner, atc: [...nokler.atc], ikke_vurdert: [...ikkeVurdert].sort(alfabetisk) }
}

/**
 * Oppsummeringen av seksjonen, f.eks. «3 bør unngås · 12 forholdsregler bør
 * tas». Uten interaksjoner sier den om stoffet ikke er vurdert.
 */
export function oppsummerInteraksjoner(oversikt: Interaksjonsoversikt): string {
  const tell = (r: Relevansgrad) => oversikt.interaksjoner.filter((i) => i.relevans === r).length
  const unnga = tell('unnga')
  const forholdsregler = tell('forholdsregler')
  const tall = ramsOpp([unnga > 0 && `${unnga} bør unngås`, forholdsregler > 0 && `${forholdsregler} forholdsregler bør tas`])
  if (tall) return tall
  if (oversikt.ikke_vurdert.length > 0) return 'Ikke vurdert av DMP'
  return oversikt.atc.length > 0 ? 'Ingen interaksjoner i FEST' : 'Ingen ATC-kode å slå opp på'
}
