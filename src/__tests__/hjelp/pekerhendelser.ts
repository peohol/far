import { fireEvent, screen } from '@testing-library/react'

/** Bredden hvert valg på en trinnbryter får når testene måler den. */
const TRINNBREDDE = 100

/** jsdom har ikke pekerhendelser. Denne har det komponentene leser; kalles før testene. */
export function medPekerhendelser() {
  globalThis.PointerEvent ??= class extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  } as typeof PointerEvent
}

/**
 * Trykker på valget med merket `merke` på en trinnbryter, midt på det, slik en
 * finger gjør. Merket leses nøyaktig som det står, med harde mellomrom. jsdom
 * legger ikke ut sider, så sporet får en bredde her: {@link TRINNBREDDE} per valg.
 */
export function trykkPaaValg(merke: string) {
  const valget = screen.getByText(merke, { selector: '.trinnbryter__valg', normalizer: (tekst) => tekst })
  const spor = valget.closest<HTMLElement>('.trinnbryter__spor')
  if (!spor) throw new Error('Merket står ikke på en trinnbryter.')
  const valg = Array.from(spor.querySelectorAll('.trinnbryter__valg'))
  spor.getBoundingClientRect = () => ({ left: 0, width: TRINNBREDDE * valg.length }) as DOMRect
  const punkt = { clientX: (valg.indexOf(valget) + 0.5) * TRINNBREDDE, button: 0, pointerId: 1 }
  fireEvent.pointerDown(spor, punkt)
  fireEvent.pointerUp(spor, punkt)
}
