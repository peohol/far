import { describe, expect, it } from 'vitest'
import { analytes } from '../analytes'
import {
  erEtgAnalytt,
  ETG_ALTERNATIVER,
  ETG_ANALYTT,
  ETG_KODE,
  ETS_KODE,
  type EtgAlternativ,
  type EtgValg,
} from '../etg'
import { RUS_ANALYTTER } from '../rus'
import { search } from '../search'
import { THC_ANALYTT } from '../thc'

/** Alternativet med denne id-en. */
function alternativ(id: EtgValg): EtgAlternativ {
  const funnet = ETG_ALTERNATIVER.find((a) => a.id === id)
  if (!funnet) throw new Error(`ukjent alternativ i testen: ${id}`)
  return funnet
}

/** Kommentarene et alternativ gir, som «merke → koder», i rekkefølge. */
function plassert(id: EtgValg): string[] {
  return alternativ(id).plasseringer.map((p) => `${p.merke} → ${p.koder.join(' ')}`)
}

function tekster(id: EtgValg): string[] {
  return alternativ(id).plasseringer.map((p) => p.tekst)
}

/**
 * Ordlyden slik den er bestilt. Står i testen tegn for tegn, så en endring i
 * kommentarteksten må gjøres bevisst begge steder.
 */
const BEGGE =
  'Omdannelsesprodukter av etanol, etylglukuronid (EtG) og etylsulfat (EtS), er påvist i urin. Dette viser at etanol (alkohol) er inntatt.'
const SE_ETS = 'Se kommentar for EtS i urin.'
const EN_AV_DEM =
  'Omdannelsesprodukt av etanol, etylglukuronid (EtG) eller etylsulfat (EtS), er påvist i urin. Dette kan være forenlig med inntak av etanol (alkohol). I enkelte tilfeller kan dette ses etter inntak av alkoholfri vin/øl eller andre mat-/drikkevarer.'

describe('begge påvist', () => {
  it('legger fortolkningen på EtS og henvisningen på EtG', () => {
    expect(plassert('begge')).toEqual([
      `Hovedkommentar → ${ETS_KODE}`,
      `Tilleggskommentar → ${ETG_KODE}`,
    ])
  })

  it('slår fast at etanol er inntatt', () => {
    expect(tekster('begge')).toEqual([BEGGE, SE_ETS])
  })
})

describe('bare den ene påvist', () => {
  it('legger kommentaren på EtG når det er EtG som er påvist', () => {
    expect(plassert('etg')).toEqual([`Hovedkommentar → ${ETG_KODE}`])
    expect(tekster('etg')).toEqual([EN_AV_DEM])
  })

  it('legger kommentaren på EtS når det er EtS som er påvist', () => {
    expect(plassert('ets')).toEqual([`Hovedkommentar → ${ETS_KODE}`])
    expect(tekster('ets')).toEqual([EN_AV_DEM])
  })

  it('gir ingen tilleggskommentar til den som ikke er påvist', () => {
    for (const id of ['etg', 'ets'] as const) {
      expect(alternativ(id).plasseringer, id).toHaveLength(1)
    }
  })

  it('bruker den samme teksten begge veier — det er koden som skiller dem', () => {
    expect(tekster('etg')).toEqual(tekster('ets'))
    expect(plassert('etg')).not.toEqual(plassert('ets'))
  })

  it('sier «kan være forenlig», ikke at inntak er vist', () => {
    // Skillet mot fellestilfellet er hele poenget med de to alternativene.
    expect(EN_AV_DEM).toContain('kan være forenlig med inntak av etanol')
    expect(BEGGE).toContain('viser at etanol (alkohol) er inntatt')
  })
})

describe('alternativene', () => {
  it('er de tre tilfellene, i den rekkefølgen tastene 1, 2 og 3 velger dem', () => {
    expect(ETG_ALTERNATIVER.map((a) => a.id)).toEqual(['begge', 'etg', 'ets'])
    expect(ETG_ALTERNATIVER.map((a) => a.merke)).toEqual([
      'Begge påvist',
      'EtG påvist',
      'EtS påvist',
    ])
  })

  it('gir hver påvist analytt nøyaktig én kommentar, og ingen til de andre', () => {
    for (const a of ETG_ALTERNATIVER) {
      const dekket = a.plasseringer.flatMap((p) => p.koder)
      expect([...dekket].sort(), a.id).toEqual([...a.pavist].sort())
      expect(new Set(dekket).size, a.id).toBe(dekket.length)
    }
  })

  it('gir hvert alternativ én hovedkommentar og entydige merker', () => {
    for (const a of ETG_ALTERNATIVER) {
      expect(a.plasseringer.filter((p) => p.rolle === 'hoved'), a.id).toHaveLength(1)
      const merker = a.plasseringer.map((p) => p.merke)
      expect(new Set(merker).size, a.id).toBe(merker.length)
    }
  })

  it('har ryddig kommentartekst', () => {
    for (const a of ETG_ALTERNATIVER) {
      for (const p of a.plasseringer) {
        expect(p.tekst, a.id).toBe(p.tekst.trim())
        expect(p.tekst, a.id).not.toMatch(/ {2}/)
        expect(p.tekst, a.id).not.toMatch(/[*[\]]/)
        expect(p.tekst, a.id).toMatch(/[.!?]$/)
      }
    }
  })
})

describe('oppføringen i søket', () => {
  const pool = [...analytes, THC_ANALYTT, ...RUS_ANALYTTER, ETG_ANALYTT]

  /** Kodene søket gir, i rekkefølge. */
  function koder(query: string): string[] {
    return search(query, pool).map((h) => h.analyte.kode)
  }

  it('dekker begge analyttkodene i én oppføring', () => {
    expect(ETG_ANALYTT.kode).toBe(`${ETG_KODE} · ${ETS_KODE}`)
    expect(erEtgAnalytt(ETG_ANALYTT)).toBe(true)
  })

  it('fører både navnene og kodene til den samme modulen', () => {
    for (const ord of ['etg', 'ets', 'UETGS', 'UETS', 'etylglukuronid', 'etylsulfat']) {
      expect(koder(ord), ord).toContain(ETG_ANALYTT.kode)
    }
  })

  it('finnes også på det stoffet markørene sier noe om', () => {
    for (const ord of ['etanol', 'alkohol']) {
      expect(koder(ord), ord).toContain(ETG_ANALYTT.kode)
    }
  })

  it('er ikke det samme som THC eller stoffene i serum', () => {
    expect(erEtgAnalytt(THC_ANALYTT)).toBe(false)
    for (const oppforing of RUS_ANALYTTER) {
      expect(erEtgAnalytt(oppforing), oppforing.kode).toBe(false)
    }
  })
})
