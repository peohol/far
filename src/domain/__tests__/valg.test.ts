import { describe, expect, it } from 'vitest'
import { analytes, findByCode } from '../analytes'
import { bands } from '../bands'
import { levelComment } from '../concentration'
import { indexToDigit } from '../../hooks/useKeyboard'
import {
  CUTOFF_KATEGORIER,
  CUTOFF_MERKE,
  CUTOFF_NOKKEL,
  cutoffKommentar,
  cutoffNavn,
  cutoffvalg,
  finnValg,
  harCutoffvalg,
  valgene,
} from '../valg'
import type { Analyte } from '../../types'

function analyte(kode: string): Analyte {
  const funn = findByCode(kode)
  if (!funn) throw new Error(`Fant ikke ${kode} i datasettet`)
  return funn
}

const INNLEDNING = (navn: string) =>
  `Prøven inneholder en lav konsentrasjon av ${navn} som ligger under påvisningsgrensen. `

describe('hvem som får «Til stede under cut-off»', () => {
  it('gjelder antidepressiver og antipsykotika', () => {
    expect(harCutoffvalg(analyte('CITAL'))).toBe(true)
    expect(harCutoffvalg(analyte('KVE'))).toBe(true)
  })

  it('gjelder ingen andre analytter', () => {
    // Lamotrigin er stemningsstabiliserende, lisinopril en antihypertensiv.
    expect(harCutoffvalg(analyte('LAM'))).toBe(false)
    expect(harCutoffvalg(analyte('LISI'))).toBe(false)
  })

  it('følger kategorien og ikke en liste over analytter', () => {
    for (const a of analytes) {
      expect(harCutoffvalg(a), a.kode).toBe(CUTOFF_KATEGORIER.includes(a.kategori))
    }
  })

  it('dekker begge kategoriene i datasettet', () => {
    // Slår ut hvis en kategori skifter navn i kilden og knappen stille faller
    // bort for alle analyttene i den.
    for (const kategori of CUTOFF_KATEGORIER) {
      expect(analytes.some((a) => a.kategori === kategori), kategori).toBe(true)
    }
  })
})

describe('stoffnavnet i kommentaren', () => {
  it('står med liten forbokstav midt i setningen', () => {
    expect(cutoffNavn(analyte('CITAL'))).toBe('citalopram')
    expect(cutoffNavn(analyte('KVE'))).toBe('kvetiapin')
  })

  it('binder to stoffer med «og/eller»', () => {
    expect(cutoffNavn(analyte('AMTNORSUM'))).toBe('amitriptylin og/eller nortriptylin')
  })

  it('skiller tre stoffer med komma før «og/eller»', () => {
    expect(cutoffNavn(analyte('KARSUM'))).toBe(
      'kariprazin, desmetylkariprazin og/eller didesmetylkariprazin',
    )
  })

  it('beholder store bokstaver som hører til navnet', () => {
    expect(cutoffNavn(analyte('VENSUM'))).toBe('venlafaksin og/eller O-desmetylvenlafaksin')
  })

  it('tar med parentesen i navn som har en', () => {
    expect(cutoffNavn(analyte('PALI'))).toBe('paliperidon (hydroksyrisperidon)')
  })

  it('navngir like mange stoffer som analytten består av', () => {
    for (const a of analytes.filter(harCutoffvalg)) {
      const stoffer = a.komponenter.length
      const skiller = stoffer === 1 ? 0 : 1
      expect(cutoffNavn(a).split(' og/eller ').length - 1, a.kode).toBe(skiller)
      expect(cutoffNavn(a).split(', ').length - 1, a.kode).toBe(Math.max(stoffer - 2, 0))
    }
  })
})

describe('kommentaren cut-off-valget kopierer', () => {
  it('er den grønne kommentaren med funnet satt foran', () => {
    const a = analyte('CITAL')
    expect(cutoffKommentar(a)).toBe(
      INNLEDNING('citalopram') + levelComment(a, 'innenfor').kommentar,
    )
  })

  it('bruker den samme teksten som knappen for referanseområdet', () => {
    for (const a of analytes.filter(harCutoffvalg)) {
      const gronn = bands(a).find((b) => b.niva === 'innenfor')
      expect(gronn, a.kode).toBeDefined()
      expect(cutoffKommentar(a), a.kode).toBe(INNLEDNING(cutoffNavn(a)) + gronn?.kommentar)
    }
  })

  it('skriver ingen kommentartekst av på nytt', () => {
    // Innledningen er det eneste nye; resten skal stå ord for ord som i kilden.
    for (const a of analytes.filter(harCutoffvalg)) {
      const kilde = levelComment(a, 'innenfor').kommentar
      expect(cutoffKommentar(a).endsWith(kilde), a.kode).toBe(true)
    }
  })
})

describe('valgene i steg 2', () => {
  it('legger cut-off-knappen sist, etter båndene', () => {
    for (const a of analytes.filter(harCutoffvalg)) {
      const alle = valgene(a)
      expect(alle.slice(0, -1).map((v) => v.key), a.kode).toEqual(bands(a).map((b) => b.key))
      expect(alle[alle.length - 1]?.key, a.kode).toBe(CUTOFF_NOKKEL)
    }
  })

  it('gir analytter uten knappen bare båndene', () => {
    for (const a of analytes.filter((x) => !harCutoffvalg(x))) {
      expect(valgene(a), a.kode).toEqual(bands(a))
      expect(cutoffvalg(a), a.kode).toBeNull()
    }
  })

  it('gir knappen hurtigtast 4 eller 5, etter hvor mange bånd analytten har', () => {
    // Tre bånd gir 4, fire bånd gir 5. DOKSUM og ZUKLO er de med fire.
    expect(indexToDigit(bands(analyte('CITAL')).length)).toBe('4')
    expect(indexToDigit(bands(analyte('DOKSUM')).length)).toBe('5')
    expect(indexToDigit(bands(analyte('ZUKLO')).length)).toBe('5')

    for (const a of analytes.filter(harCutoffvalg)) {
      expect(indexToDigit(valgene(a).length - 1), a.kode).toMatch(/^[45]$/)
    }
  })

  it('bærer den gule tonen og teksten på knappen', () => {
    const valg = cutoffvalg(analyte('KVE'))
    expect(valg?.tone).toBe('cutoff')
    expect(valg?.label).toBe(CUTOFF_MERKE)
    // Ingen ringegrense å minne om: funnet ligger under påvisningsgrensen.
    expect(valg?.ring).toBe(false)
  })

  it('finner igjen både bånd og cut-off-valg på nøkkelen sin', () => {
    const a = analyte('KVE')
    expect(finnValg(a, CUTOFF_NOKKEL)?.kommentar).toBe(cutoffKommentar(a))
    expect(finnValg(a, 'innenfor')?.kommentar).toBe(levelComment(a, 'innenfor').kommentar)
    expect(finnValg(a, 'finnes-ikke')).toBeUndefined()
    expect(finnValg(analyte('LISI'), CUTOFF_NOKKEL)).toBeUndefined()
  })

  it('gir hvert valg sin egen nøkkel', () => {
    for (const a of analytes) {
      const nokler = valgene(a).map((v) => v.key)
      expect(new Set(nokler).size, a.kode).toBe(nokler.length)
    }
  })
})
