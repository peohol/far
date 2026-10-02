/**
 * Kontrollen av at migrasjonsfilene i `supabase/migrations/` stemmer med
 * historikken produksjonen har registrert (`supabase_migrations.schema_migrations`).
 *
 * `apply_migration` gir hver migrasjon sin egen versjon (tidspunktet den ble
 * kjørt) og lagrer teksten slik den ble sendt. Filen i repoet skal derfor ha
 * nøyaktig den versjonen og det navnet, og det samme innholdet. Kontrollen er
 * én lesespørring som sammenligner repoet med det produksjonen har: den kan
 * kjøres med Supabase-MCP-ens `execute_sql` (som bare kan lese) eller i
 * SQL-editoren, og gir bare radene som avviker. Ingen rader betyr at alt
 * stemmer. `scripts/kontroller-migrasjoner.ts` skriver spørringen.
 */
import { createHash } from 'node:crypto'

/** `<versjon>_<navn>.sql`: versjonen er 14 sifre (UTC-tidspunkt), navnet små bokstaver, tall og understrek. */
export const MIGRASJONSFILNAVN = /^(\d{14})_([a-z0-9_]+)\.sql$/

export interface Migrasjonsfil {
  versjon: string
  navn: string
  innhold: string
}

/** Feilene i filnavnene: feil form, eller en versjon som brukes to ganger. */
export function filnavnfeil(filnavn: readonly string[]): string[] {
  const feil: string[] = []
  const versjoner = new Map<string, string>()
  for (const fil of filnavn) {
    const treff = MIGRASJONSFILNAVN.exec(fil)
    if (!treff) {
      feil.push(`${fil}: navnet har ikke formen <14 sifre>_<navn>.sql`)
      continue
    }
    const forrige = versjoner.get(treff[1]!)
    if (forrige) feil.push(`${fil}: versjonen ${treff[1]} brukes også av ${forrige}`)
    versjoner.set(treff[1]!, fil)
  }
  return feil
}

export function lesMigrasjonsfil(filnavn: string, innhold: string): Migrasjonsfil {
  const treff = MIGRASJONSFILNAVN.exec(filnavn)
  if (!treff) throw new Error(`${filnavn}: navnet har ikke formen <14 sifre>_<navn>.sql`)
  return { versjon: treff[1]!, navn: treff[2]!, innhold }
}

/**
 * Avvik i historikken som er kjent og avklart, per versjon: md5 av teksten
 * databasen kjørte (`db`) og av filen i repoet (`fil`), `null` der den ene
 * mangler. Et kjent avvik vises ikke så lenge begge står akkurat slik; endres
 * filen eller teksten, vises det igjen.
 */
export const KJENTE_AVVIK: Readonly<Record<string, { db: string | null; fil: string | null; hvorfor: string }>> = {
  '20260922092042': {
    db: '0bb5d4ba695996fedb048b1955ab55f5',
    fil: '2b425579698f899a9b220fc600a484dc',
    hvorfor: 'Kjørt uten kommentarene filen har.',
  },
  '20260922101921': {
    db: '2586a08fc3718b761cd8c02bb0e0afef',
    fil: 'f8434ec62f7729e0c0512cb59b468c83',
    hvorfor: 'Kjørt uten kommentarene filen har.',
  },
  '20260922111019': {
    db: '4537d58f1fba0e316d561882c0643eda',
    fil: '8767ccbe188fe5b2eecb1491de57ba7e',
    hvorfor: 'Kjørt uten kommentarene filen har.',
  },
  '20260922115530': {
    db: '076f25aa492a9dfcb64a83f23f563cd8',
    fil: '4efc8d398726c48cfcf5ace0b5e89887',
    hvorfor: 'Ryddingen av historikken under oppsettet; kjørt med en kortere tekst enn filen.',
  },
  '20261002025308': {
    db: '0be3a0a393b1eebe02cfe94357dd11b0',
    fil: 'd38e60d461cbd0bc56ac8424f8104fb1',
    hvorfor:
      'Filen fikk etter kjøringen sperren for tom database og bindingen til kilden i fem oppslag (PR 163). ' +
      'Faginnholdet er det samme, og alle oppdateringene i produksjonen traff kortene fra første kuratering.',
  },
  '20261002040004': {
    db: '0dac2be49a8edbb26d94c563b2815abf',
    fil: '8e25c74eee4221d75d69949e56ed8492',
    hvorfor: 'Filen fikk etter kjøringen sperren for tom database (PR 163). Ellers lik.',
  },
  '20261002110800': {
    db: '3f3d9f4559dfa7ed5fa839ca824f9494',
    fil: '6306d89d7259e3e6746583cf4dc0c4da',
    hvorfor: 'Kjørt i SQL Editor; innlimingen ga CRLF-linjeskift, ellers identisk.',
  },
  '20261002110900': {
    db: 'ee2f27e24e474ade1a44ce7f39b58784',
    fil: 'd2f34e22c4e99ada535019d699d66a46',
    hvorfor: 'Kjørt i SQL Editor; innlimingen ga CRLF-linjeskift, ellers identisk.',
  },
}

export const md5 = (tekst: string) => createHash('md5').update(tekst, 'utf8').digest('hex')

/** Blanke tegn på slutten, som `rtrim` i spørringen tar bort. */
const SLUTT = /[ \t\r\n]+$/

/**
 * Lesespørringen som sammenligner filene med produksjonens historikk. Hver rad
 * er en versjon som avviker, med hva som er galt i `avvik`.
 */
export function historikkSql(filer: readonly Migrasjonsfil[], kjente = KJENTE_AVVIK): string {
  const rader = filer.map(
    (f) => `    ('${f.versjon}', '${f.navn}', '${md5(f.innhold)}', '${md5(f.innhold.replace(SLUTT, ''))}')`,
  )
  const tekst = (verdi: string | null) => (verdi === null ? 'null' : `'${verdi}'`)
  const kjent = Object.entries(kjente).map(([versjon, a]) => `    ('${versjon}', ${tekst(a.db)}, ${tekst(a.fil)})`)
  return `-- Migrasjonsfilene i repoet mot historikken i databasen. Ingen rader: alt stemmer.
with repo(versjon, navn, md5, md5_trimmet) as (
  values
${rader.join(',\n')}
), kjent(versjon, db, fil) as (
  values
    (null::text, null::text, null::text)${kjent.map((k) => `,\n${k}`).join('')}
), db as (
  select version as versjon, name as navn, md5(statements[1]) as md5,
    md5(rtrim(statements[1], E' \\t\\r\\n')) as md5_trimmet
  from supabase_migrations.schema_migrations
), sammen as (
  select coalesce(r.versjon, d.versjon) as versjon, coalesce(r.navn, d.navn) as navn,
    case
      when d.versjon is null then coalesce(
        'registrert med en annen versjon: ' || (select string_agg(x.versjon, ', ' order by x.versjon) from db x
          where x.navn = r.navn and not exists (select 1 from repo y where y.versjon = x.versjon)),
        'ikke kjørt i databasen')
      when r.versjon is null then coalesce(
        'filen har en annen versjon: ' || (select string_agg(y.versjon, ', ' order by y.versjon) from repo y
          where y.navn = d.navn and not exists (select 1 from db x where x.versjon = y.versjon)),
        'mangler i repoet')
      when r.navn <> d.navn then 'registrert med navnet ' || d.navn
      when r.md5 = d.md5 or r.md5_trimmet = d.md5_trimmet then null
      else 'annet innhold enn det som ble kjørt'
    end as avvik
  from repo r full join db d on d.versjon = r.versjon
  where not exists (
    select 1 from kjent k
    where k.versjon = coalesce(r.versjon, d.versjon) and k.db is not distinct from d.md5 and k.fil is not distinct from r.md5
      and coalesce(r.navn, d.navn) = coalesce(d.navn, r.navn))
)
select versjon, navn, avvik from sammen where avvik is not null order by versjon;`
}
