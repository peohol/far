import { useEffect, useRef, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { SortableBoard } from '@peohol/smett'
import '../styles/sortering.css'

/** En flytting brukeren har gjort ved å dra, med mus, finger eller tastatur. */
export interface Flytting {
  /** `data-dnd-id` på det som ble flyttet. */
  id: string
  /** `data-slag`: hva det er, som `kategori` eller `traad`. */
  slag: string
  /** `data-dnd-container` på lista det havnet i. */
  til: string
  indeks: number
}

/**
 * Det en liste med egne regler gjør rundt et drag, i tillegg til det
 * `useSortering` gjør for alle (se `docs/stoffregister.md`).
 */
export interface Dragveileder {
  /**
   * Før dnd-kit måler det som løftes — den eneste gangen det måles. Her kan
   * lista folde seg sammen, så det er kortere vei å dra. Lista holdes da så
   * høy som den var, og det som løftes, blir liggende under pekeren.
   */
  loft?(element: HTMLElement, brett: SortableBoard): void
  /** Hver gang pekeren flytter seg, og hver gang målet skifter. */
  underveis?(element: HTMLElement, brett: SortableBoard): void
  /**
   * Når draget er over, sluppet eller avbrutt, og dnd-kit har ryddet etter
   * seg. `liste` er lista det ble sluppet i (den det kom fra, når draget ble
   * avbrutt).
   */
  slipp?(element: HTMLElement, brett: SortableBoard, liste: HTMLElement | null): void
}

export interface Sorteringsvalg {
  /** Rullingen når man drar mot kanten, holdes inne i lista (standard). */
  rullInne?: boolean
  /**
   * Lista står loddrett, og det som dras, følger bare pekeren opp og ned
   * (standard). Ellers måles retningen i hver liste for seg, så et rutenett
   * kan sorteres, og det som dras, følger pekeren fritt.
   */
  loddrett?: boolean
  /** Hvor et drag begynner med mus og finger. Standard er håndtaket (`HANDTAK`). */
  handtak?: string
  veileder?: Dragveileder
}

/** Merket på det som kan dras, og listene det står i. */
const ELEMENT = '[data-dnd-id]'
const LISTE = '[data-dnd-container]'
/** Håndtaket en drag begynner fra med mus og finger. Tastaturet løfter hele raden. */
export const HANDTAK = '.draghandtak'

/**
 * Dra-og-slipp i lister, med Smett (`@peohol/smett`) over dnd-kit: loddrett,
 * innenfor en liste og mellom lister. Diskusjonsmenyen sorterer kategoriene og
 * trådene med den, og helsiden for stoffregisteret kategoriene og stoffene.
 *
 * Hvilke lister som tar imot hva, står i markeringen: `data-slag` på det som
 * dras og `data-tar` på lista. En liste uten `data-tar` tar ikke imot noe,
 * men det som står i den, kan dras ut — slik «Ukategoriserte» i
 * diskusjonsmenyen er.
 *
 * React eier rekkefølgen i DOM-en. Smett flytter elementene mens man drar, og
 * står igjen med den nye rekkefølgen når man slipper; før React tegner den
 * samme rekkefølgen fra tilstanden, legges elementene tilbake der de stod.
 * Ellers ville React og DOM-en vært uenige om hvor hvert element står.
 * Det skjer først når dnd-kit er helt ferdig med slippet, animasjonen med:
 * til da holder dnd-kit en plassholder ved siden av raden og setter raden inn
 * igjen der når animasjonen er over — også en rad React har tatt bort.
 *
 * Diskusjonsmenyen står fast over siden, så å rulle siden bak den flytter
 * ingenting i lista. Rullingen når man drar mot kanten, holdes derfor inne i
 * den (`rullInne`). En liste på selve siden lar siden rulle.
 *
 * Biblioteket hentes først når lista vises, så det ikke tynger appen ellers.
 * Kan det ikke tas i bruk (en nettleser uten det dnd-kit trenger), står lista
 * uten dra-og-slipp; knappene for å flytte virker uansett.
 */
export function useSortering(
  rot: RefObject<HTMLElement | null>,
  onFlytt: (flytting: Flytting) => void,
  navnPaaListe: (liste: string) => string,
  aktiv = true,
  { rullInne = true, loddrett = true, handtak = HANDTAK, veileder }: Sorteringsvalg = {},
): void {
  const siste = useRef({ onFlytt, navnPaaListe, veileder })
  siste.current = { onFlytt, navnPaaListe, veileder }

  useEffect(() => {
    const element = rot.current
    // Uten pekerhendelser (som i testmiljøet) er det ingenting å dra med.
    if (!aktiv || !element || typeof PointerEvent === 'undefined') return
    let brett: SortableBoard | null = null
    let ferdig = false
    let stopp: (() => void) | undefined

    void import('@peohol/smett')
      .then(({ SortableBoard, RestrictToVerticalAxis, Scroller, snapshotOrder, restoreOrder }) => {
        if (ferdig) return
        let rekkefolge: ReturnType<typeof snapshotOrder> | null = null
        const lister = () => element.querySelectorAll<HTMLElement>(LISTE)
        // Løses når dnd-kit har ryddet etter slippet, eller etter to sekunder uansett.
        const sluppet = () =>
          new Promise<void>((ferdigSluppet) => {
            const frist = performance.now() + 2000
            const sjekk = () => {
              if (!brett || brett.manager.dragOperation.status.idle || performance.now() > frist) ferdigSluppet()
              else requestAnimationFrame(sjekk)
            }
            sjekk()
          })
        brett = new SortableBoard({
          root: element,
          itemSelector: ELEMENT,
          containerSelector: LISTE,
          handleSelector: handtak,
          axis: loddrett ? 'vertical' : 'auto',
          // Det som løftes, holdes under den faste toppmenyen.
          safeInsets: () => ({ top: toppmenyensBunn(), right: 0, bottom: 0, left: 0 }),
          itemType: (el) => el.dataset.slag,
          containerAccept: (liste) => liste.dataset.tar?.split(' ').filter(Boolean) ?? [],
          describeItem: (el) => el.dataset.navn ?? '',
          phrases: {
            pickedUp: (navn, plass) => `Løftet ${navn}. ${plass}. Flytt med piltastene, slipp med mellomrom, avbryt med Escape.`,
            moving: (navn, plass) => `${navn}. ${plass}.`,
            dropped: (navn, plass) => `Sluppet ${navn}. ${plass}.`,
            moved: (navn, plass) => `Flyttet ${navn}. ${plass}.`,
            cancelled: (navn) => `Flyttingen av ${navn} er avbrutt.`,
            failed: (navn) => `Flyttingen mislyktes. ${navn} står der den stod.`,
            inContainer: (indeks, antall, liste) => `Plass ${indeks + 1} av ${antall} i ${siste.current.navnPaaListe(liste)}`,
            overZone: () => '',
            offBoard: () => 'Utenfor lista',
          },
          onCommit: async (resultat) => {
            await sluppet()
            if (ferdig) return
            const flyttet = element.querySelector<HTMLElement>(`[data-dnd-id="${CSS.escape(resultat.itemId)}"]`)
            // Tilbake til rekkefølgen React tegnet, og den nye tegnet fra
            // tilstanden i samme slag, så lista ikke blinker mellom dem.
            if (rekkefolge) restoreOrder(rekkefolge)
            rekkefolge = null
            if (resultat.from.containerId === resultat.to.containerId && resultat.from.index === resultat.to.index) return
            const flytting = { id: resultat.itemId, slag: flyttet?.dataset.slag ?? '', til: resultat.to.containerId, indeks: resultat.to.index }
            flushSync(() => siste.current.onFlytt(flytting))
          },
          onCancel: () => {
            rekkefolge = null
          },
        })
        // Tegnes bare loddrett. Hvor elementet havner, avgjøres fortsatt av pekeren.
        if (loddrett) brett.manager.registry.modifiers.register(RestrictToVerticalAxis.plugin, RestrictToVerticalAxis.options)
        if (rullInne) holdRullingenInne(brett.manager.registry.plugins.get(Scroller))
        const { monitor, dragOperation } = brett.manager
        const kilde = () => {
          const el = dragOperation.source?.element
          return el instanceof HTMLElement ? el : null
        }
        let vakt: (() => void) | null = null
        const underveis = () => {
          const el = kilde()
          if (brett && el && !ferdig) siste.current.veileder?.underveis?.(el, brett)
        }
        const stoppere = [
          monitor.addEventListener('beforedragstart', () => {
            const el = kilde()
            const loft = siste.current.veileder?.loft
            if (!brett || !el || !loft) return
            vakt = holdGrepet(element, el, () => loft(el, brett!))
          }),
          monitor.addEventListener('dragstart', () => {
            rekkefolge = snapshotOrder(lister())
          }),
          monitor.addEventListener('dragmove', underveis),
          monitor.addEventListener('dragover', underveis),
          monitor.addEventListener('dragend', () => {
            const el = kilde()
            // Smett har alt lagt det der slippet havnet; React legger det tilbake etterpå.
            const liste = el?.parentElement ?? null
            void sluppet().then(() => {
              vakt?.()
              vakt = null
              if (brett && el && !ferdig) siste.current.veileder?.slipp?.(el, brett, liste)
            })
          }),
        ]
        stopp = () => {
          for (const s of stoppere) s()
          vakt?.()
        }
      })
      .catch(() => undefined)

    return () => {
      ferdig = true
      stopp?.()
      brett?.destroy()
    }
  }, [rot, aktiv, rullInne, loddrett, handtak])
}

/**
 * Lar lista endre seg før det som løftes, blir målt (`endre`), uten at det
 * flytter seg under pekeren: dnd-kit tegner det fra der det lå da det ble
 * målt, ikke fra grepet. Folder lista over det seg sammen (eller vokser),
 * rulles siden like mye, så det står rundt pekeren; det som ikke kan rulles
 * opp, legges til som luft øverst i lista. Lista holdes like høy som før, så siden
 * ikke blir kortere mens man drar (da ville nettleseren flyttet rullingen,
 * og en berøring kunne blitt avbrutt). Gir funksjonen som gjør lista som før
 * igjen. Fra Huskis' «board-vakt».
 */
export function holdGrepet(liste: HTMLElement, element: HTMLElement, endre: () => void): () => void {
  const dokument = liste.ownerDocument.documentElement
  const luft = parseFloat(getComputedStyle(liste).paddingTop) || 0
  const hoyde = liste.getBoundingClientRect().height
  const topp = element.getBoundingClientRect().top
  // Nettleseren skal ikke flytte rullingen selv når innholdet folder seg sammen.
  dokument.style.overflowAnchor = 'none'
  endre()
  liste.style.minHeight = `${hoyde}px`
  const skift = topp - element.getBoundingClientRect().top
  if (Math.abs(skift) > 0.5) {
    const rulle = rullerForelder(liste)
    const for_ = rulle.scrollTop
    rulle.scrollTop = for_ - skift
    const rest = skift - (for_ - rulle.scrollTop)
    if (rest > 0.5) liste.style.paddingTop = `${luft + rest}px`
  }
  return () => {
    liste.style.minHeight = ''
    liste.style.paddingTop = ''
    dokument.style.overflowAnchor = ''
  }
}

/** Det nærmeste som ruller rundt elementet, eller siden selv. */
function rullerForelder(element: HTMLElement): Element {
  for (let el = element.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el
  }
  return element.ownerDocument.scrollingElement ?? element.ownerDocument.documentElement
}

/** Hvor langt ned i vinduet den faste toppmenyen når, eller 0 uten den. */
function toppmenyensBunn(): number {
  const meny = document.querySelector('[data-toppmeny]')
  return meny ? Math.max(0, meny.getBoundingClientRect().bottom) : 0
}

/**
 * dnd-kit ruller det som kan rulles under pekeren, og for noe som står fast
 * (som menyen) også siden selv. Her er det bare menyens egne flater som skal
 * rulle, så siden tas ut av det dnd-kit velger blant.
 */
export function holdRullingenInne(rulling: { getScrollableElements: () => Set<Element> | null } | undefined): void {
  if (!rulling) return
  const alle = rulling.getScrollableElements
  rulling.getScrollableElements = () => {
    const flater = alle()
    if (!flater) return flater
    return new Set([...flater].filter((flate) => flate !== (flate.ownerDocument.scrollingElement ?? flate.ownerDocument.documentElement)))
  }
}
