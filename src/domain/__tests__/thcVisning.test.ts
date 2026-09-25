import { describe, expect, it } from 'vitest'
import { THC_MODELL, THC_REGELSETT } from '../../__tests__/hjelp/thcgrunnlag'
import type { ThcRegelsett } from '../thcRegelsett'
import { fortolkThc, tomThcInndata } from '../thcMotor'
import {
  MARGINEKSEMPEL,
  endringsfrase,
  forventetNedgang,
  hvorOfteForStor,
  margineksempel,
  marginmerke,
  marginvalg,
  nivabeskrivelse,
  somProsent,
} from '../thcVisning'

describe('det fortolkningen viser om THC-syreregelsettet', () => {
  it('beskriver nivåene med nøyaktig den opprinnelige ordlyden for de publiserte reglene', () => {
    expect(nivabeskrivelse(THC_REGELSETT)).toBe(
      'under 20 omtales som lav, 20–40 som middels høy, og 40 eller mer som høy',
    )
  })

  it('følger nivåene når de endres', () => {
    const [lav, , hoy] = THC_REGELSETT.konsentrasjonsnivaer
    const to: ThcRegelsett = { ...THC_REGELSETT, konsentrasjonsnivaer: [lav!, { ...hoy!, nedre: 12.5 }] }
    expect(nivabeskrivelse(to)).toBe('under 12,5 omtales som lav, og 12,5 eller mer som høy')
    expect(nivabeskrivelse({ ...THC_REGELSETT, konsentrasjonsnivaer: [lav!] })).toBe(
      'alle konsentrasjoner omtales som lav',
    )
  })

  it('viser marginene som skalaen alltid har vist dem', () => {
    expect(THC_REGELSETT.sikkerhetsmarginer.map((m) => marginmerke(m.margin))).toEqual(['Ingen', '90 %', '99 %'])
    expect(marginmerke(0.995)).toBe('99,5 %')
    // Valgene i skjemaet sier i tillegg hvor sikker «Ingen» er, med parentesen samlet.
    expect(THC_REGELSETT.sikkerhetsmarginer.map((m) => marginvalg(m.margin))).toEqual([
      'Ingen (50\u00a0%)',
      '90 %',
      '99 %',
    ])
    expect(somProsent(0.9)).toBe('90')
  })

  it('henter grensene for forventet nedgang fra kurvene bruksmønsteret bruker', () => {
    const forventet = { gronn: -0.8, gul: -0.6, rod: -0.3 }
    // Kronisk bruk: gul og rød; enkeltinntak: grønn og gul — som i den opprinnelige forklaringen.
    expect(forventetNedgang(THC_REGELSETT, true, forventet)).toEqual({ hosFleste: 60, ovreGrense: 30 })
    expect(forventetNedgang(THC_REGELSETT, false, forventet)).toEqual({ hosFleste: 80, ovreGrense: 60 })
  })

  it('sier hvor ofte endringen som fortolkes er for stor, avledet av marginen', () => {
    expect(hvorOfteForStor(0.5)).toBe('i annethvert tilfelle')
    expect(hvorOfteForStor(0.9)).toBe('i 1 av 10 tilfeller')
    expect(hvorOfteForStor(0.99)).toBe('i 1 av 100 tilfeller')
    expect(hvorOfteForStor(0.95)).toBe('i 1 av 20 tilfeller')
  })

  it('skriver endringen i ord, avrundet til hele prosent', () => {
    expect(endringsfrase(-0.745)).toBe('en nedgang på 75 %')
    expect(endringsfrase(0.05)).toBe('en økning på 5 %')
    expect(endringsfrase(0)).toBe('ingen endring')
  })

  it('fortolker eksempelet med hver margin nøyaktig som fortolkningen gjør', () => {
    const { forrige, aktuell, dager, kronisk } = MARGINEKSEMPEL
    const eksempel = margineksempel(THC_REGELSETT)
    expect(eksempel.map((e) => e.margin)).toEqual(THC_REGELSETT.sikkerhetsmarginer.map((m) => m.margin))
    for (const { margin, endring, utfall } of eksempel) {
      const res = fortolkThc(
        {
          ...tomThcInndata(THC_REGELSETT),
          kronisk,
          forrigeVerdi: String(forrige),
          forrigeDato: '2026-02-01',
          aktuellVerdi: String(aktuell),
          aktuellDato: `2026-02-0${1 + dager}`,
          sikkerhetsmargin: margin,
        },
        THC_MODELL,
      )
      if (res.type !== 'kommentar' || !res.grunnlag) throw new Error('Eksempelet skal gi en kommentar.')
      expect(endring).toBe(res.grunnlag.korrigertEndring)
      expect(utfall).toBe(res.konklusjon)
    }
    // Med de publiserte reglene viser eksempelet tre ulike konklusjoner, fra den strengeste til den mildeste.
    expect(eksempel.map((e) => e.utfall)).toEqual(['nytt_inntak', 'vanskelig', 'ikke_nodvendigvis'])
    // Uten margin er det den målte endringen som fortolkes.
    expect(eksempel[0]!.endring).toBeCloseTo(aktuell / forrige - 1, 12)
  })
})
