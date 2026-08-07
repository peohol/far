import type { Analyte } from '../types'

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
  /** Grunnvekt: lavere er bedre treff. */
  weight: number
}

/**
 * Søkefeltene for én analytt, med vekt etter hvor sterkt et treff teller.
 * Koden veier tyngst fordi den er det brukeren skriver når hen vet hva hen vil.
 * Delanalyttene er med hver for seg, slik at en sumanalyse kan finnes på
 * navnet til hvilken som helst av delene den består av.
 *
 * `visningsnavn` er bevisst holdt utenfor. Det er det eneste feltet som bærer
 * «Sum: », og med det som søkeord ble «s» og «sum» treff på hver eneste
 * sumanalyse — ord om formen på analysen, ikke om stoffet man leter etter.
 * Søket skal bare treffe koder, moderstoffer og metabolitter.
 */
function termsFor(analyte: Analyte): SearchTerm[] {
  return [
    { value: normalise(analyte.kode), weight: 0 },
    { value: normalise(analyte.navn), weight: 1 },
    ...analyte.komponenter.map((k) => ({ value: normalise(k), weight: 1 })),
    ...analyte.aliaser.map((a) => ({ value: normalise(a), weight: 2 })),
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

export interface SearchHit {
  analyte: Analyte
  score: number
}

/**
 * Søker i koder, navn, delanalytter og aliaser. Alle ordene i søket må treffe,
 * slik at «amitriptylin nortriptylin» finner sumanalysen de to inngår i.
 * Resultatet er sortert med beste treff først og kuttet ved {@link MAX_RESULTS}.
 */
export function search(query: string, pool: Analyte[]): SearchHit[] {
  const tokens = normalise(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const hits: SearchHit[] = []
  for (const analyte of pool) {
    const terms = cachedTerms(analyte)
    let total = 0
    let matchedAll = true
    for (const token of tokens) {
      const score = scoreToken(token, terms)
      if (score === null) {
        matchedAll = false
        break
      }
      total += score
    }
    if (matchedAll) hits.push({ analyte, score: total })
  }

  hits.sort((a, b) => a.score - b.score || a.analyte.navn.localeCompare(b.analyte.navn, 'nb'))
  return hits.slice(0, MAX_RESULTS)
}
