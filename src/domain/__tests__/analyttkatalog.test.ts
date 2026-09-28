import { describe, expect, it } from 'vitest'
import { menyanalytter } from '../analysemetoder'
import { FORTOLKNINGSOPPFORINGER, SAMMENSLATTE, SIDETITLER, byggKatalog, sideFor } from '../analyttkatalog'
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
      expect(o.komponenter).toEqual([o.navn])
      expect(o.fortolkning.kode).toBe('DIAZ · DMI · OXA')
    }
    expect(katalog.finn('UETS')!.fortolkning).toBe(katalog.finn('UETGS')!.fortolkning)
  })

  it('gir stoffer som deler fagsside én kanonisk kode og én kanonisk adresse', () => {
    expect(SAMMENSLATTE).toMatchObject({
      'N-desmetyldiazepam': 'Diazepam',
      'O-desmetyltramadol': 'Tramadol',
      'THC-syre': 'THC',
      Dehydroaripiprazol: 'Aripiprazol',
      Desmetylkariprazin: 'Kariprazin',
      Didesmetylkariprazin: 'Kariprazin',
      Norfluoksetin: 'Fluoksetin',
      EtS: 'EtG',
    })
    expect(SIDETITLER).toEqual({ THC: 'THC og THC-syre', EtG: 'Etanol' })
    expect(katalog.finn('DMI')!.sidenavn).toBe('Diazepam')
    expect(katalog.finn('OTRAM')!.sidenavn).toBe('Tramadol')
    expect(katalog.finn('IRCAK')!.sidenavn).toBe('THC')
    expect(katalog.finn('IRCAK')!.sidetittel).toBe('THC og THC-syre')
    expect(katalog.finn('UETS')!.sidenavn).toBe('EtG')
    expect(katalog.finn('UETS')!.sidetittel).toBe('Etanol')
    // Hovedkoden står først, og alle aliasene peker til den.
    expect(katalog.paSiden('diazepam').map((o) => o.kode)).toEqual(['DIAZ', 'DMI'])
    expect(katalog.paSiden('Tramadol').map((o) => o.kode)).toEqual(['TRAM', 'OTRAM'])
    expect(katalog.paSiden('THC og THC-syre').map((o) => o.kode)).toEqual(['THC', 'IRCAK'])
    expect(katalog.paSiden('Etanol').map((o) => o.kode)).toEqual(['UETGS', 'UETS'])
    expect(katalog.kodeForSide('Diazepam')).toBe('DIAZ')
    expect(katalog.kodeForSide('N-desmetyldiazepam')).toBe('DIAZ')
    expect(katalog.kodeForSide('o-desmetyltramadol')).toBe('TRAM')
    expect(katalog.kodeForSide('THC-syre')).toBe('THC')
    expect(katalog.kodeForSide('EtS')).toBe('UETGS')
    expect(katalog.kodeForSide('Desmetylkariprazin')).toBe('KARSUM')
    // Metabolitter som er egne legemidler beholder sin egen side.
    expect(katalog.kodeForSide('Nortriptylin')).toBe('NOR')
    expect(katalog.finn('OXA')!.sidenavn).toBe('Oksazepam')
    expect(katalog.paSiden('Oksazepam').map((o) => o.kode)).toEqual(['OXA'])
    expect(sideFor('Sertralin')).toBe('Sertralin')
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
