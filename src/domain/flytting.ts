/**
 * Flyttingen av et element fra der det sto til der det havnet.
 *
 * Brukes til å la båndknappen som ble brukt, fly opp og bli beviset over
 * lim-inn-kortet: beviset tegnes først der det skal ende, måles, og settes så
 * tilbake til ruten knappen sto i med en transform. Når transformen animeres
 * bort, glir beviset på plass — og for øyet er det den samme knappen som
 * flytter seg.
 *
 * Regnet ut i rene tall, uten DOM, slik at reglene kan prøves i test. Alle mål
 * er i piksler i vinduets eget koordinatsystem, samme som
 * `getBoundingClientRect`.
 */

/** Et rektangel i vinduet. */
export interface Rute {
  venstre: number
  topp: number
  bredde: number
  hoyde: number
}

/** Startpunktet for flyttingen, som en transform på elementet der det havnet. */
export interface Flytting {
  /** Vannrett forskyvning fra der elementet havnet. Negativt tall = til venstre. */
  x: number
  /** Loddrett forskyvning. Positivt tall = elementet startet lenger ned. */
  y: number
  /** Hvor mye elementet må krympe eller vokse for å dekke startruten. */
  skala: number
}

function senter(rute: Rute): { x: number; y: number } {
  return { x: rute.venstre + rute.bredde / 2, y: rute.topp + rute.hoyde / 2 }
}

/**
 * Transformen som legger elementet i `til` oppå ruten i `fra`.
 *
 * Elementet skaleres om sin egen midte, så forskyvningen måles mellom
 * midtpunktene og ikke mellom hjørnene.
 *
 * Skalaen leses av høyden. Båndknappene deler bredden i kortet likt mellom seg
 * og er derfor bredere enn innholdet sitt, mens høyden bare kommer av skriften
 * og innrykket — det samme innholdet beviset overtar. Måles skalaen på høyden,
 * står ikonet og tallene i nøyaktig samme størrelse på nøyaktig samme sted i
 * det beviset tar over, og det er bare den brede knapperuten som trekker seg
 * sammen rundt dem. Måles den på bredden i stedet, spretter innholdet.
 *
 * Er en av rutene ikke målt ennå, er det ingen skala å regne ut, og elementet
 * flytter seg i sin egen størrelse i stedet for å forsvinne i et nullpunkt.
 */
export function flyttingMellom(fra: Rute, til: Rute): Flytting {
  const start = senter(fra)
  const slutt = senter(til)
  const skala = fra.hoyde > 0 && til.hoyde > 0 ? fra.hoyde / til.hoyde : 1
  return { x: start.x - slutt.x, y: start.y - slutt.y, skala }
}
