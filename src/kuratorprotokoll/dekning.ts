/**
 * Dekningsmatrisen i en kuratering (`docs/kuratorprotokoll.md`, «Dekningen»):
 * kontrollpunktene som utledes av appens levende innholdsmodell, og
 * kontrollen av at matrisen dekker nøyaktig dem, med status, begrunnelse og
 * belegg for hvert. Kontrollen bekrefter dekningen, ikke faglig sannhet.
 */
import { createHash } from 'node:crypto'
import { DATAKORT, PANELER, type Paneldefinisjon } from '../faginnhold/paneler'

/** Hvordan et kontrollpunkt er behandlet. */
export const DEKNINGSSTATUSER = ['nytt_eller_oppdatert', 'beholdt_etter_kontroll', 'automatisk_verifisert', 'tomt_begrunnet'] as const
export type Dekningsstatus = (typeof DEKNINGSSTATUSER)[number]

export interface Dekningsomrade {
  nokkel: string
  status: Dekningsstatus
  begrunnelse: string
  kilder: string[]
  sok: string[]
  artefakt: string
  bevis: string
}

export interface Dekningsmatrise {
  modus: 'de_novo' | 'kuratering' | 'evidensovervaking'
  modell_sha256: string
  omrader: Dekningsomrade[]
}

/**
 * Kontrollpunktene, i sidens rekkefølge: hvert panel, hvert datakort under
 * viktige data, og hvert faste kort (med gruppen foran når panelet har
 * grupper).
 */
export function kontrollpunkter(paneler: readonly Paneldefinisjon[] = PANELER): string[] {
  return paneler.flatMap((p) => [
    p.nokkel,
    ...(p.form === 'datakort' ? DATAKORT.map((d) => `${p.nokkel}/${d.type}`) : []),
    ...(p.grupper ? p.grupper.flatMap((g) => g.kort.map((k) => `${p.nokkel}/${g.nokkel}/${k}`)) : (p.kort ?? []).map((k) => `${p.nokkel}/${k}`)),
  ])
}

/** Fingeravtrykket av modellen matrisen er laget mot: SHA-256 av kontrollpunktene. Endres modellen, må matrisen lages på nytt. */
export function modellSha256(punkter: readonly string[] = kontrollpunkter()): string {
  return createHash('sha256').update(JSON.stringify(punkter)).digest('hex')
}

/** En tom matrise å fylle ut, med ett område per kontrollpunkt. */
export function tomMatrise(modus: Dekningsmatrise['modus']): Dekningsmatrise {
  return {
    modus,
    modell_sha256: modellSha256(),
    omrader: kontrollpunkter().map((nokkel) => ({ nokkel, status: 'beholdt_etter_kontroll', begrunnelse: '', kilder: [], sok: [], artefakt: '', bevis: '' })),
  }
}

const tekst = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const tekster = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/**
 * Hva som mangler eller er galt i matrisen; tom når den dekker modellen. Hvert
 * område skal ha en begrunnelse. Det som er skrevet eller beholdt, skal ha
 * kilder og bevis; et tomt område skal si hva det ble søkt etter.
 */
export function kontrollerDekning(matrise: unknown, punkter: readonly string[] = kontrollpunkter()): string[] {
  if (typeof matrise !== 'object' || matrise === null) return ['Matrisen må være et JSON-objekt.']
  const m = matrise as Record<string, unknown>
  const feil: string[] = []
  if (!['de_novo', 'kuratering', 'evidensovervaking'].includes(m.modus as string)) feil.push('modus må være de_novo, kuratering eller evidensovervaking.')
  if (m.modell_sha256 !== modellSha256(punkter)) feil.push('modell_sha256 stemmer ikke med appens innholdsmodell nå; lag matrisen på nytt mot den.')
  if (!Array.isArray(m.omrader)) return [...feil, 'omrader må være en liste.']

  const sett = new Map<string, number>()
  for (const o of m.omrader as Record<string, unknown>[]) {
    const nokkel = typeof o?.nokkel === 'string' ? o.nokkel : '(uten nøkkel)'
    sett.set(nokkel, (sett.get(nokkel) ?? 0) + 1)
    if (!punkter.includes(nokkel)) {
      feil.push(`${nokkel}: ikke et kontrollpunkt i modellen.`)
      continue
    }
    if (!DEKNINGSSTATUSER.includes(o.status as Dekningsstatus)) feil.push(`${nokkel}: status må være en av ${DEKNINGSSTATUSER.join(', ')}.`)
    if (!tekst(o.begrunnelse)) feil.push(`${nokkel}: mangler begrunnelse.`)
    if (!tekster(o.kilder) || !tekster(o.sok)) feil.push(`${nokkel}: kilder og sok må være lister med tekst.`)
    else if (o.status === 'tomt_begrunnet' && o.sok.length === 0) feil.push(`${nokkel}: et tomt område må si hva det ble søkt etter.`)
    else if ((o.status === 'nytt_eller_oppdatert' || o.status === 'beholdt_etter_kontroll') && (o.kilder.length === 0 || !tekst(o.bevis))) {
      feil.push(`${nokkel}: det som er skrevet eller beholdt, må ha kilder og bevis.`)
    }
  }
  for (const p of punkter) {
    const n = sett.get(p) ?? 0
    if (n === 0) feil.push(`${p}: mangler i matrisen.`)
    if (n > 1) feil.push(`${p}: står ${n} ganger.`)
  }
  return feil
}
