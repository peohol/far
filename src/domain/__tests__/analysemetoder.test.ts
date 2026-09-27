import { describe, expect, it } from 'vitest'
import {
  ANALYSEMETODER,
  AV_SNARVEI,
  filtrertPool,
  menyanalytter,
  metodefarger,
  metodesnarvei,
} from '../analysemetoder'
import { analytes } from '../analytes'
import { ETG_ANALYTT, ETG_KODE, ETS_KODE } from '../etg'
import { RUS_ANALYTTER } from '../rus'
import { search } from '../search'
import { THC_ANALYTT, THC_KODE } from '../thc'
import type { Analyte } from '../../types'

/**
 * Filteret og metalinjen leser analysemetode og kategori av datasettene, ikke
 * av lister i koden. Testene her holder den koblingen: at hver analytt hører
 * til en metode appen kjenner, at inndelingen er den klinikeren har bedt om,
 * og at hver kode kommer med når en oppføring deles i virkestoffene sine.
 * Stoffregisteret i sidemenyen testes i `stoffregister.test.ts`.
 */

/** De samme oppføringene appen søker i. */
const pool: Analyte[] = [...analytes, THC_ANALYTT, ...RUS_ANALYTTER, ETG_ANALYTT]

/** Virkestoffene med kode i en metode, slik katalogen deler oppføringene. */
function oppforinger(metode: string) {
  return pool.filter((a) => a.analysemetode === metode).flatMap(menyanalytter)
}

/** Kategoriene i en metode i datasettet, alfabetisk. */
function kategorier(metode: string): string[] {
  return [...new Set(oppforinger(metode).map((o) => o.analyte.kategori))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'nb'))
}

/** Virkestoffnavnene i en kategori. */
function navnI(metode: string, kategori: string): string[] {
  return oppforinger(metode)
    .filter((o) => o.analyte.kategori === kategori)
    .map((o) => o.navn)
}

describe('analysemetoden på analyttene', () => {
  it('er satt på hver eneste oppføring, og er en metode appen kjenner', () => {
    const kjente = new Set(ANALYSEMETODER.map((m) => m.kode))
    for (const analyte of pool) {
      expect(analyte.analysemetode, `${analyte.kode} mangler analysemetode`).toBeTruthy()
      expect(kjente, `${analyte.kode} har ukjent analysemetode`).toContain(analyte.analysemetode)
    }
  })

  it('deler en metode enten helt opp i kategorier eller ikke i det hele tatt', () => {
    for (const m of ANALYSEMETODER) {
      const i = pool.filter((a) => a.analysemetode === m.kode)
      if (i.length === 0) continue
      const medKategori = i.filter((a) => a.kategori !== '')
      expect(
        medKategori.length === 0 || medKategori.length === i.length,
        `${m.kode} har både analytter med og uten kategori`,
      ).toBe(true)
    }
  })
})

describe('fargen en metode bærer', () => {
  it('er den samme hver gang den slås opp', () => {
    for (const m of ANALYSEMETODER) {
      expect(metodefarger(m.kode)).toEqual(metodefarger(m.kode))
    }
  })

  it('er forskjellig for hver metode', () => {
    const hues = ANALYSEMETODER.map((m) => metodefarger(m.kode)['--alt-hue'])
    expect(new Set(hues).size).toBe(ANALYSEMETODER.length)
  })

  it('følger metodens plass i lista og ikke hvor den vises', () => {
    // Menyen, pillen i analyttkortet, pillen i søket og menyknappen slår alle
    // opp på koden, så SPFA er den samme fargen overalt.
    expect(metodefarger('SPFA')['--alt-hue']).toBe('0')
    expect(metodefarger('UCAK')['--alt-hue']).toBe(String((2 * 360) / ANALYSEMETODER.length))
  })
})

describe('oppføringene delt i virkestoffer', () => {
  it('gir hver kode én gang', () => {
    const koder = pool.flatMap((a) => menyanalytter(a).map((o) => o.kode))
    // Ingen kode skal stå to steder — da ville et virkestoff hatt to veier inn.
    expect(new Set(koder).size).toBe(koder.length)
  })

  it('fører hvert virkestoff til den modulen søket ville gitt', () => {
    for (const analyte of pool) {
      for (const oppforing of menyanalytter(analyte)) expect(oppforing.analyte).toBe(analyte)
    }
  })
})

describe('SPFA', () => {
  it('er delt i gruppene referansetabellen bruker', () => {
    expect(kategorier('SPFA')).toEqual([
      'Antidepressiver',
      'Antipsykotika',
      'Stemningsstabiliserende',
    ])
  })

  it('lar sumanalyser stå som én oppføring', () => {
    const summen = oppforinger('SPFA').find((a) => a.kode === 'AMTNORSUM')
    expect(summen?.navn).toBe('Amitriptylin + nortriptylin')
  })
})

describe('SRUS', () => {
  it('er delt i gruppene kilden bruker, med cannabis som cannabinoider', () => {
    expect(kategorier('SRUS')).toEqual([
      'Benzodiazepiner og Z-hypnotika',
      'Cannabinoider',
      'Opioider',
      'Sentralstimulerende',
    ])
  })

  it('lister virkestoffene hver for seg, også der flere deler modul', () => {
    // Diazepam, N-desmetyldiazepam og oksazepam fortolkes samlet, men er tre
    // virkestoffer med hver sin kode og skal kunne finnes hver for seg.
    const benzo = navnI('SRUS', 'Benzodiazepiner og Z-hypnotika')
    expect(benzo).toContain('Diazepam')
    expect(benzo).toContain('N-desmetyldiazepam')
    expect(benzo).toContain('Oksazepam')

    const opioider = navnI('SRUS', 'Opioider')
    expect(opioider).toContain('Kodein')
    expect(opioider).toContain('Morfin')
  })
})

describe('UCAK', () => {
  it('lister IRCAK som den eneste komponenten, uten kategorier', () => {
    expect(kategorier('UCAK')).toEqual([])
    expect(oppforinger('UCAK').map((a) => a.kode)).toEqual([THC_KODE])
  })
})

describe('UETGHB', () => {
  it('lister EtG og EtS hver for seg, uten kategorier', () => {
    expect(kategorier('UETGHB')).toEqual([])
    expect(oppforinger('UETGHB').map((a) => a.navn)).toEqual(['EtG', 'EtS'])
    expect(oppforinger('UETGHB').map((a) => a.kode)).toEqual([ETG_KODE, ETS_KODE])
  })

  it('fører begge til den samme modulen', () => {
    for (const oppforing of oppforinger('UETGHB')) {
      expect(oppforing.analyte).toBe(ETG_ANALYTT)
    }
  })
})

describe('AHT', () => {
  /**
   * Inndelingen klinikeren gjorde én gang, ved å lese suffiksene i
   * virkestoffnavnene. Den står som en fasit her og ikke som en regel: et nytt
   * virkestoff skal plasseres av en kliniker, ikke av navnet sitt.
   */
  const FASIT: Record<string, string> = {
    ENAT: 'ACE-hemmere',
    LISI: 'ACE-hemmere',
    RAMAT: 'ACE-hemmere',
    EPLR: 'Aldosteronantagonister',
    KANR: 'Aldosteronantagonister',
    KARV: 'Alfa- og betablokkere',
    LABE: 'Alfa- og betablokkere',
    DOKSA: 'Alfablokkere',
    IRBE: 'ARB',
    KAND: 'ARB',
    LOSYR: 'ARB',
    TELM: 'ARB',
    VALS: 'ARB',
    ATEN: 'Betablokkere',
    BISO: 'Betablokkere',
    METOP: 'Betablokkere',
    BEND: 'Diuretika',
    BUME: 'Diuretika',
    FURO: 'Diuretika',
    HYDR: 'Diuretika',
    AMLO: 'Kalsiumantagonister',
    DIL: 'Kalsiumantagonister',
    LERK: 'Kalsiumantagonister',
    NIFE: 'Kalsiumantagonister',
    VER: 'Kalsiumantagonister',
  }

  it('er delt i de åtte legemiddelgruppene', () => {
    expect(kategorier('AHT')).toEqual([
      'ACE-hemmere',
      'Aldosteronantagonister',
      'Alfa- og betablokkere',
      'Alfablokkere',
      'ARB',
      'Betablokkere',
      'Diuretika',
      'Kalsiumantagonister',
    ])
  })

  it('plasserer hvert virkestoff der klinikeren plasserte det', () => {
    const funnet = Object.fromEntries(oppforinger('AHT').map((a) => [a.kode, a.analyte.kategori]))
    expect(funnet).toEqual(FASIT)
  })
})

describe('filteret', () => {
  it('slipper alt gjennom når ingen metode er valgt', () => {
    expect(filtrertPool(pool, null)).toBe(pool)
  })

  it('slipper bare den valgte metoden gjennom', () => {
    for (const m of ANALYSEMETODER) {
      const smalt = filtrertPool(pool, m.kode)
      expect(smalt.length).toBeGreaterThan(0)
      expect(smalt.every((a) => a.analysemetode === m.kode)).toBe(true)
    }
  })

  it('holder søket innenfor den valgte metoden', () => {
    // Kvetiapin er en SPFA-analytt, så den skal ikke finnes når filteret står
    // på antihypertensiver — men fortsatt finnes uten filter.
    expect(search('kvetiapin', filtrertPool(pool, null))).toHaveLength(1)
    expect(search('kvetiapin', filtrertPool(pool, 'AHT'))).toHaveLength(0)
    expect(search('kvetiapin', filtrertPool(pool, 'SPFA'))).toHaveLength(1)
  })

  it('finner fortsatt modulene som ikke har konsentrasjonsbånd', () => {
    expect(search('thc-syre', filtrertPool(pool, 'UCAK'))).toHaveLength(1)
    expect(search('etg', filtrertPool(pool, 'UETGHB'))).toHaveLength(1)
    expect(search('metadon', filtrertPool(pool, 'SRUS'))).toHaveLength(1)
  })
})

describe('hurtigtasten som setter filteret', () => {
  it('følger metodens plass i lista, fra Alt + 1', () => {
    expect(metodesnarvei('SPFA')).toBe('Alt + 1')
    expect(metodesnarvei('SRUS')).toBe('Alt + 2')
    expect(metodesnarvei('UCAK')).toBe('Alt + 3')
    expect(metodesnarvei('UETGHB')).toBe('Alt + 4')
    expect(metodesnarvei('AHT')).toBe('Alt + 5')
  })

  it('gir hver metode sin egen tast, og ingen til en ukjent kode', () => {
    const taster = ANALYSEMETODER.map((m) => metodesnarvei(m.kode))
    expect(taster.every((t) => t !== null)).toBe(true)
    expect(new Set(taster).size).toBe(ANALYSEMETODER.length)
    expect(metodesnarvei('XYZ')).toBe(null)
  })

  it('rekker over alle metodene appen har', () => {
    // Talltastene stopper på 9. Blir det flere metoder enn det, må menyen få
    // en annen vei inn enn Alt + tall.
    expect(ANALYSEMETODER.length).toBeLessThanOrEqual(9)
  })

  it('holder tasten som slår filteret av utenfor metodenes', () => {
    // Null hører ikke til noen metode, og kan derfor stå for «ingen av dem».
    expect(AV_SNARVEI).toBe('Alt + 0')
    expect(ANALYSEMETODER.map((m) => metodesnarvei(m.kode))).not.toContain(AV_SNARVEI)
  })
})
