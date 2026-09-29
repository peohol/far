import type { Analyte } from '../types'
import { stoffnavnForFortolkning } from './koblinger'
import { navnenokkel } from './sokenavn'

/** Flest alternativer som vises av gangen — tastene 1–9 og 0. */
export const MAX_RESULTS = 10

/**
 * Gjør tekst sammenlignbar: små bokstaver, uten aksenter.
 *
 * Mellomrom og skilletegn beholdes, siden søket sammenligner på begynnelsen
 * av navnet og da må navnet stå som det er.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .trim()
}

interface SearchTerm {
  value: string
  /** Navnenøkkelen, som ser bort fra skilletegn og norsk og engelsk stavemåte. */
  nokkel: string
  /** Grunnvekt: lavere er bedre treff. */
  weight: number
}

function term(value: string, weight: number): SearchTerm {
  return { value: normalise(value), nokkel: navnenokkel(value), weight }
}

/**
 * Søkefeltene for én analytt, med vekt etter hvor sterkt et treff teller.
 * Koden veier tyngst fordi den er det brukeren skriver når hen vet hva hen vil.
 * Delanalyttene er med hver for seg, slik at en sumanalyse kan finnes på
 * navnet til hvilken som helst av delene den består av, og modulens egne
 * søkeord veier det samme. Navnene og aliasene i stoffregisteret til
 * stoffene analytten primært hører til, veier nesten like mye, så
 * «quetiapine» finner KVE like direkte som «kvetiapin», og en analytts egne
 * navn går foran når to analytter hører til samme stoff («THC-COOH» gir
 * THC-syre i urin før THC i serum). Stoffene den bare er koblet til, veier
 * mindre.
 *
 * `visningsnavn` er bevisst holdt utenfor. Det er det eneste feltet som bærer
 * «Sum: », og med det som søkeord ble «s» og «sum» treff på hver eneste
 * sumanalyse — ord om formen på analysen, ikke om stoffet man leter etter.
 * Søket skal bare treffe koder, moderstoffer og metabolitter.
 */
function termsFor(analyte: Analyte): SearchTerm[] {
  return [
    term(analyte.kode, 0),
    term(analyte.navn, 1),
    ...analyte.komponenter.map((k) => term(k, 1)),
    ...(analyte.aliaser ?? []).map((a) => term(a, 1)),
    ...stoffnavnForFortolkning(analyte).map(({ navn, primar }) => term(navn, primar ? 1.5 : 2)),
  ]
}

const termCache = new WeakMap<Analyte, SearchTerm[]>()

function cachedTerms(analyte: Analyte): SearchTerm[] {
  let terms = termCache.get(analyte)
  if (!terms) {
    terms = termsFor(analyte)
    termCache.set(analyte, terms)
  }
  return terms
}

/**
 * Beste (laveste) poengsum for ett søkeord mot én analytt, eller `null`.
 *
 * Søket er strengt: et søkeord treffer bare når en kode, et analyttnavn eller
 * en delanalytt *begynner* med det. Ingen treff inne i ordet, og ingen
 * oppmykning der bokstavene bare må komme i riktig rekkefølge — «kve» skal gi
 * kvetiapin og ingenting annet.
 */
function scoreToken(token: string, terms: SearchTerm[]): number | null {
  let best: number | null = null
  for (const term of terms) {
    if (!term.value.startsWith(token)) continue
    const score = term.value === token ? term.weight : 10 + term.weight
    if (best === null || score < best) best = score
  }
  return best
}

/**
 * Beste poengsum for hele søket mot navnenøkkelen til én analytt, eller
 * `null`: «quetiapine», «delta 9 thc» og «THC-COOH» treffer på samme måte som
 * navnet slik det står. Også her må nøkkelen *begynne* med søket.
 */
function scoreNokkel(nokkel: string, terms: SearchTerm[]): number | null {
  if (!nokkel) return null
  let best: number | null = null
  for (const term of terms) {
    if (!term.nokkel.startsWith(nokkel)) continue
    const score = term.nokkel === nokkel ? term.weight : 10 + term.weight
    if (best === null || score < best) best = score
  }
  return best
}

export interface SearchHit {
  analyte: Analyte
  score: number
}

/**
 * Søker i koder, navn, delanalytter og aliaser. Alle ordene i søket må treffe,
 * slik at «amitriptylin nortriptylin» finner sumanalysen de to inngår i, eller
 * hele søket navnenøkkelen til en av dem.
 * Resultatet er sortert med beste treff først og kuttet ved {@link MAX_RESULTS}.
 */
export function search(query: string, pool: Analyte[]): SearchHit[] {
  const tokens = normalise(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const nokkel = navnenokkel(query)

  const hits: SearchHit[] = []
  for (const analyte of pool) {
    const terms = cachedTerms(analyte)
    let total: number | null = 0
    for (const token of tokens) {
      const score = scoreToken(token, terms)
      if (score === null) {
        total = null
        break
      }
      total += score
    }
    const somNavn = scoreNokkel(nokkel, terms)
    const score = total === null ? somNavn : somNavn === null ? total : Math.min(total, somNavn)
    if (score !== null) hits.push({ analyte, score })
  }

  hits.sort((a, b) => a.score - b.score || a.analyte.navn.localeCompare(b.analyte.navn, 'nb'))
  return hits.slice(0, MAX_RESULTS)
}
