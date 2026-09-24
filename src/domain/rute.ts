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
 *
 * Etter koden kan adressen peke på et sted på siden: en seksjon, og eventuelt
 * et detaljkort i den. Siden åpner da stedet og ruller dit:
 *
 *   #/analytt/AMTNORSUM/farmakokinetikk
 *   #/analytt/AMTNORSUM/farmakokinetikk/<kort-ID>
 *
 * Seksjonene og kortene har faste nøkler (se `src/components/seksjoner/`).
 *
 * Søket i fagstoffet har sin egen side, med søket i adressen, så et søk kan
 * bokmerkes og deles:
 *
 *   #/sok?q=kvetiapin
 */

export type Rute =
  | { side: 'fortolkning' }
  | {
      side: 'analytt'
      kode: string
      /** Seksjonen og eventuelt detaljkortet adressen peker på. Utelatt når den peker på siden. */
      sted?: readonly string[]
    }
  | {
      side: 'sok'
      /** Søket, slik det ble skrevet. Tomt gir en side som ber om et søk. */
      q: string
    }

export const FORTOLKNING: Rute = { side: 'fortolkning' }

const ANALYTT = /^#\/analytt\/([^/?#]+)((?:\/[^/?#]+)*)\/?$/i

const SOK = /^#\/sok\/?(?:\?(.*))?$/i

/** Flest ledd i stedet: seksjonen og detaljkortet. */
const MAKS_STEDSLEDD = 2

/** Ruten adressen peker på. Alt som ikke er en informasjonsside eller søket, er fortolkningen. */
export function lesRute(hash: string): Rute {
  const sok = SOK.exec(hash)
  if (sok) return { side: 'sok', q: new URLSearchParams(sok[1] ?? '').get('q') ?? '' }
  const treff = ANALYTT.exec(hash)
  if (!treff?.[1]) return FORTOLKNING
  let kode: string
  try {
    kode = decodeURIComponent(treff[1])
  } catch {
    return FORTOLKNING
  }
  kode = kode.trim().toUpperCase()
  if (!kode) return FORTOLKNING
  const sted = lesSted(treff[2] ?? '')
  return sted ? { side: 'analytt', kode, sted } : { side: 'analytt', kode }
}

/**
 * Stedsleddene etter koden. Et sted med flere ledd enn siden har nivåer, eller
 * som ikke lar seg lese, gir siden uten sted — ikke en annen side.
 */
function lesSted(hale: string): string[] | undefined {
  const ledd = hale.split('/').filter(Boolean)
  if (ledd.length === 0 || ledd.length > MAKS_STEDSLEDD) return undefined
  try {
    return ledd.map((l) => decodeURIComponent(l))
  } catch {
    return undefined
  }
}

/** Adressen til en rute, slik den står i adressefeltet. */
export function adresse(rute: Rute): string {
  switch (rute.side) {
    case 'analytt':
      return analyttadresse(rute.kode, rute.sted)
    case 'sok':
      return sokeside(rute.q)
    default:
      return '#/'
  }
}

/** Adressen til søkesiden for et søk. */
export function sokeside(q: string): string {
  return q ? `#/sok?${new URLSearchParams({ q })}` : '#/sok'
}

/** Adressen til informasjonssiden for en analyttkode, eventuelt til et sted på den. */
export function analyttadresse(kode: string, sted: readonly string[] = []): string {
  return ['#/analytt', kode.toUpperCase(), ...sted].map((l, i) => (i === 0 ? l : encodeURIComponent(l))).join('/')
}

export function sammeRute(a: Rute, b: Rute): boolean {
  return adresse(a) === adresse(b)
}
