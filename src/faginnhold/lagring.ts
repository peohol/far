/**
 * Endringene i faginnholdet, slik appen gjør dem.
 *
 * Revisjonene, samtidighetskontrollen og publiseringen ligger i databasen, i
 * funksjonene migrasjonen oppretter. Her gjøres de bare om til vanlige kall,
 * og svarene til noe appen kan handle på: en ny status, en konflikt, eller en
 * feilmelding som kan vises som den er.
 *
 * Klienten sendes inn, slik at modulen ikke binder seg til én bestemt
 * oppkobling.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { KONFLIKT, type Innhold, type Objektstatus, type Objekttype } from './modell'
import type { Kommentarendring } from '../regler/kommentarer'
import type { Intervallregelsettinnhold } from '../regler/modell'

const UVENTET_FEIL = 'Noe gikk galt. Prøv igjen.'
const IKKE_GODTATT = 'Innholdet ble ikke godtatt. Kontroller feltene og prøv igjen.'

/**
 * Lagringen ble avvist fordi noen andre har lagret i mellomtiden. Ingenting
 * er skrevet over; brukeren må se den nye utgaven før hen lagrer igjen.
 */
export class Samtidighetskonflikt extends Error {
  constructor(
    readonly gjeldendeRevisjon: number | null,
    readonly forventetRevisjon: number | null,
  ) {
    super('Innholdet er endret av noen andre siden du åpnet det.')
    this.name = 'Samtidighetskonflikt'
  }
}

/** Feilen data-API-et gir, så langt denne modulen bruker den. */
export interface Databasefeil {
  code?: string
  message?: string
  details?: string | null
}

/** Feilkodene der meldingen fra databasen er skrevet for å vises. */
const LESBARE_FEIL = new Set(['22023', '42501', 'PT404'])

/**
 * Brudd på en regel i selve tabellen — et tomt navn, en ugyldig kode, en kode
 * som nettopp ble tatt av noen andre. Databasens egen melding er teknisk.
 */
const REGELBRUDD = new Set(['23505', '23514'])

function tallEllerNull(verdi: unknown): number | null {
  return typeof verdi === 'number' ? verdi : null
}

/**
 * Funksjonen finnes ikke i databasen — migrasjonene er ikke rullet ut mot
 * prosjektet appen er koblet til. Sies rett ut i stedet for å skjules.
 */
const MANGLER_I_DATABASEN = 'PGRST202'
const IKKE_SATT_OPP = 'Faginnholdet er ikke satt opp i databasen ennå. Si fra til den som drifter OUSFAR.'

/** Feilen fra data-API-et gjort om til noe appen kan handle på og vise. */
export function tilFeil(feil: Databasefeil): Error {
  if (feil.code === MANGLER_I_DATABASEN) return new Error(IKKE_SATT_OPP)
  if (feil.code === KONFLIKT) {
    let detaljer: Record<string, unknown> = {}
    try {
      detaljer = JSON.parse(feil.details ?? '{}') as Record<string, unknown>
    } catch {
      // Uten detaljer er det fortsatt en konflikt.
    }
    return new Samtidighetskonflikt(
      tallEllerNull(detaljer.gjeldende_revisjon),
      tallEllerNull(detaljer.forventet_revisjon),
    )
  }
  if (feil.code && LESBARE_FEIL.has(feil.code) && feil.message) return new Error(feil.message)
  if (feil.code && REGELBRUDD.has(feil.code)) return new Error(IKKE_GODTATT)
  return new Error(UVENTET_FEIL)
}

export interface Faginnholdslager {
  /** Oppretter et nytt objekt. Utkastet blir revisjon 1. */
  opprettUtkast<T extends Objekttype>(type: T, innhold: Innhold[T]): Promise<Objektstatus>
  /**
   * Lagrer utkastet. `forventetRevisjon` er revisjonen brukeren åpnet; er den
   * ikke lenger den gjeldende, kastes {@link Samtidighetskonflikt}.
   */
  lagreUtkast<T extends Objekttype>(
    objekt: string,
    forventetRevisjon: number,
    innhold: Innhold[T],
  ): Promise<Objektstatus>
  /** Lager en ny revisjon med innholdet fra en tidligere. Ingenting slettes. */
  gjenopprettRevisjon(
    objekt: string,
    forventetRevisjon: number,
    fraRevisjon: number,
  ): Promise<Objektstatus>
  /**
   * Lagrer et intervallregelsett og de nye og endrede kommentarene det peker
   * på, som utkast i én transaksjon: alt eller ingenting. Er noen av
   * revisjonene endret i mellomtiden, kastes {@link Samtidighetskonflikt}.
   */
  lagreIntervallregelsett(
    objekt: string,
    forventetRevisjon: number,
    innhold: Intervallregelsettinnhold,
    kommentarer: Kommentarendring[],
  ): Promise<Objektstatus>
  /** Publiserer utkastet slik det står i `forventetRevisjon`. */
  publiserUtkast(objekt: string, forventetRevisjon: number): Promise<Objektstatus>
  /**
   * Sletter en referanse for godt. Går bare når den aldri har vært publisert
   * eller sitert, heller ikke i en eldre revisjon; ellers må den arkiveres.
   */
  slettReferanse(objekt: string, forventetRevisjon: number): Promise<void>
}

export function lagFaginnholdslager(klient: SupabaseClient): Faginnholdslager {
  async function kall<T = Objektstatus>(funksjon: string, argumenter: Record<string, unknown>): Promise<T> {
    const { data, error } = await klient.rpc(funksjon, argumenter)
    if (error) throw tilFeil(error)
    if (!data) throw new Error(UVENTET_FEIL)
    return data as T
  }

  return {
    opprettUtkast: (type, innhold) => kall('opprett_utkast', { objekttype: type, innhold }),
    lagreUtkast: (objekt, forventetRevisjon, innhold) =>
      kall('lagre_utkast', { objekt, forventet_revisjon: forventetRevisjon, innhold }),
    gjenopprettRevisjon: (objekt, forventetRevisjon, fraRevisjon) =>
      kall('gjenopprett_revisjon', {
        objekt,
        forventet_revisjon: forventetRevisjon,
        fra_revisjon: fraRevisjon,
      }),
    lagreIntervallregelsett: (objekt, forventetRevisjon, innhold, kommentarer) =>
      kall('lagre_intervallregelsett', { objekt, forventet_revisjon: forventetRevisjon, innhold, kommentarer }),
    publiserUtkast: (objekt, forventetRevisjon) =>
      kall('publiser_utkast', { objekt, forventet_revisjon: forventetRevisjon }),
    slettReferanse: async (objekt, forventetRevisjon) => {
      await kall<string>('slett_referanse', { objekt, forventet_revisjon: forventetRevisjon })
    },
  }
}
