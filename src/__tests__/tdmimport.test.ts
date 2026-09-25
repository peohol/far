/**
 * Referanseområdene og TDM-kortene fra de tre kildene om serumkonsentrasjoner
 * (`supabase/import/tdm/`), prøvd mot de samme dataene produksjonen har:
 * psykofarmakaimporten og omarbeidingene kjøres med administratoren som
 * bestilte dem, og så TDM-migrasjonene.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../domain/analyttkatalog'
import { byggImportplan, importSql, kildetilleggskilde, type Importfil, type Plankode } from '../faginnhold/import'
import { lesKinetikk, panelFor } from '../faginnhold/paneler'
import { klartekst } from '../faginnhold/riktekst'
import { TDM_DATASETT, TDM_KILDE, tdmplan } from '../faginnhold/tdm'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)
const plan = tdmplan(katalog)
const FORSTE_IMPORTMIGRASJON = '20260923072247'
const TDM = migrasjonsfiler().filter((f) => /_tdm_referanseomrader_\d+\.sql$/.test(f))

interface Kort {
  objekt_id: string
  kode: string
  panel: string
  posisjon: number
  elementtype: string
  data: Record<string, unknown>
  referanser: string[]
  utkast: number
  publisert: number
  kilde: string | null
}

/** De publiserte kortene i viktige data og TDM, per analyttkode, med kildene i rekkefølge (tittelen, ikke ID-en). */
async function kort(db: PGlite): Promise<Kort[]> {
  const { rows } = await db.query<Kort>(
    `select e.objekt_id, a.kode, e.panel, e.posisjon, e.elementtype, e.data,
            coalesce((select array_agg(rf.tittel order by k.nr) from public.referansekoblinger k
                      join public.referanser rf on rf.objekt_id = k.referanse_id and rf.tilstand = k.tilstand
                      where k.objekt_id = e.objekt_id and k.tilstand = e.tilstand and k.niva = 'element'), '{}') as referanser,
            u.revisjon as utkast, p.revisjon as publisert, r.kilde
     from public.innholdselementer e
     join public.laboratorieanalytter a on a.hovedside_id = e.infoside_id and a.tilstand = e.tilstand
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and e.panel in ('viktige_data', 'tdm')
     order by a.kode, e.panel, e.posisjon, e.elementtype`,
  )
  return rows
}

const referanseomrade = (liste: Kort[], kode: string) =>
  liste.find((k) => k.kode === kode && k.elementtype === 'referanseomrade')
const tdmkort = (liste: Kort[], kode: string) => liste.filter((k) => k.kode === kode && k.panel === 'tdm')
const tittel = (nokkel: string) => TDM_DATASETT.referanser[nokkel]!.tittel

describe('datasettet', () => {
  it('har TDM-seksjonen som kortpanel foran serumkonsentrasjonene', () => {
    expect(panelFor('tdm')).toMatchObject({ form: 'kort', tittel: 'Terapeutisk legemiddelmonitorering (TDM)' })
  })

  it('dekker psykofarmakasidene fra rapporten, lamotrigin, opioidene, benzodiazepinene, metadon og amfetamin', () => {
    expect(plan.koder.map((k) => k.kode)).toEqual(
      expect.arrayContaining(['SERT', 'KVE', 'LAM', 'MOR', 'OKSY', 'BUP', 'DIAZ', 'CZP', 'ZOPI', 'MDO', 'AMF1']),
    )
    expect(plan.koder).toHaveLength(44)
    expect(plan.referanser.map((r) => r.nokkel).sort()).toEqual(['frost2019', 'helland2016', 'ousfortolkning', 'referanseomradeprosjektet'])
  })

  it('har prøvetakingen per legemiddelform der kildene skiller mellom formene, med fortolkningskommentarene som kilde', () => {
    const perForm = (kode: Plankode) => kode.elementer.find((e) => lesKinetikk(e.data).tittel === 'Prøvetaking per legemiddelform')
    expect(plan.koder.filter(perForm).map((k) => k.kode)).toEqual(['ARISUM', 'FLUP', 'HALO', 'KVE', 'MOR', 'OLAN', 'PERF', 'RISPSUM', 'ZUKLO'])
    const fraKommentarene = plan.koder.filter((k) => k.elementer.some((e) => e.referanser.includes('ousfortolkning')))
    expect(fraKommentarene.map((k) => k.kode)).toEqual(['ARISUM', 'FLUP', 'HALO', 'KVE', 'MOR', 'OLAN', 'PALI', 'PERF', 'RISPSUM', 'ZUKLO'])
    for (const kode of fraKommentarene) expect(kode.kilde, kode.kode).toMatch(/fortolkningskommentarene i FAR$/)
    const tekst = (kode: string) => klartekst(lesKinetikk(perForm(plan.koder.find((k) => k.kode === kode)!)!.data).dokument)
    expect(tekst('HALO')).toContain('Depotinjeksjon: 0–2 dager før neste injeksjon.')
    expect(tekst('KVE')).toContain('Depottabletter: 18–24 timer etter siste dose.')
    expect(tekst('MOR')).toContain('Depottabletter: 8–12 timer etter inntak.')
  })

  it('siterer en kilde på hvert kort det legger inn', () => {
    for (const kode of plan.koder) for (const e of kode.elementer) expect(e.referanser.length, `${kode.kode} ${e.panel}`).toBeGreaterThan(0)
  })

  it('har prøvetakingstidspunktet øverst i TDM for hver kode', () => {
    for (const kode of plan.koder) {
      const forste = kode.elementer.find((e) => e.panel === 'tdm' && e.posisjon === 0)
      expect(lesKinetikk(forste?.data).tittel, kode.kode).toBe('Prøvetakingstidspunkt')
    }
  })

  it('oppgir øvre grense alene for de vanedannende legemidlene, og området for resten', () => {
    const verdi = (kode: string) => plan.koder.find((k) => k.kode === kode)!.elementer.find((e) => e.elementtype === 'referanseomrade')!.data
    expect(verdi('MOR')).toEqual({ nedre: null, ovre: 120, enhet: 'nmol/L', forbehold: '' })
    expect(verdi('BUP')).toMatchObject({ nedre: null, ovre: 2.5 })
    expect(verdi('ZOLP')).toMatchObject({ nedre: null, ovre: 100 })
    expect(verdi('AMF1')).toMatchObject({ nedre: 100, ovre: 800 })
    expect(verdi('LAM')).toMatchObject({ nedre: 10, ovre: 50, enhet: 'µmol/L' })
  })

  it('rører ikke referanseområdet for escitalopram, som er et annet enn i rapporten', () => {
    const escit = plan.koder.find((k) => k.kode === 'ESCIT')!
    expect(escit.elementer.map((e) => e.panel)).toEqual(['tdm'])
  })

  it('viser hvor innholdet er hentet fra, med kilden filen oppgir', () => {
    const kilde = (kode: string) => plan.koder.find((k) => k.kode === kode)!.kilde
    expect(kilde('SERT')).toBe(`Importert fra ${TDM_KILDE.dokument}, side 17, 40`)
    expect(kilde('OKSY')).toBe('Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2')
    expect(kilde('PALI')).toBe('Importert fra fortolkningskommentarene i FAR')
    expect(kildetilleggskilde(kilde('SERT'))).toBe(`Kilde lagt til: ${TDM_KILDE.dokument}, side 17, 40`)
  })

  it('stopper på to kort med samme overskrift og på en tom kilde', () => {
    const fil: Importfil = {
      kode: 'MOR',
      sider: [1],
      kilde: ' ',
      tdm: [
        { tittel: 'Tolkning', tekst: ['a'] },
        { tittel: 'Tolkning', tekst: ['b'] },
      ],
    }
    expect(() => byggImportplan([fil], {}, katalog, TDM_KILDE)).toThrow(/«kilde» må være en tekst[\s\S]*to kort har samme overskrift/)
  })

  it('gir samme SQL som før når sider som finnes, hoppes over', () => {
    expect(importSql(plan, 'peohol')).toEqual(importSql(plan, 'peohol', 'feil', 'hopp over'))
    expect(importSql(plan, 'peohol').join('\n')).not.toContain('kilder :=')
  })
})

describe('migrasjonene i databasen', () => {
  let db: PGlite
  let for_: Kort[]
  let etter: Kort[]

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: TDM[0] })
    for_ = await kort(db)
    await kjorMigrasjoner(db, { fra: TDM[0] })
    etter = await kort(db)
  }, 180_000)

  it('er delt i flere migrasjoner', () => {
    expect(TDM.length).toBeGreaterThan(1)
  })

  it('legger inn TDM-kortene datasettet har, publisert og med kildene, på hver side', () => {
    for (const kode of plan.koder) {
      const forventet = kode.elementer
        .filter((e) => e.panel === 'tdm')
        .map((e) => ({
          posisjon: e.posisjon,
          data: e.data,
          referanser: e.referanser.map(tittel),
          kilde: kode.kilde,
        }))
      const vist = tdmkort(etter, kode.kode).map((k) => {
        expect(k.utkast, kode.kode).toBe(k.publisert)
        return { posisjon: k.posisjon, data: k.data, referanser: k.referanser, kilde: k.kilde }
      })
      expect(vist, kode.kode).toEqual(forventet)
    }
  })

  it('lar verdien på referanseområdene som finnes stå, og legger rapporten til som kilde', () => {
    const sert = referanseomrade(etter, 'SERT')!
    const forSert = referanseomrade(for_, 'SERT')!
    expect(sert.data).toEqual(forSert.data)
    expect(sert.publisert).toBe(forSert.publisert + 1)
    expect(sert.referanser).toEqual([tittel('referanseomradeprosjektet')])
    expect(sert.kilde).toBe(kildetilleggskilde(plan.koder.find((k) => k.kode === 'SERT')!.kilde))
    for (const k of for_.filter((x) => x.panel === 'viktige_data')) {
      expect(etter.find((e) => e.objekt_id === k.objekt_id)!.data, k.kode).toEqual(k.data)
    }
  })

  it('rører ikke escitalopram, som har et annet referanseområde enn rapporten', () => {
    expect(referanseomrade(etter, 'ESCIT')).toEqual(referanseomrade(for_, 'ESCIT'))
  })

  it('lager sider med referanseområdet for kodene som ikke hadde noen', () => {
    for (const kode of ['MOR', 'OKSY', 'FYL', 'KOD', 'TRAM', 'OTRAM', 'BUP', 'MDO', 'DIAZ', 'OXA', 'APR', 'CZP', 'NIT', 'ZOPI', 'ZOLP', 'AMF1']) {
      expect(referanseomrade(for_, kode), kode).toBeUndefined()
      expect(referanseomrade(etter, kode), kode).toMatchObject({ publisert: 1, utkast: 1 })
    }
    expect(referanseomrade(etter, 'MOR')!.data).toEqual({ nedre: null, ovre: 120, enhet: 'nmol/L', forbehold: '' })
    expect(referanseomrade(etter, 'MOR')!.referanser).toEqual([tittel('helland2016')])
    expect(referanseomrade(etter, 'AMF1')!.referanser).toEqual([tittel('frost2019')])
  })

  it('siterer begge kildene der buprenorfin og klonazepam har grenser fra begge', () => {
    const grense = (kode: string) => tdmkort(etter, kode).find((k) => lesKinetikk(k.data).tittel === 'Referansegrense')!
    expect(grense('BUP').referanser).toEqual([tittel('helland2016'), tittel('referanseomradeprosjektet')])
    expect(klartekst(lesKinetikk(grense('CZP').data).dokument)).toContain('60–220 nmol/L')
  })

  it('legger prøvetakingen per legemiddelform under prøvetakingstidspunktet, med kildene den bygger på', () => {
    const titler = (kode: string) => tdmkort(etter, kode).map((k) => lesKinetikk(k.data).tittel)
    expect(titler('HALO')).toEqual(['Prøvetakingstidspunkt', 'Prøvetaking per legemiddelform', 'Grunnlag for referanseområdet'])
    const halo = tdmkort(etter, 'HALO')[1]!
    expect(halo.referanser).toEqual([tittel('referanseomradeprosjektet'), tittel('ousfortolkning')])
    expect(klartekst(lesKinetikk(halo.data).dokument)).toContain('Depotinjeksjon: 0–2 dager før neste injeksjon.')
    expect(tdmkort(etter, 'MOR')[1]!.referanser).toEqual([tittel('ousfortolkning')])
    expect(titler('PALI')).toEqual(['Prøvetakingstidspunkt'])
    expect(tdmkort(etter, 'PALI')[0]!.kilde).toBe('Importert fra fortolkningskommentarene i FAR')
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { fra: TDM[0] })
    expect(await kort(db)).toEqual(etter)
  })

  it('endrer ikke et referanseområde som er endret til en annen verdi enn kilden', async () => {
    const annen = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(annen, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(annen, { fra: FORSTE_IMPORTMIGRASJON, til: TDM[0] })
    // En redaktør har endret referanseområdet for sertralin i appen.
    await annen.exec(`do $$
      declare admin uuid; kort uuid; rev integer; innhold jsonb;
      begin
        select id into admin from public.profiles where username = 'peohol';
        perform set_config('request.jwt.claims', jsonb_build_object('sub', admin, 'role', 'authenticated')::text, true);
        select e.objekt_id, u.revisjon, r.innhold into kort, rev, innhold
          from public.innholdselementer e
          join public.laboratorieanalytter a on a.hovedside_id = e.infoside_id and a.tilstand = e.tilstand and a.kode = 'SERT'
          join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
          join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
          where e.tilstand = 'utkast' and e.elementtype = 'referanseomrade';
        perform public.lagre_utkast(kort, rev, jsonb_set(innhold, '{data,ovre}', '260'));
        perform public.publiser_utkast(kort, rev + 1);
      end $$;`)
    const endret = referanseomrade(await kort(annen), 'SERT')!
    await kjorMigrasjoner(annen, { fra: TDM[0] })
    const sert = referanseomrade(await kort(annen), 'SERT')!
    expect(sert.data).toMatchObject({ ovre: 260 })
    expect(sert.publisert).toBe(endret.publisert)
    expect(sert.referanser).toEqual([])
    expect(tdmkort(await kort(annen), 'SERT')).toHaveLength(2)
  }, 180_000)

  it('gjør ingenting i en database uten administratoren', async () => {
    const tom = await nyDatabase()
    const { rows } = await tom.query<{ n: number }>('select count(*)::int as n from public.objektrevisjoner')
    expect(rows[0]!.n).toBe(0)
  })
})
