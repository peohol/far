import { useCallback } from 'react'

/**
 * Kopierer tekst til utklippstavlen.
 *
 * `navigator.clipboard` finnes bare i sikker kontekst (https eller
 * localhost). Kjører appen på et internt nett over http, faller vi tilbake til
 * et skjult tekstfelt og `document.execCommand`, som fortsatt virker i alle
 * aktuelle nettlesere.
 */
export function useClipboard() {
  return useCallback(async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // Faller gjennom til reserveløsningen under.
      }
    }
    return copyViaTextarea(text)
  }, [])
}

function copyViaTextarea(text: string): boolean {
  const felt = document.createElement('textarea')
  felt.value = text
  felt.setAttribute('readonly', '')
  felt.setAttribute('aria-hidden', 'true')
  felt.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  document.body.appendChild(felt)

  const forrigeFokus = document.activeElement as HTMLElement | null
  try {
    felt.select()
    felt.setSelectionRange(0, felt.value.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(felt)
    forrigeFokus?.focus?.()
  }
}
