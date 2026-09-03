import { describe, expect, it } from 'vitest'
import { analytes } from '../analytes'
import { search } from '../search'
import {
  beregnIrcak,
  beregnKategori,
  byggKommentar,
  dagerMellom,
  erThcAnalytt,
  formaterDatoNorsk,
  formaterIrcak,
  fortolkThc,
  forventetEndring,
  INGEN_SIKKERHETSMARGIN,
  konsentrasjonsniva,
  korreksjonsfaktor,
  korrigertEndring,
  KURVE_GRONN,
  KURVE_GUL,
  KURVE_LILLA,
  KURVE_ROD,
  lesTall,
  STANDARD_SIKKERHETSMARGIN,
  THC_ANALYTT,
  tidForVerdi,
  TOM_THC_INNDATA,
  USIKKERHET_UNDER_CUTOFF,
  verdiPaaKurve,
} from '../thc'
import { byggGraf, formaterProsent } from '../thcPlot'
import { initialState, reducer, stageOf } from '../../state'

/**
 * Fasitverdiene er lest rett ut av `originaldata/THC-COOH.xlsm` — cellene som
 * er navngitt i kommentarene — med regnearkets eksempel: forrige prøve 6,5
 * den 04.07.2026 og denne prøven 2,5 den 27.07.2026, kronisk bruk lagt til
 * grunn. Regnearket er fasit; disse testene skal ikke «rettes» mot noe annet.
 * Ett bevisst avvik fra regnearket er bestilt av eieren: «5-7 dager» skrives
 * med tankestrek, «5–7 dager».
 */

describe('utskillelseskurvene mot regnearket', () => {
  it('starter der regnearkets kurver starter (A-verdiene i rad 14)', () => {
    expect(verdiPaaKurve(0, KURVE_GRONN)).toBeCloseTo(44.0919207742365, 12)
    expect(verdiPaaKurve(0, KURVE_GUL)).toBeCloseTo(88.183841548473, 12)
    expect(verdiPaaKurve(0, KURVE_ROD)).toBeCloseTo(108.25848339033908, 12)
    expect(verdiPaaKurve(0, KURVE_LILLA)).toBeCloseTo(724.7333991460937, 12)
  })

  it('finner samme tidspunkt for forrige prøve som regnearkets Newton-søk (rad 59)', () => {
    expect(tidForVerdi(6.5, KURVE_GRONN)).toBeCloseTo(7.699327471604898, 10)
    expect(tidForVerdi(6.5, KURVE_GUL)).toBeCloseTo(12.876649902242379, 10)
    expect(tidForVerdi(6.5, KURVE_ROD)).toBeCloseTo(50.22455013808995, 10)
    expect(tidForVerdi(6.5, KURVE_LILLA)).toBeCloseTo(26.969616418715972, 10)
  })

  it('går bakover i tid for verdier over kurvens startpunkt', () => {
    const t = tidForVerdi(200, KURVE_GRONN)
    expect(t).toBeLessThan(0)
    expect(verdiPaaKurve(t, KURVE_GRONN)).toBeCloseTo(200, 8)
  })

  it('regner samme forventede endring som regnearket (rad 63)', () => {
    expect(forventetEndring(6.5, 23, KURVE_GRONN)).toBeCloseTo(-0.9540072740171043, 10)
    expect(forventetEndring(6.5, 23, KURVE_GUL)).toBeCloseTo(-0.9540072713754896, 10)
    expect(forventetEndring(6.5, 23, KURVE_ROD)).toBeCloseTo(-0.44290152002030236, 10)
    expect(forventetEndring(6.5, 23, KURVE_LILLA)).toBeCloseTo(-0.7421099926939771, 10)
  })

  it('treffer regnearkets graftabell midt mellom prøvene (rad 129, dag 13,57)', () => {
    expect(forventetEndring(6.5, 13.57, KURVE_GRONN)).toBeCloseTo(-0.837450144107132, 10)
    expect(forventetEndring(6.5, 13.57, KURVE_LILLA)).toBeCloseTo(-0.55568117161152, 10)
    expect(forventetEndring(6.5, 13.57, KURVE_ROD)).toBeCloseTo(-0.30169792885982494, 10)
  })
})

describe('korreksjonen for måleusikkerhet', () => {
  it('gir regnearkets korrigerte endring (D20)', () => {
    expect(korrigertEndring(6.5, 2.5, 0.9)).toBeCloseTo(-0.7352964402245712, 12)
  })

  it('bruker regnearkets 10 %-kvantil: uendret måling regnes som nedgang', () => {
    // LOGNORM.INV(0,1; 0; √(2·CV²)) − 1 med regnearkets CV-er.
    expect(korrigertEndring(1, 1, 0.9)).toBeCloseTo(-0.3117707445838853, 10)
  })
})

describe('sikkerhetsmarginen', () => {
  it('står på regnearkets egen sikkerhet (B5) når appen lastes', () => {
    expect(STANDARD_SIKKERHETSMARGIN).toBe(0.9)
    expect(TOM_THC_INNDATA.sikkerhetsmargin).toBe(0.9)
  })

  it('leser av kvantilet marginen peker på: exp(Φ⁻¹(1 − margin) · √(2·CV²))', () => {
    expect(korreksjonsfaktor(0.5)).toBe(1)
    expect(korreksjonsfaktor(0.9)).toBeCloseTo(0.6882292554161147, 12)
    expect(korreksjonsfaktor(0.99)).toBeCloseTo(0.5075088513115085, 12)
  })

  it('er ingen korreksjon uten margin — medianen er den målte verdien selv', () => {
    expect(INGEN_SIKKERHETSMARGIN).toBe(0.5)
    expect(korrigertEndring(6.5, 2.5, INGEN_SIKKERHETSMARGIN)).toBeCloseTo(2.5 / 6.5 - 1, 12)
  })

  it('trekker mer fra jo høyere marginen er', () => {
    expect(korreksjonsfaktor(0.99)).toBeLessThan(korreksjonsfaktor(0.9))
    expect(korreksjonsfaktor(0.9)).toBeLessThan(korreksjonsfaktor(0.5))
  })
})

describe('konsentrasjonsnivået (M21)', () => {
  it('skiller lav, middels høy og høy på 20 og 40', () => {
    expect(konsentrasjonsniva(2.5)).toBe('lav')
    expect(konsentrasjonsniva(19.99)).toBe('lav')
    expect(konsentrasjonsniva(20)).toBe('middels høy')
    expect(konsentrasjonsniva(39.99)).toBe('middels høy')
    expect(konsentrasjonsniva(40)).toBe('høy')
  })
})

describe('kategorien (B65)', () => {
  const forventet = {
    gronn: forventetEndring(6.5, 23, KURVE_GRONN),
    gul: forventetEndring(6.5, 23, KURVE_GUL),
    rod: forventetEndring(6.5, 23, KURVE_ROD),
  }

  it('gjenskaper regnearkets eksempel: over gul, under rød gir kategori 3', () => {
    expect(beregnKategori(true, true, korrigertEndring(6.5, 2.5, 0.9), forventet)).toBe(3)
  })

  it('legger til 1 når kronisk bruk ikke legges til grunn', () => {
    expect(beregnKategori(true, false, korrigertEndring(6.5, 2.5, 0.9), forventet)).toBe(4)
  })

  it('er 0 eller 1 uten sammenligningsgrunnlag', () => {
    expect(beregnKategori(false, true)).toBe(0)
    expect(beregnKategori(false, false)).toBe(1)
  })

  it('gir kategori 4 når endringen er over alle kurvene', () => {
    expect(beregnKategori(true, true, korrigertEndring(6.5, 9, 0.9), forventet)).toBe(4)
  })

  it('kan lande mellom grønn og gul når forrige prøve lå høyt på kurvene', () => {
    // Høye verdier ligger i kurvens bratte start, der grønn og gul faktisk
    // skiller lag. 50 → 36,671 på ett døgn ligger mellom dem.
    const hoyt = {
      gronn: forventetEndring(50, 1, KURVE_GRONN),
      gul: forventetEndring(50, 1, KURVE_GUL),
      rod: forventetEndring(50, 1, KURVE_ROD),
    }
    expect(beregnKategori(true, true, korrigertEndring(50, 36.671, 0.9), hoyt)).toBe(2)
  })
})

describe('kommentaren, ord for ord mot regnearket', () => {
  it('gjenskaper regnearkets eksempel (Fortolkning!A6), med tankestrek i «5–7»', () => {
    expect(byggKommentar('lav', 3, true, '04.07.2026')).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i lav konsentrasjon. ' +
        'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. ' +
        'Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis ' +
        'opptil en måned etter avsluttet inntak. Basert på analyseresultatet alene er ' +
        'det vanskelig å avgjøre hvorvidt cannabis har vært inntatt etter prøve tatt ' +
        '04.07.2026. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon ' +
        'for klinisk farmakologi Ullevål (se ous.labfag.no).',
    )
  })

  it('konkluderer med inntak når endringen er over alle kurvene (J25)', () => {
    expect(byggKommentar('lav', 4, true, '04.07.2026')).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i lav konsentrasjon. ' +
        'Analyseresultatet tilsier at cannabis har vært inntatt etter prøve tatt 04.07.2026.',
    )
  })

  it('sier «ikke nødvendigvis» når endringen er under gul kurve (J28)', () => {
    expect(byggKommentar('lav', 1, true, '04.07.2026')).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i lav konsentrasjon. ' +
        'Analyseresultatet viser at cannabis har vært inntatt. ' +
        'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. ' +
        'Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis ' +
        'opptil en måned etter avsluttet inntak. Analyseresultatet tilsier at cannabis ' +
        'ikke nødvendigvis har vært inntatt etter prøve tatt 04.07.2026. Ved spørsmål ' +
        'kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk farmakologi ' +
        'Ullevål (se ous.labfag.no).',
    )
  })

  it('uten tidligere prøve: lav og middels høy sier påvist, oppgir påvisningstid og anbefaler oppfølging', () => {
    expect(byggKommentar('lav', 0, false, '')).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i lav konsentrasjon. ' +
        'Analyseresultatet viser at cannabis har vært inntatt. ' +
        'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. ' +
        'Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis ' +
        'opptil en måned etter avsluttet inntak. Oppfølging med flere prøver anbefales.',
    )
    expect(byggKommentar('middels høy', 0, false, '')).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i middels høy konsentrasjon. ' +
        'Analyseresultatet viser at cannabis har vært inntatt. ' +
        'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. ' +
        'Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis ' +
        'opptil en måned etter avsluttet inntak. Oppfølging med flere prøver anbefales.',
    )
  })

  it('uten tidligere prøve: høy konsentrasjon peker mot nylig inntak (J24)', () => {
    expect(byggKommentar('høy', 0, false, '')).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i høy konsentrasjon. ' +
        'Slike konsentrasjoner ses gjerne ved prøvetaking kort tid etter inntak av cannabis. ' +
        'Oppfølging med flere prøver anbefales.',
    )
  })
})

describe('kommentaren under påvisningsgrensen', () => {
  it('setter «har vært inntatt» foran begge de to konklusjonene', () => {
    for (const kategori of [1, 2, 3]) {
      expect(byggKommentar('lav', kategori, true, '04.07.2026', true)).toContain(
        'Analyseresultatet viser at cannabis har vært inntatt. ',
      )
    }
  })

  it('lar høy konsentrasjon peke mot nylig inntak, uten setningen om at inntak har skjedd', () => {
    expect(byggKommentar('høy', 3, true, '04.07.2026', true)).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i høy konsentrasjon. ' +
        'Slike konsentrasjoner ses gjerne ved prøvetaking kort tid etter inntak av cannabis. ' +
        'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. ' +
        'Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis opptil ' +
        'en måned etter avsluttet inntak. Ved lave THC-syrekonsentrasjoner og varierende ' +
        'kreatininresultater kan nivået svinge over og under påvisningsgrensen. Vurdering i ' +
        'forhold til andre prøver kan derfor være vanskelig, og inntakstidspunktet kan ikke ' +
        'avgjøres. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for ' +
        'klinisk farmakologi Ullevål (se ous.labfag.no).',
    )
  })

  it('endrer ingenting når inntaket er sikkert nytt, eller når forrige prøve ikke brukes', () => {
    expect(byggKommentar('lav', 4, true, '04.07.2026', true)).toBe(
      byggKommentar('lav', 4, true, '04.07.2026'),
    )
    expect(byggKommentar('lav', 0, false, '', true)).toBe(byggKommentar('lav', 0, false, ''))
  })
})

describe('datoer og tall', () => {
  it('teller hele døgn mellom prøvene som regnearket (E4 − E2)', () => {
    expect(dagerMellom('2026-07-04', '2026-07-27')).toBe(23)
    expect(dagerMellom('2026-07-27', '2026-07-27')).toBe(0)
    expect(dagerMellom('2026-07-27', '2026-07-04')).toBe(-23)
    // Over et sommertidskifte i mars er døgnene like fulle.
    expect(dagerMellom('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('skriver datoen slik den står i kommentaren', () => {
    expect(formaterDatoNorsk('2026-07-04')).toBe('04.07.2026')
  })

  it('leser tall med både komma og punktum', () => {
    expect(lesTall('2,5')).toBe(2.5)
    expect(lesTall('2.5')).toBe(2.5)
    expect(lesTall(' 40 ')).toBe(40)
    expect(lesTall('-1')).toBe(-1)
    expect(lesTall('')).toBeNull()
    expect(lesTall('abc')).toBeNull()
    expect(lesTall('1,2,3')).toBeNull()
  })
})

describe('fortolkningen fra inndata til kommentar', () => {
  const eksempel = {
    ...TOM_THC_INNDATA,
    kronisk: true,
    aktuellVerdi: '2,5',
    aktuellDato: '2026-07-27',
    ingenTidligere: false,
    forrigeVerdi: '6,5',
    forrigeDato: '2026-07-04',
    sikkerhetsmargin: STANDARD_SIKKERHETSMARGIN,
  }

  /** Kategorien fortolkningen lander på — snarvei for eksemplene under. */
  const kategoriFor = (inn: typeof eksempel) => {
    const resultat = fortolkThc(inn)
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    return resultat.kategori
  }

  it('gjenskaper regnearkets eksempel fra rå felttekst', () => {
    const resultat = fortolkThc(eksempel)
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kategori).toBe(3)
    expect(resultat.kommentar).toBe(byggKommentar('lav', 3, true, '04.07.2026'))
    expect(resultat.merEnn30Dager).toBe(false)
    expect(resultat.grunnlag).not.toBeNull()
    expect(resultat.grunnlag?.dager).toBe(23)
    expect(resultat.grunnlag?.forrige).toBe(6.5)
    expect(resultat.grunnlag?.aktuell).toBe(2.5)
    expect(resultat.grunnlag?.kronisk).toBe(true)
    expect(resultat.grunnlag?.maltEndring).toBeCloseTo(2.5 / 6.5 - 1, 12)
    expect(resultat.grunnlag?.korrigertEndring).toBeCloseTo(-0.7352964402245712, 12)
    expect(resultat.grunnlag?.forventet.gul).toBeCloseTo(-0.9540072713754896, 10)
    expect(resultat.grunnlag?.forventet.rod).toBeCloseTo(-0.44290152002030236, 10)
  })

  it('lister det som mangler i et tomt skjema', () => {
    const resultat = fortolkThc(TOM_THC_INNDATA)
    if (resultat.type !== 'mangler') throw new Error('ventet mangler')
    expect(resultat.mangler).toEqual([
      'Fyll inn IRCAK for denne prøven.',
      'Fyll inn prøvedato for denne prøven.',
      'Fyll inn IRCAK for forrige prøve.',
      'Fyll inn prøvedato for forrige prøve.',
    ])
  })

  it('krever at denne prøvens IRCAK er et tall over 0', () => {
    const resultat = fortolkThc({ ...eksempel, aktuellVerdi: '0' })
    if (resultat.type !== 'mangler') throw new Error('ventet mangler')
    expect(resultat.mangler).toEqual(['IRCAK for denne prøven må være et tall større enn 0.'])
  })

  it('stopper prøver i feil rekkefølge', () => {
    const resultat = fortolkThc({ ...eksempel, forrigeDato: '2026-08-01' })
    if (resultat.type !== 'mangler') throw new Error('ventet mangler')
    expect(resultat.mangler).toEqual(['Denne prøven kan ikke være tatt før forrige prøve.'])
  })

  it('fortolker bare denne prøven når avkrysningen sier at ingen tidligere finnes', () => {
    const resultat = fortolkThc({
      ...TOM_THC_INNDATA,
      aktuellVerdi: '2,5',
      ingenTidligere: true,
    })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kommentar).toBe(byggKommentar('lav', 0, false, ''))
    expect(resultat.grunnlag).toBeNull()
  })

  it('krever ingen datoer uten en tidligere prøve — de brukes ikke til noe', () => {
    const resultat = fortolkThc({ ...TOM_THC_INNDATA, ingenTidligere: true })
    if (resultat.type !== 'mangler') throw new Error('ventet mangler')
    expect(resultat.mangler).toEqual(['Fyll inn IRCAK for denne prøven.'])
  })

  it('sammenligner fortsatt mot en prøve langt eldre enn 60 døgn, i motsetning til regnearkets K21', () => {
    const resultat = fortolkThc({ ...eksempel, forrigeDato: '2026-04-01' })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.merEnn30Dager).toBe(true)
    expect(resultat.grunnlag).not.toBeNull()
    expect(resultat.grunnlag?.dager).toBe(117)
    expect(resultat.kommentar).not.toBe(byggKommentar('lav', 0, false, ''))
  })

  it('varsler først når det er mer enn 30 døgn mellom prøvene', () => {
    const nøyaktig30 = fortolkThc({ ...eksempel, forrigeDato: '2026-06-27' })
    const over30 = fortolkThc({ ...eksempel, forrigeDato: '2026-06-26' })
    if (nøyaktig30.type !== 'kommentar' || over30.type !== 'kommentar') {
      throw new Error('ventet kommentar')
    }
    expect(nøyaktig30.grunnlag?.dager).toBe(30)
    expect(nøyaktig30.merEnn30Dager).toBe(false)
    expect(over30.grunnlag?.dager).toBe(31)
    expect(over30.merEnn30Dager).toBe(true)
  })

  it('følger bruksmønsteret: samme prøver uten kronisk bruk gir kategori 4', () => {
    const resultat = fortolkThc({ ...eksempel, kronisk: false })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kategori).toBe(4)
    expect(resultat.kommentar).toBe(byggKommentar('lav', 4, true, '04.07.2026'))
  })

  it('lar sikkerhetsmarginen avgjøre der endringen ligger nær den tregeste kurven', () => {
    // 6,5 → 4,55 er en målt nedgang på 30 %. Tatt på ordet er det mindre
    // nedgang enn selv den tregeste dokumenterte utskillelsen gir på 23 døgn
    // (44 %), og da må cannabis ha vært inntatt. Med marginen på plass regnes
    // nedgangen som 52 %, og konklusjonen mykner et hakk.
    const prove = { ...eksempel, aktuellVerdi: '4,55' }
    expect(kategoriFor({ ...prove, sikkerhetsmargin: 0.5 })).toBe(4)
    expect(kategoriFor({ ...prove, sikkerhetsmargin: 0.9 })).toBe(3)
    expect(kategoriFor({ ...prove, sikkerhetsmargin: 0.99 })).toBe(3)
  })

  it('gir tvilens fordel ved 99 % der 90 % ikke rekker', () => {
    // 6,5 → 5,85 er bare 10 % nedgang: over den tregeste kurven med både
    // ingen og 90 % margin, under den med 99 %.
    const prove = { ...eksempel, aktuellVerdi: '5,85' }
    expect(kategoriFor({ ...prove, sikkerhetsmargin: 0.5 })).toBe(4)
    expect(kategoriFor({ ...prove, sikkerhetsmargin: 0.9 })).toBe(4)
    expect(kategoriFor({ ...prove, sikkerhetsmargin: 0.99 })).toBe(3)
  })

  it('tar marginen med i grunnlaget, så figuren og forklaringen kan vise den', () => {
    const resultat = fortolkThc({ ...eksempel, sikkerhetsmargin: 0.99 })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.grunnlag?.sikkerhetsmargin).toBe(0.99)
    expect(resultat.grunnlag?.korrigertEndring).toBeCloseTo(korrigertEndring(6.5, 2.5, 0.99), 12)
    // Den målte endringen står urørt av marginen.
    expect(resultat.grunnlag?.maltEndring).toBeCloseTo(2.5 / 6.5 - 1, 12)
  })

  it('samme dag er gyldig: ingen forventet nedgang, korreksjonen gjør resten', () => {
    const resultat = fortolkThc({
      ...eksempel,
      forrigeDato: '2026-07-27',
      forrigeVerdi: '6,5',
      aktuellVerdi: '6,5',
    })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kategori).toBe(1)
    expect(resultat.grunnlag?.dager).toBe(0)
  })
})

describe('forrige prøve uten THC-syre (IRCAK 0)', () => {
  const eksempel = {
    ...TOM_THC_INNDATA,
    aktuellVerdi: '2,5',
    aktuellDato: '2026-07-27',
    forrigeVerdi: '0',
    forrigeDato: '2026-07-04',
  }

  it('konkluderer med nytt inntak, uansett hvor lav konsentrasjonen er nå', () => {
    for (const aktuellVerdi of ['0,1', '2,5', '19,9', '50']) {
      const resultat = fortolkThc({ ...eksempel, aktuellVerdi })
      if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
      expect(resultat.kategori).toBeGreaterThanOrEqual(4)
      expect(resultat.kommentar).toContain(
        'Analyseresultatet tilsier at cannabis har vært inntatt etter prøve tatt 04.07.2026.',
      )
    }
  })

  it('gir samme kommentar enten kronisk bruk legges til grunn eller ikke', () => {
    const medKronisk = fortolkThc(eksempel)
    const utenKronisk = fortolkThc({ ...eksempel, kronisk: false })
    if (medKronisk.type !== 'kommentar' || utenKronisk.type !== 'kommentar') {
      throw new Error('ventet kommentar')
    }
    expect(medKronisk.kategori).toBe(4)
    expect(utenKronisk.kategori).toBe(5)
    expect(medKronisk.kommentar).toBe(byggKommentar('lav', 4, true, '04.07.2026'))
    expect(utenKronisk.kommentar).toBe(medKronisk.kommentar)
  })

  it('tegner ingen figur — det finnes ingen prosentvis endring fra 0', () => {
    const resultat = fortolkThc(eksempel)
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.grunnlag).toBeNull()
  })

  it('konkluderer med nytt inntak også når forrige prøve er langt eldre enn 30 døgn', () => {
    const resultat = fortolkThc({ ...eksempel, forrigeDato: '2026-04-01' })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.merEnn30Dager).toBe(true)
    expect(resultat.kategori).toBe(4)
    expect(resultat.kommentar).toBe(byggKommentar('lav', 4, true, '01.04.2026'))
  })

  it('godtar fortsatt ikke en negativ IRCAK', () => {
    const resultat = fortolkThc({ ...eksempel, forrigeVerdi: '-1' })
    if (resultat.type !== 'mangler') throw new Error('ventet mangler')
    expect(resultat.mangler).toEqual([
      'IRCAK for forrige prøve må være et tall som ikke er negativt.',
    ])
  })
})

describe('forrige prøve under påvisningsgrensen', () => {
  /** UCAK 0,65 og NKRE 0,1 gir IRCAK 6,5 — regnearkets eksempelverdi. */
  const eksempel = {
    ...TOM_THC_INNDATA,
    aktuellVerdi: '2,5',
    aktuellDato: '2026-07-27',
    forrigeUnderCutoff: true,
    forrigeUcak: '0,65',
    forrigeNkre: '0,1',
    forrigeDato: '2026-07-04',
  }

  it('regner IRCAK som UCAK delt på NKRE', () => {
    expect(beregnIrcak('0,65', '0,1')).toBeCloseTo(6.5, 12)
    expect(beregnIrcak('0.65', '0.1')).toBeCloseTo(6.5, 12)
    expect(beregnIrcak('0', '0,1')).toBe(0)
    // Uten et brukbart regnestykke finnes det ingen IRCAK å svare med.
    expect(beregnIrcak('', '0,1')).toBeNull()
    expect(beregnIrcak('0,65', '')).toBeNull()
    expect(beregnIrcak('0,65', '0')).toBeNull()
    expect(beregnIrcak('-1', '0,1')).toBeNull()
  })

  it('bruker den beregnede IRCAK-en som forrige prøve', () => {
    const resultat = fortolkThc(eksempel)
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.grunnlag?.forrige).toBeCloseTo(6.5, 12)
    expect(resultat.grunnlag?.underCutoff).toBe(true)
    expect(resultat.grunnlag?.maltEndring).toBeCloseTo(2.5 / 6.5 - 1, 12)
  })

  it('legger måleusikkerheten 50 % høyere til grunn', () => {
    expect(USIKKERHET_UNDER_CUTOFF).toBe(1.5)
    expect(korreksjonsfaktor(0.9, USIKKERHET_UNDER_CUTOFF)).toBeCloseTo(0.5709521262933627, 12)
    expect(korreksjonsfaktor(0.99, USIKKERHET_UNDER_CUTOFF)).toBeCloseTo(0.3615475572121613, 12)
    // Uten margin flytter ikke medianen seg av at spredningen blir større.
    expect(korreksjonsfaktor(INGEN_SIKKERHETSMARGIN, USIKKERHET_UNDER_CUTOFF)).toBe(1)

    const resultat = fortolkThc(eksempel)
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.grunnlag?.korrigertEndring).toBeCloseTo(
      korrigertEndring(6.5, 2.5, 0.9, USIKKERHET_UNDER_CUTOFF),
      12,
    )
    // Den samme prøven uten avkryssingen leses av lenger inne i fordelingen.
    expect(resultat.grunnlag?.korrigertEndring).toBeLessThan(korrigertEndring(6.5, 2.5, 0.9))
  })

  it('gjør fortolkningen mer forsiktig der endringen ligger nær en kurve', () => {
    // 6,5 → 5,85 er 10 % nedgang. Med vanlig måleusikkerhet er det mindre
    // nedgang enn selv den tregeste kurven gir på 23 døgn, og kommentaren
    // konkluderer med nytt inntak. Med den forhøyede usikkerheten mykner den
    // til «vanskelig å vurdere».
    const utenom = fortolkThc({
      ...eksempel,
      aktuellVerdi: '5,85',
      forrigeUnderCutoff: false,
      forrigeVerdi: '6,5',
    })
    const under = fortolkThc({ ...eksempel, aktuellVerdi: '5,85' })
    if (utenom.type !== 'kommentar' || under.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(utenom.kategori).toBe(4)
    expect(under.kategori).toBe(3)
  })

  it('sier at inntakstidspunktet ikke kan avgjøres når endringen ligger mellom kurvene', () => {
    const resultat = fortolkThc({ ...eksempel, aktuellVerdi: '5,85' })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kommentar).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i lav konsentrasjon. ' +
        'Analyseresultatet viser at cannabis har vært inntatt. ' +
        'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. ' +
        'Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis opptil ' +
        'en måned etter avsluttet inntak. Ved lave THC-syrekonsentrasjoner og varierende ' +
        'kreatininresultater kan nivået svinge over og under påvisningsgrensen. Vurdering i ' +
        'forhold til andre prøver kan derfor være vanskelig, og inntakstidspunktet kan ikke ' +
        'avgjøres. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for ' +
        'klinisk farmakologi Ullevål (se ous.labfag.no).',
    )
  })

  it('forklarer «ikke påvist» når endringen er som forventet', () => {
    const resultat = fortolkThc({ ...eksempel, aktuellVerdi: '0,5' })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kategori).toBe(1)
    expect(resultat.kommentar).toBe(
      'THC-syre, et omdannelsesprodukt av cannabis, er påvist i lav konsentrasjon. ' +
        'Analyseresultatet viser at cannabis har vært inntatt. ' +
        'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. ' +
        'Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis opptil ' +
        'en måned etter avsluttet inntak. Analyseresultatet tilsier at cannabis ikke ' +
        'nødvendigvis har vært inntatt etter prøve tatt 04.07.2026, selv om prøven tatt ' +
        '04.07.2026 ble rapportert som «ikke påvist». Ved lave THC-syrekonsentrasjoner og ' +
        'varierende kreatininresultater kan nivået svinge over og under påvisningsgrensen, ' +
        'uten at nytt inntak nødvendigvis har funnet sted. Ved spørsmål kan rekvirent ' +
        'kontakte vakthavende lege ved Seksjon for klinisk farmakologi Ullevål ' +
        '(se ous.labfag.no).',
    )
  })

  it('bruker den vanlige kommentaren når inntaket er sikkert nytt', () => {
    const resultat = fortolkThc({ ...eksempel, aktuellVerdi: '30' })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kategori).toBe(4)
    expect(resultat.kommentar).toBe(byggKommentar('middels høy', 4, true, '04.07.2026'))
  })

  it('lar en UCAK på 0 falle tilbake på regelen om nytt inntak', () => {
    const resultat = fortolkThc({ ...eksempel, forrigeUcak: '0' })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kategori).toBe(4)
    expect(resultat.kommentar).toBe(byggKommentar('lav', 4, true, '04.07.2026'))
  })

  it('spør etter UCAK og NKRE i stedet for IRCAK', () => {
    const resultat = fortolkThc({ ...TOM_THC_INNDATA, forrigeUnderCutoff: true })
    if (resultat.type !== 'mangler') throw new Error('ventet mangler')
    expect(resultat.mangler).toEqual([
      'Fyll inn IRCAK for denne prøven.',
      'Fyll inn prøvedato for denne prøven.',
      'Fyll inn UCAK (THC-syre) for forrige prøve.',
      'Fyll inn NKRE (kreatinin) for forrige prøve.',
      'Fyll inn prøvedato for forrige prøve.',
    ])
  })

  it('krever et kreatinin over 0 — ellers finnes det ingen IRCAK', () => {
    const resultat = fortolkThc({ ...eksempel, forrigeNkre: '0' })
    if (resultat.type !== 'mangler') throw new Error('ventet mangler')
    expect(resultat.mangler).toEqual([
      'NKRE (kreatinin) for forrige prøve må være et tall større enn 0.',
    ])
  })

  it('lar avkryssingen ligge når ingen tidligere prøve finnes', () => {
    const resultat = fortolkThc({
      ...TOM_THC_INNDATA,
      forrigeUnderCutoff: true,
      ingenTidligere: true,
      aktuellVerdi: '2,5',
    })
    if (resultat.type !== 'kommentar') throw new Error('ventet kommentar')
    expect(resultat.kommentar).toBe(byggKommentar('lav', 0, false, ''))
  })

  it('skriver den beregnede IRCAK-en med norsk desimaltegn', () => {
    expect(formaterIrcak(6.5)).toBe('6,5')
    expect(formaterIrcak(0.65 / 0.1)).toBe('6,5')
    expect(formaterIrcak(2 / 3)).toBe('0,667')
    expect(formaterIrcak(12)).toBe('12')
    // En verdi over 0 skal aldri kunne leses som 0.
    expect(formaterIrcak(0.00004)).toBe('0,00004')
    expect(formaterIrcak(0)).toBe('0')
  })
})

describe('visualiseringen', () => {
  const graf = byggGraf({ forrige: 6.5, dager: 23, korrigertEndring: -0.7352964402245712 })

  it('tegner de tre kurvene fortolkningen bruker, med navnene eieren har valgt', () => {
    expect(graf.kurver.map((k) => k.navn)).toEqual([
      'Normal utskillelse',
      'Moderat utskillelse',
      'Treg utskillelse',
    ])
  })

  it('starter alle kurvene i null og ender på konklusjonens grenser (rad 63)', () => {
    for (const kurve of graf.kurver) {
      expect(kurve.punkter.at(0)?.prosent).toBeCloseTo(0, 8)
    }
    const siste = (navn: string) => {
      const punkt = graf.kurver.find((k) => k.navn === navn)?.punkter.at(-1)
      if (!punkt) throw new Error(`mangler kurven ${navn}`)
      return punkt.prosent
    }
    // Regnearkets B63, C63 og D63 — de samme tallene grensene i kategorien
    // leses av. Den midterste er den gule: regnearkets graf tegner den lilla
    // (−74,21 % her), men den er ikke med i konklusjonen.
    expect(siste('Normal utskillelse')).toBeCloseTo(-95.40072740171043, 8)
    expect(siste('Moderat utskillelse')).toBeCloseTo(-95.40072713754896, 8)
    expect(siste('Treg utskillelse')).toBeCloseTo(-44.290152002030236, 8)
    // Og de er de samme tallene kategorien faktisk sammenligner med.
    for (const [navn, kurve] of [
      ['Normal utskillelse', KURVE_GRONN],
      ['Moderat utskillelse', KURVE_GUL],
      ['Treg utskillelse', KURVE_ROD],
    ] as const) {
      expect(siste(navn)).toBeCloseTo(forventetEndring(6.5, 23, kurve) * 100, 8)
    }
  })

  it('markerer forrige og denne prøven', () => {
    expect(graf.punkter).toEqual([
      { navn: 'Forrige prøve', dag: 0, prosent: 0 },
      { navn: 'Denne prøven', dag: 23, prosent: -73.52964402245712 },
    ])
  })

  it('holder aksen på runde tall og aldri under −100 %', () => {
    expect(graf.xSteg).toBe(2)
    expect(graf.yBunn).toBeGreaterThanOrEqual(-100)
    expect(graf.yTopp).toBeGreaterThanOrEqual(0)
    expect((graf.yTopp - graf.yBunn) / graf.ySteg).toBeCloseTo(
      Math.round((graf.yTopp - graf.yBunn) / graf.ySteg),
      8,
    )
  })

  it('skalerer x-steget så et langt mellomrom mellom prøvene ikke gir tusenvis av merker', () => {
    // Uten en øvre grense på dager mellom prøvene (fjernet fra fortolkningen)
    // må x-aksen selv holde antall merker nede — også for en prøve flere år
    // gammel, eller en feiltastet årstall.
    const langt = byggGraf({ forrige: 6.5, dager: 3650, korrigertEndring: -0.95 })
    expect(langt.xSteg).toBeGreaterThan(10)
    expect(langt.xMaks / langt.xSteg).toBeLessThan(20)

    const ekstremt = byggGraf({ forrige: 6.5, dager: 36500, korrigertEndring: -0.95 })
    expect(ekstremt.xMaks / ekstremt.xSteg).toBeLessThan(20)
  })

  it('skriver prosent med ekte minustegn', () => {
    expect(formaterProsent(-73.6)).toBe('−74 %')
    expect(formaterProsent(0)).toBe('0 %')
    expect(formaterProsent(12.2)).toBe('+12 %')
  })
})

describe('veien inn i modulen', () => {
  const pool = [...analytes, THC_ANALYTT]

  it('finnes i søket på analyttnavn og analyttkode', () => {
    expect(search('THC-syre', pool)[0]?.analyte.kode).toBe('IRCAK')
    expect(search('thc', pool)[0]?.analyte.kode).toBe('IRCAK')
    expect(search('IRCAK', pool)[0]?.analyte.kode).toBe('IRCAK')
    expect(search('ircak', pool)[0]?.analyte.kode).toBe('IRCAK')
  })

  it('forstyrrer ikke søk etter psykofarmaka', () => {
    expect(search('kve', pool).map((h) => h.analyte.kode)).toEqual(['KVE'])
    // Sertralin og kanrenon (som finnes på «spironolakton») er de eneste
    // treffene på «s» — THC-syre legger ingen til.
    expect(search('s', pool).map((h) => h.analyte.kode)).toEqual(['SERT', 'KANR'])
  })

  it('går til fortolkningsmodulen i stedet for konsentrasjonsbåndene', () => {
    const state = reducer(initialState, { type: 'velg-analytt', analyte: THC_ANALYTT })
    expect(stageOf(state)).toBe('thc')
    expect(erThcAnalytt(THC_ANALYTT)).toBe(true)
  })

  it('går tilbake til søket med ett steg', () => {
    const valgt = reducer(initialState, { type: 'velg-analytt', analyte: THC_ANALYTT })
    expect(stageOf(reducer(valgt, { type: 'tilbake' }))).toBe('search')
  })
})
