/**
 * Henting fra en ekstern kilde på kildens premisser: ett kall om gangen, med
 * minst `avstand` millisekunder mellom starten på hvert, og en pause og et nytt
 * forsøk når kilden svarer 429 (for mange kall) eller har en serverfeil.
 * Pausen gjelder hele køen, ikke bare kallet som fikk svaret: ber kilden oss
 * vente, venter alle.
 *
 * Brukes av synkroniseringene som henter fra åpne kilder uten nøkkel
 * (ClinPGx, PubChem, Farmakologiportalen). Kjøres bare på serveren og i
 * skriptene; nettleseren snakker aldri med kildene.
 */

export interface Hoflighetsvalg {
  /** Minste tid mellom starten på to kall, i millisekunder. */
  avstand: number
  /** Nye forsøk etter 429 eller serverfeil. */
  nyeForsok?: number
  /** Hvor lenge ett kall kan ta. */
  tidsgrense?: number
  /** Hoder som sendes med hvert kall, f.eks. hvem som spør. */
  hoder?: Record<string, string>
  hent?: typeof fetch
  /** Venting, byttes ut i testene. */
  vent?: (ms: number) => Promise<void>
  /** Klokken, byttes ut i testene. */
  na?: () => number
}

/** Et kall gjennom køen. Gir svaret slik det kom etter de nye forsøkene. */
export type HofligHenting = (url: URL | string, init?: RequestInit) => Promise<Response>

export const standardVent = (ms: number) => new Promise<void>((ferdig) => setTimeout(ferdig, ms))

/** Hvor lenge kilden ber oss vente (`Retry-After` i sekunder), ellers stadig lenger. */
function pause(res: Response, forsok: number): number {
  const sekunder = Number(res.headers.get('retry-after'))
  return Number.isFinite(sekunder) && sekunder > 0 ? Math.min(sekunder, 30) * 1000 : 5000 * (forsok + 1)
}

export function lagHofligHenting({
  avstand,
  nyeForsok = 2,
  tidsgrense = 30_000,
  hoder = {},
  hent = fetch,
  vent = standardVent,
  na = Date.now,
}: Hoflighetsvalg): HofligHenting {
  let ko: Promise<unknown> = Promise.resolve()
  let forrigeStart = -Infinity
  /** Ingen kall starter før dette, etter at kilden ba oss vente. */
  let pauseTil = -Infinity

  function iKo<T>(arbeid: () => Promise<T>): Promise<T> {
    const neste = ko.then(async () => {
      const ventetid = Math.max(forrigeStart + avstand, pauseTil) - na()
      if (ventetid > 0) await vent(ventetid)
      forrigeStart = na()
      return arbeid()
    })
    ko = neste.catch(() => undefined)
    return neste
  }

  return async (url, init = {}) => {
    const headers = { ...hoder, ...(init.headers as Record<string, string> | undefined) }
    for (let forsok = 0; ; forsok += 1) {
      const res = await iKo(() => hent(url, { ...init, headers, signal: AbortSignal.timeout(tidsgrense) }))
      if ((res.status === 429 || res.status >= 500) && forsok < nyeForsok) {
        pauseTil = Math.max(pauseTil, na() + pause(res, forsok))
        await res.body?.cancel().catch(() => undefined)
        continue
      }
      return res
    }
  }
}
