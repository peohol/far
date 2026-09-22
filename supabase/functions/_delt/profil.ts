/**
 * Profilen en OUSFAR-bruker har, og reglene for feltene i den.
 *
 * Delt mellom appen og Edge-funksjonene. Feltnavnene er de samme som i
 * `public.profiles`, slik at en rad kan leses rett inn uten oversettelseslag.
 */

/** Rollene systemet har. Flere trengs ikke: enten er du admin, eller ikke. */
export const ROLLER = ['user', 'admin'] as const

export type Rolle = (typeof ROLLER)[number]

/** Lengste fornavn eller etternavn. Samme grense som databasen setter. */
export const NAVN_MEST = 60

/** Bøtta profilbildene ligger i. Privat — se migrasjonen for policyene. */
export const AVATAR_BOTTE = 'avatarer'

/** Profilbildet lagres kvadratisk i denne størrelsen, som WebP. */
export const AVATAR_STORRELSE = 512

export interface Profil {
  id: string
  username: string
  first_name: string
  last_name: string
  role: Rolle
  avatar_path: string | null
  must_change_password: boolean
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

/** Feltene en bruker selv får endre på sin egen profil. */
export interface Profilendring {
  first_name: string
  last_name: string
  avatar_path: string | null
}

export function erRolle(verdi: unknown): verdi is Rolle {
  return typeof verdi === 'string' && (ROLLER as readonly string[]).includes(verdi)
}

/** Trimmet, med gjentatte mellomrom slått sammen til ett. */
export function normaliserNavn(raatekst: string): string {
  return raatekst.trim().replace(/\s+/g, ' ')
}

/**
 * Feilen med et navnefelt, i vanlig språk — eller `null` når det er i orden.
 * `merkelapp` er navnet feltet har i grensesnittet, så meldingen kan vises
 * som den er.
 */
export function navnFeil(navn: string, merkelapp: string): string | null {
  if (navn === '') return `${merkelapp} må fylles ut.`
  if (navn.length > NAVN_MEST) return `${merkelapp} kan ha høyst ${NAVN_MEST} tegn.`
  return null
}

/**
 * Stien profilbildet til en bruker ligger på.
 *
 * Alltid den samme for samme bruker, så et nytt bilde erstatter det gamle i
 * stedet for å legge igjen en haug med gamle filer. Mappa er bruker-ID-en,
 * som er nettopp det Storage-policyene sammenligner mot.
 */
export function avatarSti(brukerId: string): string {
  return `${brukerId}/avatar.webp`
}

/** Navnet som vises: fornavn og etternavn, med brukernavnet som reserve. */
export function visningsnavn(profil: Pick<Profil, 'first_name' | 'last_name' | 'username'>): string {
  const navn = `${profil.first_name} ${profil.last_name}`.trim()
  return navn === '' ? profil.username : navn
}

/** Forbokstavene som vises når brukeren ikke har lagt inn et profilbilde. */
export function initialer(profil: Pick<Profil, 'first_name' | 'last_name' | 'username'>): string {
  const fra = (tekst: string) => tekst.trim().charAt(0).toUpperCase()
  const bokstaver = `${fra(profil.first_name)}${fra(profil.last_name)}`
  return bokstaver === '' ? fra(profil.username) : bokstaver
}
