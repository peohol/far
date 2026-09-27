import { describe, expect, it } from 'vitest'
import { menyanalytter } from '../analysemetoder'
import { FORTOLKNINGSOPPFORINGER, byggKatalog } from '../analyttkatalog'
import { search } from '../search'

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)

describe('katalogen over informasjonssidene', () => {
  it('har én side per kode appen kan fortolke, og ingen andre', () => {
    const koder = FORTOLKNINGSOPPFORINGER.flatMap((a) => menyanalytter(a).map((o) => o.kode))
    expect(katalog.oppforinger.map((o) => o.kode).sort()).toEqual([...koder].sort())
    expect(new Set(koder).size).toBe(koder.length)
  })

  it('gir hver kode gyldig for databasen', () => {
    // Samme regel som laboratorieanalytter_kode i migrasjonen.
    for (const { kode } of katalog.oppforinger) expect(kode).toMatch(/^[A-Z0-9]+([._-][A-Z0-9]+)*$/)
  })

  it('knytter en sumanalyse til moderstoffets side, med alle komponentene', () => {
    const amt = katalog.finn('amtnorsum')!
    expect(amt.sidenavn).toBe('Amitriptylin')
    expect(amt.komponenter).toEqual(['Amitriptylin', 'Nortriptylin'])
    expect(katalog.kodeForSide('nortriptylin')).toBe('NOR')
  })

  it('deler modulene opp i én side per kode, som fortolker i modulen', () => {
    for (const kode of ['DIAZ', 'DMI', 'OXA']) {
      const o = katalog.finn(kode)!
      expect(o.komponenter).toEqual([o.sidenavn])
      expect(o.fortolkning.kode).toBe('DIAZ · DMI · OXA')
    }
    expect(katalog.finn('UETS')!.fortolkning).toBe(katalog.finn('UETGS')!.fortolkning)
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
