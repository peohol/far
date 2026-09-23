/**
 * Fortolkningen står på de publiserte regelsettene i Supabase, og gir den
 * samme kliniske outputen som før byttet.
 *
 * Konsentrasjonsreglene og kommentarene er regelsett i databasen (arbeidspakke
 * 5, se `docs/fortolkningsregler.md`). Appen henter de publiserte når den
 * åpnes og gir steg 2 regelsettet for analytten; kjernen og stegene henter
 * ingenting selv. Testene her holder det slik:
 *
 * - datasettene er de samme som før, bortsett fra grensene og kommentarene,
 *   som ble tatt ut da fortolkningen ble byttet over,
 * - fasiten fra før byttet (`hjelp/dagensregler.ts`) er uendret,
 * - kjernen og fortolkningsstegene henter ingenting fra faginnholdet, fra
 *   analyttsidene eller fra databasen — regelsettene kommer som argumenter,
 * - og all klinisk output modulene kan gi, er nøyaktig den samme — målt over
 *   alle analyttene med regelsettene fra før byttet, alle rusmiddelmodulene
 *   med konsentrasjoner på og rundt grensene, og alle THC-syrekommentarene
 *   (se `hjelp/fortolkningsutfall.ts`).
 *
 * Endres reglene i databasen, endres ikke fasiten: det er de publiserte
 * regelsettene som gjelder, og historikken deres viser hva som er endret.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DAGENS_GRENSER, FASITSUMMER, IMPORTDATASETT, kontrollsum } from './hjelp/dagensregler'
import { fortolkningsutfall } from './hjelp/fortolkningsutfall'
import { analytes } from '../domain/analytes'

const ROT = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Kontrollsummer for de statiske datasettene. Endres et datasett med vilje,
 * oppdateres summen i samme PR, og føringen i endringsloggen får merket «Fag».
 *
 * Summene for analytter.json og antihypertensiver.json ble endret da
 * fortolkningen ble byttet over til regelsettene: grensene, ringegrensen og
 * kommentarene ble tatt ut, og ingenting annet. Resten av innholdet er det
 * samme som før.
 */
const DATASETT: Record<string, string> = {
  'src/data/analytter.json': 'bd169f468b9b66ba698488f430152f3e33f4e8e0f136fc3287f023008f78a62e',
  'src/data/antihypertensiver.json': '02bd6d9495fe3ad7a3c483973a8a4bd8286aff082c6f47fef57609f28c489a4a',
  'src/data/rusmidler.json': '7f62a5c0894db2bb2a297b44b8aab1fb7a236e3714a7b623008f5c19bb4069f2',
  'src/data/aliaser.json': 'ab5f4ae6284d81cc32762a0da1709131d8b814138a302623b6ab60b00366ccfd',
}

/**
 * Kontrollsummen for all klinisk output fra fortolkningsmodulene, slik den var
 * før analyttsidene kom — og den samme etter byttet til regelsettene. Endres
 * outputen med vilje, oppdateres summen i samme PR, og føringen i
 * endringsloggen får merket «Fag».
 */
const FORTOLKNINGSUTFALL = 'a456aa252cf5289f7dc7fa6fd8b66760a84418dc4342d747b94c333ee7e281fd'

/**
 * Kjernen i fortolkningen: motoren, datasettene og tilstandsmaskinen, og
 * hentingen av de publiserte regelsettene, som får lesingen fra appen.
 */
const FORTOLKNINGSKJERNEN = [
  'src/domain',
  'src/data',
  'src/state.ts',
  'src/regler/modell.ts',
  'src/regler/publiserte.ts',
  'src/hooks/usePubliserteRegler.ts',
]

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

/** Det fortolkningen ikke skal hente noe fra: regelsettene kommer som argumenter. */
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

/** Feltene som ble tatt ut av datasettene da fortolkningen ble byttet over. */
const UTTATTE_FELT = ['ringegrense', 'nedreGrense', 'ovreGrense', 'nivaer']

describe('fortolkningen etter byttet til regelsettene i Supabase', () => {
  it('bruker de samme datasettene som før, uten grensene og kommentarene', () => {
    for (const [fil, forventet] of Object.entries(DATASETT)) {
      // Lest og skrevet ut på nytt, så bare innholdet teller — ikke
      // linjeskift eller innrykk.
      const innhold = JSON.stringify(JSON.parse(readFileSync(resolve(ROT, fil), 'utf8')))
      expect(createHash('sha256').update(innhold).digest('hex'), fil).toBe(forventet)
    }
  })

  it('har ikke lenger grensene og kommentarene i datasettene', () => {
    for (const analyte of analytes) {
      for (const felt of UTTATTE_FELT) expect(Object.hasOwn(analyte, felt), `${analyte.kode}.${felt}`).toBe(false)
    }
  })

  it('måler mot den samme fasiten som før byttet', () => {
    expect(kontrollsum(IMPORTDATASETT)).toBe(FASITSUMMER.importdatasett)
    expect(kontrollsum(DAGENS_GRENSER)).toBe(FASITSUMMER.grenser)
    expect(DAGENS_GRENSER.map((g) => g.kode)).toEqual(analytes.map((a) => a.kode))
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
