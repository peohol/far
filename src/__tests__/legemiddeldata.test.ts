/**
 * Legemiddeldataene fra FEST: lesingen av filen, synkroniseringen inn i en
 * ekte database bygd av migrasjonene, og lesingen stoffsidene gjør.
 *
 * Utdraget i `data/fest-utdrag.xml` er ekte oppføringer fra FEST
 * (amitriptylin med salt, styrker, preparater og pakninger, og ett
 * kombinasjonspreparat med kodein), pluss én interaksjon og én handelsvare som
 * skal hoppes over.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { crc32, deflateRawSync } from 'node:zlib'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ENTITETER, lesFest, PARSERVERSJON, type Festpost } from '../legemiddeldata/fest'
import { lagLegemiddellager, type Databasekall } from '../legemiddeldata/lager'
import type { SupabaseClient } from '@supabase/supabase-js'
import { behandleSynk } from '../legemiddeldata/endepunkt'
import { lagLegemiddelleser, type Legemiddelutvalg, type Virkestofftreff } from '../legemiddeldata/lesing'
import { byggPreparatoversikt, oppsummerGruppe, oppsummerPreparater } from '../legemiddeldata/preparater'
import { synkroniserFest } from '../legemiddeldata/synk'
import { pakkUt } from '../legemiddeldata/zip'
import { feilFra, nyDatabase } from './hjelp/testdatabase'

const UTDRAG = readFileSync(new URL('./data/fest-utdrag.xml', import.meta.url), 'utf8')

const AMITRIPTYLIN = 'ID_0A1B24EF-A7F8-488B-97B8-8023193E976D'
const AMITRIPTYLINHYDROKLORID = 'ID_070A7B5D-46F1-44DC-AAB8-B51BE5A49270'
const AMITRIPTYLIN_ABCUR_50 = 'ID_012C7C0D-77BC-4F3D-BEBE-663743B03C1F'
const KODEIN = 'ID_82E89E1B-9C06-4E57-BB4D-AB3DA8B33FD4'

async function* biter(tekst: string, storrelse = 997): AsyncGenerator<string> {
  for (let i = 0; i < tekst.length; i += storrelse) yield tekst.slice(i, i + storrelse)
}

async function les(tekst: string): Promise<{ poster: Festpost[]; hentetDato: string | null }> {
  const fil = { hentetDato: null as string | null }
  const poster: Festpost[] = []
  for await (const p of lesFest(biter(tekst), fil)) poster.push(p)
  return { poster, hentetDato: fil.hentetDato }
}

/** Et zip-arkiv med én fil, slik DMP pakker FEST. */
function lagZip(navn: string, innhold: string): Buffer {
  const data = Buffer.from(innhold, 'utf8')
  const komprimert = deflateRawSync(data)
  const navnBuf = Buffer.from(navn)
  const sum = crc32(data)
  const lokal = Buffer.alloc(30)
  lokal.writeUInt32LE(0x04034b50, 0)
  lokal.writeUInt16LE(20, 4)
  lokal.writeUInt16LE(8, 8)
  lokal.writeUInt32LE(sum, 14)
  lokal.writeUInt32LE(komprimert.length, 18)
  lokal.writeUInt32LE(data.length, 22)
  lokal.writeUInt16LE(navnBuf.length, 26)
  const sentral = Buffer.alloc(46)
  sentral.writeUInt32LE(0x02014b50, 0)
  sentral.writeUInt16LE(20, 4)
  sentral.writeUInt16LE(20, 6)
  sentral.writeUInt16LE(8, 10)
  sentral.writeUInt32LE(sum, 16)
  sentral.writeUInt32LE(komprimert.length, 20)
  sentral.writeUInt32LE(data.length, 24)
  sentral.writeUInt16LE(navnBuf.length, 28)
  sentral.writeUInt32LE(0, 42)
  const katalogStart = lokal.length + navnBuf.length + komprimert.length
  const slutt = Buffer.alloc(22)
  slutt.writeUInt32LE(0x06054b50, 0)
  slutt.writeUInt16LE(1, 8)
  slutt.writeUInt16LE(1, 10)
  slutt.writeUInt32LE(sentral.length + navnBuf.length, 12)
  slutt.writeUInt32LE(katalogStart, 16)
  return Buffer.concat([lokal, navnBuf, komprimert, sentral, navnBuf, slutt])
}

async function tekstFra(strom: AsyncIterable<string>): Promise<string> {
  let t = ''
  for await (const b of strom) t += b
  return t
}

/* --- Lesingen av filen ---------------------------------------------------- */

describe('lesingen av FEST', () => {
  it('gir postene for typene som tas inn, og hopper over resten', async () => {
    const { poster, hentetDato } = await les(UTDRAG)
    expect(hentetDato).toBe('2026-09-08T03:09:06')
    const perType = Object.fromEntries(ENTITETER.map((e) => [e, poster.filter((p) => p.entitet === e).length]))
    expect(perType).toEqual({ virkestoff: 5, virkestoff_styrke: 9, merkevare: 12, pakning: 12, byttegruppe: 2 })
  })

  it('leser virkestoffet med saltet', async () => {
    const { poster } = await les(UTDRAG)
    expect(poster.find((p) => p.fest_id === AMITRIPTYLIN)).toEqual({
      entitet: 'virkestoff',
      fest_id: AMITRIPTYLIN,
      tidspunkt: '2019-10-24T14:39:46',
      data: { navn: 'Amitriptylin', navn_engelsk: 'Amitriptyline', salter: [AMITRIPTYLINHYDROKLORID] },
    })
  })

  it('leser et preparat med form, virkestoff, administrasjon og preparatomtale', async () => {
    const { poster } = await les(UTDRAG)
    expect(poster.find((p) => p.fest_id === AMITRIPTYLIN_ABCUR_50)?.data).toEqual({
      varenavn: 'Amitriptylin Abcur',
      navn_form_styrke: 'Amitriptylin Abcur tab 50 mg',
      legemiddelform: { kode: '53', tekst: 'Tablett' },
      legemiddelform_lang: 'Tablett, filmdrasjert',
      atc: { kode: 'N06AA09', tekst: 'Amitriptylin' },
      reseptgruppe: { kode: 'C', tekst: 'Reseptgruppe C' },
      preparattype: { kode: '7', tekst: 'Legemiddel' },
      administrasjonsveier: [{ kode: '53', tekst: 'Oral bruk' }],
      deling: { kode: '0', tekst: 'Ikke spesifisert' },
      kan_knuses: { kode: '9', tekst: 'Ukjent' },
      kan_apnes: null,
      produsent: 'Abcur AB',
      referanseprodukt: 'Sarotex',
      preparatomtale: 'https://produktinformasjon.legemiddelsok.no/preparatomtaler/16-11420.pdf',
      svart_trekant: false,
      virkestoff_med_styrke: ['ID_48B84A5E-0EC8-4696-967C-95E7CEC550A9'],
      virkestoff_uten_styrke: [],
    })
  })

  it('leser styrken med nevner', async () => {
    const { poster } = await les(UTDRAG)
    const mikstur = poster.find((p) => p.fest_id === 'ID_729B8088-6800-4B89-B6D2-52008185BC1B')
    expect(mikstur?.data).toMatchObject({
      virkestoff_id: AMITRIPTYLIN,
      styrke: { verdi: 50, enhet: 'mg' },
      nevner: { verdi: 5, enhet: 'ml' },
      operator: { kode: 'L', tekst: 'Lik' },
    })
  })

  it('gir kombinasjonspreparatet alle virkestoffene i FESTs rekkefølge', async () => {
    const { poster } = await les(UTDRAG)
    const kombi = poster.find((p) => p.entitet === 'merkevare' && (p.data as { varenavn: string }).varenavn.startsWith('Kodimagnyl'))
    expect((kombi?.data as { virkestoff_med_styrke: string[] }).virkestoff_med_styrke).toHaveLength(3)
  })

  it('leser pakningen med innhold, markedsføring og byttegruppe', async () => {
    const { poster } = await les(UTDRAG)
    const pakning = poster.find((p) => p.entitet === 'pakning' && (p.data as { byttegrupper: string[] }).byttegrupper.length > 0)
    expect(pakning?.data).toMatchObject({
      varenr: expect.stringMatching(/^\d+$/),
      innhold: [expect.objectContaining({ merkevare_id: expect.stringMatching(/^ID_/), enhet: expect.anything() })],
      markedsforingsdato: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  })

  it('tåler prefikser og navnerom, og at teksten deles hvor som helst', async () => {
    const medPrefiks = UTDRAG.replace('<FEST xmlns="http://www.kith.no/xmlstds/eresept/m30/2014-12-01">', '<f:FEST xmlns:f="urn:x">')
      .replace('</FEST>', '</f:FEST>')
    const a = await les(UTDRAG)
    const fil = { hentetDato: null as string | null }
    const b: Festpost[] = []
    for await (const p of lesFest(biter(medPrefiks, 7), fil)) b.push(p)
    expect(b).toEqual(a.poster)
  })

  it('avviser en avkuttet fil og en fil som ikke er FEST', async () => {
    await expect(les(UTDRAG.slice(0, UTDRAG.length / 2))).rejects.toThrow()
    await expect(les('<?xml version="1.0"?><Annet><KatVirkestoff/></Annet>')).rejects.toThrow('ikke et FEST-uttrekk')
  })
})

describe('utpakkingen', () => {
  it('pakker ut filen og kontrollerer summen', async () => {
    const zip = lagZip('fest251.xml', UTDRAG)
    const fil = pakkUt(zip)
    expect(fil.navn).toBe('fest251.xml')
    expect(await tekstFra(fil.tekst)).toBe(UTDRAG)
  })

  it('merker en skadet fil', async () => {
    const zip = lagZip('fest251.xml', UTDRAG)
    zip.writeUInt32LE(0, 14 + 0) // kontrollsummen i filhodet brukes ikke; ødelegg den i katalogen
    const i = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    zip.writeUInt32LE(1234, i + 16)
    await expect(tekstFra(pakkUt(zip).tekst)).rejects.toThrow('kontrollsummen')
    expect(() => pakkUt(Buffer.from('ikke en zip'))).toThrow('ikke en gyldig zip-fil')
  })
})

/* --- Databasen ------------------------------------------------------------ */

function kallSom(db: PGlite, rolle: 'service_role' | 'authenticated' | 'anon'): Databasekall {
  return (funksjon, argumenter) =>
    db.transaction(async (tx) => {
      await tx.query(`select set_config('role', $1, true)`, [rolle])
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(rolle === 'authenticated' ? { sub: '00000000-0000-0000-0000-000000000001', role: rolle } : { role: rolle }),
      ])
      const navn = Object.keys(argumenter)
      const verdier = Object.values(argumenter).map((v) =>
        v !== null && typeof v === 'object' && !(Array.isArray(v) && v.every((x) => typeof x === 'string')) ? JSON.stringify(v) : v,
      )
      const { rows } = await tx.query<{ r: unknown }>(
        `select public.${funksjon}(${navn.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`,
        verdier,
      )
      return rows[0]?.r ?? null
    })
}

type Legemidler = Legemiddelutvalg

function svar(body: string | Buffer | null, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' || body === null ? body : new Uint8Array(body), { status, headers })
}

describe('synkroniseringen', () => {
  let db: PGlite
  let tjeneste: Databasekall
  let leser: Databasekall

  beforeEach(async () => {
    db = await nyDatabase()
    tjeneste = kallSom(db, 'service_role')
    leser = kallSom(db, 'authenticated')
  })

  async function synk(xml: string, etag = '"a"') {
    return synkroniserFest({
      lager: lagLegemiddellager(tjeneste),
      hent: async () => svar(lagZip('fest251.xml', xml), 200, { etag }),
      porsjon: 5,
    })
  }

  const lesAmitriptylin = async () => (await leser('les_legemidler', { virkestoff_ider: [AMITRIPTYLIN] })) as Legemidler

  it('har de samme typene i databasen som i koden', async () => {
    const { rows } = await db.query<{ navn: string }>('select navn from legemiddeldata.entiteter order by navn')
    expect(rows.map((r) => r.navn)).toEqual([...ENTITETER].sort())
    for (const e of ENTITETER) {
      await db.query(`select fest_id, data, hash, utgatt_kl from legemiddeldata.${e} limit 0`)
    }
  })

  it('legger inn et fullt uttrekk og leser preparatene med saltene og kombinasjonene', async () => {
    const resultat = await synk(UTDRAG)
    expect(resultat).toMatchObject({ status: 'fullfort', kildedato: '2026-09-08T03:09:06' })
    if (resultat.status !== 'fullfort') return
    expect(resultat.antall.merkevare).toEqual({ inn: 12, nye: 12, endrede: 0, utgatte: 0 })

    const data = await lesAmitriptylin()
    expect(data.kilde).toBe('FEST')
    expect(data.kildedato).toBe('2026-09-08T03:09:06')
    expect(data.kontrollert_kl).not.toBeNull()
    // Alle amitriptylinpreparatene, ikke kodeinpreparatet.
    expect(data.merkevarer.map((m) => m.varenavn)).not.toContain(expect.stringContaining('Kodimagnyl'))
    expect(data.merkevarer).toHaveLength(11)
    expect(data.virkestoff.map((v) => v.navn)).toContain('Amitriptylin')
    expect(data.pakninger.length).toBeGreaterThan(0)
  })

  it('finner et preparat som peker på saltet i stedet for moderstoffet', async () => {
    // Slik DMP har varslet at styrken kan komme til å bli oppgitt.
    const endret = UTDRAG.replace(
      /(<Id>ID_48B84A5E-0EC8-4696-967C-95E7CEC550A9<\/Id>[\s\S]*?<RefVirkestoff>)ID_0A1B24EF-A7F8-488B-97B8-8023193E976D/,
      `$1${AMITRIPTYLINHYDROKLORID}`,
    )
    expect(endret).not.toBe(UTDRAG)
    await synk(endret)
    const data = await lesAmitriptylin()
    expect(data.merkevarer.map((m) => m.id)).toContain(AMITRIPTYLIN_ABCUR_50)
  })

  it('merker det som er borte som utgått, og tar det tilbake om det kommer igjen', async () => {
    await synk(UTDRAG)
    const uten = UTDRAG.replace(/<OppfLegemiddelMerkevare>(?:(?!<\/OppfLegemiddelMerkevare>)[\s\S])*ID_012C7C0D-77BC-4F3D-BEBE-663743B03C1F[\s\S]*?<\/OppfLegemiddelMerkevare>/, '')
    const andre = await synk(uten, '"b"')
    expect(andre).toMatchObject({ status: 'fullfort' })
    if (andre.status === 'fullfort') expect(andre.antall.merkevare).toEqual({ inn: 11, nye: 0, endrede: 0, utgatte: 1 })
    expect((await lesAmitriptylin()).merkevarer.map((m) => m.id)).not.toContain(AMITRIPTYLIN_ABCUR_50)
    const { rows } = await db.query<{ utgatt: boolean }>(
      'select utgatt_kl is not null as utgatt from legemiddeldata.merkevare where fest_id = $1',
      [AMITRIPTYLIN_ABCUR_50],
    )
    expect(rows).toEqual([{ utgatt: true }])

    const tredje = await synk(UTDRAG, '"c"')
    if (tredje.status === 'fullfort') expect(tredje.antall.merkevare).toEqual({ inn: 12, nye: 0, endrede: 1, utgatte: 0 })
    expect((await lesAmitriptylin()).merkevarer.map((m) => m.id)).toContain(AMITRIPTYLIN_ABCUR_50)
  })

  it('oppdaterer det som er endret, og er uendret ellers', async () => {
    await synk(UTDRAG)
    const endret = UTDRAG.replace('<Varenavn>Amitriptylin Abcur</Varenavn>', '<Varenavn>Amitriptylin Abcur Ny</Varenavn>')
    const andre = await synk(endret, '"b"')
    if (andre.status !== 'fullfort') throw new Error(JSON.stringify(andre))
    const endrede = andre.antall.merkevare!.endrede
    expect(endrede).toBeGreaterThan(0)
    expect(andre.antall.virkestoff).toEqual({ inn: 5, nye: 0, endrede: 0, utgatte: 0 })
    expect((await lesAmitriptylin()).merkevarer.some((m) => m.varenavn === 'Amitriptylin Abcur Ny')).toBe(true)
  })

  it('avviser et uttrekk som er for lite, og beholder dataene', async () => {
    await synk(UTDRAG)
    const fore = await lesAmitriptylin()
    const nesten = UTDRAG.replace(/<KatLegemiddelMerkevare>[\s\S]*<\/KatLegemiddelMerkevare>/, '<KatLegemiddelMerkevare></KatLegemiddelMerkevare>')
    const resultat = await synk(nesten, '"b"')
    expect(resultat).toMatchObject({ status: 'feilet', feil: expect.stringContaining('ufullstendig') })
    expect(await lesAmitriptylin()).toEqual(fore)
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from legemiddeldata.innlasting')
    expect(rows[0]!.n).toBe(0)
  })

  it('beholder dataene når nedlastingen eller filen feiler', async () => {
    await synk(UTDRAG)
    const fore = await lesAmitriptylin()
    const lager = lagLegemiddellager(tjeneste)
    expect(await synkroniserFest({ lager, hent: async () => svar('nede', 503) })).toMatchObject({ status: 'feilet' })
    expect(await synkroniserFest({ lager, hent: async () => svar(Buffer.from('tull')) })).toMatchObject({ status: 'feilet' })
    const avkuttet = lagZip('fest251.xml', UTDRAG).subarray(0, 4000)
    expect(await synkroniserFest({ lager, hent: async () => svar(avkuttet) })).toMatchObject({ status: 'feilet' })
    expect(await lesAmitriptylin()).toEqual(fore)
    const status = (await leser('legemiddeldata_status', {})) as { status: string }[]
    expect(status.map((s) => s.status)).toEqual(['feilet', 'feilet', 'feilet', 'fullfort'])
  })

  it('spør med ETag og gjør ingenting når filen er uendret', async () => {
    await synk(UTDRAG, '"a"')
    let spurt: string | null = null
    const resultat = await synkroniserFest({
      lager: lagLegemiddellager(tjeneste),
      hent: async (_url, init) => {
        spurt = new Headers(init?.headers).get('if-none-match')
        return svar(null, 304)
      },
    })
    expect(spurt).toBe('"a"')
    expect(resultat).toMatchObject({ status: 'uendret' })
    // Samme fil med ny ETag gir heller ingen endring.
    expect(await synk(UTDRAG, '"ny"')).toMatchObject({ status: 'uendret' })
  })

  it('leser alt på nytt når parseren er endret', async () => {
    await synk(UTDRAG)
    await db.query('update legemiddeldata.synkroniseringer set parserversjon = $1', [PARSERVERSJON - 1])
    let spurt: string | null = 'ikke kalt'
    const resultat = await synkroniserFest({
      lager: lagLegemiddellager(tjeneste),
      hent: async (_url, init) => {
        spurt = new Headers(init?.headers).get('if-none-match')
        return svar(lagZip('fest251.xml', UTDRAG), 200, { etag: '"a"' })
      },
    })
    expect(spurt).toBeNull()
    expect(resultat).toMatchObject({ status: 'fullfort' })
  })

  it('kjører én synkronisering om gangen', async () => {
    await tjeneste('legemiddeldata_start_synk', { kilde: 'FEST' })
    expect(await feilFra(() => tjeneste('legemiddeldata_start_synk', { kilde: 'FEST' }))).toMatchObject({ code: 'PT409' })
    // En som har hengt i over en halvtime, regnes som feilet.
    await db.query(`update legemiddeldata.synkroniseringer set startet_kl = now() - interval '31 minutes'`)
    expect(await tjeneste('legemiddeldata_start_synk', { kilde: 'FEST' })).toBeTruthy()
  })

  it('lar bare serveren skrive, og bare innloggede lese', async () => {
    const anon = kallSom(db, 'anon')
    for (const kall of [leser, anon]) {
      expect(await feilFra(() => kall('legemiddeldata_start_synk', { kilde: 'FEST' }))).toMatchObject({ code: '42501' })
      expect(await feilFra(() => kall('legemiddeldata_forrige_synk', { kilde: 'FEST' }))).toMatchObject({ code: '42501' })
    }
    expect(await feilFra(() => anon('les_legemidler', { virkestoff_ider: [AMITRIPTYLIN] }))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => anon('legemiddeldata_status', {}))).toMatchObject({ code: '42501' })
    for (const rolle of ['authenticated', 'anon', 'service_role']) {
      const feil = await feilFra(() =>
        db.transaction(async (tx) => {
          await tx.query(`select set_config('role', $1, true)`, [rolle])
          await tx.query('select * from legemiddeldata.merkevare')
        }),
      )
      expect(feil).toMatchObject({ code: '42501' })
    }
  })

  it('gir tomme lister for virkestoff som ikke finnes', async () => {
    const data = (await leser('les_legemidler', { virkestoff_ider: ['ID_FINNES-IKKE'] })) as Legemidler
    expect(data).toMatchObject({ virkestoff: [], merkevarer: [], pakninger: [], kontrollert_kl: null })
  })
})

describe('preparatene på stoffsiden', () => {
  let leser: ReturnType<typeof lagLegemiddelleser>
  let anonym: Databasekall

  beforeAll(async () => {
    const db = await nyDatabase()
    await synkroniserFest({
      lager: lagLegemiddellager(kallSom(db, 'service_role')),
      hent: async () => svar(lagZip('fest251.xml', UTDRAG), 200, { etag: '"a"' }),
    })
    const innlogget = kallSom(db, 'authenticated')
    // Leseren appen bruker, mot en klient som kaller databasen som en innlogget.
    const klient = {
      rpc: async (funksjon: string, argumenter: Record<string, unknown>) => {
        try {
          return { data: await innlogget(funksjon, argumenter), error: null }
        } catch (e) {
          return { data: null, error: { message: (e as Error).message } }
        }
      },
    } as unknown as SupabaseClient
    leser = lagLegemiddelleser(klient)
    anonym = kallSom(db, 'anon')
  })

  it('grupperer etter legemiddelform, preparat og styrke, med fritakene for seg', async () => {
    const oversikt = byggPreparatoversikt(await leser.les([AMITRIPTYLIN]), [AMITRIPTYLIN])

    expect(oversikt.former.map((f) => f.form)).toEqual(['Tablett'])
    const tabletter = oversikt.former[0]!.preparater
    expect(tabletter.map((p) => [p.navn, p.styrker.map((s) => s.styrke)])).toEqual([
      ['Amitriptylin Abcur', ['10 mg', '25 mg', '50 mg']],
      ['Amitriptylin Orifarm', ['10 mg', '25 mg']],
      ['Sarotex', ['10 mg', '25 mg']],
    ])
    expect(tabletter.every((p) => p.kombinasjon.length === 0 && p.type === null)).toBe(true)

    expect(oversikt.godkjenningsfritak.map((p) => [p.navn, p.form, p.styrker.map((s) => s.styrke)])).toEqual([
      ['Amitriptylin-CT', 'Tablett', ['25 mg']],
      ['Amitriptyline Hydrochloride rosemont', 'Mikstur, oppløsning', ['50 mg/5 ml']],
      ['Amitriptyline hydrochloride syrimed', 'Mikstur, oppløsning', ['10 mg/5 ml']],
      ['Saroten Retard', 'Depotkapsel, hard', ['50 mg']],
    ])

    expect(oppsummerPreparater(oversikt)).toBe('3 preparater · 1 legemiddelform · 3 styrker · 4 med godkjenningsfritak')
    expect(oppsummerGruppe(tabletter)).toBe('3 preparater · 10–50 mg')
    expect(oppsummerGruppe(oversikt.godkjenningsfritak)).toBe('4 preparater · 25–50 mg, 10–50 mg/5 ml')
  })

  it('viser pakningene med størrelse, type og varenummer', async () => {
    const oversikt = byggPreparatoversikt(await leser.les([AMITRIPTYLIN]), [AMITRIPTYLIN])
    const ct = oversikt.godkjenningsfritak.find((p) => p.navn === 'Amitriptylin-CT')!
    expect(ct.styrker[0]!.pakninger).toEqual([
      { id: expect.any(String), varenr: '342044', tekst: '100 stk, blisterpakning', midlertidig_utgatt: null },
    ])
  })

  it('tar med reseptgruppe, administrasjonsvei, knusing og preparatomtalen fra FEST', async () => {
    const oversikt = byggPreparatoversikt(await leser.les([AMITRIPTYLIN]), [AMITRIPTYLIN])
    const abcur = oversikt.former[0]!.preparater.find((p) => p.navn === 'Amitriptylin Abcur')!
    expect(abcur.administrasjonsveier).toEqual(['Oral bruk'])
    expect(abcur.styrker.map((s) => [s.styrke, s.reseptgruppe, s.handtering, s.preparatomtaler])).toEqual([
      // «Ikke spesifisert» om deling sier ingenting og tas ikke med.
      ['10 mg', 'Reseptgruppe C', [], ['https://produktinformasjon.legemiddelsok.no/preparatomtaler/16-11418.pdf']],
      ['25 mg', 'Reseptgruppe C', [], ['https://produktinformasjon.legemiddelsok.no/preparatomtaler/16-11419.pdf']],
      ['50 mg', 'Reseptgruppe C', [], ['https://produktinformasjon.legemiddelsok.no/preparatomtaler/16-11420.pdf']],
    ])
    const retard = oversikt.godkjenningsfritak.find((p) => p.navn === 'Saroten Retard')!
    expect(retard.styrker[0]!.handtering).toEqual(['Kan ikke knuses'])
    expect(retard.styrker[0]!.preparatomtaler).toEqual([])
  })

  it('merker kombinasjonspreparatet med de andre virkestoffene, i FESTs rekkefølge', async () => {
    const oversikt = byggPreparatoversikt(await leser.les([KODEIN]), [KODEIN])
    // Kodimagnyl i utdraget krever godkjenningsfritak.
    expect(oversikt.former).toEqual([])
    const [kodimagnyl] = oversikt.godkjenningsfritak
    expect(kodimagnyl).toMatchObject({
      navn: 'Kodimagnyl Ikke-stoppende dak',
      form: 'Tablett',
      // Den korte formen grupperer; den lange står på preparatet.
      langform: ['Tablett, filmdrasjert'],
      kombinasjon: ['Acetylsalisylsyre', 'Magnesiumoksid'],
    })
    expect(kodimagnyl!.styrker[0]).toMatchObject({
      styrke: 'kodein 9,6 mg + acetylsalisylsyre 500 mg + magnesiumoksid 150 mg',
      mengde: null,
    })
    // Kombinasjonen telles, men har ikke noe spenn å vise.
    expect(oppsummerGruppe([kodimagnyl!])).toBe('1 preparat')
  })

  it('viser saltet på preparatet, og slår sammen merkevarer med samme styrke', () => {
    const utvalg: Legemiddelutvalg = {
      kilde: 'FEST',
      kontrollert_kl: null,
      kildedato: null,
      virkestoff: [
        { id: 'mor', navn: 'Testmiddel', navn_engelsk: null, salter: ['salt'], utgatt: false },
        { id: 'salt', navn: 'Testmiddelhydroklorid', navn_engelsk: null, salter: [], utgatt: false },
      ],
      styrker: [
        {
          id: 's1',
          virkestoff_id: 'salt',
          styrke: { verdi: 2.5, enhet: 'mg' },
          nevner: { verdi: 1, enhet: 'ml' },
          ovre: null,
          operator: null,
          alternativ_styrke: null,
          alternativ_nevner: null,
        },
      ],
      merkevarer: [
        {
          id: 'm1',
          varenavn: 'Syntetin',
          navn_form_styrke: 'Syntetin inj 2,5 mg/ml',
          legemiddelform: { kode: '1', tekst: 'Injeksjonsvæske, oppløsning' },
          legemiddelform_lang: null,
          atc: null,
          reseptgruppe: null,
          preparattype: { kode: '15', tekst: 'Sykehuspreparat' },
          administrasjonsveier: [],
          deling: null,
          kan_knuses: null,
          kan_apnes: null,
          produsent: null,
          referanseprodukt: null,
          preparatomtale: null,
          svart_trekant: false,
          virkestoff_med_styrke: ['s1'],
          virkestoff_uten_styrke: [],
        },
      ],
      pakninger: [],
      byttegrupper: [],
    }
    // Samme preparat i samme styrke som to merkevarer, med hver sin pakning.
    const merkevare = utvalg.merkevarer[0]!
    utvalg.merkevarer.push({ ...merkevare, id: 'm2' })
    const pakning = (id: string, merkevare_id: string, mengde: number) => ({
      id,
      varenr: id.toUpperCase(),
      navn_form_styrke: '',
      innhold: [
        {
          merkevare_id,
          pakningsstorrelse: null,
          enhet: { kode: 'ml', tekst: 'milliliter' },
          pakningstype: { kode: '2', tekst: 'Ampulle' },
          mengde,
          antall: null,
        },
      ],
      merkevarer: [merkevare_id],
      markedsforingsdato: null,
      midlertidig_utgatt_dato: null,
      avregistrert_dato: null,
      byttegrupper: [],
      ean: [],
    })
    utvalg.pakninger.push(pakning('p2', 'm2', 10), pakning('p1', 'm1', 2))
    const [preparat] = byggPreparatoversikt(utvalg, ['mor']).former[0]!.preparater
    expect(preparat).toMatchObject({
      salter: ['Testmiddelhydroklorid'],
      kombinasjon: [],
      type: 'Sykehuspreparat',
      styrker: [{ styrke: '2,5 mg/ml', mengde: { fra: 2.5, til: 2.5, enhet: 'mg/ml' } }],
    })
    // Pakningene fra begge merkevarene står på den ene styrken, minste først.
    // Uten pakningsstørrelse brukes mengden.
    expect(preparat!.styrker[0]!.pakninger.map((p) => p.tekst)).toEqual(['2 ml, ampulle', '10 ml, ampulle'])
  })

  it('søker etter virkestoff med likt navn først, og sier hva som er salt', async () => {
    const treff = await leser.sok('amitriptylin')
    expect(treff.map((t) => t.navn)).toEqual(['Amitriptylin', 'Amitriptylinhydroklorid'])
    expect(treff[0]).toEqual<Virkestofftreff>({
      id: AMITRIPTYLIN,
      navn: 'Amitriptylin',
      navn_engelsk: 'Amitriptyline',
      salt_av: [],
      preparater: 11,
    })
    expect(treff[1]!.salt_av).toEqual(['Amitriptylin'])
    // Det engelske navnet treffer også, og midt i ordet.
    expect((await leser.sok('Codeine')).map((t) => t.id)).toEqual([KODEIN])
    expect((await leser.sok('triptyl')).length).toBe(2)
  })

  it('søker ikke på under to tegn, og bare for innloggede', async () => {
    expect(await leser.sok('a')).toEqual([])
    expect(await leser.sok('  ')).toEqual([])
    await expect(anonym('sok_virkestoff', { sok: 'amitriptylin' })).rejects.toThrow(/permission denied/)
  })

  it('leser ingenting for en side uten kobling', async () => {
    expect(await leser.les([])).toMatchObject({ virkestoff: [], merkevarer: [] })
  })
})

describe('endepunktet for den nattlige synkroniseringen', () => {
  const miljo = { CRON_SECRET: 'hemmelig', SUPABASE_URL: 'https://eksempel.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' }
  const kall = (autorisasjon?: string) =>
    new Request('https://ousfar.no/api/legemiddeldata-synk', {
      headers: autorisasjon ? { authorization: autorisasjon } : {},
    })

  it('avviser kall uten riktig hemmelighet, og når hemmeligheten mangler', async () => {
    let kjort = 0
    const synk = async () => (kjort++, { status: 'uendret' as const, synk: 1 })
    expect((await behandleSynk(kall(), miljo, synk)).status).toBe(401)
    expect((await behandleSynk(kall('Bearer feil'), miljo, synk)).status).toBe(401)
    expect((await behandleSynk(kall('Bearer '), { ...miljo, CRON_SECRET: '' }, synk)).status).toBe(401)
    expect((await behandleSynk(kall('Bearer undefined'), { ...miljo, CRON_SECRET: undefined }, synk)).status).toBe(401)
    expect(kjort).toBe(0)
  })

  it('kjører synkroniseringen og melder en feilet kjøring som feil', async () => {
    const ok = await behandleSynk(kall('Bearer hemmelig'), miljo, async () => ({ status: 'uendret', synk: 7 }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ status: 'uendret', synk: 7 })
    const feilet = await behandleSynk(kall('Bearer hemmelig'), miljo, async () => ({ status: 'feilet', synk: 8, feil: 'x' }))
    expect(feilet.status).toBe(502)
  })

  it('stopper før noe kjøres når oppkoblingen mangler', async () => {
    const svar = await behandleSynk(kall('Bearer hemmelig'), { CRON_SECRET: 'hemmelig' }, async () => {
      throw new Error('skal ikke kjøres')
    })
    expect(svar.status).toBe(500)
  })
})
