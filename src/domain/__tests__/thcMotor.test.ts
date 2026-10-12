import { describe, expect, it } from 'vitest'
import gjeldende from './fasit/thc-regelsett.json'
import gjeldendeTekster from './fasit/thc-tekster.json'
import fasitfil from './fasit/thc-fasit.json'
import {
  dekodInndata,
  avvikFraFasit,
  tallavtrykk,
  type Fasit,
  type FasitUtfall,
} from './hjelp/thcFasit'
import { forventetEndring, tidForVerdi, verdiPaaKurve } from '../thcKurver'
import {
  fortolkThc,
  konklusjon,
  konsentrasjonsniva,
  korreksjonsfaktor,
  korrigertEndring,
  kortTidMellomProvene,
  kurverOver,
  lagThcModell,
  tomThcInndata,
  tomThcProve,
  velgKommentar,
  type ThcInndata,
  type ThcKonklusjon,
  type ThcModell,
  type ThcResultat,
} from '../thcMotor'
import { byggGraf, figurkurver } from '../thcPlot'
import { godkjennThcRegelsett, kurverI, normalkvantil, validerThcRegelsett, type ThcRegelsett } from '../thcRegelsett'
import {
  kommentardeler,
  settSammen,
  THC_KOMMENTARNOKLER,
  THC_SITUASJONER,
  THC_TEKSTBOLKER,
  THC_TEKSTNOKLER,
  validerThcTekster,
  type ThcTekster,
  type ThcTekstnokkel,
} from '../thcTekster'
import {
  forventetKommentar,
  forventetKortTidKommentar,
  forventetSamletKommentar,
} from './hjelp/thcKommentarfasit'

/**
 * Den nye THC-syremotoren, som leser fagkunnskapen fra et regelsett og
 * tekster i stedet for fra konstanter i koden.
 *
 * `REGELSETT` er reglene slik de sto i den opprinnelige modulen, med
 * grensen for kort tid og hvilke kommentarer som avsluttes med
 * spørsmålsetningen; `TEKSTER` er eierens ordlyd fra 12.10.2026. Fasiten
 * (`fasit/thc-fasit.json`) er konklusjonen, manglene og tallene den
 * opprinnelige modulen gir for over 4000 inndata, med kommentaren i den nye
 * ordlyden, og motoren skal gi nøyaktig det samme.
 */
const REGELSETT = gjeldende as ThcRegelsett
const TEKSTER = gjeldendeTekster as ThcTekster
const FASIT = fasitfil as Fasit

/** Reglene og tekstene satt sammen; testen feiler om de ikke godtas. */
function modell(r: ThcRegelsett = REGELSETT, t: ThcTekster = TEKSTER): ThcModell {
  const m = lagThcModell(r, t)
  if (!m.ok) throw new Error(m.feil.join('\n'))
  return m.modell
}

const MODELL = modell()

function fortolk(inn: ThcInndata, m: ThcModell = MODELL): ThcResultat {
  return fortolkThc(inn, m)
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
  it('er gyldig, med gyldige tekster', () => {
    expect(validerThcRegelsett(REGELSETT)).toEqual([])
    expect(validerThcTekster(TEKSTER)).toEqual([])
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

  it('gjenskaper regnearkets eksempel (Fortolkning!A6), i den nye ordlyden', () => {
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
        'Analyseresultatet viser at cannabis har vært inntatt – men gir i seg selv ikke grunnlag for å fastslå ' +
        'om inntaket har skjedd etter prøven tatt 04.07.2026. Ved spørsmål kan rekvirenten kontakte vakthavende ' +
        'lege ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no).',
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

  it('dekker alle konklusjonene, alle tekstene utenom de nye situasjonene, og ugyldige inndata', () => {
    expect(FASIT.tilfeller.length).toBeGreaterThan(4000)
    const konklusjoner = new Set(FASIT.tilfeller.map(([, u]) => u[0]))
    expect([...konklusjoner].sort()).toEqual(['ikke_nodvendigvis', 'm', 'nytt_inntak', 'uten_forrige', 'vanskelig'])
    const brukt = new Set(
      FASIT.tilfeller.flatMap(([inn]) => {
        const r = fortolk(dekodInndata(inn) as ThcInndata)
        return r.type === 'kommentar' ? r.bolker : []
      }),
    )
    // Den samlede vurderingen og kort tid kjente ikke den opprinnelige
    // modulen; de prøves for seg under.
    const nye = ['samlet_vurdering', 'kort_tid']
    expect([...brukt].sort()).toEqual(THC_TEKSTNOKLER.filter((n) => !nye.includes(n)).sort())
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

describe('kommentarene', () => {
  const nivaer = REGELSETT.konsentrasjonsnivaer
  const utfall: ThcKonklusjon[] = ['uten_forrige', 'ikke_nodvendigvis', 'vanskelig', 'nytt_inntak']
  const ingen = { underCutoff: false, samlet: false, kortTid: false }

  it('gir eierens ordlyd for hvert nivå og hver konklusjon, med og uten cut-off', () => {
    for (const niva of nivaer) {
      for (const u of utfall) {
        for (const underCutoff of [false, true]) {
          const nokkel = velgKommentar(niva, u, { ...ingen, underCutoff })
          const tekst = settSammen(TEKSTER, kommentardeler(REGELSETT.med_sporsmalsetning, nokkel), {
            niva: niva.navn,
            forrigeDato: '01.02.2026',
            tidligereDato: '',
          })
          const fasitniva = niva.navn as 'lav' | 'middels høy' | 'høy'
          expect(tekst, `${niva.navn}, ${u}, under cut-off: ${underCutoff}`).toBe(
            forventetKommentar(fasitniva, u, underCutoff, '01.02.2026'),
          )
        }
      }
    }
  })

  it('bruker egen kommentar for nivåene som tyder på nylig inntak', () => {
    const [lav, middels, hoy] = nivaer
    for (const u of utfall) {
      expect(velgKommentar(lav!, u, ingen)).toBe(u)
      expect(velgKommentar(middels!, u, ingen)).toBe(u)
      expect(velgKommentar(hoy!, u, ingen)).toBe(`${u}_nylig`)
    }
  })

  it('har egen kommentar under cut-off bare for «ikke nødvendigvis nytt»', () => {
    const lav = nivaer[0]!
    expect(velgKommentar(lav, 'ikke_nodvendigvis', { ...ingen, underCutoff: true })).toBe('under_cutoff_ikke_nodvendigvis')
    for (const u of ['uten_forrige', 'vanskelig', 'nytt_inntak'] as const) {
      expect(velgKommentar(lav, u, { ...ingen, underCutoff: true })).toBe(u)
    }
  })

  it('bytter «kan ikke fastslås» med den samlede vurderingen, og ingen annen konklusjon', () => {
    for (const niva of nivaer) {
      expect(velgKommentar(niva, 'vanskelig', { ...ingen, samlet: true })).toBe('samlet_vurdering')
      for (const u of ['ikke_nodvendigvis', 'nytt_inntak'] as const) {
        expect(velgKommentar(niva, u, { ...ingen, samlet: true })).not.toBe('samlet_vurdering')
      }
    }
  })

  it('gir kort tid foran alt annet', () => {
    for (const u of utfall) {
      expect(velgKommentar(nivaer[2]!, u, { underCutoff: true, samlet: true, kortTid: true })).toBe('kort_tid')
    }
  })

  it('åpner alltid med introsetningen, og avslutter med spørsmålsetningen bare der regelsettet sier det', () => {
    for (const nokkel of THC_KOMMENTARNOKLER) {
      const deler = kommentardeler(REGELSETT.med_sporsmalsetning, nokkel)
      expect(deler[0]).toBe('introsetning')
      expect(deler[1]).toBe(nokkel)
      expect(deler.includes('sporsmalsetning')).toBe(REGELSETT.med_sporsmalsetning.includes(nokkel))
    }
    expect(kommentardeler([], 'vanskelig')).toEqual(['introsetning', 'vanskelig'])
  })

  it('setter inn nivået og datoene der plassholderne står, og binder delene med ett mellomrom', () => {
    const tekst = settSammen(
      { ...TEKSTER, introsetning: 'A {nivå}.', samlet_vurdering: 'B {forrige prøvedato} {tidligere prøvedato}.' },
      ['introsetning', 'samlet_vurdering', 'sporsmalsetning'],
      { niva: 'lav', forrigeDato: '01.02.2026', tidligereDato: '15.01.2026' },
    )
    expect(tekst).toBe(`A lav. B 01.02.2026 15.01.2026. ${TEKSTER.sporsmalsetning}`)
  })

  it('har en beskrivelse og tittel for hver tekst og hver situasjon', () => {
    for (const nokkel of THC_TEKSTNOKLER) {
      expect(THC_TEKSTBOLKER[nokkel].tittel).not.toBe('')
      expect(THC_TEKSTBOLKER[nokkel].brukes).not.toBe('')
    }
    expect(new Set(THC_TEKSTNOKLER.map((n) => THC_TEKSTBOLKER[n].tittel)).size).toBe(THC_TEKSTNOKLER.length)
    expect(THC_SITUASJONER.flatMap((s) => THC_KOMMENTARNOKLER.filter((n) => THC_TEKSTBOLKER[n].situasjon === s))).toEqual(
      THC_KOMMENTARNOKLER,
    )
  })
})

describe('samlet vurdering mot tidligere prøver', () => {
  // Hver prøve for seg gir «kan ikke fastslås» mot den før: 6,5 → 2,5 på 23
  // døgn. Mot en prøve med lavere IRCAK lenger tilbake er det nytt inntak.
  const grunn: ThcInndata = {
    ...tomThcInndata(REGELSETT),
    aktuellVerdi: '2,5',
    aktuellDato: '2026-07-27',
    forrigeVerdi: '6,5',
    forrigeDato: '2026-07-04',
  }
  const prove = (verdi: string, dato: string) => ({ ...tomThcProve(), verdi, dato })
  const samlet = (...tidligere: ReturnType<typeof prove>[]): ThcInndata => ({ ...grunn, samletVurdering: true, tidligere })

  it('gir den samlede kommentaren når en enda tidligere prøve gir nytt inntak', () => {
    expect(kommentar(fortolk(grunn)).konklusjon).toBe('vanskelig')
    const r = kommentar(fortolk(samlet(prove('0,5', '2026-06-01'))))
    expect(r.konklusjon).toBe('vanskelig')
    expect(r.kommentarnokkel).toBe('samlet_vurdering')
    expect(r.samlet).toEqual({ dato: '01.06.2026', ircak: 0.5, dager: 56 })
    expect(r.kommentar).toBe(forventetSamletKommentar('lav', '04.07.2026', '01.06.2026'))
    // Tallgrunnlaget mot forrige prøve er det samme som uten.
    expect(r.grunnlag).toEqual(kommentar(fortolk(grunn)).grunnlag)
  })

  it('bruker den nærmeste prøven som gir nytt inntak, uansett rekkefølgen de står i', () => {
    const r = kommentar(fortolk(samlet(prove('0,1', '2026-05-01'), prove('0,5', '2026-06-01'), prove('6', '2026-06-20'))))
    expect(r.samlet?.dato).toBe('01.06.2026')
  })

  it('regner IRCAK 0 i en tidligere prøve som nytt inntak etter den', () => {
    expect(kommentar(fortolk(samlet(prove('0', '2026-06-30')))).samlet?.dato).toBe('30.06.2026')
  })

  it('beholder kommentaren mot forrige prøve når de tidligere prøvene ikke tilfører noe', () => {
    const r = kommentar(fortolk(samlet(prove('7', '2026-06-30'))))
    expect(r.samlet).toBeNull()
    expect(r.kommentar).toBe(forventetKommentar('lav', 'vanskelig', false, '04.07.2026'))
  })

  it('gjelder bare «kan ikke fastslås»', () => {
    for (const aktuellVerdi of ['0,3', '30']) {
      const uten = kommentar(fortolk({ ...grunn, aktuellVerdi }))
      const med = kommentar(fortolk({ ...samlet(prove('0', '2026-06-30')), aktuellVerdi }))
      expect(med.konklusjon).not.toBe('vanskelig')
      expect(med.kommentar).toBe(uten.kommentar)
    }
  })

  it('bruker den høyere måleusikkerheten for en tidligere prøve under cut-off', () => {
    // UCAK/NKRE = 3, som IRCAK 3 gir nytt inntak — men med usikkerheten
    // under cut-off er det ikke lenger sikkert.
    const underCutoff = { ...tomThcProve(), underCutoff: true, ucak: '6', nkre: '2', dato: '2026-07-01' }
    expect(kommentar(fortolk(samlet(prove('3', '2026-07-01')))).samlet).not.toBeNull()
    expect(kommentar(fortolk(samlet(underCutoff)))).toMatchObject({ samlet: null })
  })

  it('sier fra om det som mangler i de tidligere prøvene', () => {
    expect(fortolk({ ...grunn, samletVurdering: true, tidligere: [] })).toEqual({
      type: 'mangler',
      mangler: ['Legg til en tidligere prøve, eller slå av den samlede vurderingen.'],
    })
    expect(fortolk(samlet(prove('', '')))).toEqual({
      type: 'mangler',
      mangler: ['Fyll inn IRCAK for den tidligere prøven.', 'Fyll inn prøvedato for den tidligere prøven.'],
    })
    expect(fortolk(samlet(prove('1', '2026-06-01'), prove('-1', '2026-07-10')))).toEqual({
      type: 'mangler',
      mangler: [
        'IRCAK for tidligere prøve 2 må være et tall som ikke er negativt.',
        'Tidligere prøve 2 kan ikke være tatt etter forrige prøve.',
      ],
    })
  })

  it('ser bort fra de tidligere prøvene når samlet vurdering er slått av', () => {
    const r = fortolk({ ...samlet(prove('', '')), samletVurdering: false })
    expect(kommentar(r).kommentar).toBe(kommentar(fortolk(grunn)).kommentar)
  })
})

describe('kort tid mellom prøvene', () => {
  const grunn: ThcInndata = {
    ...tomThcInndata(REGELSETT),
    aktuellVerdi: '45',
    aktuellDato: '2026-07-27',
    forrigeVerdi: '6,5',
    forrigeDato: '2026-07-25',
  }

  it('gjelder samme dag og færre døgn enn regelsettets grense', () => {
    const dager = (forrigeDato: string) => kortTidMellomProvene(REGELSETT, { ...grunn, forrigeDato })
    expect(dager('2026-07-27')).toBe(true)
    expect(dager('2026-07-26')).toBe(true)
    expect(dager('2026-07-25')).toBe(true)
    expect(dager('2026-07-24')).toBe(false)
    expect(dager('2026-07-28')).toBe(false)
    expect(dager('')).toBe(false)
    expect(kortTidMellomProvene(REGELSETT, { ...grunn, ingenTidligere: true })).toBe(false)
    expect(kortTidMellomProvene({ ...REGELSETT, kort_tid_dager: 4 }, { ...grunn, forrigeDato: '2026-07-24' })).toBe(true)
  })

  it('fortolker som før til «Kort tid mellom prøvene» er huket av', () => {
    const vanlig = kommentar(fortolk(grunn))
    expect(vanlig.konklusjon).toBe('nytt_inntak')
    expect(vanlig.kommentar).toBe(forventetKommentar('høy', 'nytt_inntak', false, '25.07.2026'))
  })

  it('vurderer ikke prøvene mot hverandre når det er huket av', () => {
    const r = kommentar(fortolk({ ...grunn, kortTid: true, samletVurdering: true, tidligere: [] }))
    expect(r.kommentarnokkel).toBe('kort_tid')
    expect(r.konklusjon).toBe('uten_forrige')
    expect(r.grunnlag).toBeNull()
    expect(r.kommentar).toBe(forventetKortTidKommentar('høy'))
  })

  it('trenger ikke tallene for forrige prøve da', () => {
    const r = fortolk({ ...grunn, kortTid: true, forrigeVerdi: '' })
    expect(r.type).toBe('kommentar')
  })

  it('ser bort fra avkryssingen når prøvene ikke er tatt med kort tid imellom', () => {
    const r = kommentar(fortolk({ ...grunn, forrigeDato: '2026-07-04', kortTid: true }))
    expect(r.kommentarnokkel).not.toBe('kort_tid')
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
    expect(kommentar(fortolk(eksempel, modell({ ...REGELSETT, konsentrasjonsnivaer: nivaer }))).niva.navn).toBe('lav')
  })

  it('bruker den nye ordlyden', () => {
    const m = modell(REGELSETT, { ...TEKSTER, uten_forrige: 'Ny prøve anbefales.' })
    expect(kommentar(fortolk({ ...eksempel, ingenTidligere: true }, m)).kommentar.endsWith('Ny prøve anbefales.')).toBe(true)
  })

  it('avslutter med spørsmålsetningen etter regelsettet', () => {
    const uten = modell({ ...REGELSETT, med_sporsmalsetning: [] })
    const prove = { ...eksempel, aktuellVerdi: '2,5' }
    expect(kommentar(fortolk(prove)).kommentar.endsWith(TEKSTER.sporsmalsetning)).toBe(true)
    expect(kommentar(fortolk(prove, uten)).kommentar.endsWith(TEKSTER.sporsmalsetning)).toBe(false)
  })

  it('følger grensene for bruksmønsteret', () => {
    const prove = { ...eksempel, aktuellVerdi: '2,5' }
    expect(kommentar(fortolk(prove)).konklusjon).toBe('vanskelig')
    const strengere = {
      ...REGELSETT,
      bruksmonstre: { ...REGELSETT.bruksmonstre, kronisk: { vanskelig_over: 'gronn', nytt_inntak_over: 'gul' } },
    } satisfies ThcRegelsett
    expect(kommentar(fortolk(prove, modell(strengere))).konklusjon).toBe('nytt_inntak')
  })

  it('varsler etter regelsettets grense', () => {
    const r = { ...REGELSETT, varsel_dager_mellom: 22 }
    expect(kommentar(fortolk(eksempel)).langtMellomProvene).toBe(false)
    expect(kommentar(fortolk(eksempel, modell(r))).langtMellomProvene).toBe(true)
  })

  it('bruker regelsettets faktor for måleusikkerhet under cut-off', () => {
    const inn = { ...eksempel, forrigeUnderCutoff: true, forrigeUcak: '13', forrigeNkre: '2', aktuellVerdi: '2,5' }
    const a = kommentar(fortolk(inn)).grunnlag!.korrigertEndring
    const b = kommentar(
      fortolk(inn, modell({ ...REGELSETT, maleusikkerhet: { ...REGELSETT.maleusikkerhet, faktor_under_cutoff: 1 } })),
    ).grunnlag!.korrigertEndring
    expect(b).toBeCloseTo(korrigertEndring(REGELSETT, 6.5, 2.5, 0.9), 12)
    expect(a).toBeLessThan(b)
  })

  it('gir aldri en konklusjon med en margin regelsettet ikke har', () => {
    // Skjemaet kan leve lenger enn regelsettet: 0,99 er valgt, og så fjernes den.
    const uten099 = modell({ ...REGELSETT, sikkerhetsmarginer: REGELSETT.sikkerhetsmarginer.filter((m) => m.margin !== 0.99) })
    const tilfeller: [ThcInndata, ThcModell][] = []
    for (const variant of [
      eksempel,
      { ...eksempel, aktuellVerdi: '2,5' },
      { ...eksempel, forrigeVerdi: '0' },
      { ...eksempel, forrigeUnderCutoff: true, forrigeUcak: '13', forrigeNkre: '2' },
      { ...eksempel, ingenTidligere: true },
      { ...eksempel, kronisk: false },
    ]) {
      for (const margin of [0.95, 0, Number.NaN]) tilfeller.push([{ ...variant, sikkerhetsmargin: margin }, MODELL])
      tilfeller.push([{ ...variant, sikkerhetsmargin: 0.99 }, uten099])
      // Med marginen på plass gir de samme inndataene en kommentar.
      expect(fortolk({ ...variant, sikkerhetsmargin: 0.99 }).type).toBe('kommentar')
    }
    for (const [inn, m] of tilfeller) {
      expect(fortolk(inn, m)).toEqual({
        type: 'mangler',
        mangler: ['Sikkerhetsmarginen finnes ikke i regelsettet. Velg en av marginene som tilbys.'],
      })
    }
    expect(() => korreksjonsfaktor(REGELSETT, 0.95)).toThrow(/0.95 finnes ikke/)
    expect(() => korrigertEndring(REGELSETT, 6.5, 2.5, 0.95)).toThrow(/0.95 finnes ikke/)
  })
})

describe('valideringen', () => {
  const med = (endring: Partial<ThcRegelsett>): ThcRegelsett => ({ ...REGELSETT, ...endring })
  const tekst = (nokkel: ThcTekstnokkel, verdi: string): ThcTekster => ({ ...TEKSTER, [nokkel]: verdi })

  it.each<[string, ThcRegelsett, RegExp]>([
    ['konverteringsfaktor 0', med({ konverteringsfaktor: 0 }), /Konverteringsfaktoren/],
    ['negativ amplitude', med({ kurver: { ...REGELSETT.kurver, rod: { ...REGELSETT.kurver.rod, a1: -1 } } }), /a1 må være/],
    ['kurve uten navn', med({ kurver: { ...REGELSETT.kurver, gul: { ...REGELSETT.kurver.gul, navn: ' ' } } }), /gule kurven mangler navn/],
    ['kurver i feil rekkefølge', med({ kurver: { ...REGELSETT.kurver, gronn: REGELSETT.kurver.rod, rod: REGELSETT.kurver.gronn } }), /grønne kurven må gi minst like rask/],
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
    ['kort tid 0 døgn', med({ kort_tid_dager: 0 }), /kort tid mellom prøvene må være et helt antall døgn/],
    ['kort tid 1,5 døgn', med({ kort_tid_dager: 1.5 }), /kort tid mellom prøvene må være et helt antall døgn/],
    ['spørsmålsetning for introsetningen', med({ med_sporsmalsetning: ['introsetning' as never] }), /ukjent kommentar: introsetning/],
    ['spørsmålsetning to ganger', med({ med_sporsmalsetning: ['kort_tid', 'kort_tid'] }), /én gang per kommentar/],
    ['spørsmålsetning i feil rekkefølge', med({ med_sporsmalsetning: ['kort_tid', 'vanskelig'] }), /fast rekkefølge/],
  ])('avviser regelsett med %s', (_, r, melding) => {
    expect(validerThcRegelsett(r).join('\n')).toMatch(melding)
    const godkjent = godkjennThcRegelsett(r)
    expect(godkjent.ok).toBe(false)
    expect(lagThcModell(r, TEKSTER).ok).toBe(false)
  })

  it.each<[string, ThcTekster, RegExp]>([
    ['tom tekst', tekst('sporsmalsetning', ''), /er tom/],
    ['tekst med mellomrom i enden', tekst('uten_forrige_nylig', 'Tekst. '), /mellomrom/],
    ['dato mangler', tekst('vanskelig', 'Kan ikke fastslås.'), /må inneholde \{forrige prøvedato\}/],
    ['tidligere dato mangler', tekst('samlet_vurdering', 'Etter {forrige prøvedato}.'), /må inneholde \{tidligere prøvedato\}/],
    ['dato der den ikke finnes', tekst('uten_forrige', 'Siden {forrige prøvedato}.'), /ikke kan bruke/],
    ['tidligere dato der den ikke finnes', tekst('vanskelig', '{forrige prøvedato} {tidligere prøvedato}.'), /ikke kan bruke/],
    ['nivå mangler i introsetningen', tekst('introsetning', 'Påvist.'), /må inneholde \{nivå\}/],
    ['ukjent plassholder', tekst('introsetning', 'Påvist i {nivå} {mengde}.'), /ikke kan bruke: \{mengde\}/],
    ['løs krøllparentes', tekst('introsetning', 'Påvist i {nivå} }.'), /krøllparentes/],
  ])('avviser tekster med %s', (_, t, melding) => {
    expect(validerThcTekster(t).join('\n')).toMatch(melding)
    expect(lagThcModell(REGELSETT, t).ok).toBe(false)
  })

  it('er den eneste veien til et regelsett motoren tar imot', () => {
    const godkjent = godkjennThcRegelsett(REGELSETT)
    expect(godkjent.ok && godkjent.regelsett).toBe(REGELSETT)
    // Et ukontrollert regelsett stoppes allerede av typene.
    // @ts-expect-error — reglene og tekstene er ikke godkjent
    const ukontrollert: ThcModell = { regler: REGELSETT, tekster: TEKSTER }
    void ukontrollert
  })
})
