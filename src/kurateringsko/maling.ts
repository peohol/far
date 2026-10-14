/**
 * Stoffene i stoffregisteret og tallene køen prioriterer etter, lest med
 * appens egne lesere som en vanlig innlogget bruker: registeret slik
 * sidemenyen leser det, og hver publisert fagside slik siden leser den.
 * Bare tallene tas vare på; innholdet er bak innloggingen, og køen står på en
 * offentlig gren.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { byggStoffregister } from '../domain/stoffregister'
import { lagFaginnholdsleser } from '../faginnhold/lesing'
import { PANELER, type Panelform } from '../faginnhold/paneler'
import { forekomster } from '../faginnhold/referanser'
import { byggSidemodell, type Sidemodell } from '../faginnhold/stoffside'
import { lagRegisterlager } from '../stoffregister/api'
import type { Registerstoff } from './ko'
import type { Sidemaal } from './modell'

/** Formene redaktøren eller kuratoren skriver innholdet i; resten kommer fra datakildene. */
const REDAKSJONELLE_FORMER: ReadonlySet<Panelform> = new Set(['datakort', 'tekst', 'kort', 'mekanismer', 'tabell'])

/** Seksjonene kuratoren fyller, og som telles når køen ser etter manglende innhold. */
export const REDAKSJONELLE_PANELER: readonly string[] = PANELER.filter((p) => REDAKSJONELLE_FORMER.has(p.form)).map((p) => p.nokkel)

/** Tallene for en side, eller for et stoff uten publisert side (`modell` er `null`). */
export function maalSide(modell: Sidemodell | null, kl: string): Sidemaal {
  if (!modell) return { kl, side: false, elementer: 0, redaksjonelle_paneler: REDAKSJONELLE_PANELER.length, paneler_med_innhold: 0, referanser: 0, elementer_uten_kilde: 0 }
  const elementer = [...modell.paneler.values()].flat()
  const forekomstene = forekomster({ elementer, panelreferanser: modell.panelreferanser })
  const medKilde = new Set(forekomstene.map((f) => f.element))
  const redaksjonelle = new Set(REDAKSJONELLE_PANELER)
  // Et element i en seksjon med kilder i referansefeltet har kilder, selv uten egne.
  const utenKilde = elementer.filter(
    (e) => redaksjonelle.has(e.panel) && !medKilde.has(e.id) && (modell.panelreferanser[e.panel]?.length ?? 0) === 0,
  ).length
  return {
    kl,
    side: true,
    elementer: elementer.length,
    redaksjonelle_paneler: REDAKSJONELLE_PANELER.length,
    paneler_med_innhold: REDAKSJONELLE_PANELER.filter((p) => (modell.paneler.get(p)?.length ?? 0) > 0).length,
    referanser: new Set(forekomstene.flatMap((f) => f.ider)).size,
    elementer_uten_kilde: utenKilde,
  }
}

export interface Maling {
  stoffer: Registerstoff[]
  /** Sidene som ikke kunne leses; de beholder tallene fra før. */
  feilet: number
}

/** De aktive stoffene i registeret, med tallene for den publiserte siden hver har. */
export async function malRegisteret(klient: SupabaseClient, kl: string, samtidige = 4): Promise<Maling> {
  const database = await lagRegisterlager(klient).les('publisert')
  const register = byggStoffregister(database.sider, undefined, database.struktur)
  const harSide = new Set(database.sider.map((s) => s.slug))
  const leser = lagFaginnholdsleser(klient)
  const stoffer = [...register.stoffer]
  const ut: Registerstoff[] = []
  let feilet = 0
  for (let i = 0; i < stoffer.length; i += samtidige) {
    await Promise.all(
      stoffer.slice(i, i + samtidige).map(async (s) => {
        let maal: Sidemaal | null = null
        try {
          const data = harSide.has(s.slug) ? await leser.lesStoffside(s.slug, 'publisert') : null
          maal = maalSide(data?.infoside ? byggSidemodell(data) : null, kl)
        } catch {
          feilet += 1
        }
        ut.push({ stoff: s.slug, navn: s.navn, aktiv: true, maal })
      }),
    )
  }
  return { stoffer: ut.sort((a, b) => a.stoff.localeCompare(b.stoff)), feilet }
}
