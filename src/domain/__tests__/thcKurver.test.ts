import { describe, expect, it } from 'vitest'
import importert from './fasit/thc-regelsett-import.json'
import { tidForVerdi as opprinneligTidForVerdi } from './hjelp/thcOpprinnelig'
import {
  forventetEndring,
  sammenlign,
  tidForVerdi,
  utskillelsesrate,
  verdiPaaKurve,
  type Kurve,
} from '../thcKurver'
import { kurverI, validerThcRegelsett, visIrcak, type ThcRegelsett } from '../thcRegelsett'

/**
 * Kurvene og beviset for at de står i rekkefølge (se `thcKurver.ts`).
 *
 * Kontrollen av rekkefølgen er et bevis over hele domenet — enhver forrige
 * prøve over 0 og ethvert tidsrom — ikke en prøve av utvalgte punkter.
 * Testene her viser at den godtar dagens kurver, at det den godtar holder
 * også langt utenfor det et rutenett ville dekket, og at det den avviser
 * faktisk bryter rekkefølgen der den sier.
 */
const REGELSETT = importert as ThcRegelsett
const KURVER = kurverI(REGELSETT)

/** Fast frø, så et avvik kan gjenskapes. */
function tilfeldig(frø: number) {
  let s = frø >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Kurve i kildeenheter, omregnet med regelsettets faktor. */
function kurve(a1: number, k1: number, a2: number, k2: number): Kurve {
  const f = REGELSETT.konverteringsfaktor
  return { a1: a1 * f, k1, a2: a2 * f, k2 }
}

/** Den gamle kontrollen: rekkefølgen prøvd på et rutenett av IRCAK og døgn. */
function holderPaaRutenett(raskere: Kurve, tregere: Kurve): boolean {
  return [0.01, 0.1, 1, 5, 20, 100, 1000].every((x) =>
    [1, 3, 7, 14, 30, 90].every((d) => forventetEndring(x, d, raskere) <= forventetEndring(x, d, tregere) + 1e-9),
  )
}

/** Om `raskere` forventer mindre nedgang enn `tregere` et sted nær `x`. */
function bruddNaer(raskere: Kurve, tregere: Kurve, xer: number[], dager: number[]): boolean {
  return xer.some((x) => dager.some((d) => forventetEndring(x, d, raskere) > forventetEndring(x, d, tregere)))
}

describe('kurveregningen', () => {
  it('finner tidspunktet som før innenfor ±1000 døgn, bit for bit', () => {
    const r = tilfeldig(1)
    for (let i = 0; i < 2000; i++) {
      const x = Math.exp(r() * 30 - 15)
      for (const k of Object.values(KURVER)) {
        expect(tidForVerdi(x, k)).toBe(opprinneligTidForVerdi(x, k))
      }
    }
  })

  it('finner tidspunktet også for verdier utenfor ±1000 døgn', () => {
    for (const x of [1e-9, 1e-30, 1e-200]) {
      const t = tidForVerdi(x, KURVER.rod)
      expect(t).toBeGreaterThan(1000)
      expect(verdiPaaKurve(t, KURVER.rod) / x).toBeCloseTo(1, 9)
    }
  })

  it('regner utskillelsesraten −C′/C riktig for en gitt konsentrasjon', () => {
    const r = tilfeldig(2)
    for (let i = 0; i < 500; i++) {
      const t = r() * 200 - 20
      for (const k of Object.values(KURVER)) {
        const c = verdiPaaKurve(t, k)
        const derivert = -(k.a1 * k.k1 * Math.exp(-k.k1 * t) + k.a2 * k.k2 * Math.exp(-k.k2 * t))
        expect(utskillelsesrate(k, c) / (-derivert / c)).toBeCloseTo(1, 9)
      }
    }
  })
})

describe('rekkefølgen for dagens kurver', () => {
  it('er bevist: grønn raskere enn gul, gul raskere enn rød', () => {
    expect(sammenlign(KURVER.gronn, KURVER.gul)).toBeNull()
    expect(sammenlign(KURVER.gul, KURVER.rod)).toBeNull()
    expect(sammenlign(KURVER.gronn, KURVER.rod)).toBeNull()
    expect(validerThcRegelsett(REGELSETT)).toEqual([])
  })

  it('holder i motoren fra IRCAK 1e-12 til 1e8 og over opptil 20 år', () => {
    const r = tilfeldig(3)
    for (let i = 0; i < 20_000; i++) {
      const x = Math.exp(r() * 46 - 27.6)
      const d = r() < 0.5 ? r() * 30 : r() * 7300
      const [g, y, rd] = [KURVER.gronn, KURVER.gul, KURVER.rod].map((k) => forventetEndring(x, d, k))
      expect(g! - y!, `IRCAK ${x}, ${d} døgn`).toBeLessThanOrEqual(1e-12)
      expect(y! - rd!, `IRCAK ${x}, ${d} døgn`).toBeLessThanOrEqual(1e-12)
    }
  })
})

describe('rekkefølgen for redigerte kurver', () => {
  // En gul kurve med raskere startfase enn den grønne. På det gamle
  // rutenettet ser alt riktig ut; over IRCAK 1000 og under ett døgn gjør det
  // ikke.
  const raskGul = kurve(77.43151640667834, 2.775563997050895, 1089.4593911945838, 0.13088688916307045)

  it('avviser kurver som bare krysser utenfor et rutenett', () => {
    expect(holderPaaRutenett(KURVER.gronn, raskGul)).toBe(true)
    expect(sammenlign(KURVER.gronn, raskGul)).toEqual({ ved: 'hoye' })
    expect(bruddNaer(KURVER.gronn, raskGul, [1e4, 1e5], [0.5, 1])).toBe(true)

    const r: ThcRegelsett = {
      ...REGELSETT,
      kurver: { ...REGELSETT.kurver, gul: { navn: 'Moderat', a1: 77.43151640667834, k1: 2.775563997050895, a2: 1089.4593911945838, k2: 0.13088688916307045 } },
    }
    expect(validerThcRegelsett(r).join()).toMatch(/grønne kurven må gi minst like rask utskillelse som den gule/)
  })

  it('avviser kurver som krysser midt i, og viser hvor', () => {
    const a: Kurve = { a1: 1e-3, k1: 5, a2: 10, k2: 0.2 }
    const b: Kurve = { a1: 1e3, k1: 4, a2: 10, k2: 0.1 }
    const brudd = sammenlign(a, b)
    expect(brudd?.ved).toBe('ircak')
    const x = brudd?.ved === 'ircak' ? brudd.ircak : Number.NaN
    expect(utskillelsesrate(a, x)).toBeLessThan(utskillelsesrate(b, x))
    expect(bruddNaer(a, b, [x], [0.01, 0.1, 1])).toBe(true)
  })

  it('viser IRCAK der rekkefølgen brytes, med to gjeldende sifre', () => {
    expect([35.65, 1234, 0.0012345, 9.96, 0.1, 1.23e-7, 4.5e25].map(visIrcak)).toEqual([
      '36',
      '1200',
      '0.0012',
      '10.0',
      '0.10',
      '1.2e-7',
      '4.5e25',
    ])
  })

  it('avviser kurver med lik langsom fase og ulik rask fase — de krysser alltid ved lave verdier', () => {
    const a: Kurve = { a1: 10, k1: 3, a2: 5, k2: 0.1 }
    const b: Kurve = { a1: 10, k1: 1, a2: 5, k2: 0.1 }
    expect(sammenlign(a, b)).toEqual({ ved: 'lave' })
    expect(sammenlign(b, a)).toEqual({ ved: 'lave' })
    // Den raske fasen til a dør ut først; nedenfor der den gjør det, er b raskest.
    expect(utskillelsesrate(a, 1)).toBeLessThan(utskillelsesrate(b, 1))
    expect(bruddNaer(a, b, [1, 2, 5], [1, 5, 20])).toBe(true)
  })

  it('avviser to kurver med samme rater når den som skal være raskest, har mest i langsom fase', () => {
    expect(sammenlign(KURVER.gul, KURVER.gronn)).toEqual({ ved: 'overalt' })
    expect(bruddNaer(KURVER.gul, KURVER.gronn, [1, 10], [1, 5])).toBe(true)
  })

  it('godtar kurver med ett ledd når ratene står i riktig rekkefølge', () => {
    expect(sammenlign({ a1: 1, k1: 1, a2: 1, k2: 1 }, { a1: 3, k1: 0.5, a2: 3, k2: 0.5 })).toBeNull()
    expect(sammenlign({ a1: 1, k1: 3, a2: 1, k2: 3 }, KURVER.gronn)).toBeNull()
    expect(sammenlign({ a1: 1, k1: 2, a2: 1, k2: 2 }, KURVER.gronn)).toEqual({ ved: 'hoye' })
    expect(sammenlign(KURVER.rod, { a1: 1, k1: 0.02, a2: 1, k2: 0.02 })).toBeNull()
  })

  it('gir samme svar som motoren på tilfeldige kurvepar', () => {
    // Det kontrollen godtar, holder i motoren; det den avviser, brytes der den sier.
    const r = tilfeldig(4)
    const tilfeldigKurve = (): Kurve => ({
      a1: Math.exp(r() * 8 - 2),
      k1: Math.exp(r() * 4 - 2),
      a2: Math.exp(r() * 8 - 2),
      k2: Math.exp(r() * 4 - 4),
    })
    let godtatt = 0
    let avvist = 0
    for (let i = 0; i < 400; i++) {
      const a = tilfeldigKurve()
      const b = tilfeldigKurve()
      const brudd = sammenlign(a, b)
      if (brudd === null) {
        godtatt++
        for (let j = 0; j < 50; j++) {
          const x = Math.exp(r() * 30 - 15)
          const d = r() * 400
          expect(forventetEndring(x, d, a) - forventetEndring(x, d, b)).toBeLessThanOrEqual(1e-9)
        }
      } else {
        avvist++
        const xer =
          brudd.ved === 'ircak'
            ? [brudd.ircak]
            : brudd.ved === 'lave'
              ? [1e-3, 1e-6, 1e-9, 1e-12, 1e-15]
              : brudd.ved === 'hoye'
                ? [1e3, 1e5, 1e7, 1e9, 1e11]
                : [1]
        expect(bruddNaer(a, b, xer, [1e-3, 0.1, 1, 10, 100, 1000, 10000]), JSON.stringify({ a, b, brudd })).toBe(true)
      }
    }
    expect(godtatt).toBeGreaterThan(20)
    expect(avvist).toBeGreaterThan(20)
  })
})
