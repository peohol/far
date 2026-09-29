/**
 * Referanseområdene steg 2 viser under analyttnavnet, lest fra stoffsidene i
 * en ekte database slik appen leser dem: kortene per stoff
 * (`les_stoffreferanseomrader`), knyttet til analyttkodene gjennom koblingene
 * i stoffregisteret (`referanseomraderPerAnalytt`).
 *
 * Det som prøves: at hver kode får kortet «Referanseområde» på siden til sitt
 * primære stoff — hovedanalytten kortet uten `gjelder`, de andre kodene bare
 * kortet merket med koden — at radsikkerheten gjelder (vanlige brukere ser
 * bare det publiserte), at et kort som er tatt bort, et annet kort i «Viktige
 * data», et kort uten tall eller et kort på siden til et stoff koden bare er
 * sekundært koblet til, ikke teller, og at en endring på siden slår ut i steg
 * 2 når den publiseres.
 *
 * Stoffene er de i stoffregisteret (Tramadol med TRAM og OTRAM, Bupropion med
 * HBUP, Nortriptylin med NOR, og som sekundært stoff for AMTNORSUM), men
 * tallene er syntetiske.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { grensepiller } from '../domain/piller'
import { referanseomraderPerAnalytt, type Stoffreferanseomrade } from '../domain/koblinger'
import { STOFFREGISTER } from '../domain/stoffregister'
import { lagFaginnholdslager, type Faginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import type { Objektstatus } from '../faginnhold/modell'
import { FJERNET } from '../faginnhold/paneler'
import type { Analyte } from '../types'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

let kall: Faginnholdskall
let bruker: string
let adminleser: Faginnholdsleser
let brukerleser: Faginnholdsleser
let lager: Faginnholdslager
const ider = { tramadol: '', bupropion: '', kort: '', fjernet: '' }

const SYNTETISK = { nedre: 10, ovre: 20, enhet: 'nmol/L', forbehold: 'Syntetisk.' }
const OTRAM = { nedre: null, ovre: 5, enhet: 'nmol/L', forbehold: '', gjelder: 'OTRAM' }

function kort(infoside: string, elementtype: string, data: Record<string, unknown>, panel = 'viktige_data') {
  return lager.opprettUtkast('innholdselement', { infoside, panel, posisjon: 0, elementtype, data, referanser: [] })
}

async function publiser(...objekter: Objektstatus[]) {
  for (const { id, revisjon } of objekter) await lager.publiserUtkast(id, revisjon!)
}

beforeAll(async () => {
  const db = await nyDatabase()
  const admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  adminleser = lagFaginnholdsleser(kall.klientFor(admin))
  brukerleser = lagFaginnholdsleser(kall.klientFor(bruker))
  lager = lagFaginnholdslager(kall.klientFor(admin))

  const tramadol = await lager.opprettUtkast('infoside', { navn: 'Tramadol' })
  const bupropion = await lager.opprettUtkast('infoside', { navn: 'Bupropion' })
  const nortriptylin = await lager.opprettUtkast('infoside', { navn: 'Nortriptylin' })
  const utenKobling = await lager.opprettUtkast('infoside', { navn: 'Testmiddel' })
  ider.tramadol = tramadol.id
  ider.bupropion = bupropion.id

  // Tramadolsiden: kortet for hovedanalytten TRAM, og et eget for metabolitten OTRAM.
  const referanseomrade = await kort(tramadol.id, 'referanseomrade', SYNTETISK)
  ider.kort = referanseomrade.id
  const otram = await kort(tramadol.id, 'referanseomrade', OTRAM)
  const toksisk = await kort(tramadol.id, 'toksisk_omrade', { nedre: 90, ovre: null, enhet: 'nmol/L', forbehold: '' })
  // Et referanseområde som er tatt bort fra bupropionsiden, teller ikke.
  const fjernet = await kort(bupropion.id, 'referanseomrade', { nedre: 1, ovre: 2, enhet: 'nmol/L', forbehold: '' }, FJERNET)
  ider.fjernet = fjernet.id
  // Nortriptylinsiden: NOR sitt kort. AMTNORSUM er bare sekundært koblet til nortriptylin.
  const nor = await kort(nortriptylin.id, 'referanseomrade', { nedre: 30, ovre: 60, enhet: 'nmol/L', forbehold: '' })
  // Et stoff registeret ikke kobler til noen analytt, gir ingen kode noe.
  const ukoblet = await kort(utenKobling.id, 'referanseomrade', { nedre: 7, ovre: 8, enhet: 'nmol/L', forbehold: '' })
  await publiser(tramadol, bupropion, nortriptylin, utenKobling, referanseomrade, otram, toksisk, fjernet, nor, ukoblet)
}, 60_000)

describe('lesReferanseomrader', () => {
  it('bygger på koblingene i stoffregisteret', () => {
    expect(STOFFREGISTER.analytterFor('tramadol').map((k) => [k.kode, k.primar])).toEqual([
      ['TRAM', true],
      ['OTRAM', true],
    ])
    expect(STOFFREGISTER.primartStoffFor('AMTNORSUM')?.slug).toBe('amitriptylin')
    expect(STOFFREGISTER.primartStoffFor('NOR')?.slug).toBe('nortriptylin')
    expect(STOFFREGISTER.primartStoffFor('HBUP')?.slug).toBe('bupropion')
  })

  it('gir hver kode kortet på siden til sitt primære stoff: hovedanalytten det uten koden, de andre sitt eget', async () => {
    const omrader = await brukerleser.lesReferanseomrader('publisert')
    expect([...omrader].sort(([a], [b]) => a.localeCompare(b))).toEqual([
      ['NOR', { nedre: 30, ovre: 60, enhet: 'nmol/L', forbehold: '' }],
      ['OTRAM', { nedre: null, ovre: 5, enhet: 'nmol/L', forbehold: '' }],
      ['TRAM', SYNTETISK],
    ])
  })

  it('får kortene fra databasen per stoff, og knytter dem til kodene i appen', async () => {
    const { les_stoffreferanseomrader: kortene } = await kall.rpc<{ les_stoffreferanseomrader: Stoffreferanseomrade[] }>(
      bruker,
      'les_stoffreferanseomrader',
      { sidetilstand: 'publisert' },
    )
    expect(kortene.map((k) => [k.stoff, k.gjelder])).toEqual([
      ['nortriptylin', null],
      ['testmiddel', null],
      ['tramadol', null],
      ['tramadol', 'OTRAM'],
    ])
    expect([...referanseomraderPerAnalytt(kortene).keys()].sort()).toEqual(['NOR', 'OTRAM', 'TRAM'])
  })

  it('gir en sumanalyse ikke kortet på siden til et stoff den bare er sekundært koblet til', async () => {
    expect((await brukerleser.lesReferanseomrader('publisert')).has('AMTNORSUM')).toBe(false)
  })

  it('gir en vanlig bruker ingenting av utkastet', async () => {
    expect([...(await brukerleser.lesReferanseomrader('utkast'))]).toEqual([])
    expect([...(await adminleser.lesReferanseomrader('utkast'))].map(([kode]) => kode).sort()).toEqual([
      'NOR',
      'OTRAM',
      'TRAM',
    ])
  })

  it('følger siden: en endring gjelder i steg 2 først når den er publisert', async () => {
    const analyte = { kode: 'TRAM', enhet: 'nmol/L' } as Analyte
    const pille = async (tilstand: 'utkast' | 'publisert') =>
      grensepiller(analyte, null, (await adminleser.lesReferanseomrader(tilstand)).get('TRAM') ?? null)[0]?.verdi

    const endret = await lager.lagreUtkast(ider.kort, 1, {
      infoside: ider.tramadol,
      panel: 'viktige_data',
      posisjon: 0,
      elementtype: 'referanseomrade',
      data: { nedre: 12, ovre: 25, enhet: 'nmol/L', forbehold: '' },
      referanser: [],
    })
    expect(await pille('utkast')).toBe('12 – 25 nmol/L')
    expect(await pille('publisert')).toBe('10 – 20 nmol/L')

    await publiser(endret)
    expect(await pille('publisert')).toBe('12 – 25 nmol/L')
    // Metabolitten beholder sitt eget.
    expect((await brukerleser.lesReferanseomrader('publisert')).get('OTRAM')).toMatchObject({ ovre: 5 })
  })

  it('tar ikke med et kort uten tall', async () => {
    const tomt = await lager.lagreUtkast(ider.fjernet, 1, {
      infoside: ider.bupropion,
      panel: 'viktige_data',
      posisjon: 0,
      elementtype: 'referanseomrade',
      data: { nedre: null, ovre: null, enhet: '', forbehold: '' },
      referanser: [],
    })
    await publiser(tomt)
    const { les_stoffreferanseomrader: kortene } = await kall.rpc<{ les_stoffreferanseomrader: Stoffreferanseomrade[] }>(
      bruker,
      'les_stoffreferanseomrader',
      { sidetilstand: 'publisert' },
    )
    // Kortet står nå på siden, men har ingen tall å vise.
    expect(kortene.some((k) => k.stoff === 'bupropion')).toBe(true)
    expect((await brukerleser.lesReferanseomrader('publisert')).has('HBUP')).toBe(false)
  })
})
