/**
 * Fortolkningen står på de publiserte regelsettene i Supabase, og gir den
 * samme kliniske outputen som før byttet.
 *
 * Konsentrasjonsreglene og kommentarene er intervallregelsett i databasen
 * (arbeidspakke 5, se `docs/fortolkningsregler.md`), og rusmiddelmodulene
 * fortolkes med scenarioregelsettene (`docs/scenarioregler.md`, med paritet i
 * `rusparitet.test.ts` og `rusimport.test.ts`). Appen henter de publiserte når
 * den åpnes og gir dem til fortolkningsstegene; kjernen og stegene henter
 * ingenting selv. Testene her holder det slik:
 *
 * - datasettene er de samme som før, bortsett fra grensene og kommentarene,
 *   som ble tatt ut da fortolkningen ble byttet over, og referanseområdet,
 *   som steg 2 nå har fra informasjonssidene,
 * - fasiten fra før byttet (`hjelp/dagensregler.ts`) er uendret,
 * - kjernen og fortolkningsstegene henter ingenting fra faginnholdet, fra
 *   analyttsidene eller fra databasen selv — reglene fra databasen kommer inn
 *   som argumenter,
 * - og all klinisk output modulene kan gi, er nøyaktig den samme — målt over
 *   alle analyttene med regelsettene fra før byttet, alle rusmiddelmodulene
 *   med konsentrasjoner på og rundt grensene, og alle THC-syrekommentarene
 *   (se `hjelp/fortolkningsutfall.ts`). Summen står for hver del, så en del
 *   kan legges om uten å røre de andre. Unntaket er referanseområdet for tre
 *   analytter, som ble endret med vilje (se {@link FORTOLKNINGSUTFALL}).
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
 * kommentarene ble tatt ut, og ingenting annet. De ble endret igjen da
 * referanseområdet ble tatt ut, fordi fortolkningen nå viser det
 * informasjonssiden har. Resten av innholdet er det samme som før.
 */
const DATASETT: Record<string, string> = {
  'src/data/analytter.json': 'fd88b5cb103e2bbd43e76e8072fe77cbf3ecb6258fcb5e5c236fdfa34e2cace4',
  'src/data/antihypertensiver.json': '75b4b688155a1ac03876c469ba98628c1d78f8d3ce408a6bce2482868421e33e',
  'src/data/aliaser.json': 'ab5f4ae6284d81cc32762a0da1709131d8b814138a302623b6ab60b00366ccfd',
}

/**
 * Kontrollsummene for all klinisk output fra fortolkningsmodulene, del for
 * del. Endres outputen med vilje, oppdateres summen i samme PR, og føringen i
 * endringsloggen får merket «Fag».
 *
 * Summene var de samme fra før analyttsidene kom og gjennom byttet til
 * regelsettene i Supabase. Summen for konsentrasjonsbåndene ble endret én
 * gang, med vilje, da referanseområdet under analyttnavnet ble hentet fra
 * informasjonssidene: da ble det 50 – 350 for BREK (før 50 – 330), 180 – 550
 * for DOKSUM (før 18 – 550) og 10 – 300 for LMP (før < 300), og ingenting
 * annet endret seg. Kommentarene og knappene er de samme.
 *
 * Summene for THC-syre ble byttet da fortolkningen gikk over til regelsettet
 * og tekstene i Supabase. Delene regnes nå av motoren (`thcMotor.ts`) over de
 * kombinasjonene den kan gi — hvert nivå, hver konklusjon, med og uten
 * cut-off — i stedet for av den opprinnelige modulen over kategoriene 0–5,
 * der noen aldri kunne forekomme. At motoren gir nøyaktig den samme
 * kommentaren og konklusjonen som den opprinnelige modulen for hver av dem,
 * står i `thcParitet.test.ts`, og fasiten (`thcMotor.test.ts`) gjelder
 * fortsatt uendret.
 */
const FORTOLKNINGSUTFALL: Record<string, string> = {
  band: '0beefabadcb7f4dc7e1438c9feb7f9496c40e7a883336031a2f6f59648114779',
  etg: '9aa2aea633064367b24e4a9578c37fb5fde700f7b410c8710187769c62ef434c',
  rus: '33a3739b124621c0deca34f68675b10c5398598ca78f3f6775456e3981621078',
  thc: '1d2c6c72838470e343b694eaaa0f880153c9eee6a628ff9cea492629b70ace9b',
  kategorier: 'd6b8c44090aa62afd61f57bfa8ff317c6c6e6ade4498485c0a7cff1804786098',
}

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
  'src/hooks/useHenting.ts',
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
  'src/components/ThcSkjema.tsx',
  'src/components/ThcUtfall.tsx',
  'src/components/ThcForklaring.tsx',
  'src/components/ThcPlot.tsx',
  'src/components/ThcMarginforklaring.tsx',
  'src/components/Trinnbryter.tsx',
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

/** Feltene som ble tatt ut av datasettene da fortolkningen fikk dem fra databasen. */
const UTTATTE_FELT = ['ringegrense', 'nedreGrense', 'ovreGrense', 'nivaer', 'referanseomrade']

describe('fortolkningen etter byttet til regelsettene i Supabase', () => {
  it('bruker de samme datasettene som før, uten grensene, kommentarene og referanseområdene', () => {
    for (const [fil, forventet] of Object.entries(DATASETT)) {
      // Lest og skrevet ut på nytt, så bare innholdet teller — ikke
      // linjeskift eller innrykk.
      const innhold = JSON.stringify(JSON.parse(readFileSync(resolve(ROT, fil), 'utf8')))
      expect(createHash('sha256').update(innhold).digest('hex'), fil).toBe(forventet)
    }
  })

  it('har ikke lenger grensene, kommentarene og referanseområdene i datasettene', () => {
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
    const utfall: Record<string, unknown> = fortolkningsutfall()
    expect(Object.keys(utfall).sort()).toEqual(Object.keys(FORTOLKNINGSUTFALL).sort())
    for (const [del, forventet] of Object.entries(FORTOLKNINGSUTFALL)) {
      expect(createHash('sha256').update(JSON.stringify(utfall[del])).digest('hex'), del).toBe(forventet)
    }
  })
})
