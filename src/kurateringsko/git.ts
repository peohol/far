/**
 * Det kurateringskøen trenger av git: lese og skrive filer på grener i
 * fjernrepoet uten å sjekke dem ut. Skriptet kjører i en klone med tilgang til
 * å skrive (i Actions: `actions/checkout` med legitimasjonen). Bare
 * `git`-kommandoer med faste argumenter; navnene på grenene er kontrollert av
 * kalleren.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Den som står på commitene køen lager. */
export const KOBRUKER = { navn: 'github-actions[bot]', epost: '41898282+github-actions[bot]@users.noreply.github.com' }

export interface Git {
  /** Grenene i fjernrepoet under prefikset, med commiten hver står på. */
  hoder(prefiks: string): Record<string, string>
  /** Henter grenene (bare siste commit) til lokale referanser; gir commitene. */
  hent(grener: readonly string[]): Record<string, string>
  /** Fila i commiten, eller `null` når den ikke finnes. */
  les(commit: string, sti: string): Buffer | null
  /** Når commiten ble laget (ISO). */
  tidspunkt(commit: string): string
  /** En ny commit med filene lagt til eller byttet ut i treet til forelderen (eller et tomt tre). */
  commit(forelder: string | null, filer: Readonly<Record<string, string>>, melding: string): string
  /** Skyver commiten til grenen. `false` når grenen har flyttet seg i mellomtiden (ikke en fremspoling). */
  skyv(commit: string, gren: string): boolean
  /** Sletter grenen, bare om den fortsatt står på commiten. */
  slett(gren: string, commit: string): boolean
}

export function lagGit(mappe: string, miljo: NodeJS.ProcessEnv = process.env): Git {
  const env = {
    ...miljo,
    GIT_AUTHOR_NAME: KOBRUKER.navn,
    GIT_AUTHOR_EMAIL: KOBRUKER.epost,
    GIT_COMMITTER_NAME: KOBRUKER.navn,
    GIT_COMMITTER_EMAIL: KOBRUKER.epost,
    GIT_TERMINAL_PROMPT: '0',
  }
  const git = (args: string[], ekstra: { input?: string | Buffer; env?: NodeJS.ProcessEnv } = {}) =>
    execFileSync('git', ['-C', mappe, ...args], { env: { ...env, ...ekstra.env }, input: ekstra.input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 })
  const tekst = (args: string[], ekstra?: Parameters<typeof git>[1]) => git(args, ekstra).toString('utf8').trim()
  const lokal = (gren: string) => `refs/kurateringsko-hentet/${gren}`
  const proev = (args: string[]) => {
    try {
      git(args)
      return true
    } catch {
      return false
    }
  }

  return {
    hoder(prefiks) {
      const ut = tekst(['ls-remote', '--heads', 'origin', `refs/heads/${prefiks}*`])
      return Object.fromEntries(
        ut
          .split('\n')
          .filter(Boolean)
          .map((l): [string, string] => {
            const [sha, ref] = l.split('\t') as [string, string]
            return [ref.replace(/^refs\/heads\//, ''), sha]
          })
          .filter(([gren]) => gren.startsWith(prefiks)),
      )
    },
    hent(grener) {
      if (grener.length === 0) return {}
      git(['fetch', '-q', '--no-tags', '--depth=1', 'origin', ...grener.map((g) => `+refs/heads/${g}:${lokal(g)}`)])
      return Object.fromEntries(grener.map((g) => [g, tekst(['rev-parse', lokal(g)])]))
    },
    les(commit, sti) {
      try {
        return git(['cat-file', 'blob', `${commit}:${sti}`])
      } catch {
        return null
      }
    },
    tidspunkt(commit) {
      return new Date(tekst(['show', '-s', '--format=%cI', commit])).toISOString()
    },
    commit(forelder, filer, melding) {
      const mappeForIndeks = mkdtempSync(join(tmpdir(), 'kurateringsko-'))
      const indeks = { env: { GIT_INDEX_FILE: join(mappeForIndeks, 'indeks') } }
      try {
        if (forelder) git(['read-tree', forelder], indeks)
        else git(['read-tree', '--empty'], indeks)
        for (const [sti, innhold] of Object.entries(filer)) {
          const blob = tekst(['hash-object', '-w', '--stdin'], { input: innhold })
          git(['update-index', '--add', '--cacheinfo', `100644,${blob},${sti}`], indeks)
        }
        const tre = tekst(['write-tree'], indeks)
        return tekst(['commit-tree', tre, ...(forelder ? ['-p', forelder] : []), '-F', '-'], { input: melding })
      } finally {
        rmSync(mappeForIndeks, { recursive: true, force: true })
      }
    },
    skyv: (commit, gren) => proev(['push', '-q', 'origin', `${commit}:refs/heads/${gren}`]),
    slett: (gren, commit) => proev(['push', '-q', `--force-with-lease=refs/heads/${gren}:${commit}`, 'origin', `:refs/heads/${gren}`]),
  }
}
