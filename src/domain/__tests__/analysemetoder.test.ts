import { describe, expect, it } from 'vitest'
import {
  ANALYSEMETODER,
  byggMeny,
  filtrertPool,
  menyanalytter,
  metodebeskrivelse,
} from '../analysemetoder'
import { analytes } from '../analytes'
import { ETG_ANALYTT, ETG_KODE, ETS_KODE } from '../etg'
import { RUS_ANALYTTER } from '../rus'
import { search } from '../search'
import { THC_ANALYTT, THC_KODE } from '../thc'
import type { Analyte } from '../../types'

/**
 * Sidemenyen og filteret leser analysemetode og kategori av datasettene, ikke
 * av lister i koden. Testene her holder den koblingen: at hver analytt hører
 * til en metode appen kjenner, at inndelingen er den klinikeren har bedt om,
 * og at ingen analytt blir borte på veien fra datasettet til menyen.
 */

/** De samme oppføringene appen søker i. */
const pool: Analyte[] = [...analytes, THC_ANALYTT, ...RUS_ANALYTTER, ETG_ANALYTT]

const meny = byggMeny(pool)

function metode(kode: string) {
  const funnet = meny.find((m) => m.kode === kode)
  if (!funnet) throw new Error(`fant ikke ${kode} i menyen`)
  return funnet
}

/** Kategorinavnene i en metode, i den rekkefølgen menyen viser dem. */
function kategorier(kode: string): string[] {
  return metode(kode).kategorier.map((k) => k.navn)
}

/** Virkestoffnavnene i en kategori, i rekkefølge. */
function navnI(metodekode: string, kategori: string): string[] {
  const funnet = metode(metodekode).kategorier.find((k) => k.navn === kategori)
  if (!funnet) throw new Error(`fant ikke kategorien ${kategori} i ${metodekode}`)
  return funnet.analytter.map((a) => a.navn)
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

  it('svarer med beskrivelsen av metoden, og med koden selv når den er ukjent', () => {
    expect(metodebeskrivelse('SPFA')).toBe('Antidepressiver og antipsykotika i serum')
    expect(metodebeskrivelse('UCAK')).toBe('THC-syre i urin')
    expect(metodebeskrivelse('XYZ')).toBe('XYZ')
  })
})

describe('menyen', () => {
  it('viser metodene i den avtalte rekkefølgen', () => {
    expect(meny.map((m) => m.kode)).toEqual(['SPFA', 'SRUS', 'UCAK', 'UETGHB', 'AHT'])
  })

  it('mister ingen analyttkode på veien fra datasettene', () => {
    const iMenyen = meny.flatMap((m) => m.analytter.map((a) => a.kode))
    const forventet = pool.flatMap((a) => menyanalytter(a).map((o) => o.kode))
    expect(iMenyen.slice().sort()).toEqual(forventet.slice().sort())
    // Ingen kode skal stå to steder — da ville et virkestoff hatt to veier inn.
    expect(new Set(iMenyen).size).toBe(iMenyen.length)
  })

  it('har de samme virkestoffene med og uten kategorier', () => {
    for (const m of meny) {
      if (m.kategorier.length === 0) continue
      const iKategoriene = m.kategorier.flatMap((k) => k.analytter.map((a) => a.kode))
      expect(iKategoriene.slice().sort()).toEqual(m.analytter.map((a) => a.kode).sort())
    }
  })

  it('lister virkestoffene alfabetisk, både samlet og i hver kategori', () => {
    for (const m of meny) {
      const navn = m.analytter.map((a) => a.navn)
      expect(navn).toEqual(navn.slice().sort((a, b) => a.localeCompare(b, 'nb')))
      for (const k of m.kategorier) {
        const iKategorien = k.analytter.map((a) => a.navn)
        expect(iKategorien).toEqual(
          iKategorien.slice().sort((a, b) => a.localeCompare(b, 'nb')),
        )
      }
    }
  })

  it('lister kategoriene alfabetisk', () => {
    for (const m of meny) {
      expect(m.kategorier.map((k) => k.navn)).toEqual(
        m.kategorier.map((k) => k.navn).sort((a, b) => a.localeCompare(b, 'nb')),
      )
    }
  })

  it('fører hvert virkestoff til den modulen søket ville gitt', () => {
    for (const m of meny) {
      for (const oppforing of m.analytter) {
        expect(pool).toContain(oppforing.analyte)
      }
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
    const summen = metode('SPFA').analytter.find((a) => a.kode === 'AMTNORSUM')
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
    expect(metode('UCAK').analytter.map((a) => a.kode)).toEqual([THC_KODE])
  })
})

describe('UETGHB', () => {
  it('lister EtG og EtS hver for seg, uten kategorier', () => {
    expect(kategorier('UETGHB')).toEqual([])
    expect(metode('UETGHB').analytter.map((a) => a.navn)).toEqual(['EtG', 'EtS'])
    expect(metode('UETGHB').analytter.map((a) => a.kode)).toEqual([ETG_KODE, ETS_KODE])
  })

  it('fører begge til den samme modulen', () => {
    for (const oppforing of metode('UETGHB').analytter) {
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
    EPLR: 'Aldosteronagonister',
    KANR: 'Aldosteronagonister',
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
      'Aldosteronagonister',
      'Alfa- og betablokkere',
      'Alfablokkere',
      'ARB',
      'Betablokkere',
      'Diuretika',
      'Kalsiumantagonister',
    ])
  })

  it('plasserer hvert virkestoff der klinikeren plasserte det', () => {
    const funnet = Object.fromEntries(
      metode('AHT').kategorier.flatMap((k) => k.analytter.map((a) => [a.kode, k.navn])),
    )
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
