import { ANALYTTKATALOG } from './analyttkatalog'
import { STOFFREGISTER, stoffslug, type Stoffregister } from './stoffregister'

/**
 * Adressene i appen.
 *
 * Fortolkningen er arbeidsflyten appen åpner i, på `#/`. Når en analytt er
 * valgt, er fortolkningen av den en side med sin egen adresse, etter
 * analyttens nøkkel ({@link fortolkningsnokkel}), så den kan ha sine egne
 * diskusjoner og et varsel kan lede dit:
 *
 *   #/fortolkning/hbup
 *
 * Administratorene redigerer reglene og kommentarene fortolkningen gir, på en
 * egen adresse under den:
 *
 *   #/fortolkning/hbup/rediger
 *
 * Resten av tilstanden i fortolkningen — søket, valget i steg 2 — lever i
 * appen, ikke i adressefeltet. Fagsidene har hver sin adresse, slik at de kan
 * bokmerkes, deles og åpnes direkte.
 *
 * En fagside er alltid en stoffside, og adressen er stoffets stabile nøkkel i
 * stoffregisteret (`src/domain/stoffregister.ts`) — aldri en analyttkode:
 *
 *   #/stoff/bupropion
 *
 * Adressen står etter `#`. Da er det nettleseren alene som leser den: siden
 * som lastes, er den samme uansett adresse, innloggingsveggen på kanten ser
 * den aldri, og ingenting på serveren må vite at sidene finnes. En side åpnet
 * fra et bokmerke før innlogging, står der fortsatt etterpå.
 *
 * Etter nøkkelen kan adressen peke på et sted på siden: en seksjon, og
 * eventuelt et detaljkort i den. Siden åpner da stedet og ruller dit:
 *
 *   #/stoff/bupropion/farmakokinetikk
 *   #/stoff/bupropion/farmakokinetikk/<kort-ID>
 *
 * Seksjonene og kortene har faste nøkler (se `src/components/seksjoner/`).
 *
 * Eldre adresser leses fortsatt, men bare for å sende videre til den
 * kanoniske ({@link kanoniskAdresse}):
 *
 * - `#/stoff/Valproat`, etter navnet eller et alias, går til stoffets nøkkel.
 * - `#/analytt/HBUP` går til stoffsiden analytten primært er koblet til,
 *   `#/stoff/bupropion`. En analytt uten et slikt stoff har ingen fagside, og
 *   adressen åpner fortolkningen.
 * - `#/analytt/HBUP/fortolkning` pekte på reglene, som nå står på
 *   fortolkningssiden, og går dit: `#/fortolkning/hbup`.
 *
 * Søket i fagstoffet har sin egen side, med søket i adressen, så et søk kan
 * bokmerkes og deles:
 *
 *   #/sok?q=kvetiapin
 *
 * Stoffregisteret har en helside, der det også redigeres:
 *
 *   #/stoffregister
 */

export type Rute =
  | {
      side: 'fortolkning'
      /** Nøkkelen til analytten som fortolkes ({@link fortolkningsnokkel}). Utelatt uten analytt. */
      analytt?: string
      /** Reglene og kommentarene for analytten redigeres. Bare med en analytt. */
      rediger?: true
    }
  | {
      side: 'stoff'
      /** Stoffets nøkkel i stoffregisteret, f.eks. «bupropion». */
      stoff: string
      /** Seksjonen og eventuelt detaljkortet adressen peker på. Utelatt når den peker på siden. */
      sted?: readonly string[]
    }
  | {
      side: 'sok'
      /** Søket, slik det ble skrevet. Tomt gir en side som ber om et søk. */
      q: string
    }
  | { side: 'stoffregister' }

export const FORTOLKNING: Rute = { side: 'fortolkning' }

const FORTOLKNINGSSIDE = /^#\/fortolkning\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/rediger)?\/?$/i

/** Det siste leddet i adressen til redigeringen av en fortolkning. */
const REDIGER = 'rediger'

/**
 * Nøkkelen til fortolkningssiden for en analyttkode, slik den står i adressen
 * og i diskusjonene: små bokstaver, og ledd som «DIAZ · DMI · OXA» bundet med
 * bindestrek («diaz-dmi-oxa»).
 */
export function fortolkningsnokkel(kode: string): string {
  return kode
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-')
}

/** Ruten til fortolkningen, med analytten som fortolkes når det er en. */
export function fortolkningsrute(kode?: string | null): Rute {
  const analytt = kode ? fortolkningsnokkel(kode) : ''
  return analytt ? { side: 'fortolkning', analytt } : FORTOLKNING
}

/** Ruten til redigeringen av reglene og kommentarene for analytten med koden. */
export function redigeringsrute(kode: string): Rute {
  return { side: 'fortolkning', analytt: fortolkningsnokkel(kode), rediger: true }
}

/** Sant når ruten er redigeringen av en fortolkning. */
export function erRedigering(rute: Rute): boolean {
  return rute.side === 'fortolkning' && rute.rediger === true
}

const STOFF = /^#\/stoff\/([^/?#]+)((?:\/[^/?#]+)*)\/?$/i

/** Seksjonen med reglene på de gamle sidene for en analyttkode. */
const GAMMEL_REGELSEKSJON = 'fortolkning'

/** Adressene fra før fagsidene fikk stoffets nøkkel. Leses bare for å sende videre. */
const GAMMEL_ANALYTT = /^#\/analytt\/([^/?#]+)((?:\/[^/?#]+)*)\/?$/i

const SOK = /^#\/sok\/?(?:\?(.*))?$/i

const STOFFREGISTERSIDE = /^#\/stoffregister\/?$/i

/** Adressen til helsiden for stoffregisteret. */
export const STOFFREGISTERADRESSE = '#/stoffregister'

/** Flest ledd i stedet: seksjonen og detaljkortet. */
const MAKS_STEDSLEDD = 2

/**
 * Ruten adressen peker på. Alt som ikke er en fagside, søket eller
 * stoffregisteret, er
 * fortolkningen. Et navn, et alias eller en gammel analyttadresse gir ruten til
 * stoffet de fører til; {@link kanoniskAdresse} sier om adressefeltet bør
 * skrives om.
 */
export function lesRute(hash: string, register: Stoffregister = STOFFREGISTER): Rute {
  const sok = SOK.exec(hash)
  if (sok) return { side: 'sok', q: new URLSearchParams(sok[1] ?? '').get('q') ?? '' }
  if (STOFFREGISTERSIDE.test(hash)) return { side: 'stoffregister' }
  const fortolkning = FORTOLKNINGSSIDE.exec(hash)
  if (fortolkning?.[1]) {
    const analytt = fortolkning[1].toLowerCase()
    return fortolkning[2] ? { side: 'fortolkning', analytt, rediger: true } : { side: 'fortolkning', analytt }
  }
  const stoff = lesSide(STOFF, hash)
  if (stoff) {
    // Et kjent navn eller alias fører til stoffets nøkkel; en nøkkel
    // registeret ikke har (en ny side i databasen), står som den er.
    const slug = register.kanonisk(stoff.nokkel)?.slug ?? stoffslug(stoff.nokkel)
    return slug ? stoffrute(slug, stoff.sted) : FORTOLKNING
  }
  const analytt = lesSide(GAMMEL_ANALYTT, hash)
  if (analytt) {
    // Seksjonen «fortolkning» på den gamle siden for koden var reglene, som
    // nå står på fortolkningssiden til modulen koden fortolkes i.
    if (analytt.sted?.[0] === GAMMEL_REGELSEKSJON) {
      return fortolkningsrute(ANALYTTKATALOG.finn(analytt.nokkel)?.fortolkning.kode)
    }
    const tilStoff = register.primartStoffFor(analytt.nokkel)
    return tilStoff ? stoffrute(tilStoff.slug, analytt.sted) : FORTOLKNING
  }
  return FORTOLKNING
}

function stoffrute(stoff: string, sted?: readonly string[]): Rute {
  return sted && sted.length > 0 ? { side: 'stoff', stoff, sted } : { side: 'stoff', stoff }
}

/**
 * Den kanoniske adressen når `hash` er en adresse til en fagside skrevet på en
 * annen måte — et navn, et alias eller en gammel analyttadresse — ellers
 * `null`. Appen skriver adressefeltet om til den uten å legge noe nytt i
 * historikken, så den gamle adressen ikke blir stående. En gammel adresse til
 * reglene for en kode går til fortolkningssiden.
 */
export function kanoniskAdresse(hash: string, register: Stoffregister = STOFFREGISTER): string | null {
  if (!STOFF.test(hash) && !GAMMEL_ANALYTT.test(hash)) return null
  const rute = lesRute(hash, register)
  if (rute.side === 'fortolkning' && rute.analytt) return adresse(rute)
  if (rute.side !== 'stoff') return null
  const kanonisk = adresse(rute)
  return kanonisk === hash || kanonisk === hash.replace(/\/$/, '') ? null : kanonisk
}

/** Nøkkelen og stedet i en adresse til en fagside. */
function lesSide(monster: RegExp, hash: string): { nokkel: string; sted?: string[] } | undefined {
  const treff = monster.exec(hash)
  if (!treff?.[1]) return undefined
  let nokkel: string
  try {
    nokkel = decodeURIComponent(treff[1]).trim()
  } catch {
    return undefined
  }
  if (!nokkel) return undefined
  const sted = lesSted(treff[2] ?? '')
  return sted ? { nokkel, sted } : { nokkel }
}

/**
 * Stedsleddene etter nøkkelen. Et sted med flere ledd enn siden har nivåer,
 * eller som ikke lar seg lese, gir siden uten sted — ikke en annen side.
 */
function lesSted(hale: string): string[] | undefined {
  const ledd = hale.split('/').filter(Boolean)
  if (ledd.length === 0 || ledd.length > MAKS_STEDSLEDD) return undefined
  try {
    return ledd.map((l) => decodeURIComponent(l))
  } catch {
    return undefined
  }
}

/** Adressen til en rute, slik den står i adressefeltet. */
export function adresse(rute: Rute): string {
  switch (rute.side) {
    case 'stoff':
      return stoffadresse(rute.stoff, rute.sted)
    case 'sok':
      return sokeside(rute.q)
    case 'stoffregister':
      return STOFFREGISTERADRESSE
    default:
      if (!rute.analytt) return '#/'
      return rute.rediger ? `#/fortolkning/${rute.analytt}/${REDIGER}` : `#/fortolkning/${rute.analytt}`
  }
}

/** Adressen til søkesiden for et søk. */
export function sokeside(q: string): string {
  return q ? `#/sok?${new URLSearchParams({ q })}` : '#/sok'
}

/** Adressen til fagsiden for et stoff, etter nøkkelen, eventuelt til et sted på den. */
export function stoffadresse(slug: string, sted: readonly string[] = []): string {
  return ['#/stoff', ...[slug, ...sted].map(encodeURIComponent)].join('/')
}

export function sammeRute(a: Rute, b: Rute): boolean {
  return adresse(a) === adresse(b)
}
