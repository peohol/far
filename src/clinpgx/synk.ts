/**
 * Synkroniseringen av farmakogenetiske data fra ClinPGx til OUSFARs egen
 * kopi. Kjøres på serveren, aldri i nettleseren: hver uke av Vercel, og når en
 * administrator ber om det.
 *
 * Én kjøring:
 *
 * 1. registrerer at en synkronisering er startet;
 * 2. finner kjemikaliene stoffsidene er koblet til — de som aldri er hentet
 *    først, så de som ble hentet for lengst siden;
 * 3. henter for hvert kjemikalie selve kjemikaliet, retningslinjene,
 *    preparatomtalene og de kliniske annotasjonene, ett kall om gangen innenfor
 *    grensen ClinPGx har satt (`api.ts`);
 * 4. leser svarene (`modell.ts`) og ber databasen bytte inn alt for
 *    kjemikaliet i én transaksjon.
 *
 * Feiler ett kjemikalie — et kall som feiler, et objekt i svaret som ikke kan
 * leses, eller et svar databasen avviser — noteres feilen på det, og det som lå
 * der fra før, står. De andre hentes som vanlig. Et objekt som ikke kan leses,
 * tyder på at svaret har endret form; da er det tryggere å beholde det gamle
 * enn å bytte inn et svar der noe mangler.
 * Blir tiden knapp, stopper jobben før neste kjemikalie; resten hentes neste
 * gang, først i køen.
 */
import type { ClinpgxApi } from './api.js'
import { ClinpgxFeil } from './api.js'
import type { Clinpgxlager, KobletKjemikalie, Lagringsannotasjon, Synkresultattelling } from './lager.js'
import {
  lesKjemikaliesvar,
  lesKliniskSvar,
  lesPreparatomtalesvar,
  lesRetningslinjesvar,
  PARSERVERSJON,
  type Annotasjonstype,
} from './modell.js'

/** Hvor lenge en kjøring kan holde på. Vercel stopper funksjonen etter 300 sekunder. */
export const TIDSBUDSJETT_MS = 240_000

/** Tiden ett kjemikalie trenger: fire kall med pausene ClinPGx ber om, og litt til. */
const TID_PER_KJEMIKALIE_MS = 15_000

export type Synkresultat =
  | ({ status: 'fullfort' | 'delvis'; synk: number } & Synkresultattelling)
  | { status: 'feilet'; synk: number; feil: string }

export interface Synkvalg {
  lager: Clinpgxlager
  api: ClinpgxApi
  utlostAv?: 'cron' | 'manuell'
  /** Bare disse kjemikaliene, av dem som er koblet. Uten: alle. */
  bare?: readonly string[]
  tidsbudsjett?: number
  na?: () => number
}

interface Hentet {
  kjemikalie: { id: string; data: object; raa: unknown }
  annotasjoner: Lagringsannotasjon[]
  forkastet: number
}

/** Endepunktene annotasjonene hentes fra, og hvordan hvert objekt leses. */
const KILDER: readonly { type: Annotasjonstype; sti: string; les: (o: unknown) => { id: string } | null }[] = [
  { type: 'retningslinje', sti: '/data/guidelineAnnotation', les: lesRetningslinjesvar },
  { type: 'preparatomtale', sti: '/data/label', les: lesPreparatomtalesvar },
  { type: 'klinisk', sti: '/data/summaryAnnotation', les: lesKliniskSvar },
]

/** Kjemikaliet finnes ikke i ClinPGx. */
class FinnesIkke extends Error {}

/** Alt ClinPGx har for ett kjemikalie, lest. Kaster ved feil. */
export async function hentKjemikalie(api: ClinpgxApi, id: string): Promise<Hentet> {
  const raaKjemikalie = await api.ett(`/data/chemical/${encodeURIComponent(id)}`, { view: 'max' })
  if (raaKjemikalie === null) throw new FinnesIkke(`ClinPGx har ikke kjemikaliet ${id}.`)
  const kjemikalie = lesKjemikaliesvar(raaKjemikalie)
  if (!kjemikalie || kjemikalie.id !== id) throw new ClinpgxFeil(`ClinPGx ga et kjemikalie som ikke kunne leses for ${id}.`)

  const annotasjoner: Lagringsannotasjon[] = []
  let forkastet = 0
  for (const { type, sti, les } of KILDER) {
    for (const raa of await api.liste(sti, { 'relatedChemicals.accessionId': id, view: 'base' })) {
      const data = les(raa)
      if (data) annotasjoner.push({ type, id: data.id, data, raa })
      else forkastet += 1
    }
  }
  return { kjemikalie: { id, data: kjemikalie, raa: raaKjemikalie }, annotasjoner, forkastet }
}

export async function synkroniserClinpgx({
  lager,
  api,
  utlostAv = 'cron',
  bare,
  tidsbudsjett = TIDSBUDSJETT_MS,
  na = Date.now,
}: Synkvalg): Promise<Synkresultat> {
  const start = na()
  const synk = await lager.start(utlostAv)
  try {
    const alle = await lager.koblede()
    const kjemikalier: KobletKjemikalie[] = bare ? alle.filter((k) => bare.includes(k.id)) : alle
    const telling: Synkresultattelling = {
      kjemikalier: kjemikalier.length,
      hentet: 0,
      feilet: 0,
      utsatt: 0,
      annotasjoner: {},
      forkastet: 0,
    }
    const feil: string[] = []

    for (const [i, { id }] of kjemikalier.entries()) {
      if (na() - start + TID_PER_KJEMIKALIE_MS > tidsbudsjett) {
        telling.utsatt = kjemikalier.length - i
        break
      }
      try {
        const hentet = await hentKjemikalie(api, id)
        telling.forkastet += hentet.forkastet
        if (hentet.forkastet > 0) {
          throw new ClinpgxFeil(
            `${hentet.forkastet} ${hentet.forkastet === 1 ? 'objekt' : 'objekter'} i svaret kunne ikke leses. Dataene fra før står.`,
          )
        }
        const lagret = await lager.lagre(synk, hentet.kjemikalie, hentet.annotasjoner)
        telling.hentet += 1
        for (const [type, antall] of Object.entries(lagret) as [Annotasjonstype, number][]) {
          telling.annotasjoner[type] = (telling.annotasjoner[type] ?? 0) + antall
        }
      } catch (e) {
        const melding = e instanceof Error ? e.message : String(e)
        telling.feilet += 1
        feil.push(`${id}: ${melding}`)
        await lager.feilet(synk, id, melding, !(e instanceof FinnesIkke))
      }
    }

    const resultat = { ...telling, ...(feil.length > 0 && { feil: feil.join('\n') }) }
    const status = await lager.fullfor(synk, resultat, PARSERVERSJON)
    return { status, synk, ...resultat }
  } catch (e) {
    const feil = e instanceof Error ? e.message : String(e)
    await lager.avbryt(synk, feil)
    return { status: 'feilet', synk, feil }
  }
}
