/**
 * Preferanser som enten står fast eller følger systemet — nettleseren og
 * operativsystemet: temaet og «Reduser bevegelse». Hver beskrives én gang
 * her, og samme beskrivelse brukes av skriptet som setter dem før første
 * maling (`vite.config.ts`), av `useSystemvalg` og av `useKontovalg`.
 *
 * Valget som lagres, kan være `system`. Det som står på `<html>` (`data-*`)
 * og som CSS-en leser, er alltid den virkelige verdien.
 */

export const SYSTEM = 'system'

/** Det brukeren har valgt: en fast verdi, eller å følge systemet. */
export type Valg<V extends string> = V | typeof SYSTEM

/** Et valg slik appen holder det, til en bryter som skal vise og endre det. */
export interface Valgstyring<V extends string> {
  valg: Valg<V>
  velg: (valg: Valg<V>) => void
}

export interface Systemvalg<V extends string> {
  /** Navnet på `data-*`-attributtet på `<html>`, med den virkelige verdien. */
  attributt: string
  /** Nøkkelen i nettleserens minne, så valget gjelder fra første bilde. */
  lagring: string
  /** Nøkkelen i brukerinnstillingene, så valget følger kontoen. */
  konto: string
  /** Mediespørringen systemet svarer på. */
  sporring: string
  /** Verdien når spørringen slår til … */
  naarSann: V
  /** … og når den ikke gjør det. */
  ellers: V
  /** Valget når ingenting er lagret. */
  standard: Valg<V>
}

export type Tema = 'lyst' | 'moerkt'
export type Bevegelse = 'redusert' | 'full'

export const TEMA: Systemvalg<Tema> = {
  attributt: 'tema',
  lagring: 'far:tema',
  konto: 'tema',
  sporring: '(prefers-color-scheme: dark)',
  naarSann: 'moerkt',
  ellers: 'lyst',
  standard: SYSTEM,
}

/** Gjelder bare ikonanimasjonene (`ikon.css`); rulling og kort følger systemet som før. */
export const BEVEGELSE: Systemvalg<Bevegelse> = {
  attributt: 'bevegelse',
  lagring: 'far:bevegelse',
  konto: 'bevegelse',
  sporring: '(prefers-reduced-motion: reduce)',
  naarSann: 'redusert',
  ellers: 'full',
  standard: SYSTEM,
}

export const SYSTEMVALG = [TEMA, BEVEGELSE] as const

/** Et lagret valg, eller `null` når verdien mangler eller er ugyldig. */
export function lesValg<V extends string>(def: Systemvalg<V>, verdi: unknown): Valg<V> | null {
  return verdi === def.naarSann || verdi === def.ellers || verdi === SYSTEM ? (verdi as Valg<V>) : null
}

/** Verdien som gjelder: det faste valget, ellers det systemet svarer. */
export function virkeligVerdi<V extends string>(def: Systemvalg<V>, valg: Valg<V>, treff: boolean): V {
  if (valg !== SYSTEM) return valg as V
  return treff ? def.naarSann : def.ellers
}

/**
 * Setter de virkelige verdiene på `<html>` ut fra det nettleseren husker.
 * Kjøres som tekst i `<head>` før noe tegnes, så siden aldri blinker i feil
 * tema. Den må derfor klare seg selv: ingen import, ingen hjelpere. Samme
 * regler som `lesValg` og `virkeligVerdi`; testene holder dem like.
 */
export function settSystemvalg(definisjoner: readonly Systemvalg<string>[]): void {
  for (const d of definisjoner) {
    let valg: string | null = null
    try {
      valg = localStorage.getItem(d.lagring)
    } catch {
      // Privat nettlesermodus e.l.: standardvalget gjelder.
    }
    if (valg !== d.naarSann && valg !== d.ellers && valg !== 'system') valg = d.standard
    if (valg === 'system') {
      let treff = false
      try {
        treff = matchMedia(d.sporring).matches
      } catch {
        // Uten svar fra systemet gjelder `ellers`.
      }
      valg = treff ? d.naarSann : d.ellers
    }
    document.documentElement.dataset[d.attributt] = valg
  }
}

/** Skriptet `vite.config.ts` legger i `<head>`. */
export function systemvalgskript(): string {
  return `(${settSystemvalg.toString()})(${JSON.stringify(SYSTEMVALG)})`
}
