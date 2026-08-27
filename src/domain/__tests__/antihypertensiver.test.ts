import { describe, expect, it } from 'vitest'
import { analytes, antihypertensivdatasett, findByCode } from '../analytes'
import { bands } from '../bands'
import { classify, levelComment } from '../concentration'
import { LEVELS } from '../../types'
import type { Analyte } from '../../types'

const antihypertensiver = antihypertensivdatasett.analytter

function get(kode: string): Analyte {
  const a = findByCode(kode)
  if (!a) throw new Error(`Fant ikke ${kode}`)
  return a
}

function labels(kode: string): string[] {
  return bands(get(kode)).map((b) => b.label)
}

describe('datasettet for antihypertensiver', () => {
  it('har alle de 25 analyttene fra kilden', () => {
    expect(antihypertensiver).toHaveLength(25)
    expect(antihypertensivdatasett.meta.antallAnalytter).toBe(25)
    expect(antihypertensivdatasett.meta.kilde).toBe('AHT.docx')
  })

  it('er med i søket sammen med psykofarmaka, uten at koder går igjen', () => {
    for (const a of antihypertensiver) expect(findByCode(a.kode)).toBe(a)
    const koder = analytes.map((a) => a.kode)
    expect(new Set(koder).size).toBe(koder.length)
  })

  it('har ingen ringegrense — kategorien har ikke det begrepet', () => {
    for (const a of antihypertensiver) {
      expect(a.ringegrense, a.kode).toBeNull()
      expect(a.referanseomrade, a.kode).toBeNull()
      expect(a.gruppe, a.kode).toBe('Antihypertensiver')
      expect(a.enhet, a.kode).toBe('nmol/L')
    }
  })

  it('gir hver analytt en påvisningsgrense under det innenforbåndet begynner på', () => {
    for (const a of antihypertensiver) {
      const grenser = a.antihypertensiv
      expect(grenser, a.kode).toBeDefined()
      if (!grenser) continue
      expect(grenser.pavisningsgrense, a.kode).toBeGreaterThan(0)
      expect(grenser.pavisningsgrense, a.kode).toBeLessThanOrEqual(a.nedreGrense)
    }
  })

  it('gir alle unntatt bumetanid og furosemid et terapiområde', () => {
    const uten = antihypertensiver
      .filter((a) => a.antihypertensiv?.terapiomrade === null)
      .map((a) => a.kode)
    expect(uten).toEqual(['BUME', 'FURO'])
  })

  it('lar terapiområdet ligge innenfor båndet «innenfor»', () => {
    // Terapiområdet er kildens eget intervall og er smalere enn båndet, som
    // også dekker H — konsentrasjonene over terapiområdet, men under toksisk.
    for (const a of antihypertensiver) {
      const terapi = a.antihypertensiv?.terapiomrade
      if (!terapi || terapi.fra === null || terapi.til === null) continue
      expect(classify(a, terapi.fra), `${a.kode} nedre`).toBe('innenfor')
      expect(classify(a, terapi.til), `${a.kode} øvre`).toBe('innenfor')
    }
  })
})

describe('de tre knappene', () => {
  it('gir nøyaktig tre bånd, uten ringepåminnelse', () => {
    for (const a of antihypertensiver) {
      const b = bands(a)
      expect(b.map((x) => x.key), a.kode).toEqual(['under', 'innenfor', 'over'])
      for (const band of b) expect(band.ring, `${a.kode}/${band.key}`).toBe(false)
    }
  })

  it('slår «under måleområdet» sammen med L, og terapiområdet sammen med H', () => {
    // ENAT: under < 1, L 1–9, terapiområdet 10–300, H 301–1199, toksisk ≥ 1200.
    expect(labels('ENAT')).toEqual(['< 10', '10 – 1199', '≥ 1200'])
    // KAND: under < 1, L 1–14, terapiområdet 15–200, H 199–799, toksisk ≥ 800.
    expect(labels('KAND')).toEqual(['< 15', '15 – 799', '≥ 800'])
    // VER: under < 10, L 10–39, terapiområdet 40–400, H 40–1599, toksisk ≥ 1600.
    expect(labels('VER')).toEqual(['< 40', '40 – 1599', '≥ 1600'])
  })

  it('gir bumetanid og furosemid de samme tre båndene uten L og H', () => {
    // BUME: under < 10, innenfor 10–1600, toksisk ≥ 1600.
    expect(labels('BUME')).toEqual(['< 10', '10 – 1599', '≥ 1600'])
    // FURO: under < 50, innenfor 1–40000, toksisk ≥ 40000.
    expect(labels('FURO')).toEqual(['< 50', '50 – 39999', '≥ 40000'])
  })

  it('regner med desimaler der analytten har det', () => {
    // EPLR: under < 2, L 2–3,4, terapiområdet 3,5–350, H 351–1399, toksisk ≥ 1400.
    expect(labels('EPLR')).toEqual(['< 3,5', '3,5 – 1399,9', '≥ 1400'])
    // LERK: under < 0,1, L 0,1, terapiområdet 0,2–5, H 6–19, toksisk ≥ 20.
    expect(labels('LERK')).toEqual(['< 0,2', '0,2 – 19,9', '≥ 20'])
    expect(labels('BEND')).toEqual(['< 1,5', '1,5 – 119,9', '≥ 120'])
    expect(labels('KARV')).toEqual(['< 2,5', '2,5 – 199,9', '≥ 200'])
  })

  it('treffer riktig nivå på hver side av grensene', () => {
    const enat = get('ENAT')
    expect(classify(enat, 9)).toBe('under')
    expect(classify(enat, 9.9)).toBe('under')
    expect(classify(enat, 10)).toBe('innenfor')
    expect(classify(enat, 1199)).toBe('innenfor')
    expect(classify(enat, 1200)).toBe('over')

    const lerk = get('LERK')
    expect(classify(lerk, 0.1)).toBe('under')
    expect(classify(lerk, 0.2)).toBe('innenfor')
    // Hullet mellom terapiområdet (opp til 5) og H (fra 6) hører til innenfor.
    expect(classify(lerk, 5.5)).toBe('innenfor')
    expect(classify(lerk, 19.9)).toBe('innenfor')
    expect(classify(lerk, 20)).toBe('over')
  })

  it('lar toksisk vinne der kilden lar innenfor og toksisk overlappe', () => {
    // BUME og FURO oppgir samme tall som slutt på innenfor og start på toksisk.
    expect(classify(get('BUME'), 1600)).toBe('over')
    expect(classify(get('FURO'), 40000)).toBe('over')
  })

  it('lar innenfor begynne der terapiområdet gjør det, også der L strekker seg forbi', () => {
    // VALS: L er oppgitt som 50–301 mens terapiområdet begynner på 300.
    const vals = get('VALS')
    expect(classify(vals, 299)).toBe('under')
    expect(classify(vals, 300)).toBe('innenfor')
    expect(classify(vals, 301)).toBe('innenfor')
  })

  it('lar innenfor begynne på påvisningsgrensen der kilden sier lavere', () => {
    // FURO: innenfor er oppgitt som 1–40000, men påvisningsgrensen er 50.
    const furo = get('FURO')
    expect(classify(furo, 49)).toBe('under')
    expect(classify(furo, 50)).toBe('innenfor')
  })
})

describe('kommentarene', () => {
  const alle = antihypertensiver.flatMap((a) =>
    LEVELS.map((niva) => ({ hvor: `${a.kode}/${niva}`, tekst: levelComment(a, niva).kommentar })),
  )

  it('står på én linje, med enkle mellomrom', () => {
    for (const { hvor, tekst } of alle) {
      expect(tekst, hvor).not.toMatch(/[\n\r\t\u00a0]/)
      expect(tekst, hvor).not.toMatch(/ {2}/)
      expect(tekst.trim(), hvor).toBe(tekst)
    }
  })

  it('bruker komma som desimaltegn og tankestrek i intervaller', () => {
    for (const { hvor, tekst } of alle) {
      expect(tekst, hvor).not.toMatch(/\d\.\d/)
      expect(tekst, hvor).not.toMatch(/\d\s*-\s*\d/)
    }
  })

  it('er hele setninger med punktum til slutt', () => {
    for (const { hvor, tekst } of alle) {
      expect(tekst.length, hvor).toBeGreaterThan(20)
      expect(tekst, hvor).toMatch(/\.$/)
      expect(tekst, hvor).not.toMatch(/\s[,.;:?]/)
    }
  })

  it('skriver «basert på bruk av» overalt der dosen nevnes', () => {
    for (const { hvor, tekst } of alle) {
      if (!tekst.includes('basert på bruk')) continue
      expect(tekst, hvor).toContain('basert på bruk av')
    }
  })

  it('åpner den toksiske kommentaren med at konsentrasjonen er potensielt toksisk', () => {
    for (const a of antihypertensiver) {
      expect(levelComment(a, 'over').kommentar, a.kode).toMatch(
        /^Potensielt toksisk konsentrasjon\./,
      )
    }
  })

  it('viser hver kommentar på knappen den hører til', () => {
    for (const a of antihypertensiver) {
      for (const band of bands(a)) {
        expect(band.kommentar, `${a.kode}/${band.key}`).toBe(levelComment(a, band.niva).kommentar)
      }
    }
  })
})

describe('uoverensstemmelsene i kilden', () => {
  it('er skrevet ned i datasettet med koden de gjelder', () => {
    const avvik = antihypertensivdatasett.meta.avvik
    const koder = new Set(avvik.map((a) => a.kode))
    // De fem forholdene som faktisk kan påvirke fortolkningen eller teksten.
    expect(koder).toContain('VALS')
    expect(koder).toContain('BUME')
    expect(koder).toContain('FURO')
    expect(koder).toContain('KAND')
    expect(koder).toContain('VER')
    for (const a of avvik) {
      expect(findByCode(a.kode), a.kode).toBeDefined()
      expect(a.beskrivelse.length, a.kode).toBeGreaterThan(20)
    }
  })

  it('fører hver rettelse i teksten med kilde og begrunnelse', () => {
    for (const r of antihypertensivdatasett.meta.rettelser) {
      expect(r.kategori).not.toBe('')
      expect(r.hvor).toMatch(/^[A-ZÆØÅ]+\/(under|innenfor|over)$/)
      expect(r.begrunnelse.length).toBeGreaterThan(10)
    }
  })
})
