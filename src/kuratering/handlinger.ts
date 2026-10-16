/**
 * Handlingene agentene har i kurateringsgrenene (`docs/kurateringsgrener.md`),
 * med beskrivelsen og formen på argumentene. Det samme settet tilbys over
 * HTTP (`/api/kuratering`) og som MCP-verktøy (`/api/kuratering-mcp`), og
 * databasen (`public.kuratering_agent`) kontrollerer rollene og statusene.
 */

type Skjema = Record<string, unknown>

const tekst = (beskrivelse: string, maks?: number): Skjema => ({ type: 'string', description: beskrivelse, ...(maks ? { maxLength: maks } : {}) })
const heltall = (beskrivelse: string): Skjema => ({ type: 'integer', minimum: 0, description: beskrivelse })
const gren = tekst('ID-en til kurateringsgrenen')
const objekt = (egenskaper: Record<string, Skjema>, pakrevd: string[] = []): Skjema => ({
  type: 'object',
  properties: egenskaper,
  required: pakrevd,
  additionalProperties: false,
})

export interface Agenthandling {
  navn: string
  beskrivelse: string
  argumenter: Skjema
  /** Bare leser, endrer ingenting. */
  leser?: boolean
}

export const AGENTHANDLINGER: readonly Agenthandling[] = [
  {
    navn: 'oversikt',
    beskrivelse: 'Grenene agenten kan se: kuratoren sine egne, kontrolløren alle aktive. Status, revisjon og om de venter på kontroll. Ingen fagtekst.',
    argumenter: objekt({ stoff: tekst('Bare grenen for denne fagsiden (nøkkelen)'), alle: { type: 'boolean', description: 'Også avsluttede grener' } }),
    leser: true,
  },
  {
    navn: 'les',
    beskrivelse:
      'Hele grenen: revisjonen (tilstanden, prøvepubliseringen og forhåndsvisningen av siden slik den ville blitt publisert), grunnversjonen den bygger på, vurderingene, hendelsene og dokumentene.',
    argumenter: objekt({ gren, revisjon: heltall('En bestemt revisjon; den siste når den ikke oppgis') }, ['gren']),
    leser: true,
  },
  {
    navn: 'les_dokument',
    beskrivelse: 'Et arbeidsdokument i grenen (evidensjournal, dekningsmatrise, blindprotokoll, selvtest, kildeplan eller notat), den siste versjonen eller en bestemt.',
    argumenter: objekt(
      { gren, art: { type: 'string', enum: ['kildeplan', 'evidensjournal', 'dekningsmatrise', 'blindprotokoll', 'selvtest', 'notat'] }, versjon: heltall('Versjonen') },
      ['gren', 'art'],
    ),
    leser: true,
  },
  {
    navn: 'vurder',
    beskrivelse:
      'Den faglige vurderingen av nøyaktig én revisjon av en gren som er klar til kontroll: «godkjent» eller «endringer», med begrunnelsen. Bare kontrolløren, og aldri for en gren agenten selv kuraterer.',
    argumenter: objekt(
      {
        gren,
        revisjon: heltall('Revisjonen som er vurdert; må være den siste'),
        beslutning: { type: 'string', enum: ['godkjent', 'endringer'] },
        begrunnelse: tekst('Hva som er kontrollert, og hva som må rettes', 4000),
      },
      ['gren', 'revisjon', 'beslutning', 'begrunnelse'],
    ),
  },
  {
    navn: 'apne',
    beskrivelse: 'Åpner en ny kurateringsgren for en publisert fagside. Bare kuratoren. En de novo-gren starter i blindfasen.',
    argumenter: objekt(
      { stoff: tekst('Nøkkelen til fagsiden'), formaal: tekst('Hva kurateringen skal gjøre', 500), art: { type: 'string', enum: ['kuratering', 'de_novo'] } },
      ['stoff', 'formaal'],
    ),
  },
  {
    navn: 'skriv',
    beskrivelse:
      'Lagrer endringer i grenen som en ny revisjon, og prøvepubliserer den. Endringene: sett, ny, fjern, tilbakestill, bivirkninger og rapport (docs/kurateringsgrener.md).',
    argumenter: objekt(
      {
        gren,
        forventet_revisjon: heltall('Revisjonen grenen står på nå'),
        endringer: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'object' } },
        melding: tekst('Kort om hva revisjonen gjør', 1000),
      },
      ['gren', 'forventet_revisjon', 'endringer'],
    ),
  },
  {
    navn: 'aktivitet',
    beskrivelse: 'Melder hva kuratoren arbeider med nå, så de som følger grenen ser det.',
    argumenter: objekt({ gren, tekst: tekst('Hva', 300), seksjon: tekst('Panelet'), objekt: tekst('Kortet') }, ['gren', 'tekst']),
  },
  {
    navn: 'dokument',
    beskrivelse: 'Lagrer en ny versjon av et arbeidsdokument i grenen.',
    argumenter: objekt(
      {
        gren,
        art: { type: 'string', enum: ['kildeplan', 'evidensjournal', 'dekningsmatrise', 'blindprotokoll', 'selvtest', 'notat'] },
        innhold: { type: 'object' },
      },
      ['gren', 'art', 'innhold'],
    ),
  },
  {
    navn: 'avslutt_blindfase',
    beskrivelse: 'Avslutter blindfasen i en de novo-gren, når blindprotokollen og evidensjournalen er lagret.',
    argumenter: objekt({ gren }, ['gren']),
  },
  {
    navn: 'til_kontroll',
    beskrivelse: 'Sender revisjonen til faglig kontroll. Krever bestått prøvepublisering, en rapport som stemmer og dokumentene.',
    argumenter: objekt({ gren, revisjon: heltall('Revisjonen') }, ['gren', 'revisjon']),
  },
  {
    navn: 'trekk_fra_kontroll',
    beskrivelse: 'Trekker grenen tilbake fra kontroll før den er vurdert.',
    argumenter: objekt({ gren }, ['gren']),
  },
  {
    navn: 'oppdater_grunnlag',
    beskrivelse: 'Flytter grenen til den siste versjonen av fagsiden, og sier hvilke av objektene den endrer som er publisert på nytt.',
    argumenter: objekt({ gren }, ['gren']),
  },
  {
    navn: 'publiser',
    beskrivelse: 'Publiserer en godkjent gren samlet. Bare kuratoren av grenen, og bare når siste revisjon er godkjent av en annen.',
    argumenter: objekt({ gren, revisjon: heltall('Revisjonen som er godkjent') }, ['gren', 'revisjon']),
  },
  {
    navn: 'forkast',
    beskrivelse: 'Forkaster grenen. Fagsiden er uendret.',
    argumenter: objekt({ gren, grunn: tekst('Hvorfor', 500) }, ['gren']),
  },
]

export const AGENTHANDLINGSNAVN: ReadonlySet<string> = new Set(AGENTHANDLINGER.map((h) => h.navn))
