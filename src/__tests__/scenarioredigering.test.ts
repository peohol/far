/**
 * Endringene redigeringen gjør på et scenarioregelsett, som rene funksjoner:
 * at hver endring treffer det den skal og ikke noe annet, at tekstene
 * kontrolleres som databasen gjør, at feilmeldingene sier scenarionummeret
 * brukeren ser, og at det som lagres, er nøyaktig de nye og endrede
 * kommentarene. At databasen godtar det redigeringen lager, prøves i
 * `scenarioregelsett.test.ts`.
 *
 * Regelsettene er de importerte rusmiddelreglene. Tekstene testen skriver, er
 * syntetiske.
 */
import { describe, expect, it } from 'vitest'
import { kjorScenarier, type Scenarioregelsett } from '../domain/scenario'
import type { Utgave } from '../faginnhold/lesing'
import type { Kommentarinnhold } from '../domain/kommentarobjekt'
import { endredeFelt } from '../faginnhold/historikk'
import {
  brukKommentar,
  egenKommentar,
  klargjorScenarioutkast,
  kommentarbrukere,
  kontrollerScenarioutkast,
  lesbarFeil,
  scenariofelter,
  scenariokommentarendringer,
  scenarionumre,
  settGrense,
  settKommentartekst,
  settMelding,
  settTekstliste,
  utkastfelter,
  type Scenarioutkast,
} from '../regler/scenarioredigering'
import { RUS_GRUNNLAG, RUS_KOMMENTARER, rusRegelsett } from './hjelp/rusgrunnlag'

function utkast(modul: string): Scenarioutkast {
  return { regelsett: rusRegelsett(modul), tekster: new Map(RUS_KOMMENTARER) }
}

/** Kommentarobjektene slik de er lest, i revisjon 1. */
const LAGREDE: Utgave<Kommentarinnhold>[] = RUS_GRUNNLAG.kommentarer.map((k) => ({
  id: k.id,
  revisjon: 1,
  publisert_revisjon: 1,
  innhold: k.innhold,
  endret_av_fornavn: '',
  endret_av_etternavn: '',
  endret_kl: '',
}))

const tekstnavn = (id: string) => `Tekst «${id}»`

function plassering(r: Scenarioregelsett, scenario: string, merke: string) {
  const u = r.scenarier.find((s) => s.nokkel === scenario)!.utfall
  if (u.type !== 'kommentarer') throw new Error('ikke kommentarer')
  return u.plasseringer.find((p) => p.merke === merke)!
}

describe('endringene', () => {
  it('gir én plassering sin egen tekst uten å endre de andre som brukte den', () => {
    const start = utkast('diazepamgruppen')
    expect(kommentarbrukere(start.regelsett, 'diazepam/hoved').map((b) => b.scenario)).toEqual([
      'diaz',
      'diaz_dmi',
      'diaz_oxa',
      'alle_hver_for_seg',
    ])
    const u = settKommentartekst(egenKommentar(start, 'diaz_dmi', 'Hovedkommentar', () => 'ny'), 'ny', 'Syntetisk.')
    expect(plassering(u.regelsett, 'diaz_dmi', 'Hovedkommentar').kommentar).toBe('ny')
    expect(plassering(u.regelsett, 'diaz', 'Hovedkommentar').kommentar).toBe('diazepam/hoved')
    expect(u.tekster.get('diazepam/hoved')).toBe(RUS_KOMMENTARER.get('diazepam/hoved'))
    // Den nye teksten begynner som en kopi, og startutkastet er urørt.
    expect(egenKommentar(start, 'diaz_dmi', 'Hovedkommentar', () => 'ny').tekster.get('ny')).toBe(
      RUS_KOMMENTARER.get('diazepam/hoved'),
    )
    expect(start.tekster.has('ny')).toBe(false)
    expect(egenKommentar(start, 'finnes_ikke', 'Hovedkommentar', () => 'ny')).toBe(start)
  })

  it('lar en plassering bruke en annen tekst, og endrer ingenting annet', () => {
    const r = rusRegelsett('diazepamgruppen')
    const endret = brukKommentar(r, 'diaz_oxa', 'Hovedkommentar for oksazepam', 'diazepam/hoved')
    expect(plassering(endret, 'diaz_oxa', 'Hovedkommentar for oksazepam').kommentar).toBe('diazepam/hoved')
    expect(plassering(endret, 'dmi_oxa', 'Hovedkommentar for oksazepam').kommentar).toBe('oksazepam/hoved')
    expect(r).toEqual(rusRegelsett('diazepamgruppen'))
  })

  it('flytter grensen, og fortolkningen følger den rett på og rett over', () => {
    const r = settGrense(rusRegelsett('diazepamgruppen'), 'oksazepamgrense', 0.12)
    const alle = { pavist: ['DIAZ', 'DMI', 'OXA'], verdier: { DIAZ: '400', DMI: '600', OXA: '120' } }
    expect(kjorScenarier(r, RUS_KOMMENTARER, alle).scenario?.nokkel).toBe('alle_felles')
    expect(kjorScenarier(r, RUS_KOMMENTARER, { ...alle, verdier: { ...alle.verdier, OXA: '120,1' } }).scenario?.nokkel).toBe(
      'alle_hver_for_seg',
    )
  })

  it('fjerner mellomrom i endene av alle tekstene før lagringen', () => {
    let u = settKommentartekst(utkast('kodeingruppen'), 'kodein/hoved', '  Syntetisk.  ')
    u = { ...u, regelsett: settMelding(u.regelsett, 'grasone', ' Syntetisk melding. ') }
    u = { ...u, regelsett: settTekstliste(u.regelsett, 'grasone', 'veiledning', [' Syntetisk veiledning. ']) }
    const klar = klargjorScenarioutkast(u)
    expect(klar.tekster.get('kodein/hoved')).toBe('Syntetisk.')
    const grasone = klar.regelsett.scenarier.find((s) => s.nokkel === 'grasone')!.utfall
    expect(grasone).toMatchObject({ melding: 'Syntetisk melding.', veiledning: ['Syntetisk veiledning.'] })
    expect(kontrollerScenarioutkast(klar, tekstnavn)).toEqual([])
  })
})

describe('kontrollen før lagringen', () => {
  it('godtar de importerte regelsettene', () => {
    for (const r of RUS_GRUNNLAG.regelsett) {
      expect(kontrollerScenarioutkast({ regelsett: r, tekster: RUS_KOMMENTARER }, tekstnavn), r.modul).toEqual([])
    }
  })

  it('sier hvilken tekst som er tom, har linjeskift eller plassholdere', () => {
    const u = utkast('diazepamgruppen')
    expect(kontrollerScenarioutkast(settKommentartekst(u, 'oksazepam/hoved', ''), tekstnavn)).toContain(
      'Tekst «oksazepam/hoved»: Kommentaren mangler tekst.',
    )
    expect(kontrollerScenarioutkast(settKommentartekst(u, 'oksazepam/hoved', 'To\nlinjer.'), tekstnavn)).toContain(
      'Tekst «oksazepam/hoved»: Kommentarteksten må stå på én linje.',
    )
    expect(kontrollerScenarioutkast(settKommentartekst(u, 'oksazepam/hoved', 'Nivå {nivå}.'), tekstnavn)).toContain(
      'Scenariet oxa viser til en kommentar med plassholdere.',
    )
  })

  it('stopper grenser som gir hull eller overlapp, og sier det med scenarionumrene', () => {
    const r = settGrense(rusRegelsett('kodeingruppen'), 'lav_morfin', 1.5)
    const feil = kontrollerScenarioutkast({ regelsett: r, tekster: RUS_KOMMENTARER }, tekstnavn)
    expect(feil.length).toBeGreaterThan(0)
    const numre = scenarionumre(r)
    const lesbare = feil.map((f) => lesbarFeil(f, r, numre))
    for (const f of lesbare) {
      // Ingen nøkler brukeren ikke ser: scenariene har nummer, forholdet står som brøk.
      for (const s of r.scenarier) expect(f).not.toMatch(new RegExp(`\\b${s.nokkel}\\b`))
      expect(f).not.toContain('morfinandel')
    }
    expect(lesbare.join('\n')).toMatch(/Scenario \d+ og \d+ overlapper når KOD \+ MOR er påvist og MOR \/ KOD = /)
  })

  it('skriver om nøklene bare der de står for et scenario, et forhold eller en grense', () => {
    const r = rusRegelsett('diazepamgruppen')
    const numre = scenarionumre(r)
    expect(lesbarFeil('Scenariene diaz og diaz_dmi og alle_felles overlapper.', r, numre)).toBe(
      'Scenario 1 og 4 og 7 overlapper.',
    )
    expect(lesbarFeil('Scenariet diaz_oxa må ha minst én hovedkommentar.', r, numre)).toBe(
      'Scenario 5 må ha minst én hovedkommentar.',
    )
    expect(lesbarFeil('Notisen i dmi_oxa mangler eller har mellomrom i endene.', r, numre)).toBe(
      'Notisen i scenario 6 mangler eller har mellomrom i endene.',
    )
    expect(lesbarFeil('Meldingen når nevneren i oksazepamandel er 0 mangler.', r, numre)).toBe(
      'Meldingen når nevneren i OXA / (DIAZ + DMI) er 0 mangler.',
    )
    expect(lesbarFeil('Grensen oksazepamgrense må være et tall større enn 0.', r, numre)).toBe(
      'Grensen «Oksazepam som andel av diazepam + N-desmetyldiazepam» må være et tall større enn 0.',
    )
    // Et ord som tilfeldigvis er en nøkkel et annet sted, står.
    expect(lesbarFeil('Påvist diaz.', r, numre)).toBe('Påvist diaz.')
  })
})

describe('lagringen', () => {
  it('lagrer bare de nye og endrede kommentarene, og navngir de nye', () => {
    let u = egenKommentar(utkast('diazepamgruppen'), 'diaz_oxa', 'Hovedkommentar for oksazepam', () => 'ny')
    u = settKommentartekst(u, 'ny', 'Syntetisk egen tekst.')
    u = settKommentartekst(u, 'diazepam/hoved', 'Syntetisk endret tekst.')
    // En tekst som ikke lenger brukes, lagres ikke.
    u = settKommentartekst(u, 'kodein/hoved', 'Syntetisk, ikke i bruk her.')
    const endringer = scenariokommentarendringer(u, 'Diazepam', LAGREDE)
    expect(endringer).toEqual([
      {
        id: 'diazepam/hoved',
        revisjon: 1,
        innhold: { ...RUS_GRUNNLAG.kommentarer.find((k) => k.id === 'diazepam/hoved')!.innhold, tekst: 'Syntetisk endret tekst.' },
      },
      {
        id: 'ny',
        revisjon: null,
        innhold: {
          navn: 'Diazepam – påvist DIAZ + OXA – Hovedkommentar for oksazepam',
          tekst: 'Syntetisk egen tekst.',
          plassholdere: [],
        },
      },
    ])
    expect(scenariokommentarendringer(utkast('diazepamgruppen'), 'Diazepam', LAGREDE)).toEqual([])
  })
})

describe('feltene', () => {
  it('nummererer scenariene som analyttsiden, og sier hva som er endret', () => {
    const r = rusRegelsett('diazepamgruppen')
    const felter = scenariofelter(r, (id) => id)
    expect(felter.find((f) => f.nokkel === 'grense-oksazepamgrense')).toMatchObject({
      gruppe: 'Grenser',
      verdi: 'Oksazepam som andel av diazepam + N-desmetyldiazepam: 10 %',
    })
    expect(felter.find((f) => f.nokkel === 'alle_felles-vilkar')).toMatchObject({
      gruppe: 'Scenario 7',
      verdi:
        'Påvist: DIAZ, DMI, OXA. OXA / (DIAZ + DMI) ≤ Oksazepam som andel av diazepam + N-desmetyldiazepam',
    })

    const for_ = utkast('diazepamgruppen')
    let etter = settKommentartekst(for_, 'oksazepam/hoved', 'Syntetisk.')
    etter = { ...etter, regelsett: settGrense(etter.regelsett, 'oksazepamgrense', 0.12) }
    expect(endredeFelt(utkastfelter(for_), utkastfelter(etter))).toEqual([
      'Grenser: Grense 1',
      'Scenario 3: Hovedkommentar',
      'Scenario 5: Hovedkommentar for oksazepam',
      'Scenario 6: Hovedkommentar for oksazepam',
      'Scenario 8: Hovedkommentar for oksazepam',
    ])
  })
})
