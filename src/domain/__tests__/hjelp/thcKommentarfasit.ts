/**
 * Kommentarene for THC-syre slik eieren skrev dem 12.10.2026, ferdig satt
 * sammen: introsetningen, kommentaren for situasjonen og nivået, og
 * spørsmålsetningen der den hører til. Skrevet ut tegn for tegn her, uavhengig
 * av tekstene i databasen og av motoren, så fasiten og testene kan holde at
 * de to sammen gir nøyaktig dette.
 *
 * Nivåene og konklusjonen som velger kommentaren, er de samme som før; bare
 * ordlyden er ny. Forrige prøve under cut-off har egen kommentar bare for
 * «ikke nødvendigvis nytt»; ellers gir den samme kommentar som uten cut-off.
 */

export type Fasitniva = 'lav' | 'middels høy' | 'høy'
export type Fasitkonklusjon = 'uten_forrige' | 'ikke_nodvendigvis' | 'vanskelig' | 'nytt_inntak'

const intro = (niva: string) => `THC-syre, et omdannelsesprodukt av cannabis, er påvist i ${niva} konsentrasjon.`
const SPORSMAL =
  'Ved spørsmål kan rekvirenten kontakte vakthavende lege ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no).'

/** Kommentaren for et nivå og en konklusjon mot forrige prøve. */
export function forventetKommentar(
  niva: Fasitniva,
  konklusjon: Fasitkonklusjon,
  underCutoff: boolean,
  forrigeDato: string,
): string {
  const hoy = niva === 'høy'
  switch (konklusjon) {
    case 'uten_forrige':
      return hoy
        ? `${intro(niva)} Analyseresultatet viser at cannabis har vært inntatt. Slike konsentrasjoner ses gjerne kort ` +
            'tid etter inntak av cannabis. Oppfølging med flere prøver anbefales.'
        : `${intro(niva)} Etter et enkeltinntak vil THC-syre kunne påvises i urin i opptil en uke. Ved gjentatte ` +
            'inntak kan påvisningstiden øke, vanligvis opptil en måned etter avsluttet inntak. Oppfølging med flere ' +
            'prøver anbefales.'
    case 'ikke_nodvendigvis':
      return underCutoff
        ? `${intro(niva)} Analyseresultatet viser at cannabis har vært inntatt – men ikke nødvendigvis etter prøven ` +
            `tatt ${forrigeDato} selv om den ble rapportert som «ikke påvist». Lave konsentrasjoner av THC-syre kan ` +
            `svinge over og under påvisningsgrensen uten at dette nødvendigvis skyldes nytt inntak. ${SPORSMAL}`
        : `${intro(niva)} Analyseresultatet viser at cannabis har vært inntatt – men ikke nødvendigvis etter prøven ` +
            `tatt ${forrigeDato}.`
    case 'vanskelig':
      return (
        `${intro(niva)} Analyseresultatet viser at cannabis har vært inntatt – men gir i seg selv ikke grunnlag for ` +
        `å fastslå om inntaket har skjedd etter prøven tatt ${forrigeDato}. ${SPORSMAL}`
      )
    case 'nytt_inntak':
      return hoy
        ? `${intro(niva)} Slike konsentrasjoner ses gjerne ved prøvetaking kort tid etter inntak av cannabis. ` +
            `Analyseresultatet tilsier at cannabis har vært inntatt etter prøve tatt ${forrigeDato}.`
        : `${intro(niva)} Analyseresultatet tilsier at cannabis har vært inntatt etter prøve tatt ${forrigeDato}.`
  }
}

/** Kommentaren når en enda tidligere prøve gir nytt inntak i den samlede vurderingen. */
export function forventetSamletKommentar(niva: Fasitniva, forrigeDato: string, tidligereDato: string): string {
  return (
    `${intro(niva)} Analyseresultatet viser at cannabis har vært inntatt – men gir i seg selv ikke grunnlag for å ` +
    `fastslå om inntaket har skjedd etter prøven tatt ${forrigeDato}. En samlet vurdering av flere tidligere prøver ` +
    `tilsier likevel at det har skjedd minst ett inntak etter prøven tatt ${tidligereDato}. ${SPORSMAL}`
  )
}

/** Kommentaren når prøvene er tatt med kort tid imellom og ikke vurderes mot hverandre. */
export function forventetKortTidKommentar(niva: Fasitniva): string {
  return (
    `${intro(niva)} Analyseresultatet viser at cannabis har vært inntatt – men denne prøven og forrige prøve ble ` +
    `tatt med så kort tid imellom at det ikke kan vurderes om inntak har skjedd mellom prøvene. ${SPORSMAL}`
  )
}

/** Nivået i den opprinnelige modulen: under 20 lav, 20–40 middels høy, 40 eller mer høy. */
export function fasitniva(ircak: number): Fasitniva {
  return ircak >= 40 ? 'høy' : ircak >= 20 ? 'middels høy' : 'lav'
}
