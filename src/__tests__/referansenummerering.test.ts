/**
 * Nummereringen av referansene på en side, pillene og listen nederst.
 *
 * Numrene lagres aldri; de regnes ut etter første forekomst i leserekkefølgen
 * på akkurat den siden. Testene prøver regelen — ikke bare ett eksempel — ved
 * å flytte og endre innhold og se at numrene følger med.
 */
import { describe, expect, it } from 'vitest'
import {
  SITERING,
  forekomster,
  erAutomatisk,
  feltreferanser,
  formaterReferanse,
  komprimer,
  nummerer,
  pilletekst,
  referanseoppforinger,
  referansetekst,
  sidereferanser,
  siteringer,
  type Referanse,
  type Sideelement,
  type Sidegrunnlag,
} from '../faginnhold/referanser'

function sitering(...referanser: string[]) {
  return { type: SITERING, attrs: { referanser } }
}

function tekst(...deler: (string | ReturnType<typeof sitering>)[]) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: deler.map((del) => (typeof del === 'string' ? { type: 'text', text: del } : del)),
      },
    ],
  }
}

function kort(id: string, panel: string, posisjon: number, endringer: Partial<Sideelement> = {}): Sideelement {
  return { id, panel, posisjon, data: {}, ...endringer }
}

function ref(id: string, endringer: Partial<Referanse> = {}): Referanse {
  return { id, tittel: `Tittel ${id}`, forfattere: 'Forfatter', aar: '2020', lenke: '', ...endringer }
}

/** Numrene som et vanlig objekt, så forventningene blir lette å lese. */
function numre(side: Sidegrunnlag, panelrekkefolge: string[] = []) {
  return Object.fromEntries(nummerer(forekomster(side, panelrekkefolge)))
}

describe('formatet', () => {
  it('følger Slaids: Tittel · Forfatter(e) · År · Lenke', () => {
    const referanse = ref('a', { tittel: 'Tittel', forfattere: 'A, B', aar: '2019', lenke: 'https://example.org' })
    expect(formaterReferanse(referanse)).toBe('Tittel · A, B · 2019 · https://example.org')
    expect(referansetekst(referanse)).toBe('Tittel · A, B · 2019')
  })

  it('hopper over tomme ledd uten å etterlate skilletegn', () => {
    expect(formaterReferanse(ref('a', { tittel: '', forfattere: ' ', aar: '2019', lenke: 'https://x.no' }))).toBe(
      '2019 · https://x.no',
    )
    expect(formaterReferanse(ref('a', { tittel: 'Bare tittel', forfattere: '', aar: '', lenke: '' }))).toBe(
      'Bare tittel',
    )
  })
})

describe('siteringene i en tekst', () => {
  it('finnes i dokumentrekkefølge, også dypt inne i lister og tabeller', () => {
    const data = {
      tekst: {
        type: 'doc',
        content: [
          tekst('a', sitering('x')),
          { type: 'bulletList', content: [{ type: 'listItem', content: [tekst(sitering('y', 'z'))] }] },
          tekst(sitering('x')),
        ],
      },
    }
    expect(siteringer(data)).toEqual([['x'], ['y', 'z'], ['x']])
  })

  it('er uavhengige av rekkefølgen feltene i dataene står i', () => {
    const a = { b: tekst(sitering('2')), a: tekst(sitering('1')) }
    const b = { a: tekst(sitering('1')), b: tekst(sitering('2')) }
    expect(siteringer(a)).toEqual(siteringer(b))
  })

  it('overser tomme og ødelagte siteringer', () => {
    expect(siteringer({ tekst: [{ type: SITERING }, sitering(), { type: SITERING, attrs: { referanser: 'x' } }] })).toEqual([])
    expect(siteringer(null)).toEqual([])
  })
})

describe('nummereringen etter første forekomst', () => {
  it('følger panelrekkefølgen, så kortrekkefølgen, så forekomsten i teksten', () => {
    const side: Sidegrunnlag = {
      panelreferanser: { b: ['p'] },
      elementer: [
        kort('k2', 'a', 2, { data: tekst(sitering('c')) }),
        kort('k1', 'a', 1, { data: tekst('x', sitering('b'), 'y', sitering('a')) }),
        kort('k3', 'b', 0, { data: tekst(sitering('d')) }),
      ],
    }
    expect(numre(side, ['a', 'b'])).toEqual({ b: 1, a: 2, c: 3, d: 4, p: 5 })
  })

  it('lar samme referanse beholde nummeret fra første gang, uansett hvor ofte den går igjen', () => {
    const side: Sidegrunnlag = {
      elementer: [
        kort('k1', 'a', 0, { data: tekst(sitering('x'), sitering('y'), sitering('x')) }),
        kort('k2', 'a', 1, { referanser: ['y'], data: tekst(sitering('x', 'z')) }),
      ],
    }
    expect(numre(side)).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('gir samme referanse ulike numre på ulike sider', () => {
    const sideA: Sidegrunnlag = { elementer: [kort('k', 'a', 0, { data: tekst(sitering('felles')) })] }
    const sideB: Sidegrunnlag = {
      elementer: [kort('k', 'a', 0, { data: tekst(sitering('en'), sitering('to'), sitering('felles')) })],
    }
    expect(numre(sideA).felles).toBe(1)
    expect(numre(sideB).felles).toBe(3)
  })

  it('setter teksten før kortets referanser, og kortene før panelets — referansefeltet står nederst', () => {
    const side: Sidegrunnlag = {
      panelreferanser: { a: ['panel'] },
      elementer: [kort('k', 'a', 0, { referanser: ['kort'], data: tekst(sitering('inline')) })],
    }
    expect(forekomster(side).map((f) => [f.niva, f.ider])).toEqual([
      ['inline', ['inline']],
      ['element', ['kort']],
      ['panel', ['panel']],
    ])
    expect(numre(side)).toEqual({ inline: 1, kort: 2, panel: 3 })
  })

  it('nummererer på nytt når et kort flyttes', () => {
    const elementer = [
      kort('k1', 'a', 0, { data: tekst(sitering('x')) }),
      kort('k2', 'a', 1, { data: tekst(sitering('y')) }),
    ]
    expect(numre({ elementer })).toEqual({ x: 1, y: 2 })
    const flyttet = [{ ...elementer[0]!, posisjon: 2 }, elementer[1]!]
    expect(numre({ elementer: flyttet })).toEqual({ y: 1, x: 2 })
  })

  it('nummererer på nytt når et panel flyttes eller en sitering fjernes', () => {
    const side: Sidegrunnlag = {
      elementer: [kort('k1', 'a', 0, { data: tekst(sitering('x')) }), kort('k2', 'b', 0, { data: tekst(sitering('y')) })],
    }
    expect(numre(side, ['a', 'b'])).toEqual({ x: 1, y: 2 })
    expect(numre(side, ['b', 'a'])).toEqual({ y: 1, x: 2 })

    const uten = { elementer: [kort('k1', 'a', 0), side.elementer[1]!] }
    expect(numre(uten, ['a', 'b'])).toEqual({ y: 1 })
  })

  it('bruker ID-en som skille når to kort står på samme plass, og alfabetet for ukjente paneler', () => {
    const side: Sidegrunnlag = {
      elementer: [
        kort('b-kort', 'z', 0, { data: tekst(sitering('2')) }),
        kort('a-kort', 'z', 0, { data: tekst(sitering('1')) }),
        kort('c', 'y', 0, { data: tekst(sitering('0')) }),
      ],
    }
    expect(numre(side)).toEqual({ '0': 1, '1': 2, '2': 3 })
    // Rekkefølgen på elementene i lista spiller ingen rolle.
    expect(numre({ elementer: [...side.elementer].reverse() })).toEqual(numre(side))
  })

  it('gir ikke nummer til referanser siden ikke kjenner, og hopper ikke over noe for dem', () => {
    const side: Sidegrunnlag = { elementer: [kort('k', 'a', 0, { data: tekst(sitering('ukjent', 'x'), sitering('y')) })] }
    expect(Object.fromEntries(nummerer(forekomster(side), new Set(['x', 'y'])))).toEqual({ x: 1, y: 2 })
  })
})

describe('pillene', () => {
  it('komprimerer serier på minst tre til intervall, og lar par stå', () => {
    expect(komprimer([1, 2, 3, 5, 9, 10, 11])).toBe('1–3, 5, 9–11')
    expect(komprimer([1, 2])).toBe('1, 2')
    expect(komprimer([1, 2, 4, 5])).toBe('1, 2, 4, 5')
    expect(komprimer([7])).toBe('7')
    expect(komprimer([])).toBe('')
    expect(komprimer([3, 1, 2, 2])).toBe('1–3')
    expect(komprimer([1, 3, 4, 5, 6, 8])).toBe('1, 3–6, 8')
  })

  it('viser numrene referansene har på siden, sortert, uansett rekkefølgen i siteringen', () => {
    const nummerering = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['e', 5],
    ])
    expect(pilletekst(['e', 'c', 'a', 'b'], nummerering)).toBe('1–3, 5')
    expect(pilletekst(['ukjent'], nummerering)).toBe('')
  })
})

describe('referanselisten nederst på siden', () => {
  it('har bare referansene som brukes, i samme rekkefølge som numrene', () => {
    const referanser = ['a', 'b', 'c', 'ubrukt'].map((id) => ref(id))
    const side: Sidegrunnlag = {
      panelreferanser: { p: ['c'] },
      elementer: [kort('k', 'p', 0, { referanser: ['b'], data: tekst(sitering('a', 'c')) })],
    }
    const { nummerering, liste } = sidereferanser(side, referanser, ['p'])
    expect(liste.map((o) => [o.nummer, o.referanse.id])).toEqual([
      [1, 'a'],
      [2, 'c'],
      [3, 'b'],
    ])
    expect(referanseoppforinger(nummerering, referanser)).toEqual(liste)
  })

  it('tar med samme referanse bare én gang, og følger med når innholdet endres', () => {
    const referanser = ['x', 'y'].map((id) => ref(id))
    const for_ = sidereferanser(
      { elementer: [kort('k', 'a', 0, { data: tekst(sitering('x'), sitering('y'), sitering('x')) })] },
      referanser,
    )
    expect(for_.liste.map((o) => o.referanse.id)).toEqual(['x', 'y'])
    const etter = sidereferanser(
      { elementer: [kort('k', 'a', 0, { data: tekst(sitering('y'), sitering('x')) })] },
      referanser,
    )
    expect(etter.liste.map((o) => o.referanse.id)).toEqual(['y', 'x'])
  })
})

describe('automatiske referanser i samme univers', () => {
  const fest = ref('fest:kilde', { automatisk: { kilde: 'FEST', opphav: 'Uttrekk fra 1. januar 2026' } })
  const dmp = ref('fest:1', { automatisk: { kilde: 'FEST' } })

  it('nummereres sammen med de redaksjonelle, etter første forekomst', () => {
    const side: Sidegrunnlag = {
      panelreferanser: { interaksjoner: ['red'], preparater: ['red'] },
      elementer: [kort('k', 'preparater', 0, { data: tekst(sitering('inline')) })],
      automatiske: {
        panelreferanser: { preparater: ['fest:kilde'], interaksjoner: ['fest:kilde'] },
        elementer: [
          { panel: 'interaksjoner', id: 'i1', referanser: ['fest:1'] },
          { panel: 'interaksjoner', id: 'i2', referanser: ['fest:1', 'inline'] },
        ],
      },
    }
    // Preparatene: teksten, så feltet med den redaksjonelle før FEST.
    // Interaksjonene: kortene, så feltet. Kjente referanser beholder nummeret.
    expect(numre(side, ['preparater', 'interaksjoner'])).toEqual({
      inline: 1,
      red: 2,
      'fest:kilde': 3,
      'fest:1': 4,
    })
    const { liste } = sidereferanser(side, [...['inline', 'red'].map((id) => ref(id)), fest, dmp], [
      'preparater',
      'interaksjoner',
    ])
    expect(liste.map((o) => [o.nummer, o.referanse.id, erAutomatisk(o.referanse)])).toEqual([
      [1, 'inline', false],
      [2, 'red', false],
      [3, 'fest:kilde', true],
      [4, 'fest:1', true],
    ])
  })

  it('setter de automatiske kortene etter de redaksjonelle, i den rekkefølgen de kommer', () => {
    const side: Sidegrunnlag = {
      elementer: [kort('k', 'a', 5, { referanser: ['red'] })],
      automatiske: {
        elementer: [
          { panel: 'a', id: 'z', referanser: ['z'] },
          { panel: 'a', id: 'y', referanser: ['y'] },
        ],
      },
    }
    expect(forekomster(side).map((f) => [f.element, !!f.automatisk])).toEqual([
      ['k', false],
      ['z', true],
      ['y', true],
    ])
  })

  it('forsvinner fra nummereringen og listen når kilden ikke lenger har dem, uten å etterlate hull', () => {
    const med: Sidegrunnlag = {
      elementer: [kort('k', 'a', 0, { data: tekst(sitering('x')) })],
      automatiske: { elementer: [{ panel: 'a', id: 'i', referanser: ['fest:1'] }] },
    }
    const uten: Sidegrunnlag = { elementer: med.elementer, automatiske: { elementer: [] } }
    const x = ref('x')
    expect(sidereferanser(med, [x, dmp]).liste.map((o) => o.referanse.id)).toEqual(['x', 'fest:1'])
    expect(sidereferanser(uten, [x]).liste.map((o) => [o.nummer, o.referanse.id])).toEqual([[1, 'x']])
  })

  it('viser redaksjonelle og automatiske panelreferanser i samme felt, uten gjentakelser', () => {
    const side: Sidegrunnlag = {
      panelreferanser: { p: ['a', 'fest:kilde'] },
      elementer: [],
      automatiske: { panelreferanser: { p: ['fest:kilde', 'b'] } },
    }
    expect(feltreferanser(side, 'p')).toEqual(['a', 'fest:kilde', 'b'])
    expect(feltreferanser(side, 'q')).toEqual([])
  })

  it('skiller opphavet: uten `automatisk` er referansen redaksjonell', () => {
    expect(erAutomatisk(ref('x'))).toBe(false)
    expect(erAutomatisk(fest)).toBe(true)
  })
})
