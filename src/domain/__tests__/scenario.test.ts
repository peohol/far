import { describe, expect, it } from 'vitest'
import { validerKommentar } from '../kommentarobjekt'
import { RUS_KOMMENTARER, RUS_REGELSETT } from '../rusregelsett'
import {
  flettInn,
  fraProsent,
  kjorScenarier,
  kombinasjoner,
  provepunkter,
  somProsent,
  validerScenarioregelsett,
  type Scenarioregelsett,
} from '../scenario'

function regelsett(modul: string): Scenarioregelsett {
  const funnet = RUS_REGELSETT.find((r) => r.modul === modul)
  if (!funnet) throw new Error(`ukjent regelsett i testen: ${modul}`)
  return structuredClone(funnet)
}

/** Regelsettet med én endring, for å prøve valideringen. */
function endret(modul: string, endre: (r: Scenarioregelsett) => void): string[] {
  const r = regelsett(modul)
  endre(r)
  return validerScenarioregelsett(r, RUS_KOMMENTARER)
}

function scenario(r: Scenarioregelsett, nokkel: string) {
  const s = r.scenarier.find((x) => x.nokkel === nokkel)
  if (!s) throw new Error(`ukjent scenario i testen: ${nokkel}`)
  return s
}

describe('prosent og grenser', () => {
  it('skriver andeler som prosent med desimalkomma, uten flyttallsstøy', () => {
    expect(somProsent(0.1)).toBe('10')
    expect(somProsent(0.2)).toBe('20')
    expect(somProsent(1)).toBe('100')
    expect(somProsent(0.125)).toBe('12,5')
    expect(somProsent(0.07)).toBe('7')
  })

  it('leser prosent tilbake til nøyaktig samme andel som et desimaltall', () => {
    expect(fraProsent('10')).toBe(0.1)
    expect(fraProsent('20')).toBe(0.2)
    expect(fraProsent('12,5')).toBe(0.125)
    expect(fraProsent('15')).toBe(0.15)
    expect(fraProsent('abc')).toBeNull()
  })

  it('fletter grensene inn i tekstene, og lar ukjente stå', () => {
    const parametere = [{ nokkel: 'a', navn: 'A', verdi: 0.2 }, { nokkel: 'b', navn: 'B', verdi: 1 }]
    expect(flettInn('Morfin = {a}–{b} % av kodein.', parametere)).toBe('Morfin = 20–100 % av kodein.')
    expect(flettInn('{ukjent}', parametere)).toBe('{ukjent}')
  })

  it('prøver 0, hver grense, mellom grensene og over den høyeste', () => {
    expect(provepunkter([1, 0.2, 0.2])).toEqual([0, 0.1, 0.2, 0.6, 1, 2])
    expect(provepunkter([])).toEqual([0, 1])
  })

  it('gir alle ikke-tomme kombinasjoner av påviste analytter', () => {
    expect(kombinasjoner(['A', 'B', 'C'])).toHaveLength(7)
    expect(kombinasjoner(['A'])).toEqual([['A']])
  })
})

describe('en grense som skiller to scenarier, er ett tall', () => {
  it('flytter skillet for begge scenariene når grensen endres', () => {
    const r = regelsett('diazepamgruppen')
    const grense = r.parametere.find((p) => p.nokkel === 'oksazepamgrense')!
    grense.verdi = 0.15
    expect(validerScenarioregelsett(r, RUS_KOMMENTARER)).toEqual([])

    const kjor = (oxa: string) =>
      kjorScenarier(r, RUS_KOMMENTARER, { pavist: ['DIAZ', 'DMI', 'OXA'], verdier: { DIAZ: '400', DMI: '600', OXA: oxa } })
    expect(kjor('150').scenario?.nokkel).toBe('alle_felles')
    expect(kjor('151').scenario?.nokkel).toBe('alle_hver_for_seg')
    // Teksten som viser grensen, følger med.
    const felles = kjor('100').resultat
    expect(felles.type === 'kommentarer' && felles.notiser[0]).toContain('≤ 15 %')
    expect(flettInn(r.verdihjelp, r.parametere)).toContain('høyst 15 %')
  })

  it('holder gråsonen for kodein og morfin eksplisitt, uten noe å kopiere', () => {
    const r = regelsett('kodeingruppen')
    const kjor = (morfin: string) =>
      kjorScenarier(r, RUS_KOMMENTARER, { pavist: ['KOD', 'MOR'], verdier: { KOD: '1000', MOR: morfin } })
    expect(kjor('200').resultat).toMatchObject({ type: 'plenum', melding: 'Morfin = 20–100 % av kodein. Vurder manuelt.' })
    expect(kjor('200').scenario?.nokkel).toBe('grasone')
    expect(kjor('199').scenario?.nokkel).toBe('hoy_kodein_lav_morfin')
    expect(kjor('1000').scenario?.nokkel).toBe('grasone')
    expect(kjor('1001').scenario?.nokkel).toBe('ordinaer_kombinasjon')
    // Forholdstallet simulatoren viser.
    expect(kjor('500').forhold.get('morfinandel')).toBe(0.5)
  })
})

describe('valideringen', () => {
  it('godtar de importerte regelsettene', () => {
    for (const r of RUS_REGELSETT) expect(validerScenarioregelsett(r, RUS_KOMMENTARER), r.modul).toEqual([])
  })

  it('finner hull når en kombinasjon av påviste analytter mangler scenario', () => {
    expect(endret('tramadolgruppen', (r) => r.scenarier.splice(2, 1))).toEqual([
      'Ingen scenarier gjelder når TRAM + OTRAM er påvist.',
    ])
    expect(
      endret('amfetamingruppen', (r) => {
        r.scenarier[2]!.pavist = ['AMF1']
        r.scenarier[2]!.nokkel = 'amf_igjen'
      }),
    ).toContain('Scenariet amf_igjen må gi hver påviste analytt nøyaktig én kommentar, og ingen andre.')
    expect(
      endret('kodeingruppen', (r) => {
        r.scenarier.splice(1, 1)
      }),
    ).toEqual(['Ingen scenarier gjelder når MOR er påvist.'])
  })

  it('finner hull på tallinjen, også rett på grensen', () => {
    expect(
      endret('kodeingruppen', (r) => {
        scenario(r, 'grasone').vilkar[0]!.operator = '>'
      }),
    ).toEqual(['Ingen scenarier gjelder når KOD + MOR er påvist og morfinandel = 20 %.'])
  })

  it('finner overlapp', () => {
    expect(
      endret('diazepamgruppen', (r) => {
        scenario(r, 'alle_hver_for_seg').vilkar[0]!.operator = '>='
      }),
    ).toEqual([
      'Scenariene alle_felles og alle_hver_for_seg overlapper når DIAZ + DMI + OXA er påvist og oksazepamandel = 10 %.',
    ])
    expect(
      endret('amfetamingruppen', (r) => {
        r.scenarier.push({ ...structuredClone(r.scenarier[2]!), nokkel: 'kopi' })
      }),
    ).toEqual(['Scenariene begge og kopi overlapper når AMF1 + MAF1 er påvist.'])
  })

  it('finner at grensene ikke står i stigende rekkefølge', () => {
    // Nedre grense for gråsonen over den øvre: gråsonen blir tom, og mellom
    // grensene treffer både «lav morfin» og «ordinær kombinasjon».
    const feil = endret('kodeingruppen', (r) => {
      r.parametere[0]!.verdi = 2
    })
    expect(feil.some((f) => f.includes('overlapper'))).toBe(true)
  })

  it('krever at kommentarene finnes, og at hver påvist analytt får nøyaktig én', () => {
    expect(
      endret('tramadolgruppen', (r) => {
        const u = scenario(r, 'begge').utfall
        if (u.type === 'kommentarer') u.plasseringer[0]!.kommentar = 'finnes-ikke'
      }),
    ).toEqual(['Scenariet begge viser til en kommentar som ikke finnes.'])
    // Samme kommentar kan brukes av flere scenarier og flere regelsett.
    expect(
      endret('tramadolgruppen', (r) => {
        const u = scenario(r, 'begge').utfall
        if (u.type === 'kommentarer') u.plasseringer[1]!.kommentar = 'oksykodon/hoved'
      }),
    ).toEqual([])
    expect(
      endret('tramadolgruppen', (r) => {
        const u = scenario(r, 'begge').utfall
        if (u.type === 'kommentarer') u.plasseringer.pop()
      }),
    ).toContain('Scenariet begge må gi hver påviste analytt nøyaktig én kommentar, og ingen andre.')
    expect(
      endret('tramadolgruppen', (r) => {
        const u = scenario(r, 'tram').utfall
        if (u.type === 'kommentarer') u.plasseringer[0]!.koder = ['TRAM', 'OTRAM']
      }),
    ).toEqual(['Scenariet tram må gi hver påviste analytt nøyaktig én kommentar, og ingen andre.'])
  })

  it('krever en hovedkommentar og entydige merker', () => {
    expect(
      endret('amfetamingruppen', (r) => {
        const u = scenario(r, 'begge').utfall
        if (u.type === 'kommentarer') u.plasseringer[0]!.rolle = 'tillegg'
      }),
    ).toContain('Scenariet begge må ha minst én hovedkommentar.')
    expect(
      endret('amfetamingruppen', (r) => {
        const u = scenario(r, 'begge').utfall
        if (u.type === 'kommentarer') u.plasseringer[1]!.merke = 'Hovedkommentar'
      }),
    ).toEqual(['Scenariet begge har to kommentarer med samme merke.'])
  })

  it('krever gyldige grenser, forhold og tekster', () => {
    expect(endret('kodeingruppen', (r) => (r.parametere[1]!.verdi = 0))).toContain(
      'Grensen hoy_morfin må være et tall større enn 0.',
    )
    expect(endret('kodeingruppen', (r) => (r.parametere[1]!.verdi = Number.NaN))).toContain(
      'Grensen hoy_morfin må være et tall større enn 0.',
    )
    expect(endret('kodeingruppen', (r) => (scenario(r, 'grasone').vilkar[0]!.parameter = 'ukjent'))).toContain(
      'Scenariet grasone viser til ukjent grense ukjent.',
    )
    expect(endret('kodeingruppen', (r) => (r.forhold[0]!.nevner = ['MOR']))).toContain(
      'Forholdet morfinandel har samme analytt i teller og nevner.',
    )
    expect(endret('kodeingruppen', (r) => (r.forhold[0]!.nevner = ['XYZ']))).toContain(
      'Forholdet morfinandel bruker XYZ, som ikke hører til modulen.',
    )
    expect(
      endret('kodeingruppen', (r) => {
        const u = scenario(r, 'grasone').utfall
        if (u.type === 'manuell') u.melding = ' '
      }),
    ).toContain('Meldingen i grasone mangler eller har mellomrom i endene.')
    expect(endret('kodeingruppen', (r) => (r.forhold[0]!.nullmelding = 'Grensen {finnes_ikke}.'))).toContain(
      'Meldingen når nevneren i morfinandel er 0 viser til ukjent grense {finnes_ikke}.',
    )
  })

  it('krever at forholdstall bare regnes av påviste analytter', () => {
    expect(
      endret('kodeingruppen', (r) => {
        scenario(r, 'kod').vilkar.push({ forhold: 'morfinandel', operator: '<', parameter: 'lav_morfin' })
      }),
    ).toContain('Scenariet kod regner morfinandel av en analytt som ikke er påvist.')
  })

  it('krever gyldige koder og nøkler', () => {
    expect(endret('amfetamingruppen', (r) => (r.analytter = ['AMF1', 'AMF1']))).toContain('En analyttkode står to ganger.')
    expect(endret('amfetamingruppen', (r) => (r.modul = 'Amfetamin'))).toContain('Ugyldig modulnøkkel «Amfetamin».')
    expect(endret('amfetamingruppen', (r) => (r.scenarier[1]!.nokkel = 'amf'))).toContain('To scenarier har samme nøkkel.')
  })
})

describe('kommentarene er egne objekter', () => {
  it('gir rustekstene som gyldige kommentarer uten plassholdere', () => {
    // Hele valideringen av kommentarer prøves mot databasen i `kommentarer.test.ts`.
    for (const [id, tekst] of RUS_KOMMENTARER) {
      expect(validerKommentar({ navn: id, tekst, plassholdere: [] }), id).toEqual([])
    }
    expect(validerKommentar({ navn: 'x', tekst: 'Nivå {nivå}.', plassholdere: [] })).toEqual([
      'Kommentarteksten har plassholdere som ikke er oppgitt: {nivå}.',
    ])
  })

  it('godtar ikke at et scenario viser til en kommentar med plassholdere', () => {
    const med = new Map(RUS_KOMMENTARER).set('tramadolgruppen/hoved', 'Nivå {nivå}.')
    expect(validerScenarioregelsett(regelsett('tramadolgruppen'), med)).toEqual([
      'Scenariet tram viser til en kommentar med plassholdere.',
      'Scenariet otram viser til en kommentar med plassholdere.',
      'Scenariet begge viser til en kommentar med plassholdere.',
    ])
  })

  it('slås opp når regelen kjøres, så en rettet tekst gjelder uten at regelen endres', () => {
    const r = regelsett('tramadolgruppen')
    const rettet = new Map(RUS_KOMMENTARER).set('tramadolgruppen/hoved', 'Rettet tekst.')
    const resultat = kjorScenarier(r, rettet, { pavist: ['TRAM'], verdier: {} }).resultat
    expect(resultat).toMatchObject({ type: 'kommentarer', plasseringer: [{ tekst: 'Rettet tekst.', koder: ['TRAM'] }] })
  })

  it('godtar ikke en regel som viser til en kommentar som ikke finnes', () => {
    const uten = new Map(RUS_KOMMENTARER)
    uten.delete('tramadolgruppen/tillegg')
    expect(validerScenarioregelsett(regelsett('tramadolgruppen'), uten)).toEqual([
      'Scenariet begge viser til en kommentar som ikke finnes.',
    ])
    expect(() => kjorScenarier(regelsett('tramadolgruppen'), uten, { pavist: ['TRAM', 'OTRAM'], verdier: {} })).toThrow()
  })
})
