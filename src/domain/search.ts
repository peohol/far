import type { Analyte } from '../types'

/** Flest alternativer som vises av gangen — tastene 1–9 og 0. */
export const MAX_RESULTS = 10

/** Gjør tekst sammenlignbar: små bokstaver, uten aksenter og skilletegn. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
}

/** Treffer alle tegnene i `needle` i rekkefølge inni `haystack`? */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (const char of haystack) {
    if (char === needle[i]) i += 1
    if (i === needle.length) return true
  }
  return needle.length === 0
}

interface SearchTerm {
  value: string
  /** Grunnvekt: lavere er bedre treff. */
  weight: number
}

/**
 * Søkefeltene for én analytt, med vekt etter hvor sterkt et treff teller.
 * Koden veier tyngst fordi den er det brukeren skriver når hen vet hva hen vil.
 */
function termsFor(analyte: Analyte): SearchTerm[] {
  return [
    { value: normalise(analyte.kode), weight: 0 },
    { value: normalise(analyte.navn), weight: 1 },
    { value: normalise(analyte.visningsnavn), weight: 2 },
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

/** Beste (laveste) poengsum for ett søkeord mot én analytt, eller `null`. */
function scoreToken(token: string, terms: SearchTerm[]): number | null {
  let best: number | null = null
  for (const term of terms) {
    let score: number | null = null
    if (term.value === token) score = term.weight
    else if (term.value.startsWith(token)) score = 10 + term.weight
    else if (term.value.includes(token)) score = 20 + term.weight
    else if (isSubsequence(token, term.value)) score = 30 + term.weight
    if (score !== null && (best === null || score < best)) best = score
  }
  return best
}

export interface SearchHit {
  analyte: Analyte
  score: number
}

/**
 * Søker i koder, navn, delanalytter og aliaser. Alle ordene i søket må treffe,
 * slik at «sum amitri» og «amitri nor» begge finner sumanalysen.
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
