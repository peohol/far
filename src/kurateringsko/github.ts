/**
 * Det kurateringskøen slår opp i GitHub: PR-ene til de ferdige kurateringene
 * og utrullingen til produksjonen etter at en er slått sammen. Gjennom
 * `gh api` med arbeidsflytens egen nøkkel; bare lesing.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Prinfo, Utrulling } from './ko'

export interface Github {
  /** PR-en, eller `null` når den ikke finnes. */
  pr(nummer: number): Promise<Prinfo | null>
  /** De åpne PR-ene, med grenen hver kommer fra. */
  apnePr(): Promise<{ nummer: number; gren: string }[]>
  /** Utrullingen til produksjonen etter tidspunktet (`Produksjonsmigrering` på main). */
  utrulling(etter: string): Promise<Utrulling>
}

/** Arbeidsflyten som ruller migrasjonene ut etter en sammenslåing (`docs/migrasjoner.md`). */
export const UTRULLINGSFLYT = 'produksjonsmigrering.yml'

export type Apikall = (sti: string) => Promise<unknown>

/** `gh api` for repoet; `null` for 404. */
export function ghApi(repo: string): Apikall {
  const kjor = promisify(execFile)
  return async (sti) => {
    try {
      const { stdout } = await kjor('gh', ['api', '-H', 'Accept: application/vnd.github+json', `repos/${repo}/${sti}`], { maxBuffer: 64 * 1024 * 1024 })
      return JSON.parse(stdout)
    } catch (e) {
      const tekst = String((e as { stderr?: unknown }).stderr ?? '')
      if (/HTTP 404/.test(tekst)) return null
      throw new Error(`GitHub svarte ikke på ${sti.split('?')[0]}.`)
    }
  }
}

type Rad = Record<string, unknown>
const tekst = (v: unknown) => (typeof v === 'string' ? v : null)

export function lagGithub(api: Apikall): Github {
  return {
    async pr(nummer) {
      const pr = (await api(`pulls/${nummer}`)) as Rad | null
      if (!pr) return null
      const sammenslatt_kl = tekst(pr.merged_at)
      const tilstand: Prinfo['tilstand'] = sammenslatt_kl ? 'sammenslatt' : pr.state === 'closed' ? 'lukket' : pr.draft ? 'utkast' : 'klar'
      let migrasjoner = false
      if (tilstand === 'sammenslatt') {
        for (let side = 1; side <= 30; side += 1) {
          const filer = ((await api(`pulls/${nummer}/files?per_page=100&page=${side}`)) ?? []) as Rad[]
          if (filer.some((f) => tekst(f.filename)?.startsWith('supabase/migrations/'))) migrasjoner = true
          if (migrasjoner || filer.length < 100) break
        }
      }
      return { nummer, url: tekst(pr.html_url) ?? '', tilstand, sammenslatt_kl, gren: tekst((pr.head as Rad | undefined)?.ref), migrasjoner }
    },
    async apnePr() {
      const ut: { nummer: number; gren: string }[] = []
      for (let side = 1; side <= 10; side += 1) {
        const rader = ((await api(`pulls?state=open&per_page=100&page=${side}`)) ?? []) as Rad[]
        for (const r of rader) {
          const gren = tekst((r.head as Rad | undefined)?.ref)
          if (typeof r.number === 'number' && gren) ut.push({ nummer: r.number, gren })
        }
        if (rader.length < 100) break
      }
      return ut
    },
    async utrulling(etter) {
      const svar = (await api(`actions/workflows/${UTRULLINGSFLYT}/runs?branch=main&per_page=50`)) as { workflow_runs?: Rad[] } | null
      // Kjøringen starter når sammenslåingen er skjøvet til main; et minutts slark for klokkene.
      const kjoringer = (svar?.workflow_runs ?? []).filter((r) => Date.parse(tekst(r.created_at) ?? '') >= Date.parse(etter) - 60_000)
      const vellykket = kjoringer
        .filter((r) => r.status === 'completed' && r.conclusion === 'success')
        .map((r) => tekst(r.updated_at)!)
        .sort()
      if (vellykket.length > 0) return { status: 'vellykket', kl: new Date(vellykket[0]!).toISOString() }
      const pagar = kjoringer.some((r) => r.status !== 'completed')
      const feilet = kjoringer.filter((r) => r.status === 'completed' && r.conclusion !== 'success' && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped')
      if (!pagar && feilet.length > 0) return { status: 'feilet', kl: new Date(tekst(feilet[0]!.updated_at)!).toISOString() }
      return { status: 'venter' }
    },
  }
}
