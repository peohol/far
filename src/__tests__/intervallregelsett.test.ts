/**
 * Regelsettene for de enkle konsentrasjonsreglene, prøvd mot en ekte database.
 *
 * Fire ting prøves her:
 *
 * 1. Importen: importdatasettet er fasiten fra før byttet (se
 *    `hjelp/dagensregler.ts`), ett regelsett for hver analytt med
 *    konsentrasjonsbånd, og importen legger reglene og kommentarobjektene inn
 *    og publiserer dem med kilden på hver revisjon.
 * 2. Pariteten: motoren, brukt på regelsettene og kommentarene slik en vanlig
 *    bruker leser dem fra databasen — slik appen gjør — gir det samme som den
 *    gamle motoren ga: alle knappene, kommentarene, «ring rekvirent» og
 *    cut-off, og regelen hver konsentrasjon treffer, på og rundt hver grense.
 * 3. Reglene databasen håndhever: kontrollen av grenser, koblingene til
 *    kommentarobjektene, enhet og handlinger, rettighetene, og at hele
 *    regelsettet versjoneres, publiseres og gjenopprettes på én gang.
 * 4. Redigeringen: regelsettet og kommentarene lagres sammen, alt eller
 *    ingenting.
 *
 * Flyttingen av kommentarene fra regelsettene til egne objekter prøves i
 * `kommentarflytting.test.ts`. Regelsettene som opprettes i del 3 og 4, er
 * syntetiske, med koder som ikke finnes.
 */
import type { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { analytes } from '../domain/analytes'
import { cutoffkommentar, finnRegel, intervallene, regelsettband, ringes } from '../domain/intervallregler'
import { cutoffvalg, regelsettvalg } from '../domain/valg'
import { lagFaginnholdsleser, type Utgave } from '../faginnhold/lesing'
import type { Objektstatus } from '../faginnhold/modell'
import { importdel, regelimportSql } from '../regler/import'
import {
  kommentarendringer,
  kommentarIder,
  kommentarnavn,
  lesPubliserteRegelsett,
  losRegelsett,
  medKommentarer,
  utenKommentarer,
} from '../regler/kommentarer'
import {
  KONSENTRASJONSNIVAER,
  MALEENHETER,
  REGELHANDLINGER,
  type Intervallregelsett,
  type Intervallregelsettinnhold,
} from '../regler/modell'
import {
  delIntervall,
  egenKommentar,
  klargjor,
  kontrollerRegelsett,
  settCutoff,
  settKommentartekst,
  settRing,
  settSkillepunkt,
  slaSammen,
  steg,
} from '../regler/redigering'
import {
  DAGENS_GRENSER,
  DAGENS_IMPORT,
  DAGENS_REGELSETT,
  dagensNiva,
  IMPORTDATASETT,
  importId,
  importkilde,
} from './hjelp/dagensregler'
import {
  faginnholdskall,
  feilFra,
  nyDatabase,
  opprettBruker,
  som,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const MIGRASJONER = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))

/**
 * Importen til produksjon, slik den ble rullet ut før kommentarene ble egne
 * objekter. Filene er historikk og skal ikke endres; flyttingen prøves mot dem
 * i `kommentarflytting.test.ts`.
 */
const HISTORISKE_IMPORTER: Record<string, string> = {
  '20260923070250_importer_intervallregelsett_1.sql': '76c1a7a7e6b304867a7286043d6dea7e42faf560cdc282f3e488e9182a82c317',
  '20260923070426_importer_intervallregelsett_2.sql': 'a2d2fe570f8d870a8a2f7129f9c9ea6243d84fb0bbdce634d589fe212d38d0c1',
  '20260923070542_importer_intervallregelsett_3.sql': 'c8e552764a35bc3a2c3b9ed683afaff6a5630f81a0e6218b290fd5c424e5ff7e',
  '20260923070658_importer_intervallregelsett_4.sql': '84383ff06c67b331375b3408625ca9a7bd909d9596b58e7ee54087dedc7d0511',
  '20260923070817_importer_intervallregelsett_5.sql': '69846c0de75a079231e48be73a7447e545753ad2960cc9dc92a1ec84ab1d8f97',
  '20260923070936_importer_intervallregelsett_6.sql': '1a051a0943c89cfd28e66777b4a0a1fe4bcdae305cc55e196620c8646d7123ef',
}

let db: PGlite
let admin: string
let bruker: string
let kall: Faginnholdskall

/** Regelsettene i én tilstand, slik appen leser dem: uten tekstene. */
async function lesRegelsett(brukerId: string | null, tilstand: 'utkast' | 'publisert') {
  const rad = await kall.rpc<{ les_intervallregelsett: Utgave<Intervallregelsettinnhold>[] }>(
    brukerId,
    'les_intervallregelsett',
    { sidetilstand: tilstand },
  )
  return rad.les_intervallregelsett
}

/** Regelsettet med tekstene i den rekkefølgen de brukes, så to kan sammenlignes. */
function ordnet(regelsett: Intervallregelsett): Intervallregelsett {
  return medKommentarer(regelsett, new Map(regelsett.kommentarer.map((k) => [k.id, k.tekst])))
}

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'regel.admin', fornavn: 'Ada', etternavn: 'Adminsen', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'regel.bruker', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  await db.exec(regelimportSql(DAGENS_IMPORT, 'regel.admin'))
}, 60_000)

/* --- 1. Importen ---------------------------------------------------------- */

describe('importen av dagens regler', () => {
  it('har ett regelsett for hver analytt med konsentrasjonsbånd, med kilden fra datasettet den kom fra', () => {
    const etterKode = new Map(analytes.map((a) => [a.kode, a]))
    expect(IMPORTDATASETT.map((i) => i.regelsett.analyttkode)).toEqual(analytes.map((a) => a.kode).sort((a, b) => a.localeCompare(b)))
    for (const { kilde, regelsett } of IMPORTDATASETT) {
      const analyte = etterKode.get(regelsett.analyttkode)!
      expect(kilde, regelsett.analyttkode).toBe(importkilde(analyte))
      expect(regelsett.enhet, regelsett.analyttkode).toBe(analyte.enhet)
    }
  })

  it('deler hvert regelsett i reglene og kommentarobjektene, med ID-ene reglene peker på og tekstene uendret', () => {
    DAGENS_IMPORT.forEach((i, n) => {
      const { regelsett } = IMPORTDATASETT[n]!
      expect(i.regelsett).toEqual(utenKommentarer(regelsett))
      expect(i.kommentarer.map((k) => k.id).sort()).toEqual(kommentarIder(regelsett).sort())
      for (const k of i.kommentarer) {
        expect(k.innhold).toEqual({
          navn: kommentarnavn(regelsett, k.id),
          tekst: regelsett.kommentarer.find((r) => r.id === k.id)!.tekst,
          plassholdere: [],
        })
      }
    })
  })

  it('kan kjøres igjen uten å legge inn noe to ganger', async () => {
    const for_ = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    await db.exec(regelimportSql(DAGENS_IMPORT, 'regel.admin'))
    const etter = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    expect(etter).toEqual(for_)
  })

  it('krever en administrator', async () => {
    const feil = await feilFra(() => db.exec(regelimportSql(DAGENS_IMPORT, 'regel.bruker')))
    expect(feil?.message).toMatch(/Fant ingen administrator/)
  })

  it('ligger i produksjon som datamigreringer som ikke er endret siden de ble rullet ut', () => {
    const filer = readdirSync(MIGRASJONER).filter((f) => /_importer_intervallregelsett_\d+\.sql$/.test(f))
    expect(filer.sort()).toEqual(Object.keys(HISTORISKE_IMPORTER).sort())
    for (const fil of filer) {
      const sum = createHash('sha256').update(readFileSync(join(MIGRASJONER, fil))).digest('hex')
      expect(sum, fil).toBe(HISTORISKE_IMPORTER[fil])
    }
  })

  it('deler importen i sammenhengende porsjoner uten å miste eller gjenta noe', () => {
    for (const antall of [1, 4, 6, 7, 60]) {
      const deler = Array.from({ length: antall }, (_, i) => importdel(DAGENS_IMPORT, i + 1, antall))
      expect(deler.flat()).toEqual(DAGENS_IMPORT)
      expect(Math.max(...deler.map((d) => d.length)) - Math.min(...deler.map((d) => d.length))).toBeLessThanOrEqual(1)
    }
    expect(() => importdel(DAGENS_IMPORT, 0, 6)).toThrow()
    expect(() => importdel(DAGENS_IMPORT, 7, 6)).toThrow()
  })

  it('stopper før noe legges inn når dataene er endret etter at SQL-en ble laget', async () => {
    const sql = regelimportSql(DAGENS_IMPORT, 'regel.admin').replace('"analyttkode":"AMIS"', '"analyttkode":"AMIX"')
    const for_ = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    const feil = await feilFra(() => db.exec(sql))
    expect(feil?.message).toMatch(/kontrollsummen stemmer ikke/)
    expect(await kall.fasit('select count(*)::int as antall from public.objektrevisjoner')).toEqual(for_)
  })

  it('gjør ingenting som datamigrering når administratoren mangler', async () => {
    const for_ = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    await db.exec(regelimportSql(DAGENS_IMPORT, 'regel.bruker', 'hopp over'))
    const etter = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    expect(etter).toEqual(for_)
  })

  it('gir ett publisert regelsett per analytt med konsentrasjonsbånd, og publiserte kommentarer, med kilden', async () => {
    const publisert = await lesRegelsett(bruker, 'publisert')
    expect(publisert.map((u) => u.innhold.analyttkode).sort()).toEqual(analytes.map((a) => a.kode).sort())

    for (const utgave of publisert) {
      const analyte = analytes.find((a) => a.kode === utgave.innhold.analyttkode)!
      expect(utgave.revisjon).toBe(1)
      expect(utgave.publisert_revisjon).toBe(1)
      expect(utgave.endret_av_fornavn).toBe('Ada')
      for (const id of [utgave.id, ...kommentarIder(utgave.innhold)]) {
        const [revisjon] = await kall.fasit<{ kilde: string; handling: string; utfort_av: string }>(
          'select kilde, handling, utfort_av from public.objektrevisjoner where objekt_id = $1',
          [id],
        )
        expect(revisjon).toEqual({ kilde: importkilde(analyte), handling: 'opprettet', utfort_av: admin })
      }
    }
  })

  it('lagrer regelsettene og tekstene nøyaktig slik de ble importert', async () => {
    const leser = lagFaginnholdsleser(kall.klientFor(bruker))
    const publisert = new Map((await lesPubliserteRegelsett(leser)).map((r) => [r.analyttkode, r]))
    for (const regelsett of DAGENS_REGELSETT) {
      expect(publisert.get(regelsett.analyttkode), regelsett.analyttkode).toEqual(ordnet(regelsett))
    }
  })

  it('har hver kommentar én gang, også når flere regler bruker den', async () => {
    for (const regelsett of DAGENS_REGELSETT) {
      const ider = regelsett.kommentarer.map((k) => k.id)
      expect(new Set(ider).size, regelsett.analyttkode).toBe(ider.length)
      const tekster = regelsett.kommentarer.map((k) => k.tekst)
      expect(new Set(tekster).size, regelsett.analyttkode).toBe(tekster.length)
      // Cut-off bygger på kommentaren fra «innenfor» i stedet for å kopiere den.
      if (regelsett.cutoff) {
        const innledning = regelsett.kommentarer.find((k) => k.id === regelsett.cutoff!.innledning)!
        const hoved = regelsett.kommentarer.find((k) => k.id === regelsett.cutoff!.kommentar)!
        expect(innledning.tekst.includes(hoved.tekst), regelsett.analyttkode).toBe(false)
        expect(regelsett.intervaller.some((i) => i.kommentar === hoved.id), regelsett.analyttkode).toBe(true)
      }
    }
    const [{ antall }] = (await kall.fasit<{ antall: number }>(
      `select count(*)::int as antall from public.kommentarer where tilstand = 'publisert'`,
    )) as [{ antall: number }]
    expect(antall).toBe(DAGENS_REGELSETT.reduce((sum, r) => sum + r.kommentarer.length, 0))
  })
})

/* --- 2. Pariteten --------------------------------------------------------- */

describe('motoren på regelsettene i databasen mot den gamle', () => {
  let regelsett: Map<string, Intervallregelsett>

  beforeAll(async () => {
    const publisert = await lesPubliserteRegelsett(lagFaginnholdsleser(kall.klientFor(bruker)))
    regelsett = new Map(publisert.map((r) => [r.analyttkode, r]))
  })

  it('gir de samme knappene, med samme nøkler, grenser, ring og rekkefølge', () => {
    for (const gamle of DAGENS_GRENSER) {
      const band = regelsettband(regelsett.get(gamle.kode)!)
      expect(band.map(({ key, fra, til, ring }) => ({ key, fra, til, ring })), gamle.kode).toEqual(gamle.band)
      expect(regelsettvalg(regelsett.get(gamle.kode)!).slice(0, band.length), gamle.kode).toEqual(band)
    }
  })

  it('gir de samme knappene og kommentarene som fasiten', () => {
    // Fasiten ble målt mot den gamle motoren da den ble laget, og
    // `fortolkningUendret.test.ts` holder hele outputen fra den mot
    // kontrollsummen fra før byttet.
    for (const fasit of DAGENS_REGELSETT) {
      const nytt = regelsett.get(fasit.analyttkode)!
      expect(regelsettvalg(nytt), fasit.analyttkode).toEqual(regelsettvalg(fasit))
    }
  })

  it('gir cut-off-kommentaren bare til antidepressiver og antipsykotika, som før', () => {
    for (const analyte of analytes) {
      const ny = cutoffkommentar(regelsett.get(analyte.kode)!)
      const skal = ['Antidepressiver', 'Antipsykotika'].includes(analyte.kategori)
      expect(ny !== null, analyte.kode).toBe(skal)
      expect(ny !== null, analyte.kode).toBe(cutoffvalg(regelsett.get(analyte.kode)!) !== null)
    }
  })

  it('gir den samme ringegrensen og ringer i de samme båndene', () => {
    for (const gamle of DAGENS_GRENSER) {
      const nytt = regelsett.get(gamle.kode)!
      expect(nytt.ringegrense, gamle.kode).toBe(gamle.ringegrense)
      expect(intervallene(nytt).map(ringes), gamle.kode).toEqual(gamle.band.map((b) => b.ring))
    }
  })

  it('plasserer hver konsentrasjon på, rett under og rett over hver grense likt', () => {
    let prøvd = 0
    for (const gamle of DAGENS_GRENSER) {
      const nytt = regelsett.get(gamle.kode)!
      const steg = 10 ** -nytt.desimaler
      const valg = regelsettvalg(nytt)
      const rund = (v: number) => Number((Math.round(v / steg) * steg).toFixed(nytt.desimaler))

      // Alle grensene fra begge motorene, og verdiene rundt dem i hele steg.
      const grenser = new Set<number>([
        ...nytt.skillepunkter,
        ...gamle.band.flatMap((b) => [b.fra, b.til].filter((v): v is number => v !== null)),
        gamle.nedreGrense,
        gamle.ovreGrense,
        ...(gamle.ringegrense === null ? [] : [gamle.ringegrense]),
      ])
      const verdier = [...grenser].flatMap((g) => [g - 2 * steg, g - steg, g, g + steg, g + 2 * steg].map(rund))
      verdier.push(0, rund(steg), rund(Math.max(...grenser) * 10))

      for (const verdi of verdier.filter((v) => v >= 0)) {
        const gammelt = gamle.band.find((b) => (b.fra === null || verdi >= b.fra - steg / 2) && (b.til === null || verdi <= b.til + steg / 2))
        const treff = finnRegel(nytt, verdi)
        const hvor = `${gamle.kode} ${verdi}`
        expect(gammelt, hvor).toBeDefined()
        expect(valg[treff.indeks]?.key, hvor).toBe(gammelt!.key)
        expect(ringes(treff), hvor).toBe(gammelt!.ring)
        expect(treff.kommentar.tekst, hvor).toBe(valg[treff.indeks]?.kommentar)
        expect(treff.niva, hvor).toBe(dagensNiva(gamle, verdi))
        prøvd += 1
      }

      // Også mellom de hele stegene følger nivået den gamle kanoniske regelen.
      for (const g of grenser) {
        for (const verdi of [g - steg / 2, g - steg / 10, g + steg / 10, g + steg / 2].filter((v) => v >= 0)) {
          expect(finnRegel(nytt, verdi).niva, `${gamle.kode} ${verdi}`).toBe(dagensNiva(gamle, verdi))
        }
      }
    }
    expect(prøvd).toBeGreaterThan(DAGENS_GRENSER.length * 10)
  })
})

/* --- 3. Reglene databasen håndhever -------------------------------------- */

let lopenummer = 0

/** Et gyldig, syntetisk regelsett med en kode ingen annen test bruker. */
function testregelsett(endring: Partial<Intervallregelsett> = {}): Intervallregelsett {
  lopenummer += 1
  const k = (navn: string) => importId('test', String(lopenummer), navn)
  return {
    analyttkode: `TEST${lopenummer}`,
    enhet: 'nmol/L',
    desimaler: 1,
    skillepunkter: [2.5, 40, 60],
    intervaller: [
      { niva: 'under', handling: null, kommentar: k('lav') },
      { niva: 'innenfor', handling: null, kommentar: k('middels') },
      { niva: 'innenfor', handling: 'ring_rekvirent', kommentar: k('middels') },
      { niva: 'over', handling: 'ring_rekvirent', kommentar: k('hoy') },
    ],
    ringegrense: 39.9,
    cutoff: { innledning: k('cutoff'), kommentar: k('middels') },
    kommentarer: [
      { id: k('lav'), tekst: 'Lav syntetisk kommentar.' },
      { id: k('middels'), tekst: 'Middels syntetisk kommentar.' },
      { id: k('hoy'), tekst: 'Høy syntetisk kommentar.' },
      { id: k('cutoff'), tekst: 'Syntetisk innledning.' },
    ],
    ...endring,
  }
}

/**
 * Kommentarobjektene regelsettet bruker, med ID-ene det peker på, opprettet
 * av administratoren — slik importen gjør det.
 */
async function opprettKommentarer(regelsett: Intervallregelsett, publiser: boolean) {
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: admin, role: 'authenticated' })])
    for (const { id, tekst } of regelsett.kommentarer) {
      // En test kan prøve flere varianter av det samme regelsettet; da finnes kommentarene alt.
      const { rows: finnes } = await tx.query('select 1 from public.redigerbare_objekter where id = $1', [id])
      if (finnes.length) continue
      const innhold = { navn: kommentarnavn(regelsett, id), tekst, plassholdere: [] }
      const { rows } = await tx.query<{ revisjon: number }>(
        `select revisjon from intern.opprett_objekt('kommentar', $1, $2)`,
        [id, JSON.stringify(innhold)],
      )
      if (publiser) await tx.query('select public.publiser_utkast($1, $2)', [id, rows[0]!.revisjon])
    }
  })
}

/** Kommentarene og så regelsettet, som utkast. Kommentarene publiseres når det bes om. */
async function opprettRegelsett(
  regelsett: Intervallregelsett,
  { av = admin, publiserKommentarer = false } = {},
): Promise<Objektstatus> {
  await opprettKommentarer(regelsett, publiserKommentarer)
  return kall.opprett('intervallregelsett', utenKommentarer(regelsett), av)
}

/** Feilmeldingen databasen gir for innholdet, eller `null` når det godtas. */
async function avvisning(regelsett: Intervallregelsett, innhold: object = utenKommentarer(regelsett)) {
  await opprettKommentarer(regelsett, false)
  const feil = await feilFra(() => kall.opprett('intervallregelsett', innhold as Intervallregelsettinnhold))
  if (feil) expect(feil.code).toBe('22023')
  return feil?.message ?? null
}

describe('databasen', () => {
  it('har de samme nivåene og handlingene som appen', async () => {
    const verdier = async (type: string) =>
      (await kall.fasit<{ v: string[] }>(`select enum_range(null::public.${type})::text[] as v`))[0]!.v
    expect(await verdier('konsentrasjonsniva')).toEqual([...KONSENTRASJONSNIVAER])
    expect(await verdier('regelhandling')).toEqual([...REGELHANDLINGER])
    const enheter = await kall.fasit<{ enhet: string }>('select enhet from public.maleenheter')
    expect(enheter.map((e) => e.enhet).sort()).toEqual([...MALEENHETER].sort())
  })

  it('lagrer reglene uten tekstene og gir dem tilbake nøyaktig som de ble sendt', async () => {
    const regelsett = testregelsett()
    const status = await opprettRegelsett(regelsett)
    const [revisjon] = await kall.revisjoner(status.id)
    expect(revisjon!.innhold).toEqual(utenKommentarer(regelsett))
    await kall.forventSamsvar(status.id)

    // Reglene peker på kommentarobjektene: fire regler, der to bruker den
    // samme kommentaren, og tekstene står bare i kommentarobjektene.
    const regler = await kall.fasit<{ kommentar_id: string }>(
      'select kommentar_id from public.intervallregler where regelsett_id = $1 order by posisjon',
      [status.id],
    )
    expect(regler.map((r) => r.kommentar_id)).toEqual(regelsett.intervaller.map((i) => i.kommentar))
    const [tabell] = await kall.fasit<{ finnes: string | null }>(`select to_regclass('public.regelsettkommentarer')::text as finnes`)
    expect(tabell!.finnes).toBeNull()
  })

  it('lagrer grensene som halvåpne intervaller som deler skillepunktene', async () => {
    const status = await opprettRegelsett(testregelsett())
    const regler = await kall.fasit<{ fra: string | null; til: string | null }>(
      'select fra::text, til::text from public.intervallregler where regelsett_id = $1 order by posisjon',
      [status.id],
    )
    expect(regler).toEqual([
      { fra: null, til: '2.5' },
      { fra: '2.5', til: '40' },
      { fra: '40', til: '60' },
      { fra: '60', til: null },
    ])
  })

  describe('avviser et regelsett', () => {
    it('med grenser som ikke stiger', async () => {
      expect(await avvisning(testregelsett({ skillepunkter: [2.5, 60, 40] }))).toMatch(/stige/)
      expect(await avvisning(testregelsett({ skillepunkter: [2.5, 40, 40] }))).toMatch(/stige/)
    })

    it('med grenser som ikke er positive tall i hele steg', async () => {
      expect(await avvisning(testregelsett({ skillepunkter: [0, 40, 60] }))).toMatch(/større enn null/)
      expect(await avvisning(testregelsett({ skillepunkter: [2.55, 40, 60] }))).toMatch(/desimaler/)
      const r = testregelsett()
      expect(await avvisning(r, { ...utenKommentarer(r), skillepunkter: ['2,5', 40, 60] })).toMatch(/tall/)
    })

    it('med feil antall intervaller i forhold til grensene', async () => {
      const r = testregelsett()
      expect(await avvisning(r, { ...utenKommentarer(r), skillepunkter: [2.5, 40] })).toMatch(/ett intervall mer/)
      expect(await avvisning(r, { ...utenKommentarer(r), intervaller: [], skillepunkter: [] })).toMatch(/minst ett intervall/)
    })

    it('med et intervall uten kommentar, eller som peker på noe som ikke er en kommentar', async () => {
      const r = testregelsett()
      const med = (kommentar: unknown) => ({
        ...utenKommentarer(r),
        intervaller: r.intervaller.map((i, n) => (n === 1 ? { ...i, kommentar } : i)),
      })
      expect(await avvisning(r, med(null))).toMatch(/mangler kommentar/)
      expect(await avvisning(r, med(importId('ukjent')))).toMatch(/kommentar_id må peke på et objekt av typen kommentar/)
      const annet = await opprettRegelsett(testregelsett())
      expect(await avvisning(r, med(annet.id))).toMatch(/kommentar_id må peke på et objekt av typen kommentar/)
    })

    it('med en kommentar som har plassholdere, som en konsentrasjonsregel ikke fyller inn', async () => {
      const r = testregelsett()
      const plass = await kall.opprett('kommentar', {
        navn: 'Syntetisk med plassholder',
        tekst: 'Konsentrasjonen er {nivå}.',
        plassholdere: ['{nivå}'],
      })
      const innhold = {
        ...utenKommentarer(r),
        intervaller: r.intervaller.map((i, n) => (n === 0 ? { ...i, kommentar: plass.id } : i)),
      }
      expect(await avvisning(r, innhold)).toMatch(/har plassholdere \({nivå}\)/)
    })

    it('uten enhet, eller med en enhet som ikke er gyldig', async () => {
      expect(await avvisning(testregelsett({ enhet: '' }))).toMatch(/Enheten mangler/)
      expect(await avvisning(testregelsett({ enhet: 'nmol/l' }))).toMatch(/ikke gyldig/)
      expect(await avvisning(testregelsett({ enhet: 'mg' }))).toMatch(/ikke gyldig/)
    })

    it('med nivåer som ikke følger konsentrasjonen', async () => {
      const r = testregelsett()
      const byttet = r.intervaller.map((i, n) => (n === 0 ? { ...i, niva: 'over' as const } : i))
      expect(await avvisning({ ...r, intervaller: byttet })).toMatch(/Nivåene/)
    })

    it('med «ring rekvirent» som ikke gjelder alt over ringegrensen', async () => {
      const r = testregelsett()
      const hull = r.intervaller.map((i, n) => (n === 3 ? { ...i, handling: null } : i))
      expect(await avvisning(r, { ...utenKommentarer(r), intervaller: hull })).toMatch(/Alle intervallene over/)
      const nederst = r.intervaller.map((i) => ({ ...i, handling: 'ring_rekvirent' as const }))
      expect(await avvisning(r, { ...utenKommentarer(r), intervaller: nederst })).toMatch(/nederste/)
    })

    it('med en ringegrense som mangler, er til overs eller ikke stemmer med intervallene', async () => {
      const r = testregelsett()
      const med = (endring: Partial<Intervallregelsettinnhold>) => avvisning(r, { ...utenKommentarer(r), ...endring })
      expect(await med({ ringegrense: null })).toMatch(/Ringegrensen mangler/)
      expect(await med({ ringegrense: 30 })).toMatch(/stemmer ikke/)
      expect(await med({ ringegrense: 39.85 })).toMatch(/desimaler/)
      expect(await med({ intervaller: r.intervaller.map((i) => ({ ...i, handling: null })) })).toMatch(/ingen intervaller/)
      // Grensen der ringingen begynner, og tallet rett under, er begge gyldige.
      expect(await avvisning(testregelsett({ ringegrense: 40 }))).toBeNull()
    })

    it('med en cut-off som ikke bygger på en av kommentarene intervallene gir', async () => {
      const r = testregelsett()
      const cutoff = r.cutoff!
      const med = (ny: typeof cutoff) => avvisning(r, { ...utenKommentarer(r), cutoff: ny })
      expect(await med({ ...cutoff, kommentar: cutoff.innledning })).toMatch(/egen kommentar/)
      expect(await med({ ...cutoff, kommentar: importId('ukjent') })).toMatch(/bygge på/)
      expect(await med({ ...cutoff, innledning: importId('ukjent') })).toMatch(/cutoff_innledning_id må peke på/)
    })

    it('for en analyttkode som alt har et regelsett', async () => {
      const r = testregelsett({ analyttkode: 'AMTNORSUM' })
      expect(await avvisning(r)).toMatch(/alt et regelsett/)
    })

    it('med et ukjent felt, også tekster i regelsettet som ikke stemmer med kommentarene', async () => {
      const r = testregelsett()
      expect(await avvisning(r, { ...utenKommentarer(r), tekst: 'Løs tekst.' })).toMatch(/Ukjente felt: tekst/)
      const eldre = (kommentarer: unknown) => avvisning(r, { ...utenKommentarer(r), kommentarer })
      expect(await eldre([...r.kommentarer, { id: importId('løs'), tekst: 'Løs.' }])).toMatch(/stemmer ikke/)
      expect(await eldre(r.kommentarer.slice(1))).toMatch(/stemmer ikke/)
      expect(await eldre('Løs tekst.')).toMatch(/liste/)
    })
  })

  it('godtar en revisjon fra før kommentarene ble egne objekter, men lagrer den uten tekstene', async () => {
    const r = testregelsett()
    await opprettKommentarer(r, false)
    const eldre = { ...utenKommentarer(r), kommentarer: r.kommentarer.map((k) => ({ ...k, tekst: `Eldre ${k.tekst}` })) }
    const status = await kall.opprett('intervallregelsett', eldre as Intervallregelsettinnhold)
    const [revisjon] = await kall.revisjoner(status.id)
    expect(revisjon!.innhold).toEqual(utenKommentarer(r))
    const tekster = await kall.fasit<{ tekst: string }>(
      `select tekst from public.kommentarer where objekt_id = any($1::uuid[]) and tilstand = 'utkast' order by tekst`,
      [r.kommentarer.map((k) => k.id)],
    )
    expect(tekster.map((t) => t.tekst)).toEqual(r.kommentarer.map((k) => k.tekst).sort())
  })

  it('publiserer ikke et regelsett før kommentarene det peker på er publisert', async () => {
    const r = testregelsett()
    const status = await opprettRegelsett(r)
    const feil = await feilFra(() => kall.publiser(status.id, 1))
    expect(feil?.message).toMatch(/ikke er publisert/)
    for (const { id } of r.kommentarer) await kall.publiser(id, 1)
    expect((await kall.publiser(status.id, 1)).publisert_revisjon).toBe(1)
    await kall.forventSamsvar(status.id)
  })

  it('stopper intervaller med hull eller overlapp også om noe skulle skrive dem utenom', async () => {
    const status = await opprettRegelsett(testregelsett())
    const prov = async (sql: string) => {
      await db.exec('begin')
      try {
        await db.query(sql, [status.id])
        const feil = await feilFra(() =>
          db.query(`select intern.krev_sammenhengende_intervaller($1, 'utkast')`, [status.id]),
        )
        return feil?.message ?? null
      } finally {
        await db.exec('rollback')
      }
    }
    expect(await prov(`update public.intervallregler set fra = 45 where regelsett_id = $1 and posisjon = 3`)).toMatch(
      /hull/,
    )
    expect(await prov(`update public.intervallregler set fra = 30 where regelsett_id = $1 and posisjon = 3`)).toMatch(
      /overlapper/,
    )
    expect(await prov(`update public.intervallregler set til = 70 where regelsett_id = $1 and posisjon = 4`)).toMatch(
      /åpent oppover/,
    )
    expect(await prov(`select 1 where $1::uuid is not null`)).toBeNull()
  })

  it('lar bare administratorer endre, og vanlige brukere lese bare det publiserte', async () => {
    const feil = await feilFra(() => opprettRegelsett(testregelsett(), { av: bruker }))
    expect(feil?.code).toBe('42501')

    const status = await opprettRegelsett(testregelsett())
    const utkastForBruker = await lesRegelsett(bruker, 'utkast')
    expect(utkastForBruker).toEqual([])
    expect((await lesRegelsett(bruker, 'publisert')).some((u) => u.id === status.id)).toBe(false)
    expect((await lesRegelsett(admin, 'utkast')).some((u) => u.id === status.id)).toBe(true)

    for (const tabell of ['intervallregelsett', 'intervallregler']) {
      const rader = await kall.les<{ tilstand: string }>(bruker, `select tilstand from public.${tabell}`)
      expect(rader.every((r) => r.tilstand === 'publisert'), tabell).toBe(true)
      const skriv = await feilFra(() =>
        som(db, admin, (tx) => tx.query(`delete from public.${tabell}`)),
      )
      expect(skriv?.code, tabell).toBe('42501')
    }

    const lagring = 'public.lagre_intervallregelsett(uuid, integer, jsonb, jsonb)'
    for (const rolle of ['anon', 'authenticated', 'service_role']) {
      const [rad] = await kall.fasit<{ har: boolean }>(`select has_function_privilege($1, $2, 'EXECUTE') as har`, [rolle, lagring])
      expect(rad!.har, rolle).toBe(rolle === 'authenticated')
    }

    const anon = await feilFra(() => lesRegelsett(null, 'publisert'))
    expect(anon?.code).toBe('42501')
  })

  it('versjonerer, publiserer og gjenoppretter hele regelsettet på én gang', async () => {
    const forste = testregelsett()
    const opprettet = await opprettRegelsett(forste, { publiserKommentarer: true })
    const publisert = await kall.publiser(opprettet.id, 1)
    expect(publisert.publisert_revisjon).toBe(1)

    // Ny grense og en regel mindre, i én lagring.
    const andre: Intervallregelsettinnhold = {
      ...utenKommentarer(forste),
      skillepunkter: [5, 40],
      intervaller: forste.intervaller.slice(0, 2).concat({ ...forste.intervaller[3]! }),
      ringegrense: 40,
    }
    const lagret = await kall.lagre(opprettet.id, 1, andre)
    expect(lagret.revisjon).toBe(2)

    // Det publiserte er uendret til utkastet publiseres.
    const lest = async (tilstand: 'utkast' | 'publisert') =>
      (await lesRegelsett(admin, tilstand)).find((u) => u.id === opprettet.id)!.innhold
    expect(await lest('publisert')).toEqual(utenKommentarer(forste))
    expect(await lest('utkast')).toEqual(andre)

    // En gammel nettleserøkt kan ikke lagre over den nye revisjonen.
    const konflikt = await feilFra(() => kall.lagre(opprettet.id, 1, utenKommentarer(forste)))
    expect(konflikt?.code).toBe('PT409')

    // Gjenopprettingen lager en ny revisjon med alt fra den første.
    const gjenopprettet = await kall.gjenopprett(opprettet.id, 2, 1)
    expect(gjenopprettet.revisjon).toBe(3)
    expect(await lest('utkast')).toEqual(utenKommentarer(forste))
    const revisjoner = await kall.revisjoner(opprettet.id)
    expect(revisjoner.map((r) => [r.revisjon, r.handling, r.gjenopprettet_fra])).toEqual([
      [1, 'opprettet', null],
      [2, 'endret', null],
      [3, 'gjenopprettet', 1],
    ])
    expect(revisjoner[1]!.innhold).toEqual(andre)
    expect(revisjoner[2]!.utfort_av).toBe(admin)
    await kall.forventSamsvar(opprettet.id)
  })

  it('kan ikke publisere eller gjenopprette et ugyldig regelsett halvveis', async () => {
    const r = testregelsett()
    const opprettet = await opprettRegelsett(r)
    const feil = await feilFra(() => kall.lagre(opprettet.id, 1, { ...utenKommentarer(r), skillepunkter: [40, 2.5, 60] }))
    expect(feil?.code).toBe('22023')
    const [status] = await kall.fasit<{ revisjon: number }>(
      'select revisjon from public.objektstatus where id = $1',
      [opprettet.id],
    )
    expect(status!.revisjon).toBe(1)
    await kall.forventSamsvar(opprettet.id)
  })
})

/* --- 4. Redigeringen ------------------------------------------------------ */

describe('redigeringen mot databasen', () => {
  /** Lagrer det redigeringen viser, slik appen gjør: regelsettet og kommentarene sammen. */
  function lagreRedigert(objekt: string, revisjon: number, regelsett: Intervallregelsett, kommentarer: unknown[], av = admin) {
    return kall.rpc(av, 'lagre_intervallregelsett', {
      objekt,
      forventet_revisjon: revisjon,
      innhold: utenKommentarer(regelsett),
      kommentarer,
    })
  }

  it('lagrer regelsettet og de nye og endrede kommentarene sammen, alt eller ingenting', async () => {
    const leser = lagFaginnholdsleser(kall.klientFor(admin))
    const r = testregelsett()
    await opprettRegelsett(r)
    const utgave = (await leser.finnIntervallregelsett(r.analyttkode, 'utkast'))!
    expect(losRegelsett(utgave)).toEqual(ordnet(r))

    // Intervall 3 får sin egen kommentar, og teksten til den nederste endres.
    const nyId = importId('redigering', r.analyttkode)
    let endret = egenKommentar(losRegelsett(utgave), 2, () => nyId)
    endret = settKommentartekst(endret, nyId, 'Ny syntetisk kommentar.')
    endret = settKommentartekst(endret, r.intervaller[0]!.kommentar, 'Endret syntetisk kommentar.')
    const endringer = kommentarendringer(endret, utgave.kommentarer)
    expect(endringer.map((e) => [e.id, e.revisjon])).toEqual([
      [r.intervaller[0]!.kommentar, 1],
      [nyId, null],
    ])

    const objekter = async () => (await kall.fasit<{ n: number }>('select count(*)::int as n from public.redigerbare_objekter'))[0]!.n
    const for_ = await objekter()

    // Med en kommentar som er endret i mellomtiden, lagres ingenting.
    const gammel = endringer.map((e) => (e.revisjon === null ? e : { ...e, revisjon: 0 }))
    expect((await feilFra(() => lagreRedigert(utgave.regelsett.id, 1, endret, gammel)))?.code).toBe('PT409')
    expect(await objekter()).toBe(for_)
    expect((await feilFra(() => lagreRedigert(utgave.regelsett.id, 1, endret, endringer, bruker)))?.code).toBe('42501')

    const status = await lagreRedigert(utgave.regelsett.id, 1, endret, endringer)
    expect(status.revisjon).toBe(2)
    expect(await objekter()).toBe(for_ + 1)
    const lest = (await leser.finnIntervallregelsett(r.analyttkode, 'utkast'))!
    expect(losRegelsett(lest)).toEqual(ordnet(endret))
    const ny = lest.kommentarer.find((k) => k.id === nyId)!
    expect(ny.innhold.navn).toBe(`${r.analyttkode} – innenfor referanseområdet, ring rekvirent`)
    expect(ny.revisjon).toBe(1)
    expect(lest.kommentarer.find((k) => k.id === r.intervaller[0]!.kommentar)!.revisjon).toBe(2)

    // En ny kommentar kan ikke ta ID-en til noe som finnes, og en endret må være en kommentar.
    const tatt = [{ id: nyId, revisjon: null, innhold: { navn: 'Syntetisk', tekst: 'Syntetisk.', plassholdere: [] } }]
    expect((await feilFra(() => lagreRedigert(utgave.regelsett.id, 2, endret, tatt)))?.message).toMatch(/alt et objekt/)
    const feilType = [{ id: utgave.regelsett.id, revisjon: 2, innhold: tatt[0]!.innhold }]
    expect((await feilFra(() => lagreRedigert(utgave.regelsett.id, 2, endret, feilType)))?.code).toBe('PT404')
  })

  it('lager regelsett databasen godtar, for hver analytt og hver slags endring', async () => {
    let n = 0
    const nyId = () => importId('redigering', String(++n))
    const leser = lagFaginnholdsleser(kall.klientFor(admin))
    const utkast = await lesRegelsett(admin, 'utkast')
    const importerte = utkast.filter((u) => analytes.some((a) => a.kode === u.innhold.analyttkode))
    expect(importerte.length).toBe(analytes.length)

    for (const { innhold } of importerte) {
      const utgave = (await leser.finnIntervallregelsett(innhold.analyttkode, 'utkast'))!
      const r = losRegelsett(utgave)
      const toppen = r.skillepunkter.at(-1) ?? 1
      // Alle endringene redigeringen kan gjøre, etter hverandre: en ny grense
      // øverst, en flyttet grense, en egen kommentar, ringingen fra det nye
      // intervallet, cut-off av eller på, og til sist en sammenslåing.
      let endret = delIntervall(r, r.skillepunkter.length, toppen * 2)
      endret = settSkillepunkt(endret, endret.skillepunkter.length - 1, toppen * 3)
      endret = egenKommentar(endret, endret.intervaller.length - 1, nyId)
      endret = settKommentartekst(endret, importId('redigering', String(n)), ` Syntetisk ${r.analyttkode}. `)
      endret = settRing(endret, { indeks: endret.intervaller.length - 1, over: r.analyttkode.length % 2 === 0 })
      endret = settCutoff(endret, !r.cutoff, nyId)
      if (endret.cutoff && !r.cutoff) endret = settKommentartekst(endret, endret.cutoff.innledning, 'Syntetisk innledning.')
      endret = klargjor(slaSammen(endret, 0))
      expect(kontrollerRegelsett(endret), r.analyttkode).toBeNull()

      const status = await lagreRedigert(
        utgave.regelsett.id,
        utgave.regelsett.revisjon,
        endret,
        kommentarendringer(endret, utgave.kommentarer),
      )
      expect(status.revisjon, r.analyttkode).toBe(utgave.regelsett.revisjon + 1)
      const lest = (await leser.finnIntervallregelsett(r.analyttkode, 'utkast'))!
      expect(losRegelsett(lest), r.analyttkode).toEqual(ordnet(endret))
      expect(endret.ringegrense).toBe(
        Math.round((toppen * 3 - (r.analyttkode.length % 2 === 0 ? steg(r.desimaler) : 0)) * 10 ** r.desimaler) /
          10 ** r.desimaler,
      )
    }
  })

  it('leser regelsettet for én kode med kommentarene, og historikken med hvem og når, med radsikkerheten', async () => {
    const leser = lagFaginnholdsleser(kall.klientFor(admin))
    const vanlig = lagFaginnholdsleser(kall.klientFor(bruker))
    const forste = testregelsett()
    const opprettet = await opprettRegelsett(forste, { publiserKommentarer: true })
    await kall.publiser(opprettet.id, 1)
    const andre = utenKommentarer(settSkillepunkt(forste, 0, 3))
    await kall.lagre(opprettet.id, 1, andre)
    await kall.gjenopprett(opprettet.id, 2, 1)

    const utkast = (await leser.finnIntervallregelsett(forste.analyttkode, 'utkast'))!
    expect(utkast.regelsett.innhold).toEqual(utenKommentarer(forste))
    expect(utkast.regelsett.revisjon).toBe(3)
    expect(losRegelsett(utkast)).toEqual(ordnet(forste))
    const publisert = (await vanlig.finnIntervallregelsett(forste.analyttkode, 'publisert'))!
    expect(losRegelsett(publisert)).toEqual(ordnet(forste))
    expect(publisert.kommentarer.every((k) => k.publisert_revisjon === 1)).toBe(true)
    expect(await vanlig.finnIntervallregelsett(forste.analyttkode, 'utkast')).toBeNull()
    expect(await leser.finnIntervallregelsett('FINNESIKKE', 'publisert')).toBeNull()

    const historikk = await leser.lesHistorikk<Intervallregelsettinnhold>(opprettet.id)
    expect(historikk.hendelser.map((h) => [h.handling, h.revisjon, h.gjenopprettet_fra ?? null])).toEqual([
      ['opprettet', 1, null],
      ['publisert', 1, null],
      ['endret', 2, null],
      ['gjenopprettet', 3, 1],
    ])
    expect(historikk.hendelser.every((h) => h.utfort_av_fornavn === 'Ada' && h.utfort_av_etternavn === 'Adminsen')).toBe(true)
    expect(historikk.hendelser.every((h) => !Number.isNaN(Date.parse(h.utfort_kl)))).toBe(true)
    expect(historikk.revisjoner.map((r) => r.revisjon)).toEqual([1, 2, 3])
    expect(historikk.revisjoner[1]!.innhold).toEqual(andre)

    // En vanlig bruker ser bare det som har vært publisert.
    const forBruker = await vanlig.lesHistorikk<Intervallregelsettinnhold>(opprettet.id)
    expect(forBruker.revisjoner.map((r) => r.revisjon)).toEqual([1])
    expect(forBruker.hendelser.map((h) => [h.handling, h.revisjon])).toEqual([
      ['opprettet', 1],
      ['publisert', 1],
    ])

    // Importerte revisjoner har kilden med seg, også kommentarenes.
    const importert = (await lesRegelsett(admin, 'publisert'))[0]!
    expect((await leser.lesHistorikk(importert.id)).hendelser[0]!.kilde).toMatch(/Importert/)
    const kommentar = importert.innhold.intervaller[0]!.kommentar
    expect((await leser.lesHistorikk(kommentar)).hendelser[0]!.kilde).toMatch(/Importert/)

    expect(await leser.lesHistorikk('00000000-0000-0000-0000-000000000000')).toEqual({ hendelser: [], revisjoner: [] })
    const anon = await feilFra(() => kall.rpc(null, 'les_historikk', { objekt: opprettet.id }))
    expect(anon?.code).toBe('42501')
  })
})
