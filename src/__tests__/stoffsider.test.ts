/**
 * Stoffsider uten analyttkode, prøvd mot en ekte database: lesingen etter
 * navn, lista til sidemenyen, lesingen til søket i hele kunnskapsbasen og
 * adressene treffene peker på.
 *
 * En stoffside uten kode er en informasjonsside som verken er hovedside eller
 * komponent for noen analytt. Navnene og tekstene er syntetiske. Ingen
 * kliniske verdier inngår.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggSidemodell, publiseringsplan } from '../faginnhold/analyttside'
import { indekserKunnskapsbase, lagSideleser, lesKunnskapsbase } from '../faginnhold/globaltSok'
import { lagFaginnholdslager, type Faginnholdslager } from '../faginnhold/lagring'
import { TOM_SIDE, lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { SITERING } from '../faginnhold/referanser'
import { indekserSide, lagSokeindeks, sokGlobalt, sokeadresse } from '../faginnhold/sok'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

let db: PGlite
let kall: Faginnholdskall
let admin: string
let bruker: string
let adminleser: Faginnholdsleser
let brukerleser: Faginnholdsleser
let lager: Faginnholdslager
const ider = { a: '', b: '', stoff: '', kort: '', hoved: '', metabolitt: '' }

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

  // Et stoff uten kode, med et kort som siterer den ene kilden og et panel som siterer den andre.
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

  // En sumanalyse: hovedsiden og komponenten er ikke stoffsider uten kode.
  ider.hoved = (await lager.opprettUtkast('infoside', { navn: 'Testmiddel' })).id
  ider.metabolitt = (await lager.opprettUtkast('infoside', { navn: 'Desmetyltestmiddel' })).id
  await lager.opprettUtkast('laboratorieanalytt', {
    kode: 'TESTSUM',
    hovedside: ider.hoved,
    komponenter: [ider.hoved, ider.metabolitt],
  })
}, 60_000)

describe('les_stoffside', () => {
  it('gir administratoren hele utkastet for stoffet, uten analytt', async () => {
    const side = await adminleser.lesStoffside('teststoff', 'utkast')
    expect(side.analytt).toBeNull()
    expect(side.infoside).toMatchObject({ id: ider.stoff, innhold: { navn: 'Teststoff' }, publisert_revisjon: null })
    expect(side.elementer.map((e) => e.id)).toEqual([ider.kort])
    expect(side.komponenter).toEqual([])
    expect(side.referanser.map((r) => r.id).sort()).toEqual([ider.a, ider.b].sort())
    expect(side.regelsett).toBeNull()
  })

  it('gir siden for koden når navnet er hovedside for en analytt', async () => {
    const side = await adminleser.lesStoffside('Testmiddel', 'utkast')
    expect(side.analytt?.innhold.kode).toBe('TESTSUM')
    expect(side).toEqual({ ...(await adminleser.lesAnalyttside('TESTSUM', 'utkast')), regelsett: null })
  })

  it('gir en tom side for et navn ingen side har, og ingenting av utkastet til andre', async () => {
    expect(await adminleser.lesStoffside('Finnesikke', 'utkast')).toEqual(TOM_SIDE)
    expect(await brukerleser.lesStoffside('Teststoff', 'utkast')).toEqual(TOM_SIDE)
    expect(await brukerleser.lesStoffside('Teststoff', 'publisert')).toEqual(TOM_SIDE)
    await expect(kall.rpc(null, 'les_stoffside', { sidenavn: 'Teststoff', sidetilstand: 'publisert' })).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('les_stoffsidenavn', () => {
  it('lister bare sidene som verken er hovedside eller komponent', async () => {
    expect(await adminleser.lesStoffsidenavn('utkast')).toEqual(['Teststoff'])
    expect(await brukerleser.lesStoffsidenavn('utkast')).toEqual([])
    expect(await brukerleser.lesStoffsidenavn('publisert')).toEqual([])
  })

  it('tar med en ny stoffside, og slipper den når stoffet får en kode', async () => {
    const ny = (await lager.opprettUtkast('infoside', { navn: 'Annetstoff' })).id
    expect(await adminleser.lesStoffsidenavn('utkast')).toEqual(['Annetstoff', 'Teststoff'])
    await lager.opprettUtkast('laboratorieanalytt', { kode: 'ANNET', hovedside: ny, komponenter: [ny] })
    expect(await adminleser.lesStoffsidenavn('utkast')).toEqual(['Teststoff'])
  })
})

describe('når stoffsiden er publisert', () => {
  beforeAll(async () => {
    const plan = publiseringsplan(await adminleser.lesStoffside('Teststoff', 'utkast'))
    expect(plan.map((s) => s.slag)).toEqual(['referanse', 'referanse', 'infoside', 'innholdselement'])
    for (const steg of plan) await lager.publiserUtkast(steg.id, steg.revisjon)
  })

  it('ser alle innloggede den', async () => {
    expect(await brukerleser.lesStoffsidenavn('publisert')).toEqual(['Teststoff'])
    const side = await brukerleser.lesStoffside('Teststoff', 'publisert')
    expect(side.infoside).toMatchObject({ id: ider.stoff, publisert_revisjon: 1 })
    expect(side.referanser.map((r) => r.innhold.tittel).sort()).toEqual(['Kilde A', 'Kilde B'])
  })

  it('gir les_stoffsider hver side på samme form som les_stoffside', async () => {
    const sider = await lagSideleser(kall.klientFor(bruker)).lesStoffsider('publisert')
    expect(sider).toEqual([await brukerleser.lesStoffside('Teststoff', 'publisert')])
  })

  it('finnes i søket i hele kunnskapsbasen, med adresse etter navnet', async () => {
    const base = await lesKunnskapsbase(lagSideleser(kall.klientFor(bruker)), null)
    const dokumenter = indekserKunnskapsbase(base)
    const paStoffet = dokumenter.filter((d) => d.sted.side.navn === 'Teststoff')

    // De samme dokumentene som søket på siden selv, og ingen kode.
    const side = await brukerleser.lesStoffside('Teststoff', 'publisert')
    expect(paStoffet).toEqual(indekserSide({ navn: 'Teststoff', komponenter: [] }, byggSidemodell(side)))
    expect(paStoffet.some((d) => d.felt === 'kode')).toBe(false)

    const [treff] = sokGlobalt(lagSokeindeks(dokumenter), 'teststoff neste dose')
    expect(sokeadresse(treff!.dokument.sted)).toBe(`#/stoff/Teststoff/tdm/${ider.kort}`)
  })
})
