import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { rullefart } from '../../hooks/useKortHopp'
import { MAKS_GLIDETID } from '../../hooks/useSkjuling'

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

/**
 * Hendelsen `apneTil` sender fra elementet den skal vise, før skuffene rundt
 * åpnes. Den bobler, så en visning inne i et detaljkort som selv skjuler noe
 * — som styrkekortene i «Preparater» — kan åpne det elementet står i. Det er
 * ikke et tredje nivå med skuffer; visningen styrer seg selv.
 */
export const VIS_HENDELSE = 'ousfar:vis'

/** Attributtet elementet med skuffens innhold bærer, så høyden den får når den er åpen, kan måles. */
export const INNHOLDSATTRIBUTT = 'data-skuffinnhold'

/** Forelderen til seksjonene på siden. Ingen skuff har en tom nøkkel. */
const ROT = ''

export interface Skufftilstand {
  apen: boolean
  /** Usann når skuffen skal skifte uten å gli, f.eks. når søket åpner den. */
  animer: boolean
}

/** Hvor elementet legges i vinduet, eller `false` for å la vinduet ligge. */
export type Rulleplass = ScrollLogicalPosition | false

/**
 * Plassen en skuff brukeren har åpnet, rulles til: midt i det synlige feltet
 * når den får plass der, ellers med toppen rett under toppmenyen (se `rullTilpasset`).
 */
const TILPASSET = 'tilpasset'
type Rullemal = Rulleplass | typeof TILPASSET

export interface Seksjonsstyring {
  /** Tilstanden til skuffen stien peker på. */
  tilstand(sti: readonly string[], apenFraStart: boolean): Skufftilstand
  /**
   * Brukeren åpner eller lukker skuffen. Åpnes den, lukkes søsknene straks,
   * skuffen glir opp, og siden ruller den fram når den er tegnet: midtstilt
   * når den får plass i det synlige feltet, ellers med toppen øverst.
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
  /**
   * Et sted på siden som alltid står fram og ikke er en skuff, som «Viktige
   * data». En direktelenke dit ruller dit uten å åpne eller lukke noe. Gir
   * tilbake avregistreringen. Se `useFastSted`.
   */
  fastSted(sti: readonly string[], element: Element): () => void
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
  const venter = useRef<{ nokkel: string; plass: Rullemal } | null>(null)
  /** Stedene som alltid står fram, med elementet de står i. */
  const faste = useRef(new Map<string, Element>())

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

  const rullNar = useCallback((nokkel: string, plass: Rullemal) => {
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

  const fastSted = useCallback((sti: readonly string[], element: Element) => {
    const nokkel = skuffnokkel(sti)
    faste.current.set(nokkel, element)
    if (venter.current?.nokkel === nokkel) {
      const { plass } = venter.current
      venter.current = null
      etterTegning(() => rull(element, plass))
    }
    return () => {
      if (faste.current.get(nokkel) === element) faste.current.delete(nokkel)
    }
  }, [])

  const apne = useCallback(
    (sti: readonly string[], plass: Rulleplass = 'start') => {
      const kjede = kjedeFor(sti)
      const mal = kjede[kjede.length - 1]
      if (!mal) return
      const fast = faste.current.get(mal)
      if (fast) return etterTegning(() => rull(fast, plass))
      velg(kjede, false)
      rullNar(mal, plass)
    },
    [velg, rullNar],
  )

  const apneTil = useCallback(
    (element: Element, plass: Rulleplass = 'center') => {
      element.dispatchEvent(new Event(VIS_HENDELSE, { bubbles: true }))
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
        rullNar(nokkel, TILPASSET)
      } else if (tilstand(sti, registrert.get(nokkel)?.apenFraStart ?? false).apen) {
        setValgt((forrige) => new Map(forrige).set(skuffnokkel(sti.slice(0, -1)), { nokkel: null, animer: true }))
      }
    }
    return { tilstand, sett, registrer, apne, apneTil, fastSted }
  }, [valgt, standard, registrert, velg, rullNar, registrer, apne, apneTil, fastSted])

  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

/**
 * Melder elementet inn som et sted som alltid står fram (se
 * `Seksjonsstyring.fastSted`), så en direktelenke til `id` ruller dit — også
 * når lenken ble fulgt før innholdet var hentet. Gjør ingenting utenfor en
 * `SeksjonsstyringKilde`.
 */
export function useFastSted(id: string, element: RefObject<Element>) {
  const fastSted = useSeksjonsstyring()?.fastSted
  useEffect(() => {
    const el = element.current
    if (el && fastSted) return fastSted([id], el)
  }, [id, element, fastSted])
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
function rull(element: Element | null, plass: Rullemal) {
  if (!element?.isConnected || !plass) return
  if (plass === TILPASSET) rullTilpasset(element)
  else element.scrollIntoView({ behavior: rullefart(), block: plass })
}

/**
 * Ruller en skuff brukeren nettopp har åpnet, fram. Det synlige feltet er
 * vinduet minus toppmenyen over og luften under (skuffens `scroll-margin`,
 * se `seksjoner.css`).
 *
 * - Får skuffen plass i feltet når den er åpen, midtstilles den i det.
 * - Er den høyere, legges toppen rett under toppmenyen.
 *
 * Siden begynner å rulle straks, etter høyden skuffen er ventet å få. Når
 * den har glidd ferdig og høyden er den virkelige — og siden er lang nok til
 * å rulle helt fram — justeres det til riktig sted, med mindre brukeren
 * alt har begynt å rulle selv.
 */
function rullTilpasset(skuff: Element) {
  window.scrollTo({ top: tilpassetPlass(skuff), behavior: rullefart() })
  const brukeren = folgBrukeren()
  etterGlidning(skuff, () => {
    if (brukeren.harRullet() || !skuff.isConnected) return
    window.scrollTo({ top: tilpassetPlass(skuff), behavior: rullefart() })
  })
}

/** Hendelsene som viser at brukeren ruller eller gjør noe annet selv. */
const EGNE_HENDELSER = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

/** Følger med på om brukeren tar over rullingen, til `harRullet` spørres. */
function folgBrukeren() {
  let rullet = false
  const merk = () => {
    rullet = true
  }
  for (const h of EGNE_HENDELSER) window.addEventListener(h, merk, { capture: true, passive: true })
  return {
    harRullet() {
      for (const h of EGNE_HENDELSER) window.removeEventListener(h, merk, { capture: true })
      return rullet
    },
  }
}

/** Hvor langt ned siden skal rulles for å vise skuffen slik `rullTilpasset` beskriver. */
function tilpassetPlass(skuff: Element): number {
  const { top, height } = skuff.getBoundingClientRect()
  const stil = window.getComputedStyle(skuff)
  const over = parseFloat(stil.scrollMarginTop) || 0
  const under = parseFloat(stil.scrollMarginBottom) || 0
  const felt = window.innerHeight - over - under
  const hoyde = endeligHoyde(skuff, height)
  const luft = hoyde < felt ? (felt - hoyde) / 2 : 0
  return Math.max(0, window.scrollY + top - over - luft)
}

/** Innholdet til skuffen selv, ikke til et detaljkort i den. */
function innholdI(skuff: Element): Element | undefined {
  return [...skuff.querySelectorAll(`[${INNHOLDSATTRIBUTT}]`)].find(
    (el) => el.closest(`[${SKUFFATTRIBUTT}]`) === skuff,
  )
}

/**
 * Høyden skuffen er ventet å få når den har glidd ferdig: høyden nå, med
 * innholdet i full høyde i stedet for så langt det har glidd fram. Det som
 * ellers glir samtidig, som luften under en åpnet skuff, er ikke regnet med.
 */
function endeligHoyde(skuff: Element, naa: number): number {
  const innhold = innholdI(skuff)
  return innhold ? naa - innhold.getBoundingClientRect().height + innhold.scrollHeight : naa
}

/** Kjører `gjor` når skuffen har glidd ferdig, eller når den burde ha gjort det. */
function etterGlidning(skuff: Element, gjor: () => void) {
  const kropp = innholdI(skuff)?.parentElement
  let ferdig = false
  const slutt = (event?: Event) => {
    if (ferdig || (event && event.target !== kropp)) return
    ferdig = true
    kropp?.removeEventListener('transitionend', slutt)
    window.clearTimeout(frist)
    gjor()
  }
  kropp?.addEventListener('transitionend', slutt)
  const frist = window.setTimeout(slutt, MAKS_GLIDETID)
}
