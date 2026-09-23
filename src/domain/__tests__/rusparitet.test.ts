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
import { RUS_MODULER, type RusModul } from '../rus'
import { RUS_KOMMENTARER, RUS_REGELSETT } from '../rusregelsett'
import { kjorScenarier, validerScenarioregelsett, verdifelter, type Scenarioregelsett } from '../scenario'

/**
 * Konsentrasjonene som prøves i hvert felt. Med dem blir andelene i
 * diazepamgruppen (OXA / (DIAZ + DMI)) og kodeingruppen (MOR / KOD) både
 * nøyaktig 10 %, 20 % og 100 %, og rett under og over.
 */
const VERDIER = [
  '', ' ', 'abc', '-1', '1 0', '0', '0,0', '0,05', '0,1', '0,19', '0,2', '0,21', '0,5', '0,99', '1', '1,0', '1,01',
  '2', '10', '99', '100', '100,0', '101', '199', '199,9', '200', '200,1', '201', '400', '600', '999', '1000', '1000,5', '1001',
]

function delmengder(koder: readonly string[]): string[][] {
  return koder.reduce<string[][]>((alle, kode) => [...alle, ...alle.map((d) => [...d, kode])], [[]])
}

function kombinasjoner(felt: readonly string[]): Record<string, string>[] {
  return felt.reduce<Record<string, string>[]>(
    (alle, navn) => alle.flatMap((k) => VERDIER.map((v) => ({ ...k, [navn]: v }))),
    [{}],
  )
}

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
    const pavistSett = delmengder(regelsett.analytter)

    it('ber om de samme konsentrasjonene', () => {
      for (const pavist of pavistSett) {
        expect(verdifelter(regelsett, pavist), pavist.join('+')).toEqual(modul.verdifelter(pavist).map((f) => f.kode))
        // Rekkefølgen brukeren krysser av i, spiller ingen rolle.
        const baklengs = [...pavist].reverse()
        expect(verdifelter(regelsett, baklengs)).toEqual(modul.verdifelter(baklengs).map((f) => f.kode))
      }
    })

    it('gir identisk resultat for alle kombinasjoner, og treffer hvert scenario', () => {
      const truffet = new Set<string>()
      let antall = 0
      for (const pavist of pavistSett) {
        for (const verdier of kombinasjoner(modul.verdifelter(pavist).map((f) => f.kode))) {
          for (const rekkefolge of [pavist, [...pavist].reverse()]) {
            const inn = { pavist: rekkefolge, verdier }
            const ny = kjorScenarier(regelsett, RUS_KOMMENTARER, inn)
            expect(ny.resultat, JSON.stringify(inn)).toEqual(modul.fortolk(inn))
            if (ny.scenario) truffet.add(ny.scenario.nokkel)
            antall++
          }
        }
      }
      expect(antall).toBeGreaterThan(0)
      expect([...truffet].sort()).toEqual(regelsett.scenarier.map((s) => s.nokkel).sort())
    })
  },
)
