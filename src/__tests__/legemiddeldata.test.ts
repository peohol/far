/**
 * Legemiddeldataene fra FEST: lesingen av filen, synkroniseringen inn i en
 * ekte database bygd av migrasjonene, og lesingen stoffsidene gjør.
 *
 * Utdraget i `data/fest-utdrag.xml` er ekte oppføringer fra FEST
 * (amitriptylin med salt, styrker, preparater og pakninger, og ett
 * kombinasjonspreparat med kodein), fire interaksjoner (tre med amitriptylin,
 * én uten), én ATC-kode som ikke er vurdert for interaksjoner, og én
 * handelsvare som skal hoppes over.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ENTITETER, lesFest, PARSERVERSJON, type Festpost, type Interaksjonsdata } from '../legemiddeldata/fest'
import { lagLegemiddellager, type Databasekall } from '../legemiddeldata/lager'
import { behandleSynk } from '../legemiddeldata/endepunkt'
import { lagLegemiddelleser, type Legemiddelutvalg, type Virkestofftreff } from '../legemiddeldata/lesing'
import { byggInteraksjoner, interaksjonsnokler, oppsummerInteraksjoner } from '../legemiddeldata/interaksjoner'
import { byggPreparatvisning, oppsummerForm, oppsummerPreparatvisning } from '../legemiddeldata/preparatmodell'
import { synkroniserFest } from '../legemiddeldata/synk'
import { pakkUt } from '../legemiddeldata/zip'
import {
  AMITRIPTYLIN,
  AMITRIPTYLIN_ABCUR_50,
  AMITRIPTYLINHYDROKLORID,
  kallSom,
  KODEIN,
  innloggetLeser,
  lagZip,
  svar,
  synkroniserUtdrag,
  TERBINAFIN_AMITRIPTYLIN,
  UTDRAG,
} from './hjelp/fest'
import { feilFra, nyDatabase } from './hjelp/testdatabase'

async function* biter(tekst: string, storrelse = 997): AsyncGenerator<string> {
  for (let i = 0; i < tekst.length; i += storrelse) yield tekst.slice(i, i + storrelse)
}

async function les(tekst: string): Promise<{ poster: Festpost[]; hentetDato: string | null }> {
  const fil = { hentetDato: null as string | null }
  const poster: Festpost[] = []
  for await (const p of lesFest(biter(tekst), fil)) poster.push(p)
  return { poster, hentetDato: fil.hentetDato }
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
    expect(perType).toEqual({
      virkestoff: 5,
      virkestoff_styrke: 9,
      merkevare: 12,
      pakning: 12,
      byttegruppe: 2,
      interaksjon: 4,
      interaksjon_ikke_vurdert: 1,
    })
  })

  it('leser interaksjonen med substansgruppene, og ATC-kodene som ikke er vurdert', async () => {
    const { poster } = await les(UTDRAG)
    expect(poster.find((p) => p.fest_id === TERBINAFIN_AMITRIPTYLIN)?.data).toEqual({
      relevans: { kode: '2', tekst: 'Forholdsregler bør tas' },
      klinisk_konsekvens: expect.stringMatching(/^Økt konsentrasjon av amitriptylin og aktiv metabolitt/),
      mekanisme: expect.stringMatching(/^Terbinafin hemmer metabolisme av amitriptylin/),
      handtering: expect.stringMatching(/^Dosetilpasning: .*\nLegemiddelalternativer: /s),
      situasjonskriterier: ['Gjelder ved amitriptylindoser større eller lik 75 mg daglig.'],
      kildegrunnlag: { kode: '2', tekst: 'Kasusrapporter' },
      referanser: [
        expect.objectContaining({ kilde: expect.stringMatching(/^Castberg I/), lenke: expect.stringMatching(/^http:\/\//) }),
        { kilde: expect.stringMatching(/^Abdel-Rahman SM/), lenke: 'https://pubmed.ncbi.nlm.nih.gov/10383919' },
        { kilde: expect.stringMatching(/^Abdel-Rahman SM/), lenke: 'https://pubmed.ncbi.nlm.nih.gov/10340911' },
      ],
      substansgrupper: [
        {
          navn: 'Terbinafin',
          substanser: [{ navn: 'Terbinafin', atc: { kode: 'D01BA02', tekst: 'Terbinafin' }, virkestoff_id: null }],
        },
        {
          navn: 'Amitriptylin',
          substanser: [
            { navn: 'Amitriptylin', atc: { kode: 'N06AA09', tekst: 'Amitriptylin' }, virkestoff_id: null },
            {
              navn: 'Amitriptylin og psykoleptika',
              atc: { kode: 'N06CA01', tekst: 'Amitriptylin og psykoleptika' },
              virkestoff_id: null,
            },
          ],
        },
      ],
    })
    // Et stoff uten ATC-kode har virkestoffets ID.
    const johannesurt = poster.find((p) => JSON.stringify(p.data).includes('Johannesurt'))!.data as Interaksjonsdata
    expect(johannesurt.substansgrupper[0]!.substanser[0]).toEqual({
      navn: 'Perikum',
      atc: null,
      virkestoff_id: 'ID_D8977B6C-F30E-40E2-AA71-E7F3A4B9497E',
    })
    // «Ikke vurdert» har ingen egen ID; oppføringens brukes.
    expect(poster.find((p) => p.entitet === 'interaksjon_ikke_vurdert')).toEqual({
      entitet: 'interaksjon_ikke_vurdert',
      fest_id: 'ID_12F59012-13DC-4264-96DF-290B598C7C70',
      tidspunkt: '2017-02-01T00:53:49',
      data: { atc: [{ kode: 'N07AB02', tekst: 'Betanekol' }] },
    })
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

type Legemidler = Legemiddelutvalg

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

describe('preparatene og interaksjonene på stoffsiden', () => {
  let leser: ReturnType<typeof lagLegemiddelleser>
  let anonym: Databasekall

  beforeAll(async () => {
    const db = await nyDatabase()
    await synkroniserUtdrag(db)
    leser = innloggetLeser(db)
    anonym = kallSom(db, 'anon')
  })

  it('grupperer etter legemiddelform og styrke, med fritakene som merke i de samme listene', async () => {
    const visning = byggPreparatvisning(await leser.les([AMITRIPTYLIN]), [AMITRIPTYLIN])

    expect(visning.former.map((f) => f.form)).toEqual(['Depotkapsel, hard', 'Mikstur, oppløsning', 'Tablett'])
    const tablett = visning.former.find((f) => f.form === 'Tablett')!
    expect(tablett.styrker.map((s) => [s.styrke, s.preparater.map((p) => p.navn)])).toEqual([
      ['10 mg', ['Amitriptylin Abcur', 'Amitriptylin Orifarm', 'Sarotex']],
      ['25 mg', ['Amitriptylin Abcur', 'Amitriptylin Orifarm', 'Amitriptylin-CT', 'Sarotex']],
      ['50 mg', ['Amitriptylin Abcur']],
    ])
    const fritak = [...visning.preparater.values()].filter((p) => p.merker.some((m) => m.type === 'godkjenningsfritak'))
    expect(fritak.map((p) => [p.navn, p.form, p.styrker.map((s) => s.styrke)]).sort()).toEqual([
      ['Amitriptylin-CT', 'Tablett', ['25 mg']],
      ['Amitriptyline Hydrochloride rosemont', 'Mikstur, oppløsning', ['50 mg/5 ml']],
      ['Amitriptyline hydrochloride syrimed', 'Mikstur, oppløsning', ['10 mg/5 ml']],
      ['Saroten Retard', 'Depotkapsel, hard', ['50 mg']],
    ])

    expect(oppsummerPreparatvisning(visning)).toBe('7 preparater · 3 legemiddelformer · 5 styrker · 4 med godkjenningsfritak')
    expect(oppsummerForm(tablett)).toBe('3 styrker · 10–50 mg · 4 preparater')
  })

  it('viser pakningene med størrelse, type og varenummer', async () => {
    const visning = byggPreparatvisning(await leser.les([AMITRIPTYLIN]), [AMITRIPTYLIN])
    const ct = visning.preparater.get('53:Amitriptylin-CT')!
    expect(ct.styrker[0]!.pakninger).toEqual([
      { id: expect.any(String), varenr: '342044', tekst: '100 stk, blisterpakning', midlertidig_utgatt: null, byttegrupper: [] },
    ])
  })

  it('tar med reseptgruppe, administrasjonsvei, knusing og preparatomtalen fra FEST', async () => {
    const visning = byggPreparatvisning(await leser.les([AMITRIPTYLIN]), [AMITRIPTYLIN])
    const abcur = visning.preparater.get('53:Amitriptylin Abcur')!
    expect(abcur.administrasjonsveier).toEqual(['Oral bruk'])
    const ukjent = { status: 'ukjent', tekst: null }
    expect(abcur.styrker.map((s) => [s.styrke, s.reseptgrupper, s.handtering, s.preparatomtaler])).toEqual([
      // «Ikke spesifisert» om deling sier ingenting og er ukjent.
      ['10 mg', ['Reseptgruppe C'], { deling: ukjent, knusing: ukjent, apning: ukjent }, ['https://produktinformasjon.legemiddelsok.no/preparatomtaler/16-11418.pdf']],
      ['25 mg', ['Reseptgruppe C'], { deling: ukjent, knusing: ukjent, apning: ukjent }, ['https://produktinformasjon.legemiddelsok.no/preparatomtaler/16-11419.pdf']],
      ['50 mg', ['Reseptgruppe C'], { deling: ukjent, knusing: ukjent, apning: ukjent }, ['https://produktinformasjon.legemiddelsok.no/preparatomtaler/16-11420.pdf']],
    ])
    const retard = visning.preparater.get('743:Saroten Retard')!
    expect(retard.styrker[0]!.handtering.knusing).toEqual({ status: 'nei', tekst: 'Kan ikke knuses' })
    expect(retard.styrker[0]!.preparatomtaler).toEqual([])
  })

  it('merker kombinasjonspreparatet med de andre virkestoffene, i FESTs rekkefølge', async () => {
    const visning = byggPreparatvisning(await leser.les([KODEIN]), [KODEIN])
    // Kodimagnyl i utdraget krever godkjenningsfritak; det er et merke, ikke en egen gruppe.
    expect(visning.former.map((f) => f.form)).toEqual(['Tablett'])
    const [kodimagnyl] = visning.preparater.values()
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
    expect(oppsummerForm(visning.former[0]!)).toBe('1 styrke · 1 preparat')
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
    const [preparat] = byggPreparatvisning(utvalg, ['mor']).preparater.values()
    expect(preparat).toMatchObject({
      salter: ['Testmiddelhydroklorid'],
      kombinasjon: [],
      merker: [{ type: 'preparattype', tekst: 'Sykehuspreparat' }],
      styrker: [{ styrke: '2,5 mg/ml', mengde: { fra: 2.5, til: 2.5, enhet: 'mg/ml' }, merkevarer: ['m1', 'm2'] }],
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
    expect(await leser.interaksjoner({ atc: [], virkestoff: [] })).toEqual({ interaksjoner: [], ikke_vurdert: [] })
  })

  it('slår opp interaksjonene på ATC-koden til preparatene med bare sidens virkestoff', async () => {
    const utvalg = await leser.les([AMITRIPTYLIN])
    const nokler = interaksjonsnokler(utvalg, [AMITRIPTYLIN])
    expect(nokler).toEqual({ atc: ['N06AA09'], virkestoff: [AMITRIPTYLINHYDROKLORID, AMITRIPTYLIN].sort() })
    // Kombinasjonspreparatets kode tas ikke med: kodeinsiden har ingen å slå opp på.
    expect(interaksjonsnokler(await leser.les([KODEIN]), [KODEIN]).atc).toEqual([])

    const funnet = await leser.interaksjoner(nokler)
    // Direkte på ATC-koden (terbinafin, fentanyl) og gjennom klassen N06AA (johannesurt).
    expect(funnet.interaksjoner.map((i) => i.substansgrupper[0]!.navn ?? i.substansgrupper[0]!.substanser[0]!.navn).sort()).toEqual(
      ['Fentanyl', 'Johannesurt', 'Terbinafin'],
    )
    expect(funnet.ikke_vurdert).toEqual([])

    const oversikt = byggInteraksjoner(funnet, nokler)
    // «Ingen tiltak nødvendig» (fentanyl) vises ikke; «Bør unngås» står først.
    expect(oversikt.interaksjoner.map((i) => [i.med, i.gjelder, i.relevanstekst])).toEqual([
      ['Johannesurt', 'Ikke-selektive monoaminreopptakshemmere', 'Bør unngås'],
      ['Terbinafin', 'Amitriptylin', 'Forholdsregler bør tas'],
    ])
    const terbinafin = oversikt.interaksjoner[1]!
    expect(terbinafin.situasjonskriterier).toEqual(['Gjelder ved amitriptylindoser større eller lik 75 mg daglig.'])
    expect(terbinafin.handtering.map((a) => a.overskrift)).toEqual(['Dosetilpasning', 'Legemiddelalternativer'])
    expect(terbinafin.handtering[0]!.tekst).toMatch(/^Anslagsvis 50-70% reduksjon av amitriptylin/)
    expect(terbinafin.referanser[0]!.lenke).toMatch(/^http:\/\/www\.ncbi\.nlm\.nih\.gov\//)
    expect(oppsummerInteraksjoner(oversikt)).toBe('1 bør unngås · 1 forholdsregler bør tas')
  })

  it('sier fra om ATC-koder som ikke er vurdert, også gjennom et overordnet nivå', async () => {
    const funnet = await leser.interaksjoner({ atc: ['N07AB02'], virkestoff: [] })
    expect(funnet.interaksjoner).toEqual([])
    const oversikt = byggInteraksjoner(funnet, { atc: ['N07AB02'], virkestoff: [] })
    expect(oversikt.ikke_vurdert).toEqual(['Betanekol (N07AB02)'])
    expect(oppsummerInteraksjoner(oversikt)).toBe('Ikke vurdert av DMP')
    // Et stoff uten ATC-kode finnes på virkestoffets ID.
    const perikum = await leser.interaksjoner({ atc: [], virkestoff: ['ID_D8977B6C-F30E-40E2-AA71-E7F3A4B9497E'] })
    expect(perikum.interaksjoner).toHaveLength(1)
  })

  it('slår opp interaksjonene bare for innloggede, og på et begrenset antall koder', async () => {
    await expect(anonym('les_interaksjoner', { atc_koder: ['N06AA09'], virkestoff_ider: [] })).rejects.toThrow(
      /permission denied/,
    )
    const mange = Array.from({ length: 101 }, (_, i) => `N06AA${i}`)
    await expect(leser.interaksjoner({ atc: mange, virkestoff: [] })).rejects.toThrow(/For mange ATC-koder/)
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
