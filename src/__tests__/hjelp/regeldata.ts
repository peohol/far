/**
 * Reglene redigeringen på en fortolkningsside viser, lest slik den gjør det
 * (`useFortolkningsredigering`): for analyttene i modulen koden fortolkes i.
 * Intervallregelsettet for hver kode, THC-syreregelsettet når en av kodene er
 * THC-syre, og scenarioregelsettet når modulen fortolkes med dem.
 */
import { ANALYTTKATALOG } from '../../domain/analyttkatalog'
import { analytterForFortolkning } from '../../domain/koblinger'
import { rusModulFor } from '../../domain/rus'
import { THC_KODE } from '../../domain/thc'
import type { Faginnholdsleser, Regeldata } from '../../faginnhold/lesing'
import type { Tilstand } from '../../faginnhold/modell'

export async function lesRegeldata(leser: Faginnholdsleser, kode: string, tilstand: Tilstand): Promise<Regeldata> {
  const analytt = ANALYTTKATALOG.finn(kode)
  if (!analytt) throw new Error(`Ukjent analyttkode: ${kode}`)
  const analytter = analytterForFortolkning(analytt.fortolkning)
  const koder = analytter.map((a) => a.kode)
  const modul = rusModulFor(analytt.fortolkning)
  const [intervall, thcregelsett, scenario] = await Promise.all([
    Promise.all(koder.map(async (k) => [k, await leser.finnIntervallregelsett(k, tilstand)] as const)),
    koder.includes(THC_KODE) ? leser.lesThcRegelsett(tilstand) : null,
    modul ? Promise.all([[modul.id, await leser.finnScenarioregelsett(modul.id, tilstand)] as const]) : [],
  ])
  const utfylt = <T>(par: readonly (readonly [string, T | null])[]) =>
    Object.fromEntries(par.filter((p): p is readonly [string, T] => p[1] !== null))
  return { regelsett: utfylt(intervall), thcregelsett, scenarioregelsett: utfylt(scenario) }
}
