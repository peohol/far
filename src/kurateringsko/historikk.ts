/**
 * Kurateringene som står i repoet: monografkurateringene blant migrasjonene
 * på main, og evidensjournalene i `docs/kurateringsjournal/`. Køen bruker dem
 * som historikk for kurateringer den ikke har fulgt selv — de som ble gjort
 * før køen fantes, og de som gjøres utenom den.
 */
import type { Kurateringsspor, Modus } from './modell'

export interface Repofil {
  navn: string
  innhold: string
}

/** Kallet en monografkuratering åpner siden med (`docs/monografkuratering.md`). Ikke definisjonen av funksjonen. */
const KURATERINGSSTART = /intern\.kuratering_start\(\s*'([a-z0-9-]+)'\s*\)/
const VERSJON = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/
const DATO = '(\\d{4}-\\d{2}-\\d{2})'

/** SQL uten kommentarer, så et kall som er kommentert ut, ikke teller. */
const utenKommentarer = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')

/** Feltet i toppen av en journal: «- **Kunnskapsgrense:** 2026-10-13». */
function felt(journal: string, navn: string): string | null {
  return new RegExp(`\\*\\*(?:${navn}):\\*\\*\\s*([^\\n]+)`, 'i').exec(journal)?.[1]?.trim() ?? null
}

/** De novo-kurateringer funnet i repoet regnes til den første runden. */
export const REPO_RUNDE = 1

/**
 * Den siste kurateringen per stoff, etter migrasjonene og journalene. Modusen
 * er `de_novo` når migrasjonen sier det i navnet eller journalen har en de
 * novo-kjøring samme dag eller senere; ellers `oppdatering`.
 */
export function kurateringerIRepo(migrasjoner: readonly Repofil[], journaler: readonly Repofil[]): Record<string, Kurateringsspor> {
  const siste = new Map<string, { kl: string; fil: string }>()
  for (const m of migrasjoner) {
    const v = VERSJON.exec(m.navn)
    const stoff = KURATERINGSSTART.exec(utenKommentarer(m.innhold))?.[1]
    if (!v || !stoff) continue
    const kl = `${v[1]}-${v[2]}-${v[3]}T${v[4]}:${v[5]}:${v[6]}.000Z`
    const forrige = siste.get(stoff)
    if (!forrige || forrige.kl < kl) siste.set(stoff, { kl, fil: m.navn })
  }
  const journalFor = new Map(journaler.map((j) => [j.navn.replace(/\.md$/, ''), j.innhold]))
  const ut: Record<string, Kurateringsspor> = {}
  for (const [stoff, { kl, fil }] of siste) {
    const journal = journalFor.get(stoff) ?? ''
    const deNovoDato = felt(journal, 'Siste de novo-kjøring')?.match(new RegExp(DATO))?.[1] ?? null
    const modusfelt = felt(journal, 'Kurateringsmodus|Modus') ?? ''
    const deNovo = /de_novo/.test(fil) || (deNovoDato !== null && deNovoDato >= kl.slice(0, 10)) || (/de novo/i.test(modusfelt) && !deNovoDato)
    const kunnskapsgrense = felt(journal, 'Kunnskapsgrense|Kunnskapsdato')?.match(new RegExp(DATO))?.[1] ?? null
    const modus: Modus = deNovo ? 'de_novo' : 'oppdatering'
    ut[stoff] = { kl, modus, kunnskapsgrense, runde: deNovo ? REPO_RUNDE : null, pr: null, kilde: 'repo' }
  }
  return ut
}
