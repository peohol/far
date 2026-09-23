/**
 * Referanseområdene steg 2 viser under analyttnavnet, lest fra
 * informasjonssidene i en ekte database (`les_referanseomrader`).
 *
 * Det som prøves: at hver kode får kortet «Referanseområde» på hovedsiden
 * sin, at radsikkerheten gjelder (vanlige brukere ser bare det publiserte),
 * at et kort som er tatt bort, eller et annet kort i «Viktige data», ikke
 * teller, og at en endring på siden slår ut i steg 2 når den publiseres.
 *
 * Navnene, kodene og tallene er syntetiske.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { grensepiller } from '../domain/piller'
import { lagFaginnholdslager, type Faginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import type { Objektstatus } from '../faginnhold/modell'
import { FJERNET } from '../faginnhold/paneler'
import type { Analyte } from '../types'
import { faginnholdskall, nyDatabase, opprettBruker } from './hjelp/testdatabase'

let adminleser: Faginnholdsleser
let brukerleser: Faginnholdsleser
let lager: Faginnholdslager
const ider = { side: '', annen: '', kort: '', annetKort: '' }

function kort(infoside: string, elementtype: string, data: Record<string, unknown>, panel = 'viktige_data') {
  return lager.opprettUtkast('innholdselement', { infoside, panel, posisjon: 0, elementtype, data, referanser: [] })
}

async function publiser(...objekter: Objektstatus[]) {
  for (const { id, revisjon } of objekter) await lager.publiserUtkast(id, revisjon!)
}

beforeAll(async () => {
  const db = await nyDatabase()
  const admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
  const kall = faginnholdskall(db, admin)
  adminleser = lagFaginnholdsleser(kall.klientFor(admin))
  brukerleser = lagFaginnholdsleser(kall.klientFor(bruker))
  lager = lagFaginnholdslager(kall.klientFor(admin))

  const side = await lager.opprettUtkast('infoside', { navn: 'Testmiddel' })
  const annen = await lager.opprettUtkast('infoside', { navn: 'Annetmiddel' })
  ider.side = side.id
  ider.annen = annen.id
  // To koder med samme hovedside, og én uten kortet.
  const analytter = await Promise.all([
    lager.opprettUtkast('laboratorieanalytt', { kode: 'TESTSUM', hovedside: side.id, komponenter: [side.id] }),
    lager.opprettUtkast('laboratorieanalytt', { kode: 'TEST', hovedside: side.id, komponenter: [side.id] }),
    lager.opprettUtkast('laboratorieanalytt', { kode: 'ANNET', hovedside: annen.id, komponenter: [annen.id] }),
  ])
  const referanseomrade = await kort(side.id, 'referanseomrade', { nedre: 10, ovre: 20, enhet: 'nmol/L', forbehold: 'Syntetisk.' })
  ider.kort = referanseomrade.id
  const toksisk = await kort(side.id, 'toksisk_omrade', { nedre: 90, ovre: null, enhet: 'nmol/L', forbehold: '' })
  // Et referanseområde som er tatt bort fra den andre siden, teller ikke.
  const fjernet = await kort(annen.id, 'referanseomrade', { nedre: 1, ovre: 2, enhet: 'nmol/L', forbehold: '' }, FJERNET)
  ider.annetKort = fjernet.id
  await publiser(side, annen, ...analytter, referanseomrade, toksisk, fjernet)
}, 60_000)

describe('les_referanseomrader', () => {
  it('gir referanseområdet på hovedsiden for hver kode som har det', async () => {
    const omrader = await brukerleser.lesReferanseomrader('publisert')
    expect([...omrader]).toEqual([
      ['TEST', { nedre: 10, ovre: 20, enhet: 'nmol/L', forbehold: 'Syntetisk.' }],
      ['TESTSUM', { nedre: 10, ovre: 20, enhet: 'nmol/L', forbehold: 'Syntetisk.' }],
    ])
  })

  it('gir en vanlig bruker ingenting av utkastet', async () => {
    expect([...(await brukerleser.lesReferanseomrader('utkast'))]).toEqual([])
    expect([...(await adminleser.lesReferanseomrader('utkast'))].map(([kode]) => kode)).toEqual(['TEST', 'TESTSUM'])
  })

  it('følger siden: en endring gjelder i steg 2 først når den er publisert', async () => {
    const analyte = { kode: 'TESTSUM', enhet: 'nmol/L' } as Analyte
    const pille = async (tilstand: 'utkast' | 'publisert') =>
      grensepiller(analyte, null, (await adminleser.lesReferanseomrader(tilstand)).get('TESTSUM') ?? null)[0]?.verdi

    const endret = await lager.lagreUtkast(ider.kort, 1, {
      infoside: ider.side,
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
  })

  it('tar ikke med et kort uten tall', async () => {
    const tomt = await lager.lagreUtkast(ider.annetKort, 1, {
      infoside: ider.annen,
      panel: 'viktige_data',
      posisjon: 0,
      elementtype: 'referanseomrade',
      data: { nedre: null, ovre: null, enhet: '', forbehold: '' },
      referanser: [],
    })
    await publiser(tomt)
    expect((await brukerleser.lesReferanseomrader('publisert')).has('ANNET')).toBe(false)
  })
})
