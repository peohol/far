/**
 * Selvtesten i en kuratering (`docs/kuratorprotokoll.md`, «Dokumentene»): de
 * ufravikelige kravene i protokollens rekkefølge og de tekniske portene, hver
 * med en fast nøkkel. Databasen (`kuratering.selvtestfeil`) avviser en
 * selvtest der et punkt mangler, står flere ganger, er ukjent eller ikke er
 * bestått; en test holder listene her like med `kuratering.selvtestkrav()`
 * og `kuratering.selvtestporter()`.
 */

export const SELVTESTKRAV = [
  { nokkel: 'kildetroskap_preparatomtale', krav: 'Kildetroskap mot preparatomtalen', kan_vaere_ikke_relevant: true },
  { nokkel: 'bivirkninger_kildetro', krav: 'Bivirkningene fra preparatomtalene importeres kildetro', kan_vaere_ikke_relevant: true },
  { nokkel: 'beskyttede_norske_data', krav: 'Beskyttede norske data står' },
  { nokkel: 'pastand_og_kilde', krav: 'Påstand og kilde henger sammen på det smaleste nivået' },
  { nokkel: 'ingenting_finnes_pa', krav: 'Ingenting finnes på' },
  { nokkel: 'konflikter_synliggjort', krav: 'Konflikter synliggjøres og glattes aldri over' },
  { nokkel: 'evidensstyrke', krav: 'Evidensstyrken står' },
  { nokkel: 'automatiske_lag', krav: 'De automatiske lagene dupliseres ikke' },
  { nokkel: 'faste_kort', krav: 'Seksjonene med faste kort følger reglene' },
  { nokkel: 'kunnskapsgrense', krav: 'Kunnskapsgrensen er en dato' },
  { nokkel: 'offentlig_repo', krav: 'Repoet er offentlig' },
] as const

export const SELVTESTPORTER = [
  { nokkel: 'provepublisering', port: 'Prøvepubliseringen består' },
  { nokkel: 'rapport', port: 'Rapporten stemmer med endringene' },
  { nokkel: 'dekning', port: 'Dekningsmatrisen dekker modellen' },
  { nokkel: 'funksjonstest', port: 'Funksjonstesten av siden er bestått' },
] as const

/** En selvtest å fylle ut: hvert krav og hver port én gang, uten status og bevis. */
export function tomSelvtest() {
  return {
    krav: SELVTESTKRAV.map((k) => ({ krav: k.nokkel, tittel: k.krav, status: '', bevis: '' })),
    porter: SELVTESTPORTER.map((p) => ({ port: p.nokkel, tittel: p.port, status: '', bevis: '' })),
  }
}
