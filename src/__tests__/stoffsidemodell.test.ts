/**
 * De rene delene av stoffsidene: rikteksten, panelenes data, søket og
 * sidemodellen. Innholdet er syntetisk.
 */
import { describe, expect, it } from 'vitest'
import { byggSidemodell, publiseringsplan } from '../faginnhold/stoffside'
import { INGEN_REGLER, TOM_STOFFSIDE, type Regeldata, type Stoffsidedata, type Utgave } from '../faginnhold/lesing'
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
import { fold, indekserSide, sok, sokeord, sti, stoffidentitet, treffIntervaller, utdrag } from '../faginnhold/sok'
import { analytterForStoff } from '../domain/koblinger'
import { STOFFREGISTER } from '../domain/stoffregister'
import type { ThcRegelsettinnhold } from '../domain/thcTekster'
import type { Kommentarinnhold } from '../domain/kommentarobjekt'

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
        { type: 'codeBlock', content: [{ type: 'text', text: 'Kodeblokk', marks: [{ type: 'textStyle', attrs: { color: 'red' } }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'farlig', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
      ],
    })
    expect(renset).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Kodeblokk' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'farlig' }] },
      ],
    })
  })

  it('beholder overskrifter i to nivåer og skillelinjer', () => {
    const renset = rensDokument({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1, id: 'x' }, content: [{ type: 'text', text: 'Dosering', marks: [{ type: 'italic' }] }] },
        { type: 'horizontalRule', attrs: { farge: 'rød' }, content: [{ type: 'text', text: 'skjult' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Voksne' }] },
        { type: 'heading', attrs: { level: 5 }, content: [{ type: 'text', text: 'Dypere' }] },
        { type: 'heading', content: [{ type: 'text', text: 'Uten nivå' }] },
      ],
    })
    expect(renset).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Dosering', marks: [{ type: 'italic' }] }] },
        { type: 'horizontalRule' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Voksne' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Dypere' }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Uten nivå' }] },
      ],
    })
    expect(klartekst(renset)).toBe('Dosering\nVoksne\nDypere\nUten nivå')
    expect(erTomt(rensDokument({ type: 'doc', content: [{ type: 'horizontalRule' }] }))).toBe(true)
  })

  it('beholder sitater og kode, og leser sitatet blokk for blokk', () => {
    const renset = rensDokument({
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Første' }] },
            { type: 'text', text: 'løs' },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'f(x)', marks: [{ type: 'code' }] }] },
        { type: 'blockquote' },
      ],
    })
    expect(renset).toEqual({
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Første' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'løs' }] },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'f(x)', marks: [{ type: 'code' }] }] },
        { type: 'blockquote', content: [{ type: 'paragraph' }] },
      ],
    })
    expect(klartekst(renset)).toBe('Første\nløs\nf(x)')
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

  it('merker verdiene med stoffet når kilden oppgir moderstoffet og en metabolitt', () => {
    const s = (stoff: string, typisk: number, form = '') => ({ ...f(typisk, null, null, 'timer', form), stoff })
    const venlafaksin = { former: [s('Venlafaksin', 5), s('O-desmetylvenlafaksin', 11)] }
    expect(formaterFormverdier(venlafaksin)).toBe('Venlafaksin: 5 timer · O-desmetylvenlafaksin: 11 timer')
    expect(formaterFormverdier({ former: [s('Paliperidon', 24, 'Depotinjeksjon')] })).toBe('Paliperidon, Depotinjeksjon: 24 timer')
    expect(lesFormverdier(venlafaksin)).toEqual(venlafaksin)
    // Et tomt stoff lagres ikke: kortet gjelder da sidens stoff.
    expect(lesFormverdier({ former: [{ ...f(5, null, null), stoff: ' ' }] })).toEqual({ former: [f(5, null, null)] })

    const k = (...former: ReturnType<typeof f>[]) => kontrollerFormverdier({ former })
    expect(k(...venlafaksin.former)).toBeNull()
    expect(k(s('Venlafaksin', 5), f(11, null, null))).toMatch(/^Rad 2: Oppgi legemiddelformen eller stoffet/)
    expect(k(s('Venlafaksin', 5), s('venlafaksin', 6))).toMatch(/«Venlafaksin» står to ganger/)
    expect(k(s('Paliperidon', 5, 'Peroralt'), s('Paliperidon', 6, 'Depotinjeksjon'))).toBeNull()
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

/** En stoffside med et utkast som har endringer: siden, ett element og en referanse. */
function side(): Stoffsidedata {
  return {
    stoff: { id: 's', slug: 'testmiddel', navn: 'Testmiddel' },
    infoside: utgave('s', { navn: 'Testmiddel', panelreferanser: { farmakokinetikk: ['c'] } }, 2, 1),
    elementer: [
      element('e3', { panel: 'farmakokinetikk', posisjon: 1, elementtype: 'kinetikkort', data: { tittel: 'Metabolisme', ...tekstMed('a') } }),
      element('e2', { panel: 'farmakokinetikk', posisjon: 0, elementtype: 'kinetikkort', data: { tittel: 'Absorpsjon', ...tekstMed('b') } }),
      element('e1', { panel: 'dosering', data: tekstMed('b') }, 3, 2),
      element('fjernet', { panel: FJERNET, data: tekstMed('d') }, 2, 1),
    ],
    referanser: [ref('a', 'Kilde A'), ref('b', 'Kilde B', null), ref('c', 'Kilde C'), ref('d', 'Fjernetkilde')],
  }
}

const kommentar = (id: string, revisjon: number, publisert: number | null) =>
  utgave<Kommentarinnhold>(id, { navn: `Syntetisk ${id}`, tekst: 'Syntetisk tekst.', plassholdere: [] }, revisjon, publisert)

function intervallregelsett(id: string, kode: string, revisjon: number, publisert: number | null) {
  return utgave(
    id,
    {
      analyttkode: kode,
      enhet: 'nmol/L',
      desimaler: 0,
      skillepunkter: [10],
      intervaller: [
        { niva: 'under' as const, handling: null, kommentar: 'k1' },
        { niva: 'innenfor' as const, handling: null, kommentar: 'k2' },
      ],
      ringegrense: null,
      cutoff: null,
    },
    revisjon,
    publisert,
  )
}

function scenarioregelsett(id: string, modul: string, revisjon: number, publisert: number | null) {
  return utgave(id, { modul, analytter: ['TEST'], verdihjelp: '', forhold: [], parametere: [], scenarier: [] }, revisjon, publisert)
}

/**
 * Reglene stoffsiden viser, lest for seg etter analyttkoden og modulen:
 * ett regelsett per kode, ett scenarioregelsett per modul og THC-syrereglene.
 */
function regler(): Regeldata {
  return {
    regelsett: {
      TEST: {
        regelsett: intervallregelsett('rs-test', 'TEST', 2, 1),
        // Den ene kommentaren er endret, den andre ikke.
        kommentarer: [kommentar('k2', 1, 1), kommentar('k1', 2, 1)],
      },
      // Står foran TEST: kodene tas i alfabetisk rekkefølge. Deler kommentaren k1 med TEST.
      ANDRE: {
        regelsett: intervallregelsett('rs-andre', 'ANDRE', 1, null),
        kommentarer: [kommentar('k1', 2, 1), kommentar('k3', 1, null)],
      },
    },
    scenarioregelsett: {
      testgruppen: { regelsett: scenarioregelsett('sc-test', 'testgruppen', 3, 2), kommentarer: [kommentar('k4', 2, 1)] },
      // Uendret, med en uendret kommentar: ingenting å publisere.
      annengruppe: { regelsett: scenarioregelsett('sc-annen', 'annengruppe', 1, 1), kommentarer: [kommentar('k5', 1, 1)] },
    },
    thcregelsett: {
      // Innholdet leses ikke av publiseringsplanen.
      regelsett: utgave('thc', {} as ThcRegelsettinnhold, 2, 1),
      kommentarer: [kommentar('k6', 1, null)],
    },
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
      'tdm',
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
    expect(publiseringsplan(side(), regler())).toEqual([
      { slag: 'referanse', id: 'b', revisjon: 1 },
      { slag: 'infoside', id: 's', revisjon: 2 },
      { slag: 'innholdselement', id: 'e1', revisjon: 3 },
      { slag: 'innholdselement', id: 'fjernet', revisjon: 2 },
      // Regelsettene per analyttkode, i kodenes rekkefølge, hvert etter kommentarene det peker på.
      { slag: 'kommentar', id: 'k1', revisjon: 2 },
      { slag: 'kommentar', id: 'k3', revisjon: 1 },
      { slag: 'intervallregelsett', id: 'rs-andre', revisjon: 1 },
      // k1 er alt med, og k2 er uendret.
      { slag: 'intervallregelsett', id: 'rs-test', revisjon: 2 },
      // Så scenarioregelsettene per modul; den uendrede modulen gir ingenting.
      { slag: 'kommentar', id: 'k4', revisjon: 2 },
      { slag: 'scenarioregelsett', id: 'sc-test', revisjon: 3 },
      // Til sist THC-syrereglene.
      { slag: 'kommentar', id: 'k6', revisjon: 1 },
      { slag: 'thc_regelsett', id: 'thc', revisjon: 2 },
    ])
    expect(publiseringsplan(TOM_STOFFSIDE, INGEN_REGLER)).toEqual([])
  })

  it('publiserer stoffsiden uten noe om analyttene, og reglene uten noen side', () => {
    const plan = publiseringsplan(side(), INGEN_REGLER)
    // Stoffsiden har ingen laboratorieanalytt eller komponentsider å publisere.
    expect([...new Set(plan.map((s) => s.slag))]).toEqual(['referanse', 'infoside', 'innholdselement'])
    // Et stoff i registeret uten side i databasen kan likevel få reglene sine publisert.
    expect(publiseringsplan(TOM_STOFFSIDE, regler()).map((s) => s.id)).toEqual([
      'k1',
      'k3',
      'rs-andre',
      'rs-test',
      'k4',
      'sc-test',
      'k6',
      'thc',
    ])
  })

  it('publiserer ingenting når utkastet er det samme som det publiserte', () => {
    const publisert = <T,>(u: Utgave<T>): Utgave<T> => ({ ...u, publisert_revisjon: u.revisjon })
    const data = side()
    const uendret: Stoffsidedata = {
      ...data,
      infoside: publisert(data.infoside!),
      elementer: data.elementer.map(publisert),
      referanser: data.referanser.map(publisert),
    }
    expect(publiseringsplan(uendret, INGEN_REGLER)).toEqual([])
  })

  it('indekserer siden for søket, med stien til hvert treff', () => {
    const modell = byggSidemodell(side())
    const dokumenter = indekserSide({ stoff: 'testmiddel', navn: 'Testmiddel', koder: ['TEST'], komponenter: ['Testmiddel', 'Komponent'] }, modell)
    const treff = sok(dokumenter, 'metabol')
    expect(treff.map((t) => sti(t.dokument.sted))).toEqual([['Testmiddel', 'Farmakokinetikk', 'Metabolisme']])
    // Koden og navnet rangeres foran fritekst: den eksakte koden først, så
    // navnet som begynner med søket.
    const alle = sok(dokumenter, 'test')
    expect(alle.slice(0, 2).map((t) => t.dokument.felt)).toEqual(['kode', 'navn'])
    // Alle treffene er på stoffet, også koden og komponenten.
    expect(new Set(sok(dokumenter, 'komponent').map((t) => t.dokument.sted.side.stoff))).toEqual(new Set(['testmiddel']))
    // Det fjernede kortet søkes ikke i.
    expect(sok(dokumenter, 'fjernetkilde')).toEqual([])
    expect(sok(dokumenter, '')).toEqual([])
  })

  it('tar med preparatene fra legemiddeldataene i panelets plass i rekkefølgen', () => {
    const modell = byggSidemodell(side())
    const dokumenter = indekserSide({ stoff: 'testmiddel', navn: 'Testmiddel' }, modell, [
      { panel: 'preparater', element: { id: 'preparater-53', tittel: 'Tablett' }, felt: 'preparat', tekst: 'Syntetin' },
      { panel: 'ukjent', element: { id: 'x' }, felt: 'preparat', tekst: 'Står ikke på siden' },
    ])
    expect(sok(dokumenter, 'syntetin').map((t) => sti(t.dokument.sted))).toEqual([['Testmiddel', 'Preparater', 'Tablett']])
    expect(sok(dokumenter, 'står ikke')).toEqual([])
    // Preparatene står rett etter identiteten, foran panelene med faginnhold.
    const paneler = dokumenter.map((d) => d.sted.panel?.nokkel).filter(Boolean)
    expect(paneler[0]).toBe('preparater')
  })

  it('gir stoffet identiteten sin fra registeret og koblingene: aliasene, primære koder, og analyttenes navn og sekundære koder som komponent', () => {
    const nortriptylin = STOFFREGISTER.finn('nortriptylin')!
    const identitet = stoffidentitet(nortriptylin, analytterForStoff('nortriptylin'))
    expect(identitet).toEqual({
      stoff: 'nortriptylin',
      navn: 'Nortriptylin',
      koder: ['NOR'],
      // AMTNORSUM hører primært til Amitriptylin; her er koden bare en annen vei inn.
      komponenter: ['Nortriptylin', 'Nortriptylin', 'Amitriptylin + nortriptylin', 'Amitriptylin', 'Nortriptylin', 'AMTNORSUM'],
      aliaser: ['nortriptyline'],
    })
    const bupropion = stoffidentitet(STOFFREGISTER.finn('bupropion')!, analytterForStoff('bupropion'))
    expect(bupropion).toMatchObject({ stoff: 'bupropion', navn: 'Bupropion', koder: ['HBUP'], aliaser: ['Hydroksybupropion', 'hydroxybupropion'] })
    // Indeksert står metabolittens navn bare én gang, og alt peker på Bupropion.
    const dokumenter = indekserSide(bupropion, byggSidemodell(TOM_STOFFSIDE))
    expect(dokumenter.map((d) => [d.felt, d.tekst])).toEqual([
      ['navn', 'Bupropion'],
      ['kode', 'HBUP'],
      ['alias', 'Hydroksybupropion'],
      ['alias', 'hydroxybupropion'],
      ['komponent', 'Hydroksybupropion (kun aktiv metabolitt)'],
    ])
    expect(new Set(dokumenter.map((d) => d.sted.side.stoff))).toEqual(new Set(['bupropion']))
  })

  it('gir referansene en kort betegnelse til editoren', () => {
    expect(kortnavn({ tittel: 'T', forfattere: 'Nordmann O, Hansen K', aar: '2020', lenke: '' })).toBe('Nordmann 2020')
    expect(kortnavn({ tittel: 'En lang tittel', forfattere: '', aar: '', lenke: '' })).toBe('En lang tittel')
  })
})
