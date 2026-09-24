/**
 * Referansene fra legemiddeldataene (FEST): stabile ID-er fra kilden, FEST
 * selv som kilde med sporbarheten, og at de nummereres sammen med de
 * redaksjonelle — og forsvinner av seg selv når FEST ikke lenger har dem.
 */
import { describe, expect, it } from 'vitest'
import { byggSidemodell, referanseunivers } from '../faginnhold/analyttside'
import { TOM_SIDE } from '../faginnhold/lesing'
import { PANELER } from '../faginnhold/paneler'
import { erAutomatisk, formaterReferanse } from '../faginnhold/referanser'
import type { Interaksjon, Interaksjonsoversikt } from '../legemiddeldata/interaksjoner'
import { TOMT_UTVALG, type Legemiddelutvalg } from '../legemiddeldata/lesing'
import {
  FEST_KILDE,
  festkilde,
  festopphav,
  festreferanser,
  interaksjonsreferanse,
  interaksjonsreferanseId,
  interaksjonsreferanser,
  interaksjonssted,
} from '../legemiddeldata/referanser'

const UTVALG: Legemiddelutvalg = {
  ...TOMT_UTVALG,
  kildedato: '2026-09-08T03:09:06',
  kontrollert_kl: '2026-09-23T04:15:00Z',
}

function interaksjon(id: string, referanser: Interaksjon['referanser']): Interaksjon {
  return {
    id,
    relevans: 'forholdsregler',
    relevanstekst: 'Forholdsregler bør tas',
    med: `Stoff ${id}`,
    gjelder: 'Sidens stoff',
    situasjonskriterier: [],
    klinisk_konsekvens: null,
    mekanisme: null,
    handtering: [],
    kildegrunnlag: null,
    referanser,
  }
}

function oversikt(...interaksjoner: Interaksjon[]): Interaksjonsoversikt {
  return { interaksjoner, atc: ['N06AA09'], ikke_vurdert: [] }
}

const PREPARATER = PANELER.find((p) => p.form === 'legemidler')!.nokkel
const INTERAKSJONER = PANELER.find((p) => p.form === 'interaksjoner')!.nokkel

describe('FEST som kilde', () => {
  it('har sporbarheten — uttrekket og kontrollen — for seg, utenfor referanseteksten', () => {
    const kilde = festkilde(UTVALG)
    expect(kilde.id).toBe(FEST_KILDE)
    expect(formaterReferanse(kilde)).toBe('FEST – Forskrivnings- og ekspedisjonsstøtte · Direktoratet for medisinske produkter')
    expect(kilde.automatisk).toEqual({
      kilde: 'FEST',
      opphav: 'Legemiddeldata fra FEST, uttrekk fra 8. september 2026, sist kontrollert 23. september 2026',
    })
    expect(erAutomatisk(kilde)).toBe(true)
  })

  it('hopper over datoer som mangler eller ikke kan leses', () => {
    expect(festopphav({ kildedato: null, kontrollert_kl: 'ikke en dato' })).toBe('Legemiddeldata fra FEST')
  })
})

describe('referansene DMP oppgir for en interaksjon', () => {
  it('får en stabil ID fra teksten og lenken, uavhengig av mellomrom', () => {
    const a = interaksjonsreferanseId({ kilde: 'Hiemke C  et al. 2018', lenke: 'https://doi.org/x' })
    expect(a).toMatch(/^fest:[0-9a-z]+$/)
    expect(interaksjonsreferanseId({ kilde: ' Hiemke C et al.\n2018 ', lenke: 'https://doi.org/x' })).toBe(a)
    expect(interaksjonsreferanseId({ kilde: 'Hiemke C et al. 2018' })).not.toBe(a)
    expect(interaksjonsreferanseId({ kilde: 'Hiemke C et al. 2019', lenke: 'https://doi.org/x' })).not.toBe(a)
  })

  it('blir en automatisk referanse, og viser lenken bare én gang når teksten er lenken', () => {
    expect(interaksjonsreferanse({ kilde: 'SPC Testmiddel', lenke: 'https://example.org/spc' })).toMatchObject({
      tittel: 'SPC Testmiddel',
      lenke: 'https://example.org/spc',
      automatisk: { kilde: 'FEST' },
    })
    const bareLenke = interaksjonsreferanse({ kilde: 'https://example.org/a', lenke: 'https://example.org/a' })
    expect(formaterReferanse(bareLenke)).toBe('https://example.org/a')
  })

  it('tar med hver referanse én gang, i DMPs rekkefølge, og hopper over tomme', () => {
    const i = interaksjon('1', [{ kilde: 'B' }, { kilde: 'A' }, { kilde: 'B' }, { kilde: '  ' }])
    expect(interaksjonsreferanser(i)).toEqual([
      interaksjonsreferanseId({ kilde: 'B' }),
      interaksjonsreferanseId({ kilde: 'A' }),
    ])
  })
})

describe('de automatiske referansene på en side', () => {
  it('er ingen før legemiddeldataene er hentet', () => {
    expect(festreferanser(null, null)).toEqual({ referanser: [] })
  })

  it('siterer FEST i feltet til preparatene og interaksjonene, og DMPs referanser i hvert kort', () => {
    const felles = { kilde: 'Felles kilde' }
    const kilder = festreferanser(
      UTVALG,
      oversikt(interaksjon('1', [felles, { kilde: 'Egen' }]), interaksjon('2', [felles]), interaksjon('3', [])),
    )
    expect(kilder.panelreferanser).toEqual({ [PREPARATER]: [FEST_KILDE], [INTERAKSJONER]: [FEST_KILDE] })
    expect(kilder.elementer).toEqual([
      { panel: INTERAKSJONER, id: interaksjonssted({ id: '1' }), referanser: interaksjonsreferanser(interaksjon('1', [felles, { kilde: 'Egen' }])) },
      { panel: INTERAKSJONER, id: interaksjonssted({ id: '2' }), referanser: [interaksjonsreferanseId(felles)] },
      { panel: INTERAKSJONER, id: interaksjonssted({ id: '3' }), referanser: [] },
    ])
    // Samme referanse i to interaksjoner er én referanse.
    expect(kilder.referanser.map((r) => r.tittel)).toEqual([
      'FEST – Forskrivnings- og ekspedisjonsstøtte',
      'Felles kilde',
      'Egen',
    ])
    expect(kilder.referanser.every(erAutomatisk)).toBe(true)
  })

  it('nummereres sammen med de redaksjonelle, og forsvinner når FEST ikke lenger har dem', () => {
    const modell = byggSidemodell(TOM_SIDE)
    const med = referanseunivers(modell, festreferanser(UTVALG, oversikt(interaksjon('1', [{ kilde: 'Borte snart' }]))))
    expect(med.liste.map((o) => [o.nummer, o.referanse.tittel])).toEqual([
      [1, 'FEST – Forskrivnings- og ekspedisjonsstøtte'],
      [2, 'Borte snart'],
    ])
    expect(med.panelreferanser).toEqual({ [PREPARATER]: [FEST_KILDE], [INTERAKSJONER]: [FEST_KILDE] })

    // Neste synkronisering har ikke interaksjonen: referansen er borte, uten hull.
    const etter = referanseunivers(modell, festreferanser(UTVALG, oversikt()))
    expect(etter.liste.map((o) => [o.nummer, o.referanse.tittel])).toEqual([
      [1, 'FEST – Forskrivnings- og ekspedisjonsstøtte'],
    ])
    // Uten legemiddeldata er det bare de redaksjonelle.
    expect(referanseunivers(modell).liste).toEqual([])
  })

  it('tar ikke med automatiske referanser i paneler siden ikke kjenner', () => {
    const univers = referanseunivers(byggSidemodell(TOM_SIDE), {
      referanser: [festkilde(UTVALG)],
      panelreferanser: { ukjent: [FEST_KILDE] },
      elementer: [{ panel: 'ukjent', id: 'x', referanser: [FEST_KILDE] }],
    })
    expect(univers.liste).toEqual([])
    expect(univers.panelreferanser).toEqual({})
  })
})
