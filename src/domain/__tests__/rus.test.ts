import { describe, expect, it } from 'vitest'
import { analytes } from '../analytes'
import {
  erRusAnalytt,
  lesKonsentrasjon,
  moduleKoder,
  rusDatasett,
  rusModulFor,
  RUS_ANALYTTER,
  RUS_MODULER,
  TOM_RUS_INNDATA,
  viserKommentartekst,
  type RusInndata,
  type RusModul,
  type RusPlassering,
  type RusResultat,
} from '../rus'
import { search } from '../search'
import { THC_ANALYTT } from '../thc'

/** Modulen med denne id-en. */
function modul(id: string): RusModul {
  const funnet = RUS_MODULER.find((m) => m.id === id)
  if (!funnet) throw new Error(`ukjent modul i testen: ${id}`)
  return funnet
}

function fortolk(id: string, inn: Partial<RusInndata> = {}): RusResultat {
  return modul(id).fortolk({ ...TOM_RUS_INNDATA, ...inn })
}

/** Kommentarene et resultat gir, som «merke → koder», i rekkefølge. */
function plassert(resultat: RusResultat): string[] {
  if (resultat.type !== 'kommentarer') throw new Error(`ventet kommentarer, fikk ${resultat.type}`)
  return resultat.plasseringer.map((p) => `${p.merke} → ${p.koder.join(' ')}`)
}

function tekster(resultat: RusResultat): string[] {
  if (resultat.type !== 'kommentarer') throw new Error(`ventet kommentarer, fikk ${resultat.type}`)
  return resultat.plasseringer.map((p) => p.tekst)
}

function notiser(resultat: RusResultat): string {
  if (resultat.type !== 'kommentarer') throw new Error(`ventet kommentarer, fikk ${resultat.type}`)
  return resultat.notiser.join(' ')
}

/** Beskjeden og kildens veiledning for et tilfelle som skal til plenum. */
function plenum(resultat: RusResultat): string {
  if (resultat.type !== 'plenum') throw new Error(`ventet plenum, fikk ${resultat.type}`)
  return [resultat.melding, ...resultat.veiledning].join(' ')
}

/** Kildeteksten fra en rad i rusmidler.json. */
function kilde(id: string, nokkel = 'hoved'): string {
  const rad = rusDatasett.rader.find((r) => r.id === id)
  if (!rad) throw new Error(`ukjent rad i testen: ${id}`)
  const tekst = rad.tekster[nokkel]
  if (tekst === undefined) throw new Error(`raden ${id} mangler teksten ${nokkel}`)
  return tekst
}

/** Alle tekstene appen kan komme til å kopiere. */
function alleKommentarer(): string[] {
  return rusDatasett.rader.flatMap((r) => Object.values(r.tekster))
}

describe('datasettet', () => {
  it('har alle radene fra tabellene i kilden', () => {
    expect(rusDatasett.rader).toHaveLength(26)
    expect(rusDatasett.meta.antallRader).toBe(26)
    expect(rusDatasett.meta.kilde).toBe('originaldata/rusmidler.md')
  })

  it('gir hver rad en gruppe og koder', () => {
    for (const rad of rusDatasett.rader) {
      expect(rad.gruppe, rad.id).not.toBe('')
      expect(rad.koder.length, rad.id).toBeGreaterThan(0)
    }
  })

  it('dekker alle kodene med moduler, uten å bruke noen to ganger', () => {
    const brukt = new Set<string>()
    for (const m of RUS_MODULER) {
      for (const kode of moduleKoder(m)) {
        expect(brukt.has(kode), kode).toBe(false)
        brukt.add(kode)
      }
    }
    const iKilden = new Set(rusDatasett.rader.flatMap((r) => r.koder))
    expect([...brukt].sort()).toEqual([...iKilden].sort())
  })

  it('skriver tallintervaller med tankestrek, ikke bindestrek', () => {
    for (const tekst of alleKommentarer()) {
      expect(tekst, tekst).not.toMatch(/\d\s*-\s*\d/)
    }
    // Bindestrek i navn står urørt.
    expect(kilde('tramadolgruppen')).toContain('O-desmetyltramadol')
    expect(kilde('metadon')).toContain('LAR-behandling')
  })

  it('beholder intervallene fra kilden, med tankestrek', () => {
    expect(kilde('klonazepam')).toContain('referanseområdet 40–120 nmol/L')
    expect(kilde('buprenorfin')).toContain('referanseområdet 2–10 nmol/L')
    expect(kilde('kun-morfin', 'morfin')).toContain('4–6 timer')
    expect(kilde('metadon')).toContain('600–1200 nmol/L')
    expect(kilde('amfetamin')).toContain('100–800 nmol/L')
    expect(kilde('amfetamin')).toContain('(10–40 mg)')
  })

  it('har ryddig tekst uten notasjon fra kilden', () => {
    for (const tekst of alleKommentarer()) {
      expect(tekst, tekst).toBe(tekst.trim())
      expect(tekst, tekst).not.toMatch(/\s{2}/)
      expect(tekst, tekst).not.toMatch(/\s+[,.]/)
      // Uthevinger og plasseringsinstrukser er notasjon, ikke kommentartekst.
      expect(tekst, tekst).not.toMatch(/[*[\]]/)
      expect(tekst, tekst).toMatch(/[.!?]$/)
    }
  })
})

describe('moduler for ett stoff', () => {
  it('gir én kommentar på én kode, uten noe å velge', () => {
    const resultat = fortolk('alprazolam')

    expect(plassert(resultat)).toEqual(['Hovedkommentar → APR'])
    expect(tekster(resultat)).toEqual([kilde('alprazolam')])
  })

  it('heter bare THC, og er ikke det samme som THC-syre i urin', () => {
    expect(modul('thc').navn).toBe('THC')
    expect(tekster(fortolk('thc'))).toEqual(['THC er det viktigste psykoaktive stoffet i cannabis.'])
  })

  it('dekker de sentralstimulerende enkeltstoffene', () => {
    expect(plassert(fortolk('benzoylekgonin'))).toEqual(['Hovedkommentar → BEZ1'])
    expect(tekster(fortolk('benzoylekgonin'))[0]).toContain('omdannelsesprodukt av kokain')
    expect(plassert(fortolk('mdma'))).toEqual(['Hovedkommentar → ECS1'])
    expect(tekster(fortolk('mdma'))[0]).toContain('MDMA (ecstasy) er påvist i serum.')
  })

  it('ber ikke brukeren lese kommentaren når den ikke kan bli en annen', () => {
    expect(viserKommentartekst(modul('alprazolam'))).toBe(false)
    expect(viserKommentartekst(modul('diazepamgruppen'))).toBe(true)
  })
})

describe('diazepam, N-desmetyldiazepam og oksazepam', () => {
  const ID = 'diazepamgruppen'

  /** Fortolkningen med de tre konsentrasjonene fylt inn. */
  const medTall = (pavist: string[], diaz: string, dmi: string, oxa: string) =>
    fortolk(ID, { pavist, verdier: { DIAZ: diaz, DMI: dmi, OXA: oxa } })

  it('spør hva som er påvist før den fortolker noe', () => {
    expect(fortolk(ID).type).toBe('mangler')
  })

  it('legger kommentaren på diazepam når begge er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['DIAZ', 'DMI'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → DIAZ', 'Tilleggskommentar → DMI'])
    expect(tekster(resultat)).toEqual([
      kilde('diazepam'),
      kilde('desmetyldiazepam', 'tillegg'),
    ])
  })

  it('legger kommentaren på desmetyldiazepam når bare den er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['DMI'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → DMI'])
    expect(tekster(resultat)).toEqual([kilde('desmetyldiazepam')])
  })

  it('lar diazepam stå alene når bare den er påvist', () => {
    expect(plassert(fortolk(ID, { pavist: ['DIAZ'] }))).toEqual(['Hovedkommentar → DIAZ'])
  })

  it('bruker standardkommentaren når bare oksazepam er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['OXA'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → OXA'])
    expect(tekster(resultat)).toEqual([kilde('oksazepam')])
  })

  it('ber om tallene bare når alle tre er påvist', () => {
    const felter = (pavist: string[]) => modul(ID).verdifelter(pavist).map((f) => f.kode)

    expect(felter(['DIAZ', 'DMI'])).toEqual([])
    expect(felter(['OXA'])).toEqual([])
    expect(felter(['DMI', 'OXA'])).toEqual([])
    expect(felter(['DIAZ', 'DMI', 'OXA'])).toEqual(['DIAZ', 'DMI', 'OXA'])
  })

  it('venter på tallene før den velger regel', () => {
    expect(fortolk(ID, { pavist: ['DIAZ', 'DMI', 'OXA'] }).type).toBe('mangler')
    expect(
      fortolk(ID, { pavist: ['DIAZ', 'DMI', 'OXA'], verdier: { DIAZ: '100', DMI: '900' } }).type,
    ).toBe('mangler')
  })

  it('kommenterer alle tre under ett når oksazepam er høyst 10 % av summen', () => {
    // 99 av 1000 er 9,9 %.
    const resultat = medTall(['DIAZ', 'DMI', 'OXA'], '400', '600', '99')

    expect(plassert(resultat)).toEqual(['Hovedkommentar → DIAZ', 'Tilleggskommentar → DMI OXA'])
    expect(tekster(resultat)).toEqual([
      kilde('diazepamgruppen-samlet'),
      kilde('diazepamgruppen-samlet', 'tillegg'),
    ])
  })

  it('tar nøyaktig 10 % med i fellesskommentaren', () => {
    // Kilden sier «OXA ≤ 10 %» om fellesskommentaren og «OXA > 10 %» om
    // standardkommentarene, så grensen selv hører til fellesskommentaren.
    expect(plassert(medTall(['DIAZ', 'DMI', 'OXA'], '400', '600', '100'))).toEqual([
      'Hovedkommentar → DIAZ',
      'Tilleggskommentar → DMI OXA',
    ])
  })

  it('kommenterer oksazepam for seg når andelen er over 10 %', () => {
    const resultat = medTall(['DIAZ', 'DMI', 'OXA'], '400', '600', '101')

    expect(plassert(resultat)).toEqual([
      'Hovedkommentar → DIAZ',
      'Tilleggskommentar → DMI',
      'Hovedkommentar for oksazepam → OXA',
    ])
    expect(tekster(resultat)).toEqual([
      kilde('diazepam'),
      kilde('desmetyldiazepam', 'tillegg'),
      kilde('oksazepam'),
    ])
  })

  it('krever alle tre for fellesskommentaren, og sier fra når bare to er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['DMI', 'OXA'] })

    expect(plassert(resultat)).toEqual([
      'Hovedkommentar → DMI',
      'Hovedkommentar for oksazepam → OXA',
    ])
    expect(notiser(resultat)).toContain('alle er påvist')
    // Uten alle tre er det ingen 10 %-regel å regne på.
    expect(modul(ID).verdifelter(['DMI', 'OXA'])).toEqual([])
  })

  it('sier fra i stedet for å dele på null', () => {
    expect(medTall(['DIAZ', 'DMI', 'OXA'], '0', '0', '5').type).toBe('mangler')
  })

  it('forteller hvilken vei regelen falt', () => {
    expect(notiser(medTall(['DIAZ', 'DMI', 'OXA'], '400', '600', '99'))).toBe(
      'Oksazepam ≤ 10 % av diazepam + N-desmetyldiazepam\n⟶ Felles kommentar for alle tre.',
    )
    expect(notiser(medTall(['DIAZ', 'DMI', 'OXA'], '400', '600', '250'))).toBe(
      'Oksazepam > 10 % av diazepam + N-desmetyldiazepam\n⟶ Oksazepam kommenteres for seg selv.',
    )
  })
})

describe('tramadol og O-desmetyltramadol', () => {
  const ID = 'tramadolgruppen'

  it('legger kommentaren på tramadol når begge er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['TRAM', 'OTRAM'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → TRAM', 'Tilleggskommentar → OTRAM'])
    expect(tekster(resultat)).toEqual([
      kilde('tramadolgruppen'),
      kilde('tramadolgruppen', 'tillegg'),
    ])
  })

  it('legger kommentaren på O-desmetyltramadol når bare den er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['OTRAM'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → OTRAM'])
    expect(tekster(resultat)).toEqual([kilde('tramadolgruppen')])
  })

  it('lar tramadol stå alene når bare den er påvist', () => {
    expect(plassert(fortolk(ID, { pavist: ['TRAM'] }))).toEqual(['Hovedkommentar → TRAM'])
  })
})

describe('kodein og morfin', () => {
  const ID = 'kodeingruppen'

  /** Fortolkningen med begge påvist og de to konsentrasjonene fylt inn. */
  const medTall = (kodein: string, morfin: string) =>
    fortolk(ID, { pavist: ['KOD', 'MOR'], verdier: { KOD: kodein, MOR: morfin } })

  it('gir hvert stoff sin egen kommentar når bare det ene er påvist', () => {
    expect(plassert(fortolk(ID, { pavist: ['KOD'] }))).toEqual(['Hovedkommentar → KOD'])
    expect(tekster(fortolk(ID, { pavist: ['KOD'] }))).toEqual([kilde('kun-kodein', 'kodein')])
    expect(plassert(fortolk(ID, { pavist: ['MOR'] }))).toEqual(['Hovedkommentar → MOR'])
    expect(tekster(fortolk(ID, { pavist: ['MOR'] }))).toEqual([kilde('kun-morfin', 'morfin')])
  })

  it('ber om tallene bare når begge er påvist', () => {
    expect(modul(ID).verdifelter(['KOD'])).toEqual([])
    expect(modul(ID).verdifelter(['MOR'])).toEqual([])
    expect(modul(ID).verdifelter(['KOD', 'MOR']).map((f) => f.kode)).toEqual(['KOD', 'MOR'])
  })

  it('venter på tallene før den velger regel', () => {
    expect(fortolk(ID, { pavist: ['KOD', 'MOR'] }).type).toBe('mangler')
    expect(fortolk(ID, { pavist: ['KOD', 'MOR'], verdier: { KOD: '800' } }).type).toBe('mangler')
  })

  it('bruker kommentaren for høy kodein og lav morfin under 20 %', () => {
    const resultat = medTall('1000', '199')

    expect(plassert(resultat)).toEqual(['Hovedkommentar → KOD', 'Tilleggskommentar → MOR'])
    expect(tekster(resultat)).toEqual([
      kilde('hoy-kodein-lav-morfin', 'kodein'),
      kilde('hoy-kodein-lav-morfin', 'morfin'),
    ])
    // Tilleggskommentaren henviser bare videre — ingen «høy kodein, lav
    // morfin»-etikett foran, siden det allerede er sagt i banneret over.
    expect(tekster(resultat)[1]).toBe('Se kommentar for kodein i serum.')
    expect(notiser(resultat)).toBe('Morfin < 20 % av kodein ⟶ Forenlig med inntak av kodein alene.')
  })

  it('sender gråsonen mellom 20 % og 100 % til plenum, uten noe å kopiere', () => {
    for (const morfin of ['200', '500', '1000']) {
      const resultat = medTall('1000', morfin)
      expect(resultat.type, morfin).toBe('plenum')
      expect(plenum(resultat), morfin).toContain('Vurder manuelt.')
    }
    // Kildens eget råd om utgangspunktet følger med, så den som skal ta saken
    // videre ikke må slå det opp selv.
    expect(plenum(medTall('1000', '500'))).toContain('kan ikke utelukke at morfin er inntatt')
  })

  it('bruker den ordinære kombinasjonen når morfin er høyere enn kodein', () => {
    const resultat = medTall('1000', '1001')

    expect(plassert(resultat)).toEqual([
      'Hovedkommentar for kodein → KOD',
      'Hovedkommentar for morfin → MOR',
    ])
    expect(tekster(resultat)).toEqual([
      kilde('kodein-morfin-ordinaer', 'kodein'),
      kilde('kodein-morfin-ordinaer', 'morfin'),
    ])
    // Kodeinkommentaren her er den utvidede, med heroin og Paralgin forte.
    expect(tekster(resultat)[0]).toContain('Paralgin forte')
    expect(notiser(resultat)).toBe('Morfin > kodein ⟶ Ikke forenlig med inntak av kodein alene.')
  })

  it('legger grensene der kilden legger dem', () => {
    // < 20 % → høy kodein; 20–100 % → gråsone; > 100 % → ordinær kombinasjon.
    expect(medTall('1000', '199').type).toBe('kommentarer')
    expect(medTall('1000', '200').type).toBe('plenum')
    expect(medTall('1000', '1000').type).toBe('plenum')
    expect(medTall('1000', '1001').type).toBe('kommentarer')
  })

  it('sier fra i stedet for å dele på null', () => {
    expect(medTall('0', '100').type).toBe('mangler')
  })
})

describe('amfetamin og metamfetamin', () => {
  const ID = 'amfetamingruppen'

  it('gir hvert stoff sin egen kommentar når bare det ene er påvist', () => {
    expect(plassert(fortolk(ID, { pavist: ['AMF1'] }))).toEqual(['Hovedkommentar → AMF1'])
    expect(tekster(fortolk(ID, { pavist: ['AMF1'] }))).toEqual([kilde('amfetamin')])
    expect(plassert(fortolk(ID, { pavist: ['MAF1'] }))).toEqual(['Hovedkommentar → MAF1'])
    expect(tekster(fortolk(ID, { pavist: ['MAF1'] }))).toEqual([kilde('metamfetamin')])
  })

  it('legger fellesskommentaren på metamfetamin når begge er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['AMF1', 'MAF1'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → MAF1', 'Tilleggskommentar → AMF1'])
    expect(tekster(resultat)).toEqual([
      kilde('amfetamingruppen-samlet'),
      kilde('amfetamingruppen-samlet', 'tillegg'),
    ])
  })

  it('trenger ingen konsentrasjoner', () => {
    expect(modul(ID).verdifelter(['AMF1', 'MAF1'])).toEqual([])
  })
})

describe('kommentarene dekker det som er påvist', () => {
  /** Alle kombinasjoner av påviste analytter en modul kan få. */
  function delmengder(koder: string[]): string[][] {
    const ut: string[][] = []
    for (let maske = 1; maske < 2 ** koder.length; maske++) {
      ut.push(koder.filter((_, i) => maske & (1 << i)))
    }
    return ut
  }

  /** Tall som gir en fortolkning med kommentarer i alle modulene. */
  const verdier = { DIAZ: '400', DMI: '600', OXA: '50', KOD: '100', MOR: '500' }

  it('gir hver påvist analytt nøyaktig én kommentar, i alle modulene', () => {
    for (const m of RUS_MODULER) {
      for (const pavist of delmengder(moduleKoder(m))) {
        const resultat = m.fortolk({ pavist, verdier })
        if (resultat.type !== 'kommentarer') {
          throw new Error(`${m.id} med ${pavist.join('+')} ga ${resultat.type}`)
        }

        const dekket = resultat.plasseringer.flatMap((p: RusPlassering) => p.koder)
        expect([...dekket].sort(), `${m.id} med ${pavist.join('+')}`).toEqual([...pavist].sort())
      }
    }
  })

  it('gir hver fortolkning minst én hovedkommentar og entydige merker', () => {
    for (const m of RUS_MODULER) {
      for (const pavist of delmengder(moduleKoder(m))) {
        const resultat = m.fortolk({ pavist, verdier })
        if (resultat.type !== 'kommentarer') continue

        const hoved = resultat.plasseringer.filter((p: RusPlassering) => p.rolle === 'hoved')
        expect(hoved.length, `${m.id} med ${pavist.join('+')}`).toBeGreaterThan(0)
        // Merkene skiller kommentarene fra hverandre i UI-et og må være unike.
        const merker = resultat.plasseringer.map((p: RusPlassering) => p.merke)
        expect(new Set(merker).size).toBe(merker.length)
      }
    }
  })
})

describe('oppføringene i søket', () => {
  const pool = [...analytes, THC_ANALYTT, ...RUS_ANALYTTER]

  /** Modulen det første treffet på søket fører til. */
  function forste(query: string): string | undefined {
    const treff = search(query, pool)[0]
    return treff && rusModulFor(treff.analyte)?.id
  }

  /** Modulene søket i det hele tatt gir. */
  function modulerFor(query: string): string[] {
    return search(query, pool)
      .map((h) => rusModulFor(h.analyte)?.id)
      .filter((id): id is string => id !== undefined)
  }

  it('fører alle tre stoffene i diazepamgruppen til fellesmodulen', () => {
    for (const ord of ['diazepam', 'n-desmetyldiazepam', 'desmetyldiazepam', 'oksazepam']) {
      expect(modulerFor(ord), ord).toContain('diazepamgruppen')
    }
    for (const kode of ['DIAZ', 'DMI', 'OXA']) {
      expect(modulerFor(kode), kode).toContain('diazepamgruppen')
    }
  })

  it('fører begge stoffene i hver fellesmodul til den samme modulen', () => {
    for (const ord of ['tramadol', 'o-desmetyltramadol', 'TRAM', 'OTRAM']) {
      expect(modulerFor(ord), ord).toContain('tramadolgruppen')
    }
    for (const ord of ['kodein', 'morfin', 'KOD', 'MOR']) {
      expect(modulerFor(ord), ord).toContain('kodeingruppen')
    }
    for (const ord of ['amfetamin', 'metamfetamin', 'AMF1', 'MAF1']) {
      expect(modulerFor(ord), ord).toContain('amfetamingruppen')
    }
  })

  it('finner de sentralstimulerende stoffene på navn og hverdagsnavn', () => {
    expect(modulerFor('benzoylekgonin')).toContain('benzoylekgonin')
    expect(modulerFor('kokain')).toContain('benzoylekgonin')
    expect(modulerFor('mdma')).toContain('mdma')
    expect(modulerFor('ecstasy')).toContain('mdma')
  })

  it('finner hver modul på sin egen kode', () => {
    for (const m of RUS_MODULER) {
      for (const kode of moduleKoder(m)) {
        expect(modulerFor(kode), kode).toContain(m.id)
      }
    }
  })

  it('viser alle kodene modulen dekker i alternativet', () => {
    const oppforing = RUS_ANALYTTER.find((a) => rusModulFor(a)?.id === 'diazepamgruppen')
    expect(oppforing?.kode).toBe('DIAZ · DMI · OXA')
    expect(oppforing?.komponenter).toEqual(['Diazepam', 'N-desmetyldiazepam', 'Oksazepam'])
  })

  it('holder THC og THC-syre i urin fra hverandre', () => {
    expect(forste('THC')).toBe('thc')
    expect(search('THC', pool).map((h) => h.analyte.kode)).toContain('IRCAK')
    expect(rusModulFor(THC_ANALYTT)).toBeUndefined()
  })

  it('blander seg ikke inn i psykofarmakasøket', () => {
    for (const a of analytes) {
      expect(erRusAnalytt(a), a.kode).toBe(false)
      expect(search(a.kode, pool)[0]?.analyte.kode, a.kode).toBe(a.kode)
    }
  })
})

describe('lesKonsentrasjon', () => {
  it('godtar både komma og punktum', () => {
    expect(lesKonsentrasjon('12,5')).toBe(12.5)
    expect(lesKonsentrasjon('12.5')).toBe(12.5)
    expect(lesKonsentrasjon(' 40 ')).toBe(40)
    expect(lesKonsentrasjon('0')).toBe(0)
  })

  it('avviser alt som ikke er et tall som ikke er negativt', () => {
    expect(lesKonsentrasjon('')).toBeNull()
    expect(lesKonsentrasjon('< 10')).toBeNull()
    expect(lesKonsentrasjon('-5')).toBeNull()
    expect(lesKonsentrasjon('12 5')).toBeNull()
  })
})
