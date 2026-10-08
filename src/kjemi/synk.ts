/**
 * Synkroniseringen av de kjemiske grunndataene fra PubChem til OUSFARs egen
 * kopi (`docs/kjemi.md`). Kjøres på serveren, aldri i nettleseren: hver uke av
 * Vercel, og når en administrator ber om det.
 *
 * Én kjøring:
 *
 * 1. registrerer at en synkronisering er startet;
 * 2. henter egenskapene for alle forbindelsene med verifisert kobling i
 *    `src/data/forbindelser.ts`, i så få kall som mulig;
 * 3. kontrollerer hver forbindelse: svaret må kunne leses (`lesPubchemrad`),
 *    og InChIKey og formelen må være de koblingen ble kontrollert mot;
 * 4. bytter inn alle som besto, noterer feilen på resten og avslutter kjøringen,
 *    alt i én transaksjon.
 *
 * En forbindelse som ikke består, byttes ikke inn, og det som lå der fra før,
 * står. Har PubChem endret identiteten (InChIKey eller formelen), er det en
 * konflikt som må vurderes av noen: koblingen endres bare i datafilen, i en PR.
 * Mangler mange forbindelser i svaret eller kan de ikke leses, tyder det på en
 * feil hos PubChem eller et endret format, og da byttes ingenting inn.
 */
import { FORBINDELSER, type Forbindelsesregister } from './forbindelser.js'
import type { Kjemilager, Kjemisynktelling, Lagringsforbindelse } from './lager.js'
import { lesPubchemrad, PARSERVERSJON, type PubchemApi } from './pubchem.js'

export type Kjemisynkresultat =
  | ({ status: 'fullfort' | 'delvis'; synk: number } & Kjemisynktelling)
  | { status: 'feilet'; synk: number; feil: string }

export interface Kjemisynkvalg {
  lager: Kjemilager
  api: PubchemApi
  utlostAv?: 'cron' | 'manuell'
  register?: Forbindelsesregister
}

/**
 * Hvor mange forbindelser som kan mangle i svaret eller ikke kunne leses før
 * hele svaret regnes som feil: to, eller en tidel når det er flere.
 */
export function maksBortfall(antall: number): number {
  return Math.max(2, Math.floor(antall / 10))
}

export async function synkroniserKjemi({
  lager,
  api,
  utlostAv = 'cron',
  register = FORBINDELSER,
}: Kjemisynkvalg): Promise<Kjemisynkresultat> {
  const synk = await lager.start(utlostAv)
  try {
    const koblede = register.medPubchem()
    const svar = new Map<number, unknown>()
    for (const rad of await api.egenskaper(koblede.map((f) => f.pubchem.cid))) {
      const cid = (rad as { CID?: unknown } | null)?.CID
      if (typeof cid === 'number') svar.set(cid, rad)
    }

    const ok: Lagringsforbindelse[] = []
    const feil: { cid: number; nokkel: string; feil: string; konflikt: boolean }[] = []
    for (const f of koblede) {
      const { cid, inchikey, formel } = f.pubchem
      const rad = svar.get(cid)
      const lest = rad === undefined ? { avvik: 'PubChem ga ikke forbindelsen i svaret' } : lesPubchemrad(rad)
      if ('avvik' in lest) {
        feil.push({ cid, nokkel: f.nokkel, feil: `${lest.avvik}. Dataene fra før står.`, konflikt: false })
      } else if (lest.data.inchikey !== inchikey || lest.data.formel !== formel) {
        const hva = lest.data.inchikey !== inchikey ? `InChIKey ${lest.data.inchikey}` : `formelen ${lest.data.formel}`
        const mot = lest.data.inchikey !== inchikey ? inchikey : formel
        feil.push({
          cid,
          nokkel: f.nokkel,
          feil: `PubChem oppgir nå ${hva}, men koblingen ble kontrollert mot ${mot}. Dataene fra før står til koblingen er vurdert på nytt.`,
          konflikt: true,
        })
      } else {
        ok.push({ cid, data: lest.data, raa: rad })
      }
    }

    const bortfall = feil.filter((f) => !f.konflikt).length
    if (koblede.length > 0 && bortfall > maksBortfall(koblede.length)) {
      throw new Error(
        `${bortfall} av ${koblede.length} forbindelser manglet i svaret fra PubChem eller kunne ikke leses. ` +
          'Det tyder på en feil hos PubChem eller et endret format, så ingenting er byttet inn.',
      )
    }

    const resultat = {
      forbindelser: koblede.length,
      feilet: feil.length,
      konflikter: feil.length - bortfall,
      strukturavvik: bortfall,
      uavklarte: register.alle.filter((f) => !f.pubchem).map((f) => f.nokkel),
      ...(feil.length > 0 && { feil: feil.map((f) => `${f.nokkel} (CID ${f.cid}): ${f.feil}`).join('\n') }),
    }
    const { status, hentet, endret } = await lager.fullfor(
      synk,
      { forbindelser: ok, feil: feil.map(({ cid, feil }) => ({ cid, feil })), resultat },
      PARSERVERSJON,
    )
    return { status, synk, ...resultat, hentet, endret }
  } catch (e) {
    const feil = e instanceof Error ? e.message : String(e)
    await lager.avbryt(synk, feil)
    return { status: 'feilet', synk, feil }
  }
}
