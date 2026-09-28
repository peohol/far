/**
 * Metabolittsidene som slås sammen med moderstoffets side
 * (`src/faginnhold/sammenslatte.ts`), i en ekte database: at analytten får
 * moderstoffets side som hovedside, at datakortene flyttes med koden de
 * gjelder, at like kort tas bort og ulike kinetikkort flyttes, at
 * referanseområdet steg 2 viser, fortsatt er kodens eget, og at migrasjonen
 * ikke gjør noe når den kjøres igjen.
 *
 * Navnene, kodene og tallene er syntetiske.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagFaginnholdslager, type Faginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import type { Objektstatus } from '../faginnhold/modell'
import { ELEMENTTYPER, FJERNET } from '../faginnhold/paneler'
import { SAMMENSLAINGSKILDE, sammenslaingSql } from '../faginnhold/sammenslatte'
import { faginnholdskall, feilFra, migrasjonsfiler, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

const SAMMENSLATTE = { Testmetabolitt: 'Testmoderstoff' }
const MIGRASJONSFIL = migrasjonsfiler().find((f) => f.endsWith('_sammenslatte_stoffsider.sql'))!

let db: PGlite
let kall: Faginnholdskall
let lager: Faginnholdslager
let leser: Faginnholdsleser
const ider = { moder: '', metabolitt: '', analytt: '', likt: '', ulikt: '', fritekst: '' }

const antall = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n
const revisjoner = () => antall('select count(*)::int as n from public.objektrevisjoner')

function kort(infoside: string, panel: string, elementtype: string, data: Record<string, unknown>, posisjon = 0) {
  return lager.opprettUtkast('innholdselement', { infoside, panel, posisjon, elementtype, data, referanser: [] })
}

async function publiser(...objekter: Objektstatus[]) {
  for (const { id, revisjon } of objekter) await lager.publiserUtkast(id, revisjon!)
}

const omrade = (ovre: number) => ({ nedre: null, ovre, enhet: 'nmol/L', forbehold: '' })
const dokument = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })
const kinetikk = (tittel: string, tekst: string) => ({ tittel, dokument: dokument(tekst) })

beforeAll(async () => {
  db = await nyDatabase()
  const admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  lager = lagFaginnholdslager(kall.klientFor(admin))
  leser = lagFaginnholdsleser(kall.klientFor(bruker))

  const moder = await lager.opprettUtkast('infoside', { navn: 'Testmoderstoff' })
  const metabolitt = await lager.opprettUtkast('infoside', { navn: 'Testmetabolitt' })
  ider.moder = moder.id
  ider.metabolitt = metabolitt.id
  const analytter = [
    await lager.opprettUtkast('laboratorieanalytt', { kode: 'TMOD', hovedside: moder.id, komponenter: [moder.id] }),
    await lager.opprettUtkast('laboratorieanalytt', { kode: 'TMET', hovedside: metabolitt.id, komponenter: [metabolitt.id] }),
  ]
  ider.analytt = analytter[1]!.id
  const kortene = [
    await kort(moder.id, 'viktige_data', 'referanseomrade', omrade(3000)),
    await kort(moder.id, 'tdm', ELEMENTTYPER.kinetikk, kinetikk('Metode', 'Samme tekst.')),
    await kort(metabolitt.id, 'viktige_data', 'referanseomrade', omrade(400)),
    await kort(metabolitt.id, 'tdm', ELEMENTTYPER.kinetikk, kinetikk('Metode', 'Samme tekst.')),
    await kort(metabolitt.id, 'tdm', ELEMENTTYPER.kinetikk, kinetikk('Referansegrense', 'Bare for metabolitten.'), 1),
    await kort(metabolitt.id, 'farmakodynamikk', ELEMENTTYPER.riktekst, { dokument: dokument('Virker likt.') }),
  ]
  ider.likt = kortene[3]!.id
  ider.ulikt = kortene[4]!.id
  ider.fritekst = kortene[5]!.id
  await publiser(moder, metabolitt, ...analytter, ...kortene)

  await db.exec(sammenslaingSql('redaktor', SAMMENSLATTE))
}, 120_000)

describe('migrasjonen', () => {
  it('er den samme som generatoren gir for sidene i stoffregisteret', () => {
    const fil = readFileSync(new URL(`../../supabase/migrations/${MIGRASJONSFIL}`, import.meta.url), 'utf8')
    expect(fil).toBe(sammenslaingSql('peohol'))
  })
})

describe('sammenslåingen i databasen', () => {
  it('gir metabolittens kode moderstoffets side, og lar metabolittsiden stå som komponent', async () => {
    const side = await leser.lesAnalyttside('TMET', 'publisert')
    expect(side.infoside?.innhold.navn).toBe('Testmoderstoff')
    expect(side.analytt?.innhold).toMatchObject({ hovedside: ider.moder, komponenter: [ider.metabolitt] })
    expect(side.analytt?.kilde).toBe(SAMMENSLAINGSKILDE)
  })

  it('flytter datakortet med koden det gjelder, så begge kodene beholder sitt eget referanseområde', async () => {
    const side = await leser.lesAnalyttside('TMOD', 'publisert')
    const omrader = side.elementer
      .filter((e) => e.innhold.elementtype === 'referanseomrade')
      .map((e) => [e.innhold.data.gjelder ?? null, e.innhold.data.ovre])
    expect(omrader.sort()).toEqual([['TMET', 400], [null, 3000]].sort())
    expect([...(await leser.lesReferanseomrader('publisert'))].map(([kode, o]) => [kode, o.ovre])).toEqual([
      ['TMET', 400],
      ['TMOD', 3000],
    ])
  })

  it('tar bort et kort som står likt på moderstoffets side, og flytter et ulikt kinetikkort sist, med metabolitten i tittelen', async () => {
    const side = await leser.lesAnalyttside('TMOD', 'publisert')
    const tdm = side.elementer.filter((e) => e.innhold.panel === 'tdm').sort((a, b) => a.innhold.posisjon - b.innhold.posisjon)
    expect(tdm.map((e) => [e.id, e.innhold.data.tittel])).toEqual([
      [expect.any(String), 'Metode'],
      [ider.ulikt, 'Referansegrense for Testmetabolitt'],
    ])
    const likt = await db.query<{ panel: string }>("select panel from public.innholdselementer where objekt_id = $1 and tilstand = 'publisert'", [ider.likt])
    expect(likt.rows[0]!.panel).toBe(FJERNET)
  })

  it('lar et annet kort stå på metabolittsiden', async () => {
    const rad = await db.query<{ infoside_id: string; panel: string }>(
      "select infoside_id, panel from public.innholdselementer where objekt_id = $1 and tilstand = 'publisert'",
      [ider.fritekst],
    )
    expect(rad.rows[0]).toEqual({ infoside_id: ider.metabolitt, panel: 'farmakodynamikk' })
  })

  it('gjør ingenting når den kjøres igjen', async () => {
    const for_ = await revisjoner()
    await db.exec(sammenslaingSql('redaktor', SAMMENSLATTE))
    expect(await revisjoner()).toBe(for_)
  })

  it('lar ikke en side ha to datakort av samme slag for samme kode', async () => {
    const nytt = (gjelder: string) => ({
      infoside: ider.moder,
      panel: 'viktige_data',
      posisjon: 0,
      elementtype: 'referanseomrade',
      data: { ...omrade(1), gjelder },
      referanser: [],
    })
    expect((await feilFra(() => kall.opprett('innholdselement', nytt('TMET'))))?.code).toBe('23505')
    expect(await feilFra(() => kall.opprett('innholdselement', nytt('TANNEN')))).toBeNull()
  })
})
