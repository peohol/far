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
 * utenfor skuffen kan åpne den: søket på siden, en direktelenke og
 * nettleserens eget søk.
 *
 * **Én åpen skuff per nivå.** Skuffene med samme forelder — seksjonene på
 * siden, eller detaljkortene i en seksjon — er søsken, og bare én av dem kan
 * stå åpen. Tilstanden holdes derfor som *hvilken* skuff som er åpen i hver
 * søskenflokk, så regelen ikke kan brytes, uansett hva som åpner: brukeren,
 * en direktelenke, søket eller nettleseren. Å åpne en skuff lukker søsknene,
 * mens forelderen står åpen.
 */

/** Skillet mellom leddene i en nøkkel, som i adressen. */
export const STISKILLE = '/'

/** Nøkkelen til skuffen stien peker på. */
export function skuffnokkel(sti: readonly string[]): string {
  return sti.join(STISKILLE)
}

/** Attributtet skuffens ytterste element bærer nøkkelen i. */
export const SKUFFATTRIBUTT = 'data-skuff'

/** Forelderen til seksjonene på siden. Ingen skuff har en tom nøkkel. */
const ROT = ''

export interface Skufftilstand {
  apen: boolean
  /** Usann når skuffen skal skifte uten å gli, f.eks. når søket åpner den. */
  animer: boolean
}

/** Hvor elementet legges i vinduet, eller `false` for å la vinduet ligge. */
export type Rulleplass = ScrollLogicalPosition | false

export interface Seksjonsstyring {
  /** Tilstanden til skuffen stien peker på. */
  tilstand(sti: readonly string[], apenFraStart: boolean): Skufftilstand
  /**
   * Brukeren åpner eller lukker skuffen. Åpnes den, lukkes søsknene straks,
   * skuffen glir opp, og siden ruller til toppen av den når den er tegnet.
   */
  sett(sti: readonly string[], apen: boolean): void
  /** Kalles av skuffen når den tegnes; gir tilbake avregistreringen. */
  registrer(sti: readonly string[], apenFraStart: boolean): () => void
  /**
   * Åpner seksjonen og eventuelt detaljkortet stien peker på, og ruller dit.
   * Finnes skuffen ikke ennå — innholdet er ikke hentet — åpnes den og rulles
   * det dit når den kommer.
   */
  apne(sti: readonly string[], plass?: Rulleplass): void
  /**
   * Åpner skuffene elementet står i, innenfra og ut, og ruller elementet fram.
   * Brukes av søket for å vise et treff i en lukket seksjon, og av
   * nettleserens eget søk.
   */
  apneTil(element: Element, plass?: Rulleplass): void
}

const Kontekst = createContext<Seksjonsstyring | null>(null)

/** Styringen for siden, eller `null` utenfor en `SeksjonsstyringKilde`. */
export function useSeksjonsstyring(): Seksjonsstyring | null {
  return useContext(Kontekst)
}

/** Den åpne skuffen i en søskenflokk, eller `null` når alle er lukket. */
interface Valg {
  nokkel: string | null
  /** Om skiftet skal gli. Søsknene som lukkes fordi en annen åpnes, lukkes straks. */
  animer: boolean
}

interface Registrering {
  forelder: string
  apenFraStart: boolean
}

/** Kjeden av nøkler fra seksjonen og innover til skuffen stien peker på. */
function kjedeFor(sti: readonly string[]): string[] {
  return sti.map((_, i) => skuffnokkel(sti.slice(0, i + 1)))
}

/**
 * Rammen for en side med seksjoner. Legges rundt hele siden, søket medregnet.
 * En seksjon uten en slik ramme rundt seg lager sin egen (se `Seksjon`).
 */
export function SeksjonsstyringKilde({ children }: { children: ReactNode }) {
  /** Den åpne skuffen i hver søskenflokk som er åpnet eller lukket, med forelderens nøkkel. */
  const [valgt, setValgt] = useState<ReadonlyMap<string, Valg>>(() => new Map())
  const [registrert, setRegistrert] = useState<ReadonlyMap<string, Registrering>>(() => new Map())
  /** Stedet en direktelenke peker på, mens det venter på at skuffen skal tegnes. */
  const venter = useRef<{ nokkel: string; plass: Rulleplass } | null>(null)

  /**
   * Åpner kjeden av skuffer, ytterst først. Hver av dem blir den åpne i sin
   * søskenflokk. Bare den innerste glir, og bare når `animer` er sann.
   */
  const velg = useCallback((kjede: readonly string[], animer: boolean) => {
    if (kjede.length === 0) return
    setValgt((forrige) => {
      const neste = new Map(forrige)
      kjede.forEach((nokkel, i) => {
        neste.set(kjede[i - 1] ?? ROT, { nokkel, animer: animer && i === kjede.length - 1 })
      })
      return neste
    })
  }, [])

  const rullNar = useCallback((nokkel: string, plass: Rulleplass) => {
    const skuff = finnSkuff(nokkel)
    if (skuff) etterTegning(() => rull(skuff, plass))
    else venter.current = { nokkel, plass }
  }, [])

  const registrer = useCallback((sti: readonly string[], apenFraStart: boolean) => {
    const nokkel = skuffnokkel(sti)
    const forelder = skuffnokkel(sti.slice(0, -1))
    setRegistrert((forrige) => new Map(forrige).set(nokkel, { forelder, apenFraStart }))
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

  const apne = useCallback(
    (sti: readonly string[], plass: Rulleplass = 'start') => {
      const kjede = kjedeFor(sti)
      const mal = kjede[kjede.length - 1]
      if (!mal) return
      velg(kjede, false)
      rullNar(mal, plass)
    },
    [velg, rullNar],
  )

  const apneTil = useCallback(
    (element: Element, plass: Rulleplass = 'center') => {
      velg(skufferRundt(element), false)
      etterTegning(() => rull(element, plass))
    },
    [velg],
  )

  /**
   * Skuffen som står åpen fra start i hver søskenflokk som ingen har åpnet
   * eller lukket noe i ennå: den første som ber om det.
   */
  const standard = useMemo(() => {
    const forste = new Map<string, string>()
    for (const [nokkel, { forelder, apenFraStart }] of registrert) {
      if (apenFraStart && !forste.has(forelder)) forste.set(forelder, nokkel)
    }
    return forste
  }, [registrert])

  const verdi = useMemo<Seksjonsstyring>(() => {
    const tilstand = (sti: readonly string[], apenFraStart: boolean): Skufftilstand => {
      const nokkel = skuffnokkel(sti)
      const forelder = skuffnokkel(sti.slice(0, -1))
      const valg = valgt.get(forelder)
      if (valg) {
        if (valg.nokkel === nokkel) return { apen: true, animer: valg.animer }
        // Lukket brukeren skuffen, glir den igjen; lukkes den fordi et søsken åpnes, skjer det straks.
        return { apen: false, animer: valg.nokkel === null && valg.animer }
      }
      // Står åpen fra start, men ikke før den har vist at den er den første i flokken som ber om det.
      return { apen: apenFraStart && (standard.get(forelder) ?? nokkel) === nokkel, animer: false }
    }
    const sett = (sti: readonly string[], apen: boolean) => {
      const nokkel = skuffnokkel(sti)
      if (apen) {
        velg(kjedeFor(sti), true)
        rullNar(nokkel, 'start')
      } else if (tilstand(sti, registrert.get(nokkel)?.apenFraStart ?? false).apen) {
        setValgt((forrige) => new Map(forrige).set(skuffnokkel(sti.slice(0, -1)), { nokkel: null, animer: true }))
      }
    }
    return { tilstand, sett, registrer, apne, apneTil }
  }, [valgt, standard, registrert, velg, rullNar, registrer, apne, apneTil])

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

/**
 * Ruller elementet fram, straks for den som har bedt om mindre bevegelse.
 * Hvor langt under toppen av vinduet det legges, står i CSS
 * (`scroll-margin-top`, se `seksjoner.css`), så det havner under toppmenyen.
 */
function rull(element: Element | null, plass: Rulleplass) {
  if (element?.isConnected && plass) element.scrollIntoView({ behavior: rullefart(), block: plass })
}
