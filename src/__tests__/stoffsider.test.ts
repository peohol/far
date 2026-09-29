/**
 * Stoffsidene slik appen leser dem, prøvd mot en ekte database: hver fagside
 * er en side om et stoff, funnet etter stoffets nøkkel (`les_stoff`) — aldri
 * etter navnet eller gjennom en laboratorieanalytt — lista stoffregisteret
 * slår sammen med sine egne stoffer (`les_stoffliste`), lesingen til søket i
 * hele kunnskapsbasen (`les_stoffer`) og adressene treffene peker på.
 *
 * Tre sider: et stoff registeret ikke kjenner («Teststoff»), et stoff i
 * registeret som er koblet til en analytt (Bupropion, med HBUP), og en gammel
 * komponentside med navnet til et alias for det («Hydroksybupropion»), som
 * ikke er et eget stoff. Tekstene og tallene er syntetiske. Ingen kliniske
 * verdier inngår.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggSidemodell, publiseringsplan } from '../faginnhold/stoffside'
import { indekserKunnskapsbase, lagSideleser, lesKunnskapsbase } from '../faginnhold/globaltSok'
import { lagFaginnholdslager, type Faginnholdslager } from '../faginnhold/lagring'
import { INGEN_REGLER, TOM_STOFFSIDE, lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { SITERING } from '../faginnhold/referanser'
import { indekserSide, lagSokeindeks, sokGlobalt, sokeadresse, stoffidentitet } from '../faginnhold/sok'
import { ANDRE_STOFFER, byggStoffregister } from '../domain/stoffregister'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

let db: PGlite
let kall: Faginnholdskall
let admin: string
let bruker: string
let adminleser: Faginnholdsleser
let brukerleser: Faginnholdsleser
let lager: Faginnholdslager
const ider = { a: '', b: '', stoff: '', kort: '', bupropion: '', tekst: '', komponentside: '' }

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

  // Et stoff registeret ikke kjenner, med et kort som siterer den ene kilden og et panel som siterer den andre.
  ider.stoff = (await lager.opprettUtkast('infoside', { navn: 'Teststoff', panelreferanser: { tdm: [ider.b] } })).id
  ider.kort = (
    await lager.opprettUtkast('innholdselement', {
      infoside: ider.stoff,
      panel: 'tdm',
      posisjon: 0,
      elementtype: 'kinetikkort',
      data: {
        tittel: 'Prøvetakingstidspunkt',
        dokument: dokument({ type: 'text', text: 'Syntetisk: før neste dose.' }, { type: SITERING, attrs: { referanser: [ider.a] } }),
      },
    })
  ).id

  // Et stoff i registeret, koblet til analytten HBUP der — ikke i databasen.
  ider.bupropion = (await lager.opprettUtkast('infoside', { navn: 'Bupropion' })).id
  ider.tekst = (
    await lager.opprettUtkast('innholdselement', {
      infoside: ider.bupropion,
      panel: 'farmakodynamikk',
      posisjon: 0,
      elementtype: 'riktekst',
      data: { dokument: dokument({ type: 'text', text: 'Syntetisk virkningsbeskrivelse.' }) },
    })
  ).id

  // En gammel komponentside med navnet til et alias for Bupropion.
  ider.komponentside = (await lager.opprettUtkast('infoside', { navn: 'Hydroksybupropion' })).id
}, 60_000)

describe('les_stoff', () => {
  it('gir administratoren hele utkastet for stoffet, etter nøkkelen', async () => {
    const side = await adminleser.lesStoffside('teststoff', 'utkast')
    expect(Object.keys(side).sort()).toEqual(['elementer', 'infoside', 'referanser', 'stoff'])
    expect(side.stoff).toEqual({ id: ider.stoff, slug: 'teststoff', navn: 'Teststoff' })
    expect(side.infoside).toMatchObject({ id: ider.stoff, innhold: { navn: 'Teststoff' }, publisert_revisjon: null })
    expect(side.elementer.map((e) => e.id)).toEqual([ider.kort])
    expect(side.referanser.map((r) => r.id).sort()).toEqual([ider.a, ider.b].sort())
  })

  it('finner siden for et stoff med analytt etter stoffets nøkkel, aldri etter koden eller navnet', async () => {
    const side = await adminleser.lesStoffside('bupropion', 'utkast')
    expect(side.stoff).toEqual({ id: ider.bupropion, slug: 'bupropion', navn: 'Bupropion' })
    expect(side.elementer.map((e) => e.id)).toEqual([ider.tekst])
    expect(await adminleser.lesStoffside('HBUP', 'utkast')).toEqual(TOM_STOFFSIDE)
    expect(await adminleser.lesStoffside('hbup', 'utkast')).toEqual(TOM_STOFFSIDE)
    expect(await adminleser.lesStoffside('Bupropion', 'utkast')).toEqual(TOM_STOFFSIDE)
    // Aliasets side er sin egen side, ikke Bupropion.
    expect((await adminleser.lesStoffside('hydroksybupropion', 'utkast')).stoff?.id).toBe(ider.komponentside)
  })

  it('gir en tom side for en nøkkel ingen side har, og ingenting av utkastet til andre', async () => {
    expect(await adminleser.lesStoffside('finnesikke', 'utkast')).toEqual(TOM_STOFFSIDE)
    expect(await brukerleser.lesStoffside('teststoff', 'utkast')).toEqual(TOM_STOFFSIDE)
    expect(await brukerleser.lesStoffside('teststoff', 'publisert')).toEqual(TOM_STOFFSIDE)
    await expect(kall.rpc(null, 'les_stoff', { stoff: 'teststoff', sidetilstand: 'publisert' })).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('les_stoffliste', () => {
  it('gir ID-en, nøkkelen og navnet til hver side, alfabetisk, uansett analytt', async () => {
    expect(await adminleser.lesStoffliste('utkast')).toEqual([
      { id: ider.bupropion, slug: 'bupropion', navn: 'Bupropion' },
      { id: ider.komponentside, slug: 'hydroksybupropion', navn: 'Hydroksybupropion' },
      { id: ider.stoff, slug: 'teststoff', navn: 'Teststoff' },
    ])
    expect(await brukerleser.lesStoffliste('utkast')).toEqual([])
    expect(await brukerleser.lesStoffliste('publisert')).toEqual([])
  })

  it('gir stoffregisteret et nytt stoff, og ingen egen side for et alias', async () => {
    const register = byggStoffregister(await adminleser.lesStoffliste('utkast'))
    expect(register.finn('teststoff')).toEqual({ slug: 'teststoff', navn: 'Teststoff', aliaser: [] })
    expect(register.kategorierFor('teststoff')).toEqual([{ kategori: ANDRE_STOFFER }])
    expect(register.kategorier.find((k) => k.navn === ANDRE_STOFFER)?.stoffer.map((s) => s.slug)).toEqual(['teststoff'])
    // Bupropion er stoffet i registeret, med analytten koblet til der.
    expect(register.finn('bupropion')?.navn).toBe('Bupropion')
    expect(register.analytterFor('bupropion').map((k) => k.kode)).toContain('HBUP')
    // Den gamle komponentsiden er ikke et eget stoff: navnet fører til Bupropion.
    expect(register.finn('hydroksybupropion')).toBeUndefined()
    expect(register.kanonisk('Hydroksybupropion')?.slug).toBe('bupropion')
  })

  it('tar med en ny side med en gang, med nøkkelen navnet gir', async () => {
    const ny = (await lager.opprettUtkast('infoside', { navn: 'Annet stoff' })).id
    expect(await adminleser.lesStoffliste('utkast')).toEqual([
      { id: ny, slug: 'annet-stoff', navn: 'Annet stoff' },
      { id: ider.bupropion, slug: 'bupropion', navn: 'Bupropion' },
      { id: ider.komponentside, slug: 'hydroksybupropion', navn: 'Hydroksybupropion' },
      { id: ider.stoff, slug: 'teststoff', navn: 'Teststoff' },
    ])
  })
})

describe('når sidene er publisert', () => {
  beforeAll(async () => {
    for (const slug of ['teststoff', 'bupropion', 'hydroksybupropion']) {
      const plan = publiseringsplan(await adminleser.lesStoffside(slug, 'utkast'), INGEN_REGLER)
      if (slug === 'teststoff') {
        expect(plan.map((s) => s.slag)).toEqual(['referanse', 'referanse', 'infoside', 'innholdselement'])
      }
      for (const steg of plan) await lager.publiserUtkast(steg.id, steg.revisjon)
    }
  })

  it('ser alle innloggede dem', async () => {
    expect((await brukerleser.lesStoffliste('publisert')).map((s) => s.slug)).toEqual([
      'bupropion',
      'hydroksybupropion',
      'teststoff',
    ])
    const side = await brukerleser.lesStoffside('teststoff', 'publisert')
    expect(side.infoside).toMatchObject({ id: ider.stoff, publisert_revisjon: 1 })
    expect(side.referanser.map((r) => r.innhold.tittel).sort()).toEqual(['Kilde A', 'Kilde B'])
  })

  it('gir les_stoffer hver side på samme form som les_stoff', async () => {
    const sider = await lagSideleser(kall.klientFor(bruker)).lesStoffsider('publisert')
    expect(sider).toEqual([
      await brukerleser.lesStoffside('bupropion', 'publisert'),
      await brukerleser.lesStoffside('hydroksybupropion', 'publisert'),
      await brukerleser.lesStoffside('teststoff', 'publisert'),
    ])
  })

  it('finnes i søket i hele kunnskapsbasen, med adresse etter stoffets nøkkel', async () => {
    const base = await lesKunnskapsbase(lagSideleser(kall.klientFor(bruker)), null)
    const dokumenter = indekserKunnskapsbase(base)
    const paStoffet = dokumenter.filter((d) => d.sted.side.stoff === 'teststoff')

    // De samme dokumentene som søket på siden selv, og ingen kode.
    const side = await brukerleser.lesStoffside('teststoff', 'publisert')
    expect(paStoffet).toEqual(
      indekserSide(stoffidentitet({ slug: 'teststoff', navn: 'Teststoff' }, []), byggSidemodell(side)),
    )
    expect(paStoffet.some((d) => d.felt === 'kode')).toBe(false)

    const [treff] = sokGlobalt(lagSokeindeks(dokumenter), 'teststoff neste dose')
    expect(sokeadresse(treff!.dokument.sted)).toBe(`#/stoff/teststoff/tdm/${ider.kort}`)
  })

  it('fører analyttkoden og aliaset til stoffet, og indekserer ikke aliasets gamle side for seg', async () => {
    const base = await lesKunnskapsbase(lagSideleser(kall.klientFor(bruker)), null)
    const indeks = lagSokeindeks(indekserKunnskapsbase(base))
    expect(indeks.dokumenter.some((d) => d.sted.side.stoff === 'hydroksybupropion')).toBe(false)

    const [kode] = sokGlobalt(indeks, 'HBUP')
    expect(kode!.dokument.sted.side).toEqual({ stoff: 'bupropion', navn: 'Bupropion' })
    expect(sokeadresse(kode!.dokument.sted)).toBe('#/stoff/bupropion')
    const [alias] = sokGlobalt(indeks, 'hydroksybupropion')
    expect(alias!.dokument.sted.side.stoff).toBe('bupropion')

    const [tekst] = sokGlobalt(indeks, 'virkningsbeskrivelse')
    expect(sokeadresse(tekst!.dokument.sted)).toBe('#/stoff/bupropion/farmakodynamikk')
  })
})
