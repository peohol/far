import { useEffect, useRef, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { SortableBoard } from '@peohol/smett'

/** En flytting brukeren har gjort ved å dra, med mus, finger eller tastatur. */
export interface Flytting {
  /** `data-dnd-id` på det som ble flyttet. */
  id: string
  /** `data-slag`: `kategori` eller `traad`. */
  slag: string
  /** `data-dnd-container` på lista det havnet i. */
  til: string
  indeks: number
}

/** Merket på det som kan dras: kategoriene og trådene, og listene de står i. */
const ELEMENT = '[data-dnd-id]'
const LISTE = '[data-dnd-container]'
/** Håndtaket en drag begynner fra med mus og finger. Tastaturet løfter hele raden. */
export const HANDTAK = '.draghandtak'

/**
 * Dra-og-slipp i diskusjonsmenyen, med Smett (`@peohol/smett`) over dnd-kit:
 * loddrett, for kategoriene og trådene, og for tråder mellom kategoriene.
 *
 * Hvilke lister som tar imot hva, står i markeringen: `data-slag` på det som
 * dras og `data-tar` på lista. En liste uten `data-tar` tar ikke imot noe,
 * men det som står i den, kan dras ut — slik «Ukategoriserte» er.
 *
 * React eier rekkefølgen i DOM-en. Smett flytter elementene mens man drar, og
 * står igjen med den nye rekkefølgen når man slipper; før React tegner den
 * samme rekkefølgen fra tilstanden, legges elementene tilbake der de stod.
 * Ellers ville React og DOM-en vært uenige om hvor hvert element står.
 * Det skjer først når dnd-kit er helt ferdig med slippet, animasjonen med:
 * til da holder dnd-kit en plassholder ved siden av raden og setter raden inn
 * igjen der når animasjonen er over — også en rad React har tatt bort.
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
): void {
  const siste = useRef({ onFlytt, navnPaaListe })
  siste.current = { onFlytt, navnPaaListe }

  useEffect(() => {
    const element = rot.current
    // Uten pekerhendelser (som i testmiljøet) er det ingenting å dra med.
    if (!aktiv || !element || typeof PointerEvent === 'undefined') return
    let brett: SortableBoard | null = null
    let ferdig = false
    let stopp: (() => void) | undefined

    void import('@peohol/smett')
      .then(({ SortableBoard, RestrictToVerticalAxis, snapshotOrder, restoreOrder }) => {
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
          handleSelector: HANDTAK,
          axis: 'vertical',
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
        brett.manager.registry.modifiers.register(RestrictToVerticalAxis.plugin, RestrictToVerticalAxis.options)
        stopp = brett.manager.monitor.addEventListener('dragstart', () => {
          rekkefolge = snapshotOrder(lister())
        })
      })
      .catch(() => undefined)

    return () => {
      ferdig = true
      stopp?.()
      brett?.destroy()
    }
  }, [rot, aktiv])
}
