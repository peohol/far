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

/**
 * Noe som hører til én bestemt utgave av fortolkningen.
 *
 * Modulene teller opp en utgave for hvert nytt svar i skjemaet, og alt som
 * kvitteres for en kopiering — blinket, «Kopiert», reserveteksten når
 * utklippstavlen sier nei — føres på utgaven kopieringen startet i.
 */
export interface Utgavefestet {
  utgave: number
}

/**
 * Sant når utfallet av en kopiering som startet i `utgave` fortsatt kan skrive
 * over det som står.
 *
 * Utklippstavlen svarer først etter en tur innom nettleseren, og i mellomtiden
 * kan skjemaet ha fått et nytt svar og en ny kopiering rukket å bli ferdig. Da
 * gjelder ikke lenger det som er underveis, og det skal verken legge igjen en
 * kvittering eller ta bort en som hører til den nyere fortolkningen — en
 * kopiering som nettopp feilet skal for eksempel beholde reserveteksten sin.
 */
export function kanSkriveOver(staaende: Utgavefestet | null, utgave: number): boolean {
  return staaende === null || staaende.utgave <= utgave
}
