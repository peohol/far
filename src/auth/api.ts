/**
 * Alt appen sier til Supabase om brukere og profiler.
 *
 * Lesing går rett mot profiltabellen, som radsikkerheten åpner for alle
 * innloggede. Alt som endrer rettigheter eller passord går gjennom
 * Edge-funksjonene; nettleseren har ikke rettigheter til det selv.
 */
import {
  erGyldigBrukernavn,
  internAuthAdresse,
  normaliserBrukernavn,
} from '@delt/brukernavn'
import { AVATAR_BOTTE, avatarSti, type Profil, type Rolle } from '@delt/profil'
import { klient } from './klient'

/**
 * Den ene meldingen som gis ved mislykket innlogging.
 *
 * Den sier med vilje ikke om det var brukernavnet eller passordet som var
 * feil, slik at siden ikke kan brukes til å finne ut hvem som har konto.
 */
export const INNLOGGING_FEILET = 'Feil brukernavn eller passord.'

const UVENTET_FEIL = 'Noe gikk galt. Prøv igjen.'

/** Svaret en Edge-funksjon gir når noe blir avvist. */
async function feilmeldingFra(feil: unknown): Promise<string> {
  const svar = (feil as { context?: Response } | null)?.context
  if (svar && typeof svar.json === 'function') {
    try {
      const kropp: unknown = await svar.json()
      const melding = (kropp as { feil?: unknown } | null)?.feil
      if (typeof melding === 'string' && melding !== '') return melding
    } catch {
      // Svaret var ikke JSON. Da står den generelle meldingen igjen.
    }
  }
  return UVENTET_FEIL
}

/** Kaller en Edge-funksjon og gjør et avslag om til en lesbar feil. */
async function kall<T>(navn: string, kropp: Record<string, unknown>): Promise<T> {
  const { data, error } = await klient().functions.invoke<T>(navn, { body: kropp })
  if (error) throw new Error(await feilmeldingFra(error))
  if (data === null) throw new Error(UVENTET_FEIL)
  return data
}

/**
 * Logger inn med brukernavn og passord.
 *
 * Den interne Auth-adressen utledes her, av brukernavnet alene. Brukeren ser
 * aldri noe annet enn brukernavnet sitt.
 */
export async function loggInn(brukernavn: string, passord: string): Promise<string | null> {
  const normalisert = normaliserBrukernavn(brukernavn)
  // Et brukernavn som ikke kan være gyldig, finnes heller ikke. Vi svarer
  // som om passordet var feil, i stedet for å røpe formkravene.
  if (!erGyldigBrukernavn(normalisert) || passord === '') return INNLOGGING_FEILET

  const { error } = await klient().auth.signInWithPassword({
    email: internAuthAdresse(normalisert),
    password: passord,
  })
  return error ? INNLOGGING_FEILET : null
}

export async function loggUt(): Promise<void> {
  await klient().auth.signOut()
}

/** Profilen til én bruker, eller `null` når raden ikke finnes. */
export async function hentProfil(brukerId: string): Promise<Profil | null> {
  const { data, error } = await klient()
    .from('profiles')
    .select('*')
    .eq('id', brukerId)
    .maybeSingle()
  if (error) throw error
  return (data as Profil | null) ?? null
}

/** Alle profiler, sortert slik brukerlista viser dem. */
export async function hentAlleProfiler(): Promise<Profil[]> {
  const { data, error } = await klient()
    .from('profiles')
    .select('*')
    .order('first_name', { ascending: true })
    .order('username', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profil[]
}

/** De ordinære profilopplysningene brukeren selv rår over. */
export async function lagreEgenProfil(
  brukerId: string,
  endring: { first_name: string; last_name: string; avatar_path?: string | null },
): Promise<Profil> {
  const { data, error } = await klient()
    .from('profiles')
    .update(endring)
    .eq('id', brukerId)
    .select('*')
    .single()
  if (error) throw error
  return data as Profil
}

/** Bytter passordet til den som allerede er logget inn. */
export async function byttPassord(nyttPassord: string): Promise<void> {
  const { error } = await klient().auth.updateUser({ password: nyttPassord })
  if (error) {
    throw new Error(
      error.message.toLowerCase().includes('password')
        ? 'Passordet ble ikke godtatt. Velg et annet.'
        : UVENTET_FEIL,
    )
  }
}

/** Laster opp profilbildet til brukerens egen mappe og gir stien tilbake. */
export async function lastOppAvatar(brukerId: string, bilde: Blob): Promise<string> {
  const sti = avatarSti(brukerId)
  const { error } = await klient()
    .storage.from(AVATAR_BOTTE)
    .upload(sti, bilde, { upsert: true, contentType: 'image/webp' })
  if (error) throw new Error('Bildet ble ikke lastet opp. Prøv igjen.')
  return sti
}

/**
 * Midlertidige lenker til profilbildene.
 *
 * Bøtta er privat, så bildene hentes med signerte lenker. Lenkene er ferske
 * hver gang, og et nytt bilde vises derfor med én gang — det gamle kan ikke
 * bli hengende igjen i nettleserens mellomlager.
 */
export async function signerteAvatarer(stier: string[]): Promise<Map<string, string>> {
  const unike = [...new Set(stier)].filter((sti) => sti !== '')
  const lenker = new Map<string, string>()
  if (unike.length === 0) return lenker

  const { data, error } = await klient()
    .storage.from(AVATAR_BOTTE)
    .createSignedUrls(unike, 60 * 60)
  if (error) return lenker

  for (const oppf of data ?? []) {
    if (oppf.path && oppf.signedUrl) lenker.set(oppf.path, oppf.signedUrl)
  }
  return lenker
}

/** Svaret fra funksjonene som lager et midlertidig passord. */
export interface Midlertidig {
  brukernavn: string
  midlertidigPassord: string
}

/** Oppretter en ny bruker. Krever administrator — kontrolleres server-side. */
export function opprettBruker(brukernavn: string): Promise<Midlertidig> {
  return kall<Midlertidig>('opprett-bruker', { brukernavn })
}

/** Gir en bruker et nytt midlertidig passord. Krever administrator. */
export function nyttMidlertidigPassord(brukerId: string): Promise<Midlertidig> {
  return kall<Midlertidig>('nytt-passord', { brukerId })
}

/** Endrer rollen til en annen bruker. Krever administrator. */
export async function settRolle(brukerId: string, rolle: Rolle): Promise<Profil> {
  const svar = await kall<{ profil: Profil }>('sett-rolle', { brukerId, rolle })
  return svar.profil
}

/**
 * Fullfører førstegangsoppsettet: passord, navn og eventuelt profilbilde.
 *
 * Passordet settes server-side, og Supabase kaster da den gjeldende økten.
 * Uten en ny innlogging ville brukeren falt ut av appen i det
 * tilgangstokenet gikk ut — en time senere, midt i arbeidet. Derfor logges
 * det inn på nytt med det passordet brukeren nettopp valgte.
 */
export async function fullforOppsett(oppsett: {
  brukernavn: string
  passord: string
  fornavn: string
  etternavn: string
  avatarSti?: string | null
}): Promise<Profil> {
  const { brukernavn, ...kropp } = oppsett
  const svar = await kall<{ profil: Profil }>('fullfor-oppsett', { ...kropp })

  if (await loggInn(brukernavn, oppsett.passord)) {
    throw new Error('Passordet er byttet. Logg inn på nytt med det nye passordet.')
  }
  return svar.profil
}
