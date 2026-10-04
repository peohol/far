/**
 * Lesingen stoffsidene bygger på, prøvd mot en ekte database.
 *
 * Som i `faginnhold.test.ts` kjøres alle migrasjonene i en Postgres i minnet,
 * og kallene gjøres slik data-API-et gjør dem — her gjennom den samme leseren
 * og det samme lageret appen bruker. Hver fagside er en side om et stoff, og
 * finnes etter stoffets nøkkel (`slug`), aldri gjennom en laboratorieanalytt.
 * Det som prøves, er at en hel side kommer tilbake i ett kall etter nøkkelen
 * med riktige revisjoner (`les_stoff`), at radsikkerheten gjelder (vanlige
 * brukere ser bare det publiserte), at nøkkelen settes av navnet når siden
 * lages og står når navnet endres, at to sider ikke kan ha samme nøkkel, at
 * sidene som fantes før nøkkelen, fikk den av navnet og fortsatt står likt
 * revisjonen sin, at `les_stoffer`, `les_stoffliste` og
 * `les_stoffreferanseomrader` gir alle sidene, og at referanseområdet en
 * analyttkode får, er kortet på stoffsiden koblingene i stoffregisteret peker
 * på. Publiseringsplanen for en side går gjennom i den rekkefølgen databasen
 * krever, og referansene nummereres slik siden viser dem.
 *
 * Navnene, tekstene og tallene er syntetiske, også på sidene for stoffene i
 * stoffregisteret (Bupropion og Tramadol). Ingen kliniske verdier inngår.
 */
import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggSidemodell, publiseringsplan } from '../faginnhold/stoffside'
import { lagFaginnholdslager, type Faginnholdslager } from '../faginnhold/lagring'
import { INGEN_REGLER, TOM_STOFFSIDE, lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import type { Objektstatus } from '../faginnhold/modell'
import { ENKELTELEMENTER, PANELER_MED_FASTE_KORT, enkeltnokkel, fasteKort, panelFor } from '../faginnhold/paneler'
import { SITERING } from '../faginnhold/referanser'
import { STOFFREGISTER, stoffslug } from '../domain/stoffregister'
import { primareAnalytter } from '../domain/koblinger'
import {
  faginnholdskall,
  feilFra,
  kjorMigrasjoner,
  migrasjonsfiler,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

/** Migrasjonen som ga sidene stoffets nøkkel. */
const STOFFIDENTITET = migrasjonsfiler().find((f) => f.endsWith('_stoffidentitet.sql'))!

let db: PGlite
let admin: string
let bruker: string
let kall: Faginnholdskall
let adminleser: Faginnholdsleser
let brukerleser: Faginnholdsleser
let lager: Faginnholdslager

/** Siden prøvene bygger: et stoff med en tekst, et datakort og en kilde på et panel. */
const ider = { side: '', tekst: '', kort: '', a: '', b: '' }
/** Sidene for stoffene i registeret, fra prøvene av referanseområdene. */
const ref = { bupropion: '', tramadol: '' }

function dokument(...innhold: unknown[]) {
  return { type: 'doc', content: [{ type: 'paragraph', content: innhold }] }
}

async function publiser(...objekter: Objektstatus[]) {
  for (const { id, revisjon } of objekter) await lager.publiserUtkast(id, revisjon!)
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
  ider.side = (await lager.opprettUtkast('infoside', { navn: 'Testmiddel', panelreferanser: { dosering: [ider.b] } })).id
  ider.tekst = (
    await lager.opprettUtkast('innholdselement', {
      infoside: ider.side,
      panel: 'farmakodynamikk',
      posisjon: 0,
      elementtype: 'riktekst',
      data: { dokument: dokument({ type: 'text', text: 'Virker på ' }, { type: SITERING, attrs: { referanser: [ider.a] } }) },
    })
  ).id
  ider.kort = (
    await lager.opprettUtkast('innholdselement', {
      infoside: ider.side,
      panel: 'viktige_data',
      posisjon: 0,
      elementtype: 'referanseomrade',
      data: { nedre: 10, ovre: 20, enhet: 'nmol/L', forbehold: '' },
      referanser: [ider.b],
    })
  ).id
}, 60_000)

describe('les_stoff', () => {
  it('gir administratoren hele utkastet i ett kall, etter stoffets nøkkel', async () => {
    const side = await adminleser.lesStoffside('testmiddel', 'utkast')
    expect(side.stoff).toEqual({ id: ider.side, slug: 'testmiddel', navn: 'Testmiddel' })
    expect(side.infoside).toMatchObject({
      id: ider.side,
      revisjon: 1,
      publisert_revisjon: null,
      innhold: { navn: 'Testmiddel', panelreferanser: { dosering: [ider.b] } },
      endret_av_fornavn: 'Rita',
      endret_av_etternavn: 'Redaktør',
    })
    // Nøkkelen står ikke i innholdet når den er den navnet gir.
    expect(side.infoside?.innhold).not.toHaveProperty('slug')
    expect(side.elementer.map((e) => e.id).sort()).toEqual([ider.tekst, ider.kort].sort())
    // Referansene siden siterer, fra panelet, kortet og teksten.
    expect(side.referanser.map((r) => r.id).sort()).toEqual([ider.a, ider.b].sort())
    // Siden har ingen analytt og ingen komponenter: det hører til stoffregisteret.
    expect(Object.keys(side).sort()).toEqual(['elementer', 'infoside', 'referanser', 'stoff'])
  })

  it('finner siden bare etter nøkkelen: ikke etter navnet, og ikke med store bokstaver', async () => {
    expect((await adminleser.lesStoffside(' testmiddel ', 'utkast')).stoff?.id).toBe(ider.side)
    expect(await adminleser.lesStoffside('Testmiddel', 'utkast')).toEqual(TOM_STOFFSIDE)
    expect(await adminleser.lesStoffside('TESTMIDDEL', 'utkast')).toEqual(TOM_STOFFSIDE)
  })

  it('gir en vanlig bruker ingenting av utkastet', async () => {
    expect(await brukerleser.lesStoffside('testmiddel', 'utkast')).toEqual(TOM_STOFFSIDE)
    expect(await brukerleser.lesStoffside('testmiddel', 'publisert')).toEqual(TOM_STOFFSIDE)
    expect(await brukerleser.lesReferanser('utkast')).toEqual([])
    const rad = await kall.rpc<{ les_stoff: unknown }>(bruker, 'les_stoff', { stoff: 'testmiddel', sidetilstand: 'utkast' })
    expect(rad.les_stoff).toBeNull()
  })

  it('gir en tom side for en nøkkel ingen side har', async () => {
    expect(await adminleser.lesStoffside('finnesikke', 'utkast')).toEqual(TOM_STOFFSIDE)
  })

  it('publiserer hele siden i den rekkefølgen databasen krever', async () => {
    const utkast = await adminleser.lesStoffside('testmiddel', 'utkast')
    const plan = publiseringsplan(utkast, INGEN_REGLER)
    expect(plan.map((s) => s.slag)).toEqual(['referanse', 'referanse', 'infoside', 'innholdselement', 'innholdselement'])
    for (const steg of plan) await lager.publiserUtkast(steg.id, steg.revisjon)

    const publisert = await brukerleser.lesStoffside('testmiddel', 'publisert')
    expect(publisert.stoff).toEqual({ id: ider.side, slug: 'testmiddel', navn: 'Testmiddel' })
    expect(publisert.infoside).toMatchObject({ id: ider.side, revisjon: 1, publisert_revisjon: 1 })
    expect(publisert.elementer).toHaveLength(2)
    expect(publisert.referanser.map((r) => r.innhold.tittel).sort()).toEqual(['Kilde A', 'Kilde B'])
    expect(publiseringsplan(await adminleser.lesStoffside('testmiddel', 'utkast'), INGEN_REGLER)).toEqual([])
  })

  it('nummererer referansene i den rekkefølgen siden viser dem', async () => {
    const modell = byggSidemodell(await brukerleser.lesStoffside('testmiddel', 'publisert'))
    // «Viktige data» står før «Farmakodynamikk», som står før «Dosering».
    // Kortet siterer B, teksten A, og panelet Dosering B igjen.
    expect([...modell.nummerering]).toEqual([
      [ider.b, 1],
      [ider.a, 2],
    ])
    expect(modell.referanseliste.map((r) => r.referanse.tittel)).toEqual(['Kilde B', 'Kilde A'])
  })

  it('lar det publiserte stå til en endring er publisert', async () => {
    const utkast = await adminleser.lesStoffside('testmiddel', 'utkast')
    const kort = utkast.elementer.find((e) => e.id === ider.kort)!
    await lager.lagreUtkast(ider.kort, kort.revisjon, { ...kort.innhold, data: { ...kort.innhold.data, ovre: 30 } })

    const endret = await adminleser.lesStoffside('testmiddel', 'utkast')
    expect(endret.elementer.find((e) => e.id === ider.kort)).toMatchObject({ revisjon: 2, publisert_revisjon: 1 })
    expect(publiseringsplan(endret, INGEN_REGLER)).toEqual([{ slag: 'innholdselement', id: ider.kort, revisjon: 2 }])

    const publisert = await brukerleser.lesStoffside('testmiddel', 'publisert')
    expect(publisert.elementer.find((e) => e.id === ider.kort)?.innhold.data).toMatchObject({ ovre: 20 })
  })
})

describe('nøkkelen', () => {
  it('lages av navnet, med samme regel i databasen som i appen', async () => {
    for (const navn of ['Paliperidon (hydroksyrisperidon)', 'Ærlig Østrogen-å', 'N-desmetyldiazepam', 'Café Ñandú', 'Straße', ' -Test- 2 ']) {
      const [rad] = await kall.fasit<{ slug: string }>('select intern.stoffslug($1) as slug', [navn])
      expect(rad!.slug, navn).toBe(stoffslug(navn))
    }
    expect(stoffslug('Paliperidon (hydroksyrisperidon)')).toBe('paliperidon-hydroksyrisperidon')
  })

  it('settes av navnet når siden lages, og står ikke i innholdet', async () => {
    const ny = await kall.opprett('infoside', { navn: 'Ærlig Øl-middel (test)' })
    expect(await kall.fasit('select tilstand, slug from public.infosider where objekt_id = $1', [ny.id])).toEqual([
      { tilstand: 'utkast', slug: 'aerlig-ol-middel-test' },
    ])
    const [revisjon] = await kall.revisjoner(ny.id)
    expect(revisjon!.innhold).toEqual({ navn: 'Ærlig Øl-middel (test)' })
    await kall.forventSamsvar(ny.id)
    expect((await adminleser.lesStoffside('aerlig-ol-middel-test', 'utkast')).stoff).toEqual({
      id: ny.id,
      slug: 'aerlig-ol-middel-test',
      navn: 'Ærlig Øl-middel (test)',
    })
  })

  it('står fast når navnet endres, også når endringen publiseres', async () => {
    const ny = await kall.opprett('infoside', { navn: 'Navnebytte' })
    await kall.publiser(ny.id, 1)
    const endret = await kall.lagre(ny.id, 1, { navn: 'Navnebytte forte' })
    expect(endret.revisjon).toBe(2)
    await kall.forventSamsvar(ny.id)

    // Nøkkelen står nå i innholdet, fordi den ikke lenger er den navnet gir.
    const utkast = await adminleser.lesStoffside('navnebytte', 'utkast')
    expect(utkast.stoff).toEqual({ id: ny.id, slug: 'navnebytte', navn: 'Navnebytte forte' })
    expect(utkast.infoside?.innhold).toEqual({ navn: 'Navnebytte forte', slug: 'navnebytte' })
    expect(await adminleser.lesStoffside('navnebytte-forte', 'utkast')).toEqual(TOM_STOFFSIDE)
    // Det publiserte har det gamle navnet til endringen publiseres, under den samme nøkkelen.
    expect((await brukerleser.lesStoffside('navnebytte', 'publisert')).stoff?.navn).toBe('Navnebytte')

    await kall.publiser(ny.id, 2)
    await kall.forventSamsvar(ny.id)
    expect((await brukerleser.lesStoffside('navnebytte', 'publisert')).stoff).toEqual({
      id: ny.id,
      slug: 'navnebytte',
      navn: 'Navnebytte forte',
    })

    // Å gjenopprette det gamle navnet beholder nøkkelen, og innholdet er igjen uten den.
    const gjenopprettet = await kall.gjenopprett(ny.id, 2, 1)
    await kall.forventSamsvar(ny.id)
    expect((await adminleser.lesStoffside('navnebytte', 'utkast')).infoside).toMatchObject({
      revisjon: gjenopprettet.revisjon,
      innhold: { navn: 'Navnebytte' },
    })
    expect((await adminleser.lesStoffside('navnebytte', 'utkast')).infoside?.innhold).not.toHaveProperty('slug')
  })

  it('endres bare når innholdet sier det uttrykkelig', async () => {
    const ny = await kall.opprett('infoside', { navn: 'Flyttestoff' })
    await kall.lagre(ny.id, 1, { navn: 'Flyttestoff', slug: 'flyttet-stoff' })
    await kall.forventSamsvar(ny.id)
    expect((await adminleser.lesStoffside('flyttet-stoff', 'utkast')).stoff).toEqual({
      id: ny.id,
      slug: 'flyttet-stoff',
      navn: 'Flyttestoff',
    })
    expect(await adminleser.lesStoffside('flyttestoff', 'utkast')).toEqual(TOM_STOFFSIDE)
  })

  it('avviser en nøkkel en annen side har, i hvilken som helst tilstand', async () => {
    // Uttrykkelig, og gjennom et navn som gir den samme nøkkelen.
    const uttrykkelig = await feilFra(() => kall.opprett('infoside', { navn: 'Annet middel', slug: 'testmiddel' }))
    expect(uttrykkelig).toMatchObject({ code: '22023', message: expect.stringContaining('testmiddel') })
    const avNavnet = await feilFra(() => kall.opprett('infoside', { navn: 'Testmiddel!' }))
    expect(avNavnet).toMatchObject({ code: '22023', message: expect.stringContaining('testmiddel') })

    const annen = await kall.opprett('infoside', { navn: 'Annen side' })
    expect(await feilFra(() => kall.lagre(annen.id, 1, { navn: 'Annen side', slug: 'testmiddel' }))).toMatchObject({
      code: '22023',
    })
    // Ingenting ble lagret, og den første siden har fortsatt nøkkelen.
    expect(await kall.fasit('select count(*)::int as n from public.infosider where slug = $1', ['testmiddel'])).toEqual([
      { n: 2 },
    ])
    expect((await adminleser.lesStoffside('testmiddel', 'utkast')).stoff?.id).toBe(ider.side)
    expect((await kall.revisjoner(annen.id)).map((r) => r.revisjon)).toEqual([1])

    // En nøkkel som bare det publiserte av en side har, er heller ikke ledig.
    const flyttet = await kall.opprett('infoside', { navn: 'Gammel adresse' })
    await kall.publiser(flyttet.id, 1)
    await kall.lagre(flyttet.id, 1, { navn: 'Gammel adresse', slug: 'ny-adresse' })
    expect(await feilFra(() => kall.opprett('infoside', { navn: 'Gammel-adresse' }))).toMatchObject({
      code: '22023',
      message: expect.stringContaining('gammel-adresse'),
    })
  })

  it('avviser en nøkkel uten riktig form, og et navn uten bokstaver eller tall', async () => {
    for (const slug of ['Store-bokstaver', 'to--streker', '-foran', 'æøå', 'med mellomrom']) {
      expect(await feilFra(() => kall.opprett('infoside', { navn: `Ugyldig ${slug}`, slug })), slug).toMatchObject({
        code: '22023',
      })
    }
    expect(await feilFra(() => kall.opprett('infoside', { navn: '!!!' }))).toMatchObject({ code: '22023' })
  })

  it('lar ikke en vanlig bruker endre nøkkelen', async () => {
    expect(
      await feilFra(() => kall.lagre(ider.side, 1, { navn: 'Testmiddel', slug: 'kapret' }, bruker)),
    ).not.toBeNull()
    expect((await adminleser.lesStoffside('testmiddel', 'utkast')).stoff?.id).toBe(ider.side)
  })
})

describe('sidene som fantes før nøkkelen', () => {
  let gammel: PGlite
  let k: Faginnholdskall
  const sider: Record<string, { id: string; revisjon: number }> = {}

  beforeAll(async () => {
    gammel = await nyDatabase({ til: STOFFIDENTITET })
    const redaktor = await opprettBruker(gammel, {
      brukernavn: 'redaktor',
      fornavn: 'Rita',
      etternavn: 'Redaktør',
      rolle: 'admin',
    })
    k = faginnholdskall(gammel, redaktor)
    const referanse = await k.opprett('referanse', { tittel: 'Kilde', forfattere: 'Nordmann O', aar: '2020', lenke: '' })
    await k.publiser(referanse.id, 1)
    for (const navn of ['Sertralin', 'Paliperidon (hydroksyrisperidon)', 'Østrogen']) {
      const side = await k.opprett('infoside', { navn, panelreferanser: { dosering: [referanse.id] } })
      await k.publiser(side.id, 1)
      sider[navn] = { id: side.id, revisjon: 1 }
    }
    // En side som bare finnes som utkast.
    const utkast = await k.opprett('infoside', { navn: 'Bare utkast' })
    sider['Bare utkast'] = { id: utkast.id, revisjon: 1 }
    await kjorMigrasjoner(gammel, { fra: STOFFIDENTITET })
  }, 120_000)

  it('fikk nøkkelen navnet gir, i hver tilstand', async () => {
    const rader = await k.fasit<{ navn: string; tilstand: string; slug: string }>(
      'select navn, tilstand, slug from public.infosider order by navn, tilstand',
    )
    expect(rader.length).toBe(7)
    for (const rad of rader) expect(rad.slug, `${rad.navn} ${rad.tilstand}`).toBe(stoffslug(rad.navn))
    expect(rader.find((r) => r.navn === 'Paliperidon (hydroksyrisperidon)')?.slug).toBe('paliperidon-hydroksyrisperidon')
    expect(rader.find((r) => r.navn === 'Østrogen')?.slug).toBe('ostrogen')
  })

  it('står likt revisjonen sin, uten nye revisjoner', async () => {
    for (const [navn, { id, revisjon }] of Object.entries(sider)) {
      await k.forventSamsvar(id)
      expect((await k.revisjoner(id)).map((r) => r.revisjon), navn).toEqual([revisjon])
    }
  })

  it('gir ingen ny revisjon når innholdet lagres uendret', async () => {
    for (const [navn, { id, revisjon }] of Object.entries(sider)) {
      const [siste] = (await k.revisjoner(id)).slice(-1)
      const status = await k.lagre(id, revisjon, siste!.innhold as { navn: string })
      expect(status.revisjon, navn).toBe(revisjon)
      await k.forventSamsvar(id)
    }
  })

  it('leses etter nøkkelen', async () => {
    const [redaktor] = await k.fasit<{ id: string }>("select id from public.profiles where username = 'redaktor'")
    const leser = lagFaginnholdsleser(k.klientFor(redaktor!.id))
    expect((await leser.lesStoffside('sertralin', 'publisert')).stoff).toEqual({
      id: sider.Sertralin!.id,
      slug: 'sertralin',
      navn: 'Sertralin',
    })
    expect((await leser.lesStoffside('paliperidon-hydroksyrisperidon', 'publisert')).infoside?.id).toBe(
      sider['Paliperidon (hydroksyrisperidon)']!.id,
    )
    expect(await leser.lesStoffside('bare-utkast', 'publisert')).toEqual(TOM_STOFFSIDE)
    expect((await leser.lesStoffside('bare-utkast', 'utkast')).stoff?.id).toBe(sider['Bare utkast']!.id)
  })

  it('beholder nøkkelen når en side får nytt navn etter migrasjonen', async () => {
    const { id, revisjon } = sider.Sertralin!
    await k.lagre(id, revisjon, { navn: 'Sertralin (test)', panelreferanser: {} })
    expect(await k.fasit('select slug from public.infosider where objekt_id = $1', [id])).toEqual([
      { slug: 'sertralin' },
      { slug: 'sertralin' },
    ])
    await k.forventSamsvar(id)
  })
})

describe('les_stoffer og les_stoffliste', () => {
  it('gir alle sidene i én tilstand på samme form som les_stoff, med referansene én gang', async () => {
    const { les_stoffer: svar } = await kall.rpc<{
      les_stoffer: { sider: { stoff: { slug: string }; referanser: string[] }[]; referanser: { id: string }[] }
    }>(bruker, 'les_stoffer', { sidetilstand: 'publisert' })
    const testmiddel = svar.sider.find((s) => s.stoff.slug === 'testmiddel')!
    expect(testmiddel.referanser.sort()).toEqual([ider.a, ider.b].sort())
    expect(new Set(svar.referanser.map((r) => r.id)).size).toBe(svar.referanser.length)

    // Det samme som les_stoff, bortsett fra at referansene står med ID-en, én gang for alle sidene.
    const side = await brukerleser.lesStoffside('testmiddel', 'publisert')
    expect(testmiddel).toEqual({ ...side, referanser: expect.any(Array) })
    // Vanlige brukere får bare det publiserte.
    const { les_stoffer: utkast } = await kall.rpc<{ les_stoffer: { sider: unknown[] } }>(bruker, 'les_stoffer', {
      sidetilstand: 'utkast',
    })
    expect(utkast.sider).toEqual([])
  })

  it('gir ID-en, nøkkelen og navnet til hver side, alfabetisk', async () => {
    const liste = await adminleser.lesStoffliste('utkast')
    expect(liste.map((s) => s.navn)).toEqual([...liste.map((s) => s.navn)].sort((a, b) => a.localeCompare(b, 'nb')))
    expect(liste).toContainEqual({ id: ider.side, slug: 'testmiddel', navn: 'Testmiddel' })
    for (const s of liste) expect(Object.keys(s).sort(), s.navn).toEqual(['id', 'navn', 'slug'])
    // Vanlige brukere ser bare de publiserte sidene.
    const publisert = await brukerleser.lesStoffliste('publisert')
    expect(publisert).toContainEqual({ id: ider.side, slug: 'testmiddel', navn: 'Testmiddel' })
    expect(publisert.length).toBeLessThan(liste.length)
    expect(await brukerleser.lesStoffliste('utkast')).toEqual([])
  })
})

describe('referanseområdene', () => {

  beforeAll(async () => {
    // Sider for to stoffer i registeret: Bupropion, med metabolitten HBUP som
    // analytt, og Tramadol, med TRAM og metabolitten OTRAM.
    const bupropion = await lager.opprettUtkast('infoside', { navn: 'Bupropion' })
    const tramadol = await lager.opprettUtkast('infoside', { navn: 'Tramadol' })
    ref.bupropion = bupropion.id
    ref.tramadol = tramadol.id
    const kort = (infoside: string, data: Record<string, unknown>) =>
      lager.opprettUtkast('innholdselement', {
        infoside,
        panel: 'viktige_data',
        posisjon: 0,
        elementtype: 'referanseomrade',
        data: { enhet: 'nmol/L', forbehold: '', ...data },
        referanser: [],
      })
    const bupropionkort = await kort(bupropion.id, { nedre: 100, ovre: 200 })
    const tramadolkort = await kort(tramadol.id, { nedre: null, ovre: 300 })
    await publiser(bupropion, tramadol, bupropionkort, tramadolkort)
  })

  it('gir kortene per stoff, med koden kortet gjelder', async () => {
    const { les_stoffreferanseomrader: kort } = await kall.rpc<{
      les_stoffreferanseomrader: { stoff: string; gjelder: string | null; verdi: { ovre: number } }[]
    }>(bruker, 'les_stoffreferanseomrader', { sidetilstand: 'publisert' })
    expect(kort.map((k) => [k.stoff, k.gjelder, k.verdi.ovre])).toEqual([
      ['bupropion', null, 200],
      ['testmiddel', null, 20],
      ['tramadol', null, 300],
    ])
    const { les_stoffreferanseomrader: utkast } = await kall.rpc<{ les_stoffreferanseomrader: unknown[] }>(
      bruker,
      'les_stoffreferanseomrader',
      { sidetilstand: 'utkast' },
    )
    expect(utkast).toEqual([])
  })

  it('gir HBUP referanseområdet fra kortet på Bupropion-siden, gjennom koblingen i registeret', async () => {
    expect(STOFFREGISTER.primartStoffFor('HBUP')?.slug).toBe('bupropion')
    const omrader = await brukerleser.lesReferanseomrader('publisert')
    expect(omrader.get('HBUP')).toEqual({ nedre: 100, ovre: 200, enhet: 'nmol/L', forbehold: '' })
    // Et stoff uten kobling gir ingen kode noe.
    expect([...omrader.values()].some((o) => o.ovre === 20)).toBe(false)
  })

  it('gir ikke OTRAM tramadolsidens kort, bare TRAM, som er stoffets hovedanalytt', async () => {
    expect(primareAnalytter('tramadol').map((a) => a.kode)).toEqual(['TRAM', 'OTRAM'])
    const omrader = await brukerleser.lesReferanseomrader('publisert')
    expect(omrader.get('TRAM')).toEqual({ nedre: null, ovre: 300, enhet: 'nmol/L', forbehold: '' })
    expect(omrader.has('OTRAM')).toBe(false)

    // Et eget kort for OTRAM på tramadolsiden gir koden sitt eget område.
    const otram = await lager.opprettUtkast('innholdselement', {
      infoside: ref.tramadol,
      panel: 'viktige_data',
      posisjon: 0,
      elementtype: 'referanseomrade',
      data: { nedre: null, ovre: 40, enhet: 'nmol/L', forbehold: '', gjelder: 'OTRAM' },
      referanser: [],
    })
    await publiser(otram)
    const etter = await brukerleser.lesReferanseomrader('publisert')
    expect(etter.get('OTRAM')).toMatchObject({ ovre: 40 })
    expect(etter.get('TRAM')).toMatchObject({ ovre: 300 })
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

describe('de faste kortene', () => {
  const tekst = (t: string) => dokument({ type: 'text', text: t })

  it('står én gang per side, panel og tilstand i hver seksjon med faste kort', async () => {
    const side = (await lager.opprettUtkast('infoside', { navn: 'Fastkortside' })).id
    const kort = (panel: string, tittel: string) =>
      lager.opprettUtkast('innholdselement', { infoside: side, panel, posisjon: 0, elementtype: 'kinetikkort', data: { tittel, dokument: tekst('Syntetisk.') } })

    for (const panel of PANELER_MED_FASTE_KORT) {
      const [forste, andre] = fasteKort(panelFor(panel)!)!
      await kort(panel, forste!)
      await expect(kort(panel, forste!), panel).rejects.toThrow()
      // Mellomrom rundt overskriften gjør det ikke til et annet kort.
      await expect(kort(panel, ` ${forste} `), panel).rejects.toThrow()
      await kort(panel, andre!)
    }
    // Uten faste kort kan samme overskrift stå flere ganger.
    await kort('farmakokinetikk', 'Absorpsjon')
    await kort('farmakokinetikk', 'Absorpsjon')
  })

  it('kjenner igjen kortet som sto i veien, så appen kan si at noen andre la det inn', async () => {
    const side = (await lager.opprettUtkast('infoside', { navn: 'Samtidig side' })).id
    const innhold = (panel: string, elementtype: string, data: Record<string, unknown>) => ({ infoside: side, panel, posisjon: 0, elementtype, data })
    const tilfeller = [
      innhold('graviditet_amming', 'kinetikkort', { tittel: 'Amming', dokument: tekst('Syntetisk.') }),
      innhold('dosering', 'riktekst', { dokument: tekst('Syntetisk.') }),
      innhold('viktige_data', 'referanseomrade', { nedre: 1, ovre: 2, enhet: 'nmol/L', gjelder: 'OTRAM' }),
    ]
    for (const endring of tilfeller) {
      await lager.opprettUtkast('innholdselement', endring)
      await expect(lager.opprettUtkast('innholdselement', endring)).rejects.toThrow()
      const utkast = await adminleser.lesStoffside('samtidig-side', 'utkast')
      expect(utkast.elementer.filter((e) => enkeltnokkel(e.innhold) === enkeltnokkel(endring)), endring.panel).toHaveLength(1)
    }
    // Et kort med fri overskrift, og et som er fjernet, står aldri i veien.
    expect(enkeltnokkel(innhold('farmakokinetikk', 'kinetikkort', { tittel: 'Absorpsjon' }))).toBeNull()
    expect(enkeltnokkel(innhold('fjernet', 'kinetikkort', { tittel: 'Amming' }))).toBeNull()
    // Mellomrom rundt overskriften gjør det ikke til et annet kort, som i databasen.
    expect(enkeltnokkel(innhold('graviditet_amming', 'kinetikkort', { tittel: ' Amming ' }))).toBe(enkeltnokkel(tilfeller[0]!))
  })

  it('lar et fast kort som er fjernet, legges til og publiseres på nytt', async () => {
    const side = await lager.opprettUtkast('infoside', { navn: 'Toksisk testmiddel' })
    const innhold = (t: string) => ({
      infoside: side.id,
      panel: 'toksisitet_forgiftning',
      posisjon: 5,
      elementtype: 'kinetikkort',
      data: { tittel: 'Behandling ved forgiftning', dokument: tekst(t) },
    })
    const gammelt = await lager.opprettUtkast('innholdselement', innhold('Det gamle.'))
    await publiser(side, gammelt)

    await lager.lagreUtkast(gammelt.id, 1, { ...innhold('Det gamle.'), panel: 'fjernet' })
    await lager.opprettUtkast('innholdselement', innhold('Det nye.'))
    const plan = publiseringsplan(await adminleser.lesStoffside('toksisk-testmiddel', 'utkast'), INGEN_REGLER)
    expect(plan[0]).toEqual({ slag: 'innholdselement', id: gammelt.id, revisjon: 2 })
    for (const steg of plan) await lager.publiserUtkast(steg.id, steg.revisjon)

    const modell = byggSidemodell(await brukerleser.lesStoffside('toksisk-testmiddel', 'publisert'))
    expect(modell.paneler.get('toksisitet_forgiftning')!.map((e) => e.data)).toEqual([
      { tittel: 'Behandling ved forgiftning', dokument: tekst('Det nye.') },
    ])
  })

  it('har de samme panelene i databasen som i paneler.ts', () => {
    const les = (fil: string) => readFileSync(new URL(`../../supabase/migrations/${fil}`, import.meta.url), 'utf8')
    const sql = migrasjonsfiler()
      .map(les)
      .filter((tekst) => tekst.includes('create unique index innholdselementer_fast_kort_idx'))
      .at(-1)!
    const liste = /panel in \(([^)]*)\)/.exec(sql.slice(sql.indexOf('create unique index innholdselementer_fast_kort_idx')))![1]!
    expect([...liste.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual([...PANELER_MED_FASTE_KORT].sort())
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

  it('finner fortsatt sider på navnet for eldre klienter (utgått)', async () => {
    const { finn_infosider: treff } = await kall.rpc<{ finn_infosider: { id: string }[] }>(admin, 'finn_infosider', {
      navn: ['testmiddel', 'BUPROPION', 'Ukjent'],
      sidetilstand: 'utkast',
    })
    expect(treff.map((t) => t.id).sort()).toEqual([ider.side, ref.bupropion].sort())
  })
})

describe('rettighetene', () => {
  it('lar bare innloggede lese, og ingen skrive gjennom lesingen', async () => {
    const har = async (sql: string, ...parametre: unknown[]) =>
      (await kall.fasit<{ har: boolean }>(`select ${sql} as har`, parametre))[0]!.har
    const funksjoner = [
      'public.les_stoff(text, public.objekttilstand)',
      'public.les_stoffer(public.objekttilstand)',
      'public.les_stoffliste(public.objekttilstand)',
      'public.les_stoffreferanseomrader(public.objekttilstand)',
      'public.stoffsider_som_json(uuid[], public.objekttilstand)',
      'public.les_referanser(public.objekttilstand)',
    ]
    for (const rolle of ['anon', 'authenticated', 'service_role']) {
      for (const funksjon of funksjoner) {
        expect(await har('has_function_privilege($1, $2, $3)', rolle, funksjon, 'EXECUTE'), `${rolle} ${funksjon}`).toBe(
          rolle === 'authenticated',
        )
      }
      expect(await har('has_function_privilege($1, $2, $3)', rolle, 'intern.stoffslug(text)', 'EXECUTE'), rolle).toBe(false)
      for (const rett of ['INSERT', 'UPDATE', 'DELETE']) {
        expect(await har('has_table_privilege($1, $2, $3)', rolle, 'public.objektutgaver', rett)).toBe(false)
      }
      expect(await har('has_table_privilege($1, $2, $3)', rolle, 'public.objektutgaver', 'SELECT')).toBe(rolle !== 'anon')
    }
    // Lesefunksjonene kjører med rettighetene til den som kaller, så
    // radsikkerheten gjelder også gjennom dem.
    const [rad] = await kall.fasit<{ definer: boolean }>(
      `select bool_or(prosecdef) as definer from pg_proc
       where proname in ('les_stoff', 'les_stoffer', 'les_stoffliste', 'les_stoffreferanseomrader',
                         'stoffsider_som_json', 'les_referanser', 'utgave_som_json')`,
    )
    expect(rad!.definer).toBe(false)
  })
})
