import { useEffect, type RefObject } from 'react'

/**
 * Gjør resten av appen `inert` mens `aktiv` er sann, så et element som dekker
 * hele vinduet — som diskusjonene som helside — er det eneste tastaturet og
 * skjermlesere når. Søsknene på veien fra elementet opp til appens rot blir
 * inerte, også de som kommer til underveis (en ny side når adressen byttes);
 * det som legges rett i `<body>` (tips, meldinger om en ny versjon), får være
 * i fred.
 *
 * Det som alt var inert, røres ikke, og slippes ikke etterpå.
 */
export function useRestenInert(element: RefObject<HTMLElement | null>, aktiv: boolean): void {
  useEffect(() => {
    const start = element.current
    if (!aktiv || !start) return
    const satt = new Set<Element>()
    const veien: Element[] = []
    for (let node: Element = start; node.parentElement && node.parentElement !== document.body; node = node.parentElement) {
      veien.push(node)
    }
    const merk = () => {
      for (const node of veien) {
        for (const sosken of node.parentElement?.children ?? []) {
          if (sosken === node || sosken.hasAttribute('inert')) continue
          sosken.setAttribute('inert', '')
          satt.add(sosken)
        }
      }
    }
    merk()
    const vakt = new MutationObserver(merk)
    for (const node of veien) vakt.observe(node.parentElement!, { childList: true })
    return () => {
      vakt.disconnect()
      satt.forEach((e) => e.removeAttribute('inert'))
    }
  }, [element, aktiv])
}
