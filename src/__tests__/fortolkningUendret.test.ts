/**
 * Fortolkningen står på de statiske dataene, ikke på det redigerbare
 * faginnholdet.
 *
 * Analyttsidene (arbeidspakke 3) bruker faginnholdet og referansesystemet i
 * Supabase, men fortolkningen gjør det ikke: kommentartekstene, grensene og
 * fortolkningsreglene ligger fortsatt i datasettene under `src/data/` og i
 * `src/domain/`, og det er bare de fortolkningen leser. Testene her holder det
 * slik:
 *
 * - datasettene er de samme som før,
 * - kjernen og fortolkningsstegene henter ingenting fra faginnholdet, fra
 *   analyttsidene eller fra databasen,
 * - og all klinisk output modulene kan gi, er nøyaktig den samme — målt over
 *   alle analyttene, alle rusmiddelmodulene med konsentrasjoner på og rundt
 *   grensene, og alle THC-syrekommentarene (se `hjelp/fortolkningsutfall.ts`).
 *
 * Byttet til Supabase skal skje med vilje, med paritetstester mot dagens
 * motor (se docs/analyttsider-og-redigering.md). Da skal testene her endres i
 * samme omgang — ikke før.
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
  'src/data/rusmidler.json': '7f62a5c0894db2bb2a297b44b8aab1fb7a236e3714a7b623008f5c19bb4069f2',
  'src/data/aliaser.json': 'ab5f4ae6284d81cc32762a0da1709131d8b814138a302623b6ab60b00366ccfd',
}

/**
 * Kontrollsummen for all klinisk output fra fortolkningsmodulene, slik den var
 * før analyttsidene kom. Endres outputen med vilje, oppdateres summen i samme
 * PR, og føringen i endringsloggen får merket «Fag».
 */
const FORTOLKNINGSUTFALL = 'a456aa252cf5289f7dc7fa6fd8b66760a84418dc4342d747b94c333ee7e281fd'

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
    const utfall = JSON.stringify(fortolkningsutfall())
    expect(createHash('sha256').update(utfall).digest('hex')).toBe(FORTOLKNINGSUTFALL)
  })
})
