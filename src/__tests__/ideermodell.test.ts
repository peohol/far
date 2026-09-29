/**
 * Idéene uten database: sorteringen av lista, kommentartråden som tre,
 * lesingen av det databasen svarer, og tidspunktene slik de vises.
 */
import { describe, expect, it } from 'vitest'
import type { Profil } from '@delt/profil'
import {
  ARKIVFRIST_DAGER,
  STANDARDSORTERING,
  dagerTilSletting,
  idetilstand,
  oppgavekode,
  slettesKl,
  andrevalg,
  byggTraad,
  erNyKommentar,
  grupperIdeer,
  kortTid,
  kriterierFor,
  lesIdeoversikt,
  lesIdetraad,
  lesSortering,
  tekstTilLagring,
  velgForst,
  type Ide,
  type Kommentar,
} from '../ideer/modell'

const profiler = new Map<string, Pick<Profil, 'first_name' | 'last_name' | 'username'>>([
  ['u-ada', { first_name: 'Ada', last_name: 'Lovelace', username: 'ada' }],
  ['u-bo', { first_name: 'Bo', last_name: 'Bruker', username: 'bob' }],
  ['u-cy', { first_name: '', last_name: '', username: 'cyrus' }],
])

function ide(id: string, forfatter: string, kategori: Ide['kategori'], opprettet: string): Ide {
  return {
    id,
    forfatter_id: forfatter,
    kategori,
    tittel: id,
    opprettet_kl: opprettet,
    endret_kl: null,
    hjerter: 0,
    mitt_hjerte: false,
    arkivert_kl: null,
    oppgave: null,
    kommentarer: 0,
    nye_kommentarer: 0,
  }
}

const IDEER = [
  ide('a', 'u-bo', 'fag', '2026-09-01T10:00:00Z'),
  ide('b', 'u-ada', 'fag', '2026-09-03T10:00:00Z'),
  ide('c', 'u-ada', 'annet', '2026-09-02T10:00:00Z'),
  ide('d', 'u-cy', 'fag', '2026-09-03T10:00:00Z'),
  ide('e', 'u-bo', 'annet', '2026-09-04T10:00:00Z'),
]

const oversikt = (sortering = STANDARDSORTERING) =>
  grupperIdeer(IDEER, sortering, profiler).map((g) => [g.navn, g.ideer.map((i) => i.id).join('')])

describe('sorteringen', () => {
  it('grupperer etter kategori med alle tre overskriftene, nyeste først og bruker til slutt', () => {
    // b og d er like gamle; Ada kommer før cyrus.
    expect(oversikt()).toEqual([
      ['Fag', 'bda'],
      ['Funksjonalitet', ''],
      ['Annet', 'ec'],
    ])
  })

  it('grupperer etter bruker, med kategori og så tid under', () => {
    expect(oversikt({ forst: 'bruker', deretter: 'kategori' })).toEqual([
      ['Ada Lovelace', 'bc'],
      ['Bo Bruker', 'ae'],
      ['cyrus', 'd'],
    ])
    expect(oversikt({ forst: 'bruker', deretter: 'tid' })).toEqual([
      ['Ada Lovelace', 'bc'],
      ['Bo Bruker', 'ea'],
      ['cyrus', 'd'],
    ])
  })

  it('lar kategori sortere etter bruker før tid', () => {
    expect(oversikt({ forst: 'kategori', deretter: 'bruker' })).toEqual([
      ['Fag', 'bad'],
      ['Funksjonalitet', ''],
      ['Annet', 'ce'],
    ])
  })

  it('fyller ut det tredje kriteriet, og tid kan aldri stå først', () => {
    expect(kriterierFor(STANDARDSORTERING)).toEqual(['kategori', 'tid', 'bruker'])
    expect(kriterierFor({ forst: 'bruker', deretter: 'kategori' })).toEqual(['bruker', 'kategori', 'tid'])
    expect(andrevalg('kategori')).toEqual(['tid', 'bruker'])
    expect(lesSortering({ forst: 'tid', deretter: 'kategori' })).toEqual(STANDARDSORTERING)
    expect(lesSortering({ forst: 'bruker', deretter: 'bruker' })).toEqual(STANDARDSORTERING)
    expect(lesSortering(null)).toEqual(STANDARDSORTERING)
    expect(lesSortering({ forst: 'bruker', deretter: 'kategori' })).toEqual({ forst: 'bruker', deretter: 'kategori' })
  })

  it('bytter plass på de to når det nye førstekriteriet stod som nummer to', () => {
    expect(velgForst({ forst: 'kategori', deretter: 'bruker' }, 'bruker')).toEqual({ forst: 'bruker', deretter: 'kategori' })
    expect(velgForst({ forst: 'kategori', deretter: 'tid' }, 'bruker')).toEqual({ forst: 'bruker', deretter: 'tid' })
  })
})

describe('kommentartråden', () => {
  const k = (id: string, forelder: string | null, tid: string, slettet = false): Kommentar => ({
    id,
    forelder_id: forelder,
    forfatter_id: slettet ? null : 'u-ada',
    tekst: { type: 'doc', content: [{ type: 'paragraph' }] },
    slettet,
    opprettet_kl: `2026-09-27T${tid}:00Z`,
    endret_kl: null,
    hjerter: 0,
    mitt_hjerte: false,
  })

  it('bygger svar i svar med de eldste først, og teller svarene som ikke er slettet', () => {
    const tre = byggTraad([
      k('2', null, '12:00'),
      k('1', null, '11:00', true),
      k('1b', '1', '11:30'),
      k('1a', '1', '11:10'),
      k('1a1', '1a', '11:20'),
      k('borte', 'finnes-ikke', '13:00'),
    ])
    const vis = (noder: typeof tre): unknown => noder.map((n) => [n.kommentar.id, n.antallSvar, vis(n.svar)])
    expect(vis(tre)).toEqual([
      ['1', 3, [['1a', 1, [['1a1', 0, []]]], ['1b', 0, []]]],
      ['2', 0, []],
      ['borte', 0, []],
    ])
  })
})

describe('lesingen', () => {
  it('fjerner siteringer fra teksten og gir null for en tom beskrivelse', () => {
    const traad = lesIdetraad({
      id: 'x',
      forfatter_id: 'u-ada',
      kategori: 'fag',
      tittel: 'T',
      tekst: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hei' }, { type: 'sitering', attrs: { referanser: ['r1'] } }] }],
      },
      opprettet_kl: '2026-09-27T10:00:00Z',
      endret_kl: null,
      hjerter: 2,
      mitt_hjerte: true,
      kommentarer: [{ id: 'k', forelder_id: null, forfatter_id: null, slettet: true, tekst: null, opprettet_kl: '2026-09-27T11:00:00Z', hjerter: 0 }],
    })
    expect(traad?.tekst).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hei' }] }] })
    expect(traad?.kommentarer[0]).toMatchObject({ id: 'k', slettet: true, forfatter_id: null })
    expect(traad?.sist_sett).toBeNull()
    expect(lesIdetraad(null)).toBeNull()
    expect(tekstTilLagring({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '  ' }] }] })).toBeNull()
  })
})

describe('arkivet, oppgaven og det nye', () => {
  const rad = { id: 'x', forfatter_id: 'u-ada', kategori: 'fag', tittel: 'T', opprettet_kl: '2026-09-27T10:00:00Z', kommentarer: 3 }

  it('leser arkivtiden, oppgaven og de nye kommentarene, og godtar ingen ukjent oppgavestatus', () => {
    const [arkivert] = lesIdeoversikt([{ ...rad, arkivert_kl: '2026-09-28T10:00:00Z', oppgave: null, nye_kommentarer: 2 }])
    expect(arkivert).toMatchObject({ arkivert_kl: '2026-09-28T10:00:00Z', oppgave: null, nye_kommentarer: 2 })
    expect(idetilstand(arkivert!)).toBe('arkivert')

    const [overfort] = lesIdeoversikt([{ ...rad, oppgave: { id: 'o1', status: 'utfort', nummer: 7 } }])
    expect(overfort!.oppgave).toEqual({ id: 'o1', status: 'utfort', nummer: 7 })
    expect(idetilstand(overfort!)).toBe('overfort')

    const [ukjent] = lesIdeoversikt([{ ...rad, oppgave: { id: 'o1', status: 'avvist' } }])
    expect(ukjent).toMatchObject({ arkivert_kl: null, oppgave: null, nye_kommentarer: 0 })
    expect(idetilstand(ukjent!)).toBe('apen')
  })

  it('regner ut når en arkivert idé slettes', () => {
    const arkivert = '2026-09-01T10:00:00Z'
    expect(slettesKl(arkivert).toISOString()).toBe('2026-10-31T10:00:00.000Z')
    expect(dagerTilSletting(arkivert, new Date('2026-09-01T10:00:00Z'))).toBe(ARKIVFRIST_DAGER)
    expect(dagerTilSletting(arkivert, new Date('2026-10-30T12:00:00Z'))).toBe(1)
    expect(dagerTilSletting(arkivert, new Date('2026-11-05T12:00:00Z'))).toBe(0)
  })

  it('skriver nummeret til en utført oppgave med tre sifre', () => {
    expect(oppgavekode(7)).toBe('OPG-007')
    expect(oppgavekode(1234)).toBe('OPG-1234')
  })

  it('regner kommentarer fra andre etter forrige besøk som nye', () => {
    const k = (forfatter: string | null, tid: string, slettet = false): Kommentar => ({
      id: tid,
      forelder_id: null,
      forfatter_id: forfatter,
      tekst: { type: 'doc', content: [] },
      slettet,
      opprettet_kl: `2026-09-27T${tid}:00Z`,
      endret_kl: null,
      hjerter: 0,
      mitt_hjerte: false,
    })
    const sett = '2026-09-27T12:00:00Z'
    expect(erNyKommentar(k('u-bo', '12:30'), sett, 'u-ada')).toBe(true)
    expect(erNyKommentar(k('u-bo', '11:30'), sett, 'u-ada')).toBe(false)
    expect(erNyKommentar(k('u-ada', '12:30'), sett, 'u-ada')).toBe(false)
    expect(erNyKommentar(k(null, '12:30', true), sett, 'u-ada')).toBe(false)
    expect(erNyKommentar(k('u-bo', '11:30'), null, 'u-ada')).toBe(true)
  })
})

describe('tidspunktene', () => {
  const naa = new Date(2026, 8, 27, 15, 0)
  const iso = (d: Date) => d.toISOString()

  it('er korte og relative for det ferske, og datoer for det eldre', () => {
    expect(kortTid(iso(new Date(2026, 8, 27, 14, 59, 40)), naa)).toBe('nå')
    expect(kortTid(iso(new Date(2026, 8, 27, 14, 55)), naa)).toBe('for 5 min siden')
    expect(kortTid(iso(new Date(2026, 8, 27, 9, 5)), naa)).toBe('i dag 09:05')
    expect(kortTid(iso(new Date(2026, 8, 26, 23, 10)), naa)).toBe('i går 23:10')
    expect(kortTid(iso(new Date(2026, 8, 12, 12)), naa)).toMatch(/^12\. sep/)
    expect(kortTid(iso(new Date(2025, 8, 12, 12)), naa)).toMatch(/2025$/)
  })
})
