/**
 * Innloggingsveggen foran appen.
 *
 * OUSFAR er en statisk app: uten noe foran seg ville hele pakken — inkludert
 * analysedata, kommentartekster og fortolkningsregler — kunne lastes ned av
 * hvem som helst som kjenner adressen. Innloggingen i nettleseren avgjør bare
 * hva som tegnes opp, og er ikke en grense noen kan holdes utenfor.
 *
 * Veggen legger den grensen på kanten, i `middleware.ts`: den kliniske delen
 * av pakken utleveres bare til en forespørsel som bærer en gyldig OUSFAR-økt.
 * Innloggingssiden selv må stå åpen, ellers kunne ingen logget inn.
 *
 * Denne modulen er den rene delen av det. Den leses av mellomvaren på kanten,
 * av byggeoppsettet som navngir den beskyttede pakken, og av testene — slik at
 * de tre aldri kan mene ulike ting om hva som er innenfor veggen.
 */

/**
 * Filnavnet den kliniske pakken får.
 *
 * Byggeoppsettet navngir pakken etter dette, og veggen kjenner den igjen på
 * det samme. Endres det ett sted, endres det begge steder.
 */
export const KLINISK_PAKKE = 'klinisk'

/** Mappa de bygde filene havner i. */
const PAKKEMAPPE = '/assets/'

/** Sant når stien peker på noe som bare innloggede skal få hente. */
export function beskyttetSti(sti: string): boolean {
  return sti.startsWith(`${PAKKEMAPPE}${KLINISK_PAKKE}-`)
}

/**
 * Navnet Supabase gir øktinformasjonskapselen, utledet av prosjektets URL.
 *
 * Utledet og ikke skrevet ned, slik at et bytte av prosjekt ikke etterlater
 * en vegg som leter etter feil kapsel — og slipper alle gjennom.
 */
export function oktKakenavn(supabaseUrl: string): string {
  const vert = new URL(supabaseUrl).hostname
  const referanse = vert.split('.')[0]
  if (!referanse) throw new Error(`Ugjenkjennelig Supabase-URL: ${supabaseUrl}`)
  return `sb-${referanse}-auth-token`
}

/** Kapslene i et `Cookie`-hode, som navn og verdi. */
function lesKaker(kakehode: string): Map<string, string> {
  const kaker = new Map<string, string>()
  for (const bit of kakehode.split(';')) {
    const skille = bit.indexOf('=')
    if (skille === -1) continue
    kaker.set(bit.slice(0, skille).trim(), bit.slice(skille + 1).trim())
  }
  return kaker
}

/** `base64url` → tekst, med riktig tolkning av norske tegn. */
function fraBase64(kodet: string): string | null {
  try {
    const b64 = kodet.replace(/-/g, '+').replace(/_/g, '/')
    const polstret = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(polstret), (tegn) => tegn.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** Tilgangstokenet i en lagret økt, eller `null` når verdien ikke er en økt. */
function tokenFraVerdi(raa: string): string | null {
  let tekst: string
  try {
    tekst = decodeURIComponent(raa)
  } catch {
    tekst = raa
  }

  if (tekst.startsWith('base64-')) {
    const klartekst = fraBase64(tekst.slice('base64-'.length))
    if (klartekst === null) return null
    tekst = klartekst
  }

  try {
    const okt: unknown = JSON.parse(tekst)
    const token = (okt as { access_token?: unknown } | null)?.access_token
    return typeof token === 'string' && token !== '' ? token : null
  } catch {
    return null
  }
}

/** Formen Supabase gir øktkapslene sine, med eller uten delenummer. */
const KAPSELFORM = /^sb-.+-auth-token(\.\d+)?$/

/**
 * Tokenet som ligger under ett kapselnavn.
 *
 * Supabase deler en stor økt i flere kapsler, nummerert fra `.0`. De settes
 * sammen igjen i rekkefølge før verdien leses.
 */
function tokenUnder(kaker: Map<string, string>, kakenavn: string): string | null {
  const hel = kaker.get(kakenavn)
  if (hel !== undefined) return tokenFraVerdi(hel)

  const deler: string[] = []
  for (let nummer = 0; kaker.has(`${kakenavn}.${nummer}`); nummer++) {
    deler.push(kaker.get(`${kakenavn}.${nummer}`) as string)
  }
  return deler.length === 0 ? null : tokenFraVerdi(deler.join(''))
}

/**
 * Navnene det kan ligge en økt under, med det forventede først.
 *
 * Navnet utledes av prosjektets URL, og de to utledningene — Supabase sin og
 * vår — kan i prinsippet komme i utakt ved en oppgradering. Da skal veggen
 * ikke stenge alle ute av appen. Det er trygt å lete bredere, for det er ikke
 * navnet som slipper noen inn: tokenet må uansett bære en gyldig signatur fra
 * vårt eget prosjekt, og det kontrolleres i `middleware.ts`.
 */
function kandidatnavn(kaker: Map<string, string>, forventet: string): string[] {
  const navn = new Set([forventet])
  for (const funnet of kaker.keys()) {
    if (KAPSELFORM.test(funnet)) navn.add(funnet.replace(/\.\d+$/, ''))
  }
  return [...navn]
}

/** Tilgangstokenet fra `Cookie`-hodet, eller `null` når ingen økt følger med. */
export function tilgangstokenFra(kakehode: string | null, kakenavn: string): string | null {
  if (!kakehode) return null
  const kaker = lesKaker(kakehode)

  for (const navn of kandidatnavn(kaker, kakenavn)) {
    const token = tokenUnder(kaker, navn)
    if (token) return token
  }
  return null
}
