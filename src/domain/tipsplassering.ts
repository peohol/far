/**
 * Hvor en tooltip skal stå i vinduet.
 *
 * Regnet ut i rene tall, uten DOM, slik at reglene kan prøves i test. Boblen
 * står helst midtstilt over teksten som utløste den. Er det ikke plass over,
 * faller den ned under. Blir den liggende utenfor en av kantene, skyves den
 * innover — og pilen blir stående igjen ved ankeret, så det fortsatt går fram
 * hva boblen hører til.
 *
 * Alle mål er i piksler, i vinduets eget koordinatsystem (samme som
 * `getBoundingClientRect`), siden boblen ligger fast til vinduet.
 */

/** Avstanden mellom ankeret og boblen. Pilen fyller mesteparten av den. */
export const TIPSLUFT = 10

/** Minste avstand fra boblen til vinduskanten. */
export const TIPSKANT = 8

/**
 * Bredden på pilen, målt som siden i kvadratet CSS-en roterer 45 grader.
 * Spissen stikker `TIPSPIL · √½ ≈ 8,5` piksler ut av boblen og må holde seg
 * innenfor `TIPSLUFT`, ellers legger pilen seg oppå teksten den peker på.
 */
export const TIPSPIL = 12

/** Hvor nær hjørnet pilen kan komme, så den ikke havner ute i rundingen. */
export const TIPSHJORNE = 20

/** Et rektangel i vinduet — ankeret tipset hører til. */
export interface Rute {
  venstre: number
  topp: number
  bredde: number
  hoyde: number
}

export interface Storrelse {
  bredde: number
  hoyde: number
}

export interface Plassering {
  /** Boblens venstrekant, målt fra venstre vinduskant. */
  venstre: number
  /** Boblens overkant, målt fra øvre vinduskant. */
  topp: number
  /** Hvilken side av ankeret boblen havnet på. */
  side: 'over' | 'under'
  /** Pilens midtpunkt, målt fra boblens venstrekant. */
  pil: number
}

/**
 * Så stor boblen har lov til å bli. Alt som er større enn dette ville stukket
 * ut av vinduet uansett hvor den plasseres, så boblen får denne grensen som
 * `max-width`/`max-height` og ruller heller innholdet sitt.
 */
export function maksTipsstorrelse(vindu: Storrelse): Storrelse {
  return {
    bredde: Math.max(0, vindu.bredde - 2 * TIPSKANT),
    hoyde: Math.max(0, vindu.hoyde - 2 * TIPSKANT),
  }
}

/**
 * Holder verdien innenfor et intervall. Er intervallet snudd — boblen er
 * større enn vinduet, noe `maksTipsstorrelse` normalt hindrer — vinner nedre
 * grense, så boblen legger seg mot øvre venstre kant i stedet for å krype ut
 * på motsatt side.
 */
function klem(verdi: number, minst: number, mest: number): number {
  return Math.min(Math.max(verdi, minst), Math.max(minst, mest))
}

export function plasserTips(anker: Rute, boble: Storrelse, vindu: Storrelse): Plassering {
  // Plassen som er igjen på hver side av ankeret når luften mot ankeret og
  // avstanden til vinduskanten er trukket fra.
  const romOver = anker.topp - TIPSLUFT - TIPSKANT
  const romUnder = vindu.hoyde - (anker.topp + anker.hoyde) - TIPSLUFT - TIPSKANT

  // Over er standard. Under brukes når boblen ikke får plass over — og når
  // den ikke får plass noen av stedene, den siden som har mest å gi.
  const passerOver = boble.hoyde <= romOver
  const passerUnder = boble.hoyde <= romUnder
  const side: 'over' | 'under' =
    passerOver || (!passerUnder && romOver >= romUnder) ? 'over' : 'under'

  const onsketTopp =
    side === 'over'
      ? anker.topp - TIPSLUFT - boble.hoyde
      : anker.topp + anker.hoyde + TIPSLUFT
  const topp = klem(onsketTopp, TIPSKANT, vindu.hoyde - boble.hoyde - TIPSKANT)

  const senter = anker.venstre + anker.bredde / 2
  const venstre = klem(senter - boble.bredde / 2, TIPSKANT, vindu.bredde - boble.bredde - TIPSKANT)

  // Pilen peker på ankeret, ikke på boblens midte: står boblen skjøvet inn fra
  // en kant, blir pilen igjen der teksten er. Den holdes samtidig unna
  // hjørnene, der rundingen ville klippet den.
  const hjorne = Math.min(TIPSHJORNE, boble.bredde / 2)
  const pil = klem(senter - venstre, hjorne, boble.bredde - hjorne)

  return { venstre, topp, side, pil }
}
