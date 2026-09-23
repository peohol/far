import { describe, expect, it } from 'vitest'
import { FORTOLKNING, adresse, analyttadresse, lesRute, sammeRute } from '../rute'

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
})
