import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Farmakogenetikkutvalg } from '../../clinpgx/lesing'
import { byggFarmakogenetikkvisning, type Farmakogenetikkvisning } from '../../clinpgx/stoffside'
import { lagDiplotypeindeks, type Diplotypeindeks } from '../../cpic/diplotype'
import type { Cpicutvalg } from '../../cpic/lesing'
import { byggCpicvisning, type Cpicvisning } from '../../cpic/stoffside'
import { useFaginnholdskilde } from './Faginnholdskilde'

/** Dataene fra én kilde for kjemikaliene siden er koblet til, og visningen bygd av dem. */
export type Kildetilstand<U, V> =
  | { status: 'ingen' }
  | { status: 'laster' }
  | { status: 'klar'; utvalg: U; visning: V }
  | { status: 'feil'; feil: string }

export type Farmakogenetikktilstand = Kildetilstand<Farmakogenetikkutvalg, Farmakogenetikkvisning>
export type Cpictilstand = Kildetilstand<Cpicutvalg, Cpicvisning>

/**
 * Leser dataene fra en kilde for ClinPGx-ID-ene siden er koblet til, og
 * bygger visningen av dem. `ingen` når siden ikke er koblet, eller appen er
 * satt opp uten kilden. `lesPaNytt` leser dem igjen, etter at en
 * administrator har hentet nye. `bygg` må være den samme funksjonen hver gang.
 */
function useKilde<U, V>(
  leser: { les(ider: readonly string[]): Promise<U> } | undefined,
  koblet: readonly string[],
  bygg: (utvalg: U) => V,
): { tilstand: Kildetilstand<U, V>; lesPaNytt: () => void } {
  // Nøkkelen, og ikke lista, avgjør om koblingen er ny, som i `useLegemidler`.
  const nokkel = koblet.join('\n')
  const ider = useMemo(() => (nokkel ? nokkel.split('\n') : []), [nokkel])
  const [tilstand, setTilstand] = useState<Kildetilstand<U, V>>({ status: 'ingen' })
  const [runde, setRunde] = useState(0)

  useEffect(() => {
    if (!leser || ider.length === 0) {
      setTilstand({ status: 'ingen' })
      return
    }
    let gjelder = true
    setTilstand((forrige) => (forrige.status === 'klar' ? forrige : { status: 'laster' }))
    leser
      .les(ider)
      .then((utvalg) => {
        if (gjelder) setTilstand({ status: 'klar', utvalg, visning: bygg(utvalg) })
      })
      .catch((e: Error) => {
        if (gjelder) setTilstand({ status: 'feil', feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [leser, ider, bygg, runde])

  const lesPaNytt = useCallback(() => setRunde((r) => r + 1), [])
  return { tilstand, lesPaNytt }
}

/** ClinPGx-dataene for kjemikaliene siden er koblet til, ordnet slik seksjonen «Farmakogenetikk» viser dem. */
export function useFarmakogenetikk(koblet: readonly string[]) {
  return useKilde(useFaginnholdskilde().farmakogenetikk, koblet, byggFarmakogenetikkvisning)
}

/** CPIC-dataene for de samme kjemikaliene, etter ClinPGx-ID-en CPIC oppgir for legemidlene. */
export function useCpic(koblet: readonly string[]) {
  return useKilde(useFaginnholdskilde().cpic, koblet, byggCpicvisning)
}

export type Diplotypetilstand =
  | { status: 'ingen' }
  | { status: 'laster' }
  | { status: 'klar'; indeks: Diplotypeindeks }
  | { status: 'feil'; feil: string }

/**
 * CPICs tabell fra diplotype til resultat for genet, når `gen` er satt.
 * Hentes én gang per gen (leseren husker den); bare gensymbolet sendes.
 * `utgave` sier hvilke CPIC-data siden viser (`cpicutgave`): når den endres,
 * etter at en administrator har hentet fra CPIC, leses tabellen på nytt.
 */
export function useDiplotyper(gen: string | null, utgave: string): Diplotypetilstand {
  const leser = useFaginnholdskilde().cpic
  const [tilstand, setTilstand] = useState<Diplotypetilstand>({ status: 'ingen' })
  useEffect(() => {
    if (!leser || !gen) {
      setTilstand({ status: 'ingen' })
      return
    }
    let gjelder = true
    setTilstand({ status: 'laster' })
    leser
      .diplotyper(gen)
      .then((grunnlag) => {
        if (gjelder) setTilstand({ status: 'klar', indeks: lagDiplotypeindeks(grunnlag) })
      })
      .catch((e: Error) => {
        if (gjelder) setTilstand({ status: 'feil', feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [leser, gen, utgave])
  return tilstand
}
