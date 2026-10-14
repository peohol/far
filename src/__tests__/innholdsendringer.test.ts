/**
 * Endringsloggen for innholdssidene (`docs/innholdsendringer.md`), prøvd mot en
 * ekte database bygd av migrasjonene: at hver lagring, publisering og handling
 * i stoffregisteret føres som én endring sammen med det den endret, hvem som
 * står for den, at kurateringer må ha en rapport som stemmer med det som ble
 * gjort, hva hver leser får se, og at loggen ikke kan endres i ettertid.
 *
 * Innholdet er syntetisk.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  faginnholdskall,
  feilFra,
  kjorMigrasjoner,
  migrasjonsfiler,
  nyDatabase,
  opprettBruker,
  som,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const LOGGMIGRASJON = migrasjonsfiler().find((f) => f.endsWith('_innholdsendringer.sql'))!
const AGENTFIL = '20991231000000_syntetisk_agentmigrasjon.sql'
const DOK = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })
const base64 = (tekst: string) => Buffer.from(tekst, 'utf8').toString('base64')

interface Del {
  objekt: string
  type: string
  fra?: number
  til: number
  publisert?: boolean
  for?: Record<string, unknown>
  etter?: Record<string, unknown>
  endret?: string[]
  data_endret?: string[]
  referanser?: { lagt_til: number; fjernet: number }
  delt?: boolean
}

interface Endring {
  id: string
  kl: string
  aktor: 'bruker' | 'agent' | 'system'
  eldre?: boolean
  art: string
  agent?: { nokkel: string; navn: string; art: string }
  person?: { fornavn: string; etternavn: string }
  profil?: { id: string; username: string; first_name: string; last_name: string; avatar_path?: string; updated_at: string }
  oppsummering?: string
  rapport?: Record<string, unknown>
  migrasjon?: string
  verifisert?: boolean
  lenker?: string[]
  deler?: Del[]
  hendelser?: { hendelse: string; data: Record<string, unknown> }[]
  utkast: boolean
  delt?: boolean
}

interface Logg {
  endringer: Endring[]
  flere: boolean
}

let db: PGlite
let admin: string
let leser: string
let kall: Faginnholdskall

const sql = <T = Record<string, unknown>>(hvem: string | null, tekst: string, parametre: unknown[] = []) =>
  som(db, hvem, async (tx) => (await tx.query<T>(tekst, parametre)).rows)

function logg(hvem: string, side: Record<string, unknown>, valg: Record<string, unknown> = {}): Promise<Logg> {
  return kall.rpc<{ les_endringslogg: Logg }>(hvem, 'les_endringslogg', { side, ...valg }).then((r) => r.les_endringslogg)
}

/** Antall rader i en tabell, uten radsikkerhet. */
async function antall(tabell: string): Promise<number> {
  return Number((await db.query<{ n: number }>(`select count(*) as n from ${tabell}`)).rows[0]!.n)
}

let lopenummer = 0
/** En publisert fagside med et publisert doseringskort. */
async function nyFagside(navn = 'Loggstoff') {
  lopenummer += 1
  const side = await kall.opprett('infoside', { navn: `${navn} ${lopenummer}` })
  await kall.publiser(side.id, 1)
  const slug = (await kall.fasit<{ slug: string }>('select slug from public.infosider where objekt_id = $1 limit 1', [side.id]))[0]!.slug
  const kort = await kall.opprett('innholdselement', {
    infoside: side.id,
    panel: 'dosering',
    posisjon: 0,
    elementtype: 'riktekst',
    data: { dokument: DOK('Første utgave') },
    referanser: [],
  })
  await kall.publiser(kort.id, 1)
  return { side: side.id, slug, kort: kort.id }
}

const kortinnhold = (side: string, tekst: string, ekstra: Record<string, unknown> = {}) => ({
  infoside: side,
  panel: 'dosering',
  posisjon: 0,
  elementtype: 'riktekst',
  data: { dokument: DOK(tekst) },
  referanser: [],
  ...ekstra,
})

/** En publisert referanse. */
async function nyReferanse(tittel: string) {
  const ref = await kall.opprett('referanse', { tittel, forfattere: 'A', aar: '2026', lenke: `https://example.org/${lopenummer++}` })
  await kall.publiser(ref.id, 1)
  return ref.id
}

/** Gir referansen en ny tittel og publiserer den. */
async function nyTittel(ref: string, revisjon: number, tittel: string) {
  await kall.lagre(ref, revisjon, { tittel, forfattere: 'A', aar: '2026', lenke: `https://example.org/${ref}` })
  await kall.publiser(ref, revisjon + 1)
}

const objekterI = (l: Logg) => new Set(l.endringer.flatMap((e) => (e.deler ?? []).map((d) => d.objekt)))
const delerFor = (l: Logg, objekt: string) => l.endringer.flatMap((e) => (e.deler ?? []).filter((d) => d.objekt === objekt))
const delFor = (l: Logg, objekt: string) => delerFor(l, objekt)[0]

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  leser = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
  kall = faginnholdskall(db, admin)
}, 120_000)

describe('en lagring i appen', () => {
  it('føres som én endring fra brukeren, sammen med revisjonen', async () => {
    const { side, kort } = await nyFagside()
    const for_ = await antall('public.innholdsendringer')
    await kall.lagre(kort, 1, kortinnhold(side, 'Andre utgave'))
    expect(await antall('public.innholdsendringer')).toBe(for_ + 1)

    const [rad] = await kall.fasit<{ aktor: string; agent: string | null; utfort_av: string; utfort_av_fornavn: string; endring_id: string }>(
      `select e.aktor, e.agent, e.utfort_av, e.utfort_av_fornavn, r.endring_id
       from public.objektrevisjoner r join public.innholdsendringer e on e.id = r.endring_id
       where r.objekt_id = $1 and r.revisjon = 2`,
      [kort],
    )
    expect(rad).toMatchObject({ aktor: 'bruker', agent: null, utfort_av: admin, utfort_av_fornavn: 'Rita' })
  })

  it('gir ingen endring når ingenting endres', async () => {
    const { side, kort } = await nyFagside()
    const for_ = await antall('public.innholdsendringer')
    await kall.lagre(kort, 1, kortinnhold(side, 'Første utgave'))
    await kall.publiser(kort, 1)
    expect(await antall('public.innholdsendringer')).toBe(for_)
  })

  it('samler kallene i én handling og tar med oppsummeringen brukeren skrev', async () => {
    const { side, kort } = await nyFagside()
    const operasjon = crypto.randomUUID()
    const overskrifter = { 'x-far-endring': operasjon, 'x-far-oppsummering': base64('Dosering justert etter ny SPC – æøå') }
    await kall.rpc(admin, 'lagre_utkast', { objekt: kort, forventet_revisjon: 1, innhold: kortinnhold(side, 'Ny') }, overskrifter)
    await kall.rpc(admin, 'publiser_utkast', { objekt: kort, forventet_revisjon: 2 }, overskrifter)

    const rader = await kall.fasit<{ endring_id: string }>(
      `select endring_id from public.objektrevisjoner where objekt_id = $1 and revisjon = 2
       union all select endring_id from public.objektpubliseringer where objekt_id = $1 and revisjon = 2`,
      [kort],
    )
    expect(rader.map((r) => r.endring_id)).toEqual([operasjon, operasjon])
    const [endring] = await kall.fasit<{ oppsummering: string }>('select oppsummering from public.innholdsendringer where id = $1', [operasjon])
    expect(endring!.oppsummering).toBe('Dosering justert etter ny SPC – æøå')
  })

  it('bruker ikke en annen brukers handling, og tåler en ugyldig oppsummering', async () => {
    const annen = await opprettBruker(db, { brukernavn: 'annen.admin', fornavn: 'Anne', etternavn: 'Annen', rolle: 'admin' })
    const { side, kort } = await nyFagside()
    const operasjon = crypto.randomUUID()
    await kall.rpc(admin, 'lagre_utkast', { objekt: kort, forventet_revisjon: 1, innhold: kortinnhold(side, 'A') }, { 'x-far-endring': operasjon })
    await kall.rpc(annen, 'lagre_utkast', { objekt: kort, forventet_revisjon: 2, innhold: kortinnhold(side, 'B') }, {
      'x-far-endring': operasjon,
      'x-far-oppsummering': '%%%ikke base64',
    })
    const [rad] = await kall.fasit<{ endring_id: string; utfort_av: string; oppsummering: string | null }>(
      `select r.endring_id, e.utfort_av, e.oppsummering from public.objektrevisjoner r
       join public.innholdsendringer e on e.id = r.endring_id where r.objekt_id = $1 and r.revisjon = 3`,
      [kort],
    )
    expect(rad!.endring_id).not.toBe(operasjon)
    expect(rad).toMatchObject({ utfort_av: annen, oppsummering: null })
  })

  it('går gjennom appens lager med én handling og oppsummeringen', async () => {
    const { lagFaginnholdslager } = await import('../faginnhold/lagring')
    const { side, kort } = await nyFagside()
    const { lagerFor } = await import('../faginnhold/lagring')
    const lager = lagerFor(lagFaginnholdslager(kall.klientFor(admin)), { id: crypto.randomUUID(), oppsummering: 'Fra lageret' })
    await lager.lagreUtkast(kort, 1, kortinnhold(side, 'Fra lageret'))
    await lager.publiserUtkast(kort, 2)
    const endringer = await kall.fasit<{ oppsummering: string; n: number }>(
      `select e.oppsummering, count(*)::int as n from public.objektrevisjoner r
       join public.innholdsendringer e on e.id = r.endring_id where r.objekt_id = $1 and r.revisjon = 2
       group by e.oppsummering`,
      [kort],
    )
    expect(endringer).toEqual([{ oppsummering: 'Fra lageret', n: 1 }])
  })
})

describe('loggen for en fagside', () => {
  it('viser publiseringene for alle, og utkastene bare for administratorer som ber om det', async () => {
    const { side, slug, kort } = await nyFagside()
    await kall.lagre(kort, 1, kortinnhold(side, 'Utkast som ikke er publisert'))

    const vanlig = await logg(leser, { stoff: slug })
    expect(vanlig.endringer.every((e) => !e.utkast)).toBe(true)
    expect(vanlig.endringer.flatMap((e) => e.deler ?? []).every((d) => d.publisert)).toBe(true)
    // Leseren kan ikke be om utkastene.
    expect(await logg(leser, { stoff: slug }, { med_utkast: true })).toEqual(vanlig)

    const medUtkast = await logg(admin, { stoff: slug }, { med_utkast: true })
    expect(medUtkast.endringer[0]).toMatchObject({
      utkast: true,
      aktor: 'bruker',
      person: { fornavn: 'Rita', etternavn: 'Redaktør' },
      profil: { id: admin, username: 'peohol', first_name: 'Rita', last_name: 'Redaktør' },
    })
    expect(medUtkast.endringer[0]!.deler).toEqual([
      expect.objectContaining({ objekt: kort, type: 'innholdselement', fra: 1, til: 2, endret: ['data'], data_endret: ['dokument'] }),
    ])
  })

  it('viser ingenting om en fagside som ikke er publisert, for andre enn administratorer', async () => {
    const side = await kall.opprett('infoside', { navn: 'Upublisert loggstoff' })
    const [{ slug }] = (await kall.fasit<{ slug: string }>('select slug from public.infosider where objekt_id = $1', [side.id])) as [
      { slug: string },
    ]
    expect((await logg(leser, { stoff: slug })).endringer).toEqual([])
    expect((await logg(admin, { stoff: slug }, { med_utkast: true })).endringer).toHaveLength(1)
  })

  it('tar med referansene siden siterer, og kort som er flyttet bort', async () => {
    const { side, slug, kort } = await nyFagside()
    const ref = await kall.opprett('referanse', { tittel: 'Syntetisk kilde', forfattere: 'A', aar: '2026', lenke: 'https://example.org/logg-kilde' })
    await kall.publiser(ref.id, 1)
    await kall.lagre(kort, 1, kortinnhold(side, 'Med kilde', { referanser: [ref.id] }))
    await kall.publiser(kort, 2)
    await kall.lagre(ref.id, 1, { tittel: 'Syntetisk kilde, rettet', forfattere: 'A', aar: '2026', lenke: 'https://example.org/logg-kilde' })
    await kall.publiser(ref.id, 2)
    await kall.lagre(kort, 2, kortinnhold(side, 'Med kilde', { referanser: [ref.id], panel: 'fjernet' }))
    await kall.publiser(kort, 3)

    const { endringer } = await logg(leser, { stoff: slug })
    const [fjernet, referanse, sitert] = endringer
    expect(fjernet!.deler).toEqual([
      expect.objectContaining({ objekt: kort, for: expect.objectContaining({ panel: 'dosering' }), etter: expect.objectContaining({ panel: 'fjernet' }) }),
    ])
    expect(referanse!.deler).toEqual([
      expect.objectContaining({ objekt: ref.id, type: 'referanse', etter: expect.objectContaining({ tittel: 'Syntetisk kilde, rettet' }) }),
    ])
    expect(sitert!.deler![0]!.referanser).toEqual({ lagt_til: 1, fjernet: 0 })
  })

  it('røper ikke en referanse eller et kort som bare i et utkast er knyttet til siden', async () => {
    const { side, slug, kort } = await nyFagside()
    const ref = await nyReferanse('Hemmelig kilde')
    // Et publisert kort på en annen fagside.
    const annen = await nyFagside()
    // Bare utkast: kortet siterer referansen, og kortet fra den andre siden flyttes hit.
    await kall.lagre(kort, 1, kortinnhold(side, 'Første utgave', { referanser: [ref] }))
    await kall.lagre(annen.kort, 1, kortinnhold(side, 'Første utgave', { panel: 'indikasjon' }))

    const forLeser = await logg(leser, { stoff: slug })
    expect(objekterI(forLeser).has(annen.kort)).toBe(false)
    expect(forLeser.endringer.some((e) => e.deler?.some((d) => d.referanser?.lagt_til))).toBe(false)
    // Administratorene ser koblingene med utkastene, men ikke når de velger dem bort.
    const medUtkast = await logg(admin, { stoff: slug }, { med_utkast: true })
    expect(objekterI(medUtkast).has(annen.kort)).toBe(true)
    expect(delFor(medUtkast, kort)?.referanser).toEqual({ lagt_til: 1, fjernet: 0 })
    expect(objekterI(await logg(admin, { stoff: slug })).has(annen.kort)).toBe(false)

    // Når utkastet publiseres, står tilknytningen i loggen for alle — men ikke
    // det referansen var før den ble knyttet til siden.
    await kall.publiser(kort, 2)
    const etter = await logg(leser, { stoff: slug })
    expect(delFor(etter, kort)?.referanser).toEqual({ lagt_til: 1, fjernet: 0 })
    expect(objekterI(etter).has(ref)).toBe(false)
  })

  it('blar bakover med «etter» og sier når det finnes flere', async () => {
    const { side, slug, kort } = await nyFagside()
    for (let revisjon = 1; revisjon <= 4; revisjon += 1) {
      await kall.lagre(kort, revisjon, kortinnhold(side, `Utgave ${revisjon + 1}`))
      await kall.publiser(kort, revisjon + 1)
    }
    const forste = await logg(leser, { stoff: slug }, { antall: 3 })
    expect(forste.endringer).toHaveLength(3)
    expect(forste.flere).toBe(true)
    const siste = forste.endringer[2]!
    const andre = await logg(leser, { stoff: slug }, { antall: 3, etter: { kl: siste.kl, id: siste.id } })
    expect(andre.flere).toBe(false)
    const alle = [...forste.endringer, ...andre.endringer].map((e) => e.id)
    expect(new Set(alle).size).toBe(alle.length)
    // Siden og kortet publisert, og fire nye utgaver av kortet.
    expect(alle).toHaveLength(6)
  })

  it('krever innlogging', async () => {
    const feil = await feilFra(() => kall.rpc(null, 'les_endringslogg', { side: { stoff: 'x' } }))
    expect(feil?.code).toBe('42501')
  })
})

describe('delte referanser og kort som flyttes', () => {
  it('tar bare med en delt referanse mens siden er knyttet til den, også når den fjernes og legges inn igjen', async () => {
    const a = await nyFagside('Deler A')
    const b = await nyFagside('Deler B')
    const ref = await nyReferanse('Delt kilde')
    await kall.lagre(a.kort, 1, kortinnhold(a.side, 'A', { referanser: [ref] }))
    await kall.publiser(a.kort, 2)
    // Endret før B knyttes til den: hører ikke til B.
    await nyTittel(ref, 1, 'Delt kilde, før B')

    await kall.lagre(b.kort, 1, kortinnhold(b.side, 'B', { referanser: [ref] }))
    await kall.publiser(b.kort, 2)
    await nyTittel(ref, 2, 'Delt kilde, mens B siterer')
    await kall.lagre(b.kort, 2, kortinnhold(b.side, 'B'))
    await kall.publiser(b.kort, 3)
    await nyTittel(ref, 3, 'Delt kilde, etter at B fjernet den')
    await kall.lagre(b.kort, 3, kortinnhold(b.side, 'B', { referanser: [ref] }))
    await kall.publiser(b.kort, 4)
    await nyTittel(ref, 4, 'Delt kilde, etter at B la den inn igjen')

    const forB = await logg(leser, { stoff: b.slug })
    const titler = (l: Logg) => delerFor(l, ref).map((d) => d.etter?.tittel)
    expect(titler(forB)).toEqual(['Delt kilde, etter at B la den inn igjen', 'Delt kilde, mens B siterer'])
    // Tilknytningene står som endringer av kortet: lagt til, fjernet, lagt til igjen.
    const tilknytninger = delerFor(forB, b.kort)
      .map((d) => d.referanser)
      .filter((r) => r && r.lagt_til + r.fjernet > 0)
    expect(tilknytninger).toEqual([
      { lagt_til: 1, fjernet: 0 },
      { lagt_til: 0, fjernet: 1 },
      { lagt_til: 1, fjernet: 0 },
    ])
    // Endringene av referansen er merket som delte, uten sammendrag fra det de ellers gjaldt.
    const delt = forB.endringer.find((e) => e.deler?.some((d) => d.objekt === ref))!
    expect(delt).toMatchObject({ delt: true, art: 'redigering', deler: [expect.objectContaining({ delt: true })] })

    // A har vært knyttet til den hele tiden, men den var bare delt mens B siterte
    // den: det A endret alene, blir ikke delt i ettertid fordi B tok den i bruk.
    const forA = await logg(leser, { stoff: a.slug })
    expect(titler(forA)).toHaveLength(4)
    expect(delerFor(forA, ref).map((d) => d.delt ?? false)).toEqual([true, false, true, false])
    const alene = forA.endringer.find((e) => e.deler?.some((d) => d.objekt === ref && d.etter?.tittel === 'Delt kilde, før B'))!
    expect(alene.delt).toBeUndefined()
  })

  it('merker ikke en referanse som bare siden bruker, som delt', async () => {
    const { side, slug, kort } = await nyFagside('Egen kilde')
    const ref = await nyReferanse('Bare her')
    await kall.lagre(kort, 1, kortinnhold(side, 'Med kilde', { referanser: [ref] }))
    await kall.publiser(kort, 2)
    await nyTittel(ref, 1, 'Bare her, rettet')
    const [forste] = (await logg(leser, { stoff: slug })).endringer
    expect(forste!.delt).toBeUndefined()
    expect(forste!.deler![0]).toMatchObject({ objekt: ref })
    expect(forste!.deler![0]!.delt).toBeUndefined()
  })

  it('tar med et kort fra det flyttes til siden, og det som skjedde før, bare på siden det sto på', async () => {
    const a = await nyFagside('Flytt fra')
    const b = await nyFagside('Flytt til')
    await kall.lagre(a.kort, 1, kortinnhold(a.side, 'Endret på A', { panel: 'indikasjon' }))
    await kall.publiser(a.kort, 2)
    await kall.lagre(a.kort, 2, kortinnhold(b.side, 'Flyttet til B', { panel: 'indikasjon' }))
    await kall.publiser(a.kort, 3)
    await kall.lagre(a.kort, 3, kortinnhold(b.side, 'Endret på B', { panel: 'indikasjon' }))
    await kall.publiser(a.kort, 4)

    const revisjoner = (l: Logg) => delerFor(l, a.kort).map((d) => d.til)
    expect(revisjoner(await logg(leser, { stoff: b.slug }))).toEqual([4, 3])
    expect(revisjoner(await logg(leser, { stoff: a.slug }))).toEqual([3, 2, 1])
  })
})

describe('stoffregisteret', () => {
  it('fører kategoriene og plasseringene, med navnene slik de var, og viser dem i begge loggene', async () => {
    const { side, slug } = await nyFagside('Registerstoff')
    const [{ k: a }] = (await sql<{ k: string }>(leser, `select public.opprett_stoffkategori('Syntetisk A') as k`)) as [{ k: string }]
    const [{ k: b }] = (await sql<{ k: string }>(leser, `select public.opprett_stoffkategori('Syntetisk B') as k`)) as [{ k: string }]
    await sql(leser, 'select public.plasser_stoff($1, null, $2)', [slug, a])
    await sql(leser, 'select public.plasser_stoff($1, $2, $3)', [slug, a, b])
    await sql(leser, `select public.endre_stoffkategori($1, 'Syntetisk B2')`, [b])
    await sql(leser, 'select public.arkiver_stoff($1, true)', [slug])
    await sql(leser, 'select public.arkiver_stoff($1, false)', [slug])

    const register = await logg(leser, { stoffregister: true })
    const hendelser = register.endringer.slice(0, 6).map((e) => e.hendelser!.map((h) => h.hendelse))
    expect(hendelser).toEqual([
      ['stoff_hentet_fra_arkivet'],
      ['stoff_arkivert'],
      ['kategori_omdopt'],
      ['stoff_plassert', 'stoff_tatt_ut'],
      ['stoff_plassert'],
      ['kategori_opprettet'],
    ])
    expect(register.endringer[2]!.hendelser![0]!.data).toMatchObject({ navn: 'Syntetisk B2', fra: 'Syntetisk B' })
    expect(register.endringer[3]!.hendelser![0]!.data).toMatchObject({ stoff: slug, kategorinavn: 'Syntetisk B' })
    expect(register.endringer[3]).toMatchObject({ aktor: 'bruker', person: { fornavn: 'Lars' } })

    const fagside = await logg(leser, { stoff: slug })
    expect(fagside.endringer[0]!.hendelser![0]!.hendelse).toBe('stoff_hentet_fra_arkivet')
    expect(side).toBeTruthy()
  })

  it('fører en flytting opp eller ned blant søsknene som én hendelse, og ingenting når plassen er den samme', async () => {
    const opprett = async (navn: string, forelder: string | null = null) =>
      ((await sql<{ k: string }>(leser, 'select public.opprett_stoffkategori($1, $2) as k', [navn, forelder])) as [{ k: string }])[0].k
    const forelder = await opprett('Syntetisk forelder')
    const forste = await opprett('Syntetisk en', forelder)
    await opprett('Syntetisk to', forelder)
    const tredje = await opprett('Syntetisk tre', forelder)

    const for_ = await antall('public.innholdsendringer')
    await sql(leser, 'select public.flytt_stoffkategori($1, $2, 0)', [tredje, forelder])
    expect(await antall('public.innholdsendringer')).toBe(for_ + 1)
    const [endring] = (await logg(leser, { stoffregister: true })).endringer
    expect(endring!.hendelser).toEqual([
      expect.objectContaining({
        hendelse: 'kategori_omordnet',
        data: expect.objectContaining({ kategori: tredje, navn: 'Syntetisk tre', forelder: 'Syntetisk forelder', fra: 3, til: 1 }),
      }),
    ])
    expect(endring).toMatchObject({ aktor: 'bruker', person: { fornavn: 'Lars' } })

    // Samme plass som før: ingen endring.
    await sql(leser, 'select public.flytt_stoffkategori($1, $2, 1)', [forste, forelder])
    expect(await antall('public.innholdsendringer')).toBe(for_ + 1)
  })

  it('fører en ny fagside og et nytt navn i registerets logg', async () => {
    const side = await kall.opprett('infoside', { navn: 'Nytt registernavn' })
    await kall.publiser(side.id, 1)
    const { endringer } = await logg(leser, { stoffregister: true })
    expect(endringer[0]!.deler).toEqual([expect.objectContaining({ objekt: side.id, type: 'infoside' })])
  })

  it('fører ryddingen av papirkurven som systemets, og skjuler den som en rutine uten «med_rutiner»', async () => {
    const { slug } = await nyFagside('Gammelt stoff')
    await sql(admin, 'select public.slett_stoff($1)', [slug])
    await db.query(`update public.stoffstatus set endret_kl = now() - interval '40 days' where stoff = $1`, [slug])
    await sql(leser, 'select public.rydd_stoffpapirkurven()')

    const [rydding] = await kall.fasit<{ aktor: string; agent: string }>(
      `select e.aktor, e.agent from public.innholdshendelser h join public.innholdsendringer e on e.id = h.endring_id
       where h.hendelse = 'stoff_slettet_for_godt' and h.data ->> 'stoff' = $1`,
      [slug],
    )
    expect(rydding).toEqual({ aktor: 'system', agent: 'papirkurvrydding' })
    const uten = await logg(admin, { stoffregister: true }, { med_utkast: true })
    expect(uten.endringer.some((e) => e.agent?.nokkel === 'papirkurvrydding')).toBe(false)
    const med = await logg(admin, { stoffregister: true }, { med_utkast: true, med_rutiner: true })
    expect(med.endringer.some((e) => e.agent?.nokkel === 'papirkurvrydding')).toBe(true)
  })
})

describe('bivirkningene', () => {
  it('føres på fagsiden importen gjelder', async () => {
    const { slug } = await nyFagside('Bivirkningsstoff')
    const mal = JSON.parse(readFileSync(new URL('../../supabase/maler/bivirkningsimport.json', import.meta.url), 'utf8'))
    await db.exec(`select intern.endring_start('claude-code', '${AGENTFIL}', 'Syntetisk bivirkningsimport');
      select bivirkninger.importer('${JSON.stringify({ ...mal, stoff: slug }).replaceAll("'", "''")}'::jsonb);`)
    const { endringer } = await logg(leser, { stoff: slug })
    expect(endringer[0]).toMatchObject({
      aktor: 'agent',
      agent: { nokkel: 'claude-code' },
      oppsummering: 'Syntetisk bivirkningsimport',
      migrasjon: AGENTFIL,
      verifisert: false,
      hendelser: [expect.objectContaining({ hendelse: 'bivirkning_importert' })],
    })
  })
})

describe('agentene', () => {
  it('fører en migrasjon som oppgir seg, på agenten, og bekrefter den mot migrasjonshistorikken', async () => {
    const { side, slug, kort } = await nyFagside()
    await db.exec(`
      select intern.endring_start('claude-code', '${AGENTFIL}', 'Teknisk retting av doseringskortet',
        array['https://github.com/peohol/far/pull/999']);
      select set_config('request.jwt.claims', '{"sub": "${admin}", "role": "authenticated"}', true);
      select public.lagre_utkast('${kort}', 1, '${JSON.stringify(kortinnhold(side, 'Rettet'))}');
      select public.publiser_utkast('${kort}', 2);
      insert into supabase_migrations.schema_migrations (version, name) values ('20991231000000', 'syntetisk_agentmigrasjon');`)
    const [endring] = (await logg(leser, { stoff: slug })).endringer
    expect(endring).toMatchObject({
      aktor: 'agent',
      agent: { nokkel: 'claude-code', navn: 'Claude Code', art: 'ki-agent' },
      oppsummering: 'Teknisk retting av doseringskortet',
      migrasjon: AGENTFIL,
      verifisert: true,
      lenker: ['https://github.com/peohol/far/pull/999'],
    })
  })

  it('viser en agent med profilen den har fått, også når profilen kommer etter koblingen', async () => {
    await db.query(`insert into public.agentprofiler (agent, brukernavn) values ('claude-code', 'syntetisk.bot')`)
    const bot = await opprettBruker(db, { brukernavn: 'syntetisk.bot', fornavn: 'Syntetisk', etternavn: 'Bot', rolle: 'user' })
    await db.query(`update public.profiles set avatar_path = $2 where id = $1`, [bot, `${bot}/avatar.webp`])
    const { side, slug, kort } = await nyFagside()
    await db.exec(`
      select intern.endring_start('claude-code', '${AGENTFIL}', 'Med profilbilde');
      select set_config('request.jwt.claims', '{"sub": "${admin}", "role": "authenticated"}', true);
      select public.lagre_utkast('${kort}', 1, '${JSON.stringify(kortinnhold(side, 'Med bilde'))}');
      select public.publiser_utkast('${kort}', 2);`)
    const [endring] = (await logg(leser, { stoff: slug })).endringer
    // Navnet er agentens; bildet er profilens.
    expect(endring).toMatchObject({
      aktor: 'agent',
      agent: { navn: 'Claude Code' },
      profil: { id: bot, first_name: 'Syntetisk', last_name: 'Bot', avatar_path: `${bot}/avatar.webp` },
    })
    await db.query(`delete from public.agentprofiler where agent = 'claude-code'`)
    expect((await logg(leser, { stoff: slug })).endringer[0]!.profil).toBeUndefined()

    // Koblingene leses bare gjennom loggen.
    expect(await feilFra(() => sql(leser, 'select * from public.agentprofiler'))).toBeTruthy()
  })

  it('knytter kuratorboten til profilen sin', async () => {
    const rader = await kall.fasit<{ agent: string; brukernavn: string }>('select agent, brukernavn from public.agentprofiler')
    expect(rader).toEqual([{ agent: 'chatgpt-monografkurator', brukernavn: 'kuratortest' }])
  })

  it('avviser en ukjent agent, et feil filnavn og en agent som oppgir seg for sent', async () => {
    expect((await feilFra(() => db.exec(`select intern.endring_start('ukjent', '${AGENTFIL}', 'x')`)))?.message).toMatch(
      /ikke registrert/,
    )
    expect((await feilFra(() => db.exec(`select intern.endring_start('claude-code', 'feil.sql', 'x')`)))?.message).toMatch(
      /eget filnavn/,
    )
    const { side, kort } = await nyFagside()
    const feil = await feilFra(() =>
      db.exec(`
        select set_config('request.jwt.claims', '{"sub": "${admin}", "role": "authenticated"}', true);
        select public.lagre_utkast('${kort}', 1, '${JSON.stringify(kortinnhold(side, 'For tidlig'))}');
        select intern.endring_start('claude-code', '${AGENTFIL}', 'For sent');`),
    )
    expect(feil?.message).toMatch(/før noe er endret/)
  })

  it('fører en migrasjon som ikke oppgir seg, som systemets', async () => {
    const { side, slug, kort } = await nyFagside()
    await db.exec(`
      select set_config('request.jwt.claims', '{"sub": "${admin}", "role": "authenticated"}', true);
      select public.lagre_utkast('${kort}', 1, '${JSON.stringify(kortinnhold(side, 'Uten agent'))}');`)
    const [rad] = await kall.fasit<{ aktor: string; agent: string }>(
      `select e.aktor, e.agent from public.objektrevisjoner r join public.innholdsendringer e on e.id = r.endring_id
       where r.objekt_id = $1 and r.revisjon = 2`,
      [kort],
    )
    expect(rad).toEqual({ aktor: 'system', agent: 'databasemigrasjon' })
    // En migrasjon er ingen rutine: den står i loggen uten at man ber om det.
    const { endringer } = await logg(admin, { stoff: slug }, { med_utkast: true })
    expect(endringer[0]).toMatchObject({ aktor: 'system', agent: { nokkel: 'databasemigrasjon', rutine: false } })
  })
})

describe('en kuratering', () => {
  const KILDE = 'Syntetisk kuratering'

  /** En kuratering av doseringskortet, med rapporten når den er oppgitt. */
  function kuratering(slug: string, kort: string, rapport: Record<string, unknown> | null, etter = '') {
    const rapportkall = rapport
      ? `perform intern.kuratering_rapport('chatgpt-monografkurator', '${AGENTFIL}', '${JSON.stringify(rapport)}'::jsonb);`
      : ''
    return `do $$ declare side uuid := intern.kuratering_start('${slug}'); begin
      perform intern.kuratering_lagre('${kort}', 1, '{"data": {"dokument": ${JSON.stringify(DOK('Kuratert'))}}}', '${KILDE}');
      ${rapportkall}
      ${etter}
    end $$;`
  }

  const RAPPORT = {
    oppsummering: 'Doseringen er kuratert mot preparatomtalen.',
    seksjoner: [{ seksjon: 'dosering', endret: ['Doseringen er skrevet om etter SPC 4.2.'] }],
    korrigeringer: ['Maksimal døgndose rettet.'],
    mangler: ['Dosering ved nedsatt nyrefunksjon er ikke dekket av kildene.'],
  }

  it('stopper uten rapport, og ingenting blir endret', async () => {
    const { slug, kort } = await nyFagside()
    const feil = await feilFra(() => db.exec(kuratering(slug, kort, null)))
    expect(feil?.message).toMatch(/må avsluttes med .*kuratering_rapport/)
    expect(await kall.revisjoner(kort)).toHaveLength(1)
  })

  it('stopper når rapporten ikke stemmer med det som ble endret', async () => {
    const { slug, kort } = await nyFagside()
    const mangler = await feilFra(() => db.exec(kuratering(slug, kort, { ...RAPPORT, seksjoner: [] })))
    expect(mangler?.message).toMatch(/nevner ikke alt som er endret: dosering \(endret\)/)
    const ekstra = await feilFra(() =>
      db.exec(
        kuratering(slug, kort, {
          ...RAPPORT,
          seksjoner: [...RAPPORT.seksjoner, { seksjon: 'indikasjon', nytt: ['Ny indikasjon.'] }],
        }),
      ),
    )
    expect(ekstra?.message).toMatch(/oppgir endringer som ikke er gjort: indikasjon \(nytt\)/)
    const ukjent = await feilFra(() => db.exec(kuratering(slug, kort, { ...RAPPORT, planlagt: ['x'] })))
    expect(ukjent?.message).toMatch(/ukjente felt: planlagt/)
    expect(await kall.revisjoner(kort)).toHaveLength(1)
  })

  it('stopper når noe endres etter rapporten', async () => {
    const { side, slug, kort } = await nyFagside()
    const nytt = `perform intern.kuratering_nytt(side, '${JSON.stringify({ ...kortinnhold(side, 'Etterpå'), panel: 'indikasjon' })}',
      '{}', '${KILDE}');`
    const feil = await feilFra(() => db.exec(kuratering(slug, kort, RAPPORT, nytt)))
    expect(feil?.message).toMatch(/endret etter at rapporten ble skrevet/)
    expect(await kall.revisjoner(kort)).toHaveLength(1)
  })

  it('føres som én endring fra agenten med rapporten', async () => {
    const { slug, kort } = await nyFagside()
    await db.exec(kuratering(slug, kort, RAPPORT))
    const [endring] = (await logg(leser, { stoff: slug })).endringer
    expect(endring).toMatchObject({
      aktor: 'agent',
      art: 'kuratering',
      agent: { nokkel: 'chatgpt-monografkurator' },
      oppsummering: RAPPORT.oppsummering,
      migrasjon: AGENTFIL,
      rapport: { seksjoner: RAPPORT.seksjoner, korrigeringer: RAPPORT.korrigeringer, mangler: RAPPORT.mangler },
    })
    expect(endring!.deler).toEqual([expect.objectContaining({ objekt: kort, fra: 1, til: 2, publisert: true })])
  })

  it('krever kildegrunnlaget når kurateringen legger til nye kilder', async () => {
    const { slug, kort } = await nyFagside()
    const referanse = `perform intern.kuratering_referanse('{"tittel": "Ny kilde", "forfattere": "B", "aar": "2026",
      "lenke": "https://example.org/kuratert-kilde-${slug}"}', '${KILDE}');`
    const sqlMedReferanse = (rapport: Record<string, unknown>) =>
      kuratering(slug, kort, null)
        .replace('perform intern.kuratering_lagre', () => `${referanse} perform intern.kuratering_lagre`)
        .replace(
          'end $$;',
          () => `perform intern.kuratering_rapport('chatgpt-monografkurator', '${AGENTFIL}', '${JSON.stringify(rapport)}'::jsonb); end $$;`,
        )
    expect((await feilFra(() => db.exec(sqlMedReferanse(RAPPORT))))?.message).toMatch(/kildegrunnlag/)
    await db.exec(sqlMedReferanse({ ...RAPPORT, kildegrunnlag: ['Ny kilde (2026)'] }))
  })

  it('fører ingenting når kurateringen alt er gjort', async () => {
    const { slug, kort } = await nyFagside()
    const for_ = await antall('public.innholdsendringer')
    await db.exec(`do $$ declare side uuid := intern.kuratering_start('${slug}'); begin
      perform intern.kuratering_rapport('chatgpt-monografkurator', '${AGENTFIL}', '${JSON.stringify(RAPPORT)}'::jsonb); end $$;`)
    expect(await antall('public.innholdsendringer')).toBe(for_)
    expect(kort).toBeTruthy()
  })
})

describe('loggen kan ikke endres', () => {
  it('verken endres, slettes eller tømmes, heller ikke av eieren', async () => {
    const [{ id }] = (await db.query<{ id: string }>('select id from public.innholdsendringer limit 1')).rows as [{ id: string }]
    expect((await feilFra(() => db.query(`update public.innholdsendringer set oppsummering = 'Ny' where id = $1`, [id])))?.code).toBe('42501')
    expect((await feilFra(() => db.query('delete from public.innholdsendringer where id = $1', [id])))?.code).toBe('42501')
    expect((await feilFra(() => db.query('truncate public.innholdsendringer cascade')))?.code).toBe('42501')
    expect((await feilFra(() => db.query('update public.innholdshendelser set data = $1', ['{}'])))?.code).toBe('42501')
    expect((await feilFra(() => db.query(`delete from public.endringsagenter where nokkel = 'claude-code'`)))?.code).toBe('42501')
  })

  it('kan ikke skrives gjennom data-API-et', async () => {
    for (const hvem of [admin, leser]) {
      const feil = await feilFra(() =>
        sql(hvem, `insert into public.innholdsendringer (aktor, utfort_av) values ('bruker', $1)`, [hvem]),
      )
      expect(feil?.code).toBe('42501')
    }
    const { rows } = await db.query<{ rolle: string; kan: boolean }>(
      `select rolle, has_function_privilege(rolle, 'intern.endring_start(text, text, text, text[])', 'execute') as kan
       from unnest(array['anon', 'authenticated', 'service_role']) rolle`,
    )
    expect(rows.every((r) => !r.kan)).toBe(true)
  })

  it('lar bare administratorer lese tabellene direkte', async () => {
    expect((await sql(leser, 'select * from public.innholdsendringer')).length).toBe(0)
    expect((await sql(admin, 'select * from public.innholdsendringer')).length).toBeGreaterThan(0)
  })
})

describe('endringene fra før loggen fantes', () => {
  it('fører ikke en kuratering av én fagside inn i loggen til en annen som senere siterer den samme referansen', async () => {
    // Slik det skjedde med kvetiapin og citalopram: referansen ble laget under
    // kurateringen av kvetiapin og først dagen etter sitert på citalopram. Sidene
    // har syntetiske navn, så de virkelige kurateringene i migrasjonene etterpå
    // ikke finner dem.
    const eldre = await nyDatabase({ til: LOGGMIGRASJON })
    const redaktor = await opprettBruker(eldre, { brukernavn: 'kurator', fornavn: 'Kari', etternavn: 'Kurator', rolle: 'admin' })
    const vanlig = await opprettBruker(eldre, { brukernavn: 'vanlig', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
    const k = faginnholdskall(eldre, redaktor)
    const kuratering = async (kilde: string, arbeid: (kall: (f: string, a: string) => Promise<string>) => Promise<void>) =>
      som(eldre, redaktor, async (tx) => {
        await tx.query(`select set_config('far.revisjonskilde', $1, true)`, [kilde])
        await arbeid(async (funksjon, argumenter) => {
          const { rows } = await tx.query<{ svar: { id?: string } }>(`select to_jsonb(public.${funksjon}(${argumenter})) as svar`)
          return rows[0]!.svar.id ?? ''
        })
      })
    const kort = (side: string, ref: string) =>
      `'innholdselement', '${JSON.stringify({ ...kortinnhold(side, 'Kort'), referanser: [ref] })}'::jsonb`

    let ref = ''
    await kuratering('Monografkuratering av kurert stoff 05.10.2026', async (f) => {
      const side = await f('opprett_utkast', `'infoside', '{"navn": "Kurert stoff"}'::jsonb`)
      ref = await f('opprett_utkast', `'referanse', '{"tittel": "Consensus Guidelines (syntetisk)", "forfattere": "A", "aar": "2026", "lenke": ""}'::jsonb`)
      const element = await f('opprett_utkast', kort(side, ref))
      for (const id of [side, ref, element]) await f('publiser_utkast', `'${id}', 1`)
    })
    await kuratering('Monografkuratering av siterende stoff 06.10.2026', async (f) => {
      const side = await f('opprett_utkast', `'infoside', '{"navn": "Siterende stoff"}'::jsonb`)
      const element = await f('opprett_utkast', kort(side, ref))
      for (const id of [side, element]) await f('publiser_utkast', `'${id}', 1`)
    })
    await kjorMigrasjoner(eldre, { fra: LOGGMIGRASJON })
    const les = async (stoff: string) =>
      (await k.rpc<{ les_endringslogg: Logg }>(vanlig, 'les_endringslogg', { side: { stoff } })).les_endringslogg

    const sitert = await les('siterende-stoff')
    expect(sitert.endringer).toHaveLength(1)
    expect(sitert.endringer[0]).toMatchObject({ oppsummering: 'Monografkuratering av siterende stoff 06.10.2026', aktor: 'system' })
    expect(objekterI(sitert).has(ref)).toBe(false)
    expect(JSON.stringify(sitert)).not.toContain('kurert stoff')

    // Hos siden der referansen ble laget, står den som før.
    const kurert = await les('kurert-stoff')
    expect(kurert.endringer).toHaveLength(1)
    expect(objekterI(kurert).has(ref)).toBe(true)
    expect(kurert.endringer[0]!.oppsummering).toBe('Monografkuratering av kurert stoff 05.10.2026')
  }, 120_000)

  it('settes sammen av revisjonene og publiseringene etter tidspunkt og person', async () => {
    const eldre = await nyDatabase({ til: LOGGMIGRASJON })
    const redaktor = await opprettBruker(eldre, { brukernavn: 'redaktor', fornavn: 'Eli', etternavn: 'Eldre', rolle: 'admin' })
    const vanlig = await opprettBruker(eldre, { brukernavn: 'vanlig', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
    const k = faginnholdskall(eldre, redaktor)
    const side = await k.opprett('infoside', { navn: 'Eldre stoff' })
    await k.publiser(side.id, 1)
    await kjorMigrasjoner(eldre, { fra: LOGGMIGRASJON })

    const { endringer } = await k.rpc<{ les_endringslogg: Logg }>(vanlig, 'les_endringslogg', { side: { stoff: 'eldre-stoff' } }).then(
      (r) => r.les_endringslogg,
    )
    expect(endringer).toEqual([
      expect.objectContaining({ eldre: true, aktor: 'bruker', person: { fornavn: 'Eli', etternavn: 'Eldre' }, utkast: false }),
    ])
  }, 120_000)
})
