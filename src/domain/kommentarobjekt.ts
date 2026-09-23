/**
 * Fortolkningskommentaren som eget objekt.
 *
 * En kommentar er teksten som limes inn i pasientsvaret. Den er et eget
 * redigerbart objekt, med stabil ID, egen historikk og egen publisering.
 * Reglene peker på kommentarene med ID-en og eier ikke teksten: kommentar og
 * regel er separate objekter (`docs/analyttsider-og-redigering.md`). Samme
 * kommentar kan dermed brukes av flere regler og regelsett, og en tekst rettes
 * ett sted.
 */

/** Innholdet i en kommentar, det som versjoneres. Ren tekst: det er den som kopieres. */
export interface Kommentarinnhold {
  tekst: string
}

/** Kommentartekstene fortolkningen kan slå opp i, etter kommentar-ID. */
export type Kommentaroppslag = ReadonlyMap<string, string>

/** Feilene i en kommentar. Tom liste betyr gyldig. */
export function validerKommentar(innhold: Kommentarinnhold): string[] {
  const { tekst } = innhold
  return tekst.trim() === '' || tekst !== tekst.trim() ? ['Kommentaren mangler tekst eller har mellomrom i endene.'] : []
}
