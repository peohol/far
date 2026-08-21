import { describe, expect, it } from 'vitest'
import { analytes, findByCode } from '../domain/analytes'
import { ETG_ALTERNATIVER, ETG_ANALYTT } from '../domain/etg'
import { RUS_ANALYTTER, rusModulFor } from '../domain/rus'
import { search } from '../domain/search'
import { THC_ANALYTT } from '../domain/thc'
import { initialState, reducer, stageOf, type State } from '../state'
import type { Analyte } from '../types'

/**
 * Søkefeltet slik App mater tilstandsmaskinen: hver streng er én endring i
 * feltet — et tegn skrevet eller et tegn slettet — med alternativene søket
 * gir. Ekte søk mot ekte data, så maskinen og søket ikke kan komme i utakt.
 */
function skriv(state: State, ...endringer: string[]): State {
  return endringer.reduce(
    (så, value) =>
      reducer(så, { type: 'sett-sok', value, matches: search(value, analytes).map((h) => h.analyte) }),
    state,
  )
}

function analytt(kode: string): Analyte {
  const funnet = findByCode(kode)
  if (!funnet) throw new Error(`ukjent analyttkode i testen: ${kode}`)
  return funnet
}

const valgt = (state: State) => state.analyte?.kode ?? null

describe('søkesteget', () => {
  it('går videre av seg selv når søket smalner inn til én analytt', () => {
    // «k» gir fem alternativer, «kv» bare kvetiapin.
    const state = skriv(initialState, 'k', 'kv')

    expect(stageOf(state)).toBe('band')
    expect(valgt(state)).toBe('KVE')
    // Søket står igjen, så veien tilbake viser det brukeren skrev.
    expect(state.query).toBe('kv')
  })

  it('lar brukeren velge selv så lenge flere alternativer passer', () => {
    const state = skriv(initialState, 'k')

    expect(stageOf(state)).toBe('search')
    expect(state.analyte).toBeNull()
  })

  it('går ingen steder når ingen analytter passer søket', () => {
    expect(stageOf(skriv(initialState, 'q'))).toBe('search')
  })
})

describe('veien tilbake fra en analytt som valgte seg selv', () => {
  /** Ett alternativ, valgt av seg selv, og så «Bytt analytt» eller Esc. */
  const tilbake = () => reducer(skriv(initialState, 'k', 'kv'), { type: 'tilbake' })

  it('blir stående i søket med det som ble skrevet', () => {
    const state = tilbake()

    expect(stageOf(state)).toBe('search')
    expect(state.query).toBe('kv')
  })

  it('sender ikke brukeren rett inn i den samme analytten igjen', () => {
    // Å skrive videre på et søk som alt bare ga ett alternativ teller ikke.
    expect(stageOf(skriv(tilbake(), 'kve', 'kvet'))).toBe('search')
  })

  it('lar det ene alternativet velges for hånd', () => {
    // Det er dette både Enter, Space, sifrene og et klikk gjør.
    expect(stageOf(reducer(tilbake(), { type: 'velg-analytt', analyte: analytt('KVE') }))).toBe('band')
  })

  it('går videre igjen når søket har vært innom flere alternativer', () => {
    const state = skriv(tilbake(), 'k', 'kv')

    expect(stageOf(state)).toBe('band')
    expect(valgt(state)).toBe('KVE')
  })
})

describe('analytter med egen fortolkningsmodul', () => {
  /** Søket slik App kjører det: hele utvalget, ikke bare psykofarmaka. */
  const pool = [...analytes, THC_ANALYTT, ...RUS_ANALYTTER, ETG_ANALYTT]

  function velg(kode: string): State {
    const analyte = pool.find((a) => a.kode === kode)
    if (!analyte) throw new Error(`ukjent oppføring i testen: ${kode}`)
    return reducer(initialState, { type: 'velg-analytt', analyte })
  }

  it('går til rusmiddelmodulen i stedet for til konsentrasjonsbåndene', () => {
    expect(stageOf(velg('APR'))).toBe('rus')
    expect(stageOf(velg('DIAZ · DMI · OXA'))).toBe('rus')
  })

  it('går til EtG- og EtS-modulen i stedet for til konsentrasjonsbåndene', () => {
    expect(stageOf(velg(ETG_ANALYTT.kode))).toBe('etg')
  })

  it('lar hvert av de tre tilfellene i EtG- og EtS-modulen føre til limsteget', () => {
    for (const alternativ of ETG_ALTERNATIVER) {
      const valgt = reducer(velg(ETG_ANALYTT.kode), { type: 'velg-etg', valg: alternativ.id })

      expect(stageOf(valgt), alternativ.id).toBe('etg-paste')
      expect(valgt.etgValg, alternativ.id).toBe(alternativ.id)
    }
  })

  it('går ett steg av gangen tilbake fra limsteget i EtG- og EtS-modulen', () => {
    const valgt = reducer(velg(ETG_ANALYTT.kode), { type: 'velg-etg', valg: 'begge' })

    // Esc herfra beholder analytten og lar brukeren velge tilfellet på nytt.
    const tilbake = reducer(valgt, { type: 'tilbake' })
    expect(stageOf(tilbake)).toBe('etg')
    expect(tilbake.analyte?.kode).toBe(ETG_ANALYTT.kode)
    expect(tilbake.etgValg).toBeNull()

    expect(stageOf(reducer(tilbake, { type: 'tilbake' }))).toBe('search')
  })

  it('lar ikke et tilfelle bli stående når analytten byttes', () => {
    const valgt = reducer(velg(ETG_ANALYTT.kode), { type: 'velg-etg', valg: 'ets' })
    const ny = reducer(valgt, { type: 'velg-analytt', analyte: analytt('KVE') })

    expect(ny.etgValg).toBeNull()
    expect(stageOf(ny)).toBe('band')
  })

  it('holder veiene fra søket fra hverandre', () => {
    expect(stageOf(velg('IRCAK'))).toBe('thc')
    expect(stageOf(velg('KVE'))).toBe('band')
  })

  it('går tilbake til søket fra fortolkningsmodulene', () => {
    for (const kode of ['APR', 'IRCAK', ETG_ANALYTT.kode]) {
      const tilbake = reducer(velg(kode), { type: 'tilbake' })

      expect(stageOf(tilbake), kode).toBe('search')
      expect(tilbake.analyte, kode).toBeNull()
    }
  })

  it('lar hver oppføring finne modulen sin', () => {
    for (const oppforing of RUS_ANALYTTER) {
      expect(rusModulFor(oppforing), oppforing.kode).toBeDefined()
    }
  })
})

describe('veien tilbake når det bare fantes ett alternativ fra første tegn', () => {
  // Sertralin er den eneste analytten som begynner på «s», så søket har aldri
  // vist mer enn ett alternativ.
  const tilbake = () => reducer(skriv(initialState, 's'), { type: 'tilbake' })

  it('velger analytten av seg selv på første tegn', () => {
    expect(valgt(skriv(initialState, 's'))).toBe('SERT')
  })

  it('går videre igjen når feltet er slettet helt', () => {
    const tomt = skriv(tilbake(), '')
    expect(stageOf(tomt)).toBe('search')

    expect(valgt(skriv(tomt, 's'))).toBe('SERT')
  })

  it('går videre igjen når Esc nullstiller søket', () => {
    // Esc en gang til, fra søkesteget, tømmer feltet.
    const nullstilt = reducer(tilbake(), { type: 'tilbake' })
    expect(nullstilt).toEqual(initialState)

    expect(valgt(skriv(nullstilt, 's'))).toBe('SERT')
  })
})
