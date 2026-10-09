/**
 * Laboratorieanalysene fra Farmakologiportalen: enhetene og omregningen,
 * lesingen av portalens rader, kontrollen som kobler forbindelsene til
 * portalen, synkroniseringen inn i en ekte database bygd av migrasjonene,
 * endringsloggen og endepunktet.
 *
 * `data/farmakologiportalen/` er et ekte utdrag fra portalens API: alle
 * enhetene og prøvematerialene, og komponentene, analysene, laboratoriene og
 * institusjonene for citalopram og desmetylcitalopram, THC med OH-THC og
 * THC-COOH, og bupropion med hydroksybupropion — med gruppe- og sumanalysene
 * som dekker dem. Bildene og redaksjonens navn er tatt ut.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lesDatakildestatus, vurderKilder } from '../datakilder/status'
import {
  lesGrense,
  lesKonsentrasjonsenhet,
  regnOm,
  visGrense,
  visOmrade,
  visTall,
} from '../enheter/konsentrasjon'
import { lagFpApi, type FpApi } from '../farmakologiportalen/api'
import { behandleFpSynk, FP_ARBEIDSFLYT } from '../farmakologiportalen/endepunkt'
import { komponentnavn, kurerFp, type Fpkomponent } from '../farmakologiportalen/kurering'
import { lagFplager } from '../farmakologiportalen/lager'
import { ENTITETER, ENTITETNAVN, entitet, type Analysedata, type Komponentdata } from '../farmakologiportalen/modell'
import { matriseFor } from '../farmakologiportalen/provematerialer'
import { lagRapport, strukturavvik, synkroniserFarmakologiportalen } from '../farmakologiportalen/synk'
import { lagLableser, type Lableser, type Labutvalg } from '../farmakologiportalen/lesing'
import { fpreferanser, FP_KILDE } from '../farmakologiportalen/referanser'
import {
  byggLabvisning,
  harEgenBenevning,
  labkomponenter,
  laboppsummering,
  labsoketekster,
  LABPANEL,
  maleomrade,
  type Labvisning,
} from '../farmakologiportalen/stoffside'
import { byggKjemivisning } from '../kjemi/stoffside'
import { byggForbindelsesregister, FORBINDELSER, type Forbindelse } from '../kjemi/forbindelser'
import { githubkrav, githubkjoring, type Githubsjekk } from '../server/tilgang'
import { kallSom } from './hjelp/fest'
import { faginnholdskall, nyDatabase, opprettBruker } from './hjelp/testdatabase'

type Rad = Record<string, unknown>
const fil = (navn: string) =>
  JSON.parse(readFileSync(new URL(`./data/farmakologiportalen/${navn}.json`, import.meta.url), 'utf8')) as Rad[]

/** Listene slik portalens API ga dem, per sti. */
const LISTER: Record<string, Rad[]> = {
  '/units': fil('units'),
  '/sampletypes': fil('sampletypes'),
  '/institutions': fil('institutions'),
  '/labs': fil('labs'),
  '/components': fil('components'),
  '/analyses': fil('analyses'),
}

/** Et API som svarer med utdraget, eventuelt endret per sti. */
function falskApi(endre: (sti: string, rader: Rad[]) => Rad[] = (_, r) => r): FpApi & { kall: string[] } {
  const kall: string[] = []
  return {
    kall,
    liste: async (sti) => {
      kall.push(sti)
      return endre(sti, structuredClone(LISTER[sti] ?? []))
    },
  }
}

const enheter = new Map(LISTER['/units']!.map((u) => [String(u.id), String(u.name)]))
const les = <T>(navn: Parameters<typeof entitet>[0], rad: Rad) => entitet(navn).les(rad, { enheter })?.data as T | undefined

/* --- Enhetene ------------------------------------------------------------- */

describe('konsentrasjonsenhetene', () => {
  it('kjenner skrivemåtene laboratoriene bruker', () => {
    for (const [tekst, enhet] of [
      ['µg/L', 'µg/L'],
      ['μg/L', 'µg/L'], // gresk my
      ['ug/l', 'µg/L'],
      ['mcg/L', 'µg/L'],
      ['ng/mL', 'µg/L'],
      ['nmol/L', 'nmol/L'],
      ['umol/L', 'µmol/L'],
      ['mg/L', 'mg/L'],
    ] as const) {
      expect(lesKonsentrasjonsenhet(tekst)?.enhet, tekst).toBe(enhet)
    }
    for (const tekst of ['Kvalitativ', 'Annen enhet', 'µmol/mmol kreatinin', '‰', 'ng/g', '', null]) {
      expect(lesKonsentrasjonsenhet(tekst), String(tekst)).toBeNull()
    }
  })

  it('regner om mellom masse og stoffmengde bare med molekylvekten', () => {
    const ug = lesKonsentrasjonsenhet('µg/L')!
    const nmol = lesKonsentrasjonsenhet('nmol/L')!
    const umol = lesKonsentrasjonsenhet('µmol/L')!
    const mg = lesKonsentrasjonsenhet('mg/L')!
    // Citalopram, 324,4 g/mol: 100 µg/L = 308,3 nmol/L.
    expect(regnOm(100, ug, nmol, 324.4)).toBeCloseTo(308.26, 2)
    expect(regnOm(308.26, nmol, ug, 324.4)).toBeCloseTo(100, 2)
    expect(regnOm(100, ug, umol, 324.4)).toBeCloseTo(0.30826, 4)
    expect(regnOm(100, ug, nmol)).toBeNull()
    expect(regnOm(100, ug, nmol, 0)).toBeNull()
    // Innenfor samme slag trengs ingen molekylvekt.
    expect(regnOm(1, mg, ug)).toBe(1000)
    expect(regnOm(500, nmol, umol)).toBe(0.5)
  })

  it('viser høyst to gjeldende sifre, med desimalkomma og uten tusenskille', () => {
    expect([1.2364, 17.1, 1356.15, 0.0549, 0.05, 99.5, 5, 0.1, 1000].map(visTall)).toEqual([
      '1,2',
      '17',
      '1400',
      '0,055',
      '0,05',
      '100',
      '5',
      '0,1',
      '1000',
    ])
  })

  it('leser grensene slik laboratoriene skriver dem, og står med teksten når tallet ikke kan leses', () => {
    expect(lesGrense('0,10')).toEqual({ original: '0,10', verdi: 0.1, komparator: null, enhet: null })
    expect(lesGrense('< 0,05')).toMatchObject({ verdi: 0.05, komparator: '<' })
    expect(lesGrense('>=2')).toMatchObject({ verdi: 2, komparator: '≥' })
    expect(lesGrense('20 µg/L')).toMatchObject({ verdi: 20, enhet: 'µg/L' })
    expect(lesGrense('1.5 ')).toMatchObject({ original: '1.5', verdi: 1.5 })
    expect(lesGrense('1 000')).toMatchObject({ verdi: 1000 })
    expect(lesGrense('se merknad')).toEqual({ original: 'se merknad', verdi: null, komparator: null, enhet: null })
    expect(lesGrense('5 mmol/mol kreatinin')).toMatchObject({ verdi: null })
    expect(lesGrense('')).toBeNull()
    expect(lesGrense(null)).toBeNull()
    expect(lesGrense(12)).toMatchObject({ verdi: 12 })
  })

  it('skriver områdene med tankestrek, og bare den ene grensen når den andre mangler', () => {
    expect(visOmrade('5', '500')).toBe('5—500')
    expect(visOmrade('0,1', null)).toBe('fra 0,1')
    expect(visOmrade(null, '2')).toBe('opptil 2')
    expect(visOmrade(null, null)).toBe('')
    expect(visGrense({ original: '< 0,05', verdi: 0.0549, komparator: '<' })).toBe('< 0,055')
    expect(visGrense({ original: 'se merknad', verdi: null, komparator: null })).toBe('se merknad')
  })
})

/* --- Lesingen ------------------------------------------------------------- */

describe('lesingen av portalens rader', () => {
  it('leser hele utdraget uten å forkaste noe', () => {
    for (const e of ENTITETER) {
      const rader = LISTER[e.sti]!
      expect(rader.length, e.sti).toBeGreaterThan(0)
      expect(rader.filter((r) => !e.les(r, { enheter })).length, e.sti).toBe(0)
      expect(strukturavvik(e, rader), e.sti).toEqual([])
    }
    expect(ENTITETER.map((e) => e.navn)).toEqual([...ENTITETNAVN])
  })

  it('leser komponentene: molekylvekt bare når den er et rent tall, gruppene og metabolittene', () => {
    const k = (id: string) => les<Komponentdata>('komponent', LISTER['/components']!.find((r) => r.id === id)!)!
    expect(k('529')).toMatchObject({ navn: 'Bupropion', molvekt: { original: '239,74', verdi: 239.74 }, gruppe: [] })
    expect(k('8248')).toMatchObject({ navn: 'Sum: Bupropion + hydroksybupropion', gruppe: ['529', '794'] })
    expect(k('3788').gruppe).toEqual(['742'])
    expect(les<Komponentdata>('komponent', { id: '1', title: 'X', molecular_weight: '239,74 (enalaprilat)' })!.molvekt).toEqual({
      original: '239,74 (enalaprilat)',
      verdi: null,
    })
    expect(les<Komponentdata>('komponent', { id: '1', title: 'X', molecular_weight: '0' })!.molvekt.verdi).toBeNull()
  })

  it('leser analysene tolerant: enheter som ID, enheter i verdien, ukjent metode og prøvemateriale', () => {
    const grunn = { id: '1', analysis_archetype_id: '536', lab_id: '2', sampletype_name: 'Serum', method: 'LC-MS/MS' }
    const a = (rad: Rad) => les<Analysedata>('analyse', { ...grunn, ...rad })!
    const mgEnhet = [...enheter].find(([, navn]) => navn === 'mg/L')
    if (mgEnhet) expect(a({ meassurearea_unit: mgEnhet[0] }).maleomrade.enhet).toEqual({ original: 'mg/L', enhet: 'mg/L' })
    expect(a({ meassurearea_lower: '20 µg/L', meassurearea_unit: null }).maleomrade.enhet).toEqual({ original: 'µg/L', enhet: 'µg/L' })
    expect(a({ meassurearea_unit: 'Kvalitativ' }).maleomrade.enhet).toEqual({ original: 'Kvalitativ', enhet: null })
    expect(a({ method: 'unknown' }).metode).toBeNull()
    expect(a({ sampletype_name: 'Munnvæske' }).provemateriale).toEqual({ original: 'Munnvæske', matrise: 'spytt' })
    expect(a({ sampletype_name: 'Svette' }).provemateriale).toEqual({ original: 'Svette', matrise: null })
    expect(a({ lab_id: null }).laboratorium_id).toBeNull()
    expect(entitet('analyse').les({ id: '1' }, { enheter })).toBeNull()
  })

  it('samler serum og plasma i én matrise og beholder resten for seg', () => {
    expect(['Serum', 'Plasma', 'serum/plasma'].map((p) => matriseFor(p)?.nokkel)).toEqual(['serum_plasma', 'serum_plasma', 'serum_plasma'])
    expect(['Fullblod', 'Urin', 'Hår', 'Kapillærblod'].map((p) => matriseFor(p)?.nokkel)).toEqual(['fullblod', 'urin', 'har', 'kapillaerblod'])
    expect(matriseFor('Svette')).toBeNull()
  })

  it('finner seg i at portalen ikke svarer eller svarer noe annet enn en liste', async () => {
    const svar = (status: number, innhold: unknown) => async () => new Response(JSON.stringify(innhold), { status })
    const api = (hent: () => Promise<Response>) => lagFpApi({ hent, avstand: 0, nyeForsok: 0, vent: async () => {} })
    await expect(api(svar(401, {})).liste('/units')).rejects.toThrow('svarte 401')
    await expect(api(svar(200, { feil: 1 })).liste('/units')).rejects.toThrow('ikke en liste')
    await expect(api(svar(200, [{ id: 1 }])).liste('/units')).resolves.toEqual([{ id: 1 }])
  })
})

/* --- Koblingen til forbindelsene ------------------------------------------ */

describe('koblingen til forbindelsene', () => {
  const komponenter: Fpkomponent[] = LISTER['/components']!.map((r) => ({
    id: String(r.id),
    data: les<Komponentdata>('komponent', r)!,
  }))
  const forbindelse = (nokkel: string) => FORBINDELSER.finn(nokkel)!

  it('kjenner komponentene på tittelen, tittelen uten parentesen og forkortelsen', () => {
    expect(komponentnavn('Tetrahydrocannabinolsyre (THC-COOH)')).toEqual(['tetrahydrocannabinolsyrethccooh', 'tetrahydrocannabinolsyre', 'thccooh'])
  })

  it('verifiserer en kobling når CAS-nummeret eller molekylvekten stemmer med PubChem', () => {
    const k = kurerFp(forbindelse('citalopram'), komponenter, { cid: 2771, molvekt: 324.4, cas: new Set(['59729-33-8']) }, '2026-10-08')
    expect(k).toMatchObject({ status: 'verifisert', id: '536', navn: 'Citalopram' })
  })

  it('kobler bare på navnet, som usikker, når portalens tall ikke kan kontrolleres', () => {
    const k = kurerFp(forbindelse('hydroksybupropion'), komponenter, { cid: 446, molvekt: 255.74, cas: new Set() }, '2026-10-08')
    expect(k).toMatchObject({ status: 'usikker', id: '794' })
  })

  it('slår opp CAS-nummeret i PubChem: samme forbindelse uten stereokjemien, eller samme formel, er verifisert', () => {
    const f = forbindelse('desmetylcitalopram')
    const kontroll = { cid: 162180, molvekt: 310.4, cas: new Set<string>(), inchikey: f.pubchem!.inchikey, formel: f.pubchem!.formel }
    const oppslag = (inchikey: string, formel: string) => ({ cas: '144010-85-5', cid: 12986614, inchikey, formel, tittel: 'R-desmetylcitalopram' })
    // R-formen: samme skjelett i InChIKey.
    expect(kurerFp(f, komponenter, { ...kontroll, casoppslag: [oppslag('PTJADDMMFYXMMG-LJQANCHMSA-N', 'C19H19FN2O')] }, '2026-10-08')).toMatchObject({
      status: 'verifisert',
      id: '795',
      grunnlag: expect.stringContaining('uten hensyn til stereokjemien (InChIKey-skjelett PTJADDMMFYXMMG)'),
    })
    // En annen form med samme formel (hydroksybupropion som morfolinol).
    expect(kurerFp(f, komponenter, { ...kontroll, casoppslag: [oppslag('AAAAAAAAAAAAAA-UHFFFAOYSA-N', 'C19H19FN2O')] }, '2026-10-08')).toMatchObject({
      status: 'verifisert',
      grunnlag: expect.stringContaining('samme molekylformel (C19H19FN2O)'),
    })
    // Noe annet: portalen har feil CAS-nummer, og koblingen er bare på navnet.
    expect(kurerFp(f, komponenter, { ...kontroll, casoppslag: [oppslag('OYOUQHVDCKOOAL-UHFFFAOYSA-N', 'C15H13N3O')] }, '2026-10-08')).toMatchObject({
      status: 'usikker',
      grunnlag: expect.stringContaining('men hos PubChem «R-desmetylcitalopram» (CID 12986614, C15H13N3O)'),
    })
    // Et oppslag av et annet CAS-nummer enn komponentens teller ikke.
    expect(
      kurerFp(f, komponenter, { ...kontroll, casoppslag: [{ ...oppslag('PTJADDMMFYXMMG-LJQANCHMSA-N', 'C19H19FN2O'), cas: '1-11-1' }] }, '2026-10-08').status,
    ).toBe('usikker')
  })

  it('godtar ikke et navnetreff der både CAS-nummer og molekylvekt avviker', () => {
    const k = kurerFp(forbindelse('bupropion'), komponenter, { cid: 444, molvekt: 300, cas: new Set(['1-11-1']) }, '2026-10-08')
    expect(k).toMatchObject({ status: 'uavklart', kandidater: ['529'] })
  })

  it('regner aldri gruppe- og sumanalyser som en komponent med navnet', () => {
    const sum = { nokkel: 'x', navn: 'Sum: Bupropion + hydroksybupropion', engelsk: 'x' }
    expect(kurerFp(sum, komponenter, { cid: null, molvekt: null, cas: new Set() }, '2026-10-08').status).toBe('uavklart')
  })

  it('velger komponenten med nøyaktig navnet når flere har det, og står uavklart når ingen skiller seg ut', () => {
    const mk = (id: string, navn: string): Fpkomponent => ({ id, data: { navn, cas: null, molvekt: { original: null, verdi: null }, gruppe: [] } })
    const f = { nokkel: 'fenytoin', navn: 'Fenytoin', engelsk: 'phenytoin' }
    const ingen = { cid: null, molvekt: null, cas: new Set<string>() }
    expect(kurerFp(f, [mk('1', 'Fenytoin (bundet)'), mk('2', 'Fenytoin'), mk('3', 'Fenytoin (fritt)')], ingen, '2026-10-08')).toMatchObject({
      status: 'usikker',
      id: '2',
    })
    expect(kurerFp(f, [mk('1', 'Fenytoin (bundet)'), mk('3', 'Fenytoin (fritt)')], ingen, '2026-10-08')).toMatchObject({
      status: 'uavklart',
      kandidater: ['1', '3'],
    })
  })

  it('har koblingene for testparene i datafilen', () => {
    const fp = (n: string) => forbindelse(n).farmakologiportalen
    expect(['citalopram', 'desmetylcitalopram', 'bupropion', 'hydroksybupropion', 'thc', 'thc-oh', 'thc-cooh'].map((n) => [n, fp(n)?.status, FORBINDELSER.fpId(forbindelse(n))])).toEqual([
      ['citalopram', 'verifisert', '536'],
      ['desmetylcitalopram', 'verifisert', '795'],
      ['bupropion', 'verifisert', '529'],
      ['hydroksybupropion', 'verifisert', '794'],
      ['thc', 'verifisert', '742'],
      ['thc-oh', 'verifisert', '743'],
      ['thc-cooh', 'verifisert', '744'],
    ])
  })
})

/* --- Synkroniseringen ----------------------------------------------------- */

/** Testparene og en forbindelse koblet til en komponent portalen ikke har. */
function testregister() {
  const valgte = ['citalopram', 'desmetylcitalopram', 'bupropion', 'hydroksybupropion', 'thc', 'thc-oh', 'thc-cooh'].map(
    (n) => FORBINDELSER.finn(n)!,
  )
  const borte: Forbindelse = {
    ...FORBINDELSER.finn('escitalopram')!,
    farmakologiportalen: { status: 'verifisert', id: '99999', navn: 'Escitalopram', kontrollert: '2026-10-08', grunnlag: 'Test.' },
  }
  return byggForbindelsesregister([...valgte, borte])
}

describe('synkroniseringen', () => {
  let db: PGlite
  const lager = () => lagFplager(kallSom(db, 'service_role'))
  const synk = (api = falskApi()) => synkroniserFarmakologiportalen({ lager: lager(), api, register: testregister(), porsjon: 25 })
  type Endring = { type: string; art: string; niva: string; objekt_id: string; felt: string[]; etikett: string; spor: Record<string, unknown> }
  const endringer = async () =>
    (await db.query<Endring>(`select type, art, niva, objekt_id, felt, etikett, spor from datakilder.endringer where kilde = 'farmakologiportalen' order by id`)).rows
  const antallAktive = async (tabell: string) =>
    (await db.query<{ n: number }>(`select count(*)::int as n from farmakologiportalen.${tabell} where utgatt_kl is null`)).rows[0]!.n

  beforeAll(async () => {
    db = await nyDatabase()
  }, 60_000)

  beforeEach(async () => {
    await db.exec(`
      truncate ${ENTITETNAVN.map((e) => `farmakologiportalen.${e}`).join(', ')}, farmakologiportalen.synkroniseringer cascade;
      update farmakologiportalen.entiteter set sha256 = null, parserversjon = null;
      truncate datakilder.endringer`)
  })

  it('har en tabell for hver type modellen leser', async () => {
    const { rows } = await db.query<{ navn: string }>('select navn from farmakologiportalen.entiteter order by navn')
    expect(rows.map((r) => r.navn)).toEqual([...ENTITETNAVN].sort())
  })

  it('henter de seks listene, bytter dem inn og logger første henting som grunnlag', async () => {
    const api = falskApi()
    const resultat = await synk(api)
    expect(api.kall).toEqual(['/units', '/sampletypes', '/institutions', '/labs', '/components', '/analyses'])
    expect(resultat.status).toBe('fullfort')
    expect(await antallAktive('analyse')).toBe(LISTER['/analyses']!.length)
    expect(await antallAktive('komponent')).toBe(LISTER['/components']!.length)
    const logg = await endringer()
    expect(logg.map((e) => [e.type, e.art])).toEqual(ENTITETNAVN.map((e) => [e, 'grunnlag']).sort((a, b) => a[0]!.localeCompare(b[0]!)))

    const [raa] = (await db.query<{ raa: Rad }>(`select raa from farmakologiportalen.komponent where fp_id = '536'`)).rows
    expect(raa!.raa.title).toBe('Citalopram')
    expect(raa!.raa).not.toHaveProperty('image')
    expect(raa!.raa).not.toHaveProperty('modified_by')
  })

  it('melder koblinger som ikke stemmer, de usikre, og forbindelsene uten kobling', async () => {
    const resultat = await synk()
    expect(resultat.status).toBe('fullfort')
    const antall = 'antall' in resultat ? resultat.antall : {}
    expect(antall.merknader).toEqual(
      expect.arrayContaining([
        '«Escitalopram» er koblet til komponent 99999, som ikke finnes i portalen lenger.',
        'Måleområder i enheter som ikke regnes om: «µmol/mol kreatinin» (4), «Annen enhet» (1).',
      ]),
    )
    expect(antall.merknader!.some((m) => m.startsWith('Koblet bare på navnet'))).toBe(false)
    expect(antall.uavklarte).toEqual([])
  })

  it('er idempotent: en ny kjøring med de samme dataene laster ingenting og logger ingenting', async () => {
    await synk()
    const logget = (await endringer()).length
    const api = falskApi()
    const resultat = await synk(api)
    expect(resultat.status).toBe('uendret')
    expect(await endringer()).toHaveLength(logget)
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from farmakologiportalen.innlasting')
    expect(rows[0]!.n).toBe(0)
  })

  it('logger en endring hos portalen som klinisk, og bare den', async () => {
    await synk()
    const resultat = await synk(
      falskApi((sti, rader) =>
        sti === '/analyses' ? rader.map((r) => (r.analysis_archetype_id === '536' && r.sampletype_name === 'Serum' ? { ...r, meassurearea_upper: '9999' } : r)) : rader,
      ),
    )
    expect(resultat.status).toBe('fullfort')
    const nye = (await endringer()).filter((e) => e.art !== 'grunnlag')
    expect(nye.length).toBeGreaterThan(0)
    expect(nye.every((e) => e.type === 'analyse' && e.niva === 'klinisk' && e.felt.includes('maleomrade'))).toBe(true)
    expect(nye[0]!.etikett).toMatch(/^Citalopram i serum.* · .+ · Serum$/)
  })

  it('logger en endring bare i lesingen som metadata, med parserversjonene i sporet', async () => {
    await synk()
    // Som om en eldre parser hadde lest metoden annerledes: samme rådata, andre data.
    await db.exec(`
      update farmakologiportalen.analyse set data = jsonb_set(data, '{metode}', '"gammel lesing"'), parserversjon = 0,
        hash = md5(jsonb_set(data, '{metode}', '"gammel lesing"')::text || coalesce(raa::text, ''))
      where fp_id = (select min(fp_id) from farmakologiportalen.analyse);
      update farmakologiportalen.entiteter set parserversjon = 0 where navn = 'analyse';
      truncate datakilder.endringer`)
    await synk()
    const logg = await endringer()
    expect(logg).toHaveLength(1)
    expect(logg[0]).toMatchObject({ type: 'analyse', art: 'endret', niva: 'metadata', felt: ['metode'], spor: { parserversjon: { foer: 0, etter: 1 } } })
  })

  it('merker det som er borte som utgått, uten å slette det, og logger det', async () => {
    await synk()
    const borte = LISTER['/analyses']![0]!.id
    const resultat = await synk(falskApi((sti, rader) => (sti === '/analyses' ? rader.filter((r) => r.id !== borte) : rader)))
    expect(resultat.status).toBe('fullfort')
    const { rows } = await db.query<{ utgatt_kl: string | null }>(`select utgatt_kl from farmakologiportalen.analyse where fp_id = $1`, [borte])
    expect(rows[0]!.utgatt_kl).not.toBeNull()
    expect((await endringer()).filter((e) => e.art === 'fjernet').map((e) => e.objekt_id)).toEqual([borte])
  })

  it('avviser et uttrekk der mye er borte, og beholder dataene fra før', async () => {
    await synk()
    const resultat = await synk(falskApi((sti, rader) => (sti === '/analyses' ? rader.slice(0, Math.floor(rader.length / 2)) : rader)))
    expect(resultat).toMatchObject({ status: 'feilet' })
    expect('feil' in resultat && resultat.feil).toContain('ser ufullstendig ut')
    expect(await antallAktive('analyse')).toBe(LISTER['/analyses']!.length)
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from farmakologiportalen.innlasting')
    expect(rows[0]!.n).toBe(0)
  })

  it('avbryter før noe lastes inn når formatet er endret eller portalen ikke svarer', async () => {
    await synk()
    const endret = await synk(
      falskApi((sti, rader) => (sti === '/analyses' ? rader.map(({ meassurearea_lower: _, ...r }) => r) : rader)),
    )
    expect(endret).toMatchObject({ status: 'feilet' })
    expect('feil' in endret && endret.feil).toContain('/analyses: meassurearea_lower')

    const nede = await synk({
      kall: [],
      liste: async (sti) => {
        if (sti === '/analyses') throw new Error('Farmakologiportalen svarte 503 for /analyses')
        return structuredClone(LISTER[sti]!)
      },
    } as FpApi & { kall: string[] })
    expect(nede).toMatchObject({ status: 'feilet', feil: 'Farmakologiportalen svarte 503 for /analyses' })
    expect(await antallAktive('analyse')).toBe(LISTER['/analyses']!.length)
  })

  it('teller henvisninger som ikke treffer, uten å avvise uttrekket', async () => {
    const resultat = await synk(
      falskApi((sti, rader) => (sti === '/analyses' ? [...rader, { ...rader[0]!, id: 'x1', analysis_archetype_id: '424242' }] : rader)),
    )
    expect(resultat.status).toBe('fullfort')
    // Portalen har selv et laboratorium med en institusjon den ikke har.
    expect('antall' in resultat && resultat.antall.brudd).toEqual([
      { fra: 'analyse', til: 'komponent', antall: 1, eksempler: ['x1'] },
      { fra: 'laboratorium', til: 'institusjon', antall: 1, eksempler: ['9887'] },
    ])
  })

  it('kjører bare én synkronisering om gangen', async () => {
    const forste = await lager().start('cron')
    await expect(lager().start('cron')).rejects.toThrow('pågår allerede')
    await lager().avbryt(forste, 'test')
  })

  it('lar bare serveren skrive', async () => {
    await expect(kallSom(db, 'authenticated')('fp_start_synk', { utlost_av: 'cron' })).rejects.toThrow()
    await expect(kallSom(db, 'anon')('les_laboratorieanalyser', { komponenter: ['536'] })).rejects.toThrow()
  })

  it('vises i «Datakilder» med siste kjøring og det som bør vurderes', async () => {
    await synk()
    const admin = await opprettBruker(db, { brukernavn: `admin${Date.now()}`, fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    const kall = faginnholdskall(db, admin)
    const status = lesDatakildestatus((await kall.klientFor(admin).rpc('datakilder_status', {})).data)
    const fp = vurderKilder(status).find((v) => v.kilde === 'farmakologiportalen')!
    expect(fp.tilstand).toBe('ok')
    expect(fp.sisteVellykkede?.merknader).toEqual(expect.arrayContaining([expect.stringContaining('99999')]))
    expect(fp.intervall).toBe(1)
  })
})

/* --- Rapporten ------------------------------------------------------------ */

describe('rapporten til «Datakilder»', () => {
  const komponenter = new Map(LISTER['/components']!.map((r) => [String(r.id), les<Komponentdata>('komponent', r)!]))
  const analyser = LISTER['/analyses']!.map((r) => les<Analysedata>('analyse', r)!)

  it('melder ulik molekylvekt i portalen og PubChem, og bruker PubChems', () => {
    const register = byggForbindelsesregister([FORBINDELSER.finn('bupropion')!])
    const rapport = lagRapport(komponenter, analyser, register, new Map([[444, 250.1]]))
    expect(rapport.merknader).toContain('Molekylvekten for «Bupropion» er 239,74 g/mol i portalen og 250,1 g/mol i PubChem. Omregningen bruker PubChems.')
    expect(lagRapport(komponenter, analyser, register, new Map([[444, 239.74]])).merknader.some((m) => m.startsWith('Molekylvekten'))).toBe(false)
  })

  it('melder et nytt navn på en koblet komponent', () => {
    const register = byggForbindelsesregister([FORBINDELSER.finn('citalopram')!])
    const omdopt = new Map(komponenter).set('536', { ...komponenter.get('536')!, navn: 'Citalopram (racemisk)' })
    expect(lagRapport(omdopt, analyser, register, new Map()).merknader[0]).toContain('heter nå «Citalopram (racemisk)»')
  })
})

/* --- Endepunktet ---------------------------------------------------------- */

describe('endepunktet', () => {
  const miljo = { CRON_SECRET: 'hemmelig' }
  const ok = async () => ({ status: 'uendret' as const, synk: 1, antall: {} })
  const github: Githubsjekk = async (token, arbeidsflyt) =>
    arbeidsflyt === FP_ARBEIDSFLYT && token === 'github-planlagt' ? 'cron' : token === 'github-hand' ? 'manuell' : null
  const kall = (metode: string, token?: string) =>
    new Request('https://ousfar.vercel.app/api/farmakologiportalen-synk', {
      method: metode,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  const behandle = (req: Request, adminsjekk = async () => false) =>
    behandleFpSynk(req, miljo, { synkroniser: ok, adminsjekk, githubsjekk: github })

  it('avviser kall uten gyldig token', async () => {
    expect((await behandle(kall('POST'))).status).toBe(401)
    expect((await behandle(kall('POST', 'noe annet'))).status).toBe(401)
    expect((await behandle(kall('GET', 'feil'))).status).toBe(401)
    expect((await behandle(kall('PUT', 'hemmelig'))).status).toBe(405)
  })

  it('tar imot jobben i GitHub Actions og administratorer, og sier hvem som utløste kjøringen', async () => {
    const utlost: string[] = []
    const synkroniser = async ({ utlostAv }: { utlostAv?: string }) => {
      utlost.push(utlostAv!)
      return ok()
    }
    const med = (req: Request, adminsjekk = async () => false) =>
      behandleFpSynk(req, { ...miljo, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'k' }, { synkroniser, adminsjekk, githubsjekk: github })
    expect((await med(kall('POST', 'github-planlagt'))).status).toBe(200)
    expect((await med(kall('POST', 'github-hand'))).status).toBe(200)
    expect((await med(kall('POST', 'admin'), async () => true)).status).toBe(200)
    expect((await med(kall('GET', 'hemmelig'))).status).toBe(200)
    expect(utlost).toEqual(['cron', 'manuell', 'manuell', 'cron'])
  })

  it('godtar bare GitHubs token for arbeidsflyten på main i repoet', async () => {
    const ventet = `peohol/far/${FP_ARBEIDSFLYT}@refs/heads/main`
    // Slik GitHub fyller kravene for en vanlig arbeidsflyt: `job_workflow_ref` er der bare for en gjenbrukt.
    const krav = { repository: 'peohol/far', ref: 'refs/heads/main', workflow_ref: ventet, event_name: 'schedule' }
    expect(githubkrav(krav, FP_ARBEIDSFLYT)).toBe('cron')
    expect(githubkrav({ ...krav, event_name: 'workflow_dispatch' }, FP_ARBEIDSFLYT)).toBe('manuell')
    expect(githubkrav({ ...krav, job_workflow_ref: ventet }, FP_ARBEIDSFLYT)).toBe('cron')
    expect(githubkrav({ ...krav, job_workflow_ref: 'annen/repo/.github/workflows/x.yml@refs/heads/main' }, FP_ARBEIDSFLYT)).toBeNull()
    expect(githubkrav({ ...krav, workflow_ref: undefined }, FP_ARBEIDSFLYT)).toBeNull()
    expect(githubkrav({ ...krav, workflow_ref: 'peohol/far/.github/workflows/ci.yml@refs/heads/main' }, FP_ARBEIDSFLYT)).toBeNull()
    expect(githubkrav({ ...krav, ref: 'refs/heads/claude/noe' }, FP_ARBEIDSFLYT)).toBeNull()
    expect(githubkrav({ ...krav, repository: 'noen/far' }, FP_ARBEIDSFLYT)).toBeNull()
    // Et token fra noen annen utsteder, eller ikke et token i det hele tatt, avvises uten nettverkskall.
    const annen = `${btoa('{"alg":"none"}')}.${btoa('{"iss":"https://annen.example"}')}.x`
    expect(await githubkjoring(annen, FP_ARBEIDSFLYT)).toBeNull()
    expect(await githubkjoring('ikke-et-token', FP_ARBEIDSFLYT)).toBeNull()
  })
})

/* --- Visningen på fagsidene ----------------------------------------------- */

/** Molekylvektene PubChem oppgir for testparene (g/mol). */
const MOLVEKTER: Record<number, string> = {
  2771: '324.4',
  162180: '310.4',
  444: '239.74',
  446: '255.74',
  16078: '314.5',
  644022: '330.5',
  108207: '344.4',
}

/** Det seksjonen «Kjemiske grunndata» har hentet fra PubChem for stoffet. */
function kjemiFor(stoff: string) {
  return byggKjemivisning(stoff, {
    kilde: 'PubChem',
    forbindelser: FORBINDELSER.forStoff(stoff).flatMap((f) =>
      f.pubchem && MOLVEKTER[f.pubchem.cid]
        ? [
            {
              cid: f.pubchem.cid,
              data: {
                cid: f.pubchem.cid,
                tittel: f.navn,
                formel: f.pubchem.formel,
                molvekt: MOLVEKTER[f.pubchem.cid]!,
                monoisotopisk_masse: null,
                inchikey: f.pubchem.inchikey,
                iupac: null,
                ladning: 0,
                enheter: 1,
                stereo: { definerte: 0, udefinerte: 0, definerte_bindinger: 0, udefinerte_bindinger: 0 },
              },
              sist_hentet_kl: '2026-10-08T03:15:00Z',
              sist_endret_kl: null,
            },
          ]
        : [],
    ),
  })
}

describe('visningen på fagsidene', () => {
  let db: PGlite
  let leser: Lableser
  const visninger = new Map<string, Labvisning>()
  const utvalg = new Map<string, Labutvalg>()

  beforeAll(async () => {
    db = await nyDatabase()
    const admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lea', etternavn: 'Leser', rolle: 'user' })
    leser = lagLableser(faginnholdskall(db, admin).klientFor(bruker))
    await synkroniserFarmakologiportalen({ lager: lagFplager(kallSom(db, 'service_role')), api: falskApi() })
    for (const stoff of ['citalopram', 'bupropion', 'thc']) {
      const u = await leser.les(labkomponenter(stoff))
      utvalg.set(stoff, u)
      visninger.set(stoff, byggLabvisning(stoff, u, kjemiFor(stoff)))
    }
  }, 60_000)

  /** Radene i tabellen for matrisen: analytt, laboratorium og måleområdet i enheten. */
  const tabell = (stoff: string, tittel: string, enhet: 'µg/L' | 'nmol/L' | 'µmol/L' = 'µg/L') => {
    const t = visninger.get(stoff)!.tabeller.find((x) => x.tittel === tittel)
    if (!t) throw new Error(`Ingen tabell ${tittel} for ${stoff}`)
    return t.rader.map((r) => {
      const m = maleomrade(r, enhet)
      return [r.analytt, r.laboratorium, m.enhet ? `${m.tekst} ${m.enhet}` : m.tekst]
    })
  }

  it('leser komponentene, gruppene som dekker dem og analysene, uten rådata', () => {
    expect(labkomponenter('bupropion')).toEqual(['529', '794'])
    const u = utvalg.get('bupropion')!
    expect(u.komponenter.map((k) => k.id)).toEqual(['529', '794', '8248'])
    expect(u.kilde.kontrollert_kl).not.toBeNull()
    expect(JSON.stringify(u)).not.toContain('modified_date')
  })

  it('citalopram: én tabell per matrise, serum med begge analyttene, omregnet med PubChems molekylvekt', () => {
    const v = visninger.get('citalopram')!
    expect(v.tabeller.map((t) => [t.tittel, t.visAnalytt])).toEqual([
      ['Serum', true],
      ['Fullblod', false],
    ])
    expect(v.usikre).toEqual([])
    const serum = tabell('citalopram', 'Serum')
    expect(serum).toContainEqual(['Citalopram', 'Klinisk farmakologi Drammen', '3,2—510'])
    expect(serum).toContainEqual(['Citalopram', 'Klinisk farmakologi Haukeland', '8,4—270'])
    // Desmetylcitalopram (310,4 g/mol): 8—800 nmol/L.
    expect(serum).toContainEqual(['Desmetylcitalopram', 'Klinisk farmakologi, Laboratoriemedisin, Tromsø', '2,5—250'])
    expect(serum).toContainEqual(['Citalopram', 'Klinisk farmakologi Diakonhjemmet, Senter for psykofarmakologi (SFP)', 'Ikke oppgitt'])
    // Selve stoffet før metabolitten.
    const analytter = serum.map((r) => r[0])
    expect(analytter.indexOf('Desmetylcitalopram')).toBeGreaterThan(analytter.lastIndexOf('Citalopram'))
    expect(tabell('citalopram', 'Serum', 'nmol/L')).toContainEqual(['Citalopram', 'Klinisk farmakologi Drammen', '10—1600'])
    expect(tabell('citalopram', 'Serum', 'µmol/L')).toContainEqual(['Citalopram', 'Klinisk farmakologi Haukeland', '0,026—0,82'])
    expect(tabell('citalopram', 'Fullblod')).toEqual([
      ['Citalopram', 'Klinisk farmakologi St Olav', '1,6—160'],
      ['Citalopram', 'Rettstoksikologi OUS', 'fra 32'],
    ])
  })

  it('bupropion og hydroksybupropion: begge i serum og fullblod', () => {
    expect(tabell('bupropion', 'Serum')).toContainEqual(['Hydroksybupropion', 'Klinisk farmakologi Haukeland', '73—2000'])
    expect(tabell('bupropion', 'Fullblod')).toContainEqual(['Bupropion', 'Rettstoksikologi OUS', 'fra 24'])
    expect(tabell('bupropion', 'Fullblod', 'µmol/L')).toContainEqual(['Hydroksybupropion', 'Klinisk farmakologi St Olav', '0,1—10'])
  })

  it('regner aldri en sumanalyse om mellom masse og stoffmengde, men innenfor samme slag', () => {
    const u = utvalg.get('bupropion')!
    const sum = { ...u.analyser.find((a) => a.data.komponent_id === '794')!, id: 'sum1' }
    sum.data = { ...sum.data, komponent_id: '8248', maleomrade: { ...sum.data.maleomrade } }
    const v = byggLabvisning('bupropion', { ...u, analyser: [...u.analyser, sum] }, kjemiFor('bupropion'))
    const rad = v.tabeller.flatMap((t) => t.rader).find((r) => r.id === 'sum1')!
    expect(rad.analytt).toBe('Sum: Bupropion + hydroksybupropion')
    expect(rad.forbindelse).toBeNull()
    expect(rad.molvekt).toBeNull()
    expect(maleomrade(rad, 'µg/L')).toMatchObject({ omregnet: false, enhet: 'nmol/L' })
    expect(maleomrade(rad, 'µmol/L')).toMatchObject({ omregnet: true, enhet: null })
  })

  it('THC: metabolittene og gruppeanalysene i urin, enhetene per kreatinin uten omregning, og uten portalens testlaboratorium', () => {
    const v = visninger.get('thc')!
    expect(v.tabeller.map((t) => t.tittel)).toEqual(['Serum', 'Fullblod', 'Urin', 'Spytt', 'Hår'])
    const alle = v.tabeller.flatMap((t) => t.rader)
    expect(alle.some((r) => r.laboratorium.includes('Internt testsystem'))).toBe(false)
    const urin = tabell('thc', 'Urin', 'nmol/L')
    expect(urin).toContainEqual(['THC-syre (THC-COOH)', 'Klinisk farmakologi OUS Ullevål', '29—12000'])
    expect(urin).toContainEqual(['11-hydroksy-THC', 'Klinisk farmakologi, Laboratoriemedisin, Tromsø', '20—640 µmol/mol kreatinin'])
    expect(urin).toContainEqual(['Cannabis (uspesifikk)', 'Rusmiddellaboratorium Sanderud', '25—100 µg/L'])
    expect(tabell('thc', 'Serum')).toContainEqual(['THC (delta-9-tetrahydrokannabinol)', 'Klinisk farmakologi OUS Ullevål', '3,1—130'])
    // Svarer laboratoriet ut i en annen benevning enn den valgte, sier kolonnen det.
    const kvalitativ = alle.find((r) => r.benevning?.startsWith('Kvalitativ'))!
    expect(harEgenBenevning(kvalitativ, 'µg/L')).toBe(true)
    expect(harEgenBenevning({ benevning: 'µg/L' }, 'µg/L')).toBe(false)
  })

  it('oppsummerer seksjonen, finnes i søket og har Farmakologiportalen som kilde', () => {
    const v = visninger.get('citalopram')!
    expect(laboppsummering(v)).toBe('Serum 9 · Fullblod 2')
    const tekster = labsoketekster(v)
    expect(tekster.every((t) => t.panel === LABPANEL)).toBe(true)
    expect(tekster.map((t) => t.tekst)).toEqual(expect.arrayContaining(['Klinisk farmakologi Drammen', 'LC-MS/MS', 'Desmetylcitalopram']))
    const ref = fpreferanser(v)
    expect(ref.referanser.map((r) => r.id)).toEqual([FP_KILDE])
    expect(ref.referanser[0]!.automatisk?.opphav).toMatch(/^Laboratorieanalyser fra Farmakologiportalen, sist kontrollert \d{1,2}\. \p{L}+ \d{4}$/u)
    expect(ref.panelreferanser).toEqual({ [LABPANEL]: [FP_KILDE] })
    expect(fpreferanser(byggLabvisning('citalopram', null, null)).referanser).toEqual([])
  })

  it('viser ingenting for et stoff uten koblede forbindelser', () => {
    expect(labkomponenter('finnes-ikke')).toEqual([])
    expect(byggLabvisning('finnes-ikke', null, null).tabeller).toEqual([])
  })
})
