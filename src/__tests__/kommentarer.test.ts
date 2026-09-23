/**
 * Fortolkningskommentarene som egne objekter, prøvd mot en ekte database.
 *
 * Kommentarene går gjennom det samme maskineriet som alt annet faginnhold
 * (utkast, publisering, revisjoner, gjenoppretting). Det som prøves her, er
 * det som er særegent for dem: kontrollen av teksten og plassholderne — lik i
 * databasen og i appen — at plassholderne ikke kan endres, at en regel ikke kan
 * publiseres med en kommentar som ikke er publisert, og tilgangen.
 *
 * Tekstene er syntetiske.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { validerKommentar, type Kommentarinnhold } from '../domain/kommentarobjekt'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

let db: PGlite
let bruker: string
let { rpc, les, fasit, opprett, lagre, gjenopprett, publiser, revisjoner, forventSamsvar } =
  {} as Faginnholdskall

beforeAll(async () => {
  db = await nyDatabase()
  const admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'vanlig', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
  ;({ rpc, les, fasit, opprett, lagre, gjenopprett, publiser, revisjoner, forventSamsvar } = faginnholdskall(
    db,
    admin,
  ))
}, 60_000)

const kommentar = (tekst: string, plassholdere: string[] = [], navn = 'Testkommentar'): Kommentarinnhold => ({
  navn,
  tekst,
  plassholdere,
})

describe('en kommentar', () => {
  it('opprettes, endres, publiseres og gjenopprettes som annet faginnhold', async () => {
    const k = await opprett('kommentar', kommentar('Påvist i {nivå} konsentrasjon.', ['{nivå}'], 'Åpning'))
    const endret = await lagre(k.id, 1, kommentar('Funnet i {nivå} konsentrasjon.', ['{nivå}'], 'Åpning'))
    await publiser(endret.id, 2)
    const tilbake = await gjenopprett(k.id, 2, 1)
    expect(tilbake.revisjon).toBe(3)
    await forventSamsvar(k.id)

    const historikk = await revisjoner(k.id)
    expect(historikk.map((r) => [r.handling, r.innhold])).toEqual([
      ['opprettet', { navn: 'Åpning', tekst: 'Påvist i {nivå} konsentrasjon.', plassholdere: ['{nivå}'] }],
      ['endret', { navn: 'Åpning', tekst: 'Funnet i {nivå} konsentrasjon.', plassholdere: ['{nivå}'] }],
      ['gjenopprettet', { navn: 'Åpning', tekst: 'Påvist i {nivå} konsentrasjon.', plassholdere: ['{nivå}'] }],
    ])
  })

  it('lagrer plassholderne sortert, så øyeblikksbildet er det samme uansett rekkefølge', async () => {
    const k = await opprett('kommentar', kommentar('{b} og {a}.', ['{b}', '{a}']))
    expect((await revisjoner(k.id))[0]!.innhold.plassholdere).toEqual(['{a}', '{b}'])
    const uendret = await lagre(k.id, 1, kommentar('{b} og {a}.', ['{a}', '{b}']))
    expect(uendret.revisjon).toBe(1)
  })
})

describe('kontrollen av kommentaren', () => {
  // Hvert tilfelle kjøres både i appen og i databasen, som må være enige.
  const TILFELLER: [string, Kommentarinnhold][] = [
    ['vanlig tekst', kommentar('Konsentrasjonen er innenfor referanseområdet.')],
    ['med plassholdere', kommentar('Tatt {forrige prøvedato}, nivå {nivå}.', ['{nivå}', '{forrige prøvedato}'])],
    ['samme plassholder to ganger i teksten', kommentar('{dato} og igjen {dato}.', ['{dato}'])],
    ['tomt navn', kommentar('Tekst.', [], '  ')],
    ['for langt navn', kommentar('Tekst.', [], 'n'.repeat(201))],
    ['tom tekst', kommentar('   ')],
    ['mellomrom i enden', kommentar('Tekst. ')],
    ['linjeskift', kommentar('Første linje.\nAndre linje.')],
    ['for lang tekst', kommentar('x'.repeat(4001))],
    ['akkurat lang nok tekst', kommentar('x'.repeat(4000))],
    ['plassholder som ikke er oppgitt', kommentar('Nivå {nivå}.')],
    ['oppgitt plassholder som ikke brukes', kommentar('Ingen hull.', ['{nivå}'])],
    ['plassholder uten krøllparenteser', kommentar('Nivå nivå.', ['nivå'])],
    ['plassholder med mellomrom i enden', kommentar('Nivå { nivå}.', ['{ nivå}'])],
    ['samme plassholder oppgitt to ganger', kommentar('Nivå {nivå}.', ['{nivå}', '{nivå}'])],
    ['løs krøllparentes', kommentar('Nivå {nivå} }.', ['{nivå}'])],
  ]

  it.each(TILFELLER)('%s: samme svar i appen og i databasen', async (_, innhold) => {
    const iAppen = validerKommentar(innhold)
    const iDatabasen = await feilFra(() => opprett('kommentar', innhold))
    if (iAppen.length === 0) {
      expect(iDatabasen).toBeNull()
    } else {
      expect(iDatabasen?.code).toBe('22023')
      expect(iAppen).toContain(iDatabasen?.message)
    }
  })

  it('godtar og avviser det den skal', () => {
    const godtatt = TILFELLER.filter(([, k]) => validerKommentar(k).length === 0).map(([navn]) => navn)
    expect(godtatt).toEqual([
      'vanlig tekst',
      'med plassholdere',
      'samme plassholder to ganger i teksten',
      'akkurat lang nok tekst',
    ])
  })

  it('avviser ukjente og manglende felt', async () => {
    expect((await feilFra(() => opprett('kommentar', { tekst: 'Tekst.' } as never)))?.message).toMatch(
      /Mangler felt: navn, plassholdere/,
    )
    const ekstra = { ...kommentar('Tekst.'), regel: 'x' } as never
    expect((await feilFra(() => opprett('kommentar', ekstra)))?.message).toMatch(/Ukjente felt: regel/)
  })
})

describe('plassholderne', () => {
  it('kan ikke endres etter at kommentaren er opprettet — teksten kan', async () => {
    const k = await opprett('kommentar', kommentar('Tatt {forrige prøvedato}.', ['{forrige prøvedato}']))
    await lagre(k.id, 1, kommentar('Prøven tatt {forrige prøvedato}.', ['{forrige prøvedato}']))

    for (const [tekst, plassholdere] of [
      ['Prøven.', []],
      ['Tatt {forrige prøvedato}, nivå {nivå}.', ['{forrige prøvedato}', '{nivå}']],
      ['Tatt {dato}.', ['{dato}']],
    ] as [string, string[]][]) {
      const innhold = kommentar(tekst, plassholdere)
      const feil = await feilFra(() => lagre(k.id, 2, innhold))
      expect(feil?.message).toBe('Plassholderne i en kommentar kan ikke endres. Lag en ny kommentar i stedet.')
      expect(validerKommentar(innhold, ['{forrige prøvedato}'])).toContain(feil?.message)
    }
    expect((await revisjoner(k.id)).length).toBe(2)
  })
})

describe('regler som peker på kommentarer', () => {
  // En regeltype peker på kommentarene i en koblingskolonne med den vanlige
  // kontrollen av objekttypen. Tabellen her står for en slik regeltype.
  beforeAll(async () => {
    await db.exec(`
      create table public.testregler (
        objekt_id uuid not null,
        tilstand public.objekttilstand not null,
        kommentar_id uuid not null
      );
      create trigger testregler_objekttype
      before insert or update on public.testregler
      for each row execute function intern.krev_objekttype('kommentar_id', 'kommentar');
    `)
  })

  const settInn = (tilstand: string, kommentarId: string) =>
    feilFra(() =>
      fasit('insert into public.testregler values (gen_random_uuid(), $1, $2)', [tilstand, kommentarId]),
    )

  it('kan bare peke på kommentarer', async () => {
    const side = await opprett('infoside', { navn: 'Ikke en kommentar' })
    expect((await settInn('utkast', side.id))?.message).toBe(
      'Koblingen kommentar_id må peke på et objekt av typen kommentar.',
    )
  })

  it('kan ikke publiseres før kommentaren er publisert', async () => {
    const k = await opprett('kommentar', kommentar('Upublisert.'))
    expect(await settInn('utkast', k.id)).toBeNull()
    expect((await settInn('publisert', k.id))?.message).toBe(
      'Koblingen kommentar_id peker på noe som ikke er publisert. Publiser det først.',
    )
    await publiser(k.id, 1)
    expect(await settInn('publisert', k.id)).toBeNull()
  })
})

describe('tilgangen', () => {
  it('lar bare administratorer endre kommentarer', async () => {
    const feil = await feilFra(() => opprett('kommentar', kommentar('Tekst.'), bruker))
    expect(feil?.code).toBe('42501')
    const direkte = await feilFra(() =>
      les(bruker, `insert into public.kommentarer values (gen_random_uuid(), 'utkast', 'x', 'y', '{}')`),
    )
    expect(direkte?.code).toBe('42501')
  })

  it('viser det publiserte til alle innloggede, og utkastene bare til administratorer', async () => {
    const publisert = await opprett('kommentar', kommentar('Publisert tekst.'))
    await publiser(publisert.id, 1)
    const utkast = await opprett('kommentar', kommentar('Bare utkast.'))
    const ider = [publisert.id, utkast.id]

    const lesSom = async (hvem: string | null, tilstand: string) =>
      (
        await rpc<{ les_kommentarer: { id: string; innhold: Kommentarinnhold }[] }>(hvem, 'les_kommentarer', {
          kommentartilstand: tilstand,
          ider,
        })
      ).les_kommentarer.map((k) => k.innhold.tekst)

    expect(await lesSom(bruker, 'publisert')).toEqual(['Publisert tekst.'])
    expect(await lesSom(bruker, 'utkast')).toEqual([])
    expect((await feilFra(() => lesSom(null, 'publisert')))?.code).toBe('42501')

    const admin = (await fasit<{ id: string }>(`select id from public.profiles where role = 'admin'`))[0]!.id
    expect((await lesSom(admin, 'utkast')).sort()).toEqual(['Bare utkast.', 'Publisert tekst.'])
  })
})
