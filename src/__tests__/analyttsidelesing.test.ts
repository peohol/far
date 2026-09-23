/**
 * Lesingen analyttsidene bygger på, prøvd mot en ekte database.
 *
 * Som i `faginnhold.test.ts` kjøres alle migrasjonene i en Postgres i minnet,
 * og kallene gjøres slik data-API-et gjør dem — her gjennom den samme leseren
 * og det samme lageret appen bruker. Det som prøves, er at en hel side kommer
 * tilbake i ett kall med riktige revisjoner, at radsikkerheten gjelder
 * (vanlige brukere ser bare det publiserte), at publiseringsplanen for en side
 * går gjennom i den rekkefølgen databasen krever, og at referansene
 * nummereres slik siden viser dem.
 *
 * Navnene, kodene og tekstene er syntetiske. Ingen kliniske verdier inngår.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggSidemodell, publiseringsplan } from '../faginnhold/analyttside'
import { lagFaginnholdslager, type Faginnholdslager } from '../faginnhold/lagring'
import { TOM_SIDE, lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { ENKELTELEMENTER } from '../faginnhold/paneler'
import { SITERING } from '../faginnhold/referanser'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

let db: PGlite
let admin: string
let bruker: string
let kall: Faginnholdskall
let adminleser: Faginnholdsleser
let brukerleser: Faginnholdsleser
let lager: Faginnholdslager

/** Siden prøvene bygger: en sumanalyse med to komponenter og en egen kode for den ene. */
const ider = { hoved: '', metabolitt: '', analytt: '', metabolittanalytt: '', tekst: '', kort: '', a: '', b: '' }

function dokument(...innhold: unknown[]) {
  return { type: 'doc', content: [{ type: 'paragraph', content: innhold }] }
}

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  adminleser = lagFaginnholdsleser(kall.klientFor(admin))
  brukerleser = lagFaginnholdsleser(kall.klientFor(bruker))
  lager = lagFaginnholdslager(kall.klientFor(admin))

  ider.a = (await lager.opprettUtkast('referanse', { tittel: 'Kilde A', forfattere: 'Nordmann O', aar: '2020', lenke: '' })).id
  ider.b = (await lager.opprettUtkast('referanse', { tittel: 'Kilde B', forfattere: 'Hansen K', aar: '2021', lenke: '' })).id
  ider.hoved = (await lager.opprettUtkast('infoside', { navn: 'Testmiddel', panelreferanser: { dosering: [ider.b] } })).id
  ider.metabolitt = (await lager.opprettUtkast('infoside', { navn: 'Desmetyltestmiddel' })).id
  ider.analytt = (
    await lager.opprettUtkast('laboratorieanalytt', {
      kode: 'TESTSUM',
      hovedside: ider.hoved,
      komponenter: [ider.hoved, ider.metabolitt],
    })
  ).id
  ider.metabolittanalytt = (
    await lager.opprettUtkast('laboratorieanalytt', {
      kode: 'DTEST',
      hovedside: ider.metabolitt,
      komponenter: [ider.metabolitt],
    })
  ).id
  ider.tekst = (
    await lager.opprettUtkast('innholdselement', {
      infoside: ider.hoved,
      panel: 'farmakodynamikk',
      posisjon: 0,
      elementtype: 'riktekst',
      data: { dokument: dokument({ type: 'text', text: 'Virker på ' }, { type: SITERING, attrs: { referanser: [ider.a] } }) },
    })
  ).id
  ider.kort = (
    await lager.opprettUtkast('innholdselement', {
      infoside: ider.hoved,
      panel: 'viktige_data',
      posisjon: 0,
      elementtype: 'referanseomrade',
      data: { nedre: 10, ovre: 20, enhet: 'nmol/L', forbehold: '' },
      referanser: [ider.b],
    })
  ).id
}, 60_000)

describe('les_analyttside', () => {
  it('gir administratoren hele utkastet i ett kall', async () => {
    const side = await adminleser.lesAnalyttside('TESTSUM', 'utkast')
    expect(side.analytt).toMatchObject({ id: ider.analytt, revisjon: 1, publisert_revisjon: null })
    expect(side.infoside).toMatchObject({
      id: ider.hoved,
      innhold: { navn: 'Testmiddel', panelreferanser: { dosering: [ider.b] } },
      endret_av_fornavn: 'Rita',
      endret_av_etternavn: 'Redaktør',
    })
    expect(side.elementer.map((e) => e.id).sort()).toEqual([ider.tekst, ider.kort].sort())
    // Komponentene i rekkefølge, med kodene som har dem som hovedside.
    expect(side.komponenter.map((k) => [k.innhold.navn, k.koder])).toEqual([
      ['Testmiddel', ['TESTSUM']],
      ['Desmetyltestmiddel', ['DTEST']],
    ])
    // Referansene siden siterer, fra panelet, kortet og teksten.
    expect(side.referanser.map((r) => r.id).sort()).toEqual([ider.a, ider.b].sort())
  })

  it('gir en vanlig bruker ingenting av utkastet', async () => {
    expect(await brukerleser.lesAnalyttside('TESTSUM', 'utkast')).toEqual(TOM_SIDE)
    expect(await brukerleser.lesAnalyttside('TESTSUM', 'publisert')).toEqual(TOM_SIDE)
    expect(await brukerleser.lesReferanser('utkast')).toEqual([])
  })

  it('gir en tom side for en kode som ikke finnes', async () => {
    expect(await adminleser.lesAnalyttside('FINNESIKKE', 'utkast')).toEqual(TOM_SIDE)
  })

  it('publiserer hele siden i den rekkefølgen databasen krever', async () => {
    const utkast = await adminleser.lesAnalyttside('TESTSUM', 'utkast')
    const plan = publiseringsplan(utkast)
    expect(plan.map((s) => s.slag)).toEqual([
      'referanse',
      'referanse',
      'komponent',
      'infoside',
      'laboratorieanalytt',
      'innholdselement',
      'innholdselement',
    ])
    for (const steg of plan) await lager.publiserUtkast(steg.id, steg.revisjon)

    const publisert = await brukerleser.lesAnalyttside('TESTSUM', 'publisert')
    expect(publisert.analytt).toMatchObject({ id: ider.analytt, revisjon: 1, publisert_revisjon: 1 })
    expect(publisert.elementer).toHaveLength(2)
    expect(publisert.referanser.map((r) => r.innhold.tittel).sort()).toEqual(['Kilde A', 'Kilde B'])
    // Komponentsiden er publisert, men koden DTEST er det ikke: den er ikke med.
    expect(publisert.komponenter.map((k) => [k.innhold.navn, k.koder])).toEqual([
      ['Testmiddel', ['TESTSUM']],
      ['Desmetyltestmiddel', []],
    ])
    expect(publiseringsplan(await adminleser.lesAnalyttside('TESTSUM', 'utkast'))).toEqual([])
  })

  it('nummererer referansene i den rekkefølgen siden viser dem', async () => {
    const modell = byggSidemodell(await brukerleser.lesAnalyttside('TESTSUM', 'publisert'))
    // «Viktige data» står før «Farmakodynamikk», som står før «Dosering».
    // Kortet siterer B, teksten A, og panelet Dosering B igjen.
    expect([...modell.nummerering]).toEqual([
      [ider.b, 1],
      [ider.a, 2],
    ])
    expect(modell.referanseliste.map((r) => r.referanse.tittel)).toEqual(['Kilde B', 'Kilde A'])
  })

  it('lar det publiserte stå til en endring er publisert', async () => {
    const utkast = await adminleser.lesAnalyttside('TESTSUM', 'utkast')
    const kort = utkast.elementer.find((e) => e.id === ider.kort)!
    await lager.lagreUtkast(ider.kort, kort.revisjon, { ...kort.innhold, data: { ...kort.innhold.data, ovre: 30 } })

    const endret = await adminleser.lesAnalyttside('TESTSUM', 'utkast')
    expect(endret.elementer.find((e) => e.id === ider.kort)).toMatchObject({ revisjon: 2, publisert_revisjon: 1 })
    expect(publiseringsplan(endret)).toEqual([{ slag: 'innholdselement', id: ider.kort, revisjon: 2 }])

    const publisert = await brukerleser.lesAnalyttside('TESTSUM', 'publisert')
    expect(publisert.elementer.find((e) => e.id === ider.kort)?.innhold.data).toMatchObject({ ovre: 20 })
  })
})

describe('les_referanser og finn_infosider', () => {
  it('gir referansebasen i hver tilstand', async () => {
    const ubrukt = await lager.opprettUtkast('referanse', { tittel: 'Ubrukt', forfattere: '', aar: '', lenke: '' })
    const utkast = await adminleser.lesReferanser('utkast')
    expect(utkast.map((r) => r.id)).toEqual(expect.arrayContaining([ider.a, ider.b, ubrukt.id]))
    const publisert = await brukerleser.lesReferanser('publisert')
    expect(publisert.map((r) => r.id).sort()).toEqual([ider.a, ider.b].sort())
  })

  it('finner sider på navnet uten hensyn til store og små bokstaver', async () => {
    const treff = await adminleser.finnInfosider(['testmiddel', 'DESMETYLTESTMIDDEL', 'Ukjent'], 'utkast')
    expect(treff.map((t) => t.id).sort()).toEqual([ider.hoved, ider.metabolitt].sort())
  })
})

describe('kortene som bare kan stå én gang', () => {
  it('avviser et kort nummer to av samme type i samme panel', async () => {
    const side = (await lager.opprettUtkast('infoside', { navn: 'Enkeltkortside' })).id
    const kort = (elementtype: string, panel = 'panel_x', posisjon = 0) =>
      lager.opprettUtkast('innholdselement', { infoside: side, panel, posisjon, elementtype, data: {} })

    for (const type of ENKELTELEMENTER) {
      await kort(type)
      await expect(kort(type), type).rejects.toThrow()
      // Samme type i et annet panel er et annet kort.
      await kort(type, 'panel_y')
    }
  })

  it('lar farmakokinetikken ha mange kort, og et fjernet kort gi plass til et nytt', async () => {
    const side = (await lager.opprettUtkast('infoside', { navn: 'Flerkortside' })).id
    const innhold = (elementtype: string, panel: string) => ({ infoside: side, panel, posisjon: 0, elementtype, data: {} })
    await lager.opprettUtkast('innholdselement', innhold('kinetikkort', 'farmakokinetikk'))
    await lager.opprettUtkast('innholdselement', innhold('kinetikkort', 'farmakokinetikk'))

    const forste = await lager.opprettUtkast('innholdselement', innhold('riktekst', 'dosering'))
    await lager.lagreUtkast(forste.id, 1, innhold('riktekst', 'fjernet'))
    await lager.opprettUtkast('innholdselement', innhold('riktekst', 'dosering'))
  })
})

describe('rettighetene', () => {
  it('lar bare innloggede lese, og ingen skrive gjennom lesingen', async () => {
    const har = async (sql: string, ...parametre: unknown[]) =>
      (await kall.fasit<{ har: boolean }>(`select ${sql} as har`, parametre))[0]!.har
    const funksjoner = [
      'public.les_analyttside(text, public.objekttilstand)',
      'public.les_referanser(public.objekttilstand)',
      'public.finn_infosider(text[], public.objekttilstand)',
    ]
    for (const rolle of ['anon', 'authenticated', 'service_role']) {
      for (const funksjon of funksjoner) {
        expect(await har('has_function_privilege($1, $2, $3)', rolle, funksjon, 'EXECUTE'), `${rolle} ${funksjon}`).toBe(
          rolle === 'authenticated',
        )
      }
      for (const rett of ['INSERT', 'UPDATE', 'DELETE']) {
        expect(await har('has_table_privilege($1, $2, $3)', rolle, 'public.objektutgaver', rett)).toBe(false)
      }
      expect(await har('has_table_privilege($1, $2, $3)', rolle, 'public.objektutgaver', 'SELECT')).toBe(rolle !== 'anon')
    }
    // Lesefunksjonene kjører med rettighetene til den som kaller, så
    // radsikkerheten gjelder også gjennom dem.
    const [rad] = await kall.fasit<{ definer: boolean }>(
      `select bool_or(prosecdef) as definer from pg_proc
       where proname in ('les_analyttside', 'les_referanser', 'finn_infosider', 'utgave_som_json')`,
    )
    expect(rad!.definer).toBe(false)
  })
})
