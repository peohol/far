/**
 * Nøklene til Claude-agentene i kurateringsprosjektet (`npm run kurator --
 * nye-nokler`, `docs/kuratering-prosjekt.md`). En nøkkel lages i prosjektets
 * delte mappe og overskrives aldri; i repoet står bare SHA-256 av den, i en
 * migrasjon som setter den på agenten.
 */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Samme form som nøklene OUSFAR lager selv (`ny_agentnokkel`). */
const NOKKEL = /^far_[0-9a-f]{64}$/

export const lagNokkel = () => `far_${randomBytes(32).toString('hex')}`

export const nokkelSha256 = (nokkel: string) => createHash('sha256').update(nokkel, 'utf8').digest('hex')

export interface Agentnokkel {
  agent: string
  nokkelfil: string
  sha256: string
  /** Lagd nå; ellers fantes fila fra før. */
  ny: boolean
}

/** Nøkkelen til hver agent: den som står i fila, eller en ny i en ny fil som bare eieren kan lese. */
export function sikreNokler(agenter: readonly { agent: string; nokkelfil: string }[]): Agentnokkel[] {
  return agenter.map(({ agent, nokkelfil }) => {
    const ny = !existsSync(nokkelfil)
    if (ny) {
      mkdirSync(dirname(nokkelfil), { recursive: true, mode: 0o700 })
      writeFileSync(nokkelfil, `${lagNokkel()}\n`, { mode: 0o600, flag: 'wx' })
    }
    const nokkel = readFileSync(nokkelfil, 'utf8').trim()
    if (!NOKKEL.test(nokkel)) throw new Error(`${nokkelfil} har ikke en gyldig nøkkel. Fila overskrives ikke; flytt den bort og prøv igjen.`)
    return { agent, nokkelfil, sha256: nokkelSha256(nokkel), ny }
  })
}

/** Versjonen en ny migrasjon får: tidspunktet i UTC med 14 sifre (`supabase/CLAUDE.md`). */
export const migrasjonsversjon = (tid: Date) => tid.toISOString().replace(/\D/g, '').slice(0, 14)

/** Migrasjonen som setter nøklene på agentene. Den forrige nøkkelen til hver agent slutter å virke. */
export function nokkelmigrasjon(nokler: readonly Pick<Agentnokkel, 'agent' | 'sha256'>[]): string {
  const setninger = nokler.map(({ agent, sha256 }) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(agent) || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`Ugyldig agent eller kontrollsum for «${agent}».`)
    return [
      `  update kuratering.agenter set nokkel_sha256 = '${sha256}', nokkel_kl = now(), aktiv = true where agent = '${agent}';`,
      `  if not found then raise exception 'Fant ikke agenten ${agent}.'; end if;`,
    ].join('\n')
  })
  return [
    '-- Nøklene til Claude-agentene i kurateringsprosjektet (docs/kuratering-prosjekt.md),',
    '-- laget med `npm run kurator -- nye-nokler`. Bare SHA-256 av nøklene står her;',
    '-- selve nøklene ligger i prosjektets delte mappe. Den forrige nøkkelen til',
    '-- hver agent slutter å virke.',
    '',
    'do $nokler$',
    'begin',
    ...setninger,
    'end',
    '$nokler$;',
    '',
  ].join('\n')
}
