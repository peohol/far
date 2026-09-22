/**
 * Brukernavn i OUSFAR: normalisering, validering og den interne Auth-adressen.
 *
 * Modulen leses både av appen i nettleseren og av Edge-funksjonene, slik at
 * klient og server aldri kan mene ulike ting om hva et brukernavn er. Appen
 * når den som `@delt/brukernavn`; funksjonene som `../_delt/brukernavn.ts`.
 *
 * Databasen håndhever de samme reglene i `public.brukernavn_er_gyldig()` og
 * `public.intern_auth_domene()`. Endres reglene her, må de endres der også —
 * det er den siste skansen, og den som gjelder uansett hvem som skriver.
 */

/** Korteste brukernavn vi godtar. */
export const BRUKERNAVN_MINST = 3
/** Lengste brukernavn vi godtar. */
export const BRUKERNAVN_MEST = 32

/**
 * Domenet de interne Auth-adressene bygges av.
 *
 * Supabase Auth krever en e-postadresse for passordinnlogging, men OUSFAR
 * samler ikke inn e-post. Adressen er derfor en ren teknisk nøkkel, utledet av
 * brukernavnet, på et domene som etter RFC 2606 aldri kan eksistere. Den skal
 * ikke vises noe sted, og det sendes aldri e-post fra systemet.
 */
export const INTERN_AUTH_DOMENE = 'auth.ousfar.invalid'

/**
 * Tegnsettet: små bokstaver a–z og tall, der punktum, bindestrek og understrek
 * kan skille bolker fra hverandre. Formen forbyr dermed både innledende,
 * avsluttende og doble skilletegn uten at det trengs egne regler for det.
 */
const MONSTER = /^[a-z0-9]+([._-][a-z0-9]+)*$/

/** Små bokstaver uten omkringliggende mellomrom. Alltid kjørt før validering. */
export function normaliserBrukernavn(raatekst: string): string {
  return raatekst.trim().toLowerCase()
}

/**
 * Feilen med brukernavnet, i vanlig språk — eller `null` når det er gyldig.
 *
 * Forventer et normalisert brukernavn. Meldingen er ment å vises til en
 * administrator som oppretter en bruker, og sier hva som må rettes.
 */
export function brukernavnFeil(brukernavn: string): string | null {
  if (brukernavn === '') return 'Skriv inn et brukernavn.'
  if (brukernavn !== normaliserBrukernavn(brukernavn)) {
    return 'Brukernavnet må skrives med små bokstaver og uten mellomrom.'
  }
  if (brukernavn.length < BRUKERNAVN_MINST) {
    return `Brukernavnet må ha minst ${BRUKERNAVN_MINST} tegn.`
  }
  if (brukernavn.length > BRUKERNAVN_MEST) {
    return `Brukernavnet kan ha høyst ${BRUKERNAVN_MEST} tegn.`
  }
  if (!MONSTER.test(brukernavn)) {
    return 'Brukernavnet kan bare inneholde bokstavene a–z, tall, punktum, bindestrek og understrek. Det må begynne og slutte med en bokstav eller et tall.'
  }
  return null
}

/** Sant når brukernavnet er normalisert og oppfyller alle reglene. */
export function erGyldigBrukernavn(brukernavn: string): boolean {
  return brukernavnFeil(brukernavn) === null
}

/**
 * Den interne Auth-adressen brukernavnet hører til: `peohol` →
 * `peohol@auth.ousfar.invalid`.
 *
 * Utledet og aldri lagret som en opplysning om brukeren. Kaster på ugyldig
 * brukernavn, slik at en adresse aldri kan bygges av noe som ikke er
 * kontrollert.
 */
export function internAuthAdresse(brukernavn: string): string {
  const feil = brukernavnFeil(brukernavn)
  if (feil) throw new Error(feil)
  return `${brukernavn}@${INTERN_AUTH_DOMENE}`
}

/**
 * Brukernavnet en intern Auth-adresse ble bygget av, eller `null` når adressen
 * ikke er en av våre.
 */
export function brukernavnFraAuthAdresse(adresse: string): string | null {
  const skille = adresse.lastIndexOf('@')
  if (skille === -1) return null
  if (adresse.slice(skille + 1).toLowerCase() !== INTERN_AUTH_DOMENE) return null
  const brukernavn = normaliserBrukernavn(adresse.slice(0, skille))
  return erGyldigBrukernavn(brukernavn) ? brukernavn : null
}
