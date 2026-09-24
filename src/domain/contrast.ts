/**
 * Kontrastberegning etter WCAG 2.1.
 *
 * Brukes av testene til å måle fargepaletten, slik at et endret token ikke
 * kan senke kontrasten under kravet uten at det slår ut.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Tolker «#0e6b6b» (også kortformen «#fff»). */
export function parseHex(css: string): Rgb {
  const m = css.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (!m?.[1]) throw new Error(`Ikke en hex-farge: ${css}`)
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  return { r, g, b }
}

/** Tolker en farge skrevet som hex eller hsl — de to formene tokenene bruker. */
export function parseFarge(css: string): Rgb {
  return css.trim().startsWith('#') ? parseHex(css) : parseHsl(css)
}

/** Tolker «hsl(214 82% 38%)» og «hsl(0 40% 70%)». */
export function parseHsl(css: string): Rgb {
  const m = css.match(/hsl\(\s*([\d.]+)\s*,?\s*([\d.]+)%\s*,?\s*([\d.]+)%/i)
  if (!m || !m[1] || !m[2] || !m[3]) throw new Error(`Ikke en hsl-farge: ${css}`)
  return hslToRgb(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100)
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r1, g1, b1] = segment(hp, c, x)
  const m = l - c / 2
  return { r: r1 + m, g: g1 + m, b: b1 + m }
}

function segment(hp: number, c: number, x: number): [number, number, number] {
  if (hp < 1) return [c, x, 0]
  if (hp < 2) return [x, c, 0]
  if (hp < 3) return [0, c, x]
  if (hp < 4) return [0, x, c]
  if (hp < 5) return [x, 0, c]
  return [c, 0, x]
}

function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Kontrastforhold mellom to farger, fra 1 (likt) til 21 (svart mot hvitt). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseFarge(a))
  const lb = relativeLuminance(parseFarge(b))
  const [lys, moerk] = la > lb ? [la, lb] : [lb, la]
  return (lys + 0.05) / (moerk + 0.05)
}
