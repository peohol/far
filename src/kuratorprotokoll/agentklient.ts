/**
 * Kurateringsgrenene sett fra en agent som kaller OUSFAR over HTTP
 * (`/api/kuratering`, `docs/kurateringsgrener.md`): Claude-kuratoren bruker
 * den gjennom `npm run kurator`. Nøkkelen sendes bare i overskriften og
 * skrives aldri ut.
 */

type Hent = (adresse: string, valg?: RequestInit) => Promise<Response>

export const STANDARDADRESSE = 'https://ousfar.vercel.app'
/** Der Claude-øktene i prosjektet har nøkkelen; aldri i repoet. */
export const STANDARD_NOKKELFIL = '/mnt/project-files/.hemmelig/claude-monografkurator.nokkel'

/** En feil fra OUSFAR, med koden databasen ga (`42501`, `22023`, `PT404`, `PT409`). */
export class Agentfeil extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kode: string | null,
  ) {
    super(message)
  }
}

export interface Agentklient {
  kall<T = unknown>(handling: string, data?: Record<string, unknown>): Promise<T>
}

export function lagAgentklient({ adresse = STANDARDADRESSE, nokkel, hent = fetch }: { adresse?: string; nokkel: string; hent?: Hent }): Agentklient {
  const url = `${adresse.replace(/\/+$/, '')}/api/kuratering`
  return {
    async kall<T>(handling: string, data: Record<string, unknown> = {}) {
      const svar = await hent(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${nokkel}` },
        body: JSON.stringify({ handling, data }),
      })
      const kropp = (await svar.json().catch(() => null)) as { feil?: string; kode?: string } | null
      if (!svar.ok) throw new Agentfeil(kropp?.feil ?? `OUSFAR svarte ${svar.status}.`, svar.status, kropp?.kode ?? null)
      return kropp as T
    },
  }
}

/** Argumentene til en handling: JSON på kommandolinjen, `@fil` med JSON, eller ingenting. */
export function lesArgumenter(arg: string | undefined, lesFil: (sti: string) => string): Record<string, unknown> {
  if (!arg) return {}
  const data = JSON.parse(arg.startsWith('@') ? lesFil(arg.slice(1)) : arg) as unknown
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('Argumentene må være et JSON-objekt.')
  return data as Record<string, unknown>
}
