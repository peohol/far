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

/** Kildeteksten fra en rad i rusmidler.json. */
function kilde(id: string): { hoved: string; tillegg: string } {
  const rad = rusDatasett.rader.find((r) => r.id === id)
  if (!rad) throw new Error(`ukjent rad i testen: ${id}`)
  return { hoved: rad.hovedkommentar, tillegg: rad.tilleggskommentar }
}

/** Alle tekstene appen kan komme til å kopiere. */
function alleKommentarer(): string[] {
  return rusDatasett.rader.flatMap((r) => [r.hovedkommentar, r.tilleggskommentar]).filter(Boolean)
}

describe('datasettet', () => {
  it('har alle radene fra tabellene i PDF-en', () => {
    expect(rusDatasett.rader).toHaveLength(21)
    expect(rusDatasett.meta.antallRader).toBe(21)
  })

  it('gir hver rad en hovedkommentar og en gruppe', () => {
    for (const rad of rusDatasett.rader) {
      expect(rad.hovedkommentar, rad.id).not.toBe('')
      expect(rad.gruppe, rad.id).not.toBe('')
      expect(rad.koder.length, rad.id).toBeGreaterThan(0)
    }
  })

  it('dekker alle radene med moduler, uten å bruke noen to ganger', () => {
    // Hver rad hører til nøyaktig én modul, så ingen kommentar blir liggende
    // utilgjengelig og ingen dukker opp to steder.
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
    expect(kilde('o-desmetyltramadol').hoved).toContain('O-desmetyltramadol')
    expect(kilde('metadon').hoved).toContain('LAR-behandling')
  })

  it('beholder intervallene fra kilden, med tankestrek', () => {
    expect(kilde('klonazepam').hoved).toContain('referanseområdet 40–120 nmol/L')
    expect(kilde('buprenorfin').hoved).toContain('referanseområdet 2–10 nmol/L')
    expect(kilde('morfin').hoved).toContain('4–6 timer')
    expect(kilde('morfin').hoved).toContain('8–12 timer')
    expect(kilde('metadon').hoved).toContain('600–1200 nmol/L')
    expect(kilde('metadon').hoved).toContain('300–600 nmol/L')
  })

  it('har ryddig tekst uten doble mellomrom eller løse kanter', () => {
    for (const tekst of alleKommentarer()) {
      expect(tekst, tekst).toBe(tekst.trim())
      expect(tekst, tekst).not.toMatch(/\s{2}/)
      expect(tekst, tekst).not.toMatch(/\s+[,.]/)
    }
  })
})

describe('moduler for ett stoff', () => {
  it('gir én kommentar på én kode, uten noe å velge', () => {
    const resultat = fortolk('alprazolam')

    expect(plassert(resultat)).toEqual(['Hovedkommentar → APR'])
    expect(tekster(resultat)).toEqual([kilde('alprazolam').hoved])
  })

  it('skiller THC i serum fra THC-syre i urin', () => {
    expect(modul('thc').navn).toBe('THC i serum')
    expect(tekster(fortolk('thc'))).toEqual(['THC er det viktigste psykoaktive stoffet i cannabis.'])
  })

  it('ber ikke brukeren lese kommentaren når den ikke kan bli en annen', () => {
    expect(viserKommentartekst(modul('alprazolam'))).toBe(false)
    expect(viserKommentartekst(modul('diazepamgruppen'))).toBe(true)
  })
})

describe('diazepam, N-desmetyldiazepam og oksazepam', () => {
  const ID = 'diazepamgruppen'

  it('spør hva som er påvist før den fortolker noe', () => {
    const resultat = fortolk(ID)
    expect(resultat.type).toBe('mangler')
  })

  it('legger kommentaren på diazepam når begge er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['DIAZ', 'DMI'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → DIAZ', 'Tilleggskommentar → DMI'])
    expect(tekster(resultat)).toEqual([kilde('diazepam').hoved, kilde('diazepam').tillegg])
  })

  it('legger kommentaren på desmetyldiazepam når bare den er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['DMI'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → DMI'])
    expect(tekster(resultat)).toEqual([kilde('desmetyldiazepam').hoved])
  })

  it('lar diazepam stå alene når bare den er påvist', () => {
    expect(plassert(fortolk(ID, { pavist: ['DIAZ'] }))).toEqual(['Hovedkommentar → DIAZ'])
  })

  it('bruker standardkommentaren når bare oksazepam er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['OXA'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → OXA'])
    expect(tekster(resultat)).toEqual([kilde('oksazepam').hoved])
  })

  it('ber om tallene bare når oksazepam er påvist sammen med de andre', () => {
    const felter = (pavist: string[]) => modul(ID).verdifelter(pavist).map((f) => f.kode)

    expect(felter(['DIAZ', 'DMI'])).toEqual([])
    expect(felter(['OXA'])).toEqual([])
    expect(felter(['DIAZ', 'DMI', 'OXA'])).toEqual(['DIAZ', 'DMI', 'OXA'])
    expect(felter(['DMI', 'OXA'])).toEqual(['DMI', 'OXA'])
  })

  it('venter på tallene før den velger regel', () => {
    expect(fortolk(ID, { pavist: ['DIAZ', 'DMI', 'OXA'] }).type).toBe('mangler')
    expect(
      fortolk(ID, { pavist: ['DIAZ', 'DMI', 'OXA'], verdier: { DIAZ: '100', DMI: '900' } }).type,
    ).toBe('mangler')
  })

  it('kommenterer alle tre under ett når oksazepam er under 10 % av summen', () => {
    // 99 av 1000 er 9,9 %.
    const resultat = fortolk(ID, {
      pavist: ['DIAZ', 'DMI', 'OXA'],
      verdier: { DIAZ: '400', DMI: '600', OXA: '99' },
    })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → DIAZ', 'Tilleggskommentar → DMI OXA'])
    expect(tekster(resultat)).toEqual([
      kilde('diazepamgruppen-samlet').hoved,
      kilde('diazepamgruppen-samlet').tillegg,
    ])
  })

  it('kommenterer oksazepam for seg når andelen er 10 % eller mer', () => {
    // Kilden dekker ikke nøyaktig 10 %: den sier «< 10 %» om fellesskommentaren
    // og «> 10 %» om standardkommentarene. Grensetilfellet får
    // standardkommentarene, så fellesskommentaren bare brukes der kilden
    // uttrykkelig sier at den skal.
    const paa = (oksazepam: string) =>
      fortolk(ID, {
        pavist: ['DIAZ', 'DMI', 'OXA'],
        verdier: { DIAZ: '400', DMI: '600', OXA: oksazepam },
      })

    expect(plassert(paa('99'))).toHaveLength(2)
    expect(plassert(paa('100'))).toEqual([
      'Hovedkommentar → DIAZ',
      'Tilleggskommentar → DMI',
      'Hovedkommentar for oksazepam → OXA',
    ])
    expect(plassert(paa('101'))).toEqual(plassert(paa('100')))
    expect(tekster(paa('100'))).toEqual([
      kilde('diazepam').hoved,
      kilde('diazepam').tillegg,
      kilde('oksazepam').hoved,
    ])
  })

  it('regner andelen av det som faktisk er påvist', () => {
    // Uten diazepam er summen desmetyldiazepam alene: 5 av 100 er 5 %.
    const resultat = fortolk(ID, {
      pavist: ['DMI', 'OXA'],
      verdier: { DMI: '100', OXA: '5' },
    })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → DMI', 'Tilleggskommentar → OXA'])
    expect(tekster(resultat)[0]).toBe(kilde('diazepamgruppen-samlet').hoved)
  })

  it('sier fra i stedet for å dele på null', () => {
    const resultat = fortolk(ID, {
      pavist: ['DIAZ', 'DMI', 'OXA'],
      verdier: { DIAZ: '0', DMI: '0', OXA: '5' },
    })

    expect(resultat.type).toBe('mangler')
  })

  it('forteller hvilken vei regelen falt', () => {
    const notis = (oksazepam: string) => {
      const resultat = fortolk(ID, {
        pavist: ['DIAZ', 'DMI', 'OXA'],
        verdier: { DIAZ: '400', DMI: '600', OXA: oksazepam },
      })
      if (resultat.type !== 'kommentarer') throw new Error('ventet kommentarer')
      return resultat.notiser.join(' ')
    }

    expect(notis('99')).toContain('9,9 %')
    expect(notis('99')).toContain('under ett')
    expect(notis('250')).toContain('25,0 %')
    expect(notis('250')).toContain('for seg')
  })
})

describe('tramadol og O-desmetyltramadol', () => {
  const ID = 'tramadolgruppen'

  it('legger kommentaren på tramadol når begge er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['TRAM', 'OTRAM'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → TRAM', 'Tilleggskommentar → OTRAM'])
    expect(tekster(resultat)).toEqual([
      kilde('tramadol').hoved,
      kilde('o-desmetyltramadol').tillegg,
    ])
  })

  it('legger kommentaren på O-desmetyltramadol når bare den er påvist', () => {
    const resultat = fortolk(ID, { pavist: ['OTRAM'] })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → OTRAM'])
    expect(tekster(resultat)).toEqual([kilde('o-desmetyltramadol').hoved])
  })

  it('lar tramadol stå alene når bare den er påvist', () => {
    expect(plassert(fortolk(ID, { pavist: ['TRAM'] }))).toEqual(['Hovedkommentar → TRAM'])
  })
})

describe('kodein og morfin', () => {
  const ID = 'kodeingruppen'

  it('gir hvert stoff sin egen kommentar når bare det ene er påvist', () => {
    expect(tekster(fortolk(ID, { pavist: ['KOD'] }))).toEqual([kilde('kodein').hoved])
    expect(tekster(fortolk(ID, { pavist: ['MOR'] }))).toEqual([kilde('morfin').hoved])
  })

  it('viser kildens veiledning om kodein når kodein er påvist alene', () => {
    const resultat = fortolk(ID, { pavist: ['KOD'] })
    if (resultat.type !== 'kommentarer') throw new Error('ventet kommentarer')

    expect(resultat.notiser.join(' ')).toContain('heroin-inntak')
  })

  it('spør om høy kodein og lav morfin bare når begge er påvist', () => {
    expect(modul(ID).avkryssing(['KOD'])).toBeNull()
    expect(modul(ID).avkryssing(['MOR'])).toBeNull()
    expect(modul(ID).avkryssing(['KOD', 'MOR'])?.merke).toBe('Høy kodein, lav morfin')
    // Veiledningen er kildens egen tekst om hvordan kodein skal vurderes.
    expect(modul(ID).avkryssing(['KOD', 'MOR'])?.hjelp).toContain('MAM i tillegg')
  })

  it('bruker kombinasjonskommentaren og morfinkommentaren som standard', () => {
    const resultat = fortolk(ID, { pavist: ['KOD', 'MOR'] })

    expect(plassert(resultat)).toEqual([
      'Hovedkommentar for kodein → KOD',
      'Hovedkommentar for morfin → MOR',
    ])
    expect(tekster(resultat)).toEqual([kilde('kodein-med-morfin').hoved, kilde('morfin').hoved])
  })

  it('bytter til egen kommentar ved høy kodein og lav morfin', () => {
    const resultat = fortolk(ID, { pavist: ['KOD', 'MOR'], avkrysset: true })

    expect(plassert(resultat)).toEqual(['Hovedkommentar → KOD', 'Tilleggskommentar → MOR'])
    expect(tekster(resultat)).toEqual([
      kilde('hoy-kodein-lav-morfin').hoved,
      kilde('hoy-kodein-lav-morfin').tillegg,
    ])
  })

  it('lar avkryssingen være uten betydning når bare ett stoff er påvist', () => {
    expect(plassert(fortolk(ID, { pavist: ['KOD'], avkrysset: true }))).toEqual([
      'Hovedkommentar → KOD',
    ])
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

  it('gir hver påvist analytt nøyaktig én kommentar, i alle modulene', () => {
    for (const m of RUS_MODULER) {
      const koder = moduleKoder(m)
      for (const pavist of delmengder(koder)) {
        // Tallene 10 %-regelen eventuelt trenger. Verdiene her gir en andel
        // under 10 %; grensetilfellene er dekket for seg over.
        const verdier = Object.fromEntries(koder.map((k) => [k, k === 'OXA' ? '1' : '100']))
        const resultat = m.fortolk({ pavist, verdier, avkrysset: false })
        if (resultat.type !== 'kommentarer') {
          throw new Error(`${m.id} med ${pavist.join('+')} ga ${resultat.type}`)
        }

        const dekket = resultat.plasseringer.flatMap((p: RusPlassering) => p.koder)
        expect([...dekket].sort(), `${m.id} med ${pavist.join('+')}`).toEqual([...pavist].sort())
      }
    }
  })

  it('gir alltid nøyaktig én hovedkommentar per påvist stoff som ikke henviser videre', () => {
    for (const m of RUS_MODULER) {
      for (const pavist of delmengder(moduleKoder(m))) {
        const verdier = Object.fromEntries(moduleKoder(m).map((k) => [k, k === 'OXA' ? '1' : '100']))
        const resultat = m.fortolk({ pavist, verdier, avkrysset: false })
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

  it('fører både tramadol og O-desmetyltramadol til fellesmodulen', () => {
    for (const ord of ['tramadol', 'o-desmetyltramadol', 'TRAM', 'OTRAM']) {
      expect(modulerFor(ord), ord).toContain('tramadolgruppen')
    }
  })

  it('fører både kodein og morfin til fellesmodulen', () => {
    for (const ord of ['kodein', 'morfin', 'KOD', 'MOR']) {
      expect(modulerFor(ord), ord).toContain('kodeingruppen')
    }
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

  it('holder THC i serum og THC-syre i urin fra hverandre', () => {
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
