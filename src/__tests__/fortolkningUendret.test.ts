/**
 * Fortolkningen står på de statiske dataene, ikke på det redigerbare
 * faginnholdet.
 *
 * Fundamentet for redigerbart faginnhold og referansesystemet — tabellene og
 * funksjonene i Supabase, `src/faginnhold/` og `src/components/referanser/` —
 * er lagt uten at noe klinisk er flyttet dit, og uten at appen bruker dem.
 * Kommentartekstene, grensene og fortolkningsreglene ligger fortsatt i
 * datasettene under `src/data/` og i `src/domain/`, og det er bare de
 * fortolkningen leser. At databasen ikke har fått noe innhold, prøves i
 * `faginnhold.test.ts`.
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

/** Kjernen i fortolkningen: reglene, datasettene og tilstandsmaskinen. */
const FORTOLKNINGSKJERNEN = ['src/domain', 'src/data', 'src/state.ts']

/** Det kjernen ikke skal hente noe fra, så lenge byttet ikke er gjort. */
const REDIGERBART = resolve(ROT, 'src/faginnhold')

/** Det appen ellers ikke bruker ennå: analyttsidene kommer senere. */
const IKKE_I_BRUK = [REDIGERBART, resolve(ROT, 'src/components/referanser')]

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

describe('fortolkningen etter at fundamentet for redigerbart faginnhold er lagt', () => {
  it('bruker de samme datasettene som før', () => {
    for (const [fil, forventet] of Object.entries(DATASETT)) {
      // Lest og skrevet ut på nytt, så bare innholdet teller — ikke
      // linjeskift eller innrykk.
      const innhold = JSON.stringify(JSON.parse(readFileSync(resolve(ROT, fil), 'utf8')))
      expect(createHash('sha256').update(innhold).digest('hex'), fil).toBe(forventet)
    }
  })

  it('henter ingenting fra det redigerbare faginnholdet eller fra databasen', () => {
    const filer = FORTOLKNINGSKJERNEN.flatMap(kildefiler)
    expect(filer.length).toBeGreaterThan(10)

    for (const fil of filer) {
      for (const modul of importer(readFileSync(fil, 'utf8'))) {
        const hvor = `${relative(ROT, fil)} henter ${modul}`
        expect(modul.startsWith('@supabase/'), hvor).toBe(false)
        if (modul.startsWith('.')) {
          expect(resolve(dirname(fil), modul).startsWith(REDIGERBART), hvor).toBe(false)
        }
      }
    }
  })

  it('viser ingenting fra referansesystemet i appen ennå', () => {
    const filer = kildefiler('src').filter((fil) => !IKKE_I_BRUK.some((mappe) => fil.startsWith(mappe)))
    expect(filer.length).toBeGreaterThan(20)

    for (const fil of filer) {
      for (const modul of importer(readFileSync(fil, 'utf8'))) {
        if (!modul.startsWith('.')) continue
        const mal = resolve(dirname(fil), modul)
        expect(
          IKKE_I_BRUK.some((mappe) => mal.startsWith(mappe)),
          `${relative(ROT, fil)} henter ${modul}`,
        ).toBe(false)
      }
    }
  })
})
