/**
 * Paritet mellom dagens rusmiddelmotor (`rus.ts`) og scenariomotoren med
 * dagens regler importert som scenarioregelsett (`rusregelsett.ts`).
 *
 * Alle modulene prøves over alle kombinasjoner av påviste analytter, og over
 * et rutenett av konsentrasjoner som treffer hver grense nøyaktig, rett under
 * og rett over — pluss tomme felt, null og tekst som ikke er tall. Resultatet
 * skal være identisk: samme type, samme kommentarer med samme merke, rolle,
 * koder og tekst i samme rekkefølge, samme notiser og samme meldinger.
 */
import { describe, expect, it } from 'vitest'
import { forventParitet, forventSammeVerdifelter } from '../../__tests__/hjelp/rusparitet'
import { RUS_MODULER, type RusModul } from '../rus'
import { RUS_KOMMENTARER, RUS_REGELSETT } from '../rusregelsett'
import { validerScenarioregelsett, type Scenarioregelsett } from '../scenario'

const par: [RusModul, Scenarioregelsett][] = RUS_MODULER.map((modul, i) => {
  const regelsett = RUS_REGELSETT[i]
  if (!regelsett) throw new Error(`mangler regelsett for ${modul.id}`)
  return [modul, regelsett]
})

describe('dagens rusmiddelregler som scenarioregelsett', () => {
  it('har ett regelsett per modul, med samme koder i samme rekkefølge', () => {
    expect(RUS_REGELSETT.map((r) => r.modul)).toEqual(RUS_MODULER.map((m) => m.id))
    for (const [modul, regelsett] of par) {
      expect(regelsett.analytter, modul.id).toEqual(modul.analytter.map((a) => a.kode))
    }
  })

  it('er gyldige', () => {
    for (const regelsett of RUS_REGELSETT) {
      expect(validerScenarioregelsett(regelsett, RUS_KOMMENTARER), regelsett.modul).toEqual([])
    }
  })

  it('viser til hver kommentartekst i datasettet, og ikke til noe annet', () => {
    const brukt = new Set(
      RUS_REGELSETT.flatMap((r) =>
        r.scenarier.flatMap((s) => (s.utfall.type === 'kommentarer' ? s.utfall.plasseringer.map((p) => p.kommentar) : [])),
      ),
    )
    expect([...brukt].sort()).toEqual([...RUS_KOMMENTARER.keys()].sort())
  })
})

describe.each(par.map(([modul, regelsett]) => [modul.id, modul, regelsett] as const))(
  'paritet for %s',
  (_id, modul, regelsett) => {
    it('ber om de samme konsentrasjonene', () => forventSammeVerdifelter(modul, regelsett))
    it('gir identisk resultat for alle kombinasjoner, og treffer hvert scenario', () =>
      forventParitet(modul, regelsett, RUS_KOMMENTARER))
  },
)
