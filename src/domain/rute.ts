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
 * Et stoff som ikke har noen analyttkode, kan likevel ha en informasjonsside
 * (en monografi). Den har adresse etter navnet, med sted som over:
 *
 *   #/stoff/Valproat
 *   #/stoff/Valproat/tdm
 *
 * Får stoffet en kode senere, fører navnet til siden for koden.
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
      side: 'stoff'
      /** Navnet på informasjonssiden, slik adressen skriver det. */
      navn: string
      sted?: readonly string[]
    }
  | {
      side: 'sok'
      /** Søket, slik det ble skrevet. Tomt gir en side som ber om et søk. */
      q: string
    }

export const FORTOLKNING: Rute = { side: 'fortolkning' }

const ANALYTT = /^#\/analytt\/([^/?#]+)((?:\/[^/?#]+)*)\/?$/i

const STOFF = /^#\/stoff\/([^/?#]+)((?:\/[^/?#]+)*)\/?$/i

const SOK = /^#\/sok\/?(?:\?(.*))?$/i

/** Flest ledd i stedet: seksjonen og detaljkortet. */
const MAKS_STEDSLEDD = 2

/** Ruten adressen peker på. Alt som ikke er en informasjonsside eller søket, er fortolkningen. */
export function lesRute(hash: string): Rute {
  const sok = SOK.exec(hash)
  if (sok) return { side: 'sok', q: new URLSearchParams(sok[1] ?? '').get('q') ?? '' }
  const analytt = lesSide(ANALYTT, hash)
  if (analytt) {
    const kode = analytt.nokkel.toUpperCase()
    return { side: 'analytt', kode, ...(analytt.sted && { sted: analytt.sted }) }
  }
  const stoff = lesSide(STOFF, hash)
  if (stoff) return { side: 'stoff', navn: stoff.nokkel, ...(stoff.sted && { sted: stoff.sted }) }
  return FORTOLKNING
}

/** Nøkkelen (koden eller navnet) og stedet i en adresse til en informasjonsside. */
function lesSide(monster: RegExp, hash: string): { nokkel: string; sted?: string[] } | undefined {
  const treff = monster.exec(hash)
  if (!treff?.[1]) return undefined
  let nokkel: string
  try {
    nokkel = decodeURIComponent(treff[1]).trim()
  } catch {
    return undefined
  }
  if (!nokkel) return undefined
  const sted = lesSted(treff[2] ?? '')
  return sted ? { nokkel, sted } : { nokkel }
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
    case 'stoff':
      return stoffadresse(rute.navn, rute.sted)
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
  return sideadresse('#/analytt', kode.toUpperCase(), sted)
}

/** Adressen til informasjonssiden for et stoff uten analyttkode, etter navnet. */
export function stoffadresse(navn: string, sted: readonly string[] = []): string {
  return sideadresse('#/stoff', navn.trim(), sted)
}

/**
 * Adressen til en informasjonsside: siden for koden når den har en, ellers
 * siden for stoffet etter navnet.
 */
export function informasjonsadresse(side: { kode?: string; navn: string }, sted: readonly string[] = []): string {
  return side.kode ? analyttadresse(side.kode, sted) : stoffadresse(side.navn, sted)
}

function sideadresse(rot: string, nokkel: string, sted: readonly string[]): string {
  return [rot, ...[nokkel, ...sted].map(encodeURIComponent)].join('/')
}

export function sammeRute(a: Rute, b: Rute): boolean {
  return adresse(a) === adresse(b)
}
