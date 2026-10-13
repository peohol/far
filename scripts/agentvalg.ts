/**
 * Valgene skriptene som lager migrasjoner med innhold, felles: hvilken agent
 * som står for endringen (`--agent <nøkkel>`) og PR-en eller commiten den hører
 * til (`--lenke <url>`, kan gjentas). Migrasjonen åpnes med erklæringen, så
 * endringen føres på agenten i endringsloggen for sidene
 * (`docs/innholdsendringer.md`).
 */
import { basename } from 'node:path'
import { medErklaring } from '../src/faginnhold/endringserklaering'
import { MIGRASJONSFILNAVN } from '../src/faginnhold/migrasjonshistorikk'

export interface Agentvalg {
  agent: string | undefined
  lenker: string[]
  /** Argumentene uten valgene over og uten `--`. */
  resten: string[]
}

export function lesAgentvalg(argv: readonly string[]): Agentvalg {
  const resten: string[] = []
  const lenker: string[] = []
  let agent: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--') continue
    if (a === '--agent') agent = argv[++i]
    else if (a === '--lenke') lenker.push(argv[++i] ?? '')
    else resten.push(a)
  }
  return { agent, lenker, resten }
}

export const AGENTBRUK = '--agent <nøkkel i endringsagenter> [--lenke <PR eller commit>]'

/**
 * Migrasjonen med erklæringen for fila den skrives til. Avslutter med en
 * forklaring når agenten mangler eller filnavnet ikke er et migrasjonsnavn.
 */
export function erklartMigrasjon(sql: string, fil: string, valg: Agentvalg, oppsummering: string): string {
  const migrasjon = basename(fil)
  if (!valg.agent) {
    console.error(`Oppgi agenten som står for endringen: ${AGENTBRUK}`)
    process.exit(1)
  }
  if (!MIGRASJONSFILNAVN.test(migrasjon)) {
    console.error(`«${migrasjon}» er ikke et migrasjonsnavn (<14 sifre>_<navn>.sql); erklæringen må ha filnavnet migrasjonen får.`)
    process.exit(1)
  }
  return medErklaring(sql, { agent: valg.agent, migrasjon, oppsummering, lenker: valg.lenker })
}
