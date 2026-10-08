/**
 * Søkedataene i databasen (migrasjonen `*_sokedata.sql`): de lette
 * funksjonene søket i hele kunnskapsbasen leser fra FEST, oppslaget
 * interaksjonene slås opp i, og versjonene som sier hva som er endret.
 *
 * Det viktigste som prøves, er at søkedataene gir nøyaktig de samme
 * preparatnavnene og interaksjonene som seksjonene på siden bygger av de
 * fullstendige legemiddeldataene, for hvert virkestoff i FEST-utdraget.
 * Tekstene på sidene er syntetiske.
 */
import type { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagVersjonsleser } from '../faginnhold/globaltSok'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser } from '../faginnhold/lesing'
import { publiseringsplan } from '../faginnhold/stoffside'
import { stoffslug } from '../domain/stoffregister'
import { byggInteraksjoner, interaksjonsnokler } from '../legemiddeldata/interaksjoner'
import { lagLegemiddelleser, lagLegemiddelsok, type Legemiddelleser, type Legemiddelsok } from '../legemiddeldata/lesing'
import { byggPreparatvisning } from '../legemiddeldata/preparatmodell'
import { interaksjonerFraSok, preparatformer, preparatformerFraSok, preparattekster } from '../legemiddeldata/stoffside'
import { AMITRIPTYLIN, AMITRIPTYLINHYDROKLORID, KODEIN, kallSom, synkroniserUtdrag } from './hjelp/fest'
import { faginnholdskall, kjorMigrasjoner, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

let db: PGlite
let kall: Faginnholdskall
let admin: string
let brukerklient: SupabaseClient
let legemidler: Legemiddelleser
let sok: Legemiddelsok

beforeAll(async () => {
  db = await nyDatabase()
  await synkroniserUtdrag(db)
  admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  brukerklient = kall.klientFor(bruker)
  legemidler = lagLegemiddelleser(brukerklient)
  sok = lagLegemiddelsok(brukerklient)
}, 120_000)

/** Det seksjonene på siden viser for koblingen, bygd av de fullstendige dataene. */
async function paSiden(koblet: string[]) {
  const utvalg = await legemidler.les(koblet)
  const nokler = interaksjonsnokler(utvalg, koblet)
  return {
    preparater: preparattekster(preparatformer(byggPreparatvisning(utvalg, koblet))),
    interaksjoner: byggInteraksjoner(await legemidler.interaksjoner(nokler), nokler).interaksjoner.map(({ id, relevans, med }) => ({
      id,
      relevans,
      med,
    })),
  }
}

/** Migrasjonen som tar sekvensen bak versjonen for sidene i bruk. */
const SEKVENSRETTING = '20261008130100_sokedata_versjon_forste_endring.sql'

/** Versjonen for sidene, slik appen ser den. */
async function sideversjon(database: PGlite): Promise<string> {
  return (await database.query<{ v: string }>("select public.sokedata_versjoner() ->> 'sider' as v")).rows[0]!.v
}

/** Utløser endringsmerkingen nøyaktig én gang, som én publisert endring. */
async function enPublisertEndring(database: PGlite): Promise<void> {
  // En setningsutløser kjøres én gang per setning, også når ingen rader treffes.
  await database.query('update public.objektrevisjoner set revisjon = revisjon where false')
}

describe('versjonen for sidene ved den første publiserte endringen', () => {
  // Kjøres først i filen, før noe er publisert i databasen.
  it('endres allerede av den første publiserte endringen i en ny database', async () => {
    const { rows } = await db.query<{ is_called: boolean }>('select is_called from intern.publisert_innhold_versjon')
    expect(rows[0]!.is_called).toBe(true)
    const forst = await sideversjon(db)
    await enPublisertEndring(db)
    expect(await sideversjon(db)).not.toBe(forst)
  })

  it('PostgreSQL: det første nextval på en ny sekvens lar last_value stå', async () => {
    // Grunnen til at sekvensen må tas i bruk før versjonen kan leses av last_value.
    await db.exec('create temporary sequence forste_nextval')
    const les = async () =>
      (await db.query<{ last_value: number; is_called: boolean }>('select last_value::int, is_called from forste_nextval')).rows[0]
    expect(await les()).toEqual({ last_value: 1, is_called: false })
    await db.query("select nextval('forste_nextval')")
    expect(await les()).toEqual({ last_value: 1, is_called: true })
    await db.query("select nextval('forste_nextval')")
    expect(await les()).toEqual({ last_value: 2, is_called: true })
    await db.exec('drop sequence forste_nextval')
  })

  describe('rettingen', () => {
    let forRettingen: PGlite
    beforeAll(async () => {
      forRettingen = await nyDatabase({ til: SEKVENSRETTING.slice(0, 14) })
    }, 120_000)

    const settTilstand = (last_value: number, is_called: boolean) =>
      forRettingen.query("select setval('intern.publisert_innhold_versjon', $1, $2)", [last_value, is_called])
    const rett = () => kjorMigrasjoner(forRettingen, { bare: [SEKVENSRETTING] })

    it('gjorde at den første publiserte endringen ikke endret versjonen', async () => {
      await settTilstand(1, false)
      const forst = await sideversjon(forRettingen)
      await enPublisertEndring(forRettingen)
      expect(await sideversjon(forRettingen)).toBe(forst)
    })

    it('lar versjonen stå når sekvensen ennå ikke er brukt, og den første endringen endrer den', async () => {
      await settTilstand(1, false)
      const forst = await sideversjon(forRettingen)
      await rett()
      expect(await sideversjon(forRettingen)).toBe(forst)
      await enPublisertEndring(forRettingen)
      expect(await sideversjon(forRettingen)).not.toBe(forst)
    })

    it('øker versjonen når sekvensen alt er brukt, og hver senere endring endrer den', async () => {
      for (const last_value of [1, 7]) {
        await settTilstand(last_value, true)
        const forst = await sideversjon(forRettingen)
        await rett()
        const etter = await sideversjon(forRettingen)
        expect(etter).toBe(`${last_value + 1}:${forst.split(':')[1]}`)
        await enPublisertEndring(forRettingen)
        expect(await sideversjon(forRettingen)).not.toBe(etter)
      }
    })
  })
})

describe('søkedataene fra FEST', () => {
  let koblinger: string[][]
  beforeAll(async () => {
    const { rows } = await db.query<{ fest_id: string }>('select fest_id from legemiddeldata.virkestoff order by fest_id')
    koblinger = [
      ...rows.map((r) => [r.fest_id]),
      [AMITRIPTYLIN, KODEIN],
      [AMITRIPTYLINHYDROKLORID],
      ['ID_FINNES-IKKE'],
      [],
    ]
  })

  it('gir de samme preparatene og interaksjonene som seksjonene, for hvert virkestoff i utdraget', async () => {
    const [preparater, interaksjoner] = await Promise.all([sok.preparater(koblinger), sok.interaksjoner(koblinger)])
    expect(preparater).toHaveLength(koblinger.length)
    expect(interaksjoner).toHaveLength(koblinger.length)
    let medPreparater = 0
    let medInteraksjoner = 0
    for (const [n, koblet] of koblinger.entries()) {
      const forventet = await paSiden(koblet)
      expect(preparattekster(preparatformerFraSok(preparater[n]!)), koblet.join()).toEqual(forventet.preparater)
      expect(interaksjonerFraSok(interaksjoner[n]!), koblet.join()).toEqual(forventet.interaksjoner)
      if (forventet.preparater.length > 0) medPreparater += 1
      if (forventet.interaksjoner.length > 0) medInteraksjoner += 1
    }
    // Sammenligningen sier bare noe når utdraget faktisk har preparater og interaksjoner.
    expect(medPreparater).toBeGreaterThan(3)
    expect(medInteraksjoner).toBeGreaterThan(1)
  })

  it('gir bare relevansene seksjonen viser', async () => {
    const [rader] = await sok.interaksjoner([[AMITRIPTYLIN]])
    expect(rader!.length).toBeGreaterThan(0)
    expect(rader!.every(([, relevans]) => relevans === '1' || relevans === '2')).toBe(true)
  })

  it('avviser ugyldige lister og lar bare innloggede lese', async () => {
    const innlogget = kallSom(db, 'authenticated')
    await expect(innlogget('les_preparatsok', { sider: { a: 1 } })).rejects.toThrow(/Ugyldig liste over sider/)
    await expect(innlogget('les_interaksjonssok', { sider: [[1]] })).rejects.toThrow(/Ugyldig liste over sider/)
    await expect(innlogget('les_preparatsok', { sider: Array.from({ length: 501 }, () => []) })).rejects.toThrow(
      /Ugyldig liste over sider/,
    )
    await expect(kallSom(db, 'anon')('les_preparatsok', { sider: [[AMITRIPTYLIN]] })).rejects.toThrow(/permission denied/)
    await expect(kallSom(db, 'anon')('sokedata_versjoner', {})).rejects.toThrow(/permission denied/)
  })
})

describe('oppslaget for interaksjonene', () => {
  const oppslag = async (id: string) =>
    (
      await db.query<{ gruppenavn: string[] | null; substanser: number }>(
        `select (select gruppenavn from legemiddeldata.interaksjonsoppslag where interaksjon_id = $1),
                (select count(*)::int from legemiddeldata.interaksjonssubstanser where interaksjon_id = $1) as substanser`,
        [id],
      )
    ).rows[0]!

  it('følger interaksjonene når de endres, utgår og kommer tilbake', async () => {
    const [[id]] = (await sok.interaksjoner([[AMITRIPTYLIN]])) as [[string, string, string][]]
    const [, , med] = id!
    const forst = await oppslag(id![0])
    expect(forst.gruppenavn).toContain(med)
    expect(forst.substanser).toBeGreaterThan(0)

    await db.query('update legemiddeldata.interaksjon set utgatt_kl = now() where fest_id = $1', [id![0]])
    expect(await oppslag(id![0])).toEqual({ gruppenavn: null, substanser: 0 })
    await db.query('update legemiddeldata.interaksjon set utgatt_kl = null where fest_id = $1', [id![0]])
    expect(await oppslag(id![0])).toEqual(forst)

    // Som synkroniseringen: nye data med ny kontrollsum.
    await db.query(
      `update legemiddeldata.interaksjon
       set data = jsonb_set(data, '{substansgrupper,0,navn}', '"Syntetisk gruppe"'),
           hash = md5(jsonb_set(data, '{substansgrupper,0,navn}', '"Syntetisk gruppe"')::text)
       where fest_id = $1`,
      [id![0]],
    )
    expect((await oppslag(id![0])).gruppenavn![0]).toBe('Syntetisk gruppe')
  })

  it('navngir en gruppe som siden gjør det', async () => {
    const navn = async (gruppe: unknown) =>
      (await db.query<{ n: string }>('select legemiddeldata.gruppenavn($1::jsonb) as n', [JSON.stringify(gruppe)])).rows[0]!.n
    const s = (navn: string, kode: string | null) => ({ navn, atc: kode ? { kode, tekst: navn } : null, virkestoff_id: null })
    expect(await navn({ navn: 'Johannesurt', substanser: [s('Hyperforin', null)] })).toBe('Johannesurt')
    // Stoffet med den overordnede koden, når den omfatter alle de andre.
    expect(await navn({ navn: null, substanser: [s('Aa', 'N06AA09'), s('Trisykliske', 'N06AA'), s('Bb', null)] })).toBe(
      'Trisykliske',
    )
    // Ellers stoffene, én gang hver, i rekkefølgen de står.
    expect(await navn({ navn: '', substanser: [s('Bb', 'A01'), s('Aa', 'B01'), s('Bb', 'A01'), s('', null)] })).toBe('Bb, Aa')
    expect(await navn({ substanser: [] })).toBe('')
    expect(await navn({ substanser: 'ikke en liste' })).toBe('')
  })
})

describe('versjonene', () => {
  async function publiser(navn: string) {
    const lager = lagFaginnholdslager(kall.klientFor(admin))
    await lager.opprettUtkast('infoside', { navn })
    const leser = lagFaginnholdsleser(kall.klientFor(admin))
    for (const steg of publiseringsplan(await leser.lesStoffside(stoffslug(navn), 'utkast'))) {
      await lager.publiserUtkast(steg.id, steg.revisjon)
    }
  }

  it('endrer versjonen for sidene når noe publiseres, men ikke for et utkast', async () => {
    const versjoner = lagVersjonsleser(brukerklient)
    const forst = await versjoner()
    expect(forst.fest).toMatch(/^[1-9]\d*$/)
    expect(Object.keys(forst).sort()).toEqual(['clinpgx', 'cpic', 'fest', 'sider'])

    await lagFaginnholdslager(kall.klientFor(admin)).opprettUtkast('infoside', { navn: 'Bare utkast' })
    expect((await versjoner()).sider).toBe(forst.sider)

    await publiser('Syntetisk publisert')
    const etter = await versjoner()
    expect(etter.sider).not.toBe(forst.sider)
    expect({ ...etter, sider: forst.sider }).toEqual(forst)
  })

  it('endrer versjonen for FEST når en ny synkronisering er fullført', async () => {
    const versjoner = lagVersjonsleser(brukerklient)
    const forst = await versjoner()
    await db.query(`update legemiddeldata.synkroniseringer set etag = null, parserversjon = parserversjon - 1`)
    await synkroniserUtdrag(db)
    expect((await versjoner()).fest).not.toBe(forst.fest)
  })
})
