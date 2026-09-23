/**
 * Fortolkningskommentaren som eget objekt.
 *
 * En kommentar er teksten som limes inn i pasientsvaret. Den er et eget
 * redigerbart objekt (objekttypen `kommentar`), med stabil ID, egen historikk
 * og egen publisering. Reglene peker på kommentarene med ID-en og eier ikke
 * teksten: kommentar og regel er separate objekter
 * (`docs/analyttsider-og-redigering.md`, avsnitt 10). Samme kommentar kan
 * dermed brukes av flere regler og regelsett, og en tekst rettes ett sted.
 *
 * **Plassholdere** er de navngitte hullene en regeltype fyller inn når
 * kommentaren settes sammen, for eksempel `{nivå}`. Teksten bruker nøyaktig
 * de plassholderne kommentaren oppgir, og de er de samme i alle revisjoner.
 * En regeltype som har godtatt en kommentar, kan derfor stole på den også
 * etter senere endringer av teksten. Vanlige kommentarer har ingen.
 *
 * De samme reglene håndheves av databasen (`intern.skriv_kommentar`);
 * `src/__tests__/kommentarer.test.ts` kontrollerer at de to er enige.
 */

/** Innholdet i en kommentar, det som versjoneres. Ren tekst: det er den som kopieres. */
export interface Kommentarinnhold {
  /** Hva kommentaren er, slik redigeringen viser den. Følger ikke med i pasientsvaret. */
  navn: string
  tekst: string
  /** Plassholderne teksten bruker, sortert. Tom for vanlige kommentarer. */
  plassholdere: string[]
}

/** Kommentartekstene fortolkningen kan slå opp i, etter kommentar-ID. */
export type Kommentaroppslag = ReadonlyMap<string, string>

export const MAKS_NAVNELENGDE = 200
export const MAKS_TEKSTLENGDE = 4000

/** Formen på én plassholder: et navn i krøllparenteser, uten mellomrom i endene. */
const PLASSHOLDER = /^\{[^{}\s](?:[^{}]*[^{}\s])?\}$/

/** Rekkefølgen plassholderne lagres i: tegn for tegn, som `collate "C"` i databasen. */
function sortert(liste: Iterable<string>): string[] {
  return [...liste].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** Plassholderne i en tekst — alt mellom { og } — uten gjentakelser, sortert. */
export function plassholdereI(tekst: string): string[] {
  return sortert(new Set(tekst.match(/\{[^{}]*\}/g) ?? []))
}

/**
 * Feilene i en kommentar, med samme ordlyd som databasen. Tom liste betyr
 * gyldig. `tidligere` er plassholderne kommentaren har fra før, når den
 * finnes: de kan ikke endres.
 */
export function validerKommentar(innhold: Kommentarinnhold, tidligere?: readonly string[]): string[] {
  const { navn, tekst, plassholdere } = innhold
  const feil: string[] = []

  if (navn.trim() === '') feil.push('Kommentaren mangler navn.')
  else if ([...navn.trim()].length > MAKS_NAVNELENGDE) {
    feil.push(`Navnet på kommentaren kan ha høyst ${MAKS_NAVNELENGDE} tegn.`)
  }

  if (tekst.trim() === '') feil.push('Kommentaren mangler tekst.')
  else {
    if (tekst !== tekst.trim()) feil.push('Kommentarteksten begynner eller slutter med mellomrom.')
    if (/[\r\n]/.test(tekst)) feil.push('Kommentarteksten må stå på én linje.')
    if ([...tekst].length > MAKS_TEKSTLENGDE) {
      feil.push(`Kommentarteksten kan ha høyst ${MAKS_TEKSTLENGDE} tegn.`)
    }
  }

  if (plassholdere.some((p) => !PLASSHOLDER.test(p))) {
    feil.push('En plassholder skrives som et navn i krøllparenteser, for eksempel {nivå}.')
  } else if (new Set(plassholdere).size !== plassholdere.length) {
    feil.push('Samme plassholder er oppgitt flere ganger.')
  } else {
    const brukte = plassholdereI(tekst)
    const ukjente = brukte.filter((p) => !plassholdere.includes(p))
    if (ukjente.length > 0) {
      feil.push(`Kommentarteksten har plassholdere som ikke er oppgitt: ${ukjente.join(', ')}.`)
    }
    const ubrukte = sortert(plassholdere).filter((p) => !brukte.includes(p))
    if (ubrukte.length > 0) {
      feil.push(`Kommentarteksten mangler plassholderne den oppgir: ${ubrukte.join(', ')}.`)
    }
    if (/[{}]/.test(tekst.replace(/\{[^{}]*\}/g, ''))) {
      feil.push('Kommentarteksten har en krøllparentes som ikke hører til en plassholder.')
    }
    if (tidligere && sortert(tidligere).join('\n') !== sortert(plassholdere).join('\n')) {
      feil.push('Plassholderne i en kommentar kan ikke endres. Lag en ny kommentar i stedet.')
    }
  }
  return feil
}
