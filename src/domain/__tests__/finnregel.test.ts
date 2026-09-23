/**
 * Nivået en målt konsentrasjon havner i, etter regelsettene fra før byttet
 * til Supabase. Grensene og avgjørelsene er de samme som den gamle motoren
 * hadde, også der kilden hadde overlapp eller hull.
 */
import { describe, expect, it } from 'vitest'
import { DAGENS_GRENSER, DAGENS_REGELSETT, dagensRegelsett } from '../../__tests__/hjelp/dagensregler'
import { finnRegel, intervallene } from '../intervallregler'

function niva(kode: string, verdi: number) {
  return finnRegel(dagensRegelsett(kode), verdi).niva
}

describe('regelen en konsentrasjon treffer', () => {
  it('treffer riktig nivå på hver side av grensene', () => {
    // AMTNORSUM: under < 10, innenfor 10–1799, over ≥ 1800.
    expect(niva('AMTNORSUM', 9.9)).toBe('under')
    expect(niva('AMTNORSUM', 10)).toBe('innenfor')
    expect(niva('AMTNORSUM', 1799)).toBe('innenfor')
    expect(niva('AMTNORSUM', 1800)).toBe('over')
  })

  it('dekker hele tallinjen for alle analytter', () => {
    for (const gamle of DAGENS_GRENSER) {
      for (const verdi of [0, gamle.nedreGrense, gamle.ovreGrense, gamle.ovreGrense * 10]) {
        expect(['under', 'innenfor', 'over']).toContain(niva(gamle.kode, verdi))
      }
    }
  })

  it('lar Over vinne der PDF-en har overlapp mellom Innenfor og Over', () => {
    // LAM oppgir «2 – 75» som innenfor og «≥ 75» som over; 75 hører til begge.
    expect(niva('LAM', 75)).toBe('over')
    expect(niva('ZUKLO', 79)).toBe('over')
    expect(niva('BREK', 600)).toBe('over')
    expect(niva('KARSUM', 300)).toBe('over')
  })

  it('behandler hullet i FLUP som innenfor', () => {
    // Innenfor slutter på 34, Over starter på 36.
    expect(niva('FLUP', 35)).toBe('innenfor')
    expect(niva('FLUP', 36)).toBe('over')
  })
})

describe('kommentarene', () => {
  it('gir en kommentar for alle nivåer på alle analytter', () => {
    for (const regelsett of DAGENS_REGELSETT) {
      const intervaller = intervallene(regelsett)
      expect(new Set(intervaller.map((i) => i.niva)), regelsett.analyttkode).toEqual(
        new Set(['under', 'innenfor', 'over']),
      )
      for (const i of intervaller) expect(i.kommentar.tekst.length, regelsett.analyttkode).toBeGreaterThan(20)
    }
  })
})
