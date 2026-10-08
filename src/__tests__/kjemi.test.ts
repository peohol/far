/**
 * De kjemiske grunndataene fra PubChem: registeret over forbindelser,
 * kontrollen som kobler dem til PubChem, kallene, synkroniseringen inn i en
 * ekte database bygd av migrasjonene, endringsloggen, endepunktet og
 * visningen på fagsidene.
 *
 * `data/pubchem/egenskaper.json` er et ekte svar fra PubChem for
 * forbindelsene OUSFAR kontrollerer mot: citalopram og desmetylcitalopram,
 * THC med THC-OH og THC-COOH, bupropion og hydroksybupropion, og litium.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import stoffregister from '../data/stoffregister.json'
import { lesDatakildestatus, vurderKilder } from '../datakilder/status'
import {
  byggForbindelsesregister,
  FORBINDELSER,
  kontrollerForbindelser,
  type Forbindelsesregister,
} from '../kjemi/forbindelser'
import { behandlePubchemSynk } from '../kjemi/endepunkt'
import { kurerForbindelse, navnenokkel, type Uavhengig } from '../kjemi/kurering'
import { lagKjemilager } from '../kjemi/lager'
import { lagKjemileser, lesKjemiutvalg, type Kjemileser } from '../kjemi/lesing'
import { lagPubchemApi, lesPubchemrad, skjelett, type PubchemApi } from '../kjemi/pubchem'
import { pubchemreferanser, pubchemUrl, PUBCHEM_KILDE } from '../kjemi/referanser'
import {
  byggKjemivisning,
  formeldeler,
  formeltekst,
  kjemicider,
  kjemioppsummering,
  kjemisoketekster,
  KJEMIPANEL,
  molvekttekst,
} from '../kjemi/stoffside'
import { maksBortfall, synkroniserKjemi } from '../kjemi/synk'
import { lagHofligHenting } from '../server/hofligHenting'
import { kallSom } from './hjelp/fest'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

const SVAR = JSON.parse(readFileSync(new URL('./data/pubchem/egenskaper.json', import.meta.url), 'utf8')) as {
  PropertyTable: { Properties: Record<string, unknown>[] }
}
const RADER = SVAR.PropertyTable.Properties
const rad = (cid: number) => RADER.find((r) => r.CID === cid)!

/* --- Registeret ----------------------------------------------------------- */

describe('registeret over forbindelser', () => {
  const stoffer = new Set(stoffregister.stoffer.map((s) => s.slug))

  it('stemmer: kjente stoffer, unike nøkler og CID-er, og hver forbindelse er koblet eller sier hvorfor ikke', () => {
    expect(kontrollerForbindelser(FORBINDELSER.alle, stoffer)).toEqual([])
  })

  it('har selve stoffet for hver fagside, først, med metabolittene etter', () => {
    for (const slug of stoffer) {
      const [forste] = FORBINDELSER.forStoff(slug)
      expect(forste?.stoffer.find((s) => s.stoff === slug)?.relasjon, slug).toBe('selve_stoffet')
    }
    expect(FORBINDELSER.forStoff('citalopram').map((f) => f.nokkel)).toEqual(['citalopram', 'desmetylcitalopram'])
    expect(FORBINDELSER.forStoff('thc').map((f) => f.nokkel)).toEqual(['thc', 'thc-oh', 'thc-cooh'])
    expect(FORBINDELSER.forStoff('bupropion').map((f) => f.nokkel)).toEqual(['bupropion', 'hydroksybupropion'])
  })

  it('lar én forbindelse høre til flere fagsider', () => {
    expect(FORBINDELSER.forStoff('escitalopram').map((f) => f.nokkel)).toEqual(['escitalopram', 'desmetylcitalopram'])
    expect(FORBINDELSER.finn('nortriptylin')!.stoffer).toEqual([
      { stoff: 'nortriptylin', relasjon: 'selve_stoffet' },
      { stoff: 'amitriptylin', relasjon: 'metabolitt' },
    ])
  })

  it('har de verifiserte koblingene for forbindelsene importen er kontrollert mot', () => {
    const cid = (nokkel: string) => FORBINDELSER.finn(nokkel)?.pubchem?.cid
    expect(['citalopram', 'desmetylcitalopram', 'thc', 'thc-cooh', 'thc-oh', 'bupropion', 'hydroksybupropion'].map(cid)).toEqual([
      2771, 162180, 16078, 108207, 644022, 444, 446,
    ])
    // Koblingen er kontrollert mot det PubChem oppgir.
    for (const r of RADER) {
      const f = FORBINDELSER.medPubchem().find((x) => x.pubchem.cid === r.CID)!
      expect(f.pubchem.inchikey).toBe(r.InChIKey)
      expect(f.pubchem.formel).toBe(r.MolecularFormula)
    }
  })

  it('finner feilene i et register', () => {
    const god = FORBINDELSER.finn('citalopram')!
    const feil = kontrollerForbindelser(
      [
        god,
        { ...god, nokkel: 'kopi' },
        { ...god, nokkel: 'ukjent', stoffer: [{ stoff: 'finnes-ikke', relasjon: 'selve_stoffet' }], pubchem: undefined },
        { ...god, nokkel: 'begge', uavklart: { grunn: 'x', kandidater: [] }, pubchem: { ...god.pubchem!, cid: 1 } },
        { ...god, nokkel: 'salt', pubchem: { ...god.pubchem!, cid: 2, formel: 'C20H21FN2O.ClH', inchikey: 'feil' } },
      ],
      stoffer,
    )
    expect(feil).toEqual([
      'kopi: CID 2771 er også brukt av citalopram',
      'ukjent: ukjent stoff finnes-ikke',
      'ukjent: verken koblet til PubChem eller merket uavklart',
      'begge: både koblet og uavklart',
      'salt: ugyldig InChIKey',
      'salt: ugyldig formel',
    ])
  })
})

/* --- Lesingen av svarene ---------------------------------------------------- */

describe('lesingen av svarene fra PubChem', () => {
  it('leser formelen, molekylvekten som tekst, InChIKey og stereokjemien', () => {
    const lest = lesPubchemrad(rad(2771))
    expect(lest).toEqual({
      data: expect.objectContaining({
        cid: 2771,
        tittel: 'Citalopram',
        formel: 'C20H21FN2O',
        molvekt: '324.4',
        inchikey: 'WSEQXVZVJXJVFP-UHFFFAOYSA-N',
        ladning: 0,
        enheter: 1,
        stereo: { definerte: 0, udefinerte: 1, definerte_bindinger: 0, udefinerte_bindinger: 0 },
      }),
    })
    expect(lesPubchemrad(rad(28486))).toMatchObject({ data: { formel: 'Li+', ladning: 1 } })
  })

  it('avviser en rad der det omregningen og kontrollen bygger på, mangler eller har feil form', () => {
    const { MolecularWeight: _mw, ...utenVekt } = rad(2771)
    expect(lesPubchemrad(utenVekt)).toEqual({ avvik: 'CID 2771: MolecularWeight mangler eller er ikke et tall' })
    expect(lesPubchemrad({ ...rad(2771), InChIKey: 'WSEQXVZVJXJVFP' })).toEqual({ avvik: 'CID 2771: InChIKey mangler eller har feil form' })
    expect(lesPubchemrad({ ...rad(2771), MolecularFormula: '' })).toEqual({ avvik: 'CID 2771: MolecularFormula mangler' })
    expect(lesPubchemrad({ MolecularFormula: 'C' })).toEqual({ avvik: 'CID mangler' })
    expect(lesPubchemrad(null)).toEqual({ avvik: 'raden er ikke et objekt' })
  })

  it('lager adressen og skjelettet', () => {
    expect(pubchemUrl(2771)).toBe('https://pubchem.ncbi.nlm.nih.gov/compound/2771')
    expect(skjelett('WSEQXVZVJXJVFP-UHFFFAOYSA-N')).toBe('WSEQXVZVJXJVFP')
  })
})

/* --- Kallene ---------------------------------------------------------------- */

describe('kallene', () => {
  it('går ett om gangen med avstand, og venter det kilden ber om ved 429', async () => {
    let klokke = 0
    const ventet: number[] = []
    const svar = [new Response('', { status: 429, headers: { 'retry-after': '3' } }), new Response('ok')]
    const startet: number[] = []
    const henting = lagHofligHenting({
      avstand: 250,
      na: () => klokke,
      vent: async (ms) => {
        ventet.push(ms)
        klokke += ms
      },
      hent: async () => {
        startet.push(klokke)
        return svar.shift() ?? new Response('ok')
      },
    })
    const [a, b] = await Promise.all([henting('https://x/a'), henting('https://x/b')])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(ventet).toEqual([3000, 250])
    expect(startet).toEqual([0, 3000, 3250])
  })

  it('henter egenskapene med POST, høyst hundre CID-er i hvert kall, og tåler et ukjent navn', async () => {
    const kall: { url: string; body: string }[] = []
    const api = lagPubchemApi({
      vent: async () => {},
      hent: async (url, init) => {
        kall.push({ url: String(url), body: String(init?.body ?? '') })
        if (String(url).includes('/name/')) return new Response('{"Fault":{"Message":"No CID found"}}', { status: 404 })
        const cider = String(init?.body).replace('cid=', '').split(',').map(Number)
        return Response.json({ PropertyTable: { Properties: cider.map((CID) => ({ CID })) } })
      },
    })
    const rader = await api.egenskaper(Array.from({ length: 150 }, (_, i) => i + 1))
    expect(rader).toHaveLength(150)
    expect(kall.map((k) => k.body.split(',').length)).toEqual([100, 50])
    expect(kall[0]!.url).toContain('/compound/cid/property/Title,MolecularFormula,MolecularWeight')
    expect(await api.cidsForNavn('finnes ikke')).toEqual([])
  })
})

/* --- Kontrollen ------------------------------------------------------------- */

describe('kontrollen som kobler en forbindelse til PubChem', () => {
  const CITALOPRAM = { engelsk: 'citalopram', form: 'fri' as const }
  const pubchem = (navn: Record<string, number[]>, rader: Record<number, Record<string, unknown>> = {}): PubchemApi => ({
    cidsForNavn: async (n) => navn[n] ?? [],
    egenskaper: async (cider) => cider.map((c) => rader[c] ?? rad(c)),
    moderforbindelser: async () => [],
  })
  const kurering = (api: PubchemApi, uavhengige: Uavhengig[]) => ({ pubchem: api, uavhengige: async () => uavhengige, idag: '2026-10-08' })
  const chebi = (inchikey: string): Uavhengig => ({ kilde: 'ChEBI', id: 'CHEBI:3723', inchikey })

  it('godtar et entydig navnetreff med samme InChIKey hos en uavhengig kilde', async () => {
    const resultat = await kurerForbindelse(CITALOPRAM, kurering(pubchem({ citalopram: [2771] }), [chebi('WSEQXVZVJXJVFP-UHFFFAOYSA-N')]))
    expect(resultat).toEqual({
      pubchem: {
        cid: 2771,
        inchikey: 'WSEQXVZVJXJVFP-UHFFFAOYSA-N',
        formel: 'C20H21FN2O',
        kontrollert: '2026-10-08',
        grunnlag: 'Eneste treff i PubChem for «citalopram»; samme InChIKey hos ChEBI (CHEBI:3723).',
      },
      data: expect.objectContaining({ molvekt: '324.4' }),
    })
  })

  it('godtar aldri et tvetydig navnetreff, et salt, eller et treff ingen uavhengig kilde bekrefter', async () => {
    expect(await kurerForbindelse(CITALOPRAM, kurering(pubchem({ citalopram: [2771, 146570] }), []))).toEqual({
      uavklart: { grunn: 'PubChem har 2 forbindelser med navnet «citalopram».', kandidater: [2771, 146570] },
    })
    const salt = pubchem({ citalopram: [2771] }, { 2771: { ...rad(2771), CovalentUnitCount: 2, Title: 'Citalopram hydrobromide' } })
    expect(await kurerForbindelse(CITALOPRAM, kurering(salt, []))).toMatchObject({
      uavklart: { grunn: 'Treffet i PubChem (Citalopram hydrobromide) er et salt eller en blanding.' },
    })
    expect(await kurerForbindelse(CITALOPRAM, kurering(pubchem({ citalopram: [2771] }), []))).toMatchObject({
      uavklart: { grunn: 'Ingen uavhengig kilde (ClinPGx, ChEBI) bekrefter treffet i PubChem (Citalopram).', kandidater: [2771] },
    })
    expect(await kurerForbindelse(CITALOPRAM, kurering(pubchem({}), []))).toMatchObject({ uavklart: { kandidater: [] } })
    // En uavhengig kilde med en annen forbindelse er ingen bekreftelse.
    expect(await kurerForbindelse(CITALOPRAM, kurering(pubchem({ citalopram: [2771] }), [chebi('AAAAAAAAAAAAAA-UHFFFAOYSA-N')]))).toMatchObject({
      uavklart: { grunn: 'ChEBI (CHEBI:3723) har en annen forbindelse enn PubChem for «citalopram».' },
    })
  })

  it('godtar samme skjelett med annen stereokjemi bare når treffet er PubChems egen post for navnet', async () => {
    const annenStereo = chebi('WSEQXVZVJXJVFP-HXUWFJFHSA-N')
    const egen = await kurerForbindelse(CITALOPRAM, kurering(pubchem({ citalopram: [2771] }), [annenStereo]))
    expect(egen).toMatchObject({ pubchem: { cid: 2771 } })
    expect('pubchem' in egen && egen.pubchem.grunnlag).toContain('annen stereokjemi eller protonering')
    const annet = pubchem({ citalopram: [2771] }, { 2771: { ...rad(2771), Title: 'Noe annet' } })
    expect(await kurerForbindelse(CITALOPRAM, kurering(annet, [annenStereo]))).toMatchObject({
      uavklart: { kandidater: [2771] },
    })
  })

  it('slår opp de uavhengige kildene også på synonymene og PubChems tittel', async () => {
    let spurt: readonly string[] = []
    await kurerForbindelse(
      { engelsk: 'nordoxepin', form: 'fri', synonymer: ['desmethyldoxepin', 'Nordoxepin'] },
      {
        pubchem: pubchem({ nordoxepin: [2771] }, { 2771: { ...rad(2771), Title: 'Nordoxepin hydro' } }),
        uavhengige: async (navn) => {
          spurt = navn
          return []
        },
        idag: '2026-10-08',
      },
    )
    expect(spurt).toEqual(['nordoxepin', 'desmethyldoxepin', 'Nordoxepin hydro'])
  })

  it('sammenligner navn uten ChEBIs HTML-merking og greske bokstaver', () => {
    expect(navnenokkel('11-nor-9-carboxy-Δ<small><sup>9</small></sup>-tetrahydrocannabinol')).toBe(
      navnenokkel('11-nor-9-carboxy-delta9-tetrahydrocannabinol'),
    )
    expect(navnenokkel('<em>N</em>-desmethylclozapine')).toBe(navnenokkel('N-desmethylclozapine'))
    expect(navnenokkel('enalaprilat (anhydrous)')).toBe('enalaprilatanhydrous')
  })
})

/* --- Synkroniseringen --------------------------------------------------------- */

/** Et register med forbindelsene i det ekte svaret, koblet slik datafilen kobler dem. */
function testregister(nokler = ['citalopram', 'desmetylcitalopram', 'thc', 'thc-cooh', 'bupropion']): Forbindelsesregister {
  const valgte = nokler.map((n) => FORBINDELSER.finn(n)!)
  return byggForbindelsesregister([...valgte, FORBINDELSER.finn('desmetylklomipramin')!])
}

function falskApi(endre: (rader: Record<string, unknown>[]) => Record<string, unknown>[] = (r) => r): PubchemApi & { kall: number } {
  const api = {
    kall: 0,
    egenskaper: async (cider: readonly number[]) => {
      api.kall += 1
      return endre(RADER.filter((r) => cider.includes(r.CID as number)).map((r) => ({ ...r })))
    },
    cidsForNavn: async () => [],
    moderforbindelser: async () => [],
  }
  return api
}

describe('synkroniseringen', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let admin: string
  let leser: Kjemileser
  const lager = () => lagKjemilager(kallSom(db, 'service_role'))
  type Endring = { art: string; niva: string; objekt_id: string; felt: string[]; etikett: string; spor: Record<string, unknown> }
  const endringer = async () =>
    (await db.query<Endring>(`select art, niva, objekt_id, felt, etikett, spor from datakilder.endringer where kilde = 'pubchem' order by id`)).rows

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lea', etternavn: 'Leser', rolle: 'user' })
    kall = faginnholdskall(db, admin)
    leser = lagKjemileser(kall.klientFor(bruker))
  }, 60_000)

  beforeEach(async () => {
    await db.exec('truncate pubchem.forbindelser, pubchem.synkroniseringer cascade; truncate datakilder.endringer')
  })

  it('henter alle de koblede forbindelsene i ett kall og bytter dem inn, med rådataene ved siden av', async () => {
    const api = falskApi()
    const resultat = await synkroniserKjemi({ lager: lager(), api, register: testregister() })
    expect(resultat).toEqual({
      status: 'fullfort',
      synk: expect.any(Number),
      forbindelser: 5,
      hentet: 5,
      endret: 0,
      feilet: 0,
      konflikter: 0,
      strukturavvik: 0,
      uavklarte: ['desmetylklomipramin'],
    })
    expect(api.kall).toBe(1)
    const [raa] = (await db.query<{ raa: { Title: string } }>('select raa from pubchem.forbindelser where cid = 2771')).rows
    expect(raa!.raa.Title).toBe('Citalopram')

    const utvalg = await leser.les(['2771', '162180', '999'])
    expect(utvalg.forbindelser.map((f) => [f.cid, f.data.formel, f.data.molvekt])).toEqual([
      [2771, 'C20H21FN2O', '324.4'],
      [162180, 'C19H19FN2O', '310.4'],
    ])
    expect(utvalg.kontrollert_kl).not.toBeNull()
    // Rådataene går aldri til nettleseren.
    expect(JSON.stringify(utvalg)).not.toContain('IUPACName')
  })

  it('beholder dataene fra før når PubChem oppgir en annen identitet, og bytter inn resten', async () => {
    await synkroniserKjemi({ lager: lager(), api: falskApi(), register: testregister() })
    const resultat = await synkroniserKjemi({
      lager: lager(),
      api: falskApi((rader) => rader.map((r) => (r.CID === 2771 ? { ...r, InChIKey: 'WSEQXVZVJXJVFP-HXUWFJFHSA-N', MolecularWeight: '999.9' } : r))),
      register: testregister(),
    })
    expect(resultat).toMatchObject({ status: 'delvis', hentet: 4, feilet: 1, konflikter: 1, strukturavvik: 0 })
    expect('feil' in resultat && resultat.feil).toContain(
      'citalopram (CID 2771): PubChem oppgir nå InChIKey WSEQXVZVJXJVFP-HXUWFJFHSA-N, men koblingen ble kontrollert mot WSEQXVZVJXJVFP-UHFFFAOYSA-N.',
    )
    const [citalopram] = (await leser.les(['2771'])).forbindelser
    expect(citalopram!.data.molvekt).toBe('324.4')
    const [rad] = (await db.query<{ feil: string }>('select feil from pubchem.forbindelser where cid = 2771')).rows
    expect(rad!.feil).toContain('Dataene fra før står')
  })

  it('bytter ikke inn noe når mange forbindelser mangler i svaret eller ikke kan leses', async () => {
    await synkroniserKjemi({ lager: lager(), api: falskApi(), register: testregister() })
    const resultat = await synkroniserKjemi({
      lager: lager(),
      api: falskApi((rader) => rader.map(({ MolecularWeight: _mw, ...r }) => ({ ...r, Title: 'Nytt' }))),
      register: testregister(),
    })
    expect(resultat).toMatchObject({ status: 'feilet' })
    expect('feil' in resultat && resultat.feil).toContain('5 av 5 forbindelser manglet i svaret fra PubChem eller kunne ikke leses')
    const titler = (await leser.les(['2771', '16078'])).forbindelser.map((f) => f.data.tittel)
    expect(titler).toEqual(['Citalopram', expect.not.stringMatching(/^Nytt$/)])
    expect(maksBortfall(5)).toBe(2)
    expect(maksBortfall(135)).toBe(13)

    // Ett som mangler, er ingen grunn til å stoppe resten.
    const ett = await synkroniserKjemi({ lager: lager(), api: falskApi((r) => r.filter((x) => x.CID !== 444)), register: testregister() })
    expect(ett).toMatchObject({ status: 'delvis', hentet: 4, feilet: 1, strukturavvik: 1 })
    expect('feil' in ett && ett.feil).toContain('bupropion (CID 444): PubChem ga ikke forbindelsen i svaret. Dataene fra før står.')
  })

  it('logger første henting som ett grunnlag, en endret molekylvekt som klinisk og en ny tittel som metadata', async () => {
    await synkroniserKjemi({ lager: lager(), api: falskApi(), register: testregister() })
    expect(await endringer()).toEqual([
      expect.objectContaining({ art: 'grunnlag', objekt_id: 'forbindelser', etikett: 'Første henting fra PubChem: 5 forbindelser', spor: { antall: 5 } }),
    ])
    await synkroniserKjemi({ lager: lager(), api: falskApi(), register: testregister() })
    expect(await endringer()).toHaveLength(1)

    await synkroniserKjemi({
      lager: lager(),
      api: falskApi((rader) =>
        rader.map((r) => (r.CID === 444 ? { ...r, MolecularWeight: '239.8' } : r.CID === 2771 ? { ...r, Title: 'Citalopramum' } : r)),
      ),
      register: testregister(),
    })
    const [, ...nye] = await endringer()
    expect(nye).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ art: 'endret', niva: 'klinisk', objekt_id: '444', felt: ['molvekt'], etikett: 'Bupropion' }),
        expect.objectContaining({ art: 'endret', niva: 'metadata', objekt_id: '2771', felt: ['tittel'] }),
      ]),
    )
    expect(nye).toHaveLength(2)
  })

  it('logger en endring som bare kommer av en ny lesing som metadata, med parserversjonene', async () => {
    const l = lager()
    const synk = await l.start('manuell')
    const lest = lesPubchemrad(rad(444))
    if (!('data' in lest)) throw new Error('kunne ikke lese')
    await l.lagre(synk, [{ cid: 444, data: lest.data, raa: rad(444) }], 1)
    await l.lagre(synk, [{ cid: 444, data: { ...lest.data, iupac: null, ladning: 1 }, raa: rad(444) }], 2)
    await l.fullfor(synk, { forbindelser: 1, hentet: 1, endret: 1, feilet: 0, konflikter: 0, strukturavvik: 0, uavklarte: [] }, 2)
    const [, ny] = await endringer()
    expect(ny).toEqual(
      expect.objectContaining({ art: 'endret', niva: 'metadata', felt: ['iupac', 'ladning'], spor: { parserversjon: { foer: 1, etter: 2 } } }),
    )
  })

  it('avviser data med feil form, og bare én kjøring om gangen', async () => {
    const l = lager()
    const synk = await l.start('cron')
    await expect(l.lagre(synk, [{ cid: 444, data: { cid: 444, formel: 'C', molvekt: 'tung', inchikey: 'x' } as never, raa: null }], 1)).rejects.toThrow(
      'Forbindelsene har feil form.',
    )
    await expect(l.start('cron')).rejects.toThrow('En synkronisering fra PubChem pågår allerede.')
    await l.avbryt(synk, 'stoppet')
  })

  it('står i «Datakilder» med kjøringene, endringene og forbindelsene som venter på vurdering', async () => {
    await synkroniserKjemi({ lager: lager(), api: falskApi(), register: testregister() })
    const status = lesDatakildestatus((await kall.klientFor(admin).rpc('datakilder_status', {})).data)
    const pubchem = vurderKilder(status, Date.now(), { pubchem: 7 }).find((v) => v.kilde === 'pubchem')!
    expect(pubchem).toMatchObject({ navn: 'PubChem', tilstand: 'ok', versjon: '1', melding: 'Siste henting fant ingen endringer.' })
    expect(pubchem.sisteVellykkede!.uavklarte).toEqual(['desmetylklomipramin'])
    expect(pubchem.endringer).toEqual([expect.objectContaining({ art: 'grunnlag', kilde: 'pubchem' })])
  })
})

/* --- Endepunktet ---------------------------------------------------------------- */

describe('endepunktet', () => {
  const miljo = { CRON_SECRET: 'hemmelig', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' }
  const synkroniser = async () => ({ status: 'fullfort' as const, synk: 1, forbindelser: 0, hentet: 0, endret: 0, feilet: 0, konflikter: 0, strukturavvik: 0, uavklarte: [] })

  it('kjører for Vercels cron og for administratorer, og avviser alle andre', async () => {
    const be = (init: RequestInit) => behandlePubchemSynk(new Request('https://ousfar/api/pubchem-synk', init), miljo, { synkroniser, adminsjekk: async (t) => t === 'admin' })
    expect((await be({ headers: { authorization: 'Bearer hemmelig' } })).status).toBe(200)
    expect((await be({ method: 'POST', headers: { authorization: 'Bearer admin' } })).status).toBe(200)
    expect((await be({ headers: { authorization: 'Bearer feil' } })).status).toBe(401)
    expect((await be({ method: 'POST', headers: { authorization: 'Bearer hemmelig' } })).status).toBe(401)
    expect((await be({ method: 'PUT' })).status).toBe(405)
  })

  it('svarer 502 når kjøringen feilet', async () => {
    const res = await behandlePubchemSynk(
      new Request('https://ousfar/api/pubchem-synk', { headers: { authorization: 'Bearer hemmelig' } }),
      miljo,
      { synkroniser: async () => ({ status: 'feilet', synk: 1, feil: 'PubChem svarte 503' }) },
    )
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ status: 'feilet', synk: 1, feil: 'PubChem svarte 503' })
  })
})

/* --- Visningen ------------------------------------------------------------------ */

describe('visningen på fagsidene', () => {
  const utvalg = lesKjemiutvalg({
    kilde: 'PubChem',
    kontrollert_kl: '2026-10-08T03:15:00Z',
    forbindelser: [2771, 162180].map((cid) => {
      const lest = lesPubchemrad(rad(cid))
      return { cid, data: 'data' in lest ? lest.data : null, sist_hentet_kl: '2026-10-08T03:15:00Z' }
    }),
  })

  it('viser selve stoffet og metabolittene, også før dataene er hentet', () => {
    expect(kjemicider('citalopram')).toEqual(['2771', '162180'])
    const visning = byggKjemivisning('citalopram', utvalg)
    expect(visning.rader.map((r) => [r.forbindelse.navn, r.relasjon, r.status, r.data?.molvekt])).toEqual([
      ['Citalopram', 'selve_stoffet', 'hentet', '324.4'],
      ['Desmetylcitalopram', 'metabolitt', 'hentet', '310.4'],
    ])
    expect(kjemioppsummering(visning)).toBe('Citalopram 324,4 g/mol · Desmetylcitalopram 310,4 g/mol')
    expect(byggKjemivisning('klomipramin', null).rader.map((r) => r.status)).toEqual(['ikke_hentet', 'uavklart'])
  })

  it('skriver formelen med senkede tall og ladningen hevet', () => {
    expect(formeltekst('C20H21FN2O')).toBe('C₂₀H₂₁FN₂O')
    expect(formeltekst('Li+')).toBe('Li⁺')
    expect(formeldeler('C2H5O4S-')).toEqual([
      { tekst: 'C', slag: 'vanlig' },
      { tekst: '2', slag: 'senket' },
      { tekst: 'H', slag: 'vanlig' },
      { tekst: '5', slag: 'senket' },
      { tekst: 'O', slag: 'vanlig' },
      { tekst: '4', slag: 'senket' },
      { tekst: 'S', slag: 'vanlig' },
      { tekst: '-', slag: 'hevet' },
    ])
    expect(molvekttekst('104.10')).toBe('104,10 g/mol')
  })

  it('lar søket på siden finne navnene, formlene og identifikatorene', () => {
    const tekster = kjemisoketekster(byggKjemivisning('citalopram', utvalg)).map((t) => [t.panel, t.felt, t.tekst])
    expect(tekster).toContainEqual([KJEMIPANEL, 'verdi', 'CID 162180'])
    expect(tekster).toContainEqual([KJEMIPANEL, 'verdi', 'WSEQXVZVJXJVFP-UHFFFAOYSA-N'])
    expect(tekster).toContainEqual([KJEMIPANEL, 'overskrift', 'Desmetylcitalopram'])
  })

  it('har PubChem som kilde i referansefeltet, med når dataene sist ble kontrollert', () => {
    const { referanser, panelreferanser } = pubchemreferanser(byggKjemivisning('citalopram', utvalg))
    expect(panelreferanser).toEqual({ [KJEMIPANEL]: [PUBCHEM_KILDE] })
    expect(referanser[0]!.automatisk).toEqual({ kilde: 'PubChem', opphav: 'Kjemiske grunndata fra PubChem, sist kontrollert 8. oktober 2026' })
    expect(pubchemreferanser(byggKjemivisning('citalopram', null)).referanser).toEqual([])
  })

  it('hopper over en lagret forbindelse som ikke ser ut som ventet', () => {
    const lest = lesKjemiutvalg({ forbindelser: [{ cid: 1, data: { cid: 1, formel: 'C', molvekt: 'x', inchikey: 'y' } }, { cid: 2, data: null }, 'tull'] })
    expect(lest).toEqual({ kilde: 'PubChem', kontrollert_kl: null, forbindelser: [] })
  })
})

