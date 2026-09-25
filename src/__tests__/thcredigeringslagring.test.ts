/**
 * Redigeringen av THC-syrereglene og -tekstene slik appen lagrer og
 * publiserer den, mot en ekte Postgres bygd av migrasjonene: endringene
 * `thcEndringer` gir, lagret som utkast, og publisert i den rekkefølgen
 * `publiseringsplan` sier. Vanlige brukere ser endringen først når alt er
 * publisert, og fortolkningen bruker den da.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { THC_KODE } from '../domain/thc'
import { fortolkThc, tomThcInndata } from '../domain/thcMotor'
import { normalkvantil } from '../domain/thcRegelsett'
import { publiseringsplan } from '../faginnhold/analyttside'
import { lagFaginnholdslager, Samtidighetskonflikt } from '../faginnhold/lagring'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { thcEndringer, thcReglerFra, thcUtkastFra, thcUtkastfeil } from '../faginnhold/thcregler'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const IMPORT = migrasjonsfiler().find((f) => f.endsWith('_thc_regelsett_import.sql'))!

let db: PGlite
let admin: Faginnholdsleser
let bruker: Faginnholdsleser
let lager: ReturnType<typeof lagFaginnholdslager>

beforeAll(async () => {
  db = await nyDatabase({ til: IMPORT })
  const peder = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Peder', etternavn: 'P', rolle: 'admin' })
  const vanlig = await opprettBruker(db, { brukernavn: 'vanlig.red', fornavn: 'Vera', etternavn: 'V', rolle: 'user' })
  await kjorMigrasjoner(db, { fra: IMPORT })
  const kall = faginnholdskall(db, peder)
  admin = lagFaginnholdsleser(kall.klientFor(peder))
  bruker = lagFaginnholdsleser(kall.klientFor(vanlig))
  lager = lagFaginnholdslager(kall.klientFor(peder))
}, 120_000)

/** Lagrer som `lagreThcRegelsett` i appen gjør. */
async function lagre(...[utgave, regler, tekster]: Parameters<typeof thcEndringer>) {
  const { kommentarer, regelsett } = thcEndringer(utgave, regler, tekster)
  for (const k of kommentarer) await lager.lagreUtkast(k.id, k.revisjon, k.innhold)
  if (regelsett) await lager.lagreUtkast(regelsett.id, regelsett.revisjon, regelsett.innhold)
}

describe('redigeringen av THC-syrereglene', () => {
  it('lagrer en tekst og en margin som utkast, og publiserer tekstene før reglene', async () => {
    const utkast = (await admin.lesThcRegelsett('utkast'))!
    const start = thcUtkastFra(utkast)!
    const publisertFor = await bruker.lesThcRegelsett('publisert')

    const tekster = { ...start.tekster, pavisningstid: `${start.tekster.pavisningstid} Syntetisk tillegg.` }
    const regler = {
      ...start.regler,
      sikkerhetsmarginer: start.regler.sikkerhetsmarginer.map((m) =>
        m.margin === 0.99 ? { margin: 0.95, z: normalkvantil(0.05) } : m,
      ),
    }
    expect(thcUtkastfeil(utkast, regler, tekster)).toEqual([])
    await lagre(utkast, regler, tekster)

    // Vanlige brukere ser fortsatt det publiserte.
    expect(await bruker.lesThcRegelsett('publisert')).toStrictEqual(publisertFor)

    const side = await admin.lesAnalyttside(THC_KODE, 'utkast')
    const plan = publiseringsplan(side)
    expect(plan.map((s) => s.slag)).toEqual(['kommentar', 'thc_regelsett'])
    for (const steg of plan) await lager.publiserUtkast(steg.id, steg.revisjon)

    const hentet = thcReglerFra({ status: 'klar', data: await bruker.lesThcRegelsett('publisert') }, () => {})
    if (hentet.status !== 'klar') throw new Error('Reglene skal kunne brukes.')
    expect(hentet.modell.regler.sikkerhetsmarginer.map((m) => m.margin)).toEqual([0.5, 0.9, 0.95])
    const resultat = fortolkThc(
      { ...tomThcInndata(hentet.modell.regler), ingenTidligere: true, aktuellVerdi: '10' },
      hentet.modell,
    )
    expect(resultat.type === 'kommentar' && resultat.kommentar).toContain('Syntetisk tillegg.')
    expect(publiseringsplan(await admin.lesAnalyttside(THC_KODE, 'utkast'))).toEqual([])
  })

  it('gir en konflikt når noen andre har lagret i mellomtiden, og skriver ikke over', async () => {
    const apnet = (await admin.lesThcRegelsett('utkast'))!
    const start = thcUtkastFra(apnet)!
    await lagre(apnet, { ...start.regler, varsel_dager_mellom: 25 }, start.tekster)

    const mine = { ...start.regler, varsel_dager_mellom: 40 }
    await expect(lagre(apnet, mine, start.tekster)).rejects.toBeInstanceOf(Samtidighetskonflikt)
    expect((await admin.lesThcRegelsett('utkast'))!.regelsett.innhold.varsel_dager_mellom).toBe(25)
  })
})
