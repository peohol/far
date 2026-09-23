/**
 * Fortolkningskommentaren som eget objekt.
 *
 * En kommentar er teksten som limes inn i pasientsvaret. Den er et eget
 * redigerbart objekt, med stabil ID, egen historikk og egen publisering.
 * Reglene peker på kommentarene med ID-en og eier ikke teksten: kommentar og
 * regel er separate objekter (`docs/analyttsider-og-redigering.md`). Samme
 * kommentar kan dermed brukes av flere regler og regelsett, og en tekst rettes
 * ett sted.
 *
 * Formen er felles for alle regeltypene. Et regelsett kan kreve mer av
 * kommentarene det peker på — scenarioreglene krever for eksempel at de ikke
 * har plassholdere — men selve kommentaren er den samme overalt.
 */

/** Innholdet i en kommentar, det som versjoneres. */
export interface Kommentarinnhold {
  /** Internt navn, så kommentaren kan finnes igjen i redigeringen. */
  navn: string
  /** Ren tekst på én linje: det er den som kopieres. */
  tekst: string
  /**
   * Plassholderne teksten bruker, f.eks. `{nivå}` — nøyaktig disse, verken
   * flere eller færre. Tom for de fleste. Settes når kommentaren opprettes og
   * endres ikke siden, så et regelsett som har godtatt kommentaren, kan stole
   * på den også etter senere tekstendringer.
   */
  plassholdere: string[]
}

/** Kommentartekstene fortolkningen kan slå opp i, etter kommentar-ID. */
export type Kommentaroppslag = ReadonlyMap<string, string>

const PLASSHOLDER = /\{[^{}]*\}/g

/** Plassholderne som står i teksten, i den rekkefølgen de først står. */
export function plassholdereI(tekst: string): string[] {
  return [...new Set(tekst.match(PLASSHOLDER) ?? [])]
}

const ren = (verdi: string) => verdi.trim() !== '' && verdi === verdi.trim()

/** Feilene i en kommentar. Tom liste betyr gyldig. */
export function validerKommentar(innhold: Kommentarinnhold): string[] {
  const feil: string[] = []
  if (!ren(innhold.navn)) feil.push('Kommentaren mangler navn eller har mellomrom i endene.')
  if (!ren(innhold.tekst)) feil.push('Kommentaren mangler tekst eller har mellomrom i endene.')
  if (/[\r\n]/.test(innhold.tekst)) feil.push('Kommentaren må stå på én linje.')
  if (innhold.tekst.length > 4000) feil.push('Kommentaren kan ha høyst 4000 tegn.')
  for (const p of innhold.plassholdere) {
    if (!/^\{[^{}\s][^{}]*\}$/.test(p)) feil.push(`Ugyldig plassholder «${p}».`)
  }
  if (new Set(innhold.plassholdere).size !== innhold.plassholdere.length) feil.push('En plassholder står to ganger.')
  const brukt = plassholdereI(innhold.tekst)
  for (const p of brukt) {
    if (!innhold.plassholdere.includes(p)) feil.push(`Teksten bruker plassholderen ${p}, som ikke er tillatt.`)
  }
  for (const p of innhold.plassholdere) {
    if (!brukt.includes(p)) feil.push(`Teksten mangler plassholderen ${p}.`)
  }
  return feil
}
