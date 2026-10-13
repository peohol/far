/**
 * Kontrollen av at en migrasjon som endrer faginnholdet, oppgir hvem som står
 * for endringen (`docs/innholdsendringer.md`).
 *
 * Endringsloggen for sidene viser hvilken agent som gjorde en endring. Det
 * håndheves i databasen når migrasjonen kjøres: en kuratering uten rapport
 * stopper der. Denne kontrollen tar resten før PR-en slås sammen: en ny
 * migrasjon som endrer innhold, skal åpne endringen med
 * `intern.endring_start('<agent>', '<egen fil>', …)` eller avslutte den med
 * `intern.endring_rapport`/`intern.kuratering_rapport('<agent>', '<egen fil>', …)`,
 * og en kuratering skal avsluttes med `intern.kuratering_rapport`. Uten det
 * ville endringen stått i loggen som en anonym databasemigrasjon.
 *
 * Kontrollen leser teksten, ikke databasen: den ser etter kallene og
 * setningene som endrer innhold, utenom definisjonene (`create function` og
 * annen DDL), der de bare beskrives.
 */
import { cliSetninger, utenKommentarer } from './sqlsetninger'

/** Funksjonene i API-et og registeret som endrer innhold. */
const INNHOLDSFUNKSJONER = [
  'opprett_utkast',
  'lagre_utkast',
  'gjenopprett_revisjon',
  'publiser_utkast',
  'slett_referanse',
  'lagre_intervallregelsett',
  'lagre_scenarioregelsett',
  'lagre_thc_regelsett',
  'opprett_stoffkategori',
  'endre_stoffkategori',
  'flytt_stoffkategori',
  'arkiver_stoffkategori',
  'slett_stoffkategori',
  'plasser_stoff',
  'arkiver_stoff',
  'slett_stoff',
  'gjenopprett_stoff',
  'slett_stoff_for_godt',
  'tom_stoffpapirkurven',
  'fjern_stoff',
]

/** Hjelpefunksjonene i `intern` og bivirkningsskjemaet som endrer innhold. */
const INTERNE = ['intern\\.ny_revisjon', 'intern\\.kuratering_(?:lagre|nytt|referanse)', 'bivirkninger\\.(?:importer|trekk_tilbake)']

/** Tabellene innholdet står i. */
const INNHOLDSTABELLER = [
  'redigerbare_objekter',
  'objektrevisjoner',
  'objektpubliseringer',
  'stoffkategorier',
  'stoffplasseringer',
  'stoffstatus',
  'slettede_stoffsider',
]

const KALL = new RegExp(
  `(?:\\b(?:public\\.)?(?:${INNHOLDSFUNKSJONER.join('|')})|\\b(?:${INTERNE.join('|')}))\\s*\\(`,
  'iu',
)
const SKRIVING = new RegExp(
  `\\b(?:insert\\s+into|update|delete\\s+from)\\s+(?:only\\s+)?(?:(?:public\\.)?(?:${INNHOLDSTABELLER.join('|')})|bivirkninger\\.\\w+)\\b`,
  'iu',
)

/** Setningene som bare definerer noe; kallene i dem kjøres ikke av migrasjonen. */
const DEFINISJON = /^\s*(?:create|alter|drop|grant|revoke|comment)\b/iu

/** Setningene migrasjonen kjører, utenom definisjonene. */
const kjorte = (sql: string) => cliSetninger(utenKommentarer(sql)).filter((s) => !DEFINISJON.test(s))

/** Om migrasjonen endrer innhold: kaller en funksjon eller skriver i en tabell som gjør det. */
export function endrerInnhold(sql: string): boolean {
  return kjorte(sql).some((s) => KALL.test(s) || SKRIVING.test(s))
}

const ERKLARING = /\bintern\.(endring_start|endring_rapport|kuratering_rapport)\s*\(\s*'([a-z0-9-]+)'\s*,\s*'([^']*)'/giu

export interface Erklaring {
  funksjon: string
  agent: string
  migrasjon: string
}

/** Erklæringene i migrasjonen: hvilken agent den oppgir, og hvilken fil. */
export function erklaringer(sql: string): Erklaring[] {
  return [...kjorte(sql).join(';\n').matchAll(ERKLARING)].map((m) => ({
    funksjon: m[1]!.toLowerCase(),
    agent: m[2]!,
    migrasjon: m[3]!,
  }))
}

const KURATERING = /\bintern\.kuratering_start\s*\(/iu

/**
 * Det som mangler i erklæringen til migrasjonen `filnavn`, som feilmeldinger.
 * Tom når den ikke endrer innhold, eller oppgir agenten riktig.
 */
export function erklaringsfeil(filnavn: string, sql: string): string[] {
  const kuratering = kjorte(sql).some((s) => KURATERING.test(s))
  if (!kuratering && !endrerInnhold(sql)) return []
  const funnet = erklaringer(sql)
  const feil: string[] = []
  const feilFil = funnet.filter((e) => e.migrasjon !== filnavn)
  if (feilFil.length > 0) {
    feil.push(
      `${filnavn}: oppgir ${feilFil.map((e) => `«${e.migrasjon}»`).join(', ')} som migrasjon i ${feilFil[0]!.funksjon}; ` +
        'det skal være filnavnet til migrasjonen selv (docs/innholdsendringer.md).',
    )
  }
  if (kuratering && !funnet.some((e) => e.funksjon === 'kuratering_rapport')) {
    feil.push(
      `${filnavn}: er en kuratering uten rapport. Avslutt den med ` +
        `intern.kuratering_rapport('<agent>', '${filnavn}', <rapport>) (docs/monografkuratering.md).`,
    )
  } else if (funnet.length === 0) {
    feil.push(
      `${filnavn}: endrer faginnhold uten å oppgi agenten. Start endringen med ` +
        `intern.endring_start('<agent>', '${filnavn}', '<oppsummering>') (docs/innholdsendringer.md).`,
    )
  }
  return feil
}

/* --- Erklæringen i migrasjonene skriptene lager ------------------------------ */

/** Det en migrasjon som endrer innhold, oppgir om seg selv. */
export interface Agenterklaring {
  /** Agentens nøkkel i `public.endringsagenter`, som `claude-code`. */
  agent: string
  /** Filnavnet til migrasjonen selv. */
  migrasjon: string
  /** Kort, forståelig hensikt; står i endringsloggen når agenten ikke leverer rapport. */
  oppsummering: string
  /** PR-en eller commiten på GitHub endringen hører til. */
  lenker?: readonly string[]
}

const sqlTekst = (tekst: string) => `'${tekst.replaceAll("'", "''")}'`

/** Setningen som åpner endringen: `select intern.endring_start(…);`. */
export function erklaringSql({ agent, migrasjon, oppsummering, lenker = [] }: Agenterklaring): string {
  const argumenter = [agent, migrasjon, oppsummering.replace(/\s+/g, ' ').trim()].map(sqlTekst)
  if (lenker.length > 0) argumenter.push(`array[${lenker.map(sqlTekst).join(', ')}]::text[]`)
  return `select intern.endring_start(${argumenter.join(', ')});`
}

/**
 * Migrasjonen med erklæringen foran det den endrer: etter kommentarene øverst,
 * så de fortsatt forteller hva fila er.
 */
export function medErklaring(sql: string, erklaring: Agenterklaring): string {
  const linjer = sql.split('\n')
  const forste = linjer.findIndex((l) => !l.startsWith('--'))
  const i = forste < 0 ? linjer.length : forste
  return [...linjer.slice(0, i), erklaringSql(erklaring), ...linjer.slice(i)].join('\n')
}
