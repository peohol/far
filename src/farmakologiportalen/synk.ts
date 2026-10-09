/**
 * Synkroniseringen av Farmakologiportalen til OUSFARs egen kopi
 * (`docs/farmakologiportalen.md`). Kjøres på serveren, aldri i nettleseren:
 * hver natt fra GitHub Actions, og når en administrator ber om det.
 *
 * Én kjøring:
 *
 * 1. registrerer at en synkronisering er startet;
 * 2. henter alle seks listene fra portalen (`api.ts`), én om gangen. Feiler
 *    ett kall, avbrytes kjøringen før noe er lastet inn;
 * 3. kontrollerer formen: mangler feltene lesingen bygger på, i mange rader,
 *    har portalen endret formatet, og kjøringen avbrytes;
 * 4. leser radene (`modell.ts`) og regner ut en kontrollsum per type. Er den
 *    den samme som ved forrige bytte, med samme parser, lastes typen ikke inn
 *    igjen; ellers lastes radene inn i mellomlageret i porsjoner;
 * 5. lager rapporten til «Datakilder»: koblinger som ikke stemmer lenger,
 *    molekylvekter som er ulike i portalen og PubChem, prøvematerialer og
 *    enheter OUSFAR ikke kjenner;
 * 6. ber databasen bytte inn uttrekket: alt i én transaksjon, bare om hver
 *    type ser fullstendig ut.
 *
 * Går noe galt, merkes kjøringen som feilet, og det som lå i databasen fra
 * før, står urørt. Ingen kjøring endrer koblingene i `src/data/forbindelser.ts`.
 */
import { createHash } from 'node:crypto'
import { FORBINDELSER, type Forbindelsesregister } from '../kjemi/forbindelser.js'
import { lesKonsentrasjonsenhet } from '../enheter/konsentrasjon.js'
import type { FpApi } from './api.js'
import { MOLVEKT_TOLERANSE } from './kurering.js'
import type { Entitetsinnhold, Fplager, Innlastingsrad, Opptelling, Synkrapport } from './lager.js'
import { ENTITETER, PARSERVERSJON, REDAKTORFELT, type Analysedata, type Entitet, type Entitetnavn, type Komponentdata } from './modell.js'

export type Fpsynkresultat =
  | { status: 'fullfort' | 'uendret'; synk: number; antall: Opptelling }
  | { status: 'feilet'; synk: number; feil: string }

export interface Fpsynkvalg {
  lager: Fplager
  api: FpApi
  utlostAv?: 'cron' | 'manuell'
  /** Rader per innlasting. */
  porsjon?: number
  register?: Forbindelsesregister
}

/** Hvor stor andel av radene som kan mangle et felt lesingen bygger på, før formatet regnes som endret. */
export const STRUKTURGRENSE = 0.05

/** Feltene lesingen bygger på, som mangler i for mange rader. Tom når formen er som ventet. */
export function strukturavvik(entitet: Entitet, radene: readonly unknown[]): string[] {
  if (radene.length === 0) return ['listen er tom']
  const objekter = radene.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null && !Array.isArray(r))
  if (objekter.length < radene.length * (1 - STRUKTURGRENSE)) return ['radene er ikke objekter']
  return entitet.kreves.filter((felt) => objekter.filter((r) => !(felt in r)).length > objekter.length * STRUKTURGRENSE)
}

/** Raden slik den lagres som rådata: uten bildene og uten hvem i redaksjonen som endret den. */
export function raadata(entitet: Entitet, rad: Record<string, unknown>): Record<string, unknown> {
  const uten = new Set<string>([...REDAKTORFELT, ...(entitet.utenRaa ?? [])])
  return Object.fromEntries(Object.entries(rad).filter(([k]) => !uten.has(k)))
}

/** Radene i en liste, lest, uten dubletter og sortert på ID. */
export function lesListe(
  entitet: Entitet,
  radene: readonly unknown[],
  enheter: ReadonlyMap<string, string>,
): { rader: Innlastingsrad[]; forkastet: number } {
  const etterId = new Map<string, Innlastingsrad>()
  let forkastet = 0
  for (const raa of radene) {
    const rad = typeof raa === 'object' && raa !== null && !Array.isArray(raa) ? (raa as Record<string, unknown>) : null
    const lest = rad ? entitet.les(rad, { enheter }) : null
    if (!rad || !lest || etterId.has(lest.id)) {
      forkastet += 1
      continue
    }
    etterId.set(lest.id, { id: lest.id, data: lest.data, raa: raadata(entitet, rad) })
  }
  const rader = [...etterId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { rader, forkastet }
}

/** Kontrollsummen for en types rader: endres den, må typen byttes inn på nytt. */
export function kontrollsum(rader: readonly Innlastingsrad[]): string {
  const hash = createHash('sha256')
  for (const r of rader) hash.update(`${JSON.stringify([r.id, r.data, r.raa ?? null])}\n`)
  return hash.digest('hex')
}

const mw = (v: number) => v.toLocaleString('nb-NO', { maximumFractionDigits: 3 })

function opptelt(verdier: readonly string[]): string {
  const antall = new Map<string, number>()
  for (const v of verdier) antall.set(v, (antall.get(v) ?? 0) + 1)
  return [...antall].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nb')).map(([v, n]) => `«${v}» (${n})`).join(', ')
}

/**
 * Det kjøringen fant som noen bør vurdere. Koblingene sammenlignes med det
 * portalen har nå; molekylvektene med PubChem-kopien. Prøvematerialer og
 * enheter telles bare for analysene fagsidene viser (de koblede
 * komponentene og gruppene som dekker dem).
 */
export function lagRapport(
  komponenter: ReadonlyMap<string, Komponentdata>,
  analyser: readonly Analysedata[],
  register: Forbindelsesregister,
  molvekter: ReadonlyMap<number, number>,
): Synkrapport {
  const merknader: string[] = []
  const koblede = new Set<string>()
  const usikre: string[] = []
  for (const f of register.alle) {
    const fp = f.farmakologiportalen
    const id = register.fpId(f)
    if (!fp || fp.status === 'uavklart' || !id) continue
    koblede.add(id)
    if (fp.status === 'usikker') usikre.push(f.navn)
    const k = komponenter.get(id)
    if (!k) {
      merknader.push(`«${f.navn}» er koblet til komponent ${id}, som ikke finnes i portalen lenger.`)
      continue
    }
    if (k.navn !== fp.navn) {
      merknader.push(`Komponent ${id} heter nå «${k.navn}» i portalen, men ble koblet til «${f.navn}» som «${fp.navn}». Kontroller koblingen.`)
    }
    const pubchem = f.pubchem ? molvekter.get(f.pubchem.cid) : undefined
    if (k.molvekt.verdi !== null && pubchem !== undefined && Math.abs(k.molvekt.verdi - pubchem) > MOLVEKT_TOLERANSE) {
      merknader.push(
        `Molekylvekten for «${f.navn}» er ${mw(k.molvekt.verdi)} g/mol i portalen og ${mw(pubchem)} g/mol i PubChem. Omregningen bruker PubChems.`,
      )
    }
  }
  if (usikre.length > 0) {
    merknader.push(`Koblet bare på navnet, uten treff på CAS-nummer eller molekylvekt: ${usikre.join(', ')}.`)
  }

  for (const [id, k] of komponenter) if (k.gruppe.some((g) => koblede.has(g))) koblede.add(id)
  const viste = analyser.filter((a) => koblede.has(a.komponent_id))
  const ukjenteMaterialer = viste.filter((a) => a.provemateriale.original && !a.provemateriale.matrise).map((a) => a.provemateriale.original!)
  if (ukjenteMaterialer.length > 0) {
    merknader.push(`Prøvematerialer OUSFAR ikke kjenner, vist med navnet portalen bruker: ${opptelt(ukjenteMaterialer)}.`)
  }
  const ukjenteEnheter = viste
    .map((a) => a.maleomrade.enhet.original)
    .filter((e): e is string => Boolean(e) && !lesKonsentrasjonsenhet(e))
  if (ukjenteEnheter.length > 0) {
    merknader.push(`Måleområder i enheter som ikke regnes om: ${opptelt(ukjenteEnheter)}.`)
  }

  const uavklarte = register.alle.filter((f) => !register.fpId(f)).map((f) => f.nokkel)
  return { uavklarte, merknader }
}

export async function synkroniserFarmakologiportalen({
  lager,
  api,
  utlostAv = 'cron',
  porsjon = 1000,
  register = FORBINDELSER,
}: Fpsynkvalg): Promise<Fpsynkresultat> {
  const forrige = await lager.forrige()
  const synk = await lager.start(utlostAv)
  try {
    const lister = new Map<Entitetnavn, unknown[]>()
    for (const entitet of ENTITETER) lister.set(entitet.navn, await api.liste(entitet.sti))

    const avvik = ENTITETER.flatMap((e) => strukturavvik(e, lister.get(e.navn)!).map((felt) => `${e.sti}: ${felt}`))
    if (avvik.length > 0) {
      throw new Error(`Formatet i Farmakologiportalen ser endret ut (mangler i mange rader: ${avvik.join('; ')}). Ingenting er byttet inn.`)
    }

    // Enhetene først: et måleområde kan oppgi enheten med ID-en.
    const enheter = new Map<string, string>()
    const lest = new Map<Entitetnavn, { rader: Innlastingsrad[]; forkastet: number }>()
    for (const entitet of ENTITETER) {
      const resultat = lesListe(entitet, lister.get(entitet.navn)!, enheter)
      lest.set(entitet.navn, resultat)
      if (entitet.navn === 'enhet') for (const r of resultat.rader) enheter.set(r.id, (r.data as { navn: string }).navn)
    }

    const entiteter = {} as Record<Entitetnavn, Entitetsinnhold>
    for (const entitet of ENTITETER) {
      const { rader, forkastet } = lest.get(entitet.navn)!
      const sha256 = kontrollsum(rader)
      const uendret = forrige.entiteter[entitet.navn] === sha256 && forrige.parserversjoner[entitet.navn] === PARSERVERSJON
      if (!uendret) {
        for (let i = 0; i < rader.length; i += porsjon) await lager.lastInn(synk, entitet.navn, rader.slice(i, i + porsjon))
      }
      entiteter[entitet.navn] = { antall: rader.length, sha256, lastet: !uendret, forkastet }
    }

    const komponenter = new Map(lest.get('komponent')!.rader.map((r) => [r.id, r.data as Komponentdata]))
    const analyser = lest.get('analyse')!.rader.map((r) => r.data as Analysedata)
    const molvekter = await lager.molvekter(register.medPubchem().map((f) => f.pubchem.cid))
    const rapport = lagRapport(komponenter, analyser, register, molvekter)

    const { status, antall } = await lager.fullfor(synk, { parserversjon: PARSERVERSJON, entiteter, rapport })
    return { status, synk, antall }
  } catch (e) {
    const feil = e instanceof Error ? e.message : String(e)
    await lager.avbryt(synk, feil)
    return { status: 'feilet', synk, feil }
  }
}
