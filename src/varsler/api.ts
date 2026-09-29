/**
 * Kallene varslene gjør mot Supabase: varslene fra databasen, og valgene og
 * hvor langt brukeren er kommet i endringsloggen, som ligger i
 * brukerinnstillingene.
 */
import { hentInnstilling, lagreInnstilling } from '../auth/innstillinger'
import { klient } from '../auth/klient'
import { lagSignal } from '../domain/signal'
import {
  ENDRINGSLOGGNOKKEL,
  VALGNOKKEL,
  lesEndringsloggstatus,
  lesUleste,
  lesVarselliste,
  lesVarselvalg,
  type Endringsloggstatus,
  type Ulesttall,
  type Varselliste,
  type Varselvalg,
} from './modell'

const FEIL = 'Fikk ikke hentet varslene.'

function sjekk<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw new Error(FEIL)
  return data
}

export async function hentVarsler(): Promise<Varselliste> {
  return lesVarselliste(sjekk(await klient().rpc('mine_varsler')))
}

export async function hentUleste(): Promise<Ulesttall> {
  return lesUleste(sjekk(await klient().rpc('uleste_varsler')))
}

/** Merker varslene lest slik de var da lista ble lest. Uten `ider` gjelder det alle. */
export async function merkVarslerLest(ider: readonly string[] | null, til: string): Promise<void> {
  sjekk(await klient().rpc('merk_varsler_lest', { varsler: ider, til }))
}

export async function hentVarselvalg(): Promise<Varselvalg> {
  return lesVarselvalg(await hentInnstilling(VALGNOKKEL))
}

export async function lagreVarselvalg(valg: Varselvalg): Promise<void> {
  await lagreInnstilling(VALGNOKKEL, valg)
}

/** Hvor langt brukeren er kommet i endringsloggen, eller `null` før første gang. */
export async function hentEndringsloggstatus(): Promise<Endringsloggstatus | null> {
  return lesEndringsloggstatus(await hentInnstilling(ENDRINGSLOGGNOKKEL))
}

export async function lagreEndringsloggstatus(status: Endringsloggstatus): Promise<void> {
  await lagreInnstilling(ENDRINGSLOGGNOKKEL, status)
}

const oppfrisk = lagSignal()

/**
 * Ber bjella se etter varsler med én gang, når noe annet i appen kan ha
 * merket noen lest, som å lese en idé.
 */
export const oppfriskVarsler = () => oppfrisk.send()
export const lyttEtterOppfrisking = oppfrisk.lytt
