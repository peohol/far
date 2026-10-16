/**
 * Kurateringsgrenene (`docs/kurateringsgrener.md`, fase B2), prøvd mot en ekte
 * database bygd av migrasjonene, slik agentene (gjennom serveren, som
 * tjenesterollen) og administratorene (gjennom appen) når dem:
 *
 * - en gren endrer verken den publiserte siden eller noens utkast før den
 *   publiseres, og prøvepubliseringen etterlater ingen spor;
 * - grenen endrer bare sin egen side, og aldri en referanse som finnes;
 * - statusovergangene, rollene, at ingen godkjenner sitt eget arbeid, og at en
 *   godkjenning gjelder nøyaktig én revisjon;
 * - publiseringen er samlet: alt eller ingenting, med rapporten i
 *   endringsloggen og én ny sideversjon;
 * - konflikter med hovedversjonen og upubliserte utkast stopper publiseringen;
 * - blindfasen i en de novo-kuratering, og bivirkningsimporter i grenen.
 *
 * Innholdet er syntetisk.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

const DOK = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })
const MAL = JSON.parse(readFileSync(new URL('../../supabase/maler/bivirkningsimport.json', import.meta.url), 'utf8'))

type Json = Record<string, unknown>

interface Sammendrag {
  id: string
  stoff: string
  status: string
  revisjon: number
  runde: number
  blindfase?: boolean
  konflikt: boolean
  teknisk_ok?: boolean
  grunnversjon: number
  publisert_versjon?: number
}

interface Teknisk {
  ok: boolean
  feil?: string
  kode?: string
  rapport_ok: boolean
  rapportfeil?: string
  seksjoner?: { seksjon: string; art: string }[]
}

let db: PGlite
let admin: string
let leser: string
let kall: Faginnholdskall
let claude: string
let chatgpt: string
let lopenummer = 0

/** Et kall fra serveren for en agent: tjenesterollen, med agentnøkkelen. */
async function agent<T = Json>(nokkel: string, handling: string, data: Json = {}): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('role', 'service_role', true)`)
    await tx.query(`select set_config('request.jwt.claims', '{"role": "service_role"}', true)`)
    await tx.query(`select set_config('request.method', 'POST', true)`)
    const { rows } = await tx.query<{ svar: T }>('select public.kuratering_agent($1, $2, $3::jsonb) as svar', [
      nokkel,
      handling,
      JSON.stringify(data),
    ])
    return rows[0]!.svar
  })
}

const adm = <T = Json>(handling: string, data: Json = {}, hvem = admin) =>
  kall.rpc<{ kuratering_admin: T }>(hvem, 'kuratering_admin', { handling, data }).then((r) => r.kuratering_admin)

const kort = (side: string, panel: string, tekst: string, ekstra: Json = {}) => ({
  infoside: side,
  panel,
  posisjon: 0,
  elementtype: 'riktekst',
  data: { dokument: DOK(tekst) },
  referanser: [] as string[],
  ...ekstra,
})

async function publisert<T = Json>(slug: string) {
  return (await kall.fasit<{ s: T }>(`select public.les_stoff($1, 'publisert') as s`, [slug]))[0]!.s
}

async function antall() {
  return (
    await kall.fasit<{ endringer: number; revisjoner: number; versjoner: number; kilder: number }>(
      `select (select count(*) from public.innholdsendringer)::int as endringer,
              (select count(*) from public.objektrevisjoner)::int as revisjoner,
              (select count(*) from public.sideversjoner)::int as versjoner,
              (select count(*) from bivirkninger.kilder)::int as kilder`,
    )
  )[0]!
}

/** En publisert fagside med et doseringskort og et indikasjonskort med en kilde. */
async function nyFagside(navn = 'Grenstoff') {
  lopenummer += 1
  const side = (await kall.opprett('infoside', { navn: `${navn} ${lopenummer}` })).id
  await kall.publiser(side, 1)
  const slug = (await kall.fasit<{ slug: string }>('select slug from public.infosider where objekt_id = $1 limit 1', [side]))[0]!.slug
  const ref = (await kall.opprett('referanse', { tittel: 'Gammel kilde', forfattere: 'A', aar: '2020', lenke: `https://example.org/gren/${lopenummer}` })).id
  await kall.publiser(ref, 1)
  const dosering = (await kall.opprett('innholdselement', kort(side, 'dosering', 'Gammel dosering'))).id
  await kall.publiser(dosering, 1)
  const indikasjon = (await kall.opprett('innholdselement', kort(side, 'indikasjon', 'Gammel indikasjon', { referanser: [ref] }))).id
  await kall.publiser(indikasjon, 1)
  return { side, slug, ref, dosering, indikasjon }
}

const DOKUMENTER = ['evidensjournal', 'dekningsmatrise', 'selvtest']

/** Syntetiske arbeidsdokumenter som har formen i `docs/kuratorprotokoll.md`. */
async function gyldigeDokumenter(): Promise<Record<string, Json>> {
  const [{ punkter } = { punkter: [] }] = await kall.fasit<{ punkter: string[] }>('select kuratering.kontrollpunkter() as punkter')
  return {
    evidensjournal: {
      modus: 'kuratering',
      kunnskapsgrense: '2026-10-16',
      hovedkilder: [{ omrade: 'dosering', kilde: 'Syntetisk kilde', kontrollert: '2026-10-16' }],
      sok: [{ domene: 'dosering', hva: 'Syntetisk søk', funn: 'Ett treff' }],
      pastander: [{ pastand: 'Syntetisk påstand', grunnlag: 'Syntetisk kilde', evidensstyrke: 'moderat' }],
    },
    blindprotokoll: {
      kontrollpunkter: ['dosering'],
      kilder: [{ domene: 'dosering', kilde: 'Syntetisk kilde' }],
      konklusjoner: ['Syntetisk konklusjon'],
      adversarial: 'Syntetisk motargument vurdert.',
    },
    dekningsmatrise: {
      modus: 'kuratering',
      modell_sha256: '0'.repeat(64),
      omrader: punkter.map((nokkel) => ({ nokkel, status: 'beholdt_etter_kontroll', begrunnelse: 'Kontrollert.', kilder: ['Syntetisk kilde'], sok: [], artefakt: '', bevis: 'Lest.' })),
    },
    selvtest: {
      krav: [{ krav: 'Hver påstand har kilde', status: 'bestatt', bevis: 'Dekningsmatrisen' }],
      porter: [{ port: 'Prøvepubliseringen', status: 'bestatt', bevis: 'Revisjon 1' }],
    },
  }
}

async function medDokumenter(gren: string, arter = DOKUMENTER) {
  const dokumenter = await gyldigeDokumenter()
  for (const art of arter) await agent(claude, 'dokument', { gren, art, innhold: dokumenter[art] })
}

/** En gren med en kuratering som består prøvepubliseringen. */
async function kuratertGren(navn?: string) {
  const s = await nyFagside(navn)
  const g = await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'Syntetisk kuratering' })
  const nyRef = crypto.randomUUID()
  const svar = await agent<{ revisjon: number; teknisk: Teknisk; nye: string[] }>(claude, 'skriv', {
    gren: g.id,
    forventet_revisjon: 0,
    melding: 'Første utkast',
    endringer: [
      { ny: 'referanse', id: nyRef, innhold: { tittel: 'Ny kilde', forfattere: 'B', aar: '2026', lenke: `https://example.org/ny/${lopenummer}` } },
      { sett: s.dosering, innhold: kort(s.side, 'dosering', 'Ny dosering', { referanser: [nyRef] }) },
      { ny: 'innholdselement', innhold: kort(s.side, 'farmakokinetikk', 'Ny kinetikk') },
      { fjern: s.indikasjon },
      {
        rapport: {
          oppsummering: 'Syntetisk kuratering',
          seksjoner: [
            { seksjon: 'dosering', endret: ['Doseringen skrevet om'] },
            { seksjon: 'farmakokinetikk', nytt: ['Kinetikk lagt til'] },
            { seksjon: 'indikasjon', fjernet: ['Indikasjonen fjernet'] },
          ],
          kildegrunnlag: ['Ny kilde (2026)'],
        },
      },
    ],
  })
  return { ...s, gren: g.id, nyRef, svar }
}

async function tilGodkjent(gren: string) {
  await medDokumenter(gren)
  await agent(claude, 'til_kontroll', { gren, revisjon: 1 })
  return agent<Sammendrag>(chatgpt, 'vurder', { gren, revisjon: 1, beslutning: 'godkjent', begrunnelse: 'Kontrollert mot kildene.' })
}

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'grenadmin', fornavn: 'Gro', etternavn: 'Gren', rolle: 'admin' })
  leser = await opprettBruker(db, { brukernavn: 'grenleser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  claude = (await adm<{ nokkel: string }>('ny_agentnokkel', { agent: 'claude-monografkurator' })).nokkel
  chatgpt = (await adm<{ nokkel: string }>('ny_agentnokkel', { agent: 'chatgpt-monografkurator' })).nokkel
}, 180_000)

describe('tilgangen', () => {
  it('slipper bare inn agenter med en gyldig nøkkel, og bare gjennom serveren', async () => {
    expect(claude).toMatch(/^far_[0-9a-f]{64}$/)
    expect((await feilFra(() => agent('far_' + '0'.repeat(64), 'oversikt')))?.code).toBe('42501')
    expect((await feilFra(() => kall.rpc(admin, 'kuratering_agent', { nokkel: claude, handling: 'oversikt', data: {} })))?.code).toBe('42501')
    expect((await feilFra(() => kall.les(admin, 'select * from kuratering.grener')))?.code).toBe('42501')
    expect((await feilFra(() => adm('oversikt', {}, leser)))?.code).toBe('42501')
    // Nøkkelen lagres bare som SHA-256.
    const lagret = await kall.fasit<{ n: string }>(`select nokkel_sha256 as n from kuratering.agenter where agent = 'claude-monografkurator'`)
    expect(lagret[0]!.n).toMatch(/^[0-9a-f]{64}$/)
    expect(lagret[0]!.n).not.toContain(claude.slice(4, 20))
    const liste = await adm<{ agent: string; har_nokkel: boolean; roller: string[] }[]>('agenter')
    expect(liste).toEqual(expect.arrayContaining([expect.objectContaining({ agent: 'claude-monografkurator', har_nokkel: true, roller: ['kurator'] })]))
  })

  it('lar bare kuratorer åpne grener, og bare én aktiv per side', async () => {
    const s = await nyFagside()
    expect((await feilFra(() => agent(chatgpt, 'apne', { stoff: s.slug, formaal: 'Forsøk' })))?.code).toBe('42501')
    const g = await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'Syntetisk' })
    expect(g).toMatchObject({ stoff: s.slug, status: 'arbeid', revisjon: 0, konflikt: false })
    expect((await feilFra(() => agent(claude, 'apne', { stoff: s.slug, formaal: 'Igjen' })))?.code).toBe('PT409')
    expect((await feilFra(() => adm('forkast', { gren: g.id, grunn: 'Test' })))).toBeNull()
    expect((await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'Ny runde' })).status).toBe('arbeid')
  })
})

describe('isolasjonen', () => {
  it('endrer ingenting publisert og etterlater ingen spor før grenen publiseres', async () => {
    const s = await nyFagside()
    const for_ = await publisert(s.slug)
    const g = await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'Isolasjon' })
    const telt = await antall()
    const svar = await agent<{ revisjon: number; teknisk: Teknisk }>(claude, 'skriv', {
      gren: g.id,
      forventet_revisjon: 0,
      endringer: [{ sett: s.dosering, innhold: kort(s.side, 'dosering', 'Endret i grenen') }],
    })
    expect(svar.revisjon).toBe(1)
    expect(svar.teknisk).toMatchObject({ ok: true, rapport_ok: false, seksjoner: [{ seksjon: 'dosering', art: 'endret' }] })
    expect(await antall()).toEqual(telt)
    expect(await publisert(s.slug)).toEqual(for_)
    expect(await kall.revisjoner(s.dosering)).toHaveLength(1)

    // Forhåndsvisningen er siden slik den ville blitt publisert.
    const lest = await agent<{ grenrevisjon: { forhandsvisning: { stoff: { elementer: { innhold: Json }[] } } } }>(chatgpt, 'les', { gren: g.id })
    expect(JSON.stringify(lest.grenrevisjon.forhandsvisning.stoff)).toContain('Endret i grenen')
    expect(JSON.stringify(lest.grenrevisjon.forhandsvisning.stoff)).not.toContain('Gammel dosering')
  })

  it('endrer bare sin egen side og aldri en referanse som finnes', async () => {
    const s = await nyFagside()
    const annen = await nyFagside('Annenside')
    const g = await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'Grenser' })
    const skriv = (endringer: Json[]) => feilFra(() => agent(claude, 'skriv', { gren: g.id, forventet_revisjon: 0, endringer }))
    expect((await skriv([{ sett: s.ref, innhold: { tittel: 'Endret', forfattere: 'A', aar: '2020', lenke: 'https://example.org/x' } }]))?.message).toContain(
      'kan ikke endres i en gren',
    )
    expect((await skriv([{ sett: annen.dosering, innhold: kort(annen.side, 'dosering', 'Annen') }]))?.message).toContain('hører ikke til fagsiden')
    expect((await skriv([{ ny: 'innholdselement', innhold: kort(annen.side, 'dosering', 'Annen') }]))?.message).toContain('fagsiden grenen gjelder')
    expect((await skriv([{ sett: s.side, innhold: { navn: 'Nytt navn', slug: s.slug, panelreferanser: {} } }]))?.message).toContain('navnet og nøkkelen')
    expect(
      (await skriv([{ ny: 'referanse', innhold: { tittel: 'Dobbel', forfattere: 'A', aar: '2020', lenke: `https://example.org/gren/${lopenummer - 1}` } }]))
        ?.message,
    ).toContain('Bruk den')
    // En ny referanse i grenen kontrolleres på nytt når den endres.
    const ny = crypto.randomUUID()
    const nyRef = (lenke: string) => ({ tittel: 'Ny', forfattere: 'A', aar: '2026', lenke })
    expect((await skriv([{ ny: 'referanse', id: ny, innhold: nyRef('https://example.org/egen') }, { sett: ny, innhold: nyRef('') }]))?.message).toContain(
      'må ha en lenke',
    )
    expect(
      (await skriv([{ ny: 'referanse', id: ny, innhold: nyRef('https://example.org/egen') }, { sett: ny, innhold: nyRef(`https://example.org/gren/${lopenummer}`) }]))
        ?.message,
    ).toContain('Bruk den')
    expect(
      (
        await skriv([
          { ny: 'referanse', innhold: nyRef('https://example.org/a') },
          { ny: 'referanse', id: ny, innhold: nyRef('https://example.org/b') },
          { sett: ny, innhold: nyRef('https://example.org/a') },
        ])
      )?.message,
    ).toContain('alt en ny referanse med lenken')
    expect(await skriv([{ ny: 'referanse', id: ny, innhold: nyRef('https://example.org/egen') }, { sett: ny, innhold: nyRef('https://example.org/egen') }])).toBeNull()
    expect((await feilFra(() => agent(chatgpt, 'skriv', { gren: g.id, forventet_revisjon: 0, endringer: [{ rapport: null }] })))?.code).toBe('42501')
    expect((await feilFra(() => agent(claude, 'skriv', { gren: g.id, forventet_revisjon: 3, endringer: [{ rapport: null }] })))?.code).toBe('PT409')
  })

  it('melder en feil databasen ville stoppet, uten å stoppe lagringen i grenen', async () => {
    const s = await nyFagside()
    const g = await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'Feil' })
    // To tekstkort i samme panel er ikke lov på siden.
    const svar = await agent<{ teknisk: Teknisk }>(claude, 'skriv', {
      gren: g.id,
      forventet_revisjon: 0,
      endringer: [{ ny: 'innholdselement', innhold: kort(s.side, 'dosering', 'Et kort til') }],
    })
    expect(svar.teknisk.ok).toBe(false)
    expect(svar.teknisk.feil).toBeTruthy()
    expect((await feilFra(() => agent(claude, 'til_kontroll', { gren: g.id, revisjon: 1 })))?.message).toContain('Prøvepubliseringen må bestå')
  })
})

describe('kontrollen', () => {
  it('går gjennom kontrollrunder, og en godkjenning gjelder nøyaktig én revisjon', async () => {
    const k = await kuratertGren()
    expect(k.svar.teknisk).toMatchObject({ ok: true, rapport_ok: true })

    expect((await feilFra(() => agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })))?.message).toMatch(/dekningsmatrise mangler.*evidensjournal mangler.*selvtest mangler/)
    // Tomme eller mangelfulle dokumenter er ikke nok: grenen sendes ikke til kontroll, og feilen sier hva som mangler.
    const gyldige = await gyldigeDokumenter()
    const matrise = gyldige.dekningsmatrise as { omrader: Json[] }
    for (const [art, innhold, melding] of [
      ['dekningsmatrise', {}, 'dekningsmatrise: omrader må være en liste'],
      ['dekningsmatrise', { ...matrise, omrader: matrise.omrader.slice(1) }, 'dekningsmatrise: identitet står 0 ganger'],
      ['dekningsmatrise', { ...matrise, omrader: [{ ...matrise.omrader[0], kilder: [''] }, ...matrise.omrader.slice(1)] }, 'uten tomme oppføringer'],
      ['selvtest', {}, 'selvtest: krav må ha'],
      ['selvtest', { ...gyldige.selvtest, krav: [{ krav: 'Tallene stemmer', status: 'ikke_bestatt', bevis: 'Nei' }] }, 'kravene er ikke bestått: Tallene stemmer'],
      ['evidensjournal', { kunnskapsgrense: '2026-10-16', hovedkilder: [], sok: [{ domene: '', hva: ' ' }] }, 'evidensjournal: hovedkilder må ha minst én kilde'],
    ] as const) {
      await medDokumenter(k.gren)
      await agent(claude, 'dokument', { gren: k.gren, art, innhold })
      expect((await feilFra(() => agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })))?.message).toContain(melding)
    }
    expect((await adm<{ manglende_dokumenter: string[] }>('les', { gren: k.gren })).manglende_dokumenter).toEqual(['evidensjournal'])
    await medDokumenter(k.gren)
    expect((await adm<{ manglende_dokumenter: string[] }>('les', { gren: k.gren })).manglende_dokumenter).toEqual([])
    expect((await agent<Sammendrag>(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })).status).toBe('klar')
    expect((await feilFra(() => agent(claude, 'skriv', { gren: k.gren, forventet_revisjon: 1, endringer: [{ rapport: null }] })))?.message).toContain(
      'kan ikke endres',
    )

    // Kuratoren kan ikke vurdere selv; kontrolløren ber om endringer.
    expect((await feilFra(() => agent(claude, 'vurder', { gren: k.gren, revisjon: 1, beslutning: 'godkjent', begrunnelse: 'Selv' })))?.code).toBe('42501')
    const tilbake = await agent<Sammendrag>(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, beslutning: 'endringer', begrunnelse: 'Doseringen trenger kilde.' })
    expect(tilbake.status).toBe('tilbakemelding')

    const rettet = await agent<{ status: string; revisjon: number }>(claude, 'skriv', {
      gren: k.gren,
      forventet_revisjon: 1,
      endringer: [{ sett: k.dosering, innhold: kort(k.side, 'dosering', 'Ny dosering, rettet', { referanser: [k.nyRef] }) }],
    })
    expect(rettet).toMatchObject({ status: 'retting', revisjon: 2 })
    expect((await agent<Sammendrag>(claude, 'til_kontroll', { gren: k.gren, revisjon: 2 })).runde).toBe(2)

    // En godkjenning av den forrige revisjonen avvises.
    expect((await feilFra(() => agent(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, beslutning: 'godkjent', begrunnelse: 'Gammel' })))?.code).toBe('PT409')
    expect((await agent<Sammendrag>(chatgpt, 'vurder', { gren: k.gren, revisjon: 2, beslutning: 'godkjent', begrunnelse: 'Rettet.' })).status).toBe(
      'godkjent',
    )

    // En ny endring etter godkjenningen opphever den.
    await agent(claude, 'skriv', {
      gren: k.gren,
      forventet_revisjon: 2,
      endringer: [{ sett: k.dosering, innhold: kort(k.side, 'dosering', 'Ny dosering, endret etter godkjenning', { referanser: [k.nyRef] }) }],
    })
    const lest = await adm<{ status: string; hindringer: string[] }>('les', { gren: k.gren })
    expect(lest.status).toBe('retting')
    expect(lest.hindringer.join(' ')).toContain('ikke faglig godkjent')
    expect((await feilFra(() => agent(claude, 'publiser', { gren: k.gren, revisjon: 3 })))?.message).toContain('Bare en godkjent gren')
  })

  it('lar en administrator vurdere, stanse, gjenoppta og forkaste', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })
    expect((await adm<Sammendrag>('stans', { gren: k.gren, grunn: 'Pause' })).status).toBe('stanset')
    expect((await feilFra(() => agent(claude, 'skriv', { gren: k.gren, forventet_revisjon: 1, endringer: [{ rapport: null }] })))?.code).toBe('22023')
    expect((await adm<Sammendrag>('gjenoppta', { gren: k.gren })).status).toBe('retting')
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })
    expect((await adm<Sammendrag>('vurder', { gren: k.gren, revisjon: 1, beslutning: 'godkjent', begrunnelse: 'Kontrollert av Gro.' })).status).toBe(
      'godkjent',
    )
    expect((await adm<Sammendrag>('forkast', { gren: k.gren })).status).toBe('arkivert')
    expect(JSON.stringify(await publisert(k.slug))).toContain('Gammel dosering')
  })
})

describe('publiseringen', () => {
  it('publiserer hele grenen samlet, med rapporten og én ny sideversjon', async () => {
    const k = await kuratertGren()
    await tilGodkjent(k.gren)
    const versjonerFor = (await kall.fasit<{ n: number }>('select count(*)::int as n from public.sideversjoner where infoside = $1', [k.side]))[0]!.n

    const svar = await adm<{ ok: boolean; versjon: number }>('publiser', { gren: k.gren, revisjon: 1 })
    expect(svar.ok).toBe(true)

    const lest = await publisert<{ elementer: { id: string; innhold: { panel: string } }[] }>(k.slug)
    const side = JSON.stringify(lest)
    expect(side).toContain('Ny dosering')
    expect(side).toContain('Ny kinetikk')
    expect(side).toContain('Ny kilde')
    expect(lest.elementer.find((e) => e.id === k.indikasjon)!.innhold.panel).toBe('fjernet')

    const versjoner = await kall.fasit<{ nr: number; endring_id: string; opphav: string }>(
      'select nr, endring_id, opphav from public.sideversjoner where infoside = $1 order by nr desc',
      [k.side],
    )
    expect(versjoner).toHaveLength(versjonerFor + 1)
    expect(svar.versjon).toBe(versjoner[0]!.nr)
    expect(versjoner[0]!.opphav).toBe('gren')

    const [endring] = await kall.fasit<{ agent: string; art: string; gren: string; utfort_av: string; rapport: Json; oppsummering: string }>(
      'select agent, art, gren, utfort_av, rapport, oppsummering from public.innholdsendringer where id = $1',
      [versjoner[0]!.endring_id],
    )
    expect(endring).toMatchObject({ agent: 'claude-monografkurator', art: 'kuratering', gren: k.gren, utfort_av: admin, oppsummering: 'Syntetisk kuratering' })
    expect(JSON.stringify(endring!.rapport)).toContain('Doseringen skrevet om')

    // Revisjonene er skrevet av kuratoren og publisert av administratoren.
    const revisjoner = await kall.revisjoner(k.dosering)
    expect(revisjoner.at(-1)).toMatchObject({ utfort_av_fornavn: 'Claude', utfort_av_etternavn: 'monografkurator' })
    expect(revisjoner.at(-1)!.innhold).toMatchObject({ panel: 'dosering' })
    const [publisering] = await kall.fasit<{ utfort_av: string }>(
      'select utfort_av from public.objektpubliseringer where objekt_id = $1 order by revisjon desc limit 1',
      [k.dosering],
    )
    expect(publisering!.utfort_av).toBe(admin)
    await kall.forventSamsvar(k.dosering)

    const etter = await adm<Sammendrag>('les', { gren: k.gren })
    expect(etter).toMatchObject({ status: 'publisert', publisert_versjon: svar.versjon })
    expect((await agent<Sammendrag>(claude, 'apne', { stoff: k.slug, formaal: 'Neste' })).status).toBe('arbeid')
  })

  it('kan publiseres av kuratoren selv etter en uavhengig godkjenning', async () => {
    const k = await kuratertGren()
    expect((await feilFra(() => agent(chatgpt, 'publiser', { gren: k.gren, revisjon: 1 })))?.code).toBe('42501')
    await tilGodkjent(k.gren)
    // Dokumentene kontrolløren vurderte, kan ikke byttes ut etter godkjenningen.
    expect((await feilFra(() => agent(claude, 'dokument', { gren: k.gren, art: 'evidensjournal', innhold: { annen: true } })))?.message).toContain(
      'få nye dokumenter',
    )
    expect((await agent<{ ok: boolean }>(claude, 'publiser', { gren: k.gren, revisjon: 1 })).ok).toBe(true)
    expect(JSON.stringify(await publisert(k.slug))).toContain('Ny kinetikk')
  })

  it('stopper ved en konflikt med hovedversjonen, og godkjenningen faller bort når grenen oppdateres', async () => {
    const k = await kuratertGren()
    await tilGodkjent(k.gren)
    // Noen publiserer doseringen på vanlig måte i mellomtiden.
    await kall.lagre(k.dosering, 1, kort(k.side, 'dosering', 'Manuell dosering'))
    await kall.publiser(k.dosering, 2)
    const telt = await antall()

    const svar = await adm<{ ok: boolean; status: string; kode: string }>('publiser', { gren: k.gren, revisjon: 1 })
    expect(svar).toMatchObject({ ok: false, status: 'blokkert', kode: 'PT409' })
    expect(await antall()).toEqual(telt)
    expect(JSON.stringify(await publisert(k.slug))).toContain('Manuell dosering')

    const oppdatert = await agent<Sammendrag & { endret_i_hovedversjonen: string[] }>(claude, 'oppdater_grunnlag', { gren: k.gren })
    expect(oppdatert).toMatchObject({ status: 'retting', revisjon: 2, konflikt: false, endret_i_hovedversjonen: [k.dosering] })
    const lest = await adm<{ hindringer: string[] }>('les', { gren: k.gren })
    expect(lest.hindringer.join(' ')).toContain('ikke faglig godkjent')
  })

  it('overtar ikke et upublisert utkast fra vanlig redigering', async () => {
    const k = await kuratertGren()
    await tilGodkjent(k.gren)
    await kall.lagre(k.dosering, 1, kort(k.side, 'dosering', 'Påbegynt manuelt'))
    const svar = await adm<{ ok: boolean; feil: string }>('publiser', { gren: k.gren, revisjon: 1 })
    expect(svar.ok).toBe(false)
    expect(svar.feil).toContain('upublisert utkast')
    const [utkast] = await kall.fasit<{ revisjon: number }>(`select revisjon from public.objekttilstander where objekt_id = $1 and tilstand = 'utkast'`, [
      k.dosering,
    ])
    expect(utkast!.revisjon).toBe(2)
    expect(JSON.stringify((await kall.revisjoner(k.dosering)).at(-1)!.innhold)).toContain('Påbegynt manuelt')
  })

  it('tar bivirkningsimportene i grenen med i publiseringen, og bare da', async () => {
    const s = await nyFagside('Bivirkningsgren')
    const g = await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'SPC' })
    const imp = structuredClone(MAL)
    imp.stoff = s.slug
    const telt = await antall()
    const svar = await agent<{ teknisk: Teknisk }>(claude, 'skriv', {
      gren: g.id,
      forventet_revisjon: 0,
      endringer: [
        { bivirkninger: { importer: [imp] } },
        { rapport: { oppsummering: 'SPC lagt inn', seksjoner: [{ seksjon: 'bivirkninger', nytt: ['Bivirkningene fra preparatomtalen'] }] } },
      ],
    })
    expect(svar.teknisk).toMatchObject({ ok: true, rapport_ok: true })
    expect((await antall()).kilder).toBe(telt.kilder)
    const lest = await agent<{ grenrevisjon: { forhandsvisning: { bivirkninger: { kilder: unknown[] } } } }>(chatgpt, 'les', { gren: g.id })
    expect(lest.grenrevisjon.forhandsvisning.bivirkninger.kilder).toHaveLength(1)

    await tilGodkjent(g.id)
    expect((await adm<{ ok: boolean }>('publiser', { gren: g.id, revisjon: 1 })).ok).toBe(true)
    const [lestEtter] = await kall.fasit<{ b: { kilder: unknown[] } }>('select public.les_bivirkninger($1) as b', [s.slug])
    expect(lestEtter!.b.kilder).toHaveLength(1)
  })
})

describe('de novo', () => {
  it('holder fagteksten fra før skjult for kuratoren til blindfasen er avsluttet', async () => {
    const s = await nyFagside('Denovo')
    const g = await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'De novo', art: 'de_novo' })
    expect(g.blindfase).toBe(true)
    const blind = JSON.stringify(await agent(claude, 'les', { gren: g.id }))
    expect(blind).toContain(s.dosering)
    expect(blind).not.toContain('Gammel dosering')
    expect(JSON.stringify(await agent(chatgpt, 'les', { gren: g.id }))).toContain('Gammel dosering')

    expect((await feilFra(() => agent(claude, 'avslutt_blindfase', { gren: g.id })))?.message).toContain('blindprotokoll mangler. evidensjournal mangler.')
    // Tomme plassholdere avslutter ikke blindfasen.
    for (const art of ['blindprotokoll', 'evidensjournal']) await agent(claude, 'dokument', { gren: g.id, art, innhold: {} })
    const tomme = (await feilFra(() => agent(claude, 'avslutt_blindfase', { gren: g.id })))?.message
    expect(tomme).toContain('blindprotokoll: kilder må ha minst én kilde fra det egne søket')
    expect(tomme).toContain('evidensjournal: sok må beskrive minst ett søk')
    expect((await agent<Sammendrag>(claude, 'les', { gren: g.id })).blindfase).toBe(true)
    await medDokumenter(g.id, ['blindprotokoll', 'evidensjournal'])
    expect((await agent<Sammendrag>(claude, 'avslutt_blindfase', { gren: g.id })).blindfase).toBe(false)
    expect(JSON.stringify(await agent(claude, 'les', { gren: g.id }))).toContain('Gammel dosering')
    expect((await feilFra(() => agent(claude, 'dokument', { gren: g.id, art: 'blindprotokoll', innhold: { etterpå: true } })))?.message).toContain(
      'avsluttet',
    )
  })
})

describe('historikken', () => {
  it('kan ikke endres eller slettes', async () => {
    const k = await kuratertGren()
    expect((await feilFra(() => db.query('update kuratering.grenrevisjoner set melding = $1', ['x'])))?.code).toBe('42501')
    expect((await feilFra(() => db.query('delete from kuratering.hendelser')))?.code).toBe('42501')
    expect((await feilFra(() => db.query('delete from kuratering.grener where id = $1', [k.gren])))?.code).toBe('42501')
    const hendelser = await adm<{ hendelser: { hendelse: string }[] }>('les', { gren: k.gren })
    expect(hendelser.hendelser.map((h) => h.hendelse)).toContain('apnet')
  })
})
