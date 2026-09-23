/**
 * De rene delene av analyttsidene: rikteksten, panelenes data, søket og
 * sidemodellen. Innholdet er syntetisk.
 */
import { describe, expect, it } from 'vitest'
import { byggSidemodell, publiseringsplan } from '../faginnhold/analyttside'
import { TOM_SIDE, type Analyttsidedata, type Utgave } from '../faginnhold/lesing'
import type { Innholdselementinnhold } from '../faginnhold/modell'
import {
  FJERNET,
  PANELREKKEFOLGE,
  formaterIntervall,
  formaterKontroll,
  kontrollerIntervall,
  lesDosetabell,
  lesIntervallverdi,
  lesKontrolldato,
  lesPreparater,
  lesRiktekst,
  lesTallfelt,
  medKontrolldato,
  ryddPreparater,
  tallTilFelt,
} from '../faginnhold/paneler'
import { SITERING, kortnavn } from '../faginnhold/referanser'
import { erTomt, klartekst, rensDokument, tomtDokument } from '../faginnhold/riktekst'
import { fold, indekserSide, sok, sokeord, sti, treffIntervaller, utdrag } from '../faginnhold/sok'

describe('rikteksten', () => {
  it('beholder den tillatte formateringen og siteringene', () => {
    const dokument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'H', marks: [{ type: 'bold' }, { type: 'italic' }] },
            { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
            { type: SITERING, attrs: { referanser: ['a', 'b', 'a'] } },
            { type: 'hardBreak' },
            { type: 'text', text: 'lenke', marks: [{ type: 'link', attrs: { href: 'https://example.org', target: '_blank' } }] },
          ],
        },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'én' }] }] }] },
      ],
    }
    expect(rensDokument(dokument)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'H', marks: [{ type: 'bold' }, { type: 'italic' }] },
            { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
            { type: SITERING, attrs: { referanser: ['a', 'b'] } },
            { type: 'hardBreak' },
            { type: 'text', text: 'lenke', marks: [{ type: 'link', attrs: { href: 'https://example.org' } }] },
          ],
        },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'én' }] }] }] },
      ],
    })
  })

  it('tar bort formatering som ikke er tillatt, men beholder teksten', () => {
    const renset = rensDokument({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Overskrift', marks: [{ type: 'textStyle', attrs: { color: 'red' } }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'farlig', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
      ],
    })
    expect(renset).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Overskrift' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'farlig' }] },
      ],
    })
  })

  it('gjør alt som ikke er et dokument, til et tomt dokument', () => {
    for (const verdi of [null, 'tekst', 42, [], { type: 'paragraph' }]) expect(rensDokument(verdi)).toEqual(tomtDokument())
    expect(erTomt(tomtDokument())).toBe(true)
    expect(erTomt(rensDokument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: SITERING, attrs: { referanser: ['a'] } }] }] }))).toBe(false)
  })

  it('gir teksten uten formatering, blokk for blokk', () => {
    const dokument = rensDokument({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Første ' }, { type: 'text', text: 'avsnitt', marks: [{ type: 'bold' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'punkt' }] }] }] },
      ],
    })
    expect(klartekst(dokument)).toBe('Første avsnitt\npunkt')
  })
})

describe('datakortene', () => {
  it('viser et område, en grense eller ingenting', () => {
    const v = (nedre: number | null, ovre: number | null, enhet = 'nmol/L') => formaterIntervall({ nedre, ovre, enhet, forbehold: '' })
    expect(v(10, 300)).toBe('10–300 nmol/L')
    expect(v(0.5, 1.25)).toBe('0,5–1,25 nmol/L')
    expect(v(1500, null)).toBe('fra 1\u00a0500 nmol/L')
    expect(v(null, 20, 'timer')).toBe('opptil 20 timer')
    expect(v(20, 20, 'døgn')).toBe('20 døgn')
    expect(v(null, null)).toBe('')
  })

  it('leser tall slik de tastes, og avviser det som ikke er tall', () => {
    expect(lesTallfelt('')).toBeNull()
    expect(lesTallfelt(' 10,5 ')).toBe(10.5)
    expect(lesTallfelt('1 500')).toBe(1500)
    expect(lesTallfelt('0.25')).toBe(0.25)
    expect(lesTallfelt('ca. 10')).toBeUndefined()
    expect(lesTallfelt('10-20')).toBeUndefined()
    expect(tallTilFelt(10.5)).toBe('10,5')
    expect(tallTilFelt(null)).toBe('')
  })

  it('kontrollerer grensene rett på og rundt der de møtes', () => {
    const k = (nedre: number | null, ovre: number | null, enhet = 'nmol/L') => kontrollerIntervall({ nedre, ovre, enhet, forbehold: '' })
    expect(k(10, 10)).toBeNull()
    expect(k(10, 10.000001)).toBeNull()
    expect(k(10.000001, 10)).toMatch(/Nedre grense/)
    expect(k(10, null, '')).toMatch(/enheten/)
    expect(k(null, null, 'nmol/L')).toMatch(/minst én grense/)
    expect(k(null, null, '')).toBeNull()
  })

  it('tåler data som ikke ser ut som ventet', () => {
    expect(lesIntervallverdi({ nedre: '10', ovre: Infinity, enhet: 5 })).toEqual({ nedre: null, ovre: null, enhet: '', forbehold: '' })
    expect(lesIntervallverdi(null)).toEqual({ nedre: null, ovre: null, enhet: '', forbehold: '' })
  })
})

describe('preparatnavnene og tabellen', () => {
  it('lagrer preparatnavnene hver for seg, alfabetisk og uten gjentakelser', () => {
    expect(ryddPreparater(['Zeta', ' alfa ', '', 'Ærlig', 'ZETA', 'Øst', 'beta'])).toEqual(['alfa', 'beta', 'Zeta', 'Ærlig', 'Øst'])
    expect(lesPreparater({ navn: ['B', 3, 'A'] })).toEqual({ navn: ['A', 'B'], kontrollert: '' })
  })

  it('leser tabellradene og hopper over tomme', () => {
    expect(
      lesDosetabell({ rader: [{ dose: ' 100 mg ', regime: 'x1', konsentrasjon: '', merknad: '' }, { dose: '' }, 'tull'] }),
    ).toEqual({ rader: [{ dose: '100 mg', regime: 'x1', konsentrasjon: '', merknad: '' }] })
  })
})

describe('kontrollen mot Felleskatalogen', () => {
  it('leser bare gyldige datoer', () => {
    expect(lesKontrolldato('2026-09-23')).toBe('2026-09-23')
    expect(lesKontrolldato('2026-02-30')).toBe('')
    expect(lesKontrolldato('23.09.2026')).toBe('')
    expect(lesKontrolldato(20260923)).toBe('')
  })

  it('står i dataene bare når datoen er oppgitt', () => {
    expect(medKontrolldato({ navn: ['A'] }, '2026-09-23')).toEqual({ navn: ['A'], kontrollert: '2026-09-23' })
    expect(medKontrolldato({ navn: ['A'] }, '')).toEqual({ navn: ['A'] })
    expect(lesPreparater({ navn: ['A'], kontrollert: '2026-09-23' }).kontrollert).toBe('2026-09-23')
    expect(lesRiktekst({ dokument: tomtDokument(), kontrollert: 'i går' }).kontrollert).toBe('')
  })

  it('vises med kilden og norsk dato', () => {
    expect(formaterKontroll('Felleskatalogen', '2026-09-23')).toBe('Kontrollert mot Felleskatalogen 23.09.2026')
    expect(formaterKontroll('Felleskatalogen', '')).toBe('')
  })
})

describe('søket', () => {
  it('ser bort fra store og små bokstaver, aksenter og æøå, tegn for tegn', () => {
    expect(fold('Øsofagus Café ÆRE å')).toBe('osofagus cafe are a')
    expect(fold('Øsofagus').length).toBe('Øsofagus'.length)
    expect(sokeord('  Nor  nor TRIP ')).toEqual(['nor', 'trip'])
  })

  it('finner ordene i den opprinnelige teksten, uten overlapp', () => {
    expect(treffIntervaller('Nortriptylin og nortriptylin', ['nor'])).toEqual([
      [0, 3],
      [16, 19],
    ])
    expect(treffIntervaller('abcdef', ['bcd', 'cde'])).toEqual([[1, 5]])
    expect(treffIntervaller('Blå', ['bla'])).toEqual([[0, 3]])
  })

  it('lager et utdrag rundt det første treffet', () => {
    const lang = `${'a '.repeat(60)}midten${' b'.repeat(60)}`
    const u = utdrag(lang, ['midten'])
    expect(u.tekst.startsWith('…')).toBe(true)
    expect(u.tekst.endsWith('…')).toBe(true)
    const [start, slutt] = u.treff[0]!
    expect(u.tekst.slice(start, slutt)).toBe('midten')
  })
})

/* --- Sidemodellen --------------------------------------------------------- */

function utgave<T>(id: string, innhold: T, revisjon = 1, publisert: number | null = 1): Utgave<T> {
  return { id, revisjon, publisert_revisjon: publisert, innhold, endret_av_fornavn: '', endret_av_etternavn: '', endret_kl: '' }
}

function element(id: string, endring: Partial<Innholdselementinnhold>, revisjon = 1, publisert: number | null = 1) {
  return utgave<Innholdselementinnhold>(
    id,
    { infoside: 's', panel: 'dosering', posisjon: 0, elementtype: 'riktekst', data: {}, ...endring },
    revisjon,
    publisert,
  )
}

function tekstMed(...referanser: string[]) {
  return { dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Syntetisk tekst' }, { type: SITERING, attrs: { referanser } }] }] } }
}

const ref = (id: string, tittel: string, publisert: number | null = 1) =>
  utgave(id, { tittel, forfattere: 'Nordmann O', aar: '2020', lenke: '' }, 1, publisert)

function side(): Analyttsidedata {
  return {
    analytt: utgave('an', { kode: 'TEST', hovedside: 's', komponenter: ['s', 'k'] }),
    infoside: utgave('s', { navn: 'Testmiddel', panelreferanser: { farmakokinetikk: ['c'] } }, 2, 1),
    komponenter: [{ ...utgave('s', { navn: 'Testmiddel' }), koder: ['TEST'] }, { ...utgave('k', { navn: 'Komponent' }, 1, null), koder: [] }],
    elementer: [
      element('e3', { panel: 'farmakokinetikk', posisjon: 1, elementtype: 'kinetikkort', data: { tittel: 'Metabolisme', ...tekstMed('a') } }),
      element('e2', { panel: 'farmakokinetikk', posisjon: 0, elementtype: 'kinetikkort', data: { tittel: 'Absorpsjon', ...tekstMed('b') } }),
      element('e1', { panel: 'dosering', data: tekstMed('b') }, 3, 2),
      element('fjernet', { panel: FJERNET, data: tekstMed('d') }, 2, 1),
    ],
    referanser: [ref('a', 'Kilde A'), ref('b', 'Kilde B', null), ref('c', 'Kilde C'), ref('d', 'Fjernetkilde')],
  }
}

describe('sidemodellen', () => {
  it('sorterer elementene i panelene og holder de fjernede utenfor', () => {
    const modell = byggSidemodell(side())
    expect([...modell.paneler.keys()].sort()).toEqual(['dosering', 'farmakokinetikk'])
    expect(modell.paneler.get('farmakokinetikk')!.map((e) => e.id)).toEqual(['e2', 'e3'])
  })

  it('nummererer referansene i leserekkefølgen på siden', () => {
    const modell = byggSidemodell(side())
    // Dosering (B) før farmakokinetikken, der panelets C kommer før kortene
    // Absorpsjon (B) og Metabolisme (A). D står bare i et fjernet kort og får ikke nummer.
    expect(PANELREKKEFOLGE.indexOf('dosering')).toBeLessThan(PANELREKKEFOLGE.indexOf('farmakokinetikk'))
    expect([...modell.nummerering]).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ])
    expect(modell.referanseliste.map((r) => r.referanse.tittel)).toEqual(['Kilde B', 'Kilde C', 'Kilde A'])
  })

  it('publiserer i den rekkefølgen databasen krever, og bare det som er endret', () => {
    expect(publiseringsplan(side())).toEqual([
      { slag: 'referanse', id: 'b', revisjon: 1 },
      { slag: 'komponent', id: 'k', revisjon: 1 },
      { slag: 'infoside', id: 's', revisjon: 2 },
      { slag: 'innholdselement', id: 'e1', revisjon: 3 },
      { slag: 'innholdselement', id: 'fjernet', revisjon: 2 },
    ])
    expect(publiseringsplan(TOM_SIDE)).toEqual([])
  })

  it('indekserer siden for søket, med stien til hvert treff', () => {
    const modell = byggSidemodell(side())
    const dokumenter = indekserSide({ kode: 'TEST', navn: 'Testmiddel', komponenter: ['Testmiddel', 'Komponent'] }, modell)
    const treff = sok(dokumenter, 'metabol')
    expect(treff.map((t) => sti(t.dokument.sted))).toEqual([['Testmiddel', 'Farmakokinetikk', 'Metabolisme']])
    // Navnet og koden rangeres foran fritekst.
    const alle = sok(dokumenter, 'test')
    expect(alle[0]!.dokument.felt).toBe('navn')
    // Det fjernede kortet søkes ikke i.
    expect(sok(dokumenter, 'fjernetkilde')).toEqual([])
    expect(sok(dokumenter, '')).toEqual([])
  })

  it('gir referansene en kort betegnelse til editoren', () => {
    expect(kortnavn({ tittel: 'T', forfattere: 'Nordmann O, Hansen K', aar: '2020', lenke: '' })).toBe('Nordmann 2020')
    expect(kortnavn({ tittel: 'En lang tittel', forfattere: '', aar: '', lenke: '' })).toBe('En lang tittel')
  })
})
