import { describe, expect, it } from 'vitest'
import { FORTOLKNING, adresse, analyttadresse, informasjonsadresse, lesRute, sammeRute, sokeside, stoffadresse } from '../rute'

describe('adressene i appen', () => {
  it('leser informasjonssidene av adressen', () => {
    expect(lesRute('#/analytt/AMTNORSUM')).toEqual({ side: 'analytt', kode: 'AMTNORSUM' })
    expect(lesRute('#/analytt/amtnorsum/')).toEqual({ side: 'analytt', kode: 'AMTNORSUM' })
    expect(lesRute('#/analytt/DIAZ%20')).toEqual({ side: 'analytt', kode: 'DIAZ' })
  })

  it('leser alt annet som fortolkningen', () => {
    for (const hash of ['', '#', '#/', '#/analytt/', '#/noe/annet', '#element-123', '#/analytt/%E0%A4%A']) {
      expect(lesRute(hash), hash).toEqual(FORTOLKNING)
    }
  })

  it('skriver adressen slik den leses igjen', () => {
    expect(analyttadresse('nor')).toBe('#/analytt/NOR')
    expect(adresse(FORTOLKNING)).toBe('#/')
    const rute = { side: 'analytt', kode: 'AMF1' } as const
    expect(lesRute(adresse(rute))).toEqual(rute)
    expect(sammeRute(rute, lesRute('#/analytt/amf1'))).toBe(true)
    expect(sammeRute(rute, FORTOLKNING)).toBe(false)
  })

  it('leser og skriver et sted på siden: en seksjon og et detaljkort i den', () => {
    expect(lesRute('#/analytt/AMTNORSUM/farmakokinetikk')).toEqual({
      side: 'analytt',
      kode: 'AMTNORSUM',
      sted: ['farmakokinetikk'],
    })
    const rute = { side: 'analytt', kode: 'NOR', sted: ['farmakokinetikk', 'kort 1/ø'] } as const
    expect(adresse(rute)).toBe('#/analytt/NOR/farmakokinetikk/kort%201%2F%C3%B8')
    expect(lesRute(adresse(rute))).toEqual(rute)
    // Et annet sted er en annen adresse til den samme siden.
    expect(sammeRute(rute, { side: 'analytt', kode: 'NOR' })).toBe(false)
  })

  it('åpner siden uten sted når stedet ikke kan leses eller har for mange nivåer', () => {
    expect(lesRute('#/analytt/NOR/a/b/c')).toEqual({ side: 'analytt', kode: 'NOR' })
    expect(lesRute('#/analytt/NOR/%E0%A4%A')).toEqual({ side: 'analytt', kode: 'NOR' })
  })

  it('leser og skriver siden for et stoff uten analyttkode, etter navnet', () => {
    expect(lesRute('#/stoff/Valproat')).toEqual({ side: 'stoff', navn: 'Valproat' })
    expect(lesRute('#/stoff/Valproat/tdm')).toEqual({ side: 'stoff', navn: 'Valproat', sted: ['tdm'] })
    expect(lesRute('#/stoff/%20Litium%20/')).toEqual({ side: 'stoff', navn: 'Litium' })
    expect(lesRute('#/stoff/')).toEqual(FORTOLKNING)
    const rute = { side: 'stoff', navn: 'Stoff med æøå/skråstrek', sted: ['tdm', 'kort-1'] } as const
    expect(adresse(rute)).toBe('#/stoff/Stoff%20med%20%C3%A6%C3%B8%C3%A5%2Fskr%C3%A5strek/tdm/kort-1')
    expect(lesRute(adresse(rute))).toEqual(rute)
    // Navnet beholder store og små bokstaver, der koden gjøres stor.
    expect(stoffadresse('litium')).toBe('#/stoff/litium')
    expect(informasjonsadresse({ navn: 'Litium' }, ['tdm'])).toBe('#/stoff/Litium/tdm')
    expect(informasjonsadresse({ kode: 'nor', navn: 'Nortriptylin' })).toBe('#/analytt/NOR')
  })

  it('leser og skriver søkesiden, med søket i adressen', () => {
    expect(lesRute('#/sok?q=kvetiapin')).toEqual({ side: 'sok', q: 'kvetiapin' })
    expect(lesRute('#/sok')).toEqual({ side: 'sok', q: '' })
    expect(lesRute('#/sok?q=')).toEqual({ side: 'sok', q: '' })
    const rute = { side: 'sok', q: 'sertralin metabolisme & ø' } as const
    expect(adresse(rute)).toBe(sokeside(rute.q))
    expect(lesRute(adresse(rute))).toEqual(rute)
    expect(sammeRute(rute, { side: 'sok', q: 'noe annet' })).toBe(false)
    expect(adresse({ side: 'sok', q: '' })).toBe('#/sok')
  })
})
