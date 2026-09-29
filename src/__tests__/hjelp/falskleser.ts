/**
 * En faginnholdsleser uten database, for testene som viser en stoffside i en
 * nettleser i minnet: ingen sider, ingen regler og ingen referanser, med det
 * testen trenger lagt over. Hver metode er en `vi.fn`, så testen kan se hva
 * siden leste.
 */
import { vi } from 'vitest'
import { TOM_STOFFSIDE, type Faginnholdsleser } from '../../faginnhold/lesing'

export function falskLeser(overstyr: Partial<Faginnholdsleser> = {}): Faginnholdsleser {
  return {
    lesStoffside: vi.fn(async () => TOM_STOFFSIDE),
    lesStoffliste: vi.fn(async () => []),
    lesReferanser: vi.fn(async () => []),
    finnIntervallregelsett: vi.fn(async () => null),
    finnScenarioregelsett: vi.fn(async () => null),
    lesIntervallregelsett: vi.fn(async () => []),
    lesThcRegelsett: vi.fn(async () => null),
    lesKommentarer: vi.fn(async () => []),
    lesReferanseomrader: vi.fn(async () => new Map()),
    lesHistorikk: vi.fn(async () => {
      throw new Error('ikke i bruk')
    }),
    ...overstyr,
  }
}
