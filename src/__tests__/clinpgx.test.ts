/**
 * Farmakogenetikken fra ClinPGx: lesingen av svarene, kallene mot API-et,
 * synkroniseringen inn i en ekte database bygd av migrasjonene, lesingen
 * stoffsidene gjør, endepunktene og søket.
 *
 * Svarene i `data/clinpgx/` er ekte svar fra ClinPGx' API (sertralin og
 * aripiprazol), kortet ned. Tekstene på sidene er syntetiske.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { lagClinpgxApi, type ClinpgxApi } from '../clinpgx/api'
import { behandleClinpgxSok, behandleClinpgxSynk, slaOppKjemikalie } from '../clinpgx/endepunkt'
import { lagClinpgxlager } from '../clinpgx/lager'
import { lagFarmakogenetikkleser, lesFarmakogenetikkutvalg, type Farmakogenetikkleser } from '../clinpgx/lesing'
import {
  htmlTilTekst,
  kliniskadresse,
  lesKjemikaliesvar,
  lesKlinisk,
  lesKliniskSvar,
  lesPreparatomtalesvar,
  lesRetningslinje,
  lesRetningslinjesvar,
  sorterEtterEvidens,
  type KliniskAnnotasjon,
} from '../clinpgx/modell'
import { clinpgxForeldet, clinpgxreferanser, CLINPGX_KILDE, litteraturId } from '../clinpgx/referanser'
import {
  annotasjonskort,
  byggFarmakogenetikkvisning,
  farmakogenetikktekster,
  kjemikaliestatuser,
  kliniskkort,
  koblingsforslag,
  koblingsgrunnlag,
  LAVERE_EVIDENS_KORT,
  oppsummerFarmakogenetikk,
} from '../clinpgx/stoffside'
import { synkroniserClinpgx } from '../clinpgx/synk'
import { byggSidemodell } from '../faginnhold/analyttside'
import { indekserKunnskapsbase, lesKunnskapsbase, lesSokeindeks } from '../faginnhold/globaltSok'
import type { Analyttsidedata } from '../faginnhold/lesing'
import { ENKELTELEMENTER, ELEMENTTYPER, lesClinpgxkobling } from '../faginnhold/paneler'
import { sokeadresse, sokGlobalt } from '../faginnhold/sok'
import { TOMT_UTVALG } from '../legemiddeldata/lesing'
import { kallSom } from './hjelp/fest'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

function fil(navn: string): { status: string; data: unknown[] } {
  return JSON.parse(readFileSync(new URL(`./data/clinpgx/${navn}`, import.meta.url), 'utf8')) as { status: string; data: unknown[] }
}

const RETNINGSLINJER = fil('retningslinjer-sertralin.json').data
const KLINISKE = fil('kliniske-sertralin.json').data
const PREPARATOMTALER = fil('preparatomtaler-aripiprazol.json').data
const ARIPIPRAZOL = fil('kjemikalie-aripiprazol.json').data as unknown

const SERTRALIN = 'PA451333'
const SERTRALINSVAR = { objCls: 'Chemical', id: SERTRALIN, name: 'sertraline', types: ['Drug'], pediatric: true }

/* --- Lesingen av svarene -------------------------------------------------- */

describe('lesingen av svarene fra ClinPGx', () => {
  it('leser retningslinjene med organisasjonen, genene, sammendraget og publikasjonene', () => {
    const lest = RETNINGSLINJER.map(lesRetningslinjesvar)
    expect(lest.every(Boolean)).toBe(true)
    const cpic = lest.find((r) => r!.id === 'PA166127639')!
    expect(cpic.kilde).toBe('CPIC')
    expect(cpic.gener.map((g) => g.symbol)).toEqual(['CYP2B6', 'CYP2C19'])
    expect(cpic.legemidler.map((l) => l.id)).toContain(SERTRALIN)
    // Sammendraget er ren tekst, uten merkene fra HTML-en.
    expect(cpic.sammendrag).not.toMatch(/<[a-z]/i)
    expect(cpic.sammendrag.length).toBeGreaterThan(20)
    expect(cpic.litteratur.length).toBeGreaterThan(0)
    expect(cpic.litteratur.every((l) => l.lenke === null || l.lenke.startsWith('https://'))).toBe(true)
    expect(lest.filter((r) => r!.kilde === 'DPWG')).toHaveLength(2)
  })

  it('leser de kliniske annotasjonene med nivået, varianten og tall-ID-en ClinPGx bruker i adressen', () => {
    const lest = KLINISKE.map(lesKliniskSvar)
    const cyp = lest.find((a) => a!.id === 'PA166135169')!
    expect(cyp).toMatchObject({ niva: '1A', nummer: '1183619004', variant: 'CYP2C19*1, CYP2C19*2, CYP2C19*3, CYP2C19*17' })
    expect(cyp.gener.map((g) => g.symbol)).toEqual(['CYP2C19'])
    expect(cyp.fenotyper.length).toBeGreaterThan(0)
    expect(kliniskadresse(cyp)).toBe('https://www.clinpgx.org/clinicalAnnotation/1183619004')
    const rs = lest.find((a) => a!.id === 'PA166135028')!
    expect(rs).toMatchObject({ niva: '3', rsid: 'rs495794' })
  })

  it('leser preparatomtalene med vurderingen av testing, og ATC-kodene til kjemikaliet', () => {
    const lest = PREPARATOMTALER.map(lesPreparatomtalesvar)
    expect(lest.map((p) => [p!.kilde, p!.testing])).toEqual(
      expect.arrayContaining([
        ['FDA', 'Actionable PGx'],
        ['EMA', 'Actionable PGx'],
      ]),
    )
    expect(lest.every((p) => p!.gener.some((g) => g.symbol === 'CYP2D6'))).toBe(true)
    expect(lesKjemikaliesvar(ARIPIPRAZOL)).toMatchObject({ id: 'PA10026', navn: 'aripiprazole', atc: ['N05AX12'] })
  })

  it('tåler felt som mangler, har feil form eller er ukjente, og forkaster bare et objekt uten ID', () => {
    expect(lesRetningslinjesvar({ name: 'Uten ID' })).toBeNull()
    expect(lesRetningslinjesvar('tull')).toBeNull()
    expect(lesKliniskSvar({ levelOfEvidence: { term: '1A' } })).toBeNull()
    expect(
      lesRetningslinjesvar({
        id: 'PA1',
        source: 'cpic',
        relatedGenes: 'ikke en liste',
        summaryMarkdown: { html: 42 },
        literature: [{ crossReferences: 'feil' }, null],
        nyttFelt: { noe: true },
      }),
    ).toEqual({
      id: 'PA1',
      navn: '',
      kilde: 'CPIC',
      gener: [],
      legemidler: [],
      sammendrag: '',
      dosering: false,
      alternativ: false,
      annen_veiledning: false,
      barn: false,
      litteratur: [],
    })
    // Det lagrede leses like defensivt.
    expect(lesRetningslinje({ id: 'PA1', gener: [{ symbol: 'CYP2D6' }, 'tull'], litteratur: [{ lenke: 'javascript:alert(1)', tittel: 'X' }] }))
      .toMatchObject({ gener: [{ id: '', symbol: 'CYP2D6' }], litteratur: [{ tittel: 'X', lenke: null }] })
    expect(lesKlinisk(null)).toBeNull()
  })

  it('gjør HTML om til ren tekst, med avsnitt og tegn', () => {
    expect(htmlTilTekst('<p>CYP2D6 &amp; <b>CYP2C19</b></p><p>Andre&nbsp;avsnitt<script>x()</script></p><ul><li>én</li></ul>')).toBe(
      'CYP2D6 & CYP2C19\nAndre avsnitt\n• én',
    )
    expect(htmlTilTekst(null)).toBe('')
  })

  it('leser svaret fra databasen, og hopper over en annotasjon som ikke kan leses', () => {
    const utvalg = lesFarmakogenetikkutvalg({
      kjemikalier: [{ id: 'PA1', navn: 'x', finnes: true }, { navn: 'uten id' }],
      retningslinjer: [{ id: 'PA2', kilde: 'CPIC', kjemikalier: ['PA1'] }, 'tull', { kilde: 'uten id' }],
      preparatomtaler: 'ikke en liste',
    })
    expect(utvalg.kjemikalier.map((k) => k.id)).toEqual(['PA1'])
    expect(utvalg.retningslinjer.map((r) => [r.id, r.kjemikalier])).toEqual([['PA2', ['PA1']]])
    expect(utvalg.preparatomtaler).toEqual([])
    expect(lesFarmakogenetikkutvalg(null).kjemikalier).toEqual([])
  })
})

/* --- Rekkefølgen og visningen -------------------------------------------- */

function klinisk(id: string, niva: string | null, poeng: number | null, gen = 'CYP2D6'): KliniskAnnotasjon & { kjemikalier: string[] } {
  return {
    id,
    nummer: null,
    navn: '',
    niva,
    gener: [{ id: `g-${gen}`, symbol: gen }],
    variant: `rs${id}`,
    rsid: null,
    typer: ['Efficacy'],
    sykdommer: [],
    fenotyper: [],
    legemidler: [],
    retningslinjer: [],
    preparatomtaler: [],
    poeng,
    kjemikalier: ['PA1'],
  }
}

describe('rekkefølgen i seksjonen', () => {
  it('sorterer de kliniske annotasjonene etter evidensnivå, så poengsum, med ukjente nivåer sist', () => {
    const sortert = sorterEtterEvidens([
      klinisk('1', '3', 50),
      klinisk('2', null, 99),
      klinisk('3', '1B', 1),
      klinisk('4', '1A', 2),
      klinisk('5', '1A', 10),
      klinisk('6', '2A', null),
    ])
    expect(sortert.map((a) => a.id)).toEqual(['5', '4', '3', '6', '1', '2'])
  })

  it('setter CPIC foran DPWG, skiller ut nivå 1A og 1B, og oppsummerer genene og organisasjonene', () => {
    const utvalg = lesFarmakogenetikkutvalg({
      kjemikalier: [{ id: SERTRALIN, navn: 'sertraline' }],
      retningslinjer: RETNINGSLINJER.map((r) => ({ ...lesRetningslinjesvar(r), kjemikalier: [SERTRALIN] })),
      kliniske: KLINISKE.map((a) => ({ ...lesKliniskSvar(a), kjemikalier: [SERTRALIN] })),
    })
    const visning = byggFarmakogenetikkvisning(utvalg)
    expect(visning.retningslinjer.map((r) => r.kilde)).toEqual(['CPIC', 'DPWG', 'DPWG'])
    expect(visning.hoye.map((a) => a.niva)).toEqual(['1A', '1A'])
    expect(visning.lavere.map((a) => a.niva)).toEqual(['3', '3', '4'])
    expect(visning.kilder).toEqual(['CPIC', 'DPWG'])
    expect(oppsummerFarmakogenetikk(visning)).toBe('CYP2B6 · CYP2C19 · CYP2D6 · CPIC + DPWG')
  })

  it('gir hvert kjemikalie en status, også det som ikke er hentet ennå', () => {
    const statuser = kjemikaliestatuser(
      { kjemikalier: [{ id: 'PA2', navn: null, finnes: false, sist_hentet_kl: '2026-09-01T00:00:00Z', feil: 'borte', feil_kl: null }] },
      { kjemikalier: [{ clinpgx_id: 'PA1', navn: 'a' }, { clinpgx_id: 'PA2', navn: 'b' }] },
    )
    expect(statuser).toEqual([
      { id: 'PA1', navn: 'a', finnes: true, sist_hentet_kl: null, feil: null, feil_kl: null },
      { id: 'PA2', navn: 'b', finnes: false, sist_hentet_kl: '2026-09-01T00:00:00Z', feil: 'borte', feil_kl: null },
    ])
  })
})

/* --- Koblingen ------------------------------------------------------------ */

describe('koblingen til ClinPGx', () => {
  it('lagres med ID-en, uten gjentakelser, og bare med gyldige ID-er', () => {
    expect(
      lesClinpgxkobling({
        kjemikalier: [
          { clinpgx_id: 'PA451333', navn: 'sertraline' },
          { clinpgx_id: 'PA451333', navn: 'dobbel' },
          { clinpgx_id: 'sertraline', navn: 'bare navnet' },
          { navn: 'uten ID' },
        ],
      }),
    ).toEqual({ kjemikalier: [{ clinpgx_id: 'PA451333', navn: 'sertraline' }] })
    expect(lesClinpgxkobling(null)).toEqual({ kjemikalier: [] })
    // Koblingen står én gang per side, som koblingen til FEST.
    expect(ENKELTELEMENTER).toContain(ELEMENTTYPER.clinpgxkobling)
  })

  it('foreslår på ATC-koden eller det engelske navnet, men kobler aldri av seg selv', () => {
    const utvalg = {
      ...TOMT_UTVALG,
      virkestoff: [{ id: 'V1', navn: 'Aripiprazol', navn_engelsk: 'Aripiprazole', salter: [], utgatt: false }],
    }
    const grunnlag = koblingsgrunnlag(utvalg, ['V1'])
    expect(grunnlag.navn).toEqual(['Aripiprazole'])
    const aripiprazol = lesKjemikaliesvar(ARIPIPRAZOL)!
    expect(koblingsforslag(aripiprazol, grunnlag)).toBe('samme navn som virkestoffet i FEST')
    expect(koblingsforslag(aripiprazol, { navn: [], atc: ['N05AX12'] })).toBe('samme ATC-kode som preparatene (N05AX12)')
    expect(koblingsforslag({ navn: 'haloperidol', atc: ['N05AD01'] }, grunnlag)).toBeNull()
    expect(koblingsgrunnlag(null, ['V1'])).toEqual({ navn: [], atc: [] })
  })
})

/* --- Kallene mot API-et --------------------------------------------------- */

function jsend(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
}

const INGEN_TREFF = { status: 'fail', data: { errors: [{ message: 'No results matching criteria.' }] } }

describe('kallene mot ClinPGx', () => {
  it('går ett om gangen med avstand mellom, og venter så lenge ClinPGx ber om ved 429', async () => {
    let klokke = 0
    const ventet: number[] = []
    const starter: number[] = []
    // Det første kallet får 429 første gang; det andre har ingen treff.
    const svar: Record<string, Response[]> = {
      '1': [jsend({}, 429, { 'retry-after': '3' }), jsend({ status: 'success', data: [1] })],
      '2': [jsend(INGEN_TREFF, 404)],
    }
    const api = lagClinpgxApi({
      avstand: 600,
      na: () => klokke,
      vent: async (ms) => {
        ventet.push(ms)
        klokke += ms
      },
      hent: (async (url: URL) => {
        starter.push(klokke)
        return svar[url.searchParams.get('a')!]!.shift()!
      }) as unknown as typeof fetch,
    })
    const [forste, andre] = await Promise.all([api.liste('/data/label', { a: '1' }), api.liste('/data/label', { a: '2' })])
    expect(forste).toEqual([1])
    // «Ingen treff» er en tom liste, ikke en feil.
    expect(andre).toEqual([])
    expect(ventet).toContain(3000)
    for (let i = 1; i < starter.length; i += 1) expect(starter[i]! - starter[i - 1]!).toBeGreaterThanOrEqual(600)
  })

  it('gir opp etter to nye forsøk, og sier hva ClinPGx svarte', async () => {
    const hent = vi.fn(async () => jsend({ status: 'error', message: 'Nede' }, 503))
    const api = lagClinpgxApi({ hent: hent as unknown as typeof fetch, avstand: 0, vent: async () => {} })
    await expect(api.liste('/data/label', {})).rejects.toThrow('ClinPGx svarte 503: Nede')
    expect(hent).toHaveBeenCalledTimes(3)
  })

  it('slår opp et kjemikalie på ID-en eller navnet, også med små bokstaver', async () => {
    const kall: string[] = []
    const api: ClinpgxApi = {
      ett: async (sti) => {
        kall.push(sti)
        return sti.endsWith('PA10026') ? ARIPIPRAZOL : null
      },
      liste: async (_sti, p) => {
        kall.push(`navn=${p.name}`)
        return p.name === 'aripiprazole' ? [ARIPIPRAZOL] : []
      },
    }
    expect((await slaOppKjemikalie(api, 'pa10026')).map((k) => k.id)).toEqual(['PA10026'])
    expect((await slaOppKjemikalie(api, 'Aripiprazole')).map((k) => k.navn)).toEqual(['aripiprazole'])
    expect(kall).toEqual(['/data/chemical/PA10026', 'navn=Aripiprazole', 'navn=aripiprazole'])
    expect(await slaOppKjemikalie(api, 'aripiprazol')).toEqual([])
  })
})

/* --- Synkroniseringen ----------------------------------------------------- */

/** Et API med svarene i `data/clinpgx/`: sertralin har retningslinjer og kliniske annotasjoner, aripiprazol preparatomtaler. */
function falskApi(endre: Partial<Record<string, unknown[] | Error>> = {}): ClinpgxApi & { kall: string[] } {
  const kall: string[] = []
  const lister: Record<string, unknown[]> = {
    [`/data/guidelineAnnotation ${SERTRALIN}`]: RETNINGSLINJER,
    [`/data/summaryAnnotation ${SERTRALIN}`]: KLINISKE,
    '/data/label PA10026': PREPARATOMTALER,
  }
  return {
    kall,
    ett: async (sti) => {
      kall.push(sti)
      const feil = endre[sti]
      if (feil instanceof Error) throw feil
      // En tom liste i stedet for kjemikaliet: ClinPGx svarer at det ikke finnes.
      // Ellers er første element svaret.
      if (feil) return feil[0] ?? null
      if (sti.endsWith(SERTRALIN)) return SERTRALINSVAR
      if (sti.endsWith('PA10026')) return ARIPIPRAZOL
      return null
    },
    liste: async (sti, p) => {
      const nokkel = `${sti} ${p['relatedChemicals.accessionId']}`
      kall.push(nokkel)
      const endret = endre[nokkel]
      if (endret instanceof Error) throw endret
      return endret ?? lister[nokkel] ?? []
    },
  }
}

describe('synkroniseringen', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let admin: string
  let bruker: string
  let side: string
  let leser: Farmakogenetikkleser
  const lager = () => lagClinpgxlager(kallSom(db, 'service_role'))

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lea', etternavn: 'Leser', rolle: 'user' })
    kall = faginnholdskall(db, admin)
    side = (await kall.opprett('infoside', { navn: 'Sertralin' })).id
    // Koblingen er bare lagret som utkast; synkroniseringen henter den likevel.
    await kall.opprett('innholdselement', {
      infoside: side,
      panel: 'farmakogenetikk',
      posisjon: 0,
      elementtype: 'clinpgxkobling',
      data: { kjemikalier: [{ clinpgx_id: SERTRALIN, navn: 'sertraline' }, { clinpgx_id: 'PA10026', navn: 'aripiprazole' }] },
    })
    leser = lagFarmakogenetikkleser(kall.klientFor(bruker))
  }, 60_000)

  beforeEach(async () => {
    await db.exec('truncate clinpgx.kjemikalie_annotasjoner, clinpgx.annotasjoner, clinpgx.kjemikalier, clinpgx.synkroniseringer cascade')
  })

  it('henter de koblede kjemikaliene og bytter inn alt for hvert, med rådataene ved siden av', async () => {
    const api = falskApi()
    const resultat = await synkroniserClinpgx({ lager: lager(), api })
    expect(resultat).toMatchObject({
      status: 'fullfort',
      kjemikalier: 2,
      hentet: 2,
      feilet: 0,
      annotasjoner: { retningslinje: 3, preparatomtale: 2, klinisk: 5 },
      forkastet: 0,
    })
    // Ett kjemikalie om gangen: kjemikaliet, så de tre listene.
    expect(api.kall.filter((k) => k.includes(SERTRALIN))).toHaveLength(4)
    const [rad] = (
      await db.query<{ raa: unknown }>(`select raa from clinpgx.annotasjoner where clinpgx_id = 'PA166127639'`)
    ).rows
    expect(rad!.raa).toMatchObject({ id: 'PA166127639', objCls: 'Guideline Annotation' })

    const utvalg = await leser.les([SERTRALIN])
    expect(utvalg.kjemikalier).toMatchObject([{ id: SERTRALIN, navn: 'sertraline', finnes: true, feil: null }])
    expect(utvalg.retningslinjer.map((r) => r.id).sort()).toEqual(['PA166104980', 'PA166127639', 'PA166182821'])
    expect(utvalg.retningslinjer.every((r) => r.kjemikalier.includes(SERTRALIN))).toBe(true)
    expect(utvalg.kliniske).toHaveLength(5)
    // Aripiprazols preparatomtaler hører ikke til sertralin.
    expect(utvalg.preparatomtaler).toEqual([])
    expect(utvalg.kontrollert_kl).not.toBeNull()
    // Rådataene går aldri til nettleseren.
    expect(JSON.stringify(utvalg)).not.toContain('objCls')
  })

  it('beholder det som var der når et kjemikalie feiler, og henter de andre som vanlig', async () => {
    await synkroniserClinpgx({ lager: lager(), api: falskApi() })
    const resultat = await synkroniserClinpgx({
      lager: lager(),
      api: falskApi({ [`/data/summaryAnnotation ${SERTRALIN}`]: new Error('ClinPGx svarte 500') }),
    })
    expect(resultat).toMatchObject({ status: 'delvis', hentet: 1, feilet: 1 })
    const utvalg = await leser.les([SERTRALIN])
    expect(utvalg.kliniske).toHaveLength(5)
    expect(utvalg.kjemikalier[0]).toMatchObject({ feil: 'ClinPGx svarte 500', finnes: true })
    expect(utvalg.kjemikalier[0]!.sist_hentet_kl).not.toBeNull()
    const logg = (await db.query<{ status: string; feil: string }>('select status, feil from clinpgx.synkroniseringer order by id')).rows
    expect(logg.map((l) => l.status)).toEqual(['fullfort', 'delvis'])
    expect(logg[1]!.feil).toContain(`${SERTRALIN}: ClinPGx svarte 500`)
  })

  it('avviser et svar med langt færre annotasjoner enn sist, og sier fra når kjemikaliet er borte fra ClinPGx', async () => {
    await synkroniserClinpgx({ lager: lager(), api: falskApi() })
    const resultat = await synkroniserClinpgx({
      lager: lager(),
      api: falskApi({ [`/data/summaryAnnotation ${SERTRALIN}`]: KLINISKE.slice(0, 1) }),
    })
    expect(resultat).toMatchObject({ status: 'delvis', feilet: 1 })
    expect((await leser.les([SERTRALIN])).kliniske).toHaveLength(5)

    await db.query(`update clinpgx.kjemikalier set sist_hentet_kl = now() - interval '1 day' where clinpgx_id = 'PA10026'`)
    const borte = await synkroniserClinpgx({ lager: lager(), api: falskApi({ '/data/chemical/PA10026': [] }), bare: ['PA10026'] })
    expect(borte).toMatchObject({ kjemikalier: 1, feilet: 1 })
    const [aripiprazol] = (await leser.les(['PA10026'])).kjemikalier
    expect(aripiprazol).toMatchObject({ finnes: false, feil: 'ClinPGx har ikke kjemikaliet PA10026.' })
    expect((await leser.les(['PA10026'])).preparatomtaler).toHaveLength(2)
  })

  it('bytter ikke inn et kjemikalie når et objekt i svaret ikke kan leses', async () => {
    await synkroniserClinpgx({ lager: lager(), api: falskApi() })
    const resultat = await synkroniserClinpgx({
      lager: lager(),
      api: falskApi({ [`/data/guidelineAnnotation ${SERTRALIN}`]: [...RETNINGSLINJER.slice(1), { name: 'Uten ID' }] }),
    })
    expect(resultat).toMatchObject({ status: 'delvis', hentet: 1, feilet: 1, forkastet: 1 })
    expect((resultat as { feil: string }).feil).toContain(`${SERTRALIN}: 1 objekt i svaret kunne ikke leses`)
    expect((await leser.les([SERTRALIN])).retningslinjer).toHaveLength(RETNINGSLINJER.length)
  })

  describe('endringsloggen', () => {
    type Rad = { art: string; niva: string; type: string; objekt_id: string; kontekst: string | null; felt: string[]; etikett: string; spor: Record<string, unknown>; synk_id: number | null }
    const endringer = async () =>
      (await db.query<Rad>(
        `select art, niva, type, objekt_id, kontekst, felt, etikett, spor, synk_id from datakilder.endringer
         where kilde = 'clinpgx' order by id`,
      )).rows
    const retningslinje = RETNINGSLINJER[0] as Record<string, unknown>
    const retningslinjeId = retningslinje.id as string
    // ClinPGx' egen historikk for annotasjonen, nyest sist.
    const HISTORIKK = [
      { id: 1, date: '2019-05-23T15:24:50.090-07:00', type: 'Update', description: 'Annotation current with November 2018 guideline' },
      { id: 2, date: '2026-09-20T00:00:00-07:00', type: 'Update', description: 'Updated recommendation' },
    ]
    const medRetningslinje = (endret: Record<string, unknown>) => ({
      [`/data/guidelineAnnotation ${SERTRALIN}`]: [{ ...retningslinje, ...endret }, ...RETNINGSLINJER.slice(1)],
    })

    beforeEach(async () => {
      await db.exec('truncate datakilder.endringer')
    })

    it('logger første henting som grunnlag, ikke hver annotasjon som ny, og ingenting når intet er endret', async () => {
      await synkroniserClinpgx({ lager: lager(), api: falskApi() })
      const forste = await endringer()
      expect(forste.map((e) => [e.art, e.objekt_id])).toEqual(
        expect.arrayContaining([['grunnlag', SERTRALIN], ['grunnlag', 'PA10026']]),
      )
      expect(forste.every((e) => e.art === 'grunnlag' && e.synk_id !== null)).toBe(true)
      await synkroniserClinpgx({ lager: lager(), api: falskApi() })
      expect(await endringer()).toHaveLength(forste.length)
    })

    it('skiller en endret retningslinje fra en endring bare i navn og litteratur', async () => {
      await synkroniserClinpgx({ lager: lager(), api: falskApi() })
      await db.exec('truncate datakilder.endringer')

      await synkroniserClinpgx({ lager: lager(), api: falskApi(medRetningslinje({ name: 'Nytt navn' })) })
      const navn = await endringer()
      expect(navn).toEqual([expect.objectContaining({ art: 'endret', niva: 'metadata', type: 'retningslinje', objekt_id: retningslinjeId, felt: ['navn'] })])

      const sammendrag = { ...(retningslinje.summaryMarkdown as object), html: '<p>Ny anbefaling.</p>' }
      await synkroniserClinpgx({
        lager: lager(),
        api: falskApi(medRetningslinje({ name: 'Nytt navn', summaryMarkdown: sammendrag, dosingInformation: true, history: HISTORIKK })),
      })
      const [, klinisk] = await endringer()
      // Rådataene er også endret (historikken), men de kliniske feltene avgjør.
      expect(klinisk).toMatchObject({ art: 'endret', niva: 'klinisk', felt: ['dosering', 'sammendrag'] })
      // ClinPGx' egen siste merknad om annotasjonen følger med, til sporing.
      expect(klinisk!.spor).toEqual({ kildenotat: { dato: '2026-09-20T00:00:00-07:00', type: 'Update', merknad: 'Updated recommendation' } })
    })

    it('logger en endring bare i rådataene som metadata', async () => {
      await synkroniserClinpgx({ lager: lager(), api: falskApi() })
      await db.exec('truncate datakilder.endringer')
      await synkroniserClinpgx({ lager: lager(), api: falskApi(medRetningslinje({ history: HISTORIKK })) })
      expect(await endringer()).toEqual([
        expect.objectContaining({ art: 'endret', niva: 'metadata', felt: ['raa.history'], spor: { kildenotat: expect.objectContaining({ merknad: 'Updated recommendation' }) } }),
      ])
    })

    it('logger et kjemikalie der bare rådataene er endret, som metadata', async () => {
      await synkroniserClinpgx({ lager: lager(), api: falskApi() })
      await db.exec('truncate datakilder.endringer')
      await synkroniserClinpgx({
        lager: lager(),
        api: falskApi({ [`/data/chemical/${SERTRALIN}`]: [{ ...(SERTRALINSVAR as object), feltOusfarIkkeLeser: 1 }] }),
      })
      expect(await endringer()).toEqual([
        expect.objectContaining({ art: 'endret', niva: 'metadata', type: 'kjemikalie', objekt_id: SERTRALIN, felt: ['raa.feltOusfarIkkeLeser'] }),
      ])
    })

    it('logger en retningslinje som forsvinner fra et kjemikalie, og en som kommer til, med kjemikaliet', async () => {
      await synkroniserClinpgx({ lager: lager(), api: falskApi() })
      await db.exec('truncate datakilder.endringer')
      await synkroniserClinpgx({ lager: lager(), api: falskApi({ [`/data/guidelineAnnotation ${SERTRALIN}`]: RETNINGSLINJER.slice(1) }) })
      await synkroniserClinpgx({ lager: lager(), api: falskApi() })
      expect((await endringer()).map((e) => [e.art, e.niva, e.type, e.objekt_id, e.kontekst])).toEqual([
        ['fjernet', 'klinisk', 'retningslinje', retningslinjeId, SERTRALIN],
        ['ny', 'klinisk', 'retningslinje', retningslinjeId, SERTRALIN],
      ])
      expect((await endringer())[0]!.etikett).toBe(retningslinje.name)
    })

    it('logger at et kjemikalie er borte fra ClinPGx som klinisk, og ingenting fra et avvist svar', async () => {
      await synkroniserClinpgx({ lager: lager(), api: falskApi() })
      await db.exec('truncate datakilder.endringer')
      await synkroniserClinpgx({ lager: lager(), api: falskApi({ [`/data/summaryAnnotation ${SERTRALIN}`]: KLINISKE.slice(0, 1) }) })
      expect(await endringer()).toEqual([])

      await synkroniserClinpgx({ lager: lager(), api: falskApi({ '/data/chemical/PA10026': [] }), bare: ['PA10026'] })
      expect(await endringer()).toEqual([
        expect.objectContaining({ art: 'endret', niva: 'klinisk', type: 'kjemikalie', objekt_id: 'PA10026', felt: ['finnes'] }),
      ])
    })
  })

  it('henter de som aldri er hentet først, og utsetter resten når tiden er knapp', async () => {
    let klokke = 0
    const resultat = await synkroniserClinpgx({
      lager: lager(),
      api: falskApi(),
      tidsbudsjett: 20_000,
      na: () => (klokke += 3_000),
    })
    expect(resultat).toMatchObject({ status: 'delvis', hentet: 1, utsatt: 1 })
    const koblede = await lager().koblede()
    // Det som ble utsatt, står først neste gang.
    expect(koblede[0]!.sist_hentet_kl).toBeNull()
  })

  it('kjører én synkronisering om gangen', async () => {
    const forste = await lager().start('cron')
    expect((await feilFra(() => lager().start('manuell')))?.message).toContain('pågår allerede')
    await lager().avbryt(forste, 'Stoppet i testen')
    expect(await lager().start('manuell')).toBeGreaterThan(forste)
  })

  it('lar bare serveren skrive, og bare innloggede lese', async () => {
    const innlogget = kallSom(db, 'authenticated')
    const anonym = kallSom(db, 'anon')
    expect((await feilFra(() => innlogget('clinpgx_start_synk', { utlost_av: 'cron' })))?.code).toBe('42501')
    expect((await feilFra(() => innlogget('clinpgx_koblede_kjemikalier', {})))?.code).toBe('42501')
    expect((await feilFra(() => anonym('les_farmakogenetikk', { kjemikalie_ider: [SERTRALIN] })))?.code).toBe('42501')
    expect(await innlogget('les_farmakogenetikk', { kjemikalie_ider: [SERTRALIN] })).toMatchObject({ kilde: 'ClinPGx' })
    const tabell = await feilFra(() =>
      db.transaction(async (tx) => {
        await tx.query(`select set_config('role', 'authenticated', true)`)
        await tx.query('select * from clinpgx.annotasjoner')
      }),
    )
    expect(tabell?.code).toBe('42501')
  })

  it('ser bort fra koblinger som er fjernet fra siden', async () => {
    const annen = (await kall.opprett('infoside', { navn: 'Fjernet kobling' })).id
    const element = await kall.opprett('innholdselement', {
      infoside: annen,
      panel: 'farmakogenetikk',
      posisjon: 0,
      elementtype: 'clinpgxkobling',
      data: { kjemikalier: [{ clinpgx_id: 'PA999', navn: 'borte' }] },
    })
    expect((await lager().koblede()).map((k) => k.id)).toContain('PA999')
    await kall.lagre(element.id, element.revisjon!, {
      infoside: annen,
      panel: 'fjernet',
      posisjon: 0,
      elementtype: 'clinpgxkobling',
      data: { kjemikalier: [{ clinpgx_id: 'PA999', navn: 'borte' }] },
    })
    expect((await lager().koblede()).map((k) => k.id)).not.toContain('PA999')
  })

  it('lar bare én kobling stå i panelet på en side', async () => {
    const feil = await feilFra(() =>
      kall.opprett('innholdselement', {
        infoside: side,
        panel: 'farmakogenetikk',
        posisjon: 1,
        elementtype: 'clinpgxkobling',
        data: { kjemikalier: [] },
      }),
    )
    expect(feil?.code).toBe('23505')
  })
})

/* --- Endepunktene --------------------------------------------------------- */

describe('endepunktene', () => {
  const MILJO = { CRON_SECRET: 'hemmelig', SUPABASE_URL: 'https://db.example', SUPABASE_SECRET_KEY: 'sb_secret_x' }
  const ferdig = { status: 'fullfort' as const, synk: 1, kjemikalier: 0, hentet: 0, feilet: 0, utsatt: 0, annotasjoner: {}, forkastet: 0 }

  function foresporsel(metode: string, token?: string, body?: unknown, sti = '/api/clinpgx-synk') {
    return new Request(`https://ousfar.example${sti}`, {
      method: metode,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  }

  it('synkroniserer alt for Vercels ukentlige kall, og bare det en administrator ber om', async () => {
    const synkroniser = vi.fn(async (_valg: object) => ferdig)
    const adminsjekk = vi.fn(async (token: string) => token === 'admin-token')
    const valg = { synkroniser, adminsjekk, api: falskApi() }

    expect((await behandleClinpgxSynk(foresporsel('GET', 'hemmelig'), MILJO, valg)).status).toBe(200)
    expect(synkroniser).toHaveBeenLastCalledWith(expect.objectContaining({ utlostAv: 'cron' }))
    expect(synkroniser.mock.lastCall![0]).not.toHaveProperty('bare')

    expect((await behandleClinpgxSynk(foresporsel('POST', 'admin-token', { kjemikalier: [SERTRALIN] }), MILJO, valg)).status).toBe(200)
    expect(synkroniser).toHaveBeenLastCalledWith(expect.objectContaining({ utlostAv: 'manuell', bare: [SERTRALIN] }))
  })

  it('avviser kall uten tilgang, med feil innhold og uten oppkoblingen mot databasen', async () => {
    const synkroniser = vi.fn(async () => ferdig)
    const valg = { synkroniser, adminsjekk: async (t: string) => t === 'admin-token', api: falskApi() }
    expect((await behandleClinpgxSynk(foresporsel('GET'), MILJO, valg)).status).toBe(401)
    expect((await behandleClinpgxSynk(foresporsel('GET', 'feil'), MILJO, valg)).status).toBe(401)
    // Cron-hemmeligheten gjelder bare for GET, og en administrators token bare for POST.
    expect((await behandleClinpgxSynk(foresporsel('POST', 'hemmelig'), MILJO, valg)).status).toBe(401)
    expect((await behandleClinpgxSynk(foresporsel('GET', 'admin-token'), MILJO, valg)).status).toBe(401)
    expect((await behandleClinpgxSynk(foresporsel('POST', 'admin-token', { kjemikalier: ['sertraline'] }), MILJO, valg)).status).toBe(400)
    expect((await behandleClinpgxSynk(foresporsel('DELETE', 'admin-token'), MILJO, valg)).status).toBe(405)
    expect((await behandleClinpgxSynk(foresporsel('GET', 'hemmelig'), { CRON_SECRET: 'hemmelig' }, valg)).status).toBe(500)
    expect(synkroniser).not.toHaveBeenCalled()

    const feilet = vi.fn(async () => ({ status: 'feilet' as const, synk: 2, feil: 'nede' }))
    expect((await behandleClinpgxSynk(foresporsel('GET', 'hemmelig'), MILJO, { ...valg, synkroniser: feilet })).status).toBe(502)
  })

  it('lar bare administratorer slå opp i ClinPGx', async () => {
    const valg = { adminsjekk: async (t: string) => t === 'admin-token', api: falskApi() }
    const sok = (token: string | undefined, q: string) =>
      behandleClinpgxSok(foresporsel('GET', token, undefined, `/api/clinpgx-sok?q=${encodeURIComponent(q)}`), MILJO, valg)
    expect((await sok(undefined, 'PA10026')).status).toBe(401)
    expect((await sok('bruker', 'PA10026')).status).toBe(401)
    expect((await sok('admin-token', 'x')).status).toBe(400)
    const svar = await sok('admin-token', 'PA10026')
    expect(svar.status).toBe(200)
    expect(await svar.json()).toEqual({ treff: [{ id: 'PA10026', navn: 'aripiprazole', atc: ['N05AX12'], typer: ['Drug'] }] })
  })
})

/* --- Referansene og søket ------------------------------------------------- */

function utgave<T>(id: string, innhold: T) {
  return { id, revisjon: 1, publisert_revisjon: 1, innhold, endret_av_fornavn: '', endret_av_etternavn: '', endret_kl: '' }
}

/** En side koblet til sertralin i ClinPGx, med et redaksjonelt kort i «Farmakogenetikk». */
function sertralinside(): Analyttsidedata {
  return {
    analytt: utgave('analytt-SERT', { kode: 'SERT', hovedside: 'side-sert', komponenter: ['side-sert'] }),
    infoside: utgave('side-sert', { navn: 'Sertralin' }),
    elementer: [
      utgave('pgx', {
        infoside: 'side-sert',
        panel: 'farmakogenetikk',
        posisjon: 0,
        elementtype: 'clinpgxkobling',
        data: { kjemikalier: [{ clinpgx_id: SERTRALIN, navn: 'sertraline' }] },
      }),
      utgave('cyp', {
        infoside: 'side-sert',
        panel: 'farmakogenetikk',
        posisjon: 0,
        elementtype: 'kinetikkort',
        data: {
          tittel: 'CYP-enzymer',
          dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Syntetisk redaksjonell tekst.' }] }] },
        },
      }),
    ],
    komponenter: [],
    referanser: [],
    regelsett: null,
    thcregelsett: null,
    scenarioregelsett: null,
  }
}

const SERTRALINUTVALG = lesFarmakogenetikkutvalg({
  kilde: 'ClinPGx',
  kjemikalier: [{ id: SERTRALIN, navn: 'sertraline', finnes: true, sist_hentet_kl: '2026-09-21T02:30:00Z' }],
  retningslinjer: RETNINGSLINJER.map((r) => ({ ...lesRetningslinjesvar(r), kjemikalier: [SERTRALIN] })),
  kliniske: KLINISKE.map((a) => ({ ...lesKliniskSvar(a), kjemikalier: [SERTRALIN] })),
})

describe('referansene fra ClinPGx', () => {
  it('oppgir ClinPGx med lisensen, lenke til den og bruksvilkårene i seksjonen, og publikasjonene i kortet til hver retningslinje', () => {
    const visning = byggFarmakogenetikkvisning(SERTRALINUTVALG)
    const kilder = clinpgxreferanser(SERTRALINUTVALG, visning)
    const clinpgx = kilder.referanser.find((r) => r.id === CLINPGX_KILDE)!
    expect(clinpgx.automatisk).toEqual({
      kilde: 'ClinPGx',
      opphav: 'Utdrag av farmakogenetiske data fra ClinPGx, omformet av OUSFAR, lisens CC BY-SA 4.0, sist hentet 21. september 2026',
      lenker: [
        { tekst: 'Lisens: CC BY-SA 4.0', lenke: 'https://creativecommons.org/licenses/by-sa/4.0/' },
        { tekst: 'Bruksvilkår hos ClinPGx', lenke: 'https://www.clinpgx.org/page/dataUsagePolicy' },
      ],
    })
    expect(kilder.panelreferanser).toEqual({ farmakogenetikk: [CLINPGX_KILDE] })
    const cpic = visning.retningslinjer.find((r) => r.kilde === 'CPIC')!
    expect(kilder.elementer).toContainEqual({
      panel: 'farmakogenetikk',
      id: annotasjonskort(cpic.id),
      referanser: [...new Set(cpic.litteratur.map(litteraturId))],
    })
    // Alle er automatiske, og ingen kan redigeres som OUSFARs egne.
    expect(kilder.referanser.every((r) => r.automatisk?.kilde === 'ClinPGx')).toBe(true)
    expect(clinpgxreferanser(null, null)).toEqual({ referanser: [] })
  })

  it('sier fra når dataene ikke er hentet på over ti døgn', () => {
    expect(clinpgxForeldet(SERTRALINUTVALG, new Date('2026-09-30T00:00:00Z'))).toBeNull()
    expect(clinpgxForeldet(SERTRALINUTVALG, new Date('2026-10-02T12:00:00Z'))).toMatch(/^Dataene fra ClinPGx ble sist hentet 21\. september 2026\./)
  })
})

describe('søket', () => {
  it('peker på detaljkortet for hver retningslinje, de sterkeste annotasjonene og de svakere samlet', () => {
    const tekster = farmakogenetikktekster(byggFarmakogenetikkvisning(SERTRALINUTVALG))
    const kort = new Set(tekster.map((t) => t.detaljkort))
    expect(kort).toEqual(
      new Set([
        annotasjonskort('PA166127639'),
        annotasjonskort('PA166182821'),
        annotasjonskort('PA166104980'),
        kliniskkort('PA166135169'),
        kliniskkort('PA166289101'),
        LAVERE_EVIDENS_KORT,
      ]),
    )
    expect(tekster.every((t) => t.panel === 'farmakogenetikk' && t.element.id === t.detaljkort)).toBe(true)
    expect(tekster.find((t) => t.detaljkort === annotasjonskort('PA166127639') && t.felt === 'overskrift')!.tekst).toBe(
      'CPIC · CYP2B6, CYP2C19',
    )
  })

  it('finner gener og organisasjoner i hele kunnskapsbasen, og peker på seksjonen og kortet', async () => {
    const les = vi.fn(async () => SERTRALINUTVALG)
    const farmakogenetikk: Farmakogenetikkleser = { les, sok: async () => [], hent: async () => ({ status: 'fullfort' }) }
    const sideleser = { lesAnalyttsider: async () => [sertralinside()], lesStoffsider: async () => [] }
    const indeks = await lesSokeindeks(sideleser, null, { farmakogenetikk })
    expect(les).toHaveBeenCalledWith([SERTRALIN])

    const [treff] = sokGlobalt(indeks, 'CPIC CYP2B6')
    expect(sokeadresse(treff!.dokument.sted)).toBe(`#/analytt/SERT/farmakogenetikk/${annotasjonskort('PA166127639')}`)
    const [dpwg] = sokGlobalt(indeks, 'DPWG CYP2D6')
    expect(sokeadresse(dpwg!.dokument.sted)).toBe(`#/analytt/SERT/farmakogenetikk/${annotasjonskort('PA166182821')}`)
    // Det redaksjonelle står i den samme seksjonen, og finnes som før.
    expect(sokGlobalt(indeks, 'redaksjonell')).toHaveLength(1)
  })

  it('indekserer faginnholdet også når ClinPGx-dataene ikke kan leses', async () => {
    const nede: Farmakogenetikkleser = {
      les: async () => {
        throw new Error('ClinPGx-kopien svarer ikke')
      },
      sok: async () => [],
      hent: async () => ({ status: 'feilet' }),
    }
    const sideleser = { lesAnalyttsider: async () => [sertralinside()], lesStoffsider: async () => [] }
    const base = await lesKunnskapsbase(sideleser, null, 'publisert', nede)
    expect(base.clinpgxfeil).toBe('ClinPGx-kopien svarer ikke')
    const dokumenter = indekserKunnskapsbase(base)
    expect(dokumenter.some((d) => d.tekst.includes('redaksjonell'))).toBe(true)
    expect(dokumenter.some((d) => d.tekst.includes('CYP2B6'))).toBe(false)
    // En side uten kobling spør ikke ClinPGx.
    const uten = vi.fn(nede.les)
    await lesKunnskapsbase({ lesAnalyttsider: async () => [{ ...sertralinside(), elementer: [] }], lesStoffsider: async () => [] }, null, 'publisert', { ...nede, les: uten })
    expect(uten).not.toHaveBeenCalled()
    expect(byggSidemodell(sertralinside()).paneler.get('farmakogenetikk')).toHaveLength(2)
  })
})

/* --- FEST er uberørt ------------------------------------------------------ */

describe('FEST ved siden av ClinPGx', () => {
  it('har sin egen daglige jobb, uendret, og ClinPGx sin ukentlige', () => {
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
      crons: { path: string; schedule: string }[]
      functions: Record<string, { maxDuration: number }>
    }
    expect(vercel.crons).toContainEqual({ path: '/api/legemiddeldata-synk', schedule: '15 4 * * *' })
    expect(vercel.crons).toContainEqual({ path: '/api/clinpgx-synk', schedule: '30 2 * * 1' })
    expect(vercel.functions['api/legemiddeldata-synk.ts']).toEqual({ maxDuration: 300 })
  })
})
