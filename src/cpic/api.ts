/**
 * Kallene mot CPICs API. Kjøres bare på serveren: nettleseren snakker aldri
 * med CPIC.
 *
 * API-et (`api.cpicpgx.org/v1`) er PostgREST rett over CPIC-databasen, uten
 * nøkkel. CPIC oppgir ingen grense for antall kall; synkroniseringen gjør
 * likevel bare ett om gangen, med en pause mellom hvert, og henter store
 * tabeller i sider. Hver tabell hentes med `Prefer: count=exact`, og antallet
 * rader som kom, må stemme med antallet API-et oppga — ellers er uttrekket
 * ufullstendig, og kjøringen avbrytes. Et 429-svar eller en serverfeil gir en
 * pause og nye forsøk.
 *
 * Hvilken CPIC-database dataene kommer fra, leses fra to steder: skjemaversjonen
 * i API-et (`flyway_schema_history`) og siste publiserte release på GitHub
 * (`cpicpgx/cpic-data`). Release-oppslaget er til informasjon; feiler det,
 * lagres dataene likevel, uten release.
 */

export const CPIC_API = 'https://api.cpicpgx.org/v1'

export const CPIC_RELEASER = 'https://api.github.com/repos/cpicpgx/cpic-data/releases/latest'

/** Rader per side. Diplotypetabellen er over hundre tusen rader. */
export const SIDESTORRELSE = 25_000

/** Pause mellom kallene. */
export const AVSTAND_MS = 300

/** Hvor lenge ett kall kan ta. */
const TIDSGRENSE_MS = 60_000

/** Nye forsøk etter 429 eller serverfeil. */
const NYE_FORSOK = 2

export class CpicFeil extends Error {
  constructor(
    melding: string,
    readonly status: number | null = null,
  ) {
    super(melding)
    this.name = 'CpicFeil'
  }
}

/** Hvilken CPIC-database som ble lest. */
export interface Kildeinfo {
  release: string | null
  release_dato: string | null
  skjemaversjon: string | null
  skjema_kl: string | null
}

export interface CpicApi {
  /** Alle radene i en tabell, sortert og kontrollert mot antallet API-et oppgir. */
  tabell(tabell: string, valg: { kolonner?: string; rekkefolge: string }): Promise<unknown[]>
  kildeinfo(): Promise<Kildeinfo>
}

export interface Apivalg {
  hent?: typeof fetch
  base?: string
  releaser?: string
  sidestorrelse?: number
  avstand?: number
  /** Venting, byttes ut i testene. */
  vent?: (ms: number) => Promise<void>
}

const standardVent = (ms: number) => new Promise<void>((ferdig) => setTimeout(ferdig, ms))

/** «0-24999/112820» → 112820. `null` når totalen mangler. */
export function totalFraContentRange(hode: string | null): number | null {
  const total = hode ? /\/(\d+)\s*$/.exec(hode)?.[1] : undefined
  return total === undefined ? null : Number(total)
}

function tekst(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

export function lagCpicApi({
  hent = fetch,
  base = CPIC_API,
  releaser = CPIC_RELEASER,
  sidestorrelse = SIDESTORRELSE,
  avstand = AVSTAND_MS,
  vent = standardVent,
}: Apivalg = {}): CpicApi {
  let forste = true

  async function kall(url: URL, hoder: Record<string, string>): Promise<Response> {
    for (let forsok = 0; ; forsok += 1) {
      if (!forste) await vent(avstand)
      forste = false
      const res = await hent(url, { headers: { accept: 'application/json', ...hoder }, signal: AbortSignal.timeout(TIDSGRENSE_MS) })
      const kanProvesIgjen = res.status === 429 || res.status >= 500
      if (kanProvesIgjen && forsok < NYE_FORSOK) {
        const sekunder = Number(res.headers.get('retry-after'))
        await vent(Number.isFinite(sekunder) && sekunder > 0 ? Math.min(sekunder, 30) * 1000 : 5000 * (forsok + 1))
        continue
      }
      return res
    }
  }

  async function json(res: Response, hva: string): Promise<unknown> {
    try {
      return await res.json()
    } catch {
      throw new CpicFeil(`CPIC ga et svar som ikke kunne leses for ${hva}.`, res.status)
    }
  }

  return {
    tabell: async (tabell, { kolonner, rekkefolge }) => {
      const rader: unknown[] = []
      let total: number | null = null
      for (let fra = 0; total === null || fra < total; fra += sidestorrelse) {
        const url = new URL(`${base}/${tabell}`)
        url.searchParams.set('select', kolonner ?? '*')
        url.searchParams.set('order', rekkefolge)
        url.searchParams.set('limit', String(sidestorrelse))
        url.searchParams.set('offset', String(fra))
        const res = await kall(url, { prefer: 'count=exact' })
        if (!res.ok && res.status !== 206) throw new CpicFeil(`CPIC svarte ${res.status} for ${tabell}.`, res.status)
        const side = await json(res, tabell)
        if (!Array.isArray(side)) throw new CpicFeil(`CPIC ga ikke en liste for ${tabell}.`, res.status)
        const oppgitt = totalFraContentRange(res.headers.get('content-range'))
        if (oppgitt === null) throw new CpicFeil(`CPIC oppga ikke hvor mange rader ${tabell} har.`, res.status)
        if (total !== null && oppgitt !== total) {
          throw new CpicFeil(`Antallet rader i ${tabell} endret seg under hentingen (${total} → ${oppgitt}).`)
        }
        total = oppgitt
        rader.push(...side)
        if (side.length === 0) break
      }
      if (rader.length !== total) {
        throw new CpicFeil(`Uttrekket av ${tabell} er ufullstendig: ${rader.length} av ${total} rader.`)
      }
      return rader
    },

    kildeinfo: async () => {
      const skjemaUrl = new URL(`${base}/flyway_schema_history`)
      skjemaUrl.searchParams.set('select', 'version,installed_on,success')
      skjemaUrl.searchParams.set('success', 'is.true')
      skjemaUrl.searchParams.set('order', 'installed_rank.desc')
      skjemaUrl.searchParams.set('limit', '1')
      const skjemasvar = await kall(skjemaUrl, {})
      if (!skjemasvar.ok) throw new CpicFeil(`CPIC svarte ${skjemasvar.status} for skjemaversjonen.`, skjemasvar.status)
      const skjema = await json(skjemasvar, 'skjemaversjonen')
      const siste = Array.isArray(skjema) && typeof skjema[0] === 'object' && skjema[0] !== null ? (skjema[0] as Record<string, unknown>) : {}

      let release: string | null = null
      let releaseDato: string | null = null
      try {
        const res = await hent(releaser, {
          headers: { accept: 'application/vnd.github+json', 'user-agent': 'OUSFAR' },
          signal: AbortSignal.timeout(TIDSGRENSE_MS),
        })
        if (res.ok) {
          const r = (await res.json()) as Record<string, unknown>
          release = tekst(r.tag_name)
          releaseDato = tekst(r.published_at)
        }
      } catch {
        // Release-oppslaget er til informasjon; dataene lagres uten.
      }

      return {
        release,
        release_dato: releaseDato,
        skjemaversjon: tekst(siste.version),
        skjema_kl: tekst(siste.installed_on),
      }
    },
  }
}
