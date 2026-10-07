/**
 * Redigeringen av THC-syrereglene og -tekstene slik appen lagrer og
 * publiserer den, mot en ekte Postgres bygd av migrasjonene: endringene
 * `thcEndringer` gir, lagret som utkast, og publisert i den rekkefølgen
 * `regelplan` sier. Vanlige brukere ser endringen først når alt er
 * publisert, og fortolkningen bruker den da.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { THC_KODE } from '../domain/thc'
import { fortolkThc, tomThcInndata } from '../domain/thcMotor'
import { normalkvantil } from '../domain/thcRegelsett'
import { regelplan } from '../faginnhold/stoffside'
import { lagFaginnholdslager, Samtidighetskonflikt } from '../faginnhold/lagring'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { lagreThcUtkast, thcEndringer, thcReglerFra, thcUtkastFra, thcUtkastfeil } from '../faginnhold/thcregler'
import { lesRegeldata } from './hjelp/regeldata'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker, som } from './hjelp/testdatabase'

const IMPORT = migrasjonsfiler().find((f) => f.endsWith('_thc_regelsett_import.sql'))!

let db: PGlite
let admin: Faginnholdsleser
let bruker: Faginnholdsleser
let lager: ReturnType<typeof lagFaginnholdslager>
let peder: string

beforeAll(async () => {
  db = await nyDatabase({ til: IMPORT })
  peder = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Peder', etternavn: 'P', rolle: 'admin' })
  const vanlig = await opprettBruker(db, { brukernavn: 'vanlig.red', fornavn: 'Vera', etternavn: 'V', rolle: 'user' })
  await kjorMigrasjoner(db, { fra: IMPORT })
  const kall = faginnholdskall(db, peder)
  admin = lagFaginnholdsleser(kall.klientFor(peder))
  bruker = lagFaginnholdsleser(kall.klientFor(vanlig))
  lager = lagFaginnholdslager(kall.klientFor(peder))
}, 120_000)

/** Lagrer med den samme funksjonen som `lagreThcRegelsett` i appen. */
async function lagre(...[utgave, regler, tekster]: Parameters<typeof thcEndringer>) {
  await lagreThcUtkast(lager, utgave, { regler, tekster })
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

    // Reglene redigeres og publiseres på fortolkningssiden for THC-syre (IRCAK).
    const plan = regelplan(await lesRegeldata(admin, THC_KODE, 'utkast'))
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
    expect(regelplan(await lesRegeldata(admin, THC_KODE, 'utkast'))).toEqual([])
  })

  it('gir en konflikt når noen andre har lagret i mellomtiden, og skriver ikke over', async () => {
    const apnet = (await admin.lesThcRegelsett('utkast'))!
    const start = thcUtkastFra(apnet)!
    await lagre(apnet, { ...start.regler, varsel_dager_mellom: 25 }, start.tekster)

    const mine = { ...start.regler, varsel_dager_mellom: 40 }
    await expect(lagre(apnet, mine, start.tekster)).rejects.toBeInstanceOf(Samtidighetskonflikt)
    expect((await admin.lesThcRegelsett('utkast'))!.regelsett.innhold.varsel_dager_mellom).toBe(25)
  })

  it('lagrer over deres når brukeren har sammenlignet, og bare det som er forskjellig fra deres', async () => {
    const apnet = (await admin.lesThcRegelsett('utkast'))!
    const start = thcUtkastFra(apnet)!
    // Noen andre endrer reglene og en tekst mens brukeren endrer reglene.
    const deres = { ...start.tekster, pavisningstid: `${start.tekster.pavisningstid} Deres tillegg.` }
    await lagre(apnet, { ...start.regler, varsel_dager_mellom: 28 }, deres)
    const mine = { ...start.regler, varsel_dager_mellom: 35 }
    await expect(lagre(apnet, mine, start.tekster)).rejects.toBeInstanceOf(Samtidighetskonflikt)

    // «Lagre mine over deres», etter sammenligningen: mot det nyeste, så
    // resultatet er nøyaktig brukerens utkast, også teksten de endret.
    const nyeste = (await admin.lesThcRegelsett('utkast'))!
    await lagre(nyeste, mine, start.tekster)
    const etter = (await admin.lesThcRegelsett('utkast'))!
    expect(thcUtkastFra(etter)).toStrictEqual({ regler: mine, tekster: start.tekster })
    // Tekstene som var like deres, fikk ingen ny revisjon.
    const revisjoner = (u: typeof etter) => Object.fromEntries(u.kommentarer.map((k) => [k.id, k.revisjon]))
    const endret = Object.entries(revisjoner(etter)).filter(([id, rev]) => revisjoner(nyeste)[id] !== rev)
    expect(endret.map(([id]) => id)).toEqual([nyeste.regelsett.innhold.tekstbolker.pavisningstid])
  })
})

describe('lagringen i én transaksjon', () => {
  it('lagrer ingenting ved en konflikt, heller ikke tekstene, så «Forkast» forkaster hele redigeringen', async () => {
    const apnet = (await admin.lesThcRegelsett('utkast'))!
    const start = thcUtkastFra(apnet)!
    // Noen andre lagrer reglene i mellomtiden.
    await lagre(apnet, { ...start.regler, varsel_dager_mellom: 26 }, start.tekster)
    const deres = (await admin.lesThcRegelsett('utkast'))!

    const tekster = { ...start.tekster, apning: `${start.tekster.apning} Syntetisk.` }
    await expect(lagre(apnet, { ...start.regler, varsel_dager_mellom: 27 }, tekster)).rejects.toBeInstanceOf(
      Samtidighetskonflikt,
    )
    expect(await admin.lesThcRegelsett('utkast')).toStrictEqual(deres)
  })

  it('gir en konflikt også når bare en tekst er endret og noen andre har lagret reglene', async () => {
    const apnet = (await admin.lesThcRegelsett('utkast'))!
    const start = thcUtkastFra(apnet)!
    await lagre(apnet, { ...start.regler, varsel_dager_mellom: 29 }, start.tekster)
    const deres = (await admin.lesThcRegelsett('utkast'))!

    const tekster = { ...start.tekster, apning: `${start.tekster.apning} Syntetisk.` }
    await expect(lagre(apnet, start.regler, tekster)).rejects.toBeInstanceOf(Samtidighetskonflikt)
    expect(await admin.lesThcRegelsett('utkast')).toStrictEqual(deres)
  })
})

describe('de låste delene', () => {
  const KURVENE_ER_LAST = 'Utskillelseskurvene er låst og kan bare endres i koden.'
  const FAKTOREN_ER_LAST = 'Konverteringsfaktoren er låst og kan bare endres i koden.'

  /** Kjører et kall slik en migrasjon gjør det, med kontrollen av de låste delene slått av. */
  async function somMigrasjon(sql: string, parametre: unknown[]) {
    await som(db, peder, async (tx) => {
      await tx.query(`select set_config('far.endre_thc_laste_deler', 'ja', true)`)
      await tx.query(sql, parametre)
    })
  }

  it('kan ikke endres ved lagring, heller ikke rett mot databasen', async () => {
    const utgave = (await admin.lesThcRegelsett('utkast'))!
    const { id, revisjon, innhold } = utgave.regelsett
    const kurver = { ...innhold.kurver, rod: { ...innhold.kurver.rod, k2: innhold.kurver.rod.k2 * 2 } }
    await expect(lager.lagreUtkast(id, revisjon, { ...innhold, kurver })).rejects.toThrow(KURVENE_ER_LAST)
    const navn = { ...innhold.kurver, gronn: { ...innhold.kurver.gronn, navn: 'Annen' } }
    await expect(lager.lagreUtkast(id, revisjon, { ...innhold, kurver: navn })).rejects.toThrow(KURVENE_ER_LAST)
    await expect(
      lager.lagreUtkast(id, revisjon, { ...innhold, konverteringsfaktor: innhold.konverteringsfaktor + 0.1 }),
    ).rejects.toThrow(FAKTOREN_ER_LAST)
    expect(await admin.lesThcRegelsett('utkast')).toStrictEqual(utgave)
  })

  it('kan ikke publiseres eller gjenopprettes fra et utkast eller en revisjon som har andre', async () => {
    const publisert = await bruker.lesThcRegelsett('publisert')
    const { id, revisjon, innhold } = (await admin.lesThcRegelsett('utkast'))!.regelsett
    const kurver = { ...innhold.kurver, gul: { ...innhold.kurver.gul, a1: innhold.kurver.gul.a1 + 1 } }
    // Et utkast med andre kurver, slik et utkast fra før låsen kunne ha.
    await somMigrasjon('select public.lagre_utkast($1, $2, $3)', [id, revisjon, JSON.stringify({ ...innhold, kurver })])
    const avvikende = (await admin.lesThcRegelsett('utkast'))!.regelsett.revisjon

    await expect(lager.publiserUtkast(id, avvikende)).rejects.toThrow(KURVENE_ER_LAST)
    expect(await bruker.lesThcRegelsett('publisert')).toStrictEqual(publisert)

    // Revisjonen før kan gjenopprettes; den med de andre kurvene kan ikke.
    await lager.gjenopprettRevisjon(id, avvikende, revisjon)
    const gjenopprettet = (await admin.lesThcRegelsett('utkast'))!
    expect(gjenopprettet.regelsett.innhold).toStrictEqual(innhold)
    await expect(lager.gjenopprettRevisjon(id, gjenopprettet.regelsett.revisjon, avvikende)).rejects.toThrow(
      KURVENE_ER_LAST,
    )
  })

  it('endres i koden, med en migrasjon som slår av kontrollen for sin egen transaksjon', async () => {
    const { id, revisjon, innhold } = (await admin.lesThcRegelsett('utkast'))!.regelsett
    const kurver = { ...innhold.kurver, rod: { ...innhold.kurver.rod, navn: 'Svært treg utskillelse' } }
    await somMigrasjon('select public.lagre_utkast($1, $2, $3)', [id, revisjon, JSON.stringify({ ...innhold, kurver })])
    await somMigrasjon('select public.publiser_utkast($1, $2)', [id, revisjon + 1])
    expect((await bruker.lesThcRegelsett('publisert'))!.regelsett.innhold.kurver).toStrictEqual(kurver)
    // Kontrollen gjelder igjen etterpå, nå mot de nye kurvene.
    await expect(lager.lagreUtkast(id, revisjon + 1, innhold)).rejects.toThrow(KURVENE_ER_LAST)
  })
})
