/**
 * Kontrollen av at migrasjonsfilene i `supabase/migrations/` stemmer med
 * historikken produksjonen har registrert (`supabase_migrations.schema_migrations`),
 * og kontrollene av filene selv før de rulles ut (`docs/migrasjoner.md`).
 *
 * Filen i repoet skal ha nøyaktig den versjonen og det navnet produksjonen
 * registrerte, og det samme innholdet. Teksten lagres på to måter: Supabase-CLI-en
 * (`supabase db push`, normalveien) deler fila i setninger og lagrer hver for seg
 * uten blanke tegn og semikolon i endene, mens `apply_migration` (MCP) og
 * SQL-editoren lagrer hele teksten som én. Kontrollen er én lesespørring som
 * sammenligner repoet med det produksjonen har, og som gir bare radene som
 * avviker; ingen rader betyr at alt stemmer. Den kan kjøres med
 * Supabase-MCP-ens `execute_sql` (som bare kan lese), i SQL-editoren eller av
 * utrullingen (`scripts/produksjonsmigrering.ts`), som stopper ved avvik.
 * `scripts/kontroller-migrasjoner.ts` skriver spørringen.
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
 * Tegnene CLI-en kan ta bort når den deler fila i setninger: blanke tegn og
 * semikolon i endene av hver. Uten dem er teksten den samme som fila, uansett
 * hvordan den ble delt. Samme tegnklasse som i spørringen.
 */
const CLI_FJERNER = /[ \t\n\r\f\v;]+/g
export const cliform = (tekst: string) => tekst.replace(CLI_FJERNER, '')

export interface Historikkvalg {
  /** Godta filer som ikke er kjørt ennå (før utrullingen); ellers er de et avvik. */
  ventende?: boolean
  /**
   * Én blokk som stopper med avvikene i feilmeldingen i stedet for å gi dem
   * som rader, for utrullingen. Lesespørringen er standard.
   */
  stopp?: boolean
}

/**
 * Lesespørringen som sammenligner filene med produksjonens historikk. Hver rad
 * er en versjon som avviker, med hva som er galt i `avvik`.
 */
export function historikkSql(filer: readonly Migrasjonsfil[], kjente = KJENTE_AVVIK, valg: Historikkvalg = {}): string {
  const rader = filer.map(
    (f) =>
      `    ('${f.versjon}', '${f.navn}', '${md5(f.innhold)}', '${md5(f.innhold.replace(SLUTT, ''))}', '${md5(cliform(f.innhold))}')`,
  )
  const tekst = (verdi: string | null) => (verdi === null ? 'null' : `'${verdi}'`)
  const kjent = Object.entries(kjente).map(([versjon, a]) => `    ('${versjon}', ${tekst(a.db)}, ${tekst(a.fil)})`)
  const sammenligning = `with repo(versjon, navn, md5, md5_trimmet, md5_cli) as (
  values
${rader.join(',\n')}
), kjent(versjon, db, fil) as (
  values
    (null::text, null::text, null::text)${kjent.map((k) => `,\n${k}`).join('')}
), db as (
  -- CLI-en (db push) fører ikke created_by, og lagrer setningene hver for seg.
  select version as versjon, name as navn, md5(statements[1]) as md5,
    md5(rtrim(statements[1], E' \\t\\r\\n')) as md5_trimmet,
    case when created_by is null
      then md5(regexp_replace(array_to_string(statements, ''), '[ \\t\\n\\r\\f\\v;]+', '', 'g')) end as md5_cli
  from supabase_migrations.schema_migrations
), sammen as (
  select coalesce(r.versjon, d.versjon) as versjon, coalesce(r.navn, d.navn) as navn,
    case
      when d.versjon is null then coalesce(
        'registrert med en annen versjon: ' || (select string_agg(x.versjon, ', ' order by x.versjon) from db x
          where x.navn = r.navn and not exists (select 1 from repo y where y.versjon = x.versjon)),
        ${valg.ventende ? 'null' : "'ikke kjørt i databasen'"})
      when r.versjon is null then coalesce(
        'filen har en annen versjon: ' || (select string_agg(y.versjon, ', ' order by y.versjon) from repo y
          where y.navn = d.navn and not exists (select 1 from db x where x.versjon = y.versjon)),
        'mangler i repoet')
      when r.navn <> d.navn then 'registrert med navnet ' || d.navn
      when r.md5 = d.md5 or r.md5_trimmet = d.md5_trimmet or r.md5_cli = d.md5_cli then null
      else 'annet innhold enn det som ble kjørt'
    end as avvik
  from repo r full join db d on d.versjon = r.versjon
  where not exists (
    select 1 from kjent k
    where k.versjon = coalesce(r.versjon, d.versjon) and k.db is not distinct from d.md5 and k.fil is not distinct from r.md5
      and coalesce(r.navn, d.navn) = coalesce(d.navn, r.navn))
)`
  if (!valg.stopp) {
    return `-- Migrasjonsfilene i repoet mot historikken i databasen. Ingen rader: alt stemmer.
${sammenligning}
select versjon, navn, avvik from sammen where avvik is not null order by versjon;`
  }
  return `-- Migrasjonsfilene i repoet mot historikken i databasen. Stopper med avvikene, om det er noen.
do $kontroll$
declare
  funnet text;
begin
  select string_agg(versjon || ' ' || navn || ': ' || avvik, E'\\n' order by versjon) into funnet
  from (
${sammenligning}
select * from sammen where avvik is not null
  ) as avvikende;
  if funnet is not null then
    raise exception E'Migrasjonshistorikken i databasen stemmer ikke med repoet:\\n%', funnet;
  end if;
end
$kontroll$;`
}

/**
 * Setningene som kan gi vesentlig og vanskelig reversibelt datatap eller åpne
 * tilgang, og som derfor må være eksplisitt godkjent før en migrasjon rulles ut
 * automatisk (`docs/migrasjoner.md`). Listen er snever med vilje: den skal
 * treffe nøyaktig, ikke gjøre vanlige migrasjoner tunge. Bred sletting og andre
 * risikoer lar seg ikke skille ut sikkert her, og vurderes før PR-en slås sammen.
 */
const DESTRUKTIVE: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bdrop\s+table\b/i, 'drop table'],
  [/\bdrop\s+schema\b/i, 'drop schema'],
  [/\bdrop\s+database\b/i, 'drop database'],
  [/\bdrop\s+column\b/i, 'drop column'],
  // Ikke `truncate` som hendelse i en trigger (`before truncate on …`, `insert or truncate`).
  [/(?<!\b(?:before|after|or|of)\s+)\btruncate\b/i, 'truncate'],
  [/\bdisable\s+row\s+level\s+security\b/i, 'disable row level security'],
]

/**
 * Merket i en migrasjon som er godkjent til tross for destruktive setninger:
 * en kommentarlinje med hvem som godkjente, når og hva, for eksempel
 * `-- destruktiv-godkjent: Peder 2026-10-05, fjerner den tomme tabellen x`.
 */
export const DESTRUKTIV_GODKJENT = /^--[ \t]*destruktiv-godkjent:[ \t]*\S/m

/** De destruktive setningstypene migrasjonen inneholder (også i kommentarer, så de ikke gjemmes). */
export function destruktiveSetninger(innhold: string): string[] {
  return DESTRUKTIVE.filter(([monster]) => monster.test(innhold)).map(([, navn]) => navn)
}

/** Feilmeldingene for filer med destruktive setninger uten godkjenningsmerket. */
export function destruktivfeil(filer: readonly Migrasjonsfil[]): string[] {
  return filer.flatMap((f) => {
    const funnet = destruktiveSetninger(f.innhold)
    if (!funnet.length || DESTRUKTIV_GODKJENT.test(f.innhold)) return []
    return [
      `${filnavn(f)}: inneholder ${funnet.join(', ')}. Den rulles ikke ut automatisk før den er eksplisitt godkjent ` +
        'og har merket «-- destruktiv-godkjent: <hvem, når, hva>» (docs/migrasjoner.md).',
    ]
  })
}

export const filnavn = (f: Migrasjonsfil) => `${f.versjon}_${f.navn}.sql`

/**
 * Feilene en PR kan ha i migrasjonene, uten tilgang til produksjonen. `grunn` er
 * filene på grenen PR-en skal inn i, `utrullet` filene slik de stod sist
 * utrullingen var vellykket (de er kjørt i produksjonen; ukjent: `grunn`).
 * - En utrullet migrasjon er fjernet, omdøpt eller endret. Migrasjoner er
 *   append-only; en endring godtas bare når den står i `kjente` med akkurat det
 *   nye innholdet. En migrasjon som er slått sammen, men stoppet før den ble
 *   kjørt, kan rettes.
 * - En ny migrasjon har en versjon som ikke er nyere enn alle på grenen, så den
 *   ville kjørt i en annen rekkefølge i testene enn i produksjonen.
 * - En ny eller endret migrasjon har destruktive setninger uten godkjenning.
 */
export function endringsfeil(
  grunn: readonly Migrasjonsfil[],
  pr: readonly Migrasjonsfil[],
  { utrullet = grunn, kjente = KJENTE_AVVIK }: { utrullet?: readonly Migrasjonsfil[]; kjente?: typeof KJENTE_AVVIK } = {},
): string[] {
  const feil: string[] = []
  const iPr = new Map(pr.map((f) => [filnavn(f), f]))
  for (const f of utrullet) {
    const ny = iPr.get(filnavn(f))
    if (!ny) feil.push(`${filnavn(f)}: er fjernet eller omdøpt, men er kjørt i produksjonen`)
    else if (ny.innhold !== f.innhold && kjente[f.versjon]?.fil !== md5(ny.innhold))
      feil.push(`${filnavn(f)}: er endret, men er kjørt i produksjonen; en retting er en ny migrasjon`)
  }
  const iGrunn = new Map(grunn.map((f) => [filnavn(f), f]))
  const nye = pr.filter((f) => !iGrunn.has(filnavn(f)))
  const nyeste = grunn.reduce((maks, f) => (f.versjon > maks ? f.versjon : maks), '')
  for (const f of nye) {
    if (f.versjon <= nyeste)
      feil.push(`${filnavn(f)}: versjonen er ikke nyere enn den nyeste migrasjonen på grenen (${nyeste}); gi fila et nytt tidspunkt`)
  }
  const endrede = pr.filter((f) => iGrunn.has(filnavn(f)) && iGrunn.get(filnavn(f))!.innhold !== f.innhold)
  return [...feil, ...destruktivfeil([...nye, ...endrede])]
}

/**
 * Filene som ikke er kjørt i produksjonen ennå, ut fra versjonene den har
 * registrert, og de registrerte versjonene som ikke har noen fil.
 */
export function ventendeMigrasjoner(filer: readonly Migrasjonsfil[], registrerte: readonly string[]) {
  const kjort = new Set(registrerte)
  const iRepo = new Set(filer.map((f) => f.versjon))
  return {
    ventende: filer.filter((f) => !kjort.has(f.versjon)),
    utenFil: [...kjort].filter((v) => !iRepo.has(v)).sort(),
  }
}
