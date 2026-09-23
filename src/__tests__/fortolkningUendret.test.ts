/**
 * Den kliniske outputen er den samme som før, og fortolkningen henter reglene
 * sine bare der det er bestemt.
 *
 * Rusmiddelmodulene fortolkes med scenarioregelsettene som er publisert i
 * Supabase (`docs/scenarioregler.md`): appen henter dem og gir dem til
 * fortolkningssteget, og at de gir det samme som den opprinnelige motoren,
 * prøves i `rusparitet.test.ts` og `rusimport.test.ts`. Resten av
 * fortolkningen står fortsatt på datasettene under `src/data/` og i
 * `src/domain/`. Testene her holder det slik:
 *
 * - datasettene er de samme som før,
 * - kjernen og fortolkningsstegene henter ingenting fra faginnholdet, fra
 *   analyttsidene eller fra databasen selv — reglene fra databasen kommer inn
 *   som argumenter,
 * - og all klinisk output modulene kan gi, er nøyaktig den samme — målt over
 *   alle analyttene, alle rusmiddelmodulene med konsentrasjoner på og rundt
 *   grensene, og alle THC-syrekommentarene (se `hjelp/fortolkningsutfall.ts`).
 *   Summen står for hver del, så en del kan legges om uten å røre de andre.
 *
 * Legges flere moduler om til Supabase, skal det skje med vilje, med
 * paritetstester mot dagens motor (se docs/analyttsider-og-redigering.md), og
 * testene her endres i samme omgang.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fortolkningsutfall } from './hjelp/fortolkningsutfall'

const ROT = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Kontrollsummer for de statiske datasettene, slik de var da fundamentet ble
 * lagt. Endres et datasett med vilje, oppdateres summen i samme PR, og
 * føringen i endringsloggen får merket «Fag».
 */
const DATASETT: Record<string, string> = {
  'src/data/analytter.json': 'f32f9b30223d58a229f6d9068e42c762744664c707026416517dff780b5e3a56',
  'src/data/antihypertensiver.json': '2e1e0908ffb4ad67082eb7f5583ab6146af7e777d6ef3136543c1911b6cc0aa9',
  'src/data/aliaser.json': 'ab5f4ae6284d81cc32762a0da1709131d8b814138a302623b6ab60b00366ccfd',
}

/**
 * Kontrollsummene for all klinisk output fra fortolkningsmodulene, del for
 * del, slik den var før analyttsidene kom. Summene er de samme som da
 * rusmiddelmodulene ble lagt om til regelsettene i Supabase. Endres outputen
 * med vilje, oppdateres summen i samme PR, og føringen i endringsloggen får
 * merket «Fag».
 */
const FORTOLKNINGSUTFALL: Record<string, string> = {
  band: 'b2fce3266b626576260e7bf64dbc9fe917ae5899efa98fe18754b308c11db8eb',
  etg: '9aa2aea633064367b24e4a9578c37fb5fde700f7b410c8710187769c62ef434c',
  rus: '33a3739b124621c0deca34f68675b10c5398598ca78f3f6775456e3981621078',
  thc: 'fa7eb624ba7424585774af6033cf049d1887088eab781b0aadf39307ad27c20f',
  kategorier: '50493eb7d4632a8e279174238aa78970cd2ee143ea0824e1178e6a9b0bfa9a53',
}

/** Kjernen i fortolkningen: reglene, datasettene og tilstandsmaskinen. */
const FORTOLKNINGSKJERNEN = ['src/domain', 'src/data', 'src/state.ts']

/**
 * Stegene og modulene som viser fortolkningen og kopierer kommentarene. De
 * lenker til informasjonssidene, men henter ingenting fra dem.
 */
const FORTOLKNINGSSTEGENE = [
  'src/components/SearchStep.tsx',
  'src/components/BandStep.tsx',
  'src/components/KontrollStep.tsx',
  'src/components/PasteStep.tsx',
  'src/components/RusStep.tsx',
  'src/components/ThcStep.tsx',
  'src/components/EtgStep.tsx',
  'src/components/EtgPasteStep.tsx',
  'src/components/Kommentarliste.tsx',
  'src/components/Kodepille.tsx',
  'src/hooks/useKommentarflyt.ts',
]

/** Det fortolkningen ikke skal hente noe fra, så lenge byttet ikke er gjort. */
const REDIGERBART = [
  resolve(ROT, 'src/faginnhold'),
  resolve(ROT, 'src/components/analyttside'),
  resolve(ROT, 'src/components/referanser'),
  resolve(ROT, 'src/auth'),
]

function kildefiler(sti: string): string[] {
  const full = resolve(ROT, sti)
  if (statSync(full).isFile()) return [full]
  return readdirSync(full, { withFileTypes: true }).flatMap((oppf) => {
    if (oppf.name === '__tests__') return []
    const under = relative(ROT, resolve(full, oppf.name))
    if (oppf.isDirectory()) return kildefiler(under)
    return /\.(ts|tsx)$/.test(oppf.name) ? [resolve(ROT, under)] : []
  })
}

/** Modulene en fil henter inn, både statisk og dynamisk. */
function importer(kode: string): string[] {
  return [...kode.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!)
}

describe('fortolkningen etter at analyttsidene er tatt i bruk', () => {
  it('bruker de samme datasettene som før', () => {
    for (const [fil, forventet] of Object.entries(DATASETT)) {
      // Lest og skrevet ut på nytt, så bare innholdet teller — ikke
      // linjeskift eller innrykk.
      const innhold = JSON.stringify(JSON.parse(readFileSync(resolve(ROT, fil), 'utf8')))
      expect(createHash('sha256').update(innhold).digest('hex'), fil).toBe(forventet)
    }
  })

  it('henter ingenting fra det redigerbare faginnholdet, analyttsidene eller databasen', () => {
    const filer = [...FORTOLKNINGSKJERNEN, ...FORTOLKNINGSSTEGENE].flatMap(kildefiler)
    expect(filer.length).toBeGreaterThan(20)

    for (const fil of filer) {
      for (const modul of importer(readFileSync(fil, 'utf8'))) {
        const hvor = `${relative(ROT, fil)} henter ${modul}`
        expect(modul.startsWith('@supabase/'), hvor).toBe(false)
        expect(modul.startsWith('@tiptap/'), hvor).toBe(false)
        if (modul.startsWith('.')) {
          const mal = resolve(dirname(fil), modul)
          expect(REDIGERBART.some((mappe) => mal.startsWith(mappe)), hvor).toBe(false)
        }
      }
    }
  })

  it('gir nøyaktig den samme kliniske outputen som før', () => {
    const utfall: Record<string, unknown> = fortolkningsutfall()
    expect(Object.keys(utfall).sort()).toEqual(Object.keys(FORTOLKNINGSUTFALL).sort())
    for (const [del, forventet] of Object.entries(FORTOLKNINGSUTFALL)) {
      expect(createHash('sha256').update(JSON.stringify(utfall[del])).digest('hex'), del).toBe(forventet)
    }
  })
})
