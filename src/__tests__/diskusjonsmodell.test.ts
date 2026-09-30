/**
 * Diskusjonene uten database: sidene trådene står på, lesingen av det
 * databasen svarer, grupperingen i kategorier, flyttingene slik lista viser
 * dem før de er lagret, reglene for navn og emoji, og søket.
 */
import { describe, expect, it } from 'vitest'
import {
  UKATEGORISERTE,
  adresseForSide,
  diskusjonssideFor,
  emojiFeil,
  erEnEmoji,
  flyttDiskusjon,
  flyttKategori,
  grupper,
  kategorinavnFeil,
  lesDiskusjonsoversikt,
  lesDiskusjonsside,
  lesDiskusjonstekster,
  lesDiskusjonstraad,
  ruteForSide,
  sokIDiskusjoner,
  type Diskusjon,
  type Diskusjonskategori,
  type Diskusjonsoversikt,
} from '../diskusjoner/modell'

const kategori = (id: string, navn: string, emoji: string, posisjon: number): Diskusjonskategori => ({ id, navn, emoji, posisjon })

const traad = (id: string, kategori_id: string | null, posisjon: number, ekstra: Partial<Diskusjon> = {}): Diskusjon => ({
  id,
  kategori_id,
  forfatter_id: 'ada',
  tittel: `Tråd ${id}`,
  posisjon,
  opprettet_kl: '2026-09-30T10:00:00Z',
  arkivert_kl: null,
  siste_kl: '2026-09-30T10:00:00Z',
  kommentarer: 0,
  nye_kommentarer: 0,
  usett: false,
  hjerter: 0,
  mitt_hjerte: false,
  ...ekstra,
})

const OVERSIKT: Diskusjonsoversikt = {
  kategorier: [kategori('b', 'Bivirkninger', '🩺', 1), kategori('a', 'Dosering', '💊', 0)],
  diskusjoner: [
    traad('1', 'a', 1),
    traad('2', 'a', 0, { usett: true }),
    traad('3', 'b', 0),
    traad('4', null, 0),
    traad('5', 'a', 2, { arkivert_kl: '2026-09-29T10:00:00Z' }),
    traad('6', 'b', 1, { arkivert_kl: '2026-09-30T09:00:00Z' }),
  ],
}

describe('sidene', () => {
  it('har diskusjoner på fagsidene og på fortolkningen av én analytt, ikke på forsiden eller søkesiden', () => {
    expect(diskusjonssideFor({ side: 'stoff', stoff: 'bupropion' })).toBe('stoff:bupropion')
    expect(diskusjonssideFor({ side: 'fortolkning', analytt: 'diaz-dmi-oxa' })).toBe('fortolkning:diaz-dmi-oxa')
    expect(diskusjonssideFor({ side: 'fortolkning' })).toBeNull()
    expect(diskusjonssideFor({ side: 'sok', q: 'x' })).toBeNull()
  })

  it('leder tilbake til siden tråden står på', () => {
    expect(adresseForSide('stoff:bupropion')).toBe('#/stoff/bupropion')
    expect(adresseForSide('fortolkning:hbup')).toBe('#/fortolkning/hbup')
    expect(ruteForSide('fortolkning:hbup')).toEqual({ side: 'fortolkning', analytt: 'hbup' })
    expect(ruteForSide('stoff:bupropion')).toEqual({ side: 'stoff', stoff: 'bupropion' })
  })

  it('godtar bare sider med formen databasen krever', () => {
    expect(lesDiskusjonsside('stoff:bupropion')).toBe('stoff:bupropion')
    for (const ugyldig of ['stoff:', 'stoff:Bupropion', 'annet:x', 'fortolkning:a--b', 42, null]) {
      expect(lesDiskusjonsside(ugyldig)).toBeNull()
    }
  })
})

describe('lesingen', () => {
  it('leser oversikten og utelater rader uten formen', () => {
    const lest = lesDiskusjonsoversikt({
      kategorier: [{ id: 'a', navn: 'Dosering', emoji: '💊', posisjon: 0 }, { id: 'x' }, 'tull'],
      diskusjoner: [{ id: '1', kategori_id: 'a', tittel: 'T', posisjon: '2', kommentarer: 3, usett: true, opprettet_kl: 'k' }, {}],
    })
    expect(lest.kategorier).toEqual([{ id: 'a', navn: 'Dosering', emoji: '💊', posisjon: 0 }])
    expect(lest.diskusjoner).toHaveLength(1)
    expect(lest.diskusjoner[0]).toMatchObject({ id: '1', posisjon: 2, kommentarer: 3, usett: true, siste_kl: 'k', arkivert_kl: null })
    expect(lesDiskusjonsoversikt(null)).toEqual({ kategorier: [], diskusjoner: [] })
  })

  it('leser tråden, og tar ikke med teksten i et skjult innlegg', () => {
    const tekst = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hei' }] }] }
    const rad = { id: 't', side: 'stoff:x', tittel: 'T', tekst, skjult: false, opprettet_kl: 'k', lest_kl: 'l', kommentarer: [] }
    expect(lesDiskusjonstraad(rad)?.tekst.content?.[0]?.content?.[0]?.text).toBe('Hei')
    expect(lesDiskusjonstraad({ ...rad, skjult: true })?.tekst.content?.[0]?.content).toBeUndefined()
    expect(lesDiskusjonstraad({ ...rad, side: 'feil' })).toBeNull()
    expect(lesDiskusjonstraad(null)).toBeNull()
  })

  it('gjør innleggene om til ren tekst til søket', () => {
    const avsnitt = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })
    expect(lesDiskusjonstekster([{ id: 't', tittel: 'T', tekster: [avsnitt('Første'), avsnitt(''), avsnitt('Andre')] }])).toEqual([
      { id: 't', tittel: 'T', tekster: ['Første', 'Andre'] },
    ])
  })
})

describe('grupperingen', () => {
  it('ordner kategoriene og trådene etter plassen, og samler de uten kategori og de arkiverte', () => {
    const { kategorier, ukategoriserte, arkiv } = grupper(OVERSIKT)
    expect(kategorier.map((g) => [g.kategori.id, g.diskusjoner.map((d) => d.id)])).toEqual([
      ['a', ['2', '1']],
      ['b', ['3']],
    ])
    expect(ukategoriserte.map((d) => d.id)).toEqual(['4'])
    // Den sist arkiverte først.
    expect(arkiv.map((d) => d.id)).toEqual(['6', '5'])
  })

  it('flytter en tråd mellom kategoriene og holder plassene tette i begge', () => {
    const flyttet = grupper(flyttDiskusjon(OVERSIKT, '2', 'b', 1))
    expect(flyttet.kategorier.map((g) => g.diskusjoner.map((d) => [d.id, d.posisjon]))).toEqual([
      [['1', 0]],
      [
        ['3', 0],
        ['2', 1],
      ],
    ])
  })

  it('flytter en tråd ut av «Ukategoriserte», og en plass utenfor lista blir sist', () => {
    const flyttet = grupper(flyttDiskusjon(OVERSIKT, '4', 'a', 99))
    expect(flyttet.ukategoriserte).toEqual([])
    expect(flyttet.kategorier[0]!.diskusjoner.map((d) => d.id)).toEqual(['2', '1', '4'])
  })

  it('flytter en kategori', () => {
    expect(grupper(flyttKategori(OVERSIKT, 'b', 0)).kategorier.map((g) => g.kategori.id)).toEqual(['b', 'a'])
    expect(flyttKategori(OVERSIKT, 'finnes-ikke', 0)).toBe(OVERSIKT)
  })
})

describe('navnene og emojiene', () => {
  it('kjenner én emoji fra bokstaver, tall og flere emojier', () => {
    for (const emoji of ['💊', '⚠️', '👩🏽‍⚕️', '🇳🇴', '🩺']) expect(erEnEmoji(emoji), emoji).toBe(true)
    for (const ikke of ['', 'A', '1', '💊💊', 'ø', '→', ' ']) expect(erEnEmoji(ikke), ikke).toBe(false)
  })

  it('krever unike navn og emojier på siden, og holder «Ukategoriserte» og 🫧 av veien', () => {
    const kategorier = OVERSIKT.kategorier
    expect(kategorinavnFeil('  ', kategorier)).toBe('Gi kategorien et navn.')
    expect(kategorinavnFeil('dosering', kategorier)).toBe('En annen kategori på siden har det navnet.')
    expect(kategorinavnFeil('Dosering', kategorier, 'a')).toBeNull()
    expect(kategorinavnFeil('ukategoriserte', kategorier)).toBe(`«${UKATEGORISERTE.navn}» er reservert.`)
    expect(kategorinavnFeil('x'.repeat(61), kategorier)).toMatch(/høyst 60/)
    expect(kategorinavnFeil('x'.repeat(60), kategorier)).toBeNull()
    expect(emojiFeil('💊', kategorier)).toBe('En annen kategori på siden har den emojien.')
    expect(emojiFeil('💊', kategorier, 'a')).toBeNull()
    expect(emojiFeil(UKATEGORISERTE.emoji, kategorier)).toMatch(/reservert/)
    expect(emojiFeil('ab', kategorier)).toBe('Skriv inn én emoji.')
    expect(emojiFeil('', kategorier)).toBe('Velg en emoji.')
  })
})

describe('søket', () => {
  const tekster = [
    { id: '1', tittel: 'Tråd 1', tekster: ['Hva med dosering ved nyresvikt?', 'Halver dosen.'] },
    { id: '3', tittel: 'Tråd 3', tekster: ['Kvalme er vanlig.'] },
  ]

  it('finner tråder der hvert ord står i overskriften eller et innlegg, med et utdrag', () => {
    const treff = sokIDiskusjoner('tråd nyresvikt', OVERSIKT.diskusjoner, tekster)
    expect(treff.map((t) => t.diskusjon.id)).toEqual(['1'])
    expect(treff[0]!.utdrag).toBe('Hva med dosering ved nyresvikt?')
  })

  it('gir ikke utdrag når alt står i overskriften, og tar med de arkiverte', () => {
    const treff = sokIDiskusjoner('TRÅD', OVERSIKT.diskusjoner, tekster)
    expect(treff.map((t) => t.diskusjon.id)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(treff.every((t) => t.utdrag === null)).toBe(true)
  })

  it('finner ingenting uten søk, eller når ett ord mangler', () => {
    expect(sokIDiskusjoner('  ', OVERSIKT.diskusjoner, tekster)).toEqual([])
    expect(sokIDiskusjoner('kvalme nyresvikt', OVERSIKT.diskusjoner, tekster)).toEqual([])
  })
})
