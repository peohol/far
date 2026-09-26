/**
 * Synkroniseringen av CPIC-databasen til OUSFARs egen kopi. Kjøres på
 * serveren, aldri i nettleseren: hver uke av Vercel, og når en administrator
 * ber om det.
 *
 * Én kjøring:
 *
 * 1. registrerer at en synkronisering er startet;
 * 2. leser hvilken CPIC-database API-et serverer (skjemaversjon og release);
 * 3. henter hver tabell hel (`api.ts`), leser radene (`modell.ts`) og regner
 *    ut en kontrollsum for typen. Er den den samme som ved forrige bytte, med
 *    samme parser, lastes typen ikke inn igjen; ellers lastes radene inn i
 *    mellomlageret i porsjoner;
 * 4. ber databasen bytte inn uttrekket: alt i én transaksjon, bare om hver
 *    type ser fullstendig ut og uttrekket henger sammen.
 *
 * Går noe galt underveis, avbrytes kjøringen og merkes som feilet. Det som lå
 * i databasen fra før, står urørt, så sidene viser siste gyldige data.
 */
import { createHash } from 'node:crypto'
import type { CpicApi } from './api.js'
import type { Cpiclager, Entitetsinnhold, Innlastingsrad, Opptelling, Uttrekksinnhold } from './lager.js'
import { KILDETABELLER, PARSERVERSJON, type Entitet, type Entitetnavn } from './modell.js'

export type Synkresultat =
  | { status: 'fullfort' | 'uendret'; synk: number; release: string | null; antall: Opptelling }
  | { status: 'feilet'; synk: number; feil: string }

export interface Synkvalg {
  lager: Cpiclager
  api: CpicApi
  utlostAv?: 'cron' | 'manuell'
  /** Rader per innlasting. */
  porsjon?: number
  /** Typene som hentes; alle som standard. Byttes ut i testene. */
  tabeller?: readonly Entitet[]
}

const sha1 = (tekst: string) => createHash('sha1').update(tekst).digest('hex')

/** Radene i en tabell, lest, uten dubletter og sortert på ID. */
export function lesTabell(entitet: Entitet, radene: unknown[]): { rader: Innlastingsrad[]; forkastet: number } {
  const etterId = new Map<string, Innlastingsrad>()
  let forkastet = 0
  for (const raa of radene) {
    const lest = typeof raa === 'object' && raa !== null && !Array.isArray(raa)
      ? entitet.les(raa as Record<string, unknown>, sha1)
      : null
    if (!lest || etterId.has(lest.id)) {
      forkastet += 1
      continue
    }
    etterId.set(lest.id, { id: lest.id, versjon: lest.versjon, data: lest.data, ...(entitet.raa && { raa }) })
  }
  const rader = [...etterId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { rader, forkastet }
}

/** Kontrollsummen for en types rader: endres den, må typen byttes inn på nytt. */
export function kontrollsum(rader: readonly Innlastingsrad[]): string {
  const hash = createHash('sha256')
  for (const r of rader) hash.update(`${JSON.stringify([r.id, r.versjon, r.data, r.raa ?? null])}\n`)
  return hash.digest('hex')
}

export async function synkroniserCpic({
  lager,
  api,
  utlostAv = 'cron',
  porsjon = 5000,
  tabeller = KILDETABELLER,
}: Synkvalg): Promise<Synkresultat> {
  const forrige = await lager.forrige()
  const synk = await lager.start(utlostAv)
  try {
    const kilde = await api.kildeinfo()
    const entiteter = {} as Record<Entitetnavn, Entitetsinnhold>

    for (const entitet of tabeller) {
      const { rader, forkastet } = lesTabell(
        entitet,
        await api.tabell(entitet.tabell, { kolonner: entitet.kolonner, rekkefolge: entitet.rekkefolge }),
      )
      const sha256 = kontrollsum(rader)
      const uendret =
        forrige.entiteter[entitet.navn] === sha256 && forrige.parserversjoner[entitet.navn] === PARSERVERSJON
      if (!uendret) {
        for (let i = 0; i < rader.length; i += porsjon) {
          await lager.lastInn(synk, entitet.navn, rader.slice(i, i + porsjon))
        }
      }
      entiteter[entitet.navn] = { antall: rader.length, sha256, lastet: !uendret, forkastet }
    }

    const innhold: Uttrekksinnhold = { ...kilde, parserversjon: PARSERVERSJON, entiteter }
    const { status, antall } = await lager.fullfor(synk, innhold)
    return { status, synk, release: kilde.release, antall }
  } catch (e) {
    const feil = e instanceof Error ? e.message : String(e)
    await lager.avbryt(synk, feil)
    return { status: 'feilet', synk, feil }
  }
}
