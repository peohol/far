import { describe, expect, it } from 'vitest'
import { THC_REGELSETT } from '../../__tests__/hjelp/thcgrunnlag'
import type { ThcRegelsett } from '../thcRegelsett'
import { forventetNedgang, marginmerke, marginvalg, nivabeskrivelse, somProsent } from '../thcVisning'

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
})
