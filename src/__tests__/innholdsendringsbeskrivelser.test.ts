/**
 * Beskrivelsene endringsloggen gir når den som gjorde endringen ikke skrev
 * noe selv (`src/endringslogg/oppsummering.ts`).
 */
import { describe, expect, it } from 'vitest'
import type { Endring, Endringsdel, Hendelse } from '../endringslogg/modell'
import { autosammendrag, delnavn, sammendrag, beskrivelser, endringslinjer } from '../endringslogg/oppsummering'

function del(overstyr: Partial<Endringsdel>): Endringsdel {
  return {
    objekt: crypto.randomUUID(),
    type: 'innholdselement',
    fra: 1,
    til: 2,
    publisert: false,
    for: null,
    etter: {},
    endret: [],
    dataEndret: [],
    referanser: null,
    panelreferanser: {},
    ...overstyr,
  }
}

const mekanisme = (maal: string, endring: Partial<Endringsdel> = {}) =>
  del({
    for: { panel: 'farmakodynamikk', elementtype: 'mekanismekort', data: { maal } },
    etter: { panel: 'farmakodynamikk', elementtype: 'mekanismekort', data: { maal } },
    endret: ['data'],
    dataEndret: ['effekt'],
    ...endring,
  })

const dosering = del({
  for: { panel: 'dosering', elementtype: 'riktekst', data: {} },
  etter: { panel: 'dosering', elementtype: 'riktekst', data: {} },
  endret: ['data'],
  dataEndret: ['dokument'],
})

const beskriv = (deler: Endringsdel[], hendelser: Hendelse[] = []) => beskrivelser(endringslinjer({ deler, hendelser }))
const hendelse = (navn: string, data: Record<string, unknown>): Hendelse => ({ hendelse: navn, kl: '', data })

describe('beskrivelsen av endringene på en fagside', () => {
  it('sier at en tekstseksjon er oppdatert', () => {
    expect(beskriv([dosering])).toEqual(['Dosering oppdatert'])
  })

  it('nevner kortet ved navn når det er ett, og teller når det er flere', () => {
    expect(beskriv([mekanisme('D2')])).toEqual(['Farmakodynamikk: mekanismekort «D2» endret'])
    expect(beskriv([mekanisme('D2'), mekanisme('5-HT2A')])).toEqual(['Farmakodynamikk: to mekanismekort endret'])
  })

  it('skiller nye, endrede og fjernede kort', () => {
    const nytt = mekanisme('5-HT2C', { fra: null, for: null, endret: [] })
    const fjernet = mekanisme('H1', { etter: { panel: 'fjernet', elementtype: 'mekanismekort', data: { maal: 'H1' } } })
    expect(beskriv([fjernet, nytt, mekanisme('D2')])).toEqual([
      'Farmakodynamikk: mekanismekort «H1» fjernet',
      'Farmakodynamikk: mekanismekort «5-HT2C» lagt til',
      'Farmakodynamikk: mekanismekort «D2» endret',
    ])
  })

  it('sier at rekkefølgen er endret når kortene bare er flyttet', () => {
    expect(beskriv([mekanisme('D2', { endret: ['posisjon'], dataEndret: [] }), mekanisme('H1', { endret: ['posisjon'], dataEndret: [] })])).toEqual([
      'Farmakodynamikk: rekkefølgen endret',
    ])
  })

  it('teller referansene som er lagt til og fjernet, på kortene og på seksjonene', () => {
    const kilder = del({
      ...dosering,
      endret: ['referanser'],
      dataEndret: [],
      referanser: { lagt_til: 1, fjernet: 0 },
    })
    const side = del({
      type: 'infoside',
      for: { navn: 'Sertralin' },
      etter: { navn: 'Sertralin' },
      endret: ['panelreferanser'],
      panelreferanser: { dosering: { lagt_til: 1, fjernet: 2 } },
    })
    expect(beskriv([kilder, side])).toEqual(['Dosering: to referanser lagt til og to referanser fjernet'])
    expect(beskriv([kilder])).toEqual(['Dosering: én referanse lagt til'])
  })

  it('kaller datakortene og koblingene ved navn', () => {
    const halveringstid = del({ for: { panel: 'viktige_data', elementtype: 'halveringstid' }, etter: { panel: 'viktige_data', elementtype: 'halveringstid' }, endret: ['data'], dataEndret: ['verdier'] })
    const kobling = del({ for: { panel: 'preparater', elementtype: 'legemiddelkobling' }, etter: { panel: 'preparater', elementtype: 'legemiddelkobling' }, endret: ['data'], dataEndret: ['virkestoff'] })
    // I den rekkefølgen seksjonene står på siden.
    expect(beskriv([kobling, halveringstid])).toEqual([
      'Viktige data: Halveringstid oppdatert',
      'Preparater: koblingen til legemiddeldataene oppdatert',
    ])
  })

  it('sier at siden er opprettet og at navnet er endret', () => {
    expect(beskriv([del({ type: 'infoside', fra: null, etter: { navn: 'Sertralin' } })])).toEqual(['Fagsiden opprettet'])
    expect(beskriv([del({ type: 'infoside', for: { navn: 'Sertralin' }, etter: { navn: 'Sertralin (SSRI)' }, endret: ['navn'] })])).toEqual([
      'Navnet endret fra «Sertralin» til «Sertralin (SSRI)»',
    ])
  })

  it('beskriver referanser, kommentarer og fortolkningsregler', () => {
    expect(
      beskriv([
        del({ type: 'referanse', fra: null, etter: { tittel: 'Felleskatalogen' } }),
        del({ type: 'kommentar', etter: { navn: 'Høy verdi' } }),
        del({ type: 'intervallregelsett', etter: { analyttkode: 'SERT' } }),
        del({ type: 'thc_regelsett', etter: {} }),
      ]),
    ).toEqual([
      'Referanser: referanse «Felleskatalogen» lagt til',
      'Fortolkningskommentarer: fortolkningskommentar «Høy verdi» endret',
      'Fortolkningsreglene for SERT oppdatert',
      'Fortolkningsreglene for THC-syre i urin oppdatert',
    ])
  })

  it('setter sammen en flytting i stoffregisteret til én linje', () => {
    const data = { stoff: 'sertralin', stoffnavn: 'Sertralin' }
    expect(
      beskriv(
        [],
        [
          hendelse('stoff_tatt_ut', { ...data, kategorinavn: 'SSRI' }),
          hendelse('stoff_plassert', { ...data, kategorinavn: 'Antidepressiver' }),
          hendelse('kategori_flyttet', { navn: 'SSRI', fra: null, til: 'Antidepressiver' }),
          hendelse('stoff_arkivert', data),
        ],
      ),
    ).toEqual([
      'Sertralin flyttet fra kategorien «SSRI» til «Antidepressiver»',
      'Kategorien «SSRI» flyttet fra øverste nivå til kategorien «Antidepressiver»',
      'Sertralin arkivert',
    ])
  })

  it('beskriver importerte og tilbaketrukne bivirkninger', () => {
    expect(
      beskriv(
        [],
        [
          hendelse('bivirkning_importert', { tittel: 'SPC Zoloft', erstatter: true }),
          hendelse('bivirkning_trukket', { tittel: 'SPC Sertralin Actavis' }),
        ],
      ),
    ).toEqual(['Bivirkninger oppdatert fra «SPC Zoloft»', 'Bivirkningene fra «SPC Sertralin Actavis» trukket tilbake'])
  })
})

describe('sammendraget', () => {
  const endring = (deler: Endringsdel[], oppsummering: string | null = null): Pick<Endring, 'oppsummering' | 'deler' | 'hendelser'> => ({
    oppsummering,
    deler,
    hendelser: [],
  })

  it('bruker det personen skrev, og ellers det som ble endret', () => {
    expect(sammendrag(endring([dosering], 'Ny maksdose'))).toBe('Ny maksdose')
    expect(sammendrag(endring([dosering]))).toBe('Dosering oppdatert')
  })

  it('tar med de tre første og teller resten', () => {
    const indikasjon = del({ ...dosering, for: { panel: 'indikasjon', elementtype: 'riktekst' }, etter: { panel: 'indikasjon', elementtype: 'riktekst' } })
    const ny = del({ type: 'referanse', fra: null, etter: { tittel: 'A' } })
    expect(autosammendrag({ deler: [dosering, indikasjon, mekanisme('D2'), ny, del({ type: 'kommentar', etter: { navn: 'K' } })], hendelser: [] })).toBe(
      'Farmakodynamikk: mekanismekort «D2» endret · Indikasjon oppdatert · Dosering oppdatert · og 2 endringer til',
    )
  })

  it('sier fra når ingenting synlig ble endret', () => {
    expect(autosammendrag({ deler: [], hendelser: [] })).toBe('Ingen synlige endringer')
  })

  it('gir hver del et kort navn til detaljene', () => {
    expect(delnavn(mekanisme('D2'))).toBe('Farmakodynamikk › D2')
    expect(delnavn(del({ type: 'referanse', etter: { tittel: '' } }))).toBe('Referanse: uten tittel')
  })
})
