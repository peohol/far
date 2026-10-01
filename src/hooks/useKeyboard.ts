import { useEffect, useRef } from 'react'
import { enterErLedig, feltetTarTegnene, mellomromErLedig, tastenHorerTilFokus, type Fokusert } from '../domain/tastatur'

export type KeyHandler = (event: KeyboardEvent) => void

/**
 * Sant når et modalt lag fanger tastaturet — endringsloggen, i dag.
 *
 * Skiller seg fra {@link lagLiggerOver} ved at sidemenyen ikke teller. Den er
 * ikke modal, og snarveiene som gjelder hele appen skal virke mens den står
 * åpen.
 */
export function modaltLagLiggerOver(): boolean {
  return document.querySelector('dialog[open]') !== null
}

/**
 * Sant når et lag ligger over appen — endringsloggen eller sidemenyen.
 *
 * Appens egne taster henger på vinduet og hører etter uansett hvor fokus står.
 * Uten denne vakten ville `Esc` både lukket laget og sendt appen et steg
 * tilbake, og talltastene valgt bånd i steget bak. Regelen står ett sted og
 * brukes av alle som lytter på vinduet.
 *
 * Endringsloggen er en `<dialog>` og kjennes på den. Sidemenyen er ikke en
 * dialog — den skal kunne stå åpen mens appen bak er synlig — og sier fra med
 * `data-lag` i stedet.
 */
export function lagLiggerOver(): boolean {
  return modaltLagLiggerOver() || document.querySelector('[data-lag]') !== null
}

/**
 * Merket det globale fagsøket bærer som `data-lag` mens fokus står i det.
 *
 * Fagsøket står i toppmenyen over fortolkningen, og det som skrives der, er
 * et søk: sifrene skal ikke velge et alternativ og `Escape` ikke gå et steg
 * tilbake i steget bak. Som laget over appen legger det derfor appens egne
 * taster i ro (se {@link lagLiggerOver}). At `Enter` ikke kopierer en
 * kommentar derfra, følger av den felles regelen for fokus utenfor
 * fortolkningen ({@link tastenGjelderFortolkningen}).
 */
export const FAGSOK_LAG = 'fagsok'

/** Sant når fokus står i det globale fagsøket (se {@link FAGSOK_LAG}). */
export function fokusIFagsok(): boolean {
  return document.activeElement?.closest(`[data-lag="${FAGSOK_LAG}"]`) != null
}

/**
 * Ctrl + tasten, eller Cmd + tasten på macOS: snarveiene som henter fram
 * søkefeltene — K for fagsøket og B for søket på siden. Et redigeringsfelt
 * (riktekst, der Ctrl + B er fet skrift) og et lag over appen går foran. Fra
 * fagsøket kan man likevel gå rett videre til søket på siden.
 */
export function erSokesnarvei(event: KeyboardEvent, tast: string): boolean {
  if (event.key.toLowerCase() !== tast || event.altKey || event.shiftKey) return false
  if (event.ctrlKey === event.metaKey) return false
  const aktivt = document.activeElement
  if (aktivt instanceof HTMLElement && aktivt.isContentEditable) return false
  return !lagLiggerOver() || fokusIFagsok()
}

/**
 * Merket fortolkningens flate bærer i `data-fortolkning`: `vist`, eller
 * `skjult` mens den står bak en stoffside eller søkesiden.
 */
export const VIST_FORTOLKNING = 'vist'
export const SKJULT_FORTOLKNING = 'skjult'

/**
 * Sant når tastetrykket er fortolkningens å svare på — den ene regelen alle
 * som lytter på vinduet på vegne av fortolkningen, spør.
 *
 * Fortolkningen blir stående montert når en stoffside åpnes, så det brukeren
 * har fylt inn, er der når hen kommer tilbake. Mens den står skjult, ligger
 * tastene dens i ro: `Enter` på stoffsiden skal ikke kopiere en kommentar
 * ingen ser.
 *
 * Mens den vises, er tastene dens når fokus står i fortolkningen, eller ingen
 * steder. Står fokus et annet sted på siden — i fagsøket, en diskusjonstråd,
 * en editor, toppmenyen — beholder elementet der de tastene det selv bruker
 * ({@link tastenHorerTilFokus}): `Enter` gir linjeskift i tekstfeltet og
 * trykker knappen i stedet for å kopiere en kommentar.
 *
 * Står en komponent fra fortolkningen alene, uten flaten rundt seg — som i en
 * test av ett steg — er alle tastene dens.
 */
export function tastenGjelderFortolkningen(event: KeyboardEvent): boolean {
  const flate = document.querySelector<HTMLElement>('[data-fortolkning]')
  if (!flate) return true
  if (flate.dataset.fortolkning === SKJULT_FORTOLKNING) return false
  const aktivt = document.activeElement
  if (!aktivt || aktivt === document.body || flate.contains(aktivt)) return true
  return !tastenHorerTilFokus(event.key, fokusertNa())
}

/**
 * Kobler fortolkningens tastatursnarveier til vinduet.
 *
 * Nøkkelen i kartet er `event.key`. Handlingen kjøres bare når ingen
 * modifikatortast holdes nede, slik at nettleserens egne snarveier
 * (Ctrl/Cmd-kombinasjoner) går uforstyrret gjennom. `preventDefault` er opp
 * til den enkelte handlingen.
 *
 * Kartet leses fra en ref, så lytteren settes opp én gang og overlever at
 * handlingene bygges på nytt ved hver rendring.
 */
export function useKeyboard(handlers: Record<string, KeyHandler | undefined>, enabled = true) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (lagLiggerOver() || !tastenGjelderFortolkningen(event)) return
      ref.current[event.key]?.(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

/**
 * Tastene som velger et alternativ i søket: 1–9 for de ni første og 0 for det
 * tiende. Analyttnavn og -koder inneholder ingen sifre, så det er trygt å la
 * sifrene velge i stedet for å skrives inn i søkefeltet.
 */
export function digitToIndex(key: string): number | null {
  if (!/^[0-9]$/.test(key)) return null
  return key === '0' ? 9 : Number(key) - 1
}

export function indexToDigit(index: number): string {
  return index === 9 ? '0' : String(index + 1)
}

/** Elementet som har fokus, lest slik reglene i `domain/tastatur.ts` vil ha det. */
export function fokusertNa(): Fokusert | null {
  const element = document.activeElement
  if (!element) return null
  return {
    tag: element.tagName,
    type: element instanceof HTMLInputElement ? element.type : undefined,
    tallfelt: element instanceof HTMLElement && element.dataset.tallfelt !== undefined,
    redigerbart: element instanceof HTMLElement && element.isContentEditable,
  }
}

/**
 * Sant når tastetrykket er en bekreftelse: `Enter`, eller mellomrom der
 * mellomrom ikke alt har en jobb der fokus står. `Enter` på en lenke følger
 * lenken, og mens fortolkningen står skjult eller fokus står et annet sted på
 * siden, bekrefter ingen av dem noe ({@link tastenGjelderFortolkningen}).
 *
 * Dette er den ene regelen for «gjør det steget skal gjøre», og alle stegene
 * og modulene bruker den, slik at de to tastene betyr det samme overalt.
 * Modifikatorkombinasjoner er nettleserens egne og går uforstyrret gjennom.
 */
export function erBekreftelse(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if (!tastenGjelderFortolkningen(event)) return false
  if (event.key === 'Enter') return enterErLedig(fokusertNa())
  return event.key === ' ' && mellomromErLedig(fokusertNa())
}

/** Sant når det som tastes hører hjemme i feltet som står fokusert. */
export function skrivesIFelt(): boolean {
  return feltetTarTegnene(fokusertNa())
}
