import { describe, expect, it } from 'vitest'
import { ANALYTTKATALOG } from '../analyttkatalog'
import {
  analytterForStoff,
  fortolkningForStoff,
  fortolkningsseksjonFor,
  primareAnalytter,
  referanseomraderPerAnalytt,
  regelseksjoner,
  stoffadresseForAnalytt,
  stoffbeskrivelse,
  stofferForFortolkning,
} from '../koblinger'
import { GRUNNSTRUKTUR } from '../../__tests__/hjelp/registerstruktur'
import { STOFFREGISTER, STOFFREGISTERDATA, byggStoffregister, type Registerdata } from '../stoffregister'

/**
 * Koblingene mellom stoffene (fagsidene) og laboratorieanalyttene
 * (fortolkningen): eksplisitte, i begge retninger, uten at noen av sidene
 * bytter identitet.
 */

const koblinger = (slug: string) =>
  analytterForStoff(slug).map(({ kobling }) => [kobling.kode, kobling.relasjon, kobling.primar] as const)
const primartStoff = (kode: string) => STOFFREGISTER.primartStoffFor(kode)?.slug

describe('koblingene klinikeren har bestemt', () => {
  it('kobler hver analytt til sitt stoff', () => {
    expect(primartStoff('HBUP')).toBe('bupropion')
    expect(primartStoff('VENSUM')).toBe('venlafaksin')
    expect(primartStoff('AMTNORSUM')).toBe('amitriptylin')
    expect(primartStoff('NOR')).toBe('nortriptylin')
    expect(primartStoff('RISPSUM')).toBe('risperidon')
    expect(primartStoff('PALI')).toBe('paliperidon')
    expect(primartStoff('DMI')).toBe('diazepam')
    expect(primartStoff('OTRAM')).toBe('tramadol')
    expect(primartStoff('IRCAK')).toBe('thc')
    expect(primartStoff('UETGS')).toBe('etanol')
    expect(primartStoff('UETS')).toBe('etanol')
  })

  it('sier hva analytten er for stoffet: selve stoffet, en metabolitt eller en sumanalyse', () => {
    expect(koblinger('bupropion')).toEqual([['HBUP', 'metabolitt', true]])
    expect(koblinger('venlafaksin')).toEqual([['VENSUM', 'sumanalyse', true]])
    expect(koblinger('paliperidon')).toEqual([
      ['PALI', 'selve_stoffet', true],
      ['RISPSUM', 'sumanalyse', false],
    ])
    expect(koblinger('diazepam')).toEqual([
      ['DIAZ', 'selve_stoffet', true],
      ['DMI', 'metabolitt', true],
    ])
    expect(koblinger('tramadol')).toEqual([
      ['TRAM', 'selve_stoffet', true],
      ['OTRAM', 'metabolitt', true],
    ])
    expect(koblinger('thc')).toEqual([
      ['THC', 'selve_stoffet', true],
      ['IRCAK', 'metabolitt', true],
    ])
    expect(koblinger('etanol')).toEqual([
      ['UETGS', 'metabolitt', true],
      ['UETS', 'metabolitt', true],
    ])
  })

  it('lar AMTNORSUM navigere til amitriptylin, mens nortriptylin er sitt eget stoff med NOR', () => {
    expect(koblinger('amitriptylin')).toEqual([['AMTNORSUM', 'sumanalyse', true]])
    expect(koblinger('nortriptylin')).toEqual([
      ['NOR', 'selve_stoffet', true],
      ['AMTNORSUM', 'sumanalyse', false],
    ])
    expect(STOFFREGISTER.stofferFor('AMTNORSUM').map((k) => k.stoff)).toEqual(['amitriptylin', 'nortriptylin'])
    expect(primareAnalytter('nortriptylin').map((a) => a.kode)).toEqual(['NOR'])
  })

  it('gjør aldri en kode eller en metabolitt til et stoff', () => {
    for (const nokkel of ['hbup', 'dmi', 'otram', 'ircak', 'uetgs', 'uets', 'hydroksybupropion', 'n-desmetyldiazepam']) {
      expect(STOFFREGISTER.finn(nokkel), nokkel).toBeUndefined()
    }
  })

  it('har et primært stoff for hver kode, og stoffer uten analytt', () => {
    for (const { kode } of ANALYTTKATALOG.oppforinger) expect(primartStoff(kode), kode).toBeDefined()
    expect(analytterForStoff('litium')).toEqual([])
    expect(analytterForStoff('karbamazepin')).toEqual([])
  })
})

describe('koblingene fra en datafil', () => {
  const data: Registerdata = {
    stoffer: [
      { slug: 'moderstoff', navn: 'Moderstoff', aliaser: ['Metabolitten'] },
      { slug: 'annet', navn: 'Annet' },
      { slug: 'uten', navn: 'Uten analytt' },
    ],
    analyttkoblinger: [
      { kode: 'HBUP', stoff: 'moderstoff', relasjon: 'metabolitt' },
      { kode: 'AMTNORSUM', stoff: 'annet', relasjon: 'sumanalyse' },
      { kode: 'AMTNORSUM', stoff: 'moderstoff', relasjon: 'sumanalyse', primar: false },
    ],
  }
  const register = byggStoffregister([], data)

  it('følger bare koblingene, aldri navnet', () => {
    expect(register.primartStoffFor('HBUP')?.slug).toBe('moderstoff')
    // DIAZ har ingen kobling i denne datafilen: ingen fagside, selv om «Diazepam» er et kjent navn ellers.
    expect(register.primartStoffFor('DIAZ')).toBeUndefined()
    expect(stoffadresseForAnalytt('DIAZ', [], register)).toBeUndefined()
    expect(analytterForStoff('uten', register)).toEqual([])
  })

  it('tillater mange til mange', () => {
    expect(analytterForStoff('moderstoff', register).map((a) => a.kobling.kode)).toEqual(['HBUP', 'AMTNORSUM'])
    expect(register.stofferFor('AMTNORSUM').map((k) => k.stoff)).toEqual(['annet', 'moderstoff'])
    expect(primareAnalytter('moderstoff', register).map((a) => a.kode)).toEqual(['HBUP'])
  })
})

describe('veiene mellom fortolkningen og stoffsidene', () => {
  it('lenker en analyttkode til det primære stoffets side', () => {
    expect(stoffadresseForAnalytt('HBUP')).toBe('#/stoff/bupropion')
    expect(stoffadresseForAnalytt('dmi')).toBe('#/stoff/diazepam')
    expect(stoffadresseForAnalytt('OTRAM')).toBe('#/stoff/tramadol')
    expect(stoffadresseForAnalytt('IRCAK')).toBe('#/stoff/thc')
    expect(stoffadresseForAnalytt('UETS')).toBe('#/stoff/etanol')
    expect(stoffadresseForAnalytt('AMTNORSUM')).toBe('#/stoff/amitriptylin')
    expect(stoffadresseForAnalytt('NOR', ['farmakokinetikk'])).toBe('#/stoff/nortriptylin/farmakokinetikk')
    expect(stoffadresseForAnalytt('FINNESIKKE')).toBeUndefined()
  })

  it('fører fra en modul til stoffene kodene i den hører til, hvert én gang', () => {
    const slugger = (kode: string) => stofferForFortolkning(ANALYTTKATALOG.finn(kode)!.fortolkning).map((s) => s.slug)
    expect(slugger('HBUP')).toEqual(['bupropion'])
    // EtG og EtS hører begge til etanol.
    expect(slugger('UETGS')).toEqual(['etanol'])
    expect(slugger('TRAM')).toEqual(['tramadol'])
    // DIAZ og metabolitten DMI hører til diazepam, OXA til oksazepam.
    expect(slugger('DIAZ')).toEqual(['diazepam', 'oksazepam'])
    expect(slugger('KOD')).toEqual(['kodein', 'morfin'])
  })

  it('åpner fortolkningen fra stoffsiden når stoffets analytter er i én modul', () => {
    expect(fortolkningForStoff('bupropion')).toBe(ANALYTTKATALOG.finn('HBUP')!.fortolkning)
    expect(fortolkningForStoff('diazepam')).toBe(ANALYTTKATALOG.finn('DMI')!.fortolkning)
    expect(fortolkningForStoff('thc')).toBeUndefined()
    expect(fortolkningForStoff('litium')).toBeUndefined()
  })

  it('gir reglene for hver modul sin seksjon på stoffsiden', () => {
    const seksjoner = (slug: string) =>
      regelseksjoner(slug).map((s) => [s.seksjon, s.analytter.map((a) => a.kode)] as const)
    expect(seksjoner('bupropion')).toEqual([['fortolkning', ['HBUP']]])
    expect(seksjoner('diazepam')).toEqual([['fortolkning', ['DIAZ', 'DMI']]])
    expect(seksjoner('thc')).toEqual([
      ['fortolkning', ['THC']],
      ['fortolkning-ircak', ['IRCAK']],
    ])
    expect(seksjoner('etanol')).toEqual([['fortolkning', ['UETGS', 'UETS']]])
    // Nortriptylin viser reglene for NOR, ikke for AMTNORSUM.
    expect(seksjoner('nortriptylin')).toEqual([['fortolkning', ['NOR']]])
    expect(seksjoner('litium')).toEqual([])
    expect(fortolkningsseksjonFor('IRCAK')).toBe('fortolkning-ircak')
    expect(fortolkningsseksjonFor('hbup')).toBe('fortolkning')
    expect(fortolkningsseksjonFor('FINNESIKKE')).toBeUndefined()
  })

  it('beskriver stoffet i søketreffene med kategorien og analyttene som sekundær informasjon', () => {
    const register = byggStoffregister([], STOFFREGISTERDATA, GRUNNSTRUKTUR)
    const beskriv = (slug: string) => stoffbeskrivelse(slug, register)
    expect(beskriv('bupropion')).toBe('Antidepressiver › NDRI · analytt HBUP · hydroksybupropion (kun aktiv metabolitt)')
    expect(beskriv('sertralin')).toBe('Antidepressiver › SSRI · analytt SERT')
    expect(beskriv('litium')).toBe('Stemningsstabiliserende')
    // Forkortelser med blandet skrift står som de er, midt i linja.
    expect(beskriv('etanol')).toContain('analytt UETGS · EtG')
    // Før inndelingen er hentet, er det bare analyttene.
    expect(stoffbeskrivelse('sertralin')).toBe('analytt SERT')
  })
})

describe('referanseområdet fortolkningen viser for en kode', () => {
  it('tar kortet på det primære stoffets side: uten «gjelder» for hovedanalytten, med koden for de andre', () => {
    const omrader = referanseomraderPerAnalytt([
      { stoff: 'bupropion', gjelder: null, verdi: 'hbup' },
      { stoff: 'diazepam', gjelder: null, verdi: 'diaz' },
      { stoff: 'diazepam', gjelder: 'DMI', verdi: 'dmi' },
      { stoff: 'tramadol', gjelder: null, verdi: 'tram' },
      { stoff: 'nortriptylin', gjelder: null, verdi: 'nor' },
    ])
    expect(omrader.get('HBUP')).toBe('hbup')
    expect(omrader.get('DIAZ')).toBe('diaz')
    expect(omrader.get('DMI')).toBe('dmi')
    expect(omrader.get('TRAM')).toBe('tram')
    // En metabolitt får aldri moderstoffets område.
    expect(omrader.has('OTRAM')).toBe(false)
    // AMTNORSUM hører til amitriptylin, ikke til nortriptylin.
    expect(omrader.get('NOR')).toBe('nor')
    expect(omrader.has('AMTNORSUM')).toBe(false)
  })
})
