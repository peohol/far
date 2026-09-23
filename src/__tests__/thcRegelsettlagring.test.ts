/**
 * THC-syreregelsettet i databasen: lagring, validering, publisering,
 * gjenoppretting, samtidighet og tilgang, prøvd mot en ekte Postgres bygd av
 * migrasjonene.
 *
 * Databasen bygges slik prosjektet ble det: regelsettet importeres med
 * tekstene i seg, tallene rettes, og tekstene flyttes så ut som egne
 * kommentarer. Det som prøves, er altså resultatet av de samme migrasjonene
 * som ble kjørt mot prosjektet, med administratoren de er skrevet for.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import importert from '../domain/__tests__/fasit/thc-regelsett-import.json'
import importerteTekster from '../domain/__tests__/fasit/thc-tekster-import.json'
import type { Kommentarinnhold } from '../domain/kommentarobjekt'
import { sammenlign, type Kurve } from '../domain/thcKurver'
import { lagThcModell } from '../domain/thcMotor'
import { validerThcRegelsett, visIrcak, type ThcRegelsett } from '../domain/thcRegelsett'
import {
  THC_TEKSTBOLKER,
  THC_TEKSTNOKLER,
  thcTeksterFra,
  validerThcTekstbolk,
  type ThcRegelsettinnhold,
  type ThcTekstbolker,
  type ThcTekster,
} from '../domain/thcTekster'
import {
  faginnholdskall,
  feilFra,
  kjorMigrasjoner,
  migrasjonsfiler,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const REGLER = importert as ThcRegelsett
const TEKSTER = importerteTekster as ThcTekster

/** Den første migrasjonen som legger inn data: importen av regelsettet. */
const IMPORT = migrasjonsfiler().find((f) => f.endsWith('_thc_regelsett_import.sql'))!

let db: PGlite
let peder: string
let bruker: string
let k: Faginnholdskall
/** Regelsettet migrasjonene la inn. */
let id: string
/** Kommentarene tekstene ble flyttet til. */
let BOLKER: ThcTekstbolker
/** Regelsettet slik det står etter migrasjonene. */
let REGELSETT: ThcRegelsettinnhold

interface Utgave<T> {
  id: string
  revisjon: number
  publisert_revisjon: number | null
  innhold: T
}

/** Regelsettet i en tilstand, slik appen leser det. */
async function regelsettet(tilstand: 'utkast' | 'publisert', som = peder) {
  const [rad] = await k.les<{ u: Utgave<ThcRegelsettinnhold> | null }>(
    som,
    `select public.les_thc_regelsett($1) as u`,
    [tilstand],
  )
  return rad!.u!
}

/** Kommentarene med disse ID-ene i en tilstand, etter ID. */
async function kommentarene(ider: string[], tilstand: 'utkast' | 'publisert' = 'publisert') {
  const [rad] = await k.les<{ k: Utgave<Kommentarinnhold>[] }>(
    peder,
    `select public.les_kommentarer($1, $2) as k`,
    [tilstand, ider],
  )
  return new Map(rad!.k.map((u) => [u.id, u]))
}

/** Tekstene regelsettet bruker, slått opp i de publiserte kommentarene. */
async function tekstene(bolker: ThcTekstbolker): Promise<ThcTekster> {
  const oppslag = await kommentarene(Object.values(bolker))
  const svar = thcTeksterFra(bolker, new Map([...oppslag].map(([kid, u]) => [kid, u.innhold.tekst])))
  if (!svar.ok) throw new Error(svar.feil.join(' '))
  return svar.tekster
}

/** En ny, publisert kommentar. */
async function nyKommentar(tekst: string, plassholdere: string[] = [], publiser = true) {
  const status = await k.opprett('kommentar', { navn: 'Testtekst', tekst, plassholdere })
  if (publiser) await k.publiser(status.id, status.revisjon!)
  return status.id
}

beforeAll(async () => {
  db = await nyDatabase({ til: IMPORT })
  peder = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Peder', etternavn: 'P', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'vanlig.thc', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
  await kjorMigrasjoner(db, { fra: IMPORT })
  k = faginnholdskall(db, peder)
  const publisert = await regelsettet('publisert')
  id = publisert.id
  BOLKER = publisert.innhold.tekstbolker
  REGELSETT = { ...REGLER, tekstbolker: BOLKER }
}, 120_000)

/* --- Det migrasjonene la inn ---------------------------------------------- */

describe('regelsettet etter migrasjonene', () => {
  it('er reglene fra koden, helt ned til siste siffer, publisert', async () => {
    const { innhold, revisjon, publisert_revisjon } = await regelsettet('publisert', bruker)
    const { tekstbolker, ...regler } = innhold
    expect(regler).toStrictEqual(REGLER)
    expect(Object.keys(tekstbolker).sort()).toEqual([...THC_TEKSTNOKLER].sort())
    expect(new Set(Object.values(tekstbolker)).size).toBe(THC_TEKSTNOKLER.length)
    expect([revisjon, publisert_revisjon]).toEqual([3, 3])
    // Tallene er de samme flyttallene, ikke bare like når de skrives ut.
    expect(regler.kurver.gul.a1).toBe(2 * 75.10642536264817)
    expect(regler.konverteringsfaktor).toBe(344.451 / 1000)
    await k.forventSamsvar(id)
  })

  it('har tekstene fra koden som publiserte kommentarer, én per bolk', async () => {
    expect(await tekstene(BOLKER)).toStrictEqual(TEKSTER)
    const kommentarer = await kommentarene(Object.values(BOLKER))
    for (const nokkel of THC_TEKSTNOKLER) {
      const { innhold, revisjon, publisert_revisjon } = kommentarer.get(BOLKER[nokkel])!
      expect(innhold.navn).toBe(`THC-syre: ${THC_TEKSTBOLKER[nokkel].tittel}`)
      expect(validerThcTekstbolk(nokkel, innhold.plassholdere)).toEqual([])
      expect([revisjon, publisert_revisjon]).toEqual([1, 1])
      await k.forventSamsvar(BOLKER[nokkel])
    }
  })

  it('gir motoren nøyaktig de reglene og tekstene fasiten er laget med', async () => {
    const { innhold } = await regelsettet('publisert', bruker)
    const { tekstbolker, ...regler } = innhold
    const modell = lagThcModell(regler, await tekstene(tekstbolker))
    expect(modell.ok).toBe(true)
    if (modell.ok) {
      expect({ ...modell.modell.regler }).toStrictEqual(REGLER)
      expect({ ...modell.modell.tekster }).toStrictEqual(TEKSTER)
    }
  })

  it('har historikken urørt: importen, rettingen av tallene og flyttingen av tekstene', async () => {
    const [importen, rettingen, flyttingen] = await k.revisjoner(id)
    expect([importen?.handling, rettingen?.handling, flyttingen?.handling]).toEqual(['opprettet', 'endret', 'endret'])
    for (const r of [importen, rettingen, flyttingen]) expect(r?.utfort_av).toBe(peder)
    // Importen fikk 15 sifre; rettingen alle. Begge har tekstene i seg.
    expect((importen!.innhold as { kurver: ThcRegelsett['kurver'] }).kurver.gul.a1).not.toBe(REGLER.kurver.gul.a1)
    const { tekster, ...reglene } = rettingen!.innhold as unknown as ThcRegelsett & { tekster: ThcTekster }
    expect(reglene).toStrictEqual(REGLER)
    expect(tekster).toStrictEqual(TEKSTER)
    expect(flyttingen!.innhold).toStrictEqual(REGELSETT)
  })

  it('ble importert fra de samme reglene og tekstene som fasiten', () => {
    const fil = readFileSync(`supabase/migrations/${IMPORT}`, 'utf8')
    const json = /\$json\$(.*)\$json\$/s.exec(fil)![1]!
    expect(JSON.parse(json)).toStrictEqual({ ...REGLER, tekster: TEKSTER })
  })

  it('gjør ingenting i en database uten administratoren de er skrevet for', async () => {
    const tom = await nyDatabase()
    const { rows } = await tom.query(
      `select 1 from public.redigerbare_objekter where type in ('thc_regelsett', 'kommentar')`,
    )
    expect(rows).toHaveLength(0)
    await tom.close()
  }, 60_000)
})

/* --- Lagring og publisering ----------------------------------------------- */

describe('lagring og publisering', () => {
  it('lagrer en endring som utkast uten å røre det publiserte', async () => {
    const { revisjon } = await regelsettet('utkast')
    const status = await k.lagre(id, revisjon, { ...REGELSETT, varsel_dager_mellom: 45 })
    expect(status.revisjon).toBe(revisjon + 1)
    expect((await regelsettet('utkast')).innhold.varsel_dager_mellom).toBe(45)
    expect((await regelsettet('publisert', bruker)).innhold.varsel_dager_mellom).toBe(30)
    await k.lagre(id, revisjon + 1, REGELSETT)
    await k.forventSamsvar(id)
  })

  it('avviser en lagring mot en utdatert revisjon', async () => {
    expect((await feilFra(() => k.lagre(id, 1, REGELSETT)))?.code).toBe('PT409')
  })

  it('gjenoppretter hele regelsettet på én gang, som en ny revisjon', async () => {
    const annen = await nyKommentar('Ny prøve anbefales.')
    const { revisjon } = await regelsettet('utkast')
    const mye: ThcRegelsettinnhold = {
      ...REGELSETT,
      konverteringsfaktor: 0.5,
      kurver: { ...REGELSETT.kurver, gronn: { ...REGELSETT.kurver.gronn, navn: 'Rask' } },
      konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n) => (n.nedre === 40 ? { ...n, nedre: 50 } : n)),
      tekstbolker: { ...BOLKER, uten_forrige: annen },
    }
    await k.lagre(id, revisjon, mye)
    expect((await regelsettet('utkast')).innhold).toStrictEqual(mye)

    const status = await k.gjenopprett(id, revisjon + 1, revisjon)
    expect(status.revisjon).toBe(revisjon + 2)
    expect((await regelsettet('utkast')).innhold).toStrictEqual(REGELSETT)
    expect((await k.revisjoner(id)).at(-1)).toMatchObject({ handling: 'gjenopprettet', gjenopprettet_fra: revisjon })
    await k.forventSamsvar(id)
  })

  it('gjenoppretter en revisjon fra før tekstene ble kommentarer, med kommentarene regelsettet har nå', async () => {
    const { revisjon } = await regelsettet('utkast')
    await k.lagre(id, revisjon, { ...REGELSETT, varsel_dager_mellom: 60 })
    await k.gjenopprett(id, revisjon + 1, 2)
    const { innhold } = await regelsettet('utkast')
    expect(innhold).toStrictEqual(REGELSETT)
    // Revisjon 2 står som den sto, med tekstene i seg.
    expect((await k.revisjoner(id))[1]!.innhold).toHaveProperty('tekster')
    await k.forventSamsvar(id)
  })

  it('publiserer ikke et regelsett som peker på en kommentar som ikke er publisert', async () => {
    const upublisert = await nyKommentar('Oppfølging anbefales.', [], false)
    const { revisjon } = await regelsettet('utkast')
    await k.lagre(id, revisjon, { ...REGELSETT, tekstbolker: { ...BOLKER, uten_forrige: upublisert } })
    const feil = await feilFra(() => k.publiser(id, revisjon + 1))
    expect(feil?.message).toBe('Koblingen kommentar_id peker på noe som ikke er publisert. Publiser det først.')
    expect((await regelsettet('publisert', bruker)).innhold).toStrictEqual(REGELSETT)

    await k.publiser(upublisert, 1)
    await k.publiser(id, revisjon + 1)
    expect((await regelsettet('publisert', bruker)).innhold.tekstbolker.uten_forrige).toBe(upublisert)
    await k.lagre(id, revisjon + 1, REGELSETT)
    await k.publiser(id, revisjon + 2)
  })

  it('lar en tekst rettes og publiseres uten å røre reglene, men ikke miste en plassholder bolken trenger', async () => {
    const apning = BOLKER.apning
    const regler = await regelsettet('publisert')
    const rettet = 'THC-syre er påvist i {nivå} konsentrasjon.'
    await k.lagre(apning, 1, { navn: 'THC-syre: Åpning', tekst: rettet, plassholdere: ['{nivå}'] })
    await k.publiser(apning, 2)
    expect((await tekstene(BOLKER)).apning).toBe(rettet)
    expect(await regelsettet('publisert')).toStrictEqual(regler)

    const uten = await feilFra(() =>
      k.lagre(apning, 2, { navn: 'THC-syre: Åpning', tekst: 'THC-syre er påvist.', plassholdere: [] }),
    )
    expect(uten?.message).toBe('Plassholderne i en kommentar kan ikke endres. Lag en ny kommentar i stedet.')

    await k.gjenopprett(apning, 2, 1)
    await k.publiser(apning, 3)
    expect(await tekstene(BOLKER)).toStrictEqual(TEKSTER)
  })
})

/* --- Tilgangen ------------------------------------------------------------ */

describe('tilgangen', () => {
  it('lar bare administratorer endre', async () => {
    const { revisjon } = await regelsettet('utkast')
    expect((await feilFra(() => k.lagre(id, revisjon, REGELSETT, bruker)))?.code).toBe('42501')
    expect((await feilFra(() => k.publiser(id, revisjon, bruker)))?.code).toBe('42501')
    expect((await feilFra(() => k.opprett('thc_regelsett', REGELSETT, bruker)))?.code).toBe('42501')
  })

  it('viser vanlige brukere bare det publiserte, og anonyme ingenting', async () => {
    const [rad] = await k.les<{ u: unknown }>(bruker, `select public.les_thc_regelsett('utkast') as u`)
    expect(rad!.u).toBeNull()
    expect(await k.les(bruker, `select * from public.thc_tekstbolker where tilstand = 'utkast'`)).toEqual([])
    expect((await feilFra(() => k.les(null, `select public.les_thc_regelsett('publisert')`)))?.code).toBe('42501')
  })

  it('gir ingen skriverett på tabellene, heller ikke for administratorer', async () => {
    for (const tabell of ['thc_regelsett', 'thc_kurver', 'thc_tekstbolker', 'thc_konsentrasjonsnivaer']) {
      const feil = await feilFra(() => k.les(peder, `delete from public.${tabell}`))
      expect(feil?.code, tabell).toBe('42501')
    }
  })

  it('har bare ett regelsett', async () => {
    const feil = await feilFra(() => k.opprett('thc_regelsett', REGELSETT))
    expect(feil?.message).toMatch(/finnes alt et THC-syreregelsett/)
  })
})

/* --- Valideringen --------------------------------------------------------- */

/** Feilen databasen gir når regelsettet lagres, uten at noe blir lagret. */
async function avvisning(innhold: unknown) {
  const { revisjon } = await regelsettet('utkast')
  const feil = await feilFra(() => k.lagre(id, revisjon, JSON.parse(JSON.stringify(innhold)) as ThcRegelsettinnhold))
  expect(feil?.code).toBe('22023')
  expect((await regelsettet('utkast')).revisjon).toBe(revisjon)
  return feil!.message
}

describe('valideringen av reglene', () => {
  const med = (endring: Partial<ThcRegelsett>): ThcRegelsett => ({ ...REGLER, ...endring })
  const kurve = (rolle: keyof ThcRegelsett['kurver'], endring: Partial<ThcRegelsett['kurver']['gul']>) =>
    med({ kurver: { ...REGLER.kurver, [rolle]: { ...REGLER.kurver[rolle], ...endring } } })

  /** Hvert ugyldige regelsett avvises av databasen med en av meldingene appen gir. */
  const ugyldige: [string, ThcRegelsett][] = [
    ['konverteringsfaktor 0', med({ konverteringsfaktor: 0 })],
    ['negativ amplitude', kurve('rod', { a1: -1 })],
    ['kurve uten navn', kurve('gul', { navn: ' ' })],
    ['kurver i feil rekkefølge', med({ kurver: { ...REGLER.kurver, gronn: REGLER.kurver.rod, rod: REGLER.kurver.gronn } })],
    ['CV 1', med({ maleusikkerhet: { ...REGLER.maleusikkerhet, cv_kreatinin: 1 } })],
    ['faktor under 1', med({ maleusikkerhet: { ...REGLER.maleusikkerhet, faktor_under_cutoff: 0.5 } })],
    ['ingen marginer', med({ sikkerhetsmarginer: [] })],
    ['margin under 50 %', med({ sikkerhetsmarginer: [{ margin: 0.4, z: 0.2533471031357997 }, ...REGLER.sikkerhetsmarginer] })],
    ['feil z', med({ sikkerhetsmarginer: [{ margin: 0.5, z: 0 }, { margin: 0.9, z: -1.2815 }, { margin: 0.99, z: -2.3263478740408408 }] })],
    ['marginer ikke stigende', med({ sikkerhetsmarginer: [...REGLER.sikkerhetsmarginer].reverse() })],
    ['standard som ikke finnes', med({ standard_sikkerhetsmargin: 0.95 })],
    ['ingen nivåer', med({ konsentrasjonsnivaer: [] })],
    ['nivåer ikke stigende', med({ konsentrasjonsnivaer: REGLER.konsentrasjonsnivaer.map((n) => (n.nedre === 40 ? { ...n, nedre: 15 } : n)) })],
    ['like skillepunkter', med({ konsentrasjonsnivaer: REGLER.konsentrasjonsnivaer.map((n) => (n.nedre === 40 ? { ...n, nedre: 20 } : n)) })],
    ['laveste med grense', med({ konsentrasjonsnivaer: REGLER.konsentrasjonsnivaer.map((n, i) => (i === 0 ? { ...n, nedre: 1 } : n)) })],
    ['skillepunkt mangler', med({ konsentrasjonsnivaer: REGLER.konsentrasjonsnivaer.map((n, i) => (i === 1 ? { ...n, nedre: null } : n)) })],
    ['like navn', med({ konsentrasjonsnivaer: REGLER.konsentrasjonsnivaer.map((n) => ({ ...n, navn: 'lav' })) })],
    ['bruksmønster i feil rekkefølge', med({ bruksmonstre: { ...REGLER.bruksmonstre, ikke_kronisk: { vanskelig_over: 'gul', nytt_inntak_over: 'gul' } } })],
    ['varsel 0', med({ varsel_dager_mellom: 0 })],
  ]

  it.each(ugyldige)('avviser %s, både i appen og i databasen', async (_, regler) => {
    expect(validerThcRegelsett(regler).length).toBeGreaterThan(0)
    expect(await avvisning({ ...regler, tekstbolker: BOLKER })).not.toBe('')
  })

  it.each<[string, unknown]>([
    ['et ukjent felt', { ...REGLER, tekstbolker: BOLKER, ekstra: 1 }],
    ['et manglende felt', { ...REGLER }],
    ['tall som tekst', { ...REGLER, tekstbolker: BOLKER, konverteringsfaktor: '0.3' }],
    ['en ukjent kurve i et bruksmønster', { ...REGLER, tekstbolker: BOLKER, bruksmonstre: { ...REGLER.bruksmonstre, kronisk: { vanskelig_over: 'blaa', nytt_inntak_over: 'rod' } } }],
  ])('avviser %s', async (_, ugyldig) => {
    await avvisning(ugyldig)
  })

  it('godtar en ny margin med z fra AS 241, et nytt nivå og en annen kommentar', async () => {
    const annen = await nyKommentar('Konsentrasjonen er {nivå}.', ['{nivå}'])
    const nytt: ThcRegelsettinnhold = {
      ...REGELSETT,
      sikkerhetsmarginer: [...REGLER.sikkerhetsmarginer.slice(0, 2), { margin: 0.95, z: -1.6448536269514715 }, REGLER.sikkerhetsmarginer[2]!],
      konsentrasjonsnivaer: [...REGLER.konsentrasjonsnivaer, { navn: 'svært høy', nedre: 200, nylig_inntak: true }],
      tekstbolker: { ...BOLKER, nylig_inntak: annen },
    }
    const { tekstbolker: _, ...regler } = nytt
    expect(validerThcRegelsett(regler)).toEqual([])
    const { revisjon } = await regelsettet('utkast')
    await k.lagre(id, revisjon, nytt)
    expect((await regelsettet('utkast')).innhold).toStrictEqual(nytt)
    await k.lagre(id, revisjon + 1, REGELSETT)
  })
})

describe('valideringen av tekstbolkene', () => {
  it('krever en kommentar for hver bolk', async () => {
    const side = await k.opprett('infoside', { navn: 'Ikke en kommentar' })
    for (const ugyldig of [side.id, '00000000-0000-4000-8000-000000000000']) {
      expect(await avvisning({ ...REGELSETT, tekstbolker: { ...BOLKER, vanskelig: ugyldig } })).toBe(
        'Tekstbolken «Vanskelig å avgjøre» må peke på en kommentar.',
      )
    }
    const { uten_forrige: _, ...uten } = BOLKER
    expect(await avvisning({ ...REGELSETT, tekstbolker: uten })).toBe('Mangler felt: uten_forrige.')
    expect(await avvisning({ ...REGELSETT, tekstbolker: { ...BOLKER, ukjent: BOLKER.apning } })).toBe('Ukjente felt: ukjent.')
  })

  // Hver bolk godtar bare kommentarer med plassholderne den krever og kan
  // bruke. Databasen gir en av meldingene appen gir.
  it.each<[string, (typeof THC_TEKSTNOKLER)[number], string, string[]]>([
    ['nivået mangler i åpningen', 'apning', 'THC-syre er påvist.', []],
    ['datoen i åpningen', 'apning', 'Påvist i {nivå} siden {forrige prøvedato}.', ['{nivå}', '{forrige prøvedato}']],
    ['datoen mangler', 'ikke_nodvendigvis', 'Ikke nødvendigvis.', []],
    ['en plassholder bolken ikke kjenner', 'nylig_inntak', 'Nylig {inntak}.', ['{inntak}']],
  ])('avviser en kommentar der %s, både i appen og i databasen', async (_, nokkel, tekst, plassholdere) => {
    const iAppen = validerThcTekstbolk(nokkel, plassholdere)
    expect(iAppen.length).toBeGreaterThan(0)
    const kommentar = await nyKommentar(tekst, plassholdere)
    expect(iAppen).toContain(await avvisning({ ...REGELSETT, tekstbolker: { ...BOLKER, [nokkel]: kommentar } }))
  })

  it('har de samme bolkene, titlene og plassholderne som appen', async () => {
    const [rad] = await k.fasit<{ nokler: string[] }>(`select intern.thc_tekstnokler() as nokler`)
    expect(rad!.nokler).toEqual([...THC_TEKSTNOKLER])
    for (const nokkel of THC_TEKSTNOKLER) {
      const [b] = await k.fasit<{ tittel: string; krever: string[]; kan: string[] }>(
        `select intern.thc_tekstbolktittel($1) as tittel, intern.thc_tekstbolk_krever($1) as krever,
                intern.thc_tekstbolk_kan($1) as kan`,
        [nokkel],
      )
      const info = THC_TEKSTBOLKER[nokkel]
      expect(b, nokkel).toEqual({ tittel: info.tittel, krever: [...info.plassholdere], kan: [...info.tilgjengelige] })
    }
    const [kontroll] = await k.fasit<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'thc_tekstbolker_nokkel'`,
    )
    expect(kontroll!.def.match(/'[a-z_]+'/g)).toEqual(THC_TEKSTNOKLER.map((n) => `'${n}'`))
  })
})

/* --- Kurvenes rekkefølge -------------------------------------------------- */

describe('kurvenes rekkefølge', () => {
  /** Et regelsett med disse kurvene i IRCAK-enheter som grønn og gul, og gul også som rød. */
  const medKurver = (gronn: Kurve, gul: Kurve): ThcRegelsett => ({
    ...REGLER,
    konverteringsfaktor: 1,
    kurver: {
      gronn: { navn: 'Grønn', ...gronn },
      gul: { navn: 'Gul', ...gul },
      rod: { navn: 'Rød', ...gul },
    },
  })

  it('avviser redigerte kurver som bare krysser utenfor det gamle rutenettet, så de ikke kan publiseres', async () => {
    // En gul kurve med raskere startfase enn den grønne: riktig rekkefølge
    // på rutenettet fra IRCAK 0,01 til 1000 og 1 til 90 døgn, men ikke over
    // IRCAK 1000 rett etter inntak (se thcKurver.test.ts).
    const regler: ThcRegelsett = {
      ...REGLER,
      kurver: {
        ...REGLER.kurver,
        gul: { navn: 'Moderat', a1: 77.43151640667834, k1: 2.775563997050895, a2: 1089.4593911945838, k2: 0.13088688916307045 },
      },
    }
    const iAppen = validerThcRegelsett(regler)
    expect(iAppen).toEqual([
      'Den grønne kurven må gi minst like rask utskillelse som den gule ved alle konsentrasjoner, men gjør det ikke ved høye konsentrasjoner.',
    ])
    expect(await avvisning({ ...regler, tekstbolker: BOLKER })).toBe(iAppen[0])
    expect((await regelsettet('publisert', bruker)).innhold.kurver.gul).toStrictEqual(REGLER.kurver.gul)
  })

  it('avviser kurver som krysser midt i, og sier hvor', async () => {
    const regler = medKurver({ a1: 1e-3, k1: 5, a2: 10, k2: 0.2 }, { a1: 1e3, k1: 4, a2: 10, k2: 0.1 })
    const [melding] = validerThcRegelsett(regler)
    expect(melding).toMatch(/rundt IRCAK 36\.$/)
    expect(await avvisning({ ...regler, tekstbolker: BOLKER })).toBe(melding)
  })

  it('gir samme svar som appen for tilfeldige kurvepar', async () => {
    let s = 7
    const tilfeldig = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    const tilfeldigKurve = (): Kurve => ({
      a1: Math.exp(tilfeldig() * 8 - 2),
      k1: Math.exp(tilfeldig() * 4 - 2),
      a2: Math.exp(tilfeldig() * 8 - 2),
      k2: Math.exp(tilfeldig() * 4 - 4),
    })
    const par = Array.from({ length: 120 }, () => [tilfeldigKurve(), tilfeldigKurve()] as const)
    const svar = await k.fasit<{ hvor: string | null }>(
      `select intern.thc_rekkefolgebrudd(p.a1, p.k1, p.a2, p.k2, p.b1, p.l1, p.b2, p.l2) as hvor
       from jsonb_to_recordset($1::jsonb) as p(
         nr int, a1 float8, k1 float8, a2 float8, k2 float8, b1 float8, l1 float8, b2 float8, l2 float8
       )
       order by p.nr`,
      [JSON.stringify(par.map(([a, b], nr) => ({ nr, ...a, b1: b.a1, l1: b.k1, b2: b.a2, l2: b.k2 })))],
    )
    let avvist = 0
    par.forEach(([a, b], i) => {
      const iAppen = validerThcRegelsett(medKurver(a, b))
      const hvor = svar[i]!.hvor
      if (hvor === null) {
        expect(sammenlign(a, b), JSON.stringify({ a, b })).toBeNull()
        expect(iAppen).toEqual([])
      } else {
        avvist++
        expect(iAppen, JSON.stringify({ a, b })).toEqual([
          `Den grønne kurven må gi minst like rask utskillelse som den gule ved alle konsentrasjoner, men gjør det ikke ${hvor}.`,
        ])
      }
    })
    expect(avvist).toBeGreaterThan(10)
    expect(avvist).toBeLessThan(par.length - 10)
  }, 60_000)

  it('viser IRCAK på samme måte som appen', async () => {
    const verdier = [35.65, 1234, 0.0012345, 9.96, 0.1, 1, 99.5, 1.23e-7, 4.5e25, 1e-3, 123456789, 0]
    const [rad] = await k.fasit<{ v: string[] }>(
      `select array_agg(intern.thc_vis_ircak(x) order by n) as v from unnest($1::float8[]) with ordinality as u(x, n)`,
      [verdier],
    )
    expect(rad!.v).toEqual(verdier.map(visIrcak))
  })
})
