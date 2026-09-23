/**
 * THC-syreregelsettet i databasen: lagring, validering, publisering,
 * gjenoppretting, samtidighet og tilgang, prøvd mot en ekte Postgres bygd av
 * migrasjonene.
 *
 * Regelsettet som legges inn, er det som ble importert fra den opprinnelige
 * modulen, og importen er den samme SQL-en som datamigreringen kjørte mot
 * prosjektet.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import importert from '../domain/__tests__/fasit/thc-regelsett-import.json'
import { kurvefeil } from '../domain/thcMotor'
import { THC_TEKSTNOKLER, validerThcRegelsett, type ThcRegelsett } from '../domain/thcRegelsett'
import { thcImportSql } from '../../scripts/thc-import'
import {
  faginnholdskall,
  feilFra,
  kjorMigrasjoner,
  migrasjonsfiler,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const REGELSETT = importert as ThcRegelsett

let db: PGlite
let admin: string
let bruker: string
let k: Faginnholdskall
/** Regelsettet importen la inn. */
let id: string

/** Utkastet slik databasen gir det tilbake. */
async function utkastet(): Promise<{ revisjon: number; innhold: ThcRegelsett }> {
  const [rad] = await k.les<{ u: { revisjon: number; innhold: ThcRegelsett } }>(
    admin,
    `select public.les_thc_regelsett('utkast') as u`,
  )
  return rad!.u
}

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'admin.thc', fornavn: 'Ada', etternavn: 'Adminsen', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'vanlig.thc', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
  k = faginnholdskall(db, admin)
  await db.exec(thcImportSql('admin.thc'))
  const [rad] = await k.fasit<{ id: string }>(`select id from public.redigerbare_objekter where type = 'thc_regelsett'`)
  id = rad!.id
}, 60_000)

describe('importen', () => {
  it('er datamigreringen som ble kjørt mot prosjektet', () => {
    const [fil] = migrasjonsfiler().filter((f) => f.endsWith('_thc_regelsett_import.sql'))
    const tekst = readFileSync(`supabase/migrations/${fil}`, 'utf8')
    expect(tekst.replace(/^(--.*\n)+/, '')).toBe(thcImportSql('peohol') + '\n')
  })

  it('gjør ingenting i en database uten administratoren den er skrevet for', async () => {
    const tom = await nyDatabase()
    const { rows } = await tom.query(`select 1 from public.redigerbare_objekter where type = 'thc_regelsett'`)
    expect(rows).toHaveLength(0)
    await tom.close()
  })

  it('legger inn regelsettet nøyaktig slik det sto i koden, helt ned til siste siffer', async () => {
    const [rad] = await k.les<{ u: { innhold: ThcRegelsett; revisjon: number; publisert_revisjon: number } }>(
      bruker,
      `select public.les_thc_regelsett('publisert') as u`,
    )
    expect(rad!.u.innhold).toStrictEqual(REGELSETT)
    expect(rad!.u.revisjon).toBe(1)
    expect(rad!.u.publisert_revisjon).toBe(1)
    // Tallene er de samme flyttallene, ikke bare like når de skrives ut.
    expect(rad!.u.innhold.kurver.gul.a1).toBe(2 * 75.10642536264817)
    expect(rad!.u.innhold.konverteringsfaktor).toBe(344.451 / 1000)
  })

  it('er attribuert til administratoren som kjørte den', async () => {
    const [revisjon] = await k.revisjoner(id)
    expect(revisjon).toMatchObject({ revisjon: 1, handling: 'opprettet', utfort_av: admin, utfort_av_fornavn: 'Ada' })
    await k.forventSamsvar(id)
  })

  it('kan ikke kjøres to ganger: det finnes bare ett regelsett', async () => {
    const feil = await feilFra(() => db.exec(thcImportSql('admin.thc')))
    expect(feil?.message).toMatch(/finnes alt et THC-syreregelsett/)
  })
})

describe('rettingen av tall lagret med for få sifre', () => {
  /** Prosjektets tilstand: importen gjort før funksjonen fikk alle sifrene. */
  it('lagrer og publiserer regelsettet med alle sifrene, som en ny revisjon', async () => {
    const [retting] = migrasjonsfiler().filter((f) => f.endsWith('_thc_regelsett_flyttall.sql'))
    const gammel = await nyDatabase({ til: retting })
    const peder = await opprettBruker(gammel, { brukernavn: 'peohol', fornavn: 'Peder', etternavn: 'P', rolle: 'admin' })
    const g = faginnholdskall(gammel, peder)
    await gammel.exec(thcImportSql('peohol'))
    const [objekt] = await g.fasit<{ id: string }>(`select id from public.redigerbare_objekter where type = 'thc_regelsett'`)
    const publisert = async () =>
      (await g.les<{ u: { innhold: ThcRegelsett; revisjon: number } }>(peder, `select public.les_thc_regelsett('publisert') as u`))[0]!.u
    expect((await publisert()).innhold.kurver.gul.a1).not.toBe(REGELSETT.kurver.gul.a1)
    const forste = (await g.revisjoner(objekt!.id))[0]

    await kjorMigrasjoner(gammel, { fra: retting! })
    const rettet = await publisert()
    expect(rettet.innhold).toStrictEqual(REGELSETT)
    expect(rettet.revisjon).toBe(2)
    const alle = await g.revisjoner(objekt!.id)
    expect(alle[0]).toStrictEqual(forste)
    expect(alle[1]).toMatchObject({ handling: 'endret', utfort_av: peder })
    await g.forventSamsvar(objekt!.id)

    // Kjørt en gang til er det ingenting å rette.
    await kjorMigrasjoner(gammel, { fra: retting! })
    expect(await g.revisjoner(objekt!.id)).toHaveLength(2)
    await gammel.close()
  }, 60_000)
})

describe('lagring og publisering', () => {
  it('lagrer en endring som utkast uten å røre det publiserte', async () => {
    const { revisjon } = await utkastet()
    const endret = { ...REGELSETT, varsel_dager_mellom: 45 }
    const status = await k.lagre(id, revisjon, endret)
    expect(status.revisjon).toBe(revisjon + 1)
    expect(status.publisert_revisjon).toBe(1)
    expect((await utkastet()).innhold.varsel_dager_mellom).toBe(45)
    const [publisert] = await k.les<{ u: { innhold: ThcRegelsett } }>(bruker, `select public.les_thc_regelsett('publisert') as u`)
    expect(publisert!.u.innhold.varsel_dager_mellom).toBe(30)
    await k.forventSamsvar(id)
  })

  it('avviser en lagring mot en utdatert revisjon', async () => {
    const feil = await feilFra(() => k.lagre(id, 1, REGELSETT))
    expect(feil?.code).toBe('PT409')
  })

  it('gjenoppretter hele regelsettet på én gang, som en ny revisjon', async () => {
    const { revisjon } = await utkastet()
    const mye = {
      ...REGELSETT,
      konverteringsfaktor: 0.5,
      kurver: { ...REGELSETT.kurver, gronn: { ...REGELSETT.kurver.gronn, navn: 'Rask' } },
      konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n) => (n.nedre === 40 ? { ...n, nedre: 50 } : n)),
      tekster: { ...REGELSETT.tekster, uten_forrige: 'Ny prøve anbefales.' },
    }
    await k.lagre(id, revisjon, mye)
    expect((await utkastet()).innhold).toStrictEqual(mye)

    const status = await k.gjenopprett(id, revisjon + 1, 1)
    expect(status.revisjon).toBe(revisjon + 2)
    expect((await utkastet()).innhold).toStrictEqual(REGELSETT)
    const alle = await k.revisjoner(id)
    expect(alle.at(-1)).toMatchObject({ handling: 'gjenopprettet', gjenopprettet_fra: 1 })
    expect(alle.length).toBe(revisjon + 2)
    await k.forventSamsvar(id)
  })

  it('publiserer utkastet slik det står', async () => {
    const { revisjon } = await utkastet()
    await k.lagre(id, revisjon, { ...REGELSETT, standard_sikkerhetsmargin: 0.99 })
    await k.publiser(id, revisjon + 1)
    const [publisert] = await k.les<{ u: { innhold: ThcRegelsett } }>(bruker, `select public.les_thc_regelsett('publisert') as u`)
    expect(publisert!.u.innhold.standard_sikkerhetsmargin).toBe(0.99)
    await k.forventSamsvar(id)
    // Tilbake til det importerte, så de andre testene har samme utgangspunkt.
    await k.lagre(id, revisjon + 1, REGELSETT)
    await k.publiser(id, revisjon + 2)
  })
})

describe('tilgangen', () => {
  it('lar bare administratorer endre', async () => {
    const { revisjon } = await utkastet()
    expect((await feilFra(() => k.lagre(id, revisjon, REGELSETT, bruker)))?.code).toBe('42501')
    expect((await feilFra(() => k.publiser(id, revisjon, bruker)))?.code).toBe('42501')
    expect((await feilFra(() => k.opprett('thc_regelsett', REGELSETT, bruker)))?.code).toBe('42501')
  })

  it('viser vanlige brukere bare det publiserte, og anonyme ingenting', async () => {
    const [rad] = await k.les<{ u: unknown }>(bruker, `select public.les_thc_regelsett('utkast') as u`)
    expect(rad!.u).toBeNull()
    const rader = await k.les(bruker, `select * from public.thc_tekstbolker where tilstand = 'utkast'`)
    expect(rader).toEqual([])
    expect((await feilFra(() => k.les(null, `select public.les_thc_regelsett('publisert')`)))?.code).toBe('42501')
  })

  it('gir ingen skriverett på tabellene, heller ikke for administratorer', async () => {
    for (const tabell of ['thc_regelsett', 'thc_kurver', 'thc_tekstbolker', 'thc_konsentrasjonsnivaer']) {
      const feil = await feilFra(() => k.les(admin, `delete from public.${tabell}`))
      expect(feil?.code, tabell).toBe('42501')
    }
  })
})

describe('valideringen i databasen', () => {
  const med = (endring: Partial<ThcRegelsett>): ThcRegelsett => ({ ...REGELSETT, ...endring })
  const tekst = (nokkel: string, verdi: string) => med({ tekster: { ...REGELSETT.tekster, [nokkel]: verdi } })
  const byttetKurver = med({ kurver: { ...REGELSETT.kurver, gronn: REGELSETT.kurver.rod, rod: REGELSETT.kurver.gronn } })

  /**
   * Hvert ugyldige regelsett avvises både av appens validering og av
   * databasen, med en melding som kan vises.
   */
  const ugyldige: [string, ThcRegelsett][] = [
    ['konverteringsfaktor 0', med({ konverteringsfaktor: 0 })],
    ['negativ amplitude', med({ kurver: { ...REGELSETT.kurver, rod: { ...REGELSETT.kurver.rod, a1: -1 } } })],
    ['kurve uten navn', med({ kurver: { ...REGELSETT.kurver, gul: { ...REGELSETT.kurver.gul, navn: ' ' } } })],
    ['kurver i feil rekkefølge', byttetKurver],
    ['CV 1', med({ maleusikkerhet: { ...REGELSETT.maleusikkerhet, cv_kreatinin: 1 } })],
    ['faktor under 1', med({ maleusikkerhet: { ...REGELSETT.maleusikkerhet, faktor_under_cutoff: 0.5 } })],
    ['ingen marginer', med({ sikkerhetsmarginer: [] })],
    ['margin under 50 %', med({ sikkerhetsmarginer: [{ margin: 0.4, z: 0.2533471031357997 }, ...REGELSETT.sikkerhetsmarginer] })],
    ['feil z', med({ sikkerhetsmarginer: [{ margin: 0.5, z: 0 }, { margin: 0.9, z: -1.2815 }, { margin: 0.99, z: -2.3263478740408408 }] })],
    ['marginer ikke stigende', med({ sikkerhetsmarginer: [...REGELSETT.sikkerhetsmarginer].reverse() })],
    ['standard som ikke finnes', med({ standard_sikkerhetsmargin: 0.95 })],
    ['ingen nivåer', med({ konsentrasjonsnivaer: [] })],
    ['nivåer ikke stigende', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n) => (n.nedre === 40 ? { ...n, nedre: 15 } : n)) })],
    ['like skillepunkter', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n) => (n.nedre === 40 ? { ...n, nedre: 20 } : n)) })],
    ['laveste med grense', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n, i) => (i === 0 ? { ...n, nedre: 1 } : n)) })],
    ['skillepunkt mangler', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n, i) => (i === 1 ? { ...n, nedre: null } : n)) })],
    ['like navn', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n) => ({ ...n, navn: 'lav' })) })],
    ['bruksmønster i feil rekkefølge', med({ bruksmonstre: { ...REGELSETT.bruksmonstre, ikke_kronisk: { vanskelig_over: 'gul', nytt_inntak_over: 'gul' } } })],
    ['varsel 0', med({ varsel_dager_mellom: 0 })],
    ['tom tekst', tekst('pavisningstid', ' ')],
    ['mellomrom i enden', tekst('pavisningstid', 'Tekst. ')],
    ['dato mangler', tekst('ikke_nodvendigvis', 'Ikke nødvendigvis.')],
    ['nivå mangler', tekst('apning', 'THC-syre er påvist.')],
    ['dato der den ikke finnes', tekst('apning', 'Påvist i {nivå} siden {forrige prøvedato}.')],
    ['ukjent plassholder', tekst('nylig_inntak', 'Nylig {inntak}.')],
    ['løs krøllparentes', tekst('uten_forrige', 'Oppfølging {anbefales.')],
  ]

  it.each(ugyldige)('avviser %s, både i appen og i databasen', async (_, ugyldig) => {
    expect([...validerThcRegelsett(ugyldig), ...kurvefeil(ugyldig)].length).toBeGreaterThan(0)
    const { revisjon } = await utkastet()
    const feil = await feilFra(() => k.lagre(id, revisjon, ugyldig))
    expect(feil?.code).toBe('22023')
    expect(feil?.message).not.toBe('')
    // Ingenting er lagret.
    expect((await utkastet()).revisjon).toBe(revisjon)
  })

  it.each<[string, unknown]>([
    ['et ukjent felt', { ...REGELSETT, ekstra: 1 }],
    ['et manglende felt', { ...REGELSETT, tekster: undefined }],
    ['en tekstbolk som mangler', { ...REGELSETT, tekster: { ...REGELSETT.tekster, uten_forrige: undefined } }],
    ['tall som tekst', { ...REGELSETT, konverteringsfaktor: '0.3' }],
    ['en ukjent kurve i et bruksmønster', { ...REGELSETT, bruksmonstre: { ...REGELSETT.bruksmonstre, kronisk: { vanskelig_over: 'blaa', nytt_inntak_over: 'rod' } } }],
  ])('avviser %s', async (_, ugyldig) => {
    const { revisjon } = await utkastet()
    const feil = await feilFra(() => k.lagre(id, revisjon, JSON.parse(JSON.stringify(ugyldig)) as ThcRegelsett))
    expect(feil?.code).toBe('22023')
  })

  it('godtar en ny margin med z fra AS 241, og nye tekster og grenser', async () => {
    const { revisjon } = await utkastet()
    const nytt: ThcRegelsett = {
      ...REGELSETT,
      sikkerhetsmarginer: [...REGELSETT.sikkerhetsmarginer.slice(0, 2), { margin: 0.95, z: -1.6448536269514715 }, REGELSETT.sikkerhetsmarginer[2]!],
      konsentrasjonsnivaer: [...REGELSETT.konsentrasjonsnivaer, { navn: 'svært høy', nedre: 200, nylig_inntak: true }],
      tekster: { ...REGELSETT.tekster, nylig_inntak: 'Konsentrasjonen er {nivå}.' },
    }
    expect(validerThcRegelsett(nytt)).toEqual([])
    await k.lagre(id, revisjon, nytt)
    expect((await utkastet()).innhold).toStrictEqual(nytt)
    await k.lagre(id, revisjon + 1, REGELSETT)
  })

  it('har de samme tekstnøklene som appen', async () => {
    const [rad] = await k.fasit<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'thc_tekstbolker_nokkel'`,
    )
    for (const nokkel of THC_TEKSTNOKLER) expect(rad!.def).toContain(`'${nokkel}'`)
    expect(rad!.def.match(/'[a-z_]+'/g)).toHaveLength(THC_TEKSTNOKLER.length)
  })
})
