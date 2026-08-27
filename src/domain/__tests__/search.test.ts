import { describe, expect, it } from 'vitest'
import { analytes } from '../analytes'
import { MAX_RESULTS, search } from '../search'

function codes(query: string): string[] {
  return search(query, analytes).map((h) => h.analyte.kode)
}

describe('search', () => {
  it('gir ingen treff på tomt søk', () => {
    expect(search('', analytes)).toHaveLength(0)
    expect(search('   ', analytes)).toHaveLength(0)
  })

  it('setter eksakt kodetreff først', () => {
    expect(codes('NOR')[0]).toBe('NOR')
    expect(codes('LAM')[0]).toBe('LAM')
  })

  it('finner analytter på navn', () => {
    expect(codes('sertralin')).toContain('SERT')
    expect(codes('kvetiapin')[0]).toBe('KVE')
  })

  it('finner sumanalyser på en av delanalyttene', () => {
    expect(codes('nortriptylin')).toContain('AMTNORSUM')
    expect(codes('desmetylkariprazin')).toContain('KARSUM')
  })

  it('treffer bare på begynnelsen av kode, navn eller delanalytt', () => {
    // «kve» skal gi kvetiapin og ingenting annet — ingen treff inne i ordet,
    // og ingen oppmykning der bokstavene bare må komme i riktig rekkefølge.
    expect(codes('kve')).toEqual(['KVE'])
    expect(codes('tiapin')).toEqual([])
    expect(codes('kvtp')).toEqual([])
    expect(codes('zapin')).toEqual([])
  })

  it('krever at alle ordene i søket treffer', () => {
    expect(codes('amitriptylin nortriptylin')).toEqual(['AMTNORSUM'])
    expect(codes('amitriptylin sertralin')).toHaveLength(0)
  })

  it('treffer ikke på «Sum: » i visningsnavnet', () => {
    // «Sum: » sier noe om formen på analysen, ikke om stoffet man leter etter,
    // og skal ikke dra med seg hver eneste sumanalyse på et par bokstaver.
    expect(codes('sum')).toEqual([])
    expect(codes('su')).toEqual([])
    // Sertralin på navnet, kanrenon på aliaset «spironolakton» — ingen
    // sumanalyser.
    expect(codes('s')).toEqual(['SERT', 'KANR'])
    expect(codes('sum kariprazin')).toEqual([])
  })

  it('bruker aliaser fra datasettet', () => {
    expect(codes('bupropion')).toContain('HBUP')
    expect(codes('hydroksyrisperidon')).toContain('PALI')
    // Kanrenon er metabolitten av spironolakton, og det er moderstoffet som
    // står på rekvisisjonen.
    expect(codes('spironolakton')).toEqual(['KANR'])
  })

  it('finner metabolittanalyttene på moderstoffet de heter etter', () => {
    // «Enalaprilat» begynner på «enalapril», så navnet finner analytten uten
    // at det trengs et alias.
    expect(codes('enalapril')).toEqual(['ENAT'])
    expect(codes('ramipril')).toEqual(['RAMAT'])
    expect(codes('losartan')).toEqual(['LOSYR'])
  })

  it('er ufølsom for store bokstaver og norske vokaler', () => {
    expect(codes('KLOZAPIN')).toContain('KLOZ')
    expect(codes('klozapin')).toContain('KLOZ')
  })

  it('viser aldri mer enn ti alternativer', () => {
    for (const bokstav of 'abcdefghijklmnopqrstuvwxyz') {
      expect(search(bokstav, analytes).length).toBeLessThanOrEqual(MAX_RESULTS)
    }
  })

  it('smalner inn etter hvert som man skriver', () => {
    const steg = ['k', 'kl', 'klo', 'kloz'].map((q) => search(q, analytes).length)
    expect(steg[steg.length - 1]).toBeLessThanOrEqual(steg[0] ?? 0)
    expect(codes('kloz')).toContain('KLOZ')
  })

  it('lar hver analytt være entydig søkbar på sin egen kode', () => {
    for (const a of analytes) {
      expect(codes(a.kode)[0]).toBe(a.kode)
    }
  })
})
