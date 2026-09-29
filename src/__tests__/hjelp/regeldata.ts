/**
 * Reglene en stoffside viser, lest slik stoffsiden gjør det (`useStoffside`):
 * for de analyttene stoffet er primært stoff for etter koblingene i
 * stoffregisteret — aldri gjennom siden. Intervallregelsettet for hver kode,
 * THC-syreregelsettet når en av kodene er THC-syre, og scenarioregelsettet for
 * hver modul kodene fortolkes i.
 */
import { primareAnalytter } from '../../domain/koblinger'
import { rusModulFor } from '../../domain/rus'
import { THC_KODE } from '../../domain/thc'
import type { Faginnholdsleser, Regeldata } from '../../faginnhold/lesing'
import type { Tilstand } from '../../faginnhold/modell'

export async function lesRegeldata(
  leser: Faginnholdsleser,
  slug: string,
  tilstand: Tilstand,
  { medScenarioregler = tilstand === 'utkast' }: { medScenarioregler?: boolean } = {},
): Promise<Regeldata> {
  const analytter = primareAnalytter(slug)
  const koder = analytter.map((a) => a.kode)
  const moduler = [...new Set(analytter.flatMap((a) => rusModulFor(a.fortolkning)?.id ?? []))]
  const [intervall, thcregelsett, scenario] = await Promise.all([
    Promise.all(koder.map(async (kode) => [kode, await leser.finnIntervallregelsett(kode, tilstand)] as const)),
    koder.includes(THC_KODE) ? leser.lesThcRegelsett(tilstand) : null,
    medScenarioregler
      ? Promise.all(moduler.map(async (id) => [id, await leser.finnScenarioregelsett(id, tilstand)] as const))
      : [],
  ])
  const utfylt = <T>(par: readonly (readonly [string, T | null])[]) =>
    Object.fromEntries(par.filter((p): p is readonly [string, T] => p[1] !== null))
  return { regelsett: utfylt(intervall), thcregelsett, scenarioregelsett: utfylt(scenario) }
}
