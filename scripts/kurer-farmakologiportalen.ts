/**
 * Kobler forbindelsene i `src/data/forbindelser.ts` til komponentene i
 * Farmakologiportalen, eller kontrollerer koblingene på nytt
 * (`docs/farmakologiportalen.md`).
 *
 *   npx vite-node scripts/kurer-farmakologiportalen.ts -- --komponenter <fil> [--alle] [--skriv] [nøkkel …]
 *
 * `--komponenter` er komponentlisten fra portalen som JSON: enten slik
 * `/api/components` gir den, eller OUSFARs kopi
 * (`select jsonb_agg(raa) from farmakologiportalen.komponent where utgatt_kl is null`).
 * Portalen svarer bare OUSFARs server, så skriptet henter den ikke selv.
 *
 * Uten `--alle` gjelder det bare forbindelsene som ikke er koblet ennå, eller
 * som bare er koblet på navnet (usikre). Hver
 * forbindelse kontrolleres mot PubChem (`src/farmakologiportalen/kurering.ts`).
 * Med `--skriv` lagres resultatet i datafilen. En verifisert kobling som
 * står, endres aldri; avviker kontrollen fra den, skrives avviket ut.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { FORBINDELSESDATA } from '../src/data/forbindelser'
import { casnumre, CAS, kurerFp, type Casoppslag, type Fpkomponent, type Fpkontroll } from '../src/farmakologiportalen/kurering'
import { entitet } from '../src/farmakologiportalen/modell'
import type { Forbindelse } from '../src/kjemi/forbindelser'
import { BRUKERAGENT, lagPubchemApi, lesPubchemrad, PUBCHEM_API } from '../src/kjemi/pubchem'
import { lagHofligHenting } from '../src/server/hofligHenting'

const FIL = 'src/data/forbindelser.ts'
const argumenter = process.argv.slice(2).filter((a) => a !== '--')
const verdi = (navn: string) => argumenter[argumenter.indexOf(navn) + 1]
const komponentfil = verdi('--komponenter')
if (!komponentfil) throw new Error('Oppgi komponentlisten med --komponenter <fil>.')
const alle = argumenter.includes('--alle')
const skriv = argumenter.includes('--skriv')
const bare = new Set(argumenter.filter((a, i) => !a.startsWith('--') && argumenter[i - 1] !== '--komponenter'))

const leser = entitet('komponent')
const komponenter: Fpkomponent[] = (JSON.parse(readFileSync(komponentfil, 'utf8')) as Record<string, unknown>[])
  .map((rad) => leser.les(rad, { enheter: new Map() }))
  .filter((k): k is NonNullable<typeof k> => k !== null)
  .map((k) => ({ id: k.id, data: k.data as Fpkomponent['data'] }))
console.log(`${komponenter.length} komponenter fra Farmakologiportalen.`)

const pubchem = lagPubchemApi()
const hent = lagHofligHenting({ avstand: 250, hoder: { accept: 'application/json', 'user-agent': BRUKERAGENT } })

/** Det PubChem har under CAS-numrene en komponent i portalen oppgir. */
async function slaOppCas(cas: readonly string[]): Promise<Casoppslag[]> {
  const funnet: Casoppslag[] = []
  for (const nummer of cas) {
    const res = await hent(`${PUBCHEM_API}/compound/name/${encodeURIComponent(nummer)}/property/InChIKey,MolecularFormula,Title/JSON`)
    if (!res.ok) continue
    const svar = (await res.json()) as { PropertyTable?: { Properties?: { CID: number; InChIKey?: string; MolecularFormula?: string; Title?: string }[] } }
    for (const p of svar.PropertyTable?.Properties ?? []) {
      if (p.InChIKey && p.MolecularFormula) {
        funnet.push({ cas: nummer, cid: p.CID, inchikey: p.InChIKey, formel: p.MolecularFormula, tittel: p.Title ?? `CID ${p.CID}` })
      }
    }
  }
  return funnet
}

async function casFor(cid: number): Promise<Set<string>> {
  const res = await hent(`${PUBCHEM_API}/compound/cid/${cid}/synonyms/JSON`)
  if (!res.ok) return new Set()
  const svar = (await res.json()) as { InformationList?: { Information?: { Synonym?: string[] }[] } }
  return new Set((svar.InformationList?.Information?.[0]?.Synonym ?? []).filter((s) => CAS.test(s)))
}

const fil = { forbindelser: structuredClone(FORBINDELSESDATA) as Forbindelse[] }
const idag = new Date().toISOString().slice(0, 10)
const valgte = fil.forbindelser.filter(
  (f) => (bare.size === 0 || bare.has(f.nokkel)) && (alle || !f.farmakologiportalen || f.farmakologiportalen.status !== 'verifisert'),
)
const egenskaper = new Map<number, number>()
const cider = valgte.flatMap((f) => (f.pubchem ? [f.pubchem.cid] : []))
for (let i = 0; i < cider.length; i += 100) {
  for (const rad of await pubchem.egenskaper(cider.slice(i, i + 100))) {
    const lest = lesPubchemrad(rad)
    if ('data' in lest) egenskaper.set(lest.data.cid, Number(lest.data.molvekt))
  }
}

const telling = { verifisert: 0, usikker: 0, uavklart: 0, avvik: 0 }
for (const f of valgte) {
  const cid = f.pubchem?.cid ?? null
  const kontroll: Fpkontroll = {
    cid,
    molvekt: cid ? (egenskaper.get(cid) ?? null) : null,
    cas: cid ? await casFor(cid) : new Set(),
    inchikey: f.pubchem?.inchikey ?? null,
    formel: f.pubchem?.formel ?? null,
  }
  let resultat = kurerFp(f, komponenter, kontroll, idag)
  // Bare navnet: se hva PubChem har under CAS-nummeret portalen oppgir.
  if (resultat.status === 'usikker' && cid) {
    const k = komponenter.find((x) => x.id === (resultat as { id: string }).id)
    const cas = casnumre(k?.data.cas)
    if (cas.length > 0) resultat = kurerFp(f, komponenter, { ...kontroll, casoppslag: await slaOppCas(cas) }, idag)
  }
  const forrige = f.farmakologiportalen
  if (forrige?.status === 'verifisert' && (resultat.status !== 'verifisert' || resultat.id !== forrige.id)) {
    telling.avvik += 1
    console.log(`AVVIK  ${f.nokkel}: koblet til ${forrige.id}, kontrollen nå gir ${resultat.status} ${'id' in resultat ? resultat.id : ''}`)
    continue
  }
  telling[resultat.status] += 1
  const linje = resultat.status === 'uavklart' ? resultat.grunn : `${resultat.id} — ${resultat.grunnlag}`
  console.log(`${resultat.status.toUpperCase().padEnd(10)} ${f.nokkel}: ${linje}`)
  if (resultat.status !== 'uavklart') {
    const k = komponenter.find((x) => x.id === resultat.id)
    if (k && casnumre(k.data.cas).length > 1) console.log(`           (portalen har flere CAS-numre: ${k.data.cas})`)
  }
  if (skriv) f.farmakologiportalen = resultat
}

console.log(`\n${telling.verifisert} verifisert, ${telling.usikker} usikre, ${telling.uavklart} uavklart, ${telling.avvik} avvik fra koblingene som står.`)
if (skriv) {
  const tekst = readFileSync(FIL, 'utf8')
  const data = 'export const FORBINDELSESDATA: Forbindelse[] = '
  writeFileSync(FIL, `${tekst.slice(0, tekst.indexOf(data))}${data}${JSON.stringify(fil.forbindelser, null, 2)}\n`)
}
