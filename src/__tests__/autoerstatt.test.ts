/**
 * Autoerstatt: når en regel slår til, og reglene i databasen — de tre første,
 * at alle innloggede leser dem, og at bare administratorer endrer dem.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { finnRegel, regelfeil, type Autoerstattregel } from '../autoerstatt/regler'
import { feilFra, nyDatabase, opprettBruker, som } from './hjelp/testdatabase'

const regel = (finn: string, erstatt: string): Autoerstattregel => ({ id: finn, finn, erstatt })
const REGLER = [regel(' - ', ' – '), regel('--', '–'), regel(' * ', ' · ')]

describe('når en regel slår til', () => {
  it('krever hele teksten, mellomrom og alt, rett foran markøren', () => {
    expect(finnRegel('a - ', REGLER)?.erstatt).toBe(' – ')
    expect(finnRegel('a -', REGLER)).toBeNull()
    expect(finnRegel('a-', REGLER)).toBeNull()
    expect(finnRegel('a- ', REGLER)).toBeNull()
    expect(finnRegel('- ', REGLER)).toBeNull()
    expect(finnRegel('a--', REGLER)?.erstatt).toBe('–')
    expect(finnRegel('2 * ', REGLER)?.erstatt).toBe(' · ')
    expect(finnRegel('2*', REGLER)).toBeNull()
  })

  it('velger den lengste når flere passer', () => {
    expect(finnRegel('x->', [regel('>', '›'), regel('->', '→')])?.erstatt).toBe('→')
  })

  it('godtar bare regler som kan lagres', () => {
    expect(regelfeil(' - ', ' – ', [])).toBeNull()
    expect(regelfeil('', 'x', [])).toMatch(/byttes ut/)
    expect(regelfeil('x', '', [])).toMatch(/byttes med/)
    expect(regelfeil('x', 'x', [])).toMatch(/noe annet/)
    expect(regelfeil('x'.repeat(21), 'y', [])).toMatch(/20 tegn/)
    expect(regelfeil('a\nb', 'y', [])).toMatch(/linjeskift/)
    expect(regelfeil('--', '—', REGLER)).toMatch(/alt en regel/)
    // Mellomrommene er en del av regelen, men «-» ville slått til før både
    // « - » og «--» var skrevet ferdig.
    expect(regelfeil('-', '‐', REGLER)).toMatch(/Denne regelen slår til før « - » er skrevet ferdig/)
    expect(regelfeil('---', '—', REGLER)).toMatch(/Regelen for «--» slår til før «---»/)
    expect(regelfeil('x - y', 'z', REGLER)).toMatch(/Regelen for « - »/)
    // En kortere regel som bare er slutten av en lengre, hindrer den ikke: den lengste vinner.
    expect(regelfeil('- ', '–', [regel(' - ', ' – ')])).toBeNull()
    expect(regelfeil('->', '→', REGLER)).toBeNull()
  })

})

describe('reglene i databasen', () => {
  let db: PGlite
  let admin: string
  let bruker: string

  const sql = <T = Record<string, unknown>>(hvem: string | null, tekst: string, parametre: unknown[] = []) =>
    som(db, hvem, async (tx) => (await tx.query<T>(tekst, parametre)).rows)

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    bruker = await opprettBruker(db, { brukernavn: 'bob', fornavn: 'Bo', etternavn: 'Bruker', rolle: 'user' })
  }, 60_000)

  it('har de tre første reglene, med mellomrommene', async () => {
    const rader = await sql<{ finn: string; erstatt: string }>(bruker, 'select finn, erstatt from public.autoerstatt_regler order by finn')
    expect(rader).toEqual([
      { finn: ' * ', erstatt: ' · ' },
      { finn: ' - ', erstatt: ' – ' },
      { finn: '--', erstatt: '–' },
    ])
  })

  it('er skjult for anonyme', async () => {
    expect(await feilFra(() => sql(null, 'select * from public.autoerstatt_regler'))).toMatchObject({ code: '42501' })
  })

  it('lar ikke vanlige brukere opprette, endre eller slette', async () => {
    expect(
      await feilFra(() => sql(bruker, `insert into public.autoerstatt_regler (finn, erstatt) values ('->', '→')`)),
    ).toMatchObject({ code: '42501' })
    expect(await sql(bruker, `update public.autoerstatt_regler set erstatt = 'x' returning id`)).toEqual([])
    expect(await sql(bruker, `delete from public.autoerstatt_regler returning id`)).toEqual([])
  })

  it('lar administratorer opprette, endre og slette', async () => {
    const [ny] = await sql<{ id: string }>(admin, `insert into public.autoerstatt_regler (finn, erstatt) values ('->', '→') returning id`)
    const [endret] = await sql<{ erstatt: string }>(admin, `update public.autoerstatt_regler set erstatt = '⟶' where id = $1 returning erstatt`, [ny!.id])
    expect(endret).toEqual({ erstatt: '⟶' })
    expect(await sql(admin, `delete from public.autoerstatt_regler where id = $1 returning id`, [ny!.id])).toHaveLength(1)
  })

  it('krever en ny, ikke-tom regel som endrer noe', async () => {
    const ny = (finn: string, erstatt: string) =>
      feilFra(() => sql(admin, 'insert into public.autoerstatt_regler (finn, erstatt) values ($1, $2)', [finn, erstatt]))
    expect(await ny(' - ', '—')).toMatchObject({ code: '23505' })
    expect(await ny('', 'x')).toMatchObject({ code: '23514' })
    expect(await ny('x', '')).toMatchObject({ code: '23514' })
    expect(await ny('x', 'x')).toMatchObject({ code: '23514' })
    expect(await ny('a\nb', 'x')).toMatchObject({ code: '23514' })
    expect(await ny('x'.repeat(21), 'y')).toMatchObject({ code: '23514' })
  })
})
