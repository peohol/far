/**
 * Monografkurateringene slik produksjonen kjørte dem: hele migrasjonskjeden,
 * én gang og i rekkefølge, med kuratoren på plass fra den første importen.
 * `kurateringskjeden.test.ts` bygger den én gang for alle stoffene og kjører de
 * felles kontrollene; det stoffspesifikke står i `kurateringskjeden/<stoff>.ts`
 * (`docs/monografkuratering.md`).
 */
import type { PGlite } from '@electric-sql/pglite'
import { type KjortKuratering, kjorMigrasjoner, nyDatabase, opprettBruker } from './testdatabase'

/** Den første importen. Herfra har databasen kuratoren, slik produksjonen hadde. */
export const KURATORENS_START = '20260923072247'

/**
 * Databasen med kuratoren og migrasjonene, kurateringene medregnet, kjørt én
 * gang i rekkefølge — alle, eller bare dem før `til`. Gir også kuratorens
 * bruker-ID og kurateringene som ble kjørt, med revisjonene hver la til.
 */
export async function kuratertDatabase(
  { til }: { til?: string } = {},
): Promise<{ db: PGlite; kurator: string; kjort: KjortKuratering[] }> {
  const db = await nyDatabase({ til: KURATORENS_START })
  const kurator = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  const kjort = await kjorMigrasjoner(db, { fra: KURATORENS_START, til, kurateringer: true })
  return { db, kurator, kjort }
}

/** Et publisert element på en stoffside, med referansene og revisjonene. */
export interface Element {
  objekt_id: string
  panel: string
  elementtype: string
  data: Record<string, unknown>
  referanser: string[]
  kilde: string | null
  utkast: number
  publisert: number
}

/** De publiserte elementene på stoffsiden, i ett panel eller alle, i rekkefølge. */
export async function elementer(db: PGlite, stoff: string, panel?: string): Promise<Element[]> {
  const { rows } = await db.query<Element>(
    `select e.objekt_id, e.panel, e.elementtype, e.data,
       coalesce(r.innhold->'referanser', '[]'::jsonb) as referanser, r.kilde,
       u.revisjon as utkast, p.revisjon as publisert
     from public.innholdselementer e
     join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert' and s.slug = $1
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and ($2::text is null or e.panel = $2)
     order by e.panel, e.posisjon, e.objekt_id`,
    [stoff, panel ?? null],
  )
  return rows
}

/** Dataene som tekst, for å lete etter formuleringer. */
export const tekst = (data: Record<string, unknown>): string => JSON.stringify(data)

/** Referansene teksten siterer inline (`sitering`-noder). */
export function inlineReferanser(verdi: unknown): string[] {
  if (Array.isArray(verdi)) return verdi.flatMap(inlineReferanser)
  if (!verdi || typeof verdi !== 'object') return []
  const node = verdi as Record<string, unknown>
  if (node.type === 'sitering') {
    const attrs = node.attrs
    if (!attrs || typeof attrs !== 'object') return []
    const referanser = (attrs as Record<string, unknown>).referanser
    return Array.isArray(referanser) ? referanser.filter((id): id is string => typeof id === 'string') : []
  }
  return Object.values(node).flatMap(inlineReferanser)
}

/**
 * Det stoffspesifikke i `kurateringskjeden/<stoff>.ts`: en standardeksport som
 * registrerer testene av sluttresultatet, med databasen etter hele kjeden.
 */
export type Stoffvalidering = (db: () => PGlite) => void
