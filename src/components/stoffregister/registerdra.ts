/**
 * Reglene for dra-og-slipp i redigeringen av stoffregisteret
 * (`Redigeringsbrett`), lagt på det `useSortering` gjør for alle lister. De er
 * tatt fra Huskis (`docs/drag-and-drop.md` der) og står beskrevet i
 * `docs/stoffregister.md`:
 *
 * - **Det som dras, er kompakt, og det andre folder seg sammen.** Drar man en
 *   kategori, står bare overskriftene igjen; drar man en underkategori, står
 *   kategoriene og underkategoriene igjen uten stoffene. Det skjer før det
 *   som løftes, blir målt, og det blir liggende under pekeren (`holdGrepet`).
 * - **En lukket kategori åpnes for en titt** når man holder et stoff eller en
 *   underkategori over den en stund, så man ser hvor det havner. Den lukkes
 *   igjen når man drar videre, og blir stående åpen når man slipper i den.
 * - **Plassholderen står der stoffet havner:** stoffene står alltid
 *   alfabetisk, så plassholderen legges på den alfabetiske plassen i lista
 *   pekeren er over, ikke der pekeren er.
 * - **Med tastaturet hopper et stoff fra liste til liste:** innad i en
 *   alfabetisk liste er det ingen annen plass å flytte det til, så hvert
 *   piltrykk tar det til den neste (ned/høyre) eller forrige (opp/venstre)
 *   lista som vises.
 */
import type { SortableBoard } from '@peohol/smett'
import { paaNavn } from '../../domain/stoffregister'
import type { Dragveileder } from '../../hooks/useSortering'

/** Lista med kategoriene øverst. */
export const KATEGORIER = 'kategorier'
/** Lista med underkategoriene i en kategori: `under:<ID>`. */
export const UNDER = 'under:'
/** Lista med stoffene i en kategori eller underkategori: `stoffer:<ID>`. */
export const STOFFER = 'stoffer:'
/** Hvor et drag begynner: overskriften på en kategori, eller hele stoffet. */
export const DRA = '[data-dra]'
/** En liste der det som står, står alfabetisk. */
const ALFABETISK = '[data-alfabetisk]'
/** En kategori eller underkategori som er lukket i redigeringen. */
const LUKKET = '[data-lukket]'
/** Hvor lenge et stoff må holdes over en lukket kategori før den åpnes (Huskis' `PEEK_MS`). */
export const KIKKETID = 200

/**
 * Hva som dras, og dermed hva som folder seg sammen (`data-drar` på brettet,
 * se `stoffregister.css`).
 */
export type Dragmodus = 'kategori' | 'underkategori' | 'stoff'

export function dragmodus(element: HTMLElement): Dragmodus {
  if (element.dataset.slag === 'stoff') return 'stoff'
  return element.parentElement?.dataset.dndContainer === KATEGORIER ? 'kategori' : 'underkategori'
}

/** Det som står i lista og kan dras, uten det som dras og plassholderen dnd-kit lar stå. */
function sosken(liste: HTMLElement, element: HTMLElement): HTMLElement[] {
  return [...liste.children].filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el !== element && el.hasAttribute('data-dnd-id') && !el.hasAttribute('data-dnd-placeholder'),
  )
}

/** Legger elementet på den alfabetiske plassen i lista. */
function settInnAlfabetisk(liste: HTMLElement, element: HTMLElement): void {
  const naboer = sosken(liste, element)
  liste.insertBefore(element, naboer[alfabetiskPlass(element.dataset.navn ?? '', naboer.map((n) => n.dataset.navn ?? ''))] ?? null)
}

/**
 * Hvor et stoff med navnet `navn` står blant `naboer` (navnene, alfabetisk):
 * indeksen til det første det skal stå foran, eller lengden når det står
 * sist.
 */
export function alfabetiskPlass(navn: string, naboer: readonly string[]): number {
  const plass = naboer.findIndex((nabo) => paaNavn({ navn }, { navn: nabo }) < 0)
  return plass === -1 ? naboer.length : plass
}

/**
 * Legger stoffet på den alfabetiske plassen i lista det er på vei inn i: den
 * pekeren er over, eller den dnd-kit har lagt det i. Plassholderen følger
 * stoffet. Gir om noe ble flyttet.
 */
export function plasserAlfabetisk(element: HTMLElement, brett: SortableBoard): boolean {
  const mal = brett.dropTarget
  const liste = mal?.kind === 'container' && mal.element.matches(ALFABETISK) ? mal.element : element.parentElement
  if (!liste?.matches(ALFABETISK)) return false
  const naboer = sosken(liste, element)
  const foran = naboer[alfabetiskPlass(element.dataset.navn ?? '', naboer.map((n) => n.dataset.navn ?? ''))] ?? null
  if (element.parentElement === liste && nesteSosken(element) === foran) return false
  liste.insertBefore(element, foran)
  brett.sync()
  return true
}

/** Hvilken vei et piltrykk tar et stoff: til den neste eller den forrige lista. */
const PILRETNING: Record<string, 1 | -1> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

/**
 * Med tastaturet: tar stoffet fra lista `fra` til den neste (`retning` 1)
 * eller forrige (-1) lista som vises, på sin alfabetiske plass — uansett hvor
 * dnd-kit la det. Står det i den første eller siste, blir det der. Gir lista
 * det står i.
 */
export function hoppAlfabetisk(element: HTMLElement, brett: SortableBoard, rot: HTMLElement, fra: HTMLElement, retning: 1 | -1): HTMLElement {
  const lister = [...rot.querySelectorAll<HTMLElement>(ALFABETISK)].filter((l) => l === fra || l.getClientRects().length > 0)
  const mal = lister[lister.indexOf(fra) + retning] ?? fra
  settInnAlfabetisk(mal, element)
  brett.sync()
  return mal
}

/** Om draget ble begynt med tastaturet (som i Smett: alt som ikke er en peker). */
function erTastatur(brett: SortableBoard): boolean {
  const start = brett.manager.dragOperation.activatorEvent
  return !(typeof PointerEvent !== 'undefined' && start instanceof PointerEvent)
}

/** Det neste som kan dras, etter elementet i samme liste. */
function nesteSosken(element: HTMLElement): Element | null {
  let neste = element.nextElementSibling
  while (neste && (!neste.hasAttribute('data-dnd-id') || neste.hasAttribute('data-dnd-placeholder'))) {
    neste = neste.nextElementSibling
  }
  return neste
}

/**
 * Reglene for brettet `rot`. `apne` åpner en kategori for godt: en som var
 * åpnet for en titt, og som noe ble sluppet i.
 */
export function registerveileder(rot: () => HTMLElement | null, apne: (kategori: string) => void): Dragveileder {
  let kandidat: HTMLElement | null = null
  /** Et stoff som dras med tastaturet: lista det står i, og hvilken vei siste piltrykk gikk. */
  let forrigeListe: HTMLElement | null = null
  let retning: 1 | -1 | null = null
  let tastaturramme = 0
  const lyttPaaPil = (e: KeyboardEvent) => {
    retning = PILRETNING[e.key] ?? retning
  }
  let tidtaker: ReturnType<typeof setTimeout> | undefined
  const kikket = new Set<HTMLElement>()

  const glemKandidat = () => {
    clearTimeout(tidtaker)
    kandidat = null
  }
  const lukkTitt = (kategori: HTMLElement) => {
    delete kategori.dataset.kikk
    kikket.delete(kategori)
  }

  /**
   * Den innerste lukkede kategorien under pekeren som det som dras, kan
   * slippes i: ikke det selv eller det som står rundt det, og bare en
   * kategori øverst når det er en underkategori.
   */
  const lukketUnder = (element: HTMLElement, punkt: { x: number; y: number }): HTMLElement | null => {
    const bareOverst = dragmodus(element) === 'underkategori'
    let funnet: HTMLElement | null = null
    for (const kategori of rot()?.querySelectorAll<HTMLElement>(`${LUKKET}:not([data-kikk])`) ?? []) {
      if (kategori === element || kategori.contains(element) || kategori.hasAttribute('data-dnd-placeholder')) continue
      if (bareOverst && kategori.parentElement?.dataset.dndContainer !== KATEGORIER) continue
      const r = kategori.getBoundingClientRect()
      if (punkt.x >= r.left && punkt.x <= r.right && punkt.y >= r.top && punkt.y <= r.bottom) funnet = kategori
    }
    return funnet
  }

  return {
    loft(element, brett) {
      const rotelement = rot()
      if (rotelement) rotelement.dataset.drar = dragmodus(element)
      forrigeListe = element.parentElement
      retning = null
      if (dragmodus(element) === 'stoff' && erTastatur(brett)) document.addEventListener('keydown', lyttPaaPil, true)
    },

    underveis(element, brett) {
      const modus = dragmodus(element)
      const tastatur = erTastatur(brett)
      if (modus === 'stoff') {
        if (!tastatur) plasserAlfabetisk(element, brett)
        else {
          // dnd-kit flytter stoffet først etter denne hendelsen, så det legges der piltrykket sier etterpå.
          cancelAnimationFrame(tastaturramme)
          tastaturramme = requestAnimationFrame(() => {
            const rotelement = rot()
            if (!retning || !forrigeListe || !rotelement || !element.isConnected) return
            forrigeListe = hoppAlfabetisk(element, brett, rotelement, forrigeListe, retning)
            retning = null
          })
        }
      }
      if (modus === 'kategori' || tastatur) return
      const punkt = brett.manager.dragOperation.position.current
      // En titt som pekeren har forlatt, lukkes igjen — med mindre det som dras, står i den nå.
      let lukket = false
      for (const kategori of kikket) {
        const r = kategori.getBoundingClientRect()
        const inne = punkt.x >= r.left && punkt.x <= r.right && punkt.y >= r.top && punkt.y <= r.bottom
        if (!inne && !kategori.contains(element)) {
          lukkTitt(kategori)
          lukket = true
        }
      }
      if (lukket) brett.sync()
      const under = lukketUnder(element, punkt)
      if (under === kandidat) return
      glemKandidat()
      if (!under) return
      kandidat = under
      tidtaker = setTimeout(() => {
        if (kandidat !== under || !under.isConnected) return
        under.dataset.kikk = ''
        kikket.add(under)
        kandidat = null
        brett.sync()
      }, KIKKETID)
    },

    slipp(_element, _brett, liste) {
      glemKandidat()
      cancelAnimationFrame(tastaturramme)
      document.removeEventListener('keydown', lyttPaaPil, true)
      const brett = rot()
      if (brett) delete brett.dataset.drar
      for (const kategori of [...kikket]) {
        const id = kategori.dataset.kategori
        if (liste && kategori.contains(liste) && id) apne(id)
        // Tittens egen åpning tas bort først når React har åpnet kategorien for godt.
        requestAnimationFrame(() => lukkTitt(kategori))
      }
    },
  }
}
