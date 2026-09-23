/**
 * Valgene steg 2 gir, laget av regelsettene fra før byttet til Supabase —
 * også «Til stede under cut-off», som står i regelsettet som en innledning
 * satt foran kommentaren fra «innenfor».
 */
import { describe, expect, it } from 'vitest'
import { dagensKommentar, dagensRegelsett, DAGENS_REGELSETT } from '../../__tests__/hjelp/dagensregler'
import { analytes } from '../analytes'
import { indexToDigit } from '../../hooks/useKeyboard'
import { kommentaren, regelsettband } from '../intervallregler'
import { CUTOFF_MERKE, CUTOFF_NOKKEL, cutoffvalg, regelsettvalg } from '../valg'

/** Kategoriene som hadde valget da reglene var statiske. */
const CUTOFF_KATEGORIER = ['Antidepressiver', 'Antipsykotika']

const harCutoff = (kode: string) => dagensRegelsett(kode).cutoff !== null

/** Innledningen cut-off-kommentaren har i regelsettet. */
function innledning(kode: string): string {
  const regelsett = dagensRegelsett(kode)
  return kommentaren(regelsett, regelsett.cutoff!.innledning).tekst
}

const FORAN = 'Prøven inneholder en lav konsentrasjon av '
const ETTER = ' som ligger under påvisningsgrensen.'
const INNLEDNING = (navn: string) => FORAN + navn + ETTER

const medCutoff = analytes.filter((a) => harCutoff(a.kode))

describe('hvem som har «Til stede under cut-off»', () => {
  it('gjelder antidepressiver og antipsykotika', () => {
    expect(harCutoff('CITAL')).toBe(true)
    expect(harCutoff('KVE')).toBe(true)
  })

  it('gjelder ingen andre analytter', () => {
    // Lamotrigin er stemningsstabiliserende, lisinopril en antihypertensiv.
    expect(harCutoff('LAM')).toBe(false)
    expect(harCutoff('LISI')).toBe(false)
  })

  it('fulgte kategorien, for alle analyttene', () => {
    for (const a of analytes) expect(harCutoff(a.kode), a.kode).toBe(CUTOFF_KATEGORIER.includes(a.kategori))
  })

  it('dekker begge kategoriene i datasettet', () => {
    for (const kategori of CUTOFF_KATEGORIER) {
      expect(medCutoff.some((a) => a.kategori === kategori), kategori).toBe(true)
    }
  })
})

describe('stoffnavnet i innledningen', () => {
  it('står med liten forbokstav midt i setningen', () => {
    expect(innledning('CITAL')).toBe(INNLEDNING('citalopram'))
    expect(innledning('KVE')).toBe(INNLEDNING('kvetiapin'))
  })

  it('binder to stoffer med «og/eller»', () => {
    expect(innledning('AMTNORSUM')).toBe(INNLEDNING('amitriptylin og/eller nortriptylin'))
  })

  it('skiller tre stoffer med komma før «og/eller»', () => {
    expect(innledning('KARSUM')).toBe(INNLEDNING('kariprazin, desmetylkariprazin og/eller didesmetylkariprazin'))
  })

  it('beholder store bokstaver som hører til navnet', () => {
    expect(innledning('VENSUM')).toBe(INNLEDNING('venlafaksin og/eller O-desmetylvenlafaksin'))
  })

  it('tar med parentesen i navn som har en', () => {
    expect(innledning('PALI')).toBe(INNLEDNING('paliperidon (hydroksyrisperidon)'))
  })

  it('navngir like mange stoffer som analytten består av', () => {
    for (const a of medCutoff) {
      const navn = innledning(a.kode).slice(FORAN.length, -ETTER.length)
      const stoffer = a.komponenter.length
      expect(navn.split(' og/eller ').length - 1, a.kode).toBe(stoffer === 1 ? 0 : 1)
      expect(navn.split(', ').length - 1, a.kode).toBe(Math.max(stoffer - 2, 0))
    }
  })
})

describe('kommentaren cut-off-valget kopierer', () => {
  it('er den grønne kommentaren med funnet satt foran', () => {
    expect(cutoffvalg(dagensRegelsett('CITAL'))?.kommentar).toBe(
      `${INNLEDNING('citalopram')} ${dagensKommentar('CITAL', 'innenfor')}`,
    )
  })

  it('bruker den samme teksten som knappen for referanseområdet', () => {
    for (const a of medCutoff) {
      const regelsett = dagensRegelsett(a.kode)
      const gronn = regelsettband(regelsett).find((b) => b.niva === 'innenfor')
      expect(gronn, a.kode).toBeDefined()
      expect(cutoffvalg(regelsett)?.kommentar, a.kode).toBe(`${innledning(a.kode)} ${gronn?.kommentar}`)
    }
  })

  it('skriver ingen kommentartekst av på nytt', () => {
    // Innledningen er det eneste nye; resten er kommentaren fra «innenfor».
    for (const a of medCutoff) {
      const regelsett = dagensRegelsett(a.kode)
      expect(regelsett.cutoff?.kommentar, a.kode).toBe(regelsett.intervaller.find((i) => i.niva === 'innenfor')?.kommentar)
      expect(cutoffvalg(regelsett)?.kommentar.endsWith(dagensKommentar(a.kode, 'innenfor')), a.kode).toBe(true)
    }
  })
})

describe('valgene i steg 2', () => {
  it('legger cut-off-knappen sist, etter båndene', () => {
    for (const a of medCutoff) {
      const regelsett = dagensRegelsett(a.kode)
      const alle = regelsettvalg(regelsett)
      expect(alle.slice(0, -1).map((v) => v.key), a.kode).toEqual(regelsettband(regelsett).map((b) => b.key))
      expect(alle.at(-1)?.key, a.kode).toBe(CUTOFF_NOKKEL)
    }
  })

  it('gir regelsett uten cut-off bare båndene', () => {
    for (const regelsett of DAGENS_REGELSETT.filter((r) => r.cutoff === null)) {
      expect(regelsettvalg(regelsett), regelsett.analyttkode).toEqual(regelsettband(regelsett))
      expect(cutoffvalg(regelsett), regelsett.analyttkode).toBeNull()
    }
  })

  it('gir knappen hurtigtast 4 eller 5, etter hvor mange bånd analytten har', () => {
    // Tre bånd gir 4, fire bånd gir 5. DOKSUM og ZUKLO er de med fire.
    expect(indexToDigit(regelsettband(dagensRegelsett('CITAL')).length)).toBe('4')
    expect(indexToDigit(regelsettband(dagensRegelsett('DOKSUM')).length)).toBe('5')
    expect(indexToDigit(regelsettband(dagensRegelsett('ZUKLO')).length)).toBe('5')

    for (const a of medCutoff) {
      expect(indexToDigit(regelsettvalg(dagensRegelsett(a.kode)).length - 1), a.kode).toMatch(/^[45]$/)
    }
  })

  it('bærer den gule tonen og teksten på knappen', () => {
    const valg = cutoffvalg(dagensRegelsett('KVE'))
    expect(valg?.tone).toBe('cutoff')
    expect(valg?.label).toBe(CUTOFF_MERKE)
    // Ingen ringegrense å minne om: funnet ligger under påvisningsgrensen.
    expect(valg?.ring).toBe(false)
  })

  it('finner igjen både bånd og cut-off-valg på nøkkelen sin', () => {
    const finn = (kode: string, key: string) => regelsettvalg(dagensRegelsett(kode)).find((v) => v.key === key)
    expect(finn('KVE', CUTOFF_NOKKEL)?.kommentar).toBe(cutoffvalg(dagensRegelsett('KVE'))?.kommentar)
    expect(finn('KVE', 'innenfor')?.kommentar).toBe(dagensKommentar('KVE', 'innenfor'))
    expect(finn('KVE', 'finnes-ikke')).toBeUndefined()
    expect(finn('LISI', CUTOFF_NOKKEL)).toBeUndefined()
  })

  it('gir hvert valg sin egen nøkkel', () => {
    for (const regelsett of DAGENS_REGELSETT) {
      const nokler = regelsettvalg(regelsett).map((v) => v.key)
      expect(new Set(nokler).size, regelsett.analyttkode).toBe(nokler.length)
    }
  })
})
