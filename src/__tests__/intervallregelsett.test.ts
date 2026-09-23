/**
 * Regelsettene for de enkle konsentrasjonsreglene, prøvd mot en ekte database.
 *
 * Tre ting prøves her:
 *
 * 1. Importen: importdatasettet er nøyaktig det dagens statiske regler og
 *    kommentarer gir, for hver analytt med konsentrasjonsbånd, og importen
 *    legger det inn og publiserer det med kilden på hver revisjon.
 * 2. Pariteten: den nye motoren, brukt på regelsettene slik en vanlig bruker
 *    leser dem fra databasen, gir det samme som dagens motor — alle knappene,
 *    kommentarene, «ring rekvirent» og cut-off, og regelen hver konsentrasjon
 *    treffer, på og rundt hver grense.
 * 3. Reglene databasen håndhever: kontrollen av grenser, kommentarer, enhet og
 *    handlinger, rettighetene, og at hele regelsettet versjoneres, publiseres
 *    og gjenopprettes på én gang.
 *
 * Regelsettene som opprettes i del 3, er syntetiske, med koder som ikke finnes.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { analytes } from '../domain/analytes'
import { bands } from '../domain/bands'
import { classify } from '../domain/concentration'
import { cutoffkommentar, finnRegel, intervallene, ringes } from '../domain/intervallregler'
import { cutoffKommentar, cutoffvalg, harCutoffvalg, regelsettvalg, valgene } from '../domain/valg'
import { lagFaginnholdsleser, type Utgave } from '../faginnhold/lesing'
import type { Objektstatus } from '../faginnhold/modell'
import { importdel, regelimportSql, type Regelimport } from '../regler/import'
import {
  KONSENTRASJONSNIVAER,
  MALEENHETER,
  REGELHANDLINGER,
  type Intervallregelsett,
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
import { importId, importkilde, regelimport, regelimportdata } from './hjelp/regelimport'
import {
  faginnholdskall,
  feilFra,
  nyDatabase,
  opprettBruker,
  som,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const IMPORTDATASETT = fileURLToPath(new URL('../../supabase/import/intervallregelsett.json', import.meta.url))
const importdatasett = JSON.parse(readFileSync(IMPORTDATASETT, 'utf8')) as Regelimport[]
const MIGRASJONER = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))
/** Administratoren som bestilte importen til produksjon. */
const IMPORTADMIN = 'peohol'

let db: PGlite
let admin: string
let bruker: string
let kall: Faginnholdskall

/** Regelsettene i én tilstand, slik appen leser dem. */
async function lesRegelsett(brukerId: string | null, tilstand: 'utkast' | 'publisert') {
  const rad = await kall.rpc<{ les_intervallregelsett: Utgave<Intervallregelsett>[] }>(
    brukerId,
    'les_intervallregelsett',
    { sidetilstand: tilstand },
  )
  return rad.les_intervallregelsett
}

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'regel.admin', fornavn: 'Ada', etternavn: 'Adminsen', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'regel.bruker', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  await db.exec(regelimportSql(importdatasett, 'regel.admin'))
}, 60_000)

/* --- 1. Importen ---------------------------------------------------------- */

describe('importen av dagens regler', () => {
  it('er nøyaktig det de statiske datasettene gir', () => {
    expect(importdatasett).toEqual(regelimportdata())
  })

  it('kan kjøres igjen uten å legge inn noe to ganger', async () => {
    const for_ = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    await db.exec(regelimportSql(importdatasett, 'regel.admin'))
    const etter = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    expect(etter).toEqual(for_)
  })

  it('krever en administrator', async () => {
    const feil = await feilFra(() => db.exec(regelimportSql(importdatasett, 'regel.bruker')))
    expect(feil?.message).toMatch(/Fant ingen administrator/)
  })

  it('ligger som datamigreringer som til sammen er nøyaktig importen av datasettet', () => {
    const filer = readdirSync(MIGRASJONER)
      .filter((f) => /_importer_intervallregelsett_\d+\.sql$/.test(f))
      .sort()
    expect(filer.length).toBeGreaterThan(0)
    filer.forEach((fil, i) => {
      expect(fil.endsWith(`_${i + 1}.sql`)).toBe(true)
      const del = importdel(importdatasett, i + 1, filer.length)
      expect(readFileSync(join(MIGRASJONER, fil), 'utf8')).toBe(regelimportSql(del, IMPORTADMIN, 'hopp over'))
    })
  })

  it('deler importen i sammenhengende porsjoner uten å miste eller gjenta noe', () => {
    for (const antall of [1, 4, 6, 7, 60]) {
      const deler = Array.from({ length: antall }, (_, i) => importdel(importdatasett, i + 1, antall))
      expect(deler.flat()).toEqual(importdatasett)
      expect(Math.max(...deler.map((d) => d.length)) - Math.min(...deler.map((d) => d.length))).toBeLessThanOrEqual(1)
    }
    expect(() => importdel(importdatasett, 0, 6)).toThrow()
    expect(() => importdel(importdatasett, 7, 6)).toThrow()
  })

  it('stopper før noe legges inn når dataene er endret etter at SQL-en ble laget', async () => {
    const sql = regelimportSql(importdatasett, 'regel.admin').replace('"analyttkode":"AMIS"', '"analyttkode":"AMIX"')
    const for_ = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    const feil = await feilFra(() => db.exec(sql))
    expect(feil?.message).toMatch(/kontrollsummen stemmer ikke/)
    expect(await kall.fasit('select count(*)::int as antall from public.objektrevisjoner')).toEqual(for_)
  })

  it('gjør ingenting som datamigrering når administratoren mangler', async () => {
    const for_ = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    await db.exec(regelimportSql(importdatasett, 'regel.bruker', 'hopp over'))
    const etter = await kall.fasit<{ antall: number }>('select count(*)::int as antall from public.objektrevisjoner')
    expect(etter).toEqual(for_)
  })

  it('gir ett publisert regelsett per analytt med konsentrasjonsbånd, med kilden', async () => {
    const publisert = await lesRegelsett(bruker, 'publisert')
    expect(publisert.map((u) => u.innhold.analyttkode).sort()).toEqual(analytes.map((a) => a.kode).sort())

    for (const utgave of publisert) {
      const analyte = analytes.find((a) => a.kode === utgave.innhold.analyttkode)!
      expect(utgave.revisjon).toBe(1)
      expect(utgave.publisert_revisjon).toBe(1)
      expect(utgave.endret_av_fornavn).toBe('Ada')
      const [revisjon] = await kall.fasit<{ kilde: string; handling: string; utfort_av: string }>(
        'select kilde, handling, utfort_av from public.objektrevisjoner where objekt_id = $1',
        [utgave.id],
      )
      expect(revisjon).toEqual({ kilde: importkilde(analyte), handling: 'opprettet', utfort_av: admin })
    }
  })

  it('lagrer regelsettene nøyaktig slik de ble importert', async () => {
    const publisert = await lesRegelsett(bruker, 'publisert')
    const etterKode = new Map(publisert.map((u) => [u.innhold.analyttkode, u.innhold]))
    for (const regelsett of regelimport()) {
      expect(etterKode.get(regelsett.analyttkode), regelsett.analyttkode).toEqual(regelsett)
    }
  })

  it('lagrer hver kommentar én gang, også når flere regler bruker den', async () => {
    for (const regelsett of regelimport()) {
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
  })
})

/* --- 2. Pariteten --------------------------------------------------------- */

describe('den nye motoren mot dagens', () => {
  let regelsett: Map<string, Intervallregelsett>

  beforeAll(async () => {
    const publisert = await lesRegelsett(bruker, 'publisert')
    regelsett = new Map(publisert.map((u) => [u.innhold.analyttkode, u.innhold]))
  })

  it('gir de samme knappene, med samme nøkler, farger, tekster og kommentarer', () => {
    for (const analyte of analytes) {
      expect(regelsettvalg(regelsett.get(analyte.kode)!), analyte.kode).toEqual(valgene(analyte))
    }
  })

  it('gir den samme cut-off-kommentaren, og bare for de samme analyttene', () => {
    for (const analyte of analytes) {
      const ny = cutoffkommentar(regelsett.get(analyte.kode)!)
      expect(ny, analyte.kode).toBe(harCutoffvalg(analyte) ? cutoffKommentar(analyte) : null)
      expect(ny !== null, analyte.kode).toBe(cutoffvalg(analyte) !== null)
    }
  })

  it('gir den samme ringegrensen og ringer i de samme båndene', () => {
    for (const analyte of analytes) {
      const nytt = regelsett.get(analyte.kode)!
      expect(nytt.ringegrense, analyte.kode).toBe(analyte.ringegrense)
      expect(intervallene(nytt).map(ringes), analyte.kode).toEqual(bands(analyte).map((b) => b.ring))
    }
  })

  it('plasserer hver konsentrasjon på, rett under og rett over hver grense likt', () => {
    let prøvd = 0
    for (const analyte of analytes) {
      const nytt = regelsett.get(analyte.kode)!
      const steg = 10 ** -nytt.desimaler
      const gamle = bands(analyte)
      const rund = (v: number) => Number((Math.round(v / steg) * steg).toFixed(nytt.desimaler))

      // Alle grensene fra begge motorene, og verdiene rundt dem i hele steg.
      const grenser = new Set<number>([
        ...nytt.skillepunkter,
        ...gamle.flatMap((b) => [b.fra, b.til].filter((v): v is number => v !== null)),
        analyte.nedreGrense,
        analyte.ovreGrense,
        ...(analyte.ringegrense === null ? [] : [analyte.ringegrense]),
      ])
      const verdier = [...grenser].flatMap((g) => [g - 2 * steg, g - steg, g, g + steg, g + 2 * steg].map(rund))
      verdier.push(0, rund(steg), rund(Math.max(...grenser) * 10))

      for (const verdi of verdier.filter((v) => v >= 0)) {
        const gammelt = gamle.find((b) => (b.fra === null || verdi >= b.fra - steg / 2) && (b.til === null || verdi <= b.til + steg / 2))
        const treff = finnRegel(nytt, verdi)
        const hvor = `${analyte.kode} ${verdi}`
        expect(gammelt, hvor).toBeDefined()
        expect(regelsettvalg(nytt)[treff.indeks]?.key, hvor).toBe(gammelt!.key)
        expect(ringes(treff), hvor).toBe(gammelt!.ring)
        expect(treff.kommentar.tekst, hvor).toBe(gammelt!.kommentar)
        expect(treff.niva, hvor).toBe(classify(analyte, verdi))
        prøvd += 1
      }

      // Også mellom de hele stegene følger nivået den kanoniske regelen.
      for (const g of grenser) {
        for (const verdi of [g - steg / 2, g - steg / 10, g + steg / 10, g + steg / 2].filter((v) => v >= 0)) {
          expect(finnRegel(nytt, verdi).niva, `${analyte.kode} ${verdi}`).toBe(classify(analyte, verdi))
        }
      }
    }
    expect(prøvd).toBeGreaterThan(analytes.length * 10)
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

async function opprettRegelsett(innhold: Intervallregelsett, av = admin): Promise<Objektstatus> {
  return kall.opprett('intervallregelsett', innhold, av)
}

/** Feilmeldingen databasen gir for innholdet, eller `null` når det godtas. */
async function avvisning(innhold: Intervallregelsett) {
  const feil = await feilFra(() => opprettRegelsett(innhold))
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

  it('lagrer et regelsett og gir det tilbake nøyaktig som det ble sendt', async () => {
    const innhold = testregelsett()
    const status = await opprettRegelsett(innhold)
    const [revisjon] = await kall.revisjoner(status.id)
    expect(revisjon!.innhold).toEqual(innhold)
    await kall.forventSamsvar(status.id)

    // Kommentaren og regelen står i hver sin tabell: tre intervaller, men to
    // bruker den samme kommentaren, som står én gang.
    const regler = await kall.fasit('select * from public.intervallregler where regelsett_id = $1', [status.id])
    const kommentarer = await kall.fasit('select * from public.regelsettkommentarer where regelsett_id = $1', [status.id])
    expect(regler).toHaveLength(4)
    expect(kommentarer).toHaveLength(4)
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
      expect(
        await avvisning({ ...testregelsett(), skillepunkter: ['2,5', 40, 60] as unknown as number[] }),
      ).toMatch(/tall/)
    })

    it('med feil antall intervaller i forhold til grensene', async () => {
      const r = testregelsett()
      expect(await avvisning({ ...r, skillepunkter: [2.5, 40] })).toMatch(/ett intervall mer/)
      expect(await avvisning({ ...r, intervaller: [] , skillepunkter: []})).toMatch(/minst ett intervall/)
    })

    it('med et intervall uten kommentar, eller med en kommentar som ikke finnes', async () => {
      const r = testregelsett()
      const utenKommentar = r.intervaller.map((i, n) => (n === 1 ? { ...i, kommentar: null } : i))
      expect(await avvisning({ ...r, intervaller: utenKommentar as never })).toMatch(/mangler kommentar/)
      const ukjent = r.intervaller.map((i, n) => (n === 0 ? { ...i, kommentar: importId('ukjent') } : i))
      expect(await avvisning({ ...r, intervaller: ukjent })).toMatch(/ikke finnes|ingen regel bruker/)
    })

    it('med en kommentar ingen regel bruker', async () => {
      const r = testregelsett()
      expect(
        await avvisning({ ...r, kommentarer: [...r.kommentarer, { id: importId('løs'), tekst: 'Løs.' }] }),
      ).toMatch(/ingen regel bruker/)
    })

    it('med en kommentar som er tom eller ikke er ren tekst på én linje', async () => {
      const r = testregelsett()
      const med = (tekst: string) => ({ ...r, kommentarer: r.kommentarer.map((k, n) => (n === 0 ? { ...k, tekst } : k)) })
      expect(await avvisning(med('  '))).toMatch(/tom/)
      expect(await avvisning(med('To\nlinjer'))).toMatch(/ren tekst/)
      expect(await avvisning(med('Med\ttabulator'))).toMatch(/ren tekst/)
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
      expect(await avvisning({ ...r, intervaller: hull })).toMatch(/Alle intervallene over/)
      const nederst = r.intervaller.map((i) => ({ ...i, handling: 'ring_rekvirent' as const }))
      expect(await avvisning({ ...r, intervaller: nederst })).toMatch(/nederste/)
    })

    it('med en ringegrense som mangler, er til overs eller ikke stemmer med intervallene', async () => {
      const r = testregelsett()
      expect(await avvisning({ ...r, ringegrense: null })).toMatch(/Ringegrensen mangler/)
      expect(await avvisning({ ...r, ringegrense: 30 })).toMatch(/stemmer ikke/)
      expect(await avvisning({ ...r, ringegrense: 39.85 })).toMatch(/desimaler/)
      const utenRing = r.intervaller.map((i) => ({ ...i, handling: null }))
      expect(await avvisning({ ...r, intervaller: utenRing })).toMatch(/ingen intervaller/)
      // Grensen der ringingen begynner, og tallet rett under, er begge gyldige.
      expect(await avvisning(testregelsett({ ringegrense: 40 }))).toBeNull()
    })

    it('med en cut-off som ikke bygger på en av kommentarene', async () => {
      const r = testregelsett()
      const lav = r.intervaller[0]!.kommentar
      const cutoff = r.cutoff!
      expect(await avvisning({ ...r, cutoff: { ...cutoff, kommentar: cutoff.innledning } })).toMatch(/egen kommentar/)
      expect(await avvisning({ ...r, cutoff: { ...cutoff, kommentar: importId('ukjent') } })).toMatch(/bygge på/)
      expect(await avvisning({ ...r, cutoff: { innledning: lav, kommentar: cutoff.kommentar } })).toMatch(
        /ingen regel bruker/,
      )
    })

    it('for en analyttkode som alt har et regelsett', async () => {
      const r = testregelsett({ analyttkode: 'AMTNORSUM' })
      expect(await avvisning(r)).toMatch(/alt et regelsett/)
    })
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
    const feil = await feilFra(() => opprettRegelsett(testregelsett(), bruker))
    expect(feil?.code).toBe('42501')

    const status = await opprettRegelsett(testregelsett())
    const utkastForBruker = await lesRegelsett(bruker, 'utkast')
    expect(utkastForBruker).toEqual([])
    expect((await lesRegelsett(bruker, 'publisert')).some((u) => u.id === status.id)).toBe(false)
    expect((await lesRegelsett(admin, 'utkast')).some((u) => u.id === status.id)).toBe(true)

    for (const tabell of ['intervallregelsett', 'intervallregler', 'regelsettkommentarer']) {
      const rader = await kall.les<{ tilstand: string }>(bruker, `select tilstand from public.${tabell}`)
      expect(rader.every((r) => r.tilstand === 'publisert'), tabell).toBe(true)
      const skriv = await feilFra(() =>
        som(db, admin, (tx) => tx.query(`delete from public.${tabell}`)),
      )
      expect(skriv?.code, tabell).toBe('42501')
    }

    const anon = await feilFra(() => lesRegelsett(null, 'publisert'))
    expect(anon?.code).toBe('42501')
  })

  it('versjonerer, publiserer og gjenoppretter hele regelsettet på én gang', async () => {
    const forste = testregelsett()
    const opprettet = await opprettRegelsett(forste)
    const publisert = await kall.publiser(opprettet.id, 1)
    expect(publisert.publisert_revisjon).toBe(1)

    // Ny grense, ny kommentartekst og en regel mindre, i én lagring.
    const andre: Intervallregelsett = {
      ...forste,
      skillepunkter: [5, 40],
      intervaller: forste.intervaller.slice(0, 2).concat({ ...forste.intervaller[3]! }),
      ringegrense: 40,
      kommentarer: forste.kommentarer.map((k, n) => (n === 1 ? { ...k, tekst: 'Endret syntetisk kommentar.' } : k)),
    }
    const lagret = await kall.lagre(opprettet.id, 1, andre)
    expect(lagret.revisjon).toBe(2)

    // Det publiserte er uendret til utkastet publiseres.
    const lest = async (tilstand: 'utkast' | 'publisert') =>
      (await lesRegelsett(admin, tilstand)).find((u) => u.id === opprettet.id)!.innhold
    expect(await lest('publisert')).toEqual(forste)
    expect(await lest('utkast')).toEqual(andre)

    // En gammel nettleserøkt kan ikke lagre over den nye revisjonen.
    const konflikt = await feilFra(() => kall.lagre(opprettet.id, 1, forste))
    expect(konflikt?.code).toBe('PT409')

    // Gjenopprettingen lager en ny revisjon med alt fra den første.
    const gjenopprettet = await kall.gjenopprett(opprettet.id, 2, 1)
    expect(gjenopprettet.revisjon).toBe(3)
    expect(await lest('utkast')).toEqual(forste)
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
    const opprettet = await opprettRegelsett(testregelsett())
    const feil = await feilFra(() =>
      kall.lagre(opprettet.id, 1, { ...testregelsett(), skillepunkter: [40, 2.5, 60] }),
    )
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
  it('lager regelsett databasen godtar, for hver analytt og hver slags endring', async () => {
    let n = 0
    const nyId = () => importId('redigering', String(++n))
    const publisert = await lesRegelsett(admin, 'utkast')
    expect(publisert.length).toBeGreaterThan(0)

    for (const utgave of publisert) {
      const r = utgave.innhold
      const toppen = r.skillepunkter.at(-1) ?? 1
      // Alle endringene redigeringen kan gjøre, etter hverandre: en ny grense
      // øverst, en flyttet grense, en egen kommentar, ringingen fra det nye
      // intervallet, cut-off av eller på, og til sist en sammenslåing.
      let endret = delIntervall(r, r.skillepunkter.length, toppen * 2)
      endret = settSkillepunkt(endret, endret.skillepunkter.length - 1, toppen * 3)
      endret = settKommentartekst(egenKommentar(endret, endret.intervaller.length - 1, nyId), `redigering-${n}`, ` Syntetisk ${r.analyttkode}. `)
      endret = settRing(endret, { indeks: endret.intervaller.length - 1, over: r.analyttkode.length % 2 === 0 })
      endret = settCutoff(endret, !r.cutoff, nyId)
      if (endret.cutoff && !r.cutoff) endret = settKommentartekst(endret, endret.cutoff.innledning, 'Syntetisk innledning.')
      endret = klargjor(slaSammen(endret, 0))
      expect(kontrollerRegelsett(endret), r.analyttkode).toBeNull()

      const lagret = await kall.lagre(utgave.id, utgave.revisjon, endret)
      expect(lagret.revisjon, r.analyttkode).toBe(utgave.revisjon + 1)
      const [revisjon] = await kall.fasit<{ innhold: Intervallregelsett }>(
        'select innhold from public.objektrevisjoner where objekt_id = $1 and revisjon = $2',
        [utgave.id, lagret.revisjon],
      )
      expect(revisjon!.innhold, r.analyttkode).toEqual(endret)
      expect(endret.ringegrense).toBe(
        Math.round((toppen * 3 - (r.analyttkode.length % 2 === 0 ? steg(r.desimaler) : 0)) * 10 ** r.desimaler) /
          10 ** r.desimaler,
      )
    }
  })

  it('leser regelsettet for én kode, og historikken med hvem og når, med radsikkerheten', async () => {
    const leser = lagFaginnholdsleser(kall.klientFor(admin))
    const vanlig = lagFaginnholdsleser(kall.klientFor(bruker))
    const forste = testregelsett()
    const opprettet = await opprettRegelsett(forste)
    await kall.publiser(opprettet.id, 1)
    const andre = settKommentartekst(forste, forste.intervaller[0]!.kommentar, 'Endret syntetisk kommentar.')
    await kall.lagre(opprettet.id, 1, andre)
    await kall.gjenopprett(opprettet.id, 2, 1)

    expect((await leser.finnIntervallregelsett(forste.analyttkode, 'utkast'))?.innhold).toEqual(forste)
    expect((await leser.finnIntervallregelsett(forste.analyttkode, 'utkast'))?.revisjon).toBe(3)
    expect((await vanlig.finnIntervallregelsett(forste.analyttkode, 'publisert'))?.innhold).toEqual(forste)
    expect(await vanlig.finnIntervallregelsett(forste.analyttkode, 'utkast')).toBeNull()
    expect(await leser.finnIntervallregelsett('FINNESIKKE', 'publisert')).toBeNull()

    const historikk = await leser.lesHistorikk<Intervallregelsett>(opprettet.id)
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
    const forBruker = await vanlig.lesHistorikk<Intervallregelsett>(opprettet.id)
    expect(forBruker.revisjoner.map((r) => r.revisjon)).toEqual([1])
    expect(forBruker.hendelser.map((h) => [h.handling, h.revisjon])).toEqual([
      ['opprettet', 1],
      ['publisert', 1],
    ])

    // Importerte revisjoner har kilden med seg.
    const importert = (await lesRegelsett(admin, 'publisert'))[0]!
    const importhistorikk = await leser.lesHistorikk(importert.id)
    expect(importhistorikk.hendelser[0]!.kilde).toMatch(/Importert/)

    expect(await leser.lesHistorikk('00000000-0000-0000-0000-000000000000')).toEqual({ hendelser: [], revisjoner: [] })
    const anon = await feilFra(() => kall.rpc(null, 'les_historikk', { objekt: opprettet.id }))
    expect(anon?.code).toBe('42501')
  })
})
