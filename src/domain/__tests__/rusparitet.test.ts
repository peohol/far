/**
 * Rusmiddelreglene som ble importert til Supabase, mot fasiten fra den
 * opprinnelige rusmiddelmotoren (se `src/__tests__/hjelp/rusparitet.ts`).
 *
 * Alle modulene prøves over alle kombinasjoner av påviste analytter og et
 * rutenett av konsentrasjoner på, rett under og rett over hver grense.
 * Resultatet skal være identisk: samme type, samme kommentarer med samme
 * merke, rolle, koder og tekst i samme rekkefølge, samme notiser og samme
 * meldinger. At regelsettene i databasen er de samme, prøves i
 * `src/__tests__/rusimport.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { FASITMODULER, forventFasit } from '../../__tests__/hjelp/rusparitet'
import { RUS_GRUNNLAG, RUS_KOMMENTARER, RUS_REGELSETT } from '../../__tests__/hjelp/rusgrunnlag'
import { moduleKoder, RUS_MODULER } from '../rus'
import { validerScenarioregelsett } from '../scenario'

describe('de importerte rusmiddelreglene', () => {
  it('har ett regelsett per modul, med samme koder i samme rekkefølge', () => {
    expect(RUS_REGELSETT.map((r) => r.modul)).toEqual(RUS_MODULER.map((m) => m.id))
    expect(FASITMODULER).toEqual(RUS_MODULER.map((m) => m.id))
    for (const [i, modul] of RUS_MODULER.entries()) {
      expect(RUS_REGELSETT[i]!.analytter, modul.id).toEqual(moduleKoder(modul))
    }
  })

  it('er gyldige', () => {
    for (const regelsett of RUS_REGELSETT) {
      expect(validerScenarioregelsett(regelsett, RUS_KOMMENTARER), regelsett.modul).toEqual([])
    }
  })

  it('viser til hver kommentar i grunnlaget, og ikke til noe annet', () => {
    const brukt = new Set(
      RUS_REGELSETT.flatMap((r) =>
        r.scenarier.flatMap((s) => (s.utfall.type === 'kommentarer' ? s.utfall.plasseringer.map((p) => p.kommentar) : [])),
      ),
    )
    expect([...brukt].sort()).toEqual(RUS_GRUNNLAG.kommentarer.map((k) => k.id).sort())
  })
})

describe.each(RUS_REGELSETT.map((r) => [r.modul, r] as const))('paritet for %s', (_modul, regelsett) => {
  it('gir det den opprinnelige motoren ga, for alle kombinasjoner, og treffer hvert scenario', () =>
    forventFasit(regelsett, RUS_KOMMENTARER))
})
