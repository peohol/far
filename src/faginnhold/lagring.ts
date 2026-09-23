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
interface Databasefeil {
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

function tilFeil(feil: Databasefeil): Error {
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
  /** Publiserer utkastet slik det står i `forventetRevisjon`. */
  publiserUtkast(objekt: string, forventetRevisjon: number): Promise<Objektstatus>
}

export function lagFaginnholdslager(klient: SupabaseClient): Faginnholdslager {
  async function kall(funksjon: string, argumenter: Record<string, unknown>): Promise<Objektstatus> {
    const { data, error } = await klient.rpc(funksjon, argumenter)
    if (error) throw tilFeil(error)
    if (!data) throw new Error(UVENTET_FEIL)
    return data as Objektstatus
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
    publiserUtkast: (objekt, forventetRevisjon) =>
      kall('publiser_utkast', { objekt, forventet_revisjon: forventetRevisjon }),
  }
}
