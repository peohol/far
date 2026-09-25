/**
 * De rene delene av analyttsidene: rikteksten, panelenes data, søket og
 * sidemodellen. Innholdet er syntetisk.
 */
import { describe, expect, it } from 'vitest'
import { byggSidemodell, publiseringsplan } from '../faginnhold/analyttside'
import { TOM_SIDE, type Analyttsidedata, type Utgave } from '../faginnhold/lesing'
import type { Innholdselementinnhold } from '../faginnhold/modell'
import {
  DATAKORT,
  DATAKORTGRUPPER,
  FJERNET,
  PANELREKKEFOLGE,
  datakortHarVerdi,
  delFormverdi,
  delIntervall,
  formaterFormverdier,
  formaterIntervall,
  fraPlussMinus,
  kontrollerFormverdier,
  kontrollerIntervall,
  lesFormverdier,
  lesDosetabell,
  lesIntervallverdi,
  lesLegemiddelkobling,
  lesTallfelt,
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
    expect(v(1500, null)).toBe('> 1\u00a0500 nmol/L')
    expect(v(null, 20, 'timer')).toBe('opptil 20 timer')
    expect(v(20, 20, 'døgn')).toBe('20 døgn')
    expect(v(null, null)).toBe('')
  })

  it('deler verdien i forledd, tall og enhet, som til sammen er teksten som søkes i', () => {
    const verdi = (nedre: number | null, ovre: number | null, enhet = 'nmol/L') => ({ nedre, ovre, enhet, forbehold: '' })
    expect(delIntervall(verdi(10, 300))).toEqual({ forledd: '', tall: '10–300', enhet: 'nmol/L' })
    expect(delIntervall(verdi(1500, null))).toEqual({ forledd: '>', tall: '1\u00a0500', enhet: 'nmol/L' })
    expect(delIntervall(verdi(null, 20, ''))).toEqual({ forledd: 'opptil', tall: '20', enhet: '' })
    expect(delIntervall(verdi(null, null))).toBeNull()
    for (const v of [verdi(10, 300), verdi(1500, null), verdi(null, 20, '')]) {
      const d = delIntervall(v)!
      expect([d.forledd, d.tall, d.enhet].filter(Boolean).join(' ')).toBe(formaterIntervall(v))
    }
  })

  it('står i to grupper: konsentrasjonene og kinetikken', () => {
    expect(DATAKORTGRUPPER.map((g) => g.tittel)).toEqual(['Konsentrasjoner i serum', 'Kinetikk'])
    const iGruppe = (gruppe: string) => DATAKORT.filter((k) => k.gruppe === gruppe).map((k) => k.type)
    expect(iGruppe('konsentrasjon')).toEqual(['referanseomrade', 'toksisk_omrade', 'alvorlig_intoksikasjon'])
    expect(iGruppe('kinetikk')).toEqual(['halveringstid', 'steady_state'])
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

describe('t₁/₂ og tₛₛ per legemiddelform', () => {
  const f = (typisk: number | null, min: number | null, maks: number | null, enhet = 'timer', form = '') => ({ form, typisk, min, maks, enhet })

  it('viser typisk verdi med området i parentes, bare den typiske, eller bare området', () => {
    expect(formaterFormverdier({ former: [f(33, 29, 37)] })).toBe('33 (29–37) timer')
    expect(formaterFormverdier({ former: [f(33, null, null)] })).toBe('33 timer')
    expect(formaterFormverdier({ former: [f(null, 29, 37)] })).toBe('29–37 timer')
    expect(formaterFormverdier({ former: [f(5.5, 3.5, 19, 'dager')] })).toBe('5,5 (3,5–19) dager')
    expect(delFormverdi(f(33, 29, 37))).toEqual({ typisk: '33', omrade: '29–37', enhet: 'timer' })
    expect(delFormverdi(f(null, null, null))).toBeNull()
  })

  it('viser formene etter hverandre, med navnet foran', () => {
    const haloperidol = { former: [f(5, null, null, 'døgn', 'Peroralt'), f(null, 2, 4, 'måneder', 'Depotinjeksjon')] }
    expect(formaterFormverdier(haloperidol)).toBe('Peroralt: 5 døgn · Depotinjeksjon: 2–4 måneder')
  })

  it('regner «33 ± 4» om til 33 (29–37), uten flyttallsstøy', () => {
    expect(fraPlussMinus(33, 4)).toEqual({ typisk: 33, min: 29, maks: 37 })
    expect(fraPlussMinus(6.6, 0.3)).toEqual({ typisk: 6.6, min: 6.3, maks: 6.9 })
  })

  it('leser de eldre kortene med ett område som én verdi uten form', () => {
    expect(lesFormverdier({ nedre: 16, ovre: 40, enhet: 'timer', forbehold: '' })).toEqual({ former: [f(null, 16, 40)] })
    expect(lesFormverdier({ nedre: 24, ovre: 24, enhet: 'timer', forbehold: 'Peroralt.' })).toEqual({ former: [f(24, null, null)] })
    expect(lesFormverdier({ nedre: null, ovre: null, enhet: '', forbehold: '' })).toEqual({ former: [] })
    expect(lesFormverdier(null)).toEqual({ former: [] })
  })

  it('tåler former som ikke ser ut som ventet, og hopper over tomme', () => {
    const lest = lesFormverdier({ former: [{ form: ' Peroralt ', typisk: '5', min: 3, maks: 7, enhet: 'døgn' }, { form: 'Tom' }, 'feil'] })
    expect(lest).toEqual({ former: [f(null, 3, 7, 'døgn', 'Peroralt')] })
  })

  it('ser om et kort har noe å vise, etter formen på verdien', () => {
    const [ht, ref] = [DATAKORT.find((k) => k.type === 'halveringstid')!, DATAKORT.find((k) => k.type === 'referanseomrade')!]
    expect(datakortHarVerdi(ht, { former: [f(33, null, null)] })).toBe(true)
    expect(datakortHarVerdi(ht, { former: [] })).toBe(false)
    expect(datakortHarVerdi(ht, { nedre: 1, ovre: 2, enhet: 'timer' })).toBe(true)
    expect(datakortHarVerdi(ref, { nedre: 1, ovre: null, enhet: 'nmol/L' })).toBe(true)
    expect(datakortHarVerdi(ref, { former: [f(33, null, null)] })).toBe(false)
  })

  it('kontrollerer verdiene rett på og rundt grensene', () => {
    const k = (...former: ReturnType<typeof f>[]) => kontrollerFormverdier({ former })
    expect(k(f(33, 29, 37))).toBeNull()
    expect(k(f(29, 29, 37))).toBeNull()
    expect(k(f(37, 29, 37))).toBeNull()
    expect(k(f(28.9, 29, 37))).toMatch(/mellom minimum og maksimum/)
    expect(k(f(37.1, 29, 37))).toMatch(/mellom minimum og maksimum/)
    expect(k(f(null, 37, 37))).toBeNull()
    expect(k(f(null, 37.1, 37))).toMatch(/Minimum kan ikke/)
    expect(k(f(33, 29, null))).toMatch(/både minimum og maksimum/)
    expect(k(f(33, null, null, ''))).toMatch(/enheten/)
    expect(k(f(null, null, null))).toMatch(/typisk verdi, et område/)
    expect(k(f(5, null, null, 'døgn', 'Peroralt'), f(3, null, null, 'måneder'))).toMatch(/Oppgi legemiddelformen/)
    expect(k(f(5, null, null, 'døgn', 'Peroralt'), f(3, null, null, 'døgn', 'peroralt'))).toMatch(/står to ganger/)
    expect(k()).toBeNull()
  })
})

describe('koblingen til legemiddeldataene og tabellen', () => {
  it('leser koblingen til virkestoffene med ID-ene, uten gjentakelser og feilformede', () => {
    expect(
      lesLegemiddelkobling({
        virkestoff: [
          { fest_id: 'ID_A', navn: 'Alfa' },
          { fest_id: 'ID_A', navn: 'Alfa igjen' },
          { fest_id: '', navn: 'Uten ID' },
          { navn: 'Bare navn' },
          'tull',
          { fest_id: ' ID_B ', navn: 3 },
        ],
      }),
    ).toEqual({ virkestoff: [{ fest_id: 'ID_A', navn: 'Alfa' }, { fest_id: 'ID_B', navn: '' }] })
    expect(lesLegemiddelkobling(null)).toEqual({ virkestoff: [] })
  })

  it('leser tabellradene og hopper over tomme', () => {
    expect(
      lesDosetabell({ rader: [{ dose: ' 100 mg ', regime: 'x1', konsentrasjon: '', merknad: '' }, { dose: '' }, 'tull'] }),
    ).toEqual({ rader: [{ dose: '100 mg', regime: 'x1', konsentrasjon: '', merknad: '' }] })
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
    regelsett: {
      regelsett: utgave(
        'rs',
        {
          analyttkode: 'TEST',
          enhet: 'nmol/L',
          desimaler: 0,
          skillepunkter: [10],
          intervaller: [
            { niva: 'under', handling: null, kommentar: 'k1' },
            { niva: 'innenfor', handling: null, kommentar: 'k2' },
          ],
          ringegrense: null,
          cutoff: null,
        },
        2,
        1,
      ),
      // Den ene kommentaren er endret, den andre ikke.
      kommentarer: [
        utgave('k2', { navn: 'TEST – innenfor referanseområdet', tekst: 'Syntetisk middels.', plassholdere: [] }, 1, 1),
        utgave('k1', { navn: 'TEST – under referanseområdet', tekst: 'Syntetisk lav.', plassholdere: [] }, 2, 1),
      ],
    },
    thcregelsett: null,
    scenarioregelsett: null,
  }
}

describe('sidemodellen', () => {
  it('sorterer elementene i panelene og holder de fjernede utenfor', () => {
    const modell = byggSidemodell(side())
    expect([...modell.paneler.keys()].sort()).toEqual(['dosering', 'farmakokinetikk'])
    expect(modell.paneler.get('farmakokinetikk')!.map((e) => e.id)).toEqual(['e2', 'e3'])
  })

  it('har panelene i monografens rekkefølge', () => {
    expect(PANELREKKEFOLGE).toEqual([
      'identitet',
      'viktige_data',
      'farmakodynamikk',
      'indikasjon',
      'preparater',
      'dosering',
      'farmakokinetikk',
      'farmakogenetikk',
      'interaksjoner',
      'serumkonsentrasjoner',
    ])
  })

  it('nummererer referansene i leserekkefølgen på siden', () => {
    const modell = byggSidemodell(side())
    // Dosering (B) før farmakokinetikken, der kortene Absorpsjon (B) og
    // Metabolisme (A) kommer før panelets C i referansefeltet nederst. D står
    // bare i et fjernet kort og får ikke nummer.
    expect(PANELREKKEFOLGE.indexOf('dosering')).toBeLessThan(PANELREKKEFOLGE.indexOf('farmakokinetikk'))
    expect([...modell.nummerering]).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
    ])
    expect(modell.referanseliste.map((r) => r.referanse.tittel)).toEqual(['Kilde B', 'Kilde A', 'Kilde C'])
  })

  it('publiserer i den rekkefølgen databasen krever, og bare det som er endret', () => {
    expect(publiseringsplan(side())).toEqual([
      { slag: 'referanse', id: 'b', revisjon: 1 },
      { slag: 'komponent', id: 'k', revisjon: 1 },
      { slag: 'infoside', id: 's', revisjon: 2 },
      { slag: 'innholdselement', id: 'e1', revisjon: 3 },
      { slag: 'innholdselement', id: 'fjernet', revisjon: 2 },
      // Kommentarene regelsettet peker på, før regelsettet.
      { slag: 'kommentar', id: 'k1', revisjon: 2 },
      { slag: 'intervallregelsett', id: 'rs', revisjon: 2 },
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

  it('tar med preparatene fra legemiddeldataene i panelets plass i rekkefølgen', () => {
    const modell = byggSidemodell(side())
    const dokumenter = indekserSide({ kode: 'TEST', navn: 'Testmiddel', komponenter: [] }, modell, [
      { panel: 'preparater', element: { id: 'preparater-53', tittel: 'Tablett' }, felt: 'preparat', tekst: 'Syntetin' },
      { panel: 'ukjent', element: { id: 'x' }, felt: 'preparat', tekst: 'Står ikke på siden' },
    ])
    expect(sok(dokumenter, 'syntetin').map((t) => sti(t.dokument.sted))).toEqual([['Testmiddel', 'Preparater', 'Tablett']])
    expect(sok(dokumenter, 'står ikke')).toEqual([])
    // Preparatene står rett etter identiteten, foran panelene med faginnhold.
    const paneler = dokumenter.map((d) => d.sted.panel?.nokkel).filter(Boolean)
    expect(paneler[0]).toBe('preparater')
  })

  it('gir referansene en kort betegnelse til editoren', () => {
    expect(kortnavn({ tittel: 'T', forfattere: 'Nordmann O, Hansen K', aar: '2020', lenke: '' })).toBe('Nordmann 2020')
    expect(kortnavn({ tittel: 'En lang tittel', forfattere: '', aar: '', lenke: '' })).toBe('En lang tittel')
  })
})
