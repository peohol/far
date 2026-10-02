/**
 * Stoffregisteret i appen (`src/stoffregister/modell.ts`): svaret fra
 * `les_stoffregister`, endringene som vises før databasen har svart, og
 * reglene for hva som kan slettes. Reglene håndheves i databasen
 * (`stoffregisterdb.test.ts`); her prøves det appen sier før noen trykker.
 */
import { describe, expect, it } from 'vitest'
import { ANDRE_STOFFER_ID, byggStoffregister, STOFFREGISTERDATA, type Registerstruktur } from '../domain/stoffregister'
import { endreStruktur, erEkteKategori, kanSletteKategori, kanSletteStoff, lesRegisterdatabase } from '../stoffregister/modell'
import { GRUNNSTRUKTUR, kategoriid } from './hjelp/registerstruktur'

const NAA = '2026-10-02T08:00:00.000Z'

/** To kategorier, den ene med to underkategorier, og et stoff i hver. */
const LITEN: Registerstruktur = {
  kategorier: [
    { id: 'a', forelder: null, navn: 'A', posisjon: 0, ikon: null, arkivert_kl: null },
    { id: 'b', forelder: null, navn: 'B', posisjon: 1, ikon: null, arkivert_kl: null },
    { id: 'b1', forelder: 'b', navn: 'B1', posisjon: 0, ikon: null, arkivert_kl: null },
    { id: 'b2', forelder: 'b', navn: 'B2', posisjon: 1, ikon: null, arkivert_kl: null },
  ],
  plasseringer: [
    { stoff: 'x', kategori: 'a' },
    { stoff: 'y', kategori: 'b1' },
  ],
  status: [],
}

/** Kategoriene under `forelder` i rekkefølgen, etter navnet. */
const rekke = (s: Registerstruktur, forelder: string | null) =>
  s.kategorier
    .filter((k) => k.forelder === forelder)
    .sort((a, b) => a.posisjon - b.posisjon)
    .map((k) => k.navn)

describe('svaret fra databasen', () => {
  it('leser kategoriene, plasseringene, statusene og sidene, og hopper over rader uten det de skal ha', () => {
    const lest = lesRegisterdatabase({
      kategorier: [
        { id: 'a', forelder: null, navn: 'A', posisjon: 2, ikon: 'pill', arkivert_kl: null },
        { id: 'uten-navn' },
        'tull',
      ],
      plasseringer: [{ stoff: 'x', kategori: 'a' }, { stoff: 'x' }],
      status: [
        { stoff: 'x', status: 'arkivert', endret_kl: NAA, endret_av: 'Lars Leser' },
        { stoff: 'y', status: 'ukjent' },
      ],
      sider: [
        { id: '1', slug: 'x', navn: 'X', innhold: false, oppsummering: { type: 'doc', content: [] } },
        { id: '2', slug: 'y', navn: 'Y', oppsummering: 'ikke et dokument' },
        { slug: 'z' },
      ],
    })
    expect(lest.struktur.kategorier).toEqual([
      { id: 'a', forelder: null, navn: 'A', posisjon: 2, ikon: 'pill', arkivert_kl: null },
    ])
    expect(lest.struktur.plasseringer).toEqual([{ stoff: 'x', kategori: 'a' }])
    expect(lest.struktur.status).toEqual([{ stoff: 'x', status: 'arkivert', endret_kl: NAA, endret_av: 'Lars Leser' }])
    expect(lest.sider).toEqual([
      { id: '1', slug: 'x', navn: 'X', innhold: false, oppsummering: { type: 'doc', content: [] } },
      // Uten svar om innholdet regnes siden som en med innhold: da kan bare en administrator slette den.
      { id: '2', slug: 'y', navn: 'Y', innhold: true, oppsummering: null },
    ])
  })

  it('gir et tomt register for et svar som ikke er et register', () => {
    expect(lesRegisterdatabase(null)).toEqual({ sider: [], struktur: { kategorier: [], plasseringer: [], status: [] } })
  })
})

describe('endringene før databasen har svart', () => {
  it('gir en kategori nytt navn', () => {
    expect(rekke(endreStruktur(LITEN, { type: 'endre-kategori', kategori: 'a', navn: 'Ny' }), null)).toEqual(['Ny', 'B'])
  })

  it('flytter en kategori blant søsknene og mellom nivåene, og nummererer begge listene på nytt', () => {
    const ned = endreStruktur(LITEN, { type: 'flytt-kategori', kategori: 'a', forelder: null, indeks: 1 })
    expect(rekke(ned, null)).toEqual(['B', 'A'])

    const inn = endreStruktur(LITEN, { type: 'flytt-kategori', kategori: 'a', forelder: 'b', indeks: 1 })
    expect(rekke(inn, null)).toEqual(['B'])
    expect(rekke(inn, 'b')).toEqual(['B1', 'A', 'B2'])
    expect(inn.kategorier.find((k) => k.id === 'b')!.posisjon).toBe(0)

    // En plass utenfor lista er sist.
    expect(rekke(endreStruktur(LITEN, { type: 'flytt-kategori', kategori: 'b1', forelder: 'b', indeks: 9 }), 'b')).toEqual([
      'B2',
      'B1',
    ])
  })

  it('arkiverer en kategori, og henter den tilbake sist blant søsknene', () => {
    const arkivert = endreStruktur(LITEN, { type: 'arkiver-kategori', kategori: 'b1', arkivert: true }, NAA)
    expect(arkivert.kategorier.find((k) => k.id === 'b1')!.arkivert_kl).toBe(NAA)
    expect(arkivert.kategorier.find((k) => k.id === 'b2')!.posisjon).toBe(0)
    // Det samme en gang til endrer ingenting.
    expect(endreStruktur(arkivert, { type: 'arkiver-kategori', kategori: 'b1', arkivert: true })).toBe(arkivert)

    const tilbake = endreStruktur(arkivert, { type: 'arkiver-kategori', kategori: 'b1', arkivert: false })
    expect(tilbake.kategorier.find((k) => k.id === 'b1')!.arkivert_kl).toBeNull()
    expect(rekke(tilbake, 'b')).toEqual(['B2', 'B1'])
  })

  it('sletter en kategori med underkategoriene og plasseringene i dem', () => {
    const slettet = endreStruktur(LITEN, { type: 'slett-kategori', kategori: 'b' })
    expect(slettet.kategorier.map((k) => k.id)).toEqual(['a'])
    expect(slettet.plasseringer).toEqual([{ stoff: 'x', kategori: 'a' }])
  })

  it('flytter et stoff, legger det til i en kategori til, og tar det ut', () => {
    const flyttet = endreStruktur(LITEN, { type: 'plasser-stoff', stoff: 'x', fra: 'a', til: 'b2' })
    expect(flyttet.plasseringer).toEqual([
      { stoff: 'y', kategori: 'b1' },
      { stoff: 'x', kategori: 'b2' },
    ])
    const ekstra = endreStruktur(LITEN, { type: 'plasser-stoff', stoff: 'x', fra: null, til: 'b2' })
    expect(ekstra.plasseringer.filter((p) => p.stoff === 'x').map((p) => p.kategori)).toEqual(['a', 'b2'])
    const ut = endreStruktur(LITEN, { type: 'plasser-stoff', stoff: 'x', fra: 'a', til: null })
    expect(ut.plasseringer).toEqual([{ stoff: 'y', kategori: 'b1' }])
  })

  it('setter og fjerner statusen til et stoff', () => {
    const arkivert = endreStruktur(LITEN, { type: 'sett-status', stoff: 'x', status: 'arkivert' }, NAA)
    expect(arkivert.status).toEqual([{ stoff: 'x', status: 'arkivert', endret_kl: NAA, endret_av: null }])
    const slettet = endreStruktur(arkivert, { type: 'sett-status', stoff: 'x', status: 'papirkurv' }, NAA)
    expect(slettet.status.map((r) => r.status)).toEqual(['papirkurv'])
    expect(endreStruktur(slettet, { type: 'sett-status', stoff: 'x', status: null }).status).toEqual([])
  })
})

describe('hva som kan slettes', () => {
  const register = byggStoffregister(
    [
      { id: '1', slug: 'tom', navn: 'Tom', innhold: false },
      { id: '2', slug: 'full', navn: 'Full', innhold: true },
      { id: '3', slug: 'bupropion', navn: 'Bupropion', innhold: false },
    ],
    STOFFREGISTERDATA,
    GRUNNSTRUKTUR,
  )
  const stoff = (slug: string) => register.menystoff(slug)!

  it('lar alle slette en fagside som bare har et navn, og bare administratorer en med innhold', () => {
    expect(kanSletteStoff(stoff('tom'), false)).toEqual({ lov: true })
    expect(kanSletteStoff(stoff('full'), false)).toEqual({
      lov: false,
      grunn: 'Bare administratorer kan slette en fagside med innhold. Arkiver den i stedet.',
    })
    expect(kanSletteStoff(stoff('full'), true)).toEqual({ lov: true })
  })

  it('lar ingen slette et stoff fortolkningen lenker til, eller et uten fagside i databasen', () => {
    expect(kanSletteStoff(stoff('bupropion'), true).lov).toBe(false)
    expect(kanSletteStoff(stoff('amitriptylin'), true)).toMatchObject({ lov: false })
  })

  it('lar alle slette en tom kategori, og bare administratorer en med stoffer', () => {
    expect(kanSletteKategori({ stoffer: [] }, false)).toEqual({ lov: true })
    expect(kanSletteKategori({ stoffer: [stoff('tom')] }, false).lov).toBe(false)
    expect(kanSletteKategori({ stoffer: [stoff('tom')] }, true)).toEqual({ lov: true })
  })

  it('har «Andre stoffer» som det som står igjen, ikke en kategori å plassere i', () => {
    expect(erEkteKategori(ANDRE_STOFFER_ID)).toBe(false)
    expect(erEkteKategori(kategoriid('Antidepressiver', 'SSRI'))).toBe(true)
  })
})
