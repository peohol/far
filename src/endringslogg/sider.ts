/**
 * Hvilken side endringsloggen gjelder, ut fra siden som står åpen: en fagside,
 * stoffregisteret eller fortolkningen av én analytt (med reglene for kodene
 * den dekker, scenariomodulene og THC-syrereglene).
 */
import type { Analyttkatalog } from '../domain/analyttkatalog'
import type { Analyte } from '../types'
import { analytterForFortolkning } from '../domain/koblinger'
import { scenariomoduler } from '../domain/rus'
import type { Rute } from '../domain/rute'
import { THC_KODE } from '../domain/thc'
import type { Endringsside } from './modell'

export function endringssideFor(
  rute: Rute,
  {
    fortolkning,
    katalog,
    kanonisk = (nokkel) => nokkel,
  }: { fortolkning: Analyte | null; katalog: Analyttkatalog; kanonisk?: (nokkel: string) => string },
): Endringsside | null {
  if (rute.side === 'stoff') return { stoff: kanonisk(rute.stoff) }
  if (rute.side === 'stoffregister') return { stoffregister: true }
  if (rute.side !== 'fortolkning' || !rute.analytt || !fortolkning) return null
  const analytter = analytterForFortolkning(fortolkning, katalog)
  const analyttkoder = [...new Set(analytter.map((a) => a.kode))]
  return {
    analyttkoder,
    moduler: scenariomoduler(analytter.map((a) => a.fortolkning)).map((m) => m.id),
    thc: analyttkoder.includes(THC_KODE),
  }
}

/** En nøkkel for siden, så loggen bare hentes på nytt når siden er en annen. */
export function endringssidenokkel(side: Endringsside): string {
  return JSON.stringify(side)
}
