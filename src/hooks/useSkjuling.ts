import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Hvor lenge skjulingen venter på at lukkingen skal gli ferdig, før den skjer likevel. */
const MAKS_GLIDETID = 450

/**
 * Innhold som glir opp og igjen: skuffene (`Seksjon`) og styrkene i
 * preparatvinduet. Kroppen er et rutenett med én rad som går mellom `0fr` og
 * `1fr` (`grid-template-rows` i CSS-en); denne kroken styrer skjulingen rundt.
 *
 * Innholdet skjules når kroppen lukkes — etter at lukkingen har glidd ferdig,
 * så innholdet ikke forsvinner før det rakk å gli sammen — og vises straks
 * kroppen åpnes. Mens kroppen glir, bærer den `data-glir`, og innholdet
 * klippes; ellers står det fritt, så fokusrammer og bobler ikke kuttes.
 * Skjult innhold står med `hidden="until-found"`, så nettleserens søk finner det.
 */
export function useSkjuling(
  kropp: RefObject<HTMLElement>,
  inner: RefObject<HTMLElement>,
  apen: boolean,
  animer = true,
) {
  // Bare et skifte glir; den første tegningen (også den doble i StrictMode) gjør ikke.
  const forrige = useRef(apen)
  useLayoutEffect(() => {
    const boks = kropp.current
    const el = inner.current
    if (!boks || !el) return
    const skiftet = forrige.current !== apen
    forrige.current = apen
    const glir = animer && skiftet && !redusertBevegelse()

    if (apen) el.removeAttribute('hidden')
    if (!glir) {
      delete boks.dataset.glir
      if (!apen) el.setAttribute('hidden', 'until-found')
      return
    }

    boks.dataset.glir = ''
    let ferdig = false
    const avslutt = () => {
      if (ferdig) return
      ferdig = true
      boks.removeEventListener('transitionend', paaSlutt)
      window.clearTimeout(frist)
      delete boks.dataset.glir
      if (!apen) el.setAttribute('hidden', 'until-found')
    }
    const paaSlutt = (event: TransitionEvent) => {
      if (event.target === boks && event.propertyName === 'grid-template-rows') avslutt()
    }
    boks.addEventListener('transitionend', paaSlutt)
    const frist = window.setTimeout(avslutt, MAKS_GLIDETID)
    // Snur kroppen før den er ferdig, overtar neste runde uten å skjule.
    return () => {
      ferdig = true
      boks.removeEventListener('transitionend', paaSlutt)
      window.clearTimeout(frist)
    }
  }, [kropp, inner, apen, animer])
}

export function redusertBevegelse(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
