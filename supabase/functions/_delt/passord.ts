/**
 * Passordreglene i OUSFAR, og det midlertidige passordet en ny bruker får.
 *
 * Delt mellom appen og Edge-funksjonene, slik at feltet i nettleseren og
 * kontrollen på serveren krever nøyaktig det samme. Selve genereringen skjer
 * bare på serveren; appen bruker modulen til validering og testene til å
 * kontrollere at passordene faktisk blir sterke.
 */

/**
 * Korteste passord en bruker kan velge.
 *
 * Følger passordpolicyen i Supabase-prosjektet. Skrus den opp der, skal tallet
 * her opp samtidig — ellers sier feltet i appen noe annet enn serveren gjør.
 */
export const PASSORD_MINST = 6

/** Lengden på et midlertidig passord. */
export const MIDLERTIDIG_PASSORD_LENGDE = 16

/**
 * Tegnene et midlertidig passord bygges av.
 *
 * Passordet skal leses opp eller skrives ned én gang, og deretter tastes inn
 * av noen andre. Tegn som lett forveksles visuelt er derfor tatt ut: store
 * `I` og `O`, liten `l`, og tallene `0` og `1`. Det står igjen 57 tegn, som på
 * seksten plasser gir godt over 90 bit entropi — langt mer enn nok.
 */
const SMAA = 'abcdefghijkmnopqrstuvwxyz'
const STORE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const TALL = '23456789'
const ALLE = SMAA + STORE + TALL

/** Feilen med passordet, i vanlig språk — eller `null` når det holder mål. */
export function passordFeil(passord: string): string | null {
  if (passord === '') return 'Skriv inn et passord.'
  if (passord.length < PASSORD_MINST) {
    return `Passordet må ha minst ${PASSORD_MINST} tegn.`
  }
  return null
}

/**
 * Et tilfeldig heltall under `antall`, trukket fra kildens kryptografisk
 * sikre tilfeldighet.
 *
 * Byte-verdier som ikke går opp i `antall` forkastes i stedet for å tas modulo,
 * slik at alle tegn er like sannsynlige. Uten det ville de første tegnene i
 * tegnsettet blitt trukket litt oftere enn de siste.
 */
function tilfeldigTall(antall: number): number {
  const grense = Math.floor(256 / antall) * antall
  const bytes = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(bytes)
    const verdi = bytes[0] as number
    if (verdi < grense) return verdi % antall
  }
}

/** Ett tilfeldig tegn fra et tegnsett. */
function tilfeldigTegn(tegnsett: string): string {
  return tegnsett[tilfeldigTall(tegnsett.length)] as string
}

/**
 * Et nytt midlertidig passord.
 *
 * Ett tegn hentes fra hver gruppe først, slik at passordet alltid har både
 * små bokstaver, store bokstaver og tall uansett hvor tilfeldigheten faller.
 * Resten fylles fra hele tegnsettet, og rekkefølgen stokkes til slutt — ellers
 * ville de tre første plassene vært forutsigbare.
 */
export function genererMidlertidigPassord(
  lengde: number = MIDLERTIDIG_PASSORD_LENGDE,
): string {
  if (lengde < PASSORD_MINST) {
    throw new Error(`Et midlertidig passord må ha minst ${PASSORD_MINST} tegn`)
  }
  const tegn = [tilfeldigTegn(SMAA), tilfeldigTegn(STORE), tilfeldigTegn(TALL)]
  while (tegn.length < lengde) tegn.push(tilfeldigTegn(ALLE))

  // Fisher–Yates, med den samme sikre kilden som tegnene selv.
  for (let i = tegn.length - 1; i > 0; i--) {
    const j = tilfeldigTall(i + 1)
    ;[tegn[i], tegn[j]] = [tegn[j] as string, tegn[i] as string]
  }
  return tegn.join('')
}
