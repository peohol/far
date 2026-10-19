/**
 * Kurateringsgrenene sett fra en agent som kaller OUSFAR over HTTP
 * (`/api/kuratering`, `docs/kurateringsgrener.md`): Claude-kuratoren bruker
 * den gjennom `npm run kurator`, Claude-kontrolløren gjennom
 * `npm run kontrollor`. Nøkkelen sendes bare i overskriften og skrives aldri ut.
 */

type Hent = (adresse: string, valg?: RequestInit) => Promise<Response>

export const STANDARDADRESSE = 'https://ousfar.vercel.app'

/**
 * Rollene en Claude-økt i kurateringsprosjektet har (`docs/kuratering-prosjekt.md`):
 * agenten i OUSFAR, og fila i prosjektets delte mappe der nøkkelen ligger,
 * aldri i repoet. Hver rolle har sin egen nøkkel, så den ene tråden aldri kan
 * opptre som den andre.
 */
export const ROLLER = {
  kurator: { navn: 'kuratoren', agent: 'claude-monografkurator', nokkelfil: '/mnt/project-files/.hemmelig/kurator.nokkel' },
  kontrollor: { navn: 'kontrolløren', agent: 'claude-monografikontrollor', nokkelfil: '/mnt/project-files/.hemmelig/kontrollor.nokkel' },
} as const

export type Rolle = keyof typeof ROLLER

export function lesRolle(verdi: string | undefined): Rolle {
  if (verdi && Object.hasOwn(ROLLER, verdi)) return verdi as Rolle
  throw new Error(`Ukjent rolle «${verdi ?? ''}». Bruk ${Object.keys(ROLLER).join(' eller ')}.`)
}

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
