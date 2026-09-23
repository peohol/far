import { describe, expect, it } from 'vitest'
import importert from './fasit/thc-regelsett-import.json'
import fasitfil from './fasit/thc-fasit.json'
import {
  dekodInndata,
  avvikFraFasit,
  tallavtrykk,
  type Fasit,
  type FasitUtfall,
} from './hjelp/thcFasit'
import {
  forventetEndring,
  fortolkThc,
  konklusjon,
  konsentrasjonsniva,
  korreksjonsfaktor,
  korrigertEndring,
  kurvefeil,
  kurverI,
  kurverOver,
  settSammen,
  tidForVerdi,
  tomThcInndata,
  velgTekstbolker,
  verdiPaaKurve,
  type ThcInndata,
  type ThcKonklusjon,
  type ThcResultat,
} from '../thcMotor'
import {
  normalkvantil,
  THC_TEKSTBOLKER,
  THC_TEKSTNOKLER,
  validerThcRegelsett,
  type ThcRegelsett,
  type ThcTekstnokkel,
} from '../thcRegelsett'
import { byggGraf, figurkurver } from '../thcPlot'

/**
 * Den nye THC-syremotoren, som leser fagkunnskapen fra et regelsett i stedet
 * for fra konstanter i koden.
 *
 * `REGELSETT` er regelsettet slik det ble importert fra den opprinnelige
 * modulen — samme verdier og tekster som migrasjonen legger inn i Supabase.
 * Fasiten (`fasit/thc-fasit.json`) er utfallet av den opprinnelige modulen
 * for over 4000 inndata, og motoren skal gi nøyaktig det samme.
 */
const REGELSETT = importert as ThcRegelsett
const FASIT = fasitfil as Fasit

function fortolk(inn: ThcInndata, r: ThcRegelsett = REGELSETT): ThcResultat {
  return fortolkThc(inn, r)
}

function somFasitutfall(r: ThcResultat): FasitUtfall {
  if (r.type === 'mangler') return r
  return {
    type: 'kommentar',
    kommentar: r.kommentar,
    konklusjon: r.konklusjon,
    langtMellomProvene: r.langtMellomProvene,
    grunnlag: r.grunnlag,
  }
}

function kommentar(r: ThcResultat) {
  if (r.type !== 'kommentar') throw new Error(`ventet kommentar, fikk ${JSON.stringify(r)}`)
  return r
}

const kurver = kurverI(REGELSETT)

describe('regelsettet som ble importert', () => {
  it('er gyldig', () => {
    expect(validerThcRegelsett(REGELSETT)).toEqual([])
    expect(kurvefeil(REGELSETT)).toEqual([])
  })

  it('har regnearkets kurver (A-verdiene i rad 14 og Newton-søket i rad 59)', () => {
    expect(verdiPaaKurve(0, kurver.gronn)).toBeCloseTo(44.0919207742365, 12)
    expect(verdiPaaKurve(0, kurver.gul)).toBeCloseTo(88.183841548473, 12)
    expect(verdiPaaKurve(0, kurver.rod)).toBeCloseTo(108.25848339033908, 12)
    expect(tidForVerdi(6.5, kurver.gronn)).toBeCloseTo(7.699327471604898, 10)
    expect(tidForVerdi(6.5, kurver.gul)).toBeCloseTo(12.876649902242379, 10)
    expect(tidForVerdi(6.5, kurver.rod)).toBeCloseTo(50.22455013808995, 10)
  })

  it('regner regnearkets forventede endring (rad 63) og korrigerte endring (D20)', () => {
    expect(forventetEndring(6.5, 23, kurver.gronn)).toBeCloseTo(-0.9540072740171043, 10)
    expect(forventetEndring(6.5, 23, kurver.gul)).toBeCloseTo(-0.9540072713754896, 10)
    expect(forventetEndring(6.5, 23, kurver.rod)).toBeCloseTo(-0.44290152002030236, 10)
    expect(korrigertEndring(REGELSETT, 6.5, 2.5, 0.9)).toBeCloseTo(-0.7352964402245712, 12)
    expect(korrigertEndring(REGELSETT, 1, 1, 0.9)).toBeCloseTo(-0.3117707445838853, 10)
  })

  it('leser av kvantilet marginen peker på, med regnearkets 90 % som standard (B5)', () => {
    expect(REGELSETT.standard_sikkerhetsmargin).toBe(0.9)
    expect(tomThcInndata(REGELSETT).sikkerhetsmargin).toBe(0.9)
    expect(korreksjonsfaktor(REGELSETT, 0.5)).toBe(1)
    expect(korreksjonsfaktor(REGELSETT, 0.9)).toBeCloseTo(0.6882292554161147, 12)
    expect(korreksjonsfaktor(REGELSETT, 0.99)).toBeCloseTo(0.5075088513115085, 12)
  })

  it('skiller lav, middels høy og høy på 20 og 40, med nedre grense inkludert (M21)', () => {
    const niva = (x: number) => konsentrasjonsniva(REGELSETT, x).navn
    expect(niva(0.001)).toBe('lav')
    expect(niva(19.999999999999996)).toBe('lav')
    expect(niva(20)).toBe('middels høy')
    expect(niva(39.99999999999999)).toBe('middels høy')
    expect(niva(40)).toBe('høy')
    expect(niva(1e6)).toBe('høy')
  })

  it('gjenskaper regnearkets eksempel (Fortolkning!A6), med tankestrek i «5–7»', () => {
    const r = kommentar(
      fortolk({
        ...tomThcInndata(REGELSETT),
        aktuellVerdi: '2,5',
        aktuellDato: '2026-07-27',
        forrigeVerdi: '6,5',
        forrigeDato: '2026-07-04',
      }),
    )
    expect(r.konklusjon).toBe('vanskelig')
    expect(r.kommentar).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i lav konsentrasjon. ' +
        'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. Ved gjentatte inntak vil ' +
        'påvisningstiden for THC-syre i urin øke, vanligvis opptil en måned etter avsluttet inntak. ' +
        'Basert på analyseresultatet alene er det vanskelig å avgjøre hvorvidt cannabis har vært inntatt etter ' +
        'prøve tatt 04.07.2026. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk ' +
        'farmakologi Ullevål (se ous.labfag.no).',
    )
  })

  it('beregner z-verdiene med AS 241 innenfor toleransen', () => {
    for (const { margin, z } of REGELSETT.sikkerhetsmarginer) {
      expect(Math.abs(normalkvantil(1 - margin) - z)).toBeLessThan(1e-12)
    }
    expect(normalkvantil(0.975)).toBeCloseTo(1.959963984540054, 14)
    expect(normalkvantil(1e-10)).toBeCloseTo(-6.361340902404056, 12)
  })
})

describe('fasiten fra den opprinnelige modulen', () => {
  const utfall = FASIT.tilfeller.map(([inn]) => somFasitutfall(fortolk(dekodInndata(inn) as ThcInndata)))

  it('dekker alle konklusjonene, alle tekstbolkene og ugyldige inndata', () => {
    expect(FASIT.tilfeller.length).toBeGreaterThan(4000)
    const konklusjoner = new Set(FASIT.tilfeller.map(([, u]) => u[0]))
    expect([...konklusjoner].sort()).toEqual(['ikke_nodvendigvis', 'm', 'nytt_inntak', 'uten_forrige', 'vanskelig'])
    const brukt = new Set(
      FASIT.tilfeller.flatMap(([inn]) => {
        const r = fortolk(dekodInndata(inn) as ThcInndata)
        return r.type === 'kommentar' ? r.bolker : []
      }),
    )
    expect([...brukt].sort()).toEqual([...THC_TEKSTNOKLER].sort())
  })

  it('gir samme kommentar, konklusjon, varsel og mangler i hvert eneste tilfelle', () => {
    const avvik = FASIT.tilfeller.flatMap(([inn], i) => {
      const a = avvikFraFasit(FASIT, i, utfall[i]!)
      return a === null ? [] : [`${JSON.stringify(inn)}: ${a}`]
    })
    expect(avvik.slice(0, 5)).toEqual([])
  })

  it('gir de samme tallene og figurene, helt ned til siste siffer', () => {
    const figur = figurkurver(REGELSETT)
    expect(tallavtrykk(utfall, (g) => byggGraf(g, figur))).toBe(FASIT.tallgrunnlag)
  })

  it('har tilfeller rett under, på og over hver kurvegrense som gir ulike konklusjoner', () => {
    // Uten dette kunne fasiten ha bommet på grensene og likevel sett grønn ut.
    let skifter = 0
    for (let i = 2; i < FASIT.tilfeller.length; i++) {
      const [a, b, c] = [FASIT.tilfeller[i - 2]!, FASIT.tilfeller[i - 1]!, FASIT.tilfeller[i]!]
      if (a[0].slice(0, 1).concat(a[0].slice(2)).join() !== c[0].slice(0, 1).concat(c[0].slice(2)).join()) continue
      if (a[1][0] !== c[1][0] && (a[1][0] === b[1][0] || b[1][0] === c[1][0])) skifter++
    }
    expect(skifter).toBeGreaterThan(200)
  })
})

describe('tekstbolkene', () => {
  const nivaer = REGELSETT.konsentrasjonsnivaer
  const utfall: ThcKonklusjon[] = ['uten_forrige', 'ikke_nodvendigvis', 'vanskelig', 'nytt_inntak']

  it('åpner alltid, og avslutter uten forrige prøve med å anbefale oppfølging', () => {
    for (const niva of nivaer) {
      for (const u of utfall) {
        for (const underCutoff of [false, true]) {
          const bolker = velgTekstbolker(niva, u, underCutoff)
          expect(bolker[0]).toBe('apning')
          expect(bolker.at(-1) === 'uten_forrige').toBe(u === 'uten_forrige')
        }
      }
    }
  })

  it('står i den rekkefølgen THC_TEKSTNOKLER har', () => {
    for (const niva of nivaer) {
      for (const u of utfall) {
        for (const underCutoff of [false, true]) {
          const bolker = velgTekstbolker(niva, u, underCutoff)
          const plass = bolker.map((b) => THC_TEKSTNOKLER.indexOf(b))
          expect(plass).toEqual([...plass].sort((a, b) => a - b))
        }
      }
    }
  })

  it('bytter konklusjonen mot forrige prøve under cut-off, men ikke et sikkert nytt inntak', () => {
    const lav = nivaer[0]!
    expect(velgTekstbolker(lav, 'vanskelig', true)).toContain('under_cutoff_vanskelig')
    expect(velgTekstbolker(lav, 'vanskelig', true)).toContain('inntak_har_skjedd')
    expect(velgTekstbolker(lav, 'vanskelig', false)).not.toContain('inntak_har_skjedd')
    expect(velgTekstbolker(lav, 'ikke_nodvendigvis', true)).toContain('under_cutoff_ikke_nodvendigvis')
    expect(velgTekstbolker(lav, 'nytt_inntak', true)).toEqual(velgTekstbolker(lav, 'nytt_inntak', false))
    expect(velgTekstbolker(lav, 'uten_forrige', true)).toEqual(velgTekstbolker(lav, 'uten_forrige', false))
  })

  it('setter inn nivået og datoen der plassholderne står, og binder bolkene med ett mellomrom', () => {
    const tekst = settSammen(
      { ...REGELSETT, tekster: { ...REGELSETT.tekster, apning: 'A {nivå}.', nytt_inntak: 'B {forrige prøvedato} {forrige prøvedato}.' } },
      ['apning', 'nytt_inntak'],
      { niva: 'lav', forrigeDato: '01.02.2026' },
    )
    expect(tekst).toBe('A lav. B 01.02.2026 01.02.2026.')
  })

  it('har en beskrivelse og tittel for hver bolk', () => {
    for (const nokkel of THC_TEKSTNOKLER) {
      expect(THC_TEKSTBOLKER[nokkel].tittel).not.toBe('')
      expect(THC_TEKSTBOLKER[nokkel].brukes).not.toBe('')
    }
  })
})

describe('konklusjonen per bruksmønster', () => {
  const forventet = { gronn: -0.9, gul: -0.6, rod: -0.3 }

  it('teller kurvene endringen ligger over, fra grønn og uten avbrudd', () => {
    expect(kurverOver(-0.95, forventet)).toBe(0)
    expect(kurverOver(-0.9, forventet)).toBe(0)
    expect(kurverOver(-0.7, forventet)).toBe(1)
    expect(kurverOver(-0.5, forventet)).toBe(2)
    expect(kurverOver(0, forventet)).toBe(3)
    expect(kurverOver(Number.NaN, forventet)).toBe(0)
    // Uten avbrudd: over rød, men ikke over grønn, er ikke over noen.
    expect(kurverOver(-0.5, { gronn: 0, gul: -0.9, rod: -0.9 })).toBe(0)
  })

  it('kronisk bruk: gul skiller «ikke nødvendigvis» fra «vanskelig», rød skiller «vanskelig» fra nytt inntak', () => {
    expect(konklusjon(REGELSETT, true, -0.7, forventet)).toBe('ikke_nodvendigvis')
    expect(konklusjon(REGELSETT, true, -0.6, forventet)).toBe('ikke_nodvendigvis')
    expect(konklusjon(REGELSETT, true, -0.5, forventet)).toBe('vanskelig')
    expect(konklusjon(REGELSETT, true, -0.3, forventet)).toBe('vanskelig')
    expect(konklusjon(REGELSETT, true, -0.2, forventet)).toBe('nytt_inntak')
  })

  it('uten kronisk bruk: ett trinn strengere — grønn og gul', () => {
    expect(konklusjon(REGELSETT, false, -0.95, forventet)).toBe('ikke_nodvendigvis')
    expect(konklusjon(REGELSETT, false, -0.7, forventet)).toBe('vanskelig')
    expect(konklusjon(REGELSETT, false, -0.5, forventet)).toBe('nytt_inntak')
  })
})

describe('et redigert regelsett', () => {
  const eksempel: ThcInndata = {
    ...tomThcInndata(REGELSETT),
    aktuellVerdi: '22',
    aktuellDato: '2026-07-27',
    forrigeVerdi: '6,5',
    forrigeDato: '2026-07-04',
  }

  it('flytter nivået når skillepunktet flyttes', () => {
    const nivaer = REGELSETT.konsentrasjonsnivaer.map((n) => (n.nedre === 20 ? { ...n, nedre: 25 } : n))
    expect(kommentar(fortolk(eksempel)).niva.navn).toBe('middels høy')
    expect(kommentar(fortolk(eksempel, { ...REGELSETT, konsentrasjonsnivaer: nivaer })).niva.navn).toBe('lav')
  })

  it('bruker den nye ordlyden', () => {
    const r = { ...REGELSETT, tekster: { ...REGELSETT.tekster, uten_forrige: 'Ny prøve anbefales.' } }
    expect(kommentar(fortolk({ ...eksempel, ingenTidligere: true }, r)).kommentar.endsWith('Ny prøve anbefales.')).toBe(true)
  })

  it('følger grensene for bruksmønsteret', () => {
    const prove = { ...eksempel, aktuellVerdi: '2,5' }
    expect(kommentar(fortolk(prove)).konklusjon).toBe('vanskelig')
    const strengere = {
      ...REGELSETT,
      bruksmonstre: { ...REGELSETT.bruksmonstre, kronisk: { vanskelig_over: 'gronn', nytt_inntak_over: 'gul' } },
    } satisfies ThcRegelsett
    expect(kommentar(fortolk(prove, strengere)).konklusjon).toBe('nytt_inntak')
  })

  it('varsler etter regelsettets grense', () => {
    const r = { ...REGELSETT, varsel_dager_mellom: 22 }
    expect(kommentar(fortolk(eksempel)).langtMellomProvene).toBe(false)
    expect(kommentar(fortolk(eksempel, r)).langtMellomProvene).toBe(true)
  })

  it('bruker regelsettets faktor for måleusikkerhet under cut-off', () => {
    const inn = { ...eksempel, forrigeUnderCutoff: true, forrigeUcak: '13', forrigeNkre: '2', aktuellVerdi: '2,5' }
    const a = kommentar(fortolk(inn)).grunnlag!.korrigertEndring
    const b = kommentar(fortolk(inn, { ...REGELSETT, maleusikkerhet: { ...REGELSETT.maleusikkerhet, faktor_under_cutoff: 1 } })).grunnlag!.korrigertEndring
    expect(b).toBeCloseTo(korrigertEndring(REGELSETT, 6.5, 2.5, 0.9), 12)
    expect(a).toBeLessThan(b)
  })
})

describe('valideringen', () => {
  const med = (endring: Partial<ThcRegelsett>): ThcRegelsett => ({ ...REGELSETT, ...endring })
  const tekst = (nokkel: ThcTekstnokkel, verdi: string) => med({ tekster: { ...REGELSETT.tekster, [nokkel]: verdi } })

  it.each<[string, ThcRegelsett, RegExp]>([
    ['konverteringsfaktor 0', med({ konverteringsfaktor: 0 }), /Konverteringsfaktoren/],
    ['negativ amplitude', med({ kurver: { ...REGELSETT.kurver, rod: { ...REGELSETT.kurver.rod, a1: -1 } } }), /a1 må være/],
    ['kurve uten navn', med({ kurver: { ...REGELSETT.kurver, gul: { ...REGELSETT.kurver.gul, navn: ' ' } } }), /mangler navn/],
    ['CV 0', med({ maleusikkerhet: { ...REGELSETT.maleusikkerhet, cv_thc: 0 } }), /CV for THC-syre/],
    ['faktor under 1', med({ maleusikkerhet: { ...REGELSETT.maleusikkerhet, faktor_under_cutoff: 0.9 } }), /minst 1/],
    ['ingen marginer', med({ sikkerhetsmarginer: [] }), /minst én sikkerhetsmargin/],
    ['margin 100 %', med({ sikkerhetsmarginer: [...REGELSETT.sikkerhetsmarginer, { margin: 1, z: -40 }] }), /under 100 %/],
    ['feil z', med({ sikkerhetsmarginer: [{ margin: 0.5, z: 0 }, { margin: 0.9, z: -1.28 }, { margin: 0.99, z: -2.3263478740408408 }] }), /z-verdien for 90 %/],
    ['marginer ikke stigende', med({ sikkerhetsmarginer: [...REGELSETT.sikkerhetsmarginer].reverse() }), /stigende/],
    ['standard mangler', med({ standard_sikkerhetsmargin: 0.95 }), /Standardmarginen/],
    ['nivåer ikke stigende', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n) => (n.nedre === 40 ? { ...n, nedre: 20 } : n)) }), /stigende/],
    ['nederste med grense', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n, i) => (i === 0 ? { ...n, nedre: 1 } : n)) }), /laveste/],
    ['skillepunkt mangler', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n, i) => (i === 2 ? { ...n, nedre: null } : n)) }), /Skillepunktet under «høy»/],
    ['like nivånavn', med({ konsentrasjonsnivaer: REGELSETT.konsentrasjonsnivaer.map((n) => ({ ...n, navn: 'lav' })) }), /samme navn/],
    ['bruksmønster i feil rekkefølge', med({ bruksmonstre: { ...REGELSETT.bruksmonstre, kronisk: { vanskelig_over: 'rod', nytt_inntak_over: 'gul' } } }), /tregere kurve/],
    ['varsel 0 døgn', med({ varsel_dager_mellom: 0 }), /helt antall døgn/],
    ['tom tekst', tekst('pavisningstid', ''), /er tom/],
    ['tekst med mellomrom i enden', tekst('pavisningstid', 'Tekst. '), /mellomrom/],
    ['dato mangler', tekst('vanskelig', 'Vanskelig å avgjøre.'), /må inneholde \{forrige prøvedato\}/],
    ['dato der den ikke finnes', tekst('uten_forrige', 'Siden {forrige prøvedato}.'), /ikke kan bruke/],
    ['ukjent plassholder', tekst('apning', 'Påvist i {nivå} {mengde}.'), /ikke kan bruke: \{mengde\}/],
    ['løs krøllparentes', tekst('apning', 'Påvist i {nivå} }.'), /krøllparentes/],
  ])('avviser %s', (_, r, melding) => {
    expect(validerThcRegelsett(r).join('\n')).toMatch(melding)
  })

  it('avviser kurver i feil rekkefølge', () => {
    const byttet = { ...REGELSETT, kurver: { ...REGELSETT.kurver, gronn: REGELSETT.kurver.rod, rod: REGELSETT.kurver.gronn } }
    expect(validerThcRegelsett(byttet)).toEqual([])
    expect(kurvefeil(byttet).join()).toMatch(/rekkefølge/)
  })
})
