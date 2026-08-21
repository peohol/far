/**
 * Formen på en kommentar som skal limes inn et sted.
 *
 * En fortolkning kan gi mer enn én kommentar: hele fortolkningen på én
 * analyttkode, og en kort henvisning dit på de andre. Rollen skiller de to,
 * slik at de kan vises ulikt, og merket navngir kommentaren — det er nøkkelen
 * UI-et kvitterer for kopieringen med, og må derfor være entydig innenfor én
 * fortolkning.
 *
 * Formen er felles for fortolkningsmodulene, slik at de kan dele både
 * kommentarblokka og kopieringsflyten
 * ({@link ../components/Kommentarflyt}).
 */
export interface Kommentarplassering {
  rolle: 'hoved' | 'tillegg'
  /** Merkelappen som vises, f.eks. «Hovedkommentar for morfin». */
  merke: string
  /** Analyttkodene kommentaren skal limes inn på. */
  koder: string[]
  tekst: string
}
