/**
 * Driftstatusen for datakildene: lesefunksjonen administratorene bruker, mot
 * en ekte database bygd av migrasjonene, og vurderingen og tekstene appen lager
 * av den. Selve endringsdeteksjonen prøves der synkroniseringene prøves
 * (`clinpgx.test.ts`, `cpic.test.ts`).
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  endringstittel,
  feltendringer,
  intervallDogn,
  jobbnavn,
  KILDEOPPSETT,
  kildeintervaller,
  lagDatakildeleser,
  lesDatakildestatus,
  sporlinje,
  TOM_DATAKILDESTATUS,
  vurderKilder,
  type Datakildestatus,
  type Endring,
  type Kjoring,
} from '../datakilder/status'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

describe('lesefunksjonen', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let admin: string
  let bruker: string

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lea', etternavn: 'Leser', rolle: 'user' })
    kall = faginnholdskall(db, admin)

    // Kjøringer fra hver kilde, og endringer til dem.
    await db.exec(`
      insert into clinpgx.synkroniseringer (status, utlost_av, startet_kl, avsluttet_kl, parserversjon, antall)
      values ('fullfort', 'cron', '2026-09-21T02:30:00Z', '2026-09-21T02:35:00Z', 1, '{"hentet": 2}'),
             ('delvis', 'manuell', '2026-09-26T08:00:00Z', '2026-09-26T08:04:00Z', 1, '{"hentet": 1, "feilet": 1}');
      insert into cpic.synkroniseringer (status, startet_kl, avsluttet_kl, release, skjemaversjon, parserversjon)
      values ('fullfort', '2026-09-22T02:45:00Z', '2026-09-22T02:46:00Z', 'v1.60.1', '82', 1),
             ('feilet', '2026-09-26T09:00:00Z', '2026-09-26T09:00:10Z', null, null, null),
             -- Uendret, men uten release: CPICs releaseside svarte ikke.
             ('uendret', '2026-09-26T10:00:00Z', '2026-09-26T10:00:05Z', null, null, 1);
      insert into datakilder.endringer (kilde, synk_id, type, objekt_id, kontekst, art, niva, etikett, felt, foer, etter, spor, registrert_kl)
      values
        ('clinpgx', 2, 'retningslinje', 'PA166104980', null, 'endret', 'klinisk', 'Annotation of CPIC Guideline for sertraline',
         '{sammendrag}', '{"sammendrag": "Gammel"}', '{"sammendrag": "Ny"}', '{"kildenotat": {"merknad": "Updated"}}', '2026-09-26T08:02:00Z'),
        ('clinpgx', 2, 'klinisk', '1447954390', 'PA451333', 'fjernet', 'klinisk', 'CYP2C19 · *2', '{}', '{"id": "1447954390"}', null, '{}', '2026-09-26T08:03:00Z'),
        ('clinpgx', 2, 'retningslinje', 'PA166104981', null, 'endret', 'metadata', 'Annotation of DPWG Guideline', '{navn}', '{}', '{}', '{}', '2026-09-26T08:03:30Z'),
        ('cpic', 1, 'anbefaling', 'anbefaling', null, 'grunnlag', 'metadata', 'Første innlasting fra CPIC', '{}', null, null, '{"antall": 2115}', '2026-09-22T02:46:00Z');
    `)
  }, 60_000)

  it('gir administratorer kjøringene med endringene talt opp, og de siste endringene uten transaksjons-ID', async () => {
    const status = lesDatakildestatus((await kall.klientFor(admin).rpc('datakilder_status', {})).data)
    expect(status.kjoringer.map((k) => [k.kilde, k.id, k.status])).toEqual([
      ['clinpgx', 2, 'delvis'],
      ['clinpgx', 1, 'fullfort'],
      ['cpic', 3, 'uendret'],
      ['cpic', 2, 'feilet'],
      ['cpic', 1, 'fullfort'],
    ])
    expect(status.kjoringer[0]).toMatchObject({ utlost_av: 'manuell', versjon: '1', endringer: { klinisk: 2, metadata: 1, grunnlag: 0 } })
    expect(status.kjoringer[4]).toMatchObject({ release: 'v1.60.1', versjon: '82', endringer: { klinisk: 0, metadata: 0, grunnlag: 1 } })
    expect(status.endringer.map((e) => e.objekt_id)).toEqual(['PA166104981', '1447954390', 'PA166104980', 'anbefaling'])
    // Siste kjente release og versjon står selv om siste kjøring ikke fikk dem oppgitt.
    expect(status.kilder).toEqual({
      clinpgx: { release: null, versjon: '1', sist_vellykket_kl: expect.stringMatching(/^2026-09-26T08:04:00/) },
      cpic: { release: 'v1.60.1', versjon: '82', sist_vellykket_kl: expect.stringMatching(/^2026-09-26T10:00:05/) },
    })
    expect(vurderKilder(status).find((v) => v.kilde === 'cpic')).toMatchObject({ release: 'v1.60.1', versjon: '82' })

    // Grensen gjelder hver kilde for seg: mange nye føringer i den ene skyver ikke den andre ut.
    const { data } = await kall.klientFor(admin).rpc('datakilder_status', { antall: 1 })
    expect(JSON.stringify(data)).not.toContain('txid')
    expect(JSON.stringify(data)).not.toContain('"nr"')
    expect(lesDatakildestatus(data).endringer.map((e) => e.objekt_id)).toEqual(['PA166104981', 'anbefaling'])
  })

  it('er bare for administratorer, og ingen andre når tabellene', async () => {
    const { error } = await kall.klientFor(bruker).rpc('datakilder_status', {})
    expect(error).toMatchObject({ code: '42501' })
    const tabell = await feilFra(() =>
      db.transaction(async (tx) => {
        await tx.query(`select set_config('role', 'authenticated', true)`)
        await tx.query('select * from datakilder.endringer')
      }),
    )
    expect(tabell?.code).toBe('42501')
  })

  it('leser statusen gjennom klienten, og ber serveren hente med innloggingen', async () => {
    const kalt: { url: string; init?: RequestInit }[] = []
    const klient = {
      ...kall.klientFor(admin),
      auth: { getSession: async () => ({ data: { session: { access_token: 'tokenet' } } }) },
    } as unknown as Parameters<typeof lagDatakildeleser>[0]
    const leser = lagDatakildeleser(klient, (async (url: string, init?: RequestInit) => {
      kalt.push({ url, init })
      return new Response(JSON.stringify({ status: 'uendret' }))
    }) as unknown as typeof fetch)
    expect((await leser.status()).kjoringer).toHaveLength(5)
    expect(await leser.hentNa('cpic')).toEqual({ status: 'uendret' })
    expect(kalt).toEqual([{ url: '/api/cpic-synk', init: { method: 'POST', headers: { authorization: 'Bearer tokenet' } } }])

    const avvist = lagDatakildeleser(klient, (async () => new Response(JSON.stringify({ feil: 'Ikke tilgang.' }), { status: 401 })) as unknown as typeof fetch)
    await expect(avvist.hentNa('clinpgx')).rejects.toThrow('Ikke tilgang.')

    // FEST hentes med samme innlogging, fra sitt eget endepunkt.
    await leser.hentNa('fest')
    expect(kalt.at(-1)).toEqual({ url: '/api/legemiddeldata-synk', init: { method: 'POST', headers: { authorization: 'Bearer tokenet' } } })
  })
})

describe('FEST i lesefunksjonen', () => {
  it('gir FEST-kjøringene med uttrekksdatoen som versjon og radene som ble byttet inn', async () => {
    const db = await nyDatabase()
    const admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    await db.exec(`
      insert into legemiddeldata.synkroniseringer (kilde, status, utlost_av, startet_kl, avsluttet_kl, kildedato, antall, feil)
      values ('FEST', 'fullfort', 'cron', '2026-09-24T04:15:00Z', '2026-09-24T04:16:00Z', '2026-09-08T03:09:06',
              '{"merkevare": {"inn": 8962, "nye": 3, "endrede": 10, "utgatte": 1}, "pakning": {"inn": 10828, "nye": 2, "endrede": 0, "utgatte": 0}}', null),
             ('FEST', 'uendret', 'cron', '2026-09-25T04:15:00Z', '2026-09-25T04:15:05Z', null, null, null),
             ('FEST', 'feilet', 'manuell', '2026-09-26T08:00:00Z', '2026-09-26T08:00:40Z', null, null, 'Strukturkontrollen stoppet FEST-uttrekket.');
    `)
    const status = lesDatakildestatus((await faginnholdskall(db, admin).klientFor(admin).rpc('datakilder_status', {})).data)
    expect(status.kjoringer.map((k) => [k.kilde, k.id, k.status, k.utlost_av])).toEqual([
      ['fest', 3, 'feilet', 'manuell'],
      ['fest', 2, 'uendret', 'cron'],
      ['fest', 1, 'fullfort', 'cron'],
    ])
    expect(status.kjoringer[2]).toMatchObject({ versjon: '2026-09-08T03:09:06', rader: { nye: 5, endrede: 10, utgatte: 1 } })
    expect(status.kjoringer[0]).toMatchObject({ feil: 'Strukturkontrollen stoppet FEST-uttrekket.', rader: null })
    expect(status.kilder).toEqual({
      fest: { release: null, versjon: '2026-09-08T03:09:06', sist_vellykket_kl: expect.stringMatching(/^2026-09-25T04:15:05/) },
    })
  }, 60_000)

  it('vet når siste vellykkede henting var, også etter flere feilede enn kjøringene som følger med', async () => {
    const db = await nyDatabase()
    const admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    await db.exec(`
      insert into legemiddeldata.synkroniseringer (kilde, status, startet_kl, avsluttet_kl, kildedato, antall)
      values ('FEST', 'fullfort', '2026-09-10T04:15:00Z', '2026-09-10T04:16:00Z', '2026-09-08T03:09:06', '{}');
      insert into legemiddeldata.synkroniseringer (kilde, status, startet_kl, avsluttet_kl, feil)
      select 'FEST', 'feilet', t, t + interval '1 minute', 'Strukturkontrollen stoppet FEST-uttrekket.'
      from generate_series(timestamptz '2026-09-14T04:15:00Z', timestamptz '2026-09-25T04:15:00Z', interval '1 day') t;
    `)
    const status = lesDatakildestatus((await faginnholdskall(db, admin).klientFor(admin).rpc('datakilder_status', {})).data)
    expect(status.kjoringer.map((k) => k.status)).toEqual(Array(10).fill('feilet'))
    const fest = vurderKilder(status, Date.parse('2026-09-26T12:00:00Z'), { fest: 1, clinpgx: 7, cpic: 7 }).find((v) => v.kilde === 'fest')!
    expect(fest.sisteVellykkede).toBeNull()
    expect(fest.sistVellykketKl).toMatch(/^2026-09-10T04:16:00/)
    expect(fest).toMatchObject({ tilstand: 'feil', versjon: '2026-09-08T03:09:06' })
    expect(fest.melding).toContain('OUSFAR bruker fortsatt siste gyldige FEST-data')
    expect(fest.melding).not.toContain('Ingen henting har lyktes ennå')
  }, 60_000)
})

/* --- Vurderingen og tekstene ------------------------------------------------ */

const NA = Date.parse('2026-09-26T12:00:00Z')

function kjoring(kilde: Kjoring['kilde'], id: number, status: Kjoring['status'], startet: string, ekstra: Partial<Kjoring> = {}): Kjoring {
  return {
    kilde, id, status, utlost_av: 'cron', startet_kl: startet, avsluttet_kl: startet, release: null, versjon: null, feil: null,
    endringer: { klinisk: 0, metadata: 0, grunnlag: 0 },
    ...ekstra,
  }
}

function endring(ekstra: Partial<Endring>): Endring {
  return {
    id: 1, kilde: 'cpic', synk_id: 1, type: 'anbefaling', objekt_id: '1', kontekst: null, art: 'endret', niva: 'klinisk',
    etikett: 'amitriptyline · CYP2C19 Poor Metabolizer', felt: [], foer: null, etter: null, spor: {}, registrert_kl: '2026-09-26T09:00:00Z',
    ...ekstra,
  }
}

const vurder = (kjoringer: Kjoring[], kilder?: Datakildestatus['kilder']) => {
  const status: Datakildestatus = { kjoringer, endringer: [], kilder }
  return Object.fromEntries(vurderKilder(status, NA, { fest: 1, clinpgx: 7, cpic: 7 }).map((v) => [v.kilde, v]))
}

describe('vurderingen', () => {
  it('leser intervallet av cron-uttrykkene i vercel.json', () => {
    expect(intervallDogn('30 2 * * 1')).toBe(7)
    expect(intervallDogn('15 4 * * *')).toBe(1)
    expect(intervallDogn('0 3 1 * *')).toBeNull()
    expect(kildeintervaller()).toEqual({ fest: 1, clinpgx: 7, cpic: 7 })
    expect([jobbnavn(1), jobbnavn(7), jobbnavn(null)]).toEqual(['Nattlig jobb', 'Ukentlig jobb', 'Planlagt jobb'])
  })

  it('er i orden når siste kjøring gikk bra innenfor intervallet, og sier hva den fant', () => {
    const v = vurder([
      kjoring('clinpgx', 2, 'fullfort', '2026-09-26T02:30:00Z', { endringer: { klinisk: 2, metadata: 5, grunnlag: 0 } }),
      kjoring('cpic', 1, 'uendret', '2026-09-22T02:45:00Z'),
    ])
    expect(v.clinpgx).toMatchObject({ tilstand: 'ok', melding: 'Siste henting fant 2 kliniske endringer.' })
    expect(v.cpic).toMatchObject({ tilstand: 'ok', melding: 'Siste henting fant ingen endringer.' })
  })

  it('sier fra når siste kjøring feilet, var delvis, henger eller er for gammel, og at dataene fra før står', () => {
    const v = vurder([
      kjoring('clinpgx', 2, 'delvis', '2026-09-26T02:30:00Z'),
      kjoring('cpic', 3, 'feilet', '2026-09-26T09:00:00Z', { feil: 'CPIC svarte 500' }),
      kjoring('cpic', 2, 'fullfort', '2026-09-22T02:45:00Z'),
    ])
    expect(v.clinpgx).toMatchObject({
      tilstand: 'advarsel',
      melding: 'Siste henting var delvis: det som feilet eller ble utsatt, står med dataene fra før.',
    })
    expect(v.cpic).toMatchObject({ tilstand: 'feil', melding: 'Siste henting feilet: CPIC svarte 500. Dataene fra siste vellykkede henting står.' })
    expect(v.cpic!.sisteVellykkede!.id).toBe(2)

    // ClinPGx byttes inn ett kjemikalie om gangen, så en feil midt i kjøringen
    // kan ha latt noen av dem bli oppdatert. CPIC byttes inn samlet.
    const clinpgx = vurder([
      kjoring('clinpgx', 3, 'feilet', '2026-09-26T09:00:00Z', { feil: 'Forbindelsen brøt' }),
      kjoring('clinpgx', 2, 'fullfort', '2026-09-22T02:30:00Z'),
    ]).clinpgx
    expect(clinpgx).toMatchObject({
      tilstand: 'feil',
      melding: 'Siste henting feilet: Forbindelsen brøt. Kjemikalier som ble hentet før feilen, kan være oppdatert; de andre står som før.',
    })
    expect(vurder([kjoring('cpic', 1, 'feilet', '2026-09-26T09:00:00Z', { feil: 'x' })]).cpic!.melding).toBe(
      'Siste henting feilet: x. Ingen henting har lyktes ennå.',
    )

    // Grensen er intervallet og ett døgn til.
    const akkurat = vurder([kjoring('cpic', 1, 'fullfort', '2026-09-18T12:00:00Z')])
    expect(akkurat.cpic!.tilstand).toBe('ok')
    const gammel = vurder([kjoring('cpic', 1, 'fullfort', '2026-09-18T11:59:00Z')])
    expect(gammel.cpic).toMatchObject({ tilstand: 'advarsel', melding: 'Ingen vellykket henting på 8 døgn; CPIC hentes hver uke.' })

    const henger = vurder([kjoring('cpic', 1, 'pagar', '2026-09-26T11:00:00Z')])
    expect(henger.cpic!.tilstand).toBe('advarsel')
    expect(vurder([kjoring('cpic', 1, 'pagar', '2026-09-26T11:45:00Z')]).cpic).toMatchObject({ tilstand: 'ok', melding: 'Henter nå.' })
    expect(vurder([]).clinpgx).toMatchObject({ tilstand: 'advarsel', melding: 'Ingen henting fra ClinPGx er logget ennå.' })
  })

  it('vurderer FEST etter den nattlige jobben, med radene og teksten om at de gyldige dataene brukes', () => {
    const rader = { nye: 3, endrede: 12, utgatte: 1 }
    expect(vurder([kjoring('fest', 1, 'fullfort', '2026-09-26T04:15:00Z', { rader })]).fest).toMatchObject({
      tilstand: 'ok',
      intervall: 1,
      melding: 'Siste henting byttet inn et nytt uttrekk (rader nye: 3, endrede: 12, utgåtte: 1).',
    })
    expect(vurder([kjoring('fest', 2, 'uendret', '2026-09-26T04:15:00Z')]).fest!.melding).toBe('Siste henting fant ingen endringer.')

    // Hver natt: gammel etter to døgn, ikke etter en uke som ClinPGx og CPIC.
    expect(vurder([kjoring('fest', 1, 'uendret', '2026-09-24T12:00:00Z')]).fest!.tilstand).toBe('ok')
    expect(vurder([kjoring('fest', 1, 'uendret', '2026-09-24T11:59:00Z')]).fest).toMatchObject({
      tilstand: 'advarsel',
      melding: 'Ingen vellykket henting på 2 døgn; FEST hentes hver natt.',
    })

    const feilet = vurder([
      kjoring('fest', 2, 'feilet', '2026-09-26T04:15:00Z', { feil: 'Uttrekket ser ufullstendig ut: 0 rader av typen merkevare, mot 8962 i dag.' }),
      kjoring('fest', 1, 'fullfort', '2026-09-25T04:15:00Z', { versjon: '2026-09-08T03:09:06' }),
    ]).fest!
    expect(feilet).toMatchObject({
      tilstand: 'feil',
      versjon: '2026-09-08T03:09:06',
      melding:
        'Siste henting feilet: Uttrekket ser ufullstendig ut: 0 rader av typen merkevare, mot 8962 i dag. ' +
        'OUSFAR bruker fortsatt siste gyldige FEST-data; ingenting fra den feilede hentingen er tatt i bruk.',
    })
    expect(feilet.sisteVellykkede!.id).toBe(1)
    expect(feilet.sistVellykketKl).toBe('2026-09-25T04:15:00Z')

    // Er den vellykkede eldre enn kjøringene som følger med, står den i det siste kjente om kilden.
    const eldre = vurder([kjoring('fest', 20, 'feilet', '2026-09-26T04:15:00Z', { feil: 'x' })], {
      fest: { release: null, versjon: null, sist_vellykket_kl: '2026-09-10T04:16:00Z' },
    }).fest!
    expect(eldre).toMatchObject({ sisteVellykkede: null, sistVellykketKl: '2026-09-10T04:16:00Z' })
    expect(eldre.melding).toBe('Siste henting feilet: x. ' + KILDEOPPSETT.fest.beholdt)
    expect(KILDEOPPSETT.fest.visVersjon!('2026-09-08T03:09:06')).toBe('08.09.2026')
  })

  it('tar med feilene når en ClinPGx-kjøring var delvis', () => {
    const v = vurder([kjoring('clinpgx', 2, 'delvis', '2026-09-26T02:30:00Z', { feil: 'PA451333: Svaret fra ClinPGx har trolig endret form.' })])
    expect(v.clinpgx!.melding).toBe(
      'Siste henting var delvis: det som feilet eller ble utsatt, står med dataene fra før. Feil: PA451333: Svaret fra ClinPGx har trolig endret form.',
    )
  })

  it('viser siste kjente release fra en vellykket kjøring når den siste ikke fikk den oppgitt', () => {
    const v = vurder([
      kjoring('cpic', 4, 'feilet', '2026-09-26T09:00:00Z', { release: 'v9.9.9' }),
      kjoring('cpic', 3, 'uendret', '2026-09-25T02:45:00Z'),
      kjoring('cpic', 2, 'fullfort', '2026-09-22T02:45:00Z', { release: 'v1.60.1', versjon: '82' }),
    ])
    expect(v.cpic).toMatchObject({ release: 'v1.60.1', versjon: '82' })
    expect(v.clinpgx).toMatchObject({ release: null, versjon: null })
  })

  it('leser svaret defensivt', () => {
    expect(lesDatakildestatus(null)).toEqual(TOM_DATAKILDESTATUS)
    expect(
      lesDatakildestatus({
        kjoringer: [{ kilde: 'ukjent', id: 1, status: 'fullfort', startet_kl: 'x' }, { kilde: 'cpic', id: 2, status: 'rar', startet_kl: 'x' }],
        endringer: [{ id: 1, kilde: 'cpic', art: 'endret', type: 'gen', objekt_id: 'CYP2D6', registrert_kl: 'x', felt: ['a', 3] }, 'tull'],
      }),
    ).toEqual({
      kjoringer: [],
      endringer: [expect.objectContaining({ etikett: 'CYP2D6', niva: 'klinisk', felt: ['a'], spor: {} })],
      kilder: {},
    })
  })
})

describe('tekstene for en endring', () => {
  it('sier hva som er endret, før og etter, og hvor det kom fra', () => {
    const e = endring({
      felt: ['anbefaling', 'raa.version'],
      foer: { anbefaling: 'Gammel tekst', version: 1 },
      etter: { anbefaling: 'Ny tekst', version: 2 },
      spor: { cpic_versjon: { foer: 1, etter: 2 } },
    })
    expect(endringstittel(e)).toBe('Endret · Anbefaling')
    expect(feltendringer(e)).toEqual([
      { felt: 'anbefaling', foer: 'Gammel tekst', etter: 'Ny tekst' },
      { felt: 'rådata: version', foer: '1', etter: '2' },
    ])
    expect(sporlinje(e)).toBe('CPIC-versjon 1 → 2')
    expect(feltendringer(endring({ art: 'ny', felt: [] }))).toEqual([])

    const clinpgx = endring({
      kilde: 'clinpgx', type: 'klinisk', art: 'fjernet', kontekst: 'PA451333',
      spor: { kildenotat: { dato: '2026-09-20T00:00:00-07:00', merknad: 'Downgraded' } },
    })
    expect(endringstittel(clinpgx)).toBe('Fjernet · Klinisk annotasjon')
    expect(sporlinje(clinpgx)).toBe('for PA451333 · ClinPGx: Downgraded (2026-09-20)')
    expect(sporlinje(endring({ art: 'grunnlag', spor: { antall: 2115 } }))).toBe('2115 rader')
    expect(endringstittel({ art: 'ny', type: 'noe_nytt' })).toBe('Ny · noe_nytt')
  })
})
