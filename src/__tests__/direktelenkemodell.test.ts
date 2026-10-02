/**
 * Direktelenkene som rene funksjoner: formen på lenkene, hva som godtas som en
 * lenke i appen, brikkene i rikteksten, og lesingen og navnet til det lenken
 * peker på.
 */
import { describe, expect, it } from 'vitest'
import { navnPaaSide, type Diskusjonssider } from '../diskusjoner/modell'
import { fullLenke, lagLenkemal, lenkeadresse, malFraAdresse, malFraLenke } from '../direktelenker/mal'
import { lenkedeler, lenkeetikett, lesLenkemaal, utdrag } from '../direktelenker/modell'
import { erTomt, klartekst, rensDokument } from '../faginnhold/riktekst'

const TRAAD = '0b8f6d7e-1c2a-4b3d-9e8f-123456789abc'
const KOMMENTAR = '9a8b7c6d-5e4f-4a3b-8c2d-0123456789ab'
const APP = 'https://ousfar.no'

const dok = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })

describe('lenkene', () => {
  it('har ID-ene i adressen, med kommentaren som et ledd til', () => {
    expect(lenkeadresse({ slag: 'diskusjon', id: TRAAD, kommentar: null })).toBe(`#/diskusjon/${TRAAD}`)
    expect(lenkeadresse({ slag: 'ide', id: TRAAD, kommentar: KOMMENTAR })).toBe(`#/ide/${TRAAD}/${KOMMENTAR}`)
    expect(fullLenke({ slag: 'ide', id: TRAAD, kommentar: null }, `${APP}/`)).toBe(`${APP}/#/ide/${TRAAD}`)
  })

  it('leser adressen tilbake, med små bokstaver, og avviser alt annet', () => {
    expect(malFraAdresse(`#/diskusjon/${TRAAD.toUpperCase()}/${KOMMENTAR}/`)).toEqual({ slag: 'diskusjon', id: TRAAD, kommentar: KOMMENTAR })
    expect(malFraAdresse(`#/ide/${TRAAD}`)).toEqual({ slag: 'ide', id: TRAAD, kommentar: null })
    for (const ugyldig of ['#/', '#/stoff/bupropion', `#/diskusjon/ikke-en-id`, `#/diskusjon/${TRAAD}/tull`, `#/tråd/${TRAAD}`, `#/ide/${TRAAD}/${KOMMENTAR}/mer`]) {
      expect(malFraAdresse(ugyldig)).toBeNull()
    }
    expect(lagLenkemal('kategori', TRAAD)).toBeNull()
  })

  it('godtar bare lenker til denne appen', () => {
    expect(malFraLenke(`  ${APP}/#/diskusjon/${TRAAD}  `, APP)).toEqual({ slag: 'diskusjon', id: TRAAD, kommentar: null })
    expect(malFraLenke(`#/ide/${TRAAD}`, APP)).toEqual({ slag: 'ide', id: TRAAD, kommentar: null })
    expect(malFraLenke(`https://annet.no/#/diskusjon/${TRAAD}`, APP)).toBeNull()
    expect(malFraLenke(`${APP}/#/stoff/bupropion`, APP)).toBeNull()
    expect(malFraLenke('ikke en lenke', APP)).toBeNull()
  })
})

describe('brikkene i rikteksten', () => {
  const medBrikke = (attrs: Record<string, unknown>) =>
    rensDokument({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Se ' }, { type: 'direktelenke', attrs }] }],
    })

  it('beholder målet og navnet, og teller som innhold', () => {
    const dokument = medBrikke({ slag: 'diskusjon', id: TRAAD.toUpperCase(), kommentar: KOMMENTAR, etikett: '  Bupropion ·\n💊 Dose ', ekstra: 1 })
    expect(dokument.content![0]!.content![1]).toEqual({
      type: 'direktelenke',
      attrs: { slag: 'diskusjon', id: TRAAD, kommentar: KOMMENTAR, etikett: 'Bupropion · 💊 Dose' },
    })
    expect(klartekst(dokument)).toBe('Se Bupropion · 💊 Dose')
    expect(erTomt(rensDokument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'direktelenke', attrs: { slag: 'ide', id: TRAAD, etikett: '' } }] }] }))).toBe(false)
  })

  it('gjør en brikke uten gyldig mål om til navnet, eller fjerner den', () => {
    expect(medBrikke({ slag: 'diskusjon', id: 'tull', etikett: 'Gammel tråd' }).content![0]!.content).toEqual([
      { type: 'text', text: 'Se ' },
      { type: 'text', text: 'Gammel tråd' },
    ])
    expect(medBrikke({ slag: 'side', id: TRAAD }).content![0]!.content).toEqual([{ type: 'text', text: 'Se ' }])
  })
})

describe('det lenken peker på', () => {
  const diskusjon = {
    slag: 'diskusjon',
    id: TRAAD,
    side: 'stoff:bupropion',
    tittel: 'Maksdose ved nyresvikt',
    kategori: { navn: 'Dosering', emoji: '💊' },
    forfatter: { first_name: 'Kari', last_name: 'Nordmann', username: 'kari' },
    opprettet_kl: '2026-10-01T10:00:00Z',
    tekst: dok('Hva gjør vi ved eGFR under 30?'),
    skjult: false,
    arkivert_kl: null,
    kommentarer: 3,
    kommentar: null,
  }

  it('leser en tråd, og gir den navnet med siden, emojien og overskriften', () => {
    const maal = lesLenkemaal({ slag: 'diskusjon', id: TRAAD, kommentar: null }, diskusjon)!
    expect(maal).toMatchObject({ slag: 'diskusjon', side: 'stoff:bupropion', forfatter: 'Kari Nordmann', utdrag: 'Hva gjør vi ved eGFR under 30?', kommentarer: 3 })
    expect(lenkeetikett(lenkedeler(maal, 'Bupropion'))).toBe('Bupropion · 💊 Maksdose ved nyresvikt')
  })

  it('tar med kommentaren, og bruker «Ukategoriserte» for en tråd uten kategori', () => {
    const mal = { slag: 'diskusjon' as const, id: TRAAD, kommentar: KOMMENTAR }
    const maal = lesLenkemaal(mal, {
      ...diskusjon,
      kategori: null,
      kommentar: { id: KOMMENTAR, forfatter: { first_name: '', last_name: '', username: 'ola' }, tekst: dok('Enig'), slettet: false, skjult: false },
    })!
    expect(lenkeetikett(lenkedeler(maal, 'Bupropion'))).toBe('Bupropion · 🫧 Maksdose ved nyresvikt · kommentar fra ola')
    // Kommentaren må finnes når lenken peker på den.
    expect(lesLenkemaal(mal, diskusjon)).toBeNull()
  })

  it('gir en idé navnet «Idéer» og overskriften', () => {
    const mal = { slag: 'ide' as const, id: TRAAD, kommentar: null }
    const maal = lesLenkemaal(mal, { ...diskusjon, slag: 'ide', side: undefined, idekategori: 'fag', overfort: true })!
    expect(maal).toMatchObject({ slag: 'ide', overfort: true })
    expect(lenkeetikett(lenkedeler(maal, ''))).toBe('Idéer · Maksdose ved nyresvikt')
    expect(lesLenkemaal({ ...mal, slag: 'diskusjon' }, { ...diskusjon, slag: 'ide' })).toBeNull()
  })

  it('korter ned utdraget', () => {
    expect(utdrag(dok('a '.repeat(300)), 20)).toBe('a a a a a a a a a a…')
    expect(utdrag(null)).toBe('')
  })
})

describe('navnet på siden', () => {
  const sider: Diskusjonssider = {
    fagsider: [{ side: 'stoff:bupropion', navn: 'Bupropion' }],
    fortolkninger: [{ side: 'fortolkning:hbup', navn: 'Fortolkning av Hydroksybupropion' }],
  }
  it('er navnet brukerne kjenner, eller nøkkelen når siden er ny', () => {
    expect(navnPaaSide(sider, 'stoff:bupropion')).toBe('Bupropion')
    expect(navnPaaSide(sider, 'fortolkning:hbup')).toBe('Fortolkning av Hydroksybupropion')
    expect(navnPaaSide(sider, 'stoff:ny-side')).toBe('ny-side')
    expect(navnPaaSide(sider, 'fortolkning:li')).toBe('Fortolkning av LI')
  })
})
