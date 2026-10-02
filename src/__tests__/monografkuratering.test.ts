/**
 * Hjelpefunksjonene for monografkurateringer (`*_monografkuratering_hjelpere.sql`)
 * og malen i `supabase/maler/monografkuratering.sql`, prøvd mot en ekte
 * database: en tom database uten kuratorprofil, preflighten som binder hver
 * endring til objektet og revisjonen kuratoren kontrollerte, og at et duplikat
 * eller parallelt redaksjonelt arbeid stopper migrasjonen før noe er endret.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  faginnholdskall,
  feilFra,
  migrasjonsfiler,
  MONOGRAFKURATERING,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const MIGRASJONER = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))
const MAL = readFileSync(fileURLToPath(new URL('../../supabase/maler/monografkuratering.sql', import.meta.url)), 'utf8')
const MAL_KILDE = 'Monografkuratering av eksempelstoff 02.10.2026: farmakodynamikk og dosering'

/** Malen, for en annen side. */
const malFor = (slug: string) => MAL.replaceAll('eksempelstoff', slug)

const dokument = (tekst: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }],
})

interface Eksempelside {
  side: string
  d2: string
  h1: string
  dosering: string
}

/**
 * En publisert side slik malen venter den: to mekanismekort på revisjon 1 og
 * doseringsteksten på revisjon 2.
 */
async function eksempelside(kall: Faginnholdskall, navn: string): Promise<Eksempelside> {
  const side = (await kall.opprett('infoside', { navn })).id
  await kall.publiser(side, 1)
  const element = async (panel: string, posisjon: number, elementtype: string, data: Record<string, unknown>) => {
    const id = (await kall.opprett('innholdselement', { infoside: side, panel, posisjon, elementtype, data, referanser: [] })).id
    await kall.publiser(id, 1)
    return id
  }
  const d2 = await element('farmakodynamikk', 0, 'mekanismekort', {
    maal: 'D2-reseptor',
    mekanisme: 'antagonisme',
    dokument: dokument('D2 før kurateringen'),
  })
  const h1 = await element('farmakodynamikk', 1, 'mekanismekort', {
    maal: 'H1-reseptor',
    mekanisme: 'antagonisme',
    dokument: dokument('H1 før kurateringen'),
  })
  const dosering = await element('dosering', 0, 'riktekst', { dokument: dokument('Dosering, første utgave') })
  await kall.lagre(dosering, 1, {
    infoside: side,
    panel: 'dosering',
    posisjon: 0,
    elementtype: 'riktekst',
    data: { dokument: dokument('Dosering, andre utgave') },
    referanser: [],
  })
  await kall.publiser(dosering, 2)
  return { side, d2, h1, dosering }
}

interface Tilstand {
  objekt_id: string
  panel: string
  utkast: number
  publisert: number
  data: Record<string, unknown>
  referanser: string[]
  kilde: string | null
}

/** Elementene på siden slik de står, med revisjonene og kilden i den publiserte. */
async function tilstand(db: PGlite, side: string): Promise<Tilstand[]> {
  const { rows } = await db.query<Tilstand>(
    `select e.objekt_id, e.panel, u.revisjon as utkast, p.revisjon as publisert, e.data,
       coalesce(r.innhold->'referanser', '[]'::jsonb) as referanser, r.kilde
     from public.innholdselementer e
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and e.infoside_id = $1
     order by e.panel, e.posisjon, e.objekt_id`,
    [side],
  )
  return rows
}

async function antallReferanser(db: PGlite): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.referanser where tilstand = 'publisert'`)
  return rows[0]!.n
}

/** Feilmeldingen migrasjonen stoppet med, og at ingenting på siden eller i referansene ble endret. */
async function forventStopp(db: PGlite, side: string, sql: string, melding: RegExp) {
  const for_ = await tilstand(db, side)
  const referanser = await antallReferanser(db)
  const feil = await feilFra(() => db.exec(sql))
  expect(feil?.message).toMatch(melding)
  expect(await tilstand(db, side)).toEqual(for_)
  expect(await antallReferanser(db)).toBe(referanser)
}

describe('monografkurateringene i migrasjonene', () => {
  it('heter *_monografkuratering*.sql, så testene kjenner dem igjen', () => {
    const medHjelperne = migrasjonsfiler().filter((f) =>
      /(?<!function )intern\.kuratering_start\(/.test(readFileSync(`${MIGRASJONER}/${f}`, 'utf8')),
    )
    for (const fil of medHjelperne) expect(fil).toMatch(MONOGRAFKURATERING)
    expect('20261003120000_sertralin_monografkuratering.sql').toMatch(MONOGRAFKURATERING)
    // Hjelpefunksjonene selv er ingen kuratering og kjøres alltid.
    expect(migrasjonsfiler().filter((f) => f.endsWith('_monografkuratering_hjelpere.sql'))).toHaveLength(1)
    expect('20261002071332_monografkuratering_hjelpere.sql').not.toMatch(MONOGRAFKURATERING)
    expect('20261002075626_monografkuratering_hjelpere_retting.sql').not.toMatch(MONOGRAFKURATERING)
    expect('20261002082956_monografkuratering_hjelpere_referanselenke.sql').not.toMatch(MONOGRAFKURATERING)
    expect('20261002093500_monografkuratering_hjelpere_arkiverte_utkast.sql').not.toMatch(MONOGRAFKURATERING)
  })
})

describe('monografmigrasjoner uten kuratorprofil', () => {
  let tom: PGlite

  beforeAll(async () => {
    tom = await nyDatabase()
  }, 240_000)

  it('hele migrasjonskjeden kjører på en tom database uten kuratorprofil', async () => {
    const { rows } = await tom.query<{ n: number }>('select count(*)::int as n from public.profiles')
    expect(rows[0]!.n).toBe(0)
    // Malen, som enhver kuratering bygd på den, gjør ingenting her.
    await tom.exec(MAL)
    const { rows: elementer } = await tom.query<{ n: number }>('select count(*)::int as n from public.innholdselementer')
    expect(elementer[0]!.n).toBe(0)
  })

  let side: string

  it('hopper over også når en tidligere migrasjon har laget siden, så lenge ingen profiler finnes', async () => {
    const importen = await opprettBruker(tom, { brukernavn: 'import', fornavn: 'Im', etternavn: 'Port', rolle: 'admin' })
    side = (await eksempelside(faginnholdskall(tom, importen), 'Eksempelstoff')).side
    // Siden står igjen uten noen profiler, slik den gjør etter en import i en fersk kjede.
    await tom.exec(`set session_replication_role = replica; delete from public.profiles; set session_replication_role = origin;`)
    const for_ = await tilstand(tom, side)
    await tom.exec(MAL)
    expect(await tilstand(tom, side)).toEqual(for_)
  })

  it('stopper når siden og andre profiler finnes, men ikke kuratoren, i stedet for å hoppe over i stillhet', async () => {
    await opprettBruker(tom, { brukernavn: 'rita', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await forventStopp(tom, side, MAL, /finnes, men ikke administratoren peohol/)
  })
})

describe('monografkuratering med kuratorprofil', () => {
  let db: PGlite
  let kall: Faginnholdskall

  beforeAll(async () => {
    db = await nyDatabase()
    const peohol = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Peder', etternavn: 'Kurator', rolle: 'admin' })
    kall = faginnholdskall(db, peohol)
  }, 240_000)

  it('malen endrer nøyaktig de kontrollerte objektene, med kilden i historikken, og bare én gang', async () => {
    const { side, d2, h1, dosering } = await eksempelside(kall, 'Eksempelstoff')
    await db.exec(MAL)

    const etter = await tilstand(db, side)
    const element = (id: string) => etter.find((e) => e.objekt_id === id)!
    const { rows: ref } = await db.query<{ objekt_id: string }>(
      `select objekt_id from public.referanser where tilstand = 'publisert' and lenke = 'https://example.org/eksempelkilde'`,
    )
    expect(ref).toHaveLength(1)

    expect(element(d2)).toMatchObject({ panel: 'farmakodynamikk', utkast: 2, publisert: 2, kilde: MAL_KILDE })
    expect(JSON.stringify(element(d2).data)).toContain('Kuratert tekst.')
    expect(element(d2).referanser).toEqual([ref[0]!.objekt_id])
    expect(element(h1)).toMatchObject({ panel: 'fjernet', utkast: 2, publisert: 2, kilde: MAL_KILDE })
    expect(element(dosering)).toMatchObject({ panel: 'dosering', utkast: 3, publisert: 3, kilde: MAL_KILDE })
    const nytt = etter.filter((e) => e.data.maal === '5-HT2C-reseptor')
    expect(nytt).toHaveLength(1)
    expect(nytt[0]).toMatchObject({ panel: 'farmakodynamikk', utkast: 1, publisert: 1, kilde: MAL_KILDE })

    // Kjørt en gang til: kurateringen er gjort, og ingenting endres.
    await db.exec(MAL)
    expect(await tilstand(db, side)).toEqual(etter)
  })

  it('stopper på et parallelt redaksjonelt kort med samme mål, før noe er endret', async () => {
    const { side } = await eksempelside(kall, 'Parallellstoff')
    const ekstra = await kall.opprett('innholdselement', {
      infoside: side,
      panel: 'farmakodynamikk',
      posisjon: 9,
      elementtype: 'mekanismekort',
      data: { maal: 'D2-reseptor', mekanisme: 'antagonisme', dokument: dokument('Redaksjonelt ekstra D2-kort') },
      referanser: [],
    })
    await kall.publiser(ekstra.id, 1)
    await forventStopp(db, side, malFor('parallellstoff'), /Forventet 2 mekanismekort i panelet farmakodynamikk, fant 3/)

    // Også uten antallskontrollen: ett mål, to kort, og ingen av dem velges.
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_element(intern.kuratering_start('parallellstoff'),
         'farmakodynamikk', 'mekanismekort', '{"maal": "D2-reseptor"}', 1); end $$;`,
      /Forventet nøyaktig ett element .* fant 2/,
    )
  })

  it('stopper på et nytt kort som bare finnes som utkast', async () => {
    const { side } = await eksempelside(kall, 'Utkaststoff')
    await kall.opprett('innholdselement', {
      infoside: side,
      panel: 'farmakodynamikk',
      posisjon: 9,
      elementtype: 'mekanismekort',
      data: { maal: 'D2-reseptor', mekanisme: 'agonisme', dokument: dokument('Upublisert parallelt kort') },
      referanser: [],
    })
    await forventStopp(db, side, malFor('utkaststoff'), /fant 3/)
  })

  it('stopper når et kontrollert kort har et upublisert utkast', async () => {
    const { side, d2 } = await eksempelside(kall, 'Redigertstoff')
    await kall.lagre(d2, 1, {
      infoside: side,
      panel: 'farmakodynamikk',
      posisjon: 0,
      elementtype: 'mekanismekort',
      data: { maal: 'D2-reseptor', mekanisme: 'antagonisme', dokument: dokument('Redaktøren skriver her') },
      referanser: [],
    })
    await forventStopp(db, side, malFor('redigertstoff'), /har et upublisert utkast \(revisjon 2, publisert 1\)/)
  })

  it('stopper når et kontrollert kort er endret og publisert etter preflighten', async () => {
    const { side, d2 } = await eksempelside(kall, 'Publisertstoff')
    await kall.lagre(d2, 1, {
      infoside: side,
      panel: 'farmakodynamikk',
      posisjon: 0,
      elementtype: 'mekanismekort',
      data: { maal: 'D2-reseptor', mekanisme: 'antagonisme', dokument: dokument('Publisert av redaktøren') },
      referanser: [],
    })
    await kall.publiser(d2, 2)
    await forventStopp(db, side, malFor('publisertstoff'), /står på revisjon 2, ikke 1 som preflighten kontrollerte/)
  })

  it('stopper når revisjonen har en annen kilde enn den kontrollerte', async () => {
    const { side } = await eksempelside(kall, 'Kildestoff')
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_element(intern.kuratering_start('kildestoff'),
         'farmakodynamikk', 'mekanismekort', '{"maal": "D2-reseptor"}', 1, 'En tidligere kuratering'); end $$;`,
      /har kilden «<NULL>», ikke «En tidligere kuratering»/,
    )
  })

  it('lagrer bare mot revisjonen den er bundet til', async () => {
    const { side, d2 } = await eksempelside(kall, 'Bundetstoff')
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_start('bundetstoff');
         perform intern.kuratering_lagre('${d2}', 2, '{"panel": "fjernet"}', 'Kurateringskilde'); end $$;`,
      /er ikke publisert på revisjon 2/,
    )
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_start('bundetstoff');
         perform intern.kuratering_lagre('${d2}', 1, '{"panel": "fjernet"}', ''); end $$;`,
      /må ha en kilde i historikken/,
    )
  })

  it('legger ikke til et kort som alt finnes, og velger ikke mellom like referanser', async () => {
    const { side } = await eksempelside(kall, 'Duplikatstoff')
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_nytt(intern.kuratering_start('duplikatstoff'),
         '{"panel": "farmakodynamikk", "posisjon": 5, "elementtype": "mekanismekort",
           "data": {"maal": "H1-reseptor", "mekanisme": "antagonisme"}, "referanser": []}',
         '{"maal": "H1-reseptor"}', 'Kurateringskilde'); end $$;`,
      /Det finnes alt 1 element\(er\) farmakodynamikk mekanismekort/,
    )

    const referanse = { tittel: 'Dobbel', forfattere: 'A', aar: '2026', lenke: 'https://example.org/dobbel' }
    for (const tittel of ['Dobbel', 'Dobbel igjen']) {
      await kall.publiser((await kall.opprett('referanse', { ...referanse, tittel })).id, 1)
    }
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_start('duplikatstoff');
         perform intern.kuratering_referanse('${JSON.stringify(referanse)}', 'Kurateringskilde'); end $$;`,
      /står på 2 referanser/,
    )
    // En referanse med lenken som bare finnes som utkast, er også redaksjonelt arbeid.
    const utkast = { tittel: 'Utkast', forfattere: 'C', aar: '2026', lenke: 'https://example.org/utkast' }
    await kall.opprett('referanse', utkast)
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_start('duplikatstoff');
         perform intern.kuratering_referanse('${JSON.stringify(utkast)}', 'Kurateringskilde'); end $$;`,
      /står på en referanse som ikke er publisert med den lenken/,
    )
    const publisert = { ...utkast, lenke: 'https://example.org/publisert-og-utkast' }
    await kall.publiser((await kall.opprett('referanse', publisert)).id, 1)
    await kall.opprett('referanse', { ...publisert, tittel: 'Parallelt utkast' })
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_start('duplikatstoff');
         perform intern.kuratering_referanse('${JSON.stringify(publisert)}', 'Kurateringskilde'); end $$;`,
      /står på 2 referanser/,
    )
    await forventStopp(
      db,
      side,
      `do $$ begin perform intern.kuratering_start('duplikatstoff');
         perform intern.kuratering_referanse('{"tittel": "Ny", "forfattere": "B", "aar": "2026",
           "lenke": "https://example.org/ny"}', ' '); end $$;`,
      /må ha en kilde i historikken/,
    )
  })

  it('gjenbruker en referanse bare når lenken er publisert og utkastet er likt, og renser lenken først', async () => {
    const { side } = await eksempelside(kall, 'Lenkestoff')
    const kurater = (innhold: Record<string, unknown>) =>
      `do $$ begin perform intern.kuratering_start('lenkestoff');
         perform intern.kuratering_referanse('${JSON.stringify(innhold)}', 'Kurateringskilde'); end $$;`

    // Publisert med lenke A, og et upublisert utkast som har byttet til lenke B.
    const a = { tittel: 'Endret lenke', forfattere: 'D', aar: '2026', lenke: 'https://example.org/lenke-a' }
    const b = { ...a, lenke: 'https://example.org/lenke-b' }
    const endret = (await kall.opprett('referanse', a)).id
    await kall.publiser(endret, 1)
    await kall.lagre(endret, 1, b)
    for (const innhold of [b, a]) {
      await forventStopp(db, side, kurater(innhold), /står på en referanse som ikke er publisert med den lenken/)
    }

    // Et utkast som både bytter lenke og arkiveres, er også under redigering.
    const c = { ...a, tittel: 'Arkivert utkast', lenke: 'https://example.org/lenke-c' }
    const d = { ...c, lenke: 'https://example.org/lenke-d' }
    const arkivert = (await kall.opprett('referanse', c)).id
    await kall.publiser(arkivert, 1)
    await kall.lagre(arkivert, 1, { ...d, arkivert: true })
    for (const innhold of [d, c]) {
      await forventStopp(db, side, kurater(innhold), /står på en referanse som ikke er publisert med den lenken/)
    }

    // En referanse som er arkivert og publisert slik, er lagt bort: kurateringen lager en ny.
    const bortlagt = { ...a, tittel: 'Lagt bort', lenke: 'https://example.org/lagt-bort' }
    const gammel = (await kall.opprett('referanse', bortlagt)).id
    await kall.publiser(gammel, 1)
    await kall.lagre(gammel, 1, { ...bortlagt, arkivert: true })
    await kall.publiser(gammel, 2)
    const ny = await db.transaction(async (tx) => {
      await tx.query(`select intern.kuratering_start('lenkestoff')`)
      const { rows } = await tx.query<{ id: string }>(
        `select intern.kuratering_referanse($1::jsonb, 'Kurateringskilde') as id`,
        [JSON.stringify(bortlagt)],
      )
      return rows[0]!.id
    })
    expect(ny).not.toBe(gammel)

    await forventStopp(db, side, kurater({ ...a, lenke: '   ' }), /må ha en lenke/)

    // En lenke med mellomrom rundt finner referansen som er lagret uten dem.
    const renset = { tittel: 'Renset', forfattere: 'E', aar: '2026', lenke: 'https://example.org/renset' }
    const eksisterende = (await kall.opprett('referanse', renset)).id
    await kall.publiser(eksisterende, 1)
    const referanser = await antallReferanser(db)
    const funnet = await db.transaction(async (tx) => {
      await tx.query(`select intern.kuratering_start('lenkestoff')`)
      const { rows } = await tx.query<{ id: string }>(
        `select intern.kuratering_referanse($1::jsonb, 'Kurateringskilde') as id`,
        [JSON.stringify({ ...renset, lenke: '  https://example.org/renset ' })],
      )
      return rows[0]!.id
    })
    expect(funnet).toBe(eksisterende)
    expect(await antallReferanser(db)).toBe(referanser)
  })

  it('stopper når kuratoren finnes, men ikke siden', async () => {
    const feil = await feilFra(() => db.exec(malFor('finnesikke')))
    expect(feil?.message).toMatch(/Fant ingen publisert stoffside med nøkkelen «finnesikke»/)
  })

  it('låser elementene og referansene mot andre endringer mens kurateringen pågår', async () => {
    await eksempelside(kall, 'Laasestoff')
    const laaser = await db.transaction(async (tx) => {
      await tx.query(`select intern.kuratering_start('laasestoff')`)
      const { rows } = await tx.query<{ tabell: string }>(
        `select c.relname as tabell from pg_locks l join pg_class c on c.oid = l.relation
         where l.mode = 'ShareRowExclusiveLock' and l.granted order by 1`,
      )
      return rows.map((r) => r.tabell)
    })
    expect(laaser).toEqual(['innholdselementer', 'referanser'])
  })

  it('kan ikke kalles gjennom data-API-et', async () => {
    const { rows } = await db.query<{ rolle: string; kan: boolean }>(
      `select rolle, has_function_privilege(rolle, 'intern.kuratering_lagre(uuid, integer, jsonb, text)', 'execute') as kan
       from unnest(array['anon', 'authenticated', 'service_role']) rolle`,
    )
    expect(rows.every((r) => !r.kan)).toBe(true)
  })
})
