/**
 * Det appen henter fra databasen akkurat nå, til lasteindikatoren.
 *
 * Klienten (`klient.ts`) henter gjennom {@link sporetFetch}, så alt appen
 * leser og lagrer telles, uten at hver leser må si fra. Det som hentes i
 * bakgrunnen, uten at noen venter på det, går gjennom {@link iBakgrunnen} og
 * telles ikke: da ville indikatoren stå på uten grunn.
 *
 * En henting telles til svaret begynner å komme, ikke til hele svaret er lest.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

let pagaende = 0
const lyttere = new Set<() => void>()
/** Signalene til hentingene i bakgrunnen. Et signal følger hentingen hele veien til `fetch`. */
const BAKGRUNN = new WeakSet<AbortSignal>()

function endre(med: number): void {
  pagaende += med
  for (const lytter of lyttere) lytter()
}

/** Hvor mange hentinger som er på vei. */
export function pagaendeHentinger(): number {
  return pagaende
}

/** Sier fra når tallet endrer seg. Gir tilbake en funksjon som slutter å si fra. */
export function abonnerPaHentinger(lytter: () => void): () => void {
  lyttere.add(lytter)
  return () => {
    lyttere.delete(lytter)
  }
}

/** `fetch`, talt med i {@link pagaendeHentinger}. */
export const sporetFetch: typeof fetch = async (input, init) => {
  if (init?.signal && BAKGRUNN.has(init.signal)) return fetch(input, init)
  endre(1)
  try {
    return await fetch(input, init)
  } finally {
    endre(-1)
  }
}

/**
 * Klienten, med databasefunksjonene (`rpc`) kalt i bakgrunnen: de telles ikke
 * i {@link pagaendeHentinger}. Resten av klienten er den samme.
 */
export function iBakgrunnen(klient: SupabaseClient): SupabaseClient {
  // Et signal som aldri avbryter, bare merker hentingene.
  const signal = new AbortController().signal
  BAKGRUNN.add(signal)
  const rpc: SupabaseClient['rpc'] = (...argumenter) => {
    const kall = klient.rpc(...argumenter)
    // Enkle klienter, som dem testene bruker, kan ikke merke kallet.
    return typeof kall.abortSignal === 'function' ? kall.abortSignal(signal) : kall
  }
  return new Proxy(klient, {
    get(mal, navn) {
      if (navn === 'rpc') return rpc
      const verdi: unknown = Reflect.get(mal, navn, mal)
      return typeof verdi === 'function' ? verdi.bind(mal) : verdi
    },
  })
}
