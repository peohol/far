/**
 * Kuratorjobbene: den tekniske hjelpen ChatGPT-monografkuratoren får fra
 * GitHub Actions (`docs/kuratorjobber.md`). En jobb er en forespørsel i en
 * fil på en egen gren, og resultatet skrives tilbake på samme gren, som
 * maskinlesbare filer kuratoren henter med GitHub-verktøyene sine.
 *
 * Her står formen på forespørselen og resultatet, og navnene på grenene og
 * filene. Alt annet om jobbene leser herfra.
 */

/** Versjonen av formen på forespørselen og resultatet. Økes når formen endres slik at en leser må vite det. */
export const KURATORJOBBVERSJON = 1

/** Grenene jobbene står på. Slås aldri sammen med main. */
export const JOBBGRENPREFIKS = 'kuratorjobb/'

/** Hele navnet på en jobbgren: prefikset og en nøkkel av bokstaver, tall, `.`, `_`, `-` og `/`. */
export const JOBBGREN = /^kuratorjobb\/(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._-][A-Za-z0-9._/-]{0,99}$/

/** Mappen på jobbgrenen der forespørselen og resultatet står. Finnes aldri på main. */
export const JOBBMAPPE = 'kuratorjobb'

/** Forespørselen kuratoren skriver, relativt til roten av grenen. */
export const FORESPORSELSFIL = `${JOBBMAPPE}/foresporsel.json`

/** Mappen jobben skriver resultatet i. Tømmes ved hver kjøring. */
export const RESULTATMAPPE = `${JOBBMAPPE}/resultat`

/** Oversikten over hele jobben, det første kuratoren leser. */
export const STATUSFIL = `${RESULTATMAPPE}/status.json`

export const OPPGAVER = ['funksjonstest', 'spc'] as const
export type Oppgave = (typeof OPPGAVER)[number]

/**
 * Utfallet av én kontroll, én oppgave eller hele jobben. En oppgave eller jobb
 * har det verste utfallet blant delene sine (`samletStatus`).
 *
 * - `ok`: kontrollert og i orden.
 * - `advarsel`: virker, men noe bør ses på (f.eks. data som ikke er hentet på lenge).
 * - `feil`: virker ikke, eller ga et svar appen ikke kan bruke.
 * - `ikke_aktuelt`: gjelder ikke dette stoffet (f.eks. en side uten kobling til ClinPGx).
 */
export type Utfall = 'ok' | 'advarsel' | 'feil' | 'ikke_aktuelt'

const ALVORLIGHET: Readonly<Record<Utfall, number>> = { ikke_aktuelt: 0, ok: 1, advarsel: 2, feil: 3 }

/** Det verste utfallet; `ikke_aktuelt` bare når alt er det, og `ok` for ingen. */
export function samletStatus(utfall: readonly Utfall[]): Utfall {
  if (utfall.length === 0) return 'ok'
  return utfall.reduce((verst, u) => (ALVORLIGHET[u] > ALVORLIGHET[verst] ? u : verst), 'ikke_aktuelt' as Utfall)
}

/** Én kontroll, med det den fant. */
export interface Kontroll {
  /** Fast nøkkel for kontrollen, som kuratoren kan slå opp på. */
  id: string
  status: Utfall
  /** Hva som ble kontrollert og hva som ble funnet, på norsk. */
  melding: string
  /** Funksjonen i databasen kontrollen kalte, når den kalte en. */
  rpc?: string
  /** Hvor lenge kallet tok. */
  ms?: number
  /** Tall kontrollen fant, som antall elementer eller rader. */
  antall?: Record<string, number>
}

/** Forespørselen, slik den står i {@link FORESPORSELSFIL}. */
export interface Foresporsel {
  versjon: typeof KURATORJOBBVERSJON
  /** Stoffene, etter nøkkelen eller navnet i stoffregisteret. `alle` gir alle publiserte fagsider (bare funksjonstesten). */
  stoffer: string[] | 'alle'
  oppgaver: Oppgave[]
  spc?: {
    /** Bestemte preparatomtaler, i stedet for alle FEST oppgir for stoffet. Må være DMPs adresser. */
    adresser?: string[]
    /** Høyst så mange preparatomtaler per stoff. */
    maks?: number
    /** Oppløsningen på sidebildene, punkter per tomme. */
    dpi?: number
  }
  /**
   * Fritt felt for den som ba om jobben, f.eks. ID-en i en arbeidskø. Kommer
   * uendret tilbake i resultatet.
   */
  referanse?: string
}

/** Grensene for {@link Foresporsel.spc}. */
export const SPCGRENSER = {
  maks: { standard: 20, min: 1, max: 50 },
  dpi: { standard: 150, min: 72, max: 300 },
} as const

/** Det som står i {@link STATUSFIL}. */
export interface Jobbstatus {
  versjon: typeof KURATORJOBBVERSJON
  /** `kjorer` mens jobben går; ellers det samlede utfallet. */
  status: Utfall | 'kjorer'
  jobb: {
    gren: string
    /** Commiten på grenen forespørselen ble lest fra. Resultatet gjelder den. */
    foresporsel_commit: string | null
    /** SHA-256 av forespørselsfila slik den ble lest. */
    foresporsel_sha256: string | null
    /** Commiten på main koden som kjørte jobben, kom fra. */
    kode_commit: string | null
    kjoring: string | null
    startet_kl: string
    ferdig_kl: string | null
  }
  foresporsel: Foresporsel | null
  referanse: string | null
  /** Feil i forespørselen eller oppsettet som stoppet jobben før stoffene. */
  feil: string[]
  /** Kontrollene av testbrukeren, felles for stoffene. */
  bruker: Kontroll[]
  stoffer: Record<string, Stoffstatus>
}

export interface Stoffstatus {
  status: Utfall
  /** Utfallet og fila med detaljene for hver oppgave som ble kjørt. */
  oppgaver: Partial<Record<Oppgave, { status: Utfall; fil: string }>>
}

/** Stien til resultatfila for en oppgave og et stoff. */
export function resultatfil(oppgave: Oppgave, stoff: string): string {
  return `${RESULTATMAPPE}/${stoff}/${oppgave}.json`
}
