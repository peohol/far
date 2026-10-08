/**
 * Kobler forbindelsene i `src/data/forbindelser.ts` til PubChem, eller
 * kontrollerer koblingene på nytt (`docs/kjemi.md`).
 *
 *   npx vite-node scripts/kurer-forbindelser.ts -- [--alle] [--skriv] [nøkkel …]
 *
 * Uten `--alle` gjelder det bare forbindelsene som ikke er koblet ennå. Hver
 * forbindelse slås opp i PubChem på det engelske navnet og kontrolleres mot
 * ClinPGx og ChEBI (`src/kjemi/kurering.ts`). Resultatet skrives ut; med
 * `--skriv` lagres det i datafilen — en verifisert kobling, eller grunnen til at
 * forbindelsen er uavklart. En kobling som finnes, endres aldri av skriptet:
 * avviker den fra det kontrollen finner nå, skrives avviket ut til vurdering.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { lagClinpgxApi } from '../src/clinpgx/api'
import { FORBINDELSESDATA } from '../src/data/forbindelser'
import type { Forbindelse } from '../src/kjemi/forbindelser'
import { kurerForbindelse, navnenokkel, type Uavhengig } from '../src/kjemi/kurering'
import { BRUKERAGENT, lagPubchemApi, lesPubchemrad } from '../src/kjemi/pubchem'
import { lagHofligHenting } from '../src/server/hofligHenting'

const FIL = 'src/data/forbindelser.ts'
const argumenter = process.argv.slice(2).filter((a) => a !== '--')
const alle = argumenter.includes('--alle')
const skriv = argumenter.includes('--skriv')
const bare = new Set(argumenter.filter((a) => !a.startsWith('--')))

const pubchem = lagPubchemApi()
const clinpgx = lagClinpgxApi()
const chebi = lagHofligHenting({ avstand: 300, hoder: { accept: 'application/json', 'user-agent': BRUKERAGENT } })

/** Forbindelsene CID-ene står for. Et salt byttes med moderforbindelsen PubChem oppgir, når den er entydig. */
async function forbindelserFor(cider: number[]): Promise<{ cid: number; inchikey: string; salt?: number }[]> {
  const ut: { cid: number; inchikey: string; salt?: number }[] = []
  for (const rad of cider.length ? await pubchem.egenskaper(cider) : []) {
    const lest = lesPubchemrad(rad)
    if (!('data' in lest)) continue
    if (lest.data.enheter === 1) {
      ut.push({ cid: lest.data.cid, inchikey: lest.data.inchikey })
      continue
    }
    const moder = await pubchem.moderforbindelser(lest.data.cid)
    if (moder.length !== 1) continue
    for (const m of await forbindelserFor(moder)) if (!m.salt) ut.push({ ...m, salt: lest.data.cid })
  }
  return ut
}

async function fraClinpgx(navn: string): Promise<Uavhengig[]> {
  const treff = (await clinpgx.liste('/data/chemical', { name: navn, view: 'max' })) as {
    id?: string
    linkOuts?: { resource?: string; resourceId?: string }[]
  }[]
  const ut: Uavhengig[] = []
  for (const t of treff) {
    if (!t.id) continue
    const cider = (t.linkOuts ?? []).filter((l) => l.resource === 'PubChem Compound').map((l) => Number(l.resourceId))
    for (const f of await forbindelserFor(cider)) ut.push({ kilde: 'ClinPGx', id: t.id, ...f })
  }
  return ut
}

async function fraChebi(navn: string): Promise<Uavhengig[]> {
  const res = await chebi(`https://www.ebi.ac.uk/chebi/backend/api/public/es_search/?term=${encodeURIComponent(navn)}&size=10`)
  if (!res.ok) return []
  const svar = (await res.json()) as { results?: { _source?: { chebi_accession?: string; name?: string; inchikey?: string } }[] }
  return (svar.results ?? [])
    .map((r) => r._source)
    .filter((s) => s?.name && s.inchikey && s.chebi_accession && navnenokkel(s.name) === navnenokkel(navn))
    .map((s) => ({ kilde: 'ChEBI' as const, id: s!.chebi_accession!, inchikey: s!.inchikey! }))
}

const fil = { forbindelser: structuredClone(FORBINDELSESDATA) as Forbindelse[] }
const idag = new Date().toISOString().slice(0, 10)
let koblet = 0
let uavklart = 0
let avvik = 0

for (const f of fil.forbindelser) {
  if (bare.size > 0 && !bare.has(f.nokkel)) continue
  if (!alle && f.pubchem) continue
  const resultat = await kurerForbindelse(f, {
    pubchem,
    uavhengige: async (navn) => {
      const treff = new Map<string, Uavhengig>()
      for (const n of navn) for (const u of [...(await fraClinpgx(n)), ...(await fraChebi(n))]) treff.set(`${u.kilde} ${u.id} ${u.inchikey}`, u)
      return [...treff.values()]
    },
    idag,
  })
  if ('pubchem' in resultat) {
    if (f.pubchem && (f.pubchem.cid !== resultat.pubchem.cid || f.pubchem.inchikey !== resultat.pubchem.inchikey)) {
      avvik += 1
      console.log(`AVVIK  ${f.nokkel}: koblet til CID ${f.pubchem.cid}, kontrollen nå gir CID ${resultat.pubchem.cid} (${resultat.pubchem.inchikey})`)
      continue
    }
    koblet += 1
    console.log(`OK     ${f.nokkel}: CID ${resultat.pubchem.cid} ${resultat.data.formel} ${resultat.data.molvekt} — ${resultat.pubchem.grunnlag}`)
    if (skriv && !f.pubchem) {
      f.pubchem = resultat.pubchem
      delete f.uavklart
    }
  } else {
    uavklart += 1
    console.log(`UAVKL  ${f.nokkel}: ${resultat.uavklart.grunn} Kandidater: ${resultat.uavklart.kandidater.join(', ') || '–'}`)
    if (skriv && !f.pubchem) f.uavklart = resultat.uavklart
  }
}

console.log(`\n${koblet} verifisert, ${uavklart} uavklart, ${avvik} avvik fra koblingene som står.`)
if (skriv) {
  // Kommentaren øverst i fila står; bare dataene skrives på nytt.
  const tekst = readFileSync(FIL, 'utf8')
  const data = 'export const FORBINDELSESDATA: Forbindelse[] = '
  writeFileSync(FIL, `${tekst.slice(0, tekst.indexOf(data))}${data}${JSON.stringify(fil.forbindelser, null, 2)}\n`)
}
