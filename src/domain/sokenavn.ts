/**
 * Navnenøkkelen: formen et stoffnavn, et alias eller en kode sammenlignes på
 * når søket skal se bort fra hvordan navnet er skrevet.
 *
 * Nøkkelen ser bort fra
 *
 * - store og små bokstaver og aksenter, og leser æ, ø og å som ae, o og a,
 * - greske bokstaver mot navnene deres: «Δ9-THC» er «delta-9-THC»,
 * - bindestrek, mellomrom og andre skilletegn: «THC-COOH», «THC COOH» og
 *   «THCCOOH» er det samme,
 * - de vanlige forskjellene mellom norsk og engelsk stavemåte: ph/f, th/t,
 *   ch/k, qu/kv, x/ks, c/k og en stum e til slutt i et ord, så «quetiapine»,
 *   «quetiapin» og «kvetiapin» gir den samme nøkkelen.
 *
 * Reglene gjelder begge sider likt, søket og navnet det sammenlignes med, så
 * de trenger ikke å gi riktig norsk stavemåte, bare den samme. At ingen to
 * stoffer får den samme nøkkelen, holder kontrollen av stoffregisteret
 * (`kontrollerStoffregister`).
 */

const GRESKE: Readonly<Record<string, string>> = {
  α: 'alfa',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ε: 'epsilon',
  κ: 'kappa',
  μ: 'my',
  ω: 'omega',
}

/** Stavemåtene som skrives om, i denne rekkefølgen. */
const STAVEMATER: readonly [RegExp, string][] = [
  [/ph/g, 'f'],
  [/th/g, 't'],
  [/ch/g, 'k'],
  [/qu/g, 'kv'],
  [/x/g, 'ks'],
  [/c/g, 'k'],
]

/** Kortere ord beholder e-en til slutt, så forkortelser som «EtOH» og «LEV» står som de er. */
const STUM_E_FRA = 4

function ord(del: string): string {
  let o = del
  for (const [monster, erstatning] of STAVEMATER) o = o.replace(monster, erstatning)
  return o.length >= STUM_E_FRA && o.endsWith('e') ? o.slice(0, -1) : o
}

/** Nøkkelen for et navn; tom når navnet ikke har bokstaver eller tall. */
export function navnenokkel(tekst: string): string {
  const liten = tekst.toLowerCase().replace(/[αβγδεκμω]/g, (g) => ` ${GRESKE[g]} `)
  const uten = liten
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return uten
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(ord)
    .join('')
}
