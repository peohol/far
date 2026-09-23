import { useEffect, type RefObject } from 'react'
import { fortolkningenErSkjult, lagLiggerOver } from './useKeyboard'

/**
 * Ruller et kort pent på plass: vertikalt midtstilt i vinduet, eller til
 * toppen når kortet er høyere enn vinduet og en midtstilling ville gjemt
 * begynnelsen. Gjør ingenting når det ikke finnes noe å rulle. Brukes av
 * hoppingen her, av kortklikkene og av modulene som ruller selv.
 */
export function rullTilKort(kort: Element | null | undefined, block: ScrollLogicalPosition = 'center') {
  if (!kort) return
  const forHoyt = block === 'center' && kort.getBoundingClientRect().height > window.innerHeight
  kort.scrollIntoView({ behavior: rullefart(), block: forHoyt ? 'start' : block })
}

/** Jevn rulling, med mindre brukeren har bedt om mindre bevegelse. */
export function rullefart(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

/**
 * Luft over det øverste elementet. Kopikvitteringen legger seg rett over
 * knappen den gjelder, og skal ikke bli liggende i skjermkanten.
 */
const LUFT = 64

/**
 * Henter elementene fram i bildet, i ett hopp og bare når det trengs: står de
 * allerede framme, ligger siden i ro.
 *
 * Flere elementer skal gjerne fram samtidig — knappen som ble brukt, som
 * kvitteringen festes til, og knappen som står for tur, som brukeren skal se
 * er klar. Å rulle til dem etter tur ville latt det siste hoppet skyve det
 * forrige ut av bildet igjen, så plasseringen regnes ut for hele følget under
 * ett: får alt plass, midtstilles det. Ellers legges det første elementet
 * øverst — det er det viktigste — og resten kommer så langt med som vinduet
 * rekker.
 *
 * Hoppet er med vilje umiddelbart og ikke jevnt. Kvitteringen festes til
 * knappen i vindukoordinater i det den vises, så en rulling som fortsatt glir
 * ville løsrevet blinket fra knappen det gjelder.
 */
export function hoppFram(...elementer: (Element | null | undefined)[]) {
  const med = elementer.filter((e): e is Element => Boolean(e))
  const forste = med[0]
  if (!forste) return

  const ruter = med.map((e) => e.getBoundingClientRect())
  const topp = Math.min(...ruter.map((r) => r.top))
  const bunn = Math.max(...ruter.map((r) => r.bottom))
  const vindu = window.innerHeight
  if (topp >= LUFT && bunn <= vindu) return

  const passer = bunn - topp + LUFT <= vindu
  const onsket = passer ? Math.max(LUFT, (vindu - (bunn - topp)) / 2) : LUFT
  rull(forste, (passer ? topp : forste.getBoundingClientRect().top) - onsket)
}

/**
 * Ruller flaten elementet ligger i. Det er vanligvis siden selv; en forelder
 * som ruller for seg — sikkerhetsventilen for svært lave vinduer — tas først.
 */
function rull(fra: Element, avstand: number) {
  for (let el = fra.parentElement; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
      el.scrollBy({ top: avstand, behavior: 'auto' })
      return
    }
  }
  window.scrollBy({ top: avstand, behavior: 'auto' })
}

/** Felt der piltastene trengs til sitt eget: tekst, tall, datoer, lister. */
function erIRedigerbartFelt(): boolean {
  const aktivt = document.activeElement
  if (!aktivt) return false
  return (
    aktivt.tagName === 'INPUT' ||
    aktivt.tagName === 'TEXTAREA' ||
    aktivt.tagName === 'SELECT' ||
    (aktivt as HTMLElement).isContentEditable
  )
}

/**
 * Diskrete hopp mellom kortene i en modul: piltastene opp/ned flytter ett
 * kort av gangen, og kortet man hopper til midtstilles i vinduet. De rører
 * ingenting så lenge fokus står i et felt som selv trenger dem — datofeltene
 * blar for eksempel i verdier med dem.
 *
 * Musehjulet ruller som vanlig. Det er den eneste måten å komme gjennom et
 * kort som er høyere enn vinduet på — en utfoldet forklaring, for eksempel —
 * og hopping ville låst den nederste teksten inne.
 *
 * Skrudd på per modul med `aktiv`, så tastene gjør det vanlige ellers i
 * appen. Kortene er elementene i `beholder` som passer `velger`, i
 * dokumentrekkefølge.
 */
export function useKortHopp(
  aktiv: boolean,
  beholder: RefObject<HTMLElement>,
  velger = '.kort',
) {
  useEffect(() => {
    if (!aktiv) return

    const kortene = () => Array.from(beholder.current?.querySelectorAll<HTMLElement>(velger) ?? [])

    /** Kortet nærmest midten av vinduet — det man «står på». */
    const naavaerende = (liste: HTMLElement[]) => {
      const midt = window.innerHeight / 2
      let beste = 0
      let minst = Infinity
      liste.forEach((kort, i) => {
        const rute = kort.getBoundingClientRect()
        const avstand = Math.abs(rute.top + rute.height / 2 - midt)
        if (avstand < minst) {
          minst = avstand
          beste = i
        }
      })
      return beste
    }

    const hopp = (retning: 1 | -1) => {
      const liste = kortene()
      if (liste.length === 0) return
      const neste = Math.min(liste.length - 1, Math.max(0, naavaerende(liste) + retning))
      rullTilKort(liste[neste])
    }

    const paaTast = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (lagLiggerOver() || fortolkningenErSkjult()) return
      if (erIRedigerbartFelt()) return
      event.preventDefault()
      hopp(event.key === 'ArrowDown' ? 1 : -1)
    }

    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [aktiv, beholder, velger])
}
