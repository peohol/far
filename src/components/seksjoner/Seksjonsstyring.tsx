import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { rullefart } from '../../hooks/useKortHopp'

/**
 * Hvilke seksjoner og detaljkort på en side som er åpne, og veien til et sted
 * på siden.
 *
 * Hver skuff (en seksjon eller et detaljkort, se `Seksjon.tsx`) har en nøkkel:
 * seksjonens ID, eller seksjonens og kortets ID med `/` imellom — de samme
 * leddene som står i adressen (`#/analytt/KODE/seksjon/kort`, se
 * `src/domain/rute.ts`). Tilstanden holdes her, samlet for siden, så noe
 * utenfor skuffen kan åpne den: søket på siden, en direktelenke og «Åpne alle».
 *
 * Uten denne rundt seg holder hver skuff tilstanden selv.
 */

/** Skillet mellom leddene i en nøkkel, som i adressen. */
export const STISKILLE = '/'

/** Nøkkelen til skuffen stien peker på. */
export function skuffnokkel(sti: readonly string[]): string {
  return sti.join(STISKILLE)
}

/** Attributtet skuffens ytterste element bærer nøkkelen i. */
export const SKUFFATTRIBUTT = 'data-skuff'

export interface Skufftilstand {
  apen: boolean
  /** Usann når skuffen skal skifte uten å gli, f.eks. når søket åpner den. */
  animer: boolean
}

/** Hvor elementet legges i vinduet, eller `false` for å la vinduet ligge. */
export type Rulleplass = ScrollLogicalPosition | false

export interface Seksjonsstyring {
  /** Tilstanden til skuffen med nøkkelen. */
  tilstand(nokkel: string, apenFraStart: boolean): Skufftilstand
  sett(nokkel: string, apen: boolean, animer?: boolean): void
  /** Kalles av skuffen når den tegnes; gir tilbake avregistreringen. */
  registrer(nokkel: string, apenFraStart: boolean): () => void
  /**
   * Åpner seksjonen og eventuelt detaljkortet stien peker på, og ruller dit.
   * Finnes skuffen ikke ennå — innholdet er ikke hentet — åpnes den og rulles
   * det dit når den kommer.
   */
  apne(sti: readonly string[], plass?: Rulleplass): void
  /**
   * Åpner skuffene elementet står i, innenfra og ut, og ruller elementet fram.
   * Brukes av søket for å vise et treff i en lukket seksjon.
   */
  apneTil(element: Element, plass?: Rulleplass): void
  /** Åpner eller lukker alle skuffene på siden. */
  settAlle(apen: boolean): void
  /** Sant når alle skuffene på siden er åpne. */
  alleApne: boolean
}

const Kontekst = createContext<Seksjonsstyring | null>(null)

/** Styringen for siden, eller `null` når skuffene holder tilstanden selv. */
export function useSeksjonsstyring(): Seksjonsstyring | null {
  return useContext(Kontekst)
}

/** Rammen for en side med seksjoner. Legges rundt hele siden, søket medregnet. */
export function SeksjonsstyringKilde({ children }: { children: ReactNode }) {
  const [overstyrt, setOverstyrt] = useState<ReadonlyMap<string, Skufftilstand>>(() => new Map())
  const [registrert, setRegistrert] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  /**
   * Hva «Åpne alle» eller «Lukk alle» sist satte. Gjelder også skuffer som
   * kommer til etterpå, f.eks. de tomme panelene som vises i redigeringsmodus.
   */
  const [standard, setStandard] = useState<boolean | null>(null)
  /** Stedet en direktelenke peker på, mens det venter på at skuffen skal tegnes. */
  const venter = useRef<{ nokkel: string; plass: Rulleplass } | null>(null)

  const sett = useCallback((nokkel: string, apen: boolean, animer = true) => {
    setOverstyrt((forrige) => new Map(forrige).set(nokkel, { apen, animer }))
  }, [])

  const registrer = useCallback((nokkel: string, apenFraStart: boolean) => {
    setRegistrert((forrige) => new Map(forrige).set(nokkel, apenFraStart))
    if (venter.current?.nokkel === nokkel) {
      const { plass } = venter.current
      venter.current = null
      etterTegning(() => rull(finnSkuff(nokkel), plass))
    }
    return () =>
      setRegistrert((forrige) => {
        const neste = new Map(forrige)
        neste.delete(nokkel)
        return neste
      })
  }, [])

  const apneStille = useCallback((nokler: readonly string[]) => {
    if (nokler.length === 0) return
    setOverstyrt((forrige) => {
      const neste = new Map(forrige)
      for (const n of nokler) neste.set(n, { apen: true, animer: false })
      return neste
    })
  }, [])

  const apne = useCallback(
    (sti: readonly string[], plass: Rulleplass = 'start') => {
      const nokler = sti.map((_, i) => skuffnokkel(sti.slice(0, i + 1)))
      const mal = nokler[nokler.length - 1]
      if (!mal) return
      apneStille(nokler)
      const skuff = finnSkuff(mal)
      if (skuff) etterTegning(() => rull(skuff, plass))
      else venter.current = { nokkel: mal, plass }
    },
    [apneStille],
  )

  const apneTil = useCallback(
    (element: Element, plass: Rulleplass = 'center') => {
      apneStille(skufferRundt(element))
      etterTegning(() => rull(element, plass))
    },
    [apneStille],
  )

  const settAlle = useCallback((apen: boolean) => {
    setStandard(apen)
    setOverstyrt(new Map())
  }, [])

  const verdi = useMemo<Seksjonsstyring>(() => {
    const tilstand = (nokkel: string, apenFraStart: boolean): Skufftilstand =>
      overstyrt.get(nokkel) ?? { apen: standard ?? apenFraStart, animer: true }
    return {
      tilstand,
      sett,
      registrer,
      apne,
      apneTil,
      settAlle,
      alleApne: registrert.size > 0 && [...registrert].every(([n, fra]) => tilstand(n, fra).apen),
    }
  }, [overstyrt, standard, registrert, sett, registrer, apne, apneTil, settAlle])

  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

/** Nøklene til skuffene elementet står i, ytterst først. Elementet selv regnes med når det er en skuff. */
export function skufferRundt(element: Element): string[] {
  const nokler: string[] = []
  for (let el: Element | null = element.closest(`[${SKUFFATTRIBUTT}]`); el; ) {
    const nokkel = el.getAttribute(SKUFFATTRIBUTT)
    if (nokkel) nokler.unshift(nokkel)
    el = el.parentElement?.closest(`[${SKUFFATTRIBUTT}]`) ?? null
  }
  return nokler
}

function finnSkuff(nokkel: string): Element | null {
  // Nøkkelen kan inneholde hva som helst, så den sammenlignes og ikke settes inn i en selektor.
  return [...document.querySelectorAll(`[${SKUFFATTRIBUTT}]`)].find((el) => el.getAttribute(SKUFFATTRIBUTT) === nokkel) ?? null
}

/** Kjører `gjor` når React har tegnet det som nettopp ble satt. */
function etterTegning(gjor: () => void) {
  requestAnimationFrame(() => gjor())
}

function rull(element: Element | null, plass: Rulleplass) {
  if (element && plass) element.scrollIntoView({ behavior: rullefart(), block: plass })
}
