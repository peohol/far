/**
 * Kallene mot ClinPGx' API. Kjøres bare på serveren: nettleseren snakker
 * aldri med ClinPGx.
 *
 * ClinPGx ber om høyst to kall i sekundet og svarer 429 på for mange. Alle
 * kall går derfor gjennom én kø i hver prosess ({@link lagClinpgxApi}), ett om
 * gangen og med minst {@link MINSTE_AVSTAND_MS} mellom starten på hvert. Et
 * 429-svar gir en pause (så lenge `Retry-After` sier, ellers noen sekunder) og
 * ett nytt forsøk til; det samme gjør en serverfeil hos ClinPGx.
 *
 * Svarene følger JSend: `{ status: 'success', data }`. ClinPGx svarer 404 med
 * `status: 'fail'` og «No results matching criteria.» når et søk ikke gir
 * treff; det er en tom liste, ikke en feil.
 */

export const CLINPGX_API = 'https://api.clinpgx.org/v1'

/** Minste tid mellom to kall. ClinPGx tillater to i sekundet; litt margin. */
export const MINSTE_AVSTAND_MS = 600

/** Hvor lenge ett kall kan ta. */
const TIDSGRENSE_MS = 30_000

/** Nye forsøk etter 429 eller serverfeil. */
const NYE_FORSOK = 2

export class ClinpgxFeil extends Error {
  constructor(
    melding: string,
    readonly status: number | null = null,
  ) {
    super(melding)
    this.name = 'ClinpgxFeil'
  }
}

export interface ClinpgxApi {
  /** En liste fra `/data/...`: tom når ClinPGx ikke har treff. */
  liste(sti: string, parametre: Record<string, string>): Promise<unknown[]>
  /** Ett objekt fra `/data/.../{id}`: `null` når det ikke finnes. */
  ett(sti: string, parametre?: Record<string, string>): Promise<unknown | null>
}

export interface Apivalg {
  hent?: typeof fetch
  base?: string
  avstand?: number
  /** Venting, byttes ut i testene. */
  vent?: (ms: number) => Promise<void>
  /** Klokken, byttes ut i testene. */
  na?: () => number
}

const standardVent = (ms: number) => new Promise<void>((ferdig) => setTimeout(ferdig, ms))

interface Jsend {
  status?: unknown
  data?: unknown
  message?: unknown
}

function ingenTreff(svar: Jsend): boolean {
  if (svar.status !== 'fail' || typeof svar.data !== 'object' || svar.data === null) return false
  const feil = (svar.data as { errors?: unknown }).errors
  return Array.isArray(feil) && feil.some((f) => typeof f === 'object' && f !== null && /no results|notfound|not found/i.test(JSON.stringify(f)))
}

function feilmelding(svar: Jsend | null, status: number): string {
  const data = svar?.data as { errors?: { message?: unknown }[] } | undefined
  const melding = data?.errors?.map((f) => f?.message).find((m) => typeof m === 'string') ?? svar?.message
  return `ClinPGx svarte ${status}${typeof melding === 'string' && melding ? `: ${melding}` : ''}`
}

export function lagClinpgxApi({
  hent = fetch,
  base = CLINPGX_API,
  avstand = MINSTE_AVSTAND_MS,
  vent = standardVent,
  na = Date.now,
}: Apivalg = {}): ClinpgxApi {
  let ko: Promise<unknown> = Promise.resolve()
  let forrigeStart = -Infinity

  /** Ett kall om gangen, med avstanden ClinPGx ber om mellom hvert. */
  function iKo<T>(arbeid: () => Promise<T>): Promise<T> {
    const neste = ko.then(async () => {
      const ventetid = forrigeStart + avstand - na()
      if (ventetid > 0) await vent(ventetid)
      forrigeStart = na()
      return arbeid()
    })
    ko = neste.catch(() => undefined)
    return neste
  }

  async function kall(sti: string, parametre: Record<string, string>): Promise<{ status: number; svar: Jsend | null }> {
    const url = new URL(`${base}${sti}`)
    for (const [n, v] of Object.entries(parametre)) url.searchParams.set(n, v)
    for (let forsok = 0; ; forsok += 1) {
      const res = await iKo(() =>
        hent(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIDSGRENSE_MS) }),
      )
      let svar: Jsend | null = null
      try {
        svar = (await res.json()) as Jsend
      } catch {
        svar = null
      }
      const kanProvesIgjen = res.status === 429 || res.status >= 500
      if (kanProvesIgjen && forsok < NYE_FORSOK) {
        const sekunder = Number(res.headers.get('retry-after'))
        await vent(Number.isFinite(sekunder) && sekunder > 0 ? Math.min(sekunder, 30) * 1000 : 5000 * (forsok + 1))
        continue
      }
      return { status: res.status, svar }
    }
  }

  return {
    liste: async (sti, parametre) => {
      const { status, svar } = await kall(sti, parametre)
      if (svar && status === 200 && svar.status === 'success') {
        if (Array.isArray(svar.data)) return svar.data
        throw new ClinpgxFeil(`ClinPGx ga ikke en liste for ${sti}.`, status)
      }
      if (svar && ingenTreff(svar)) return []
      throw new ClinpgxFeil(feilmelding(svar, status), status)
    },
    ett: async (sti, parametre = {}) => {
      const { status, svar } = await kall(sti, parametre)
      if (svar && status === 200 && svar.status === 'success') {
        const data = Array.isArray(svar.data) ? svar.data[0] : svar.data
        return data ?? null
      }
      if (svar && ingenTreff(svar)) return null
      throw new ClinpgxFeil(feilmelding(svar, status), status)
    },
  }
}
