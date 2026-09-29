import { describe, expect, it } from 'vitest'
import { menyanalytter } from '../analysemetoder'
import { ANALYTTKATALOG, FORTOLKNINGSOPPFORINGER } from '../analyttkatalog'
import { search } from '../search'

/**
 * Laboratorieanalyttene fortolkningen kjenner. De er ikke fagsider: hvilke
 * stoffer de gjelder, står i koblingene i stoffregisteret
 * (`koblinger.test.ts`).
 */
const katalog = ANALYTTKATALOG

describe('laboratorieanalyttene', () => {
  it('har én analytt per kode appen kan fortolke, og ingen andre', () => {
    const koder = FORTOLKNINGSOPPFORINGER.flatMap((a) => menyanalytter(a).map((o) => o.kode))
    expect(katalog.oppforinger.map((o) => o.kode).sort()).toEqual([...koder].sort())
    expect(new Set(koder).size).toBe(koder.length)
  })

  it('gir hver kode gyldig for databasen', () => {
    // Samme regel som laboratorieanalytter_kode i migrasjonen.
    for (const { kode } of katalog.oppforinger) expect(kode).toMatch(/^[A-Z0-9]+([._-][A-Z0-9]+)*$/)
  })

  it('gir en sumanalyse alle stoffene den måler', () => {
    const amt = katalog.finn('amtnorsum')!
    expect(amt.navn).toBe('Amitriptylin + nortriptylin')
    expect(amt.komponenter).toEqual(['Amitriptylin', 'Nortriptylin'])
    expect(katalog.finn('HBUP')!.komponenter).toEqual(['Hydroksybupropion'])
  })

  it('deler modulene opp i én analytt per kode, som fortolker i modulen', () => {
    for (const kode of ['DIAZ', 'DMI', 'OXA']) {
      const o = katalog.finn(kode)!
      expect(o.komponenter).toEqual([o.navn])
      expect(o.fortolkning.kode).toBe('DIAZ · DMI · OXA')
    }
    expect(katalog.finn('UETS')!.fortolkning).toBe(katalog.finn('UETGS')!.fortolkning)
  })

  it('har ingen sideidentitet: ingen sidenavn, sidetittel eller kanonisk side', () => {
    for (const o of katalog.oppforinger) {
      expect(Object.keys(o).sort()).toEqual(['analysemetode', 'fortolkning', 'kategori', 'kode', 'komponenter', 'navn'])
    }
  })

  it('peker fortolkningen på den samme oppføringen som søket gir', () => {
    for (const o of katalog.oppforinger) {
      const treff = search(o.kode, FORTOLKNINGSOPPFORINGER).map((h) => h.analyte)
      expect(treff, o.kode).toContain(o.fortolkning)
    }
  })

  it('finner ingenting for en ukjent kode', () => {
    expect(katalog.finn('FINNESIKKE')).toBeUndefined()
  })
})
