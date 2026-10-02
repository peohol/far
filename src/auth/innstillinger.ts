/**
 * Små valg som følger brukeren fra maskin til maskin, som sorteringen i
 * idélista og lyst eller mørkt tema. Radsikkerheten i `brukerinnstillinger`
 * gjør at hver bruker bare ser og skriver sine egne.
 */
import { klient } from './klient'

const FEIL = 'Kunne ikke nå brukerinnstillingene.'

/**
 * Verdien brukeren har lagret under `nokkel`, eller `null` når vedkommende ikke
 * har valgt noe ennå. Kaster når tjenesten ikke svarer, så den som kaller kan
 * skille «ingenting lagret» fra «vet ikke».
 */
export async function hentInnstilling(nokkel: string): Promise<unknown> {
  const { data, error } = await klient()
    .from('brukerinnstillinger')
    .select('verdi')
    .eq('nokkel', nokkel)
    .maybeSingle()
  if (error) throw new Error(FEIL)
  return (data as { verdi?: unknown } | null)?.verdi ?? null
}

export async function lagreInnstilling(nokkel: string, verdi: unknown): Promise<void> {
  const { error } = await klient()
    .from('brukerinnstillinger')
    .upsert({ nokkel, verdi }, { onConflict: 'bruker_id,nokkel' })
  if (error) throw new Error(FEIL)
}

/**
 * Lagrer `nokkel` én gang av gangen, så et eldre valg aldri når fram etter et
 * nyere. Venter flere, sendes bare det siste. Brukes der et valg kan endres
 * flere ganger raskt etter hverandre, som bredden på en meny som dras.
 */
export function lagreSisteValg<T>(nokkel: string): (verdi: T) => Promise<void> {
  let ko: Promise<void> = Promise.resolve()
  let siste: { verdi: T } | null = null
  return (verdi) => {
    const valg = { verdi }
    siste = valg
    const lagring = ko.then(() => (siste === valg ? lagreInnstilling(nokkel, verdi) : undefined))
    ko = lagring.catch(() => undefined)
    return lagring
  }
}
