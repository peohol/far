/**
 * Fargekoding av søkealternativene.
 *
 * Første alternativ er alltid hsl(0 40% 70%). De øvrige fordeles jevnt rundt
 * fargesirkelen, slik at n alternativer får størst mulig avstand i hue og
 * dermed mest mulig fargemessig distinksjon.
 */
export const OPTION_SATURATION = 40
export const OPTION_LIGHTNESS = 70

export function optionHue(index: number, total: number): number {
  if (total <= 0) return 0
  return (index * 360) / total
}

export interface OptionColour {
  hue: number
  /** Full farge — brukes på tallmerket, som alltid har mørk tekst oppå. */
  solid: string
  /** Samme hue, men gjennomsiktig, til flate og kant på alternativet. */
  soft: string
  border: string
  /** Mørk variant av samme hue, til tekst på `solid`. */
  ink: string
}

export function optionColour(index: number, total: number): OptionColour {
  const hue = optionHue(index, total)
  const s = OPTION_SATURATION
  const l = OPTION_LIGHTNESS
  return {
    hue,
    solid: `hsl(${hue} ${s}% ${l}%)`,
    soft: `hsl(${hue} ${s}% ${l}% / var(--alt-flate-alfa))`,
    border: `hsl(${hue} ${s}% ${l}% / var(--alt-kant-alfa))`,
    ink: `hsl(${hue} ${Math.min(s + 25, 100)}% 14%)`,
  }
}

/** CSS-variabler som legges på hvert alternativ, slik at stilene bor i CSS. */
export function optionColourVars(index: number, total: number): Record<string, string> {
  const c = optionColour(index, total)
  return {
    '--alt-hue': String(c.hue),
    '--alt-solid': c.solid,
    '--alt-soft': c.soft,
    '--alt-kant': c.border,
    '--alt-ink': c.ink,
  }
}
