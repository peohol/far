/**
 * Adressene i appen.
 *
 * Fortolkningen har ingen egen adresse: den er arbeidsflyten appen åpner i,
 * og tilstanden i den lever i appen, ikke i adressefeltet. Informasjonssidene
 * har derimot hver sin, slik at de kan bokmerkes, deles og åpnes direkte:
 *
 *   #/analytt/AMTNORSUM
 *
 * Adressen står etter `#`. Da er det nettleseren alene som leser den: siden
 * som lastes, er den samme uansett adresse, innloggingsveggen på kanten ser
 * den aldri, og ingenting på serveren må vite at sidene finnes. En side åpnet
 * fra et bokmerke før innlogging, står der fortsatt etterpå.
 *
 * Nøkkelen er analyttkoden laboratoriet rapporterer. Den er stabil og kjent
 * for brukerne, og det er koden fortolkningsmodulene viser — også når flere
 * koder deler en informasjonsside eller en fortolkningsmodul.
 */

export type Rute = { side: 'fortolkning' } | { side: 'analytt'; kode: string }

export const FORTOLKNING: Rute = { side: 'fortolkning' }

const ANALYTT = /^#\/analytt\/([^/?#]+)\/?$/i

/** Ruten adressen peker på. Alt som ikke er en informasjonsside, er fortolkningen. */
export function lesRute(hash: string): Rute {
  const treff = ANALYTT.exec(hash)
  if (!treff?.[1]) return FORTOLKNING
  let kode: string
  try {
    kode = decodeURIComponent(treff[1])
  } catch {
    return FORTOLKNING
  }
  kode = kode.trim().toUpperCase()
  return kode ? { side: 'analytt', kode } : FORTOLKNING
}

/** Adressen til en rute, slik den står i adressefeltet. */
export function adresse(rute: Rute): string {
  return rute.side === 'analytt' ? analyttadresse(rute.kode) : '#/'
}

/** Adressen til informasjonssiden for en analyttkode. */
export function analyttadresse(kode: string): string {
  return `#/analytt/${encodeURIComponent(kode.toUpperCase())}`
}

export function sammeRute(a: Rute, b: Rute): boolean {
  return adresse(a) === adresse(b)
}
