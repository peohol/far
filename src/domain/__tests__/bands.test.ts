/**
 * Båndene steg 2 viser, laget av regelsettene fra før byttet til Supabase.
 * Tallene og nøklene er de den gamle motoren ga for de samme analyttene.
 */
import { describe, expect, it } from 'vitest'
import { DAGENS_GRENSER, DAGENS_REGELSETT, dagensNiva, dagensRegelsett } from '../../__tests__/hjelp/dagensregler'
import { regelsettband } from '../intervallregler'

function band(kode: string) {
  return regelsettband(dagensRegelsett(kode))
}

function labels(kode: string): string[] {
  return band(kode).map((b) => b.label)
}

const alle = DAGENS_REGELSETT.map((r) => ({ kode: r.analyttkode, regelsett: r, band: regelsettband(r) }))

describe('båndene', () => {
  it('slår sammen «over» og «over ringegrensen» når grensene er like', () => {
    // AMTNORSUM: under < 10, innenfor 10–1799, over ≥ 1800, ringegrense 1800.
    expect(labels('AMTNORSUM')).toEqual(['< 10', '10 – 1799', '≥ 1800'])
    const over = band('AMTNORSUM')[2]
    expect(over?.ring).toBe(true)
    expect(over?.tone).toBe('ring')
  })

  it('deler «over» i to når ringegrensen ligger over den', () => {
    // ZUKLO: over ≥ 79, ringegrense 100.
    expect(labels('ZUKLO')).toEqual(['< 1', '1 – 78', '79 – 100', '≥ 101'])
    const [, , over, ring] = band('ZUKLO')
    expect(over?.ring).toBe(false)
    expect(over?.tone).toBe('over')
    expect(ring?.ring).toBe(true)
    expect(ring?.tone).toBe('ring')
  })

  it('deler «innenfor» i to når ringegrensen ligger inni den', () => {
    // DOKSUM: innenfor 20–1099, over ≥ 1100, ringegrense 1000.
    expect(labels('DOKSUM')).toEqual(['< 20', '20 – 1000', '1001 – 1099', '≥ 1100'])
    const [, innenfor, innenforRing, over] = band('DOKSUM')
    expect(innenfor?.ring).toBe(false)
    expect(innenforRing?.ring).toBe(true)
    // Samme kommentar som det udelte båndet — bare ringepåminnelsen skiller.
    expect(innenforRing?.kommentar).toBe(innenfor?.kommentar)
    expect(innenforRing?.tone).toBe('innenfor')
    expect(over?.ring).toBe(true)
  })

  it('regner med desimaler der analytten har det', () => {
    // FLUP: under < 0,6, innenfor til 36, over ≥ 36, ringegrense 35.
    expect(labels('FLUP')).toEqual(['< 0,6', '0,6 – 35', '35,1 – 35,9', '≥ 36'])
    expect(labels('PERF')).toEqual(['< 0,6', '0,6 – 13,9', '≥ 14'])
  })

  it('gir tre eller fire bånd for alle analytter', () => {
    for (const { kode, band } of alle) {
      expect(band.length, kode).toBeGreaterThanOrEqual(3)
      expect(band.length, kode).toBeLessThanOrEqual(4)
    }
  })

  it('holder etikettene innenfor bredden knappene er dimensjonert for', () => {
    // Knappene står alltid på én linje, og `--band-innhold` i components.css er
    // målt mot den bredeste etiketten regelsettene gir. Bredden kommer av
    // sifrene: de står med tabellbreddstall og er de brede tegnene, mens komma,
    // mellomrom og tankestrek er smale. «1001 – 1099» og «300 – 15999» har
    // begge åtte siffer og er de bredeste. Kommer det en etikett med flere
    // siffer, må tallet i CSS-en opp — ellers blir raden brutt eller trang.
    for (const { kode, band } of alle) {
      for (const b of band) {
        const siffer = b.label.replace(/\D/g, '').length
        expect(siffer, `${kode}/${b.key}: «${b.label}»`).toBeLessThanOrEqual(8)
      }
    }
  })

  it('gir hvert bånd en unik nøkkel', () => {
    // Nøkkelen er det tilstanden holder på, og valget finnes igjen på den.
    for (const { kode, band } of alle) {
      const keys = band.map((b) => b.key)
      expect(new Set(keys).size, kode).toBe(keys.length)
    }
  })

  it('gir båndene på samme nivå den samme kommentaren, og hvert nivå sin egen', () => {
    for (const { kode, band } of alle) {
      const etterNiva = new Map<string, Set<string>>()
      for (const b of band) etterNiva.set(b.niva, (etterNiva.get(b.niva) ?? new Set()).add(b.kommentar))
      expect([...etterNiva.keys()], kode).toEqual(['under', 'innenfor', 'over'])
      for (const [niva, tekster] of etterNiva) expect(tekster.size, `${kode}/${niva}`).toBe(1)
    }
  })

  it('dekker hele tallinjen uten hull eller overlapp', () => {
    for (const { kode, band } of alle) {
      expect(band[0]?.fra, kode).toBeNull()
      expect(band.at(-1)?.til, kode).toBeNull()
      for (let i = 1; i < band.length; i += 1) {
        const forrige = band[i - 1]?.til
        const neste = band[i]?.fra
        expect(forrige, `${kode} bånd ${i}`).not.toBeNull()
        expect(neste, `${kode} bånd ${i}`).not.toBeNull()
        // Neste bånd starter ett steg over der forrige sluttet.
        expect(neste as number).toBeGreaterThan(forrige as number)
      }
    }
  })

  it('gir hvert bånd det nivået den gamle motoren ga verdiene i det', () => {
    for (const gamle of DAGENS_GRENSER) {
      for (const b of band(gamle.kode)) {
        const prover = [b.fra, b.til].filter((v): v is number => v !== null)
        if (b.fra !== null && b.til !== null) prover.push((b.fra + b.til) / 2)
        for (const verdi of prover) {
          expect(dagensNiva(gamle, verdi), `${gamle.kode}/${b.key} @ ${verdi}`).toBe(b.niva)
        }
      }
    }
  })

  it('setter ringeflagget på båndene som ligger over ringegrensen', () => {
    for (const { kode, regelsett, band } of alle) {
      const ringegrense = regelsett.ringegrense
      if (ringegrense === null) continue
      // Det øverste båndet er alltid over ringegrensen, det nederste under.
      expect(band.at(-1)?.ring, kode).toBe(true)
      expect(band[0]?.ring, kode).toBe(false)
      // Ingen bånd uten ringeflagg strekker seg forbi ringegrensen.
      for (const b of band) {
        if (!b.ring && b.til !== null) expect(b.til, `${kode}/${b.key}`).toBeLessThanOrEqual(ringegrense)
      }
    }
  })
})
