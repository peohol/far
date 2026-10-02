/**
 * Stoffregisteret i databasen: inndelingen fra datafilen, kategoriene i to
 * nivåer, plasseringene, arkivet, papirkurven og slettingen for godt — mot en
 * ekte database bygd av migrasjonene.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { STOFFREGISTERDATA } from '../domain/stoffregister'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, som, type Faginnholdskall } from './hjelp/testdatabase'

interface Kategorirad {
  id: string
  forelder: string | null
  navn: string
  posisjon: number
  ikon: string | null
  arkivert_kl: string | null
}

interface Registerdata {
  kategorier: Kategorirad[]
  plasseringer: { stoff: string; kategori: string }[]
  status: { stoff: string; status: string; endret_av: string | null }[]
  sider: { id: string; slug: string; navn: string; innhold: boolean; oppsummering: unknown }[]
}

const DOK = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Syntetisk.' }] }] }

describe('stoffregisteret i databasen', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let admin: string
  let bruker: string

  const sql = <T = Record<string, unknown>>(hvem: string | null, tekst: string, parametre: unknown[] = []) =>
    som(db, hvem, async (tx) => (await tx.query<T>(tekst, parametre)).rows)
  const en = async <T>(hvem: string | null, tekst: string, parametre: unknown[] = []) =>
    Object.values((await sql<Record<string, T>>(hvem, tekst, parametre))[0]!)[0] as T
  const les = (hvem: string, tilstand = 'publisert') => en<Registerdata>(hvem, 'select public.les_stoffregister($1)', [tilstand])
  const kategori = async (hvem: string, navn: string, forelder: string | null = null) => {
    const data = await les(hvem)
    return data.kategorier.find((k) => k.navn === navn && k.forelder === forelder)
  }
  const nyKategori = (hvem: string, navn: string, forelder: string | null = null) =>
    en<string>(hvem, 'select public.opprett_stoffkategori($1, $2)', [navn, forelder])
  const plasseringer = async (stoff: string) =>
    (await les(admin)).plasseringer.filter((p) => p.stoff === stoff).map((p) => p.kategori)
  const status = async (stoff: string) => (await les(admin)).status.find((s) => s.stoff === stoff)?.status ?? null

  /** En publisert fagside, med et kort når `medKort`. */
  async function nySide(navn: string, medKort = false) {
    const side = await kall.opprett('infoside', { navn })
    await kall.publiser(side.id, 1)
    if (medKort) {
      const kort = await kall.opprett('innholdselement', {
        infoside: side.id,
        panel: 'identitet',
        posisjon: 0,
        elementtype: 'riktekst',
        data: { dokument: DOK },
      })
      await kall.publiser(kort.id, 1)
      return { side: side.id, kort: kort.id }
    }
    return { side: side.id, kort: null }
  }

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    kall = faginnholdskall(db, admin)
  }, 60_000)

  it('har inndelingen fra datafilen, med hvert stoff plassert', async () => {
    const data = await les(bruker)
    const topp = data.kategorier.filter((k) => !k.forelder)
    expect(topp.map((k) => k.navn)).toEqual([
      'Antidepressiver',
      'Stemningsstabiliserende',
      'Antipsykotika',
      'Antiepileptika',
      'Alkohol og GHB',
      'Benzodiazepiner og Z-hypnotika',
      'Opioider',
      'Stimulanter',
      'Cannabinoider',
      'Hallusinogene stoffer',
      'Antihypertensiver',
    ])
    expect(topp.map((k) => k.posisjon)).toEqual(topp.map((_, i) => i))
    // Hver kategori har ikonet sitt; underkategoriene vises med kategoriens.
    expect(topp.find((k) => k.navn === 'Opioider')?.ikon).toBe('katOpioider')
    expect(topp.every((k) => k.ikon?.startsWith('kat'))).toBe(true)
    const ssri = data.kategorier.find((k) => k.navn === 'SSRI')!
    expect(data.kategorier.find((k) => k.id === ssri.forelder)?.navn).toBe('Antidepressiver')
    expect(data.plasseringer.filter((p) => p.kategori === ssri.id).map((p) => p.stoff)).toContain('sertralin')
    const plassert = new Set(data.plasseringer.map((p) => p.stoff))
    for (const s of STOFFREGISTERDATA.stoffer) expect(plassert.has(s.slug), s.slug).toBe(true)
    // Ketamin står to steder, som i datafilen.
    expect(data.plasseringer.filter((p) => p.stoff === 'ketamin')).toHaveLength(2)
  })

  it('lar innloggede lage, gi nytt navn til og flytte kategorier i to nivåer', async () => {
    const a = await nyKategori(bruker, 'Testkategori A')
    const b = await nyKategori(bruker, 'Testkategori B')
    expect((await feilFra(() => nyKategori(bruker, 'testkategori a')))?.message).toMatch(/alt en kategori/)
    expect((await feilFra(() => nyKategori(bruker, 'Andre stoffer')))?.code).toBe('23514')
    const u = await nyKategori(bruker, 'Under', a)
    expect((await feilFra(() => nyKategori(bruker, 'For dypt', u)))?.code).toBe('P0002')
    // En kategori med underkategorier blir ikke selv en.
    expect((await feilFra(() => sql(bruker, 'select public.flytt_stoffkategori($1, $2, 0)', [a, b])))?.code).toBe('22023')

    await sql(bruker, 'select public.endre_stoffkategori($1, $2)', [u, 'Omdøpt'])
    await sql(bruker, 'select public.flytt_stoffkategori($1, $2, 0)', [u, b])
    expect((await kategori(bruker, 'Omdøpt', b))?.posisjon).toBe(0)

    await sql(bruker, 'select public.flytt_stoffkategori($1, null, 0)', [b])
    const topp = (await les(bruker)).kategorier.filter((k) => !k.forelder)
    expect(topp[0]!.id).toBe(b)
    expect(topp.map((k) => k.posisjon)).toEqual(topp.map((_, i) => i))
    expect((await feilFra(() => sql(null, 'select public.opprett_stoffkategori($1, null)', ['Anonym'])))?.code).toBe('42501')
  })

  it('arkiverer kategorier og henter dem tilbake sist', async () => {
    const k = await nyKategori(bruker, 'Arkiveres')
    await sql(bruker, 'select public.arkiver_stoffkategori($1, true)', [k])
    expect((await kategori(bruker, 'Arkiveres'))?.arkivert_kl).not.toBeNull()
    expect((await feilFra(() => sql(bruker, 'select public.plasser_stoff($1, null, $2)', ['sertralin', k])))?.code).toBe('P0002')
    await sql(bruker, 'select public.arkiver_stoffkategori($1, false)', [k])
    const topp = (await les(bruker)).kategorier.filter((x) => !x.forelder && !x.arkivert_kl)
    expect(topp.at(-1)?.id).toBe(k)
  })

  it('plasserer stoffer, og lar bare administratorer slette kategorier med stoffer', async () => {
    const fra = await nyKategori(bruker, 'Fra')
    const til = await nyKategori(bruker, 'Til')
    await sql(bruker, 'select public.plasser_stoff($1, null, $2)', ['litium', fra])
    expect(await plasseringer('litium')).toContain(fra)
    await sql(bruker, 'select public.plasser_stoff($1, $2, $3)', ['litium', fra, til])
    expect(await plasseringer('litium')).toContain(til)
    expect(await plasseringer('litium')).not.toContain(fra)

    await sql(bruker, 'select public.slett_stoffkategori($1)', [fra])
    expect(await kategori(bruker, 'Fra')).toBeUndefined()
    expect((await feilFra(() => sql(bruker, 'select public.slett_stoffkategori($1)', [til])))?.code).toBe('42501')
    await sql(admin, 'select public.slett_stoffkategori($1)', [til])
    expect(await plasseringer('litium')).not.toContain(til)
    // Stoffet står fortsatt der det sto fra før.
    expect((await plasseringer('litium')).length).toBeGreaterThan(0)
  })

  it('arkiverer stoffer og henter dem tilbake', async () => {
    await sql(bruker, 'select public.arkiver_stoff($1, true)', ['gabapentin'])
    expect(await status('gabapentin')).toBe('arkivert')
    expect((await les(admin)).status.find((s) => s.stoff === 'gabapentin')?.endret_av).toBe('Lars Leser')
    await sql(bruker, 'select public.arkiver_stoff($1, false)', ['gabapentin'])
    expect(await status('gabapentin')).toBeNull()
  })

  it('lar alle slette en side med bare navn, og bare administratorer en med innhold', async () => {
    const tom = await nySide('Tomside')
    const full = await nySide('Fullside', true)
    const data = await les(bruker)
    expect(data.sider.find((s) => s.id === tom.side)?.innhold).toBe(false)
    expect(data.sider.find((s) => s.id === full.side)).toMatchObject({ innhold: true, oppsummering: DOK })

    await sql(bruker, 'select public.slett_stoff($1)', ['tomside'])
    expect(await status('tomside')).toBe('papirkurv')
    expect((await feilFra(() => sql(bruker, 'select public.slett_stoff($1)', ['fullside'])))?.code).toBe('42501')
    expect((await feilFra(() => sql(bruker, 'select public.slett_stoff($1)', ['etanol'])))?.code).toBe('22023')
    expect((await feilFra(() => sql(bruker, 'select public.arkiver_stoff($1, true)', ['tomside'])))?.code).toBe('22023')

    // Den som slettet, kan angre det; ingen andre enn administratorene.
    const annen = await opprettBruker(db, { brukernavn: 'annen', fornavn: 'Anne', etternavn: 'Annen', rolle: 'user' })
    expect((await feilFra(() => sql(annen, 'select public.gjenopprett_stoff($1)', ['tomside'])))?.code).toBe('42501')
    await sql(bruker, 'select public.gjenopprett_stoff($1)', ['tomside'])
    expect(await status('tomside')).toBeNull()
    await sql(bruker, 'select public.slett_stoff($1)', ['tomside'])
    await sql(admin, 'select public.gjenopprett_stoff($1)', ['tomside'])
    expect(await status('tomside')).toBeNull()
  })

  it('sletter en side for godt med kortene, historikken, diskusjonene og favorittene', async () => {
    const { side, kort } = await nySide('Slettes', true)
    const k = await nyKategori(admin, 'Med slettet')
    await sql(bruker, 'select public.plasser_stoff($1, null, $2)', ['slettes', k])
    const dk = await en<string>(bruker, 'select public.opprett_diskusjonskategori($1, $2, $3)', ['stoff:slettes', 'Generelt', '💬'])
    await en(bruker, 'select public.opprett_diskusjon($1, $2, $3, null)', ['stoff:slettes', dk, 'Tråd'])
    await sql(bruker, 'select public.sett_stoffavoritt($1, true)', ['slettes'])

    expect((await feilFra(() => sql(admin, 'select public.slett_stoff_for_godt($1)', ['slettes'])))?.code).toBe('P0002')
    await sql(admin, 'select public.slett_stoff($1)', ['slettes'])
    expect((await feilFra(() => sql(bruker, 'select public.slett_stoff_for_godt($1)', ['slettes'])))?.code).toBe('42501')
    await sql(admin, 'select public.slett_stoff_for_godt($1)', ['slettes'])

    const igjen = await kall.fasit<{ n: number }>(
      `select (select count(*) from public.redigerbare_objekter where id = any($1::uuid[]))::int
            + (select count(*) from public.objektrevisjoner where objekt_id = any($1::uuid[]))::int
            + (select count(*) from public.objektpubliseringer where objekt_id = any($1::uuid[]))::int
            + (select count(*) from public.diskusjoner where side = 'stoff:slettes')::int
            + (select count(*) from public.stoffavoritter where stoff = 'slettes')::int
            + (select count(*) from public.stoffplasseringer where stoff = 'slettes')::int as n`,
      [[side, kort]],
    )
    expect(igjen[0]!.n).toBe(0)
    expect(await status('slettes')).toBe('fjernet')
    expect(await kall.fasit('select stoff, navn, objekter from public.slettede_stoffsider')).toEqual([
      { stoff: 'slettes', navn: 'Slettes', objekter: 2 },
    ])

    // Historikken er fortsatt uforanderlig utenom slettingen.
    const annen = await nySide('Står')
    expect((await feilFra(() => kall.fasit('delete from public.objektrevisjoner where objekt_id = $1', [annen.side])))?.code).toBe('42501')

    // En ny side med nøkkelen tar stoffet i bruk igjen.
    await nySide('Slettes')
    expect(await status('slettes')).toBeNull()
  })

  it('lar en side det pekes på, ligge i papirkurven', async () => {
    const { side } = await nySide('Hovedside')
    await kall.opprett('laboratorieanalytt', { kode: 'TSTHOVED', hovedside: side, komponenter: [side] })
    await sql(admin, 'select public.slett_stoff($1)', ['hovedside'])
    expect((await feilFra(() => sql(admin, 'select public.slett_stoff_for_godt($1)', ['hovedside'])))?.message).toMatch(/peker på den/)
    expect(await en<number>(admin, 'select public.tom_stoffpapirkurven()')).toBe(0)
    expect(await status('hovedside')).toBe('papirkurv')
  })

  it('rydder det som har ligget i papirkurven i mer enn 30 dager', async () => {
    await nySide('Gammel')
    await nySide('Fersk')
    await sql(bruker, 'select public.slett_stoff($1)', ['gammel'])
    await sql(bruker, 'select public.slett_stoff($1)', ['fersk'])
    await kall.fasit(`update public.stoffstatus set endret_kl = now() - interval '31 days' where stoff = 'gammel'`)
    expect(await en<number>(bruker, 'select public.rydd_stoffpapirkurven()')).toBe(1)
    expect(await status('gammel')).toBe('fjernet')
    expect(await status('fersk')).toBe('papirkurv')
  })

  it('lar plasseringene og statusen følge en side som får ny nøkkel', async () => {
    const { side } = await nySide('Gammelt navn')
    const k = await nyKategori(bruker, 'Følger')
    await sql(bruker, 'select public.plasser_stoff($1, null, $2)', ['gammelt-navn', k])
    await sql(bruker, 'select public.arkiver_stoff($1, true)', ['gammelt-navn'])
    await kall.lagre(side, 1, { navn: 'Nytt navn', slug: 'nytt-navn' })
    await kall.publiser(side, 2)
    expect(await plasseringer('nytt-navn')).toEqual([k])
    expect(await status('nytt-navn')).toBe('arkivert')
    expect(await plasseringer('gammelt-navn')).toEqual([])
  })

  it('viser andre bare det publiserte', async () => {
    await kall.opprett('infoside', { navn: 'Bare utkast' })
    expect((await les(admin, 'utkast')).sider.some((s) => s.slug === 'bare-utkast')).toBe(true)
    expect((await les(bruker, 'utkast')).sider.some((s) => s.slug === 'bare-utkast')).toBe(false)
  })

  it('har diskusjoner på helsiden', async () => {
    const id = await en<string>(bruker, 'select public.opprett_diskusjonskategori($1, $2, $3)', ['register:stoffregister', 'Struktur', '🗂️'])
    expect(id).toBeTruthy()
  })
})
