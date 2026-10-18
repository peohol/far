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
 * - en ny kontrollrunde for den samme revisjonen når kuratoren har svart på
 *   vurderingen uten å rette, der den siste vurderingen er den som gjelder;
 * - publiseringen er samlet: alt eller ingenting, med rapporten i
 *   endringsloggen og én ny sideversjon;
 * - konflikter med hovedversjonen og upubliserte utkast stopper publiseringen;
 * - en ny referanse en annen gren alt har publisert, brukes i stedet for å
 *   lages på nytt;
 * - blindfasen i en de novo-kuratering, og bivirkningsimporter i grenen.
 *
 * Innholdet er syntetisk.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PANELREKKEFOLGE } from '../faginnhold/paneler'
import { kontrollerDekning, kontrollpunkter, tomMatrise } from '../kuratorprotokoll/dekning'
import { SELVTESTKRAV, SELVTESTPORTER, tomSelvtest } from '../kuratorprotokoll/selvtest'
import { behandleKurateringMcp } from '../kuratering/endepunkt'
import { AGENTHANDLINGER } from '../kuratering/handlinger'
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
  const { punkter, krav, porter } = (
    await kall.fasit<{ punkter: string[]; krav: string[]; porter: string[] }>(
      'select kuratering.kontrollpunkter() as punkter, kuratering.selvtestkrav() as krav, kuratering.selvtestporter() as porter',
    )
  )[0]!
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
      krav: krav.map((k) => ({ krav: k, status: 'bestatt', bevis: 'Syntetisk bevis' })),
      porter: porter.map((p) => ({ port: p, status: 'bestatt', bevis: 'Syntetisk bevis' })),
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
  return agent<Sammendrag>(chatgpt, 'vurder', { gren, revisjon: 1, runde: 1, beslutning: 'godkjent', begrunnelse: 'Kontrollert mot kildene.' })
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
  it('tilbyr agentene nøyaktig de handlingene databasen har for dem', async () => {
    const [rad] = await kall.fasit<{ h: string[] }>('select kuratering.handlinger(false) as h')
    expect([...rad!.h].sort()).toEqual(AGENTHANDLINGER.map((h) => h.navn).sort())
  })

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
      ['selvtest', {}, 'selvtest: krav må være en liste'],
      ['selvtest', { ...gyldige.selvtest, porter: [{ port: 'provepublisering', status: 'gjenstar', bevis: 'Ikke kjørt' }] }, 'porten provepublisering er ikke bestått (gjenstar)'],
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
    expect((await feilFra(() => agent(claude, 'vurder', { gren: k.gren, revisjon: 1, runde: 1, beslutning: 'godkjent', begrunnelse: 'Selv' })))?.code).toBe('42501')
    // Også en godkjenning må si hva som er kontrollert.
    for (const begrunnelse of [undefined, '', '   ']) {
      const feil = await feilFra(() => agent(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, runde: 1, beslutning: 'godkjent', begrunnelse }))
      expect(feil).toMatchObject({ code: '22023', message: expect.stringContaining('må ha en begrunnelse') })
    }
    const tilbake = await agent<Sammendrag>(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, runde: 1, beslutning: 'endringer', begrunnelse: 'Doseringen trenger kilde.' })
    expect(tilbake.status).toBe('tilbakemelding')

    const rettet = await agent<{ status: string; revisjon: number }>(claude, 'skriv', {
      gren: k.gren,
      forventet_revisjon: 1,
      endringer: [{ sett: k.dosering, innhold: kort(k.side, 'dosering', 'Ny dosering, rettet', { referanser: [k.nyRef] }) }],
    })
    expect(rettet).toMatchObject({ status: 'retting', revisjon: 2 })
    expect((await agent<Sammendrag>(claude, 'til_kontroll', { gren: k.gren, revisjon: 2 })).runde).toBe(2)

    // En godkjenning av den forrige revisjonen avvises.
    expect((await feilFra(() => agent(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, runde: 2, beslutning: 'godkjent', begrunnelse: 'Gammel' })))?.code).toBe('PT409')
    expect((await agent<Sammendrag>(chatgpt, 'vurder', { gren: k.gren, revisjon: 2, runde: 2, beslutning: 'godkjent', begrunnelse: 'Rettet.' })).status).toBe(
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

  it('godtar bare en selvtest der hvert obligatoriske krav og hver port står én gang og er bestått', async () => {
    const { selvtest } = (await gyldigeDokumenter()) as { selvtest: { krav: Json[]; porter: Json[] } }
    const feil = async (innhold: Json) =>
      (await kall.fasit<{ f: string[] }>(`select kuratering.dokumentfeil('selvtest', $1::jsonb) as f`, [JSON.stringify(innhold)]))[0]!.f
    const medKrav = (nokkel: string, endring: Record<string, string>) => ({
      ...selvtest,
      krav: selvtest.krav.map((k) => ((k as { krav: string }).krav === nokkel ? { ...(k as object), ...endring } : k)),
    })

    expect(await feil(selvtest)).toEqual([])
    // Et stoff uten norsk preparatomtale: bare kravene om preparatomtalene kan være ikke_relevant.
    expect(await feil(medKrav('kildetroskap_preparatomtale', { status: 'ikke_relevant', bevis: 'Ingen norsk preparatomtale' }))).toEqual([])

    for (const [innhold, melding] of [
      [{ ...selvtest, porter: selvtest.porter.map((p) => ({ ...(p as object), status: 'gjenstar' })) }, 'porten funksjonstest er ikke bestått (gjenstar)'],
      [{ ...selvtest, porter: [...selvtest.porter.slice(0, 3), { port: 'funksjonstest', status: 'ikke_bestatt', bevis: 'Feilet' }] }, 'porten funksjonstest er ikke bestått (ikke_bestatt)'],
      [medKrav('evidensstyrke', { status: 'ikke_bestatt' }), 'kravet evidensstyrke er ikke bestått (ikke_bestatt)'],
      [medKrav('ingenting_finnes_pa', { status: 'ikke_relevant' }), 'kravet ingenting_finnes_pa gjelder alltid og kan ikke være ikke_relevant'],
      [medKrav('faste_kort', { bevis: ' ' }), 'selvtest: krav må være en liste der hver oppføring har krav, status og bevis'],
      [{ ...selvtest, krav: selvtest.krav.slice(1) }, 'kravet kildetroskap_preparatomtale mangler'],
      [{ ...selvtest, krav: [...selvtest.krav, selvtest.krav[0]] }, 'kravet kildetroskap_preparatomtale står 2 ganger'],
      [{ ...selvtest, porter: [...selvtest.porter, { port: 'Alt ser fint ut', status: 'bestatt', bevis: 'Ja' }] }, 'Alt ser fint ut er ikke et av punktene i porter'],
      [{ ...selvtest, porter: [] }, 'selvtest: porter må være en liste'],
    ] as const) {
      expect((await feil(innhold)).join(' | ')).toContain(melding)
    }

    // Den gamle, løse formen med ett vilkårlig krav og én port holder ikke lenger.
    const lost = await feil({
      krav: [{ krav: 'Hver påstand har kilde', status: 'bestatt', bevis: 'Dekningsmatrisen' }],
      porter: [{ port: 'Prøvepubliseringen', status: 'bestatt', bevis: 'Revisjon 1' }],
    })
    expect(lost).toEqual(expect.arrayContaining(['selvtest: kravet offentlig_repo mangler.', 'selvtest: porten funksjonstest mangler.']))
    expect(lost.length).toBeGreaterThanOrEqual(15)
  })

  it('lar en administrator vurdere, stanse, gjenoppta og forkaste', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })
    expect((await adm<Sammendrag>('stans', { gren: k.gren, grunn: 'Pause' })).status).toBe('stanset')
    expect((await feilFra(() => agent(claude, 'skriv', { gren: k.gren, forventet_revisjon: 1, endringer: [{ rapport: null }] })))?.code).toBe('22023')
    expect((await adm<Sammendrag>('gjenoppta', { gren: k.gren })).status).toBe('retting')
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })
    expect((await adm<Sammendrag>('vurder', { gren: k.gren, revisjon: 1, runde: 2, beslutning: 'godkjent', begrunnelse: 'Kontrollert av Gro.' })).status).toBe(
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
    // En tråd kan festes til preparatomtalen i grenen, men ikke til en som ikke finnes.
    await agent(chatgpt, 'kommenter', { gren: g.id, anker: { kilde: imp.kilde.nokkel }, tekst: 'Kontroller frekvensene.' })
    expect((await feilFra(() => agent(chatgpt, 'kommenter', { gren: g.id, anker: { kilde: 'oppdiktet-spc' }, tekst: 'x' })))?.message).toContain('preparatomtalen')

    await tilGodkjent(g.id)
    expect((await adm<{ ok: boolean }>('publiser', { gren: g.id, revisjon: 1 })).ok).toBe(true)
    const [lestEtter] = await kall.fasit<{ b: { kilder: unknown[] } }>('select public.les_bivirkninger($1) as b', [s.slug])
    expect(lestEtter!.b.kilder).toHaveLength(1)
  })
})

describe('delte referanser', () => {
  const nyLenke = () => `https://example.org/delt/${crypto.randomUUID()}`

  /** En gren på en ny fagside der doseringskortet siterer en ny referanse, både som kilde og i teksten. */
  async function grenMedReferanse(id: string, lenke: string) {
    const s = await nyFagside('Delt kilde')
    const g = await agent<Sammendrag>(claude, 'apne', { stoff: s.slug, formaal: 'Delt kilde' })
    const dokument = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dosering med delt kilde' }, { type: 'sitering', attrs: { referanser: [id] } }] }] }
    const svar = await agent<{ teknisk: Teknisk }>(claude, 'skriv', {
      gren: g.id,
      forventet_revisjon: 0,
      endringer: [
        { ny: 'referanse', id, innhold: { tittel: 'Delt kilde', forfattere: 'C', aar: '2026', lenke } },
        { sett: s.dosering, innhold: kort(s.side, 'dosering', '', { referanser: [id], data: { dokument } }) },
        {
          rapport: {
            oppsummering: 'Delt kilde',
            seksjoner: [{ seksjon: 'dosering', endret: ['Doseringen fikk en ny kilde'] }],
            kildegrunnlag: ['Delt kilde (2026)'],
          },
        },
      ],
    })
    expect(svar.teknisk).toMatchObject({ ok: true, rapport_ok: true })
    await tilGodkjent(g.id)
    return { ...s, gren: g.id }
  }

  const prov = async (gren: string) =>
    (await kall.fasit<{ t: Teknisk }>(`select kuratering.prov(g, kuratering.tilstand(g)) -> 'teknisk' as t from kuratering.grener g where g.id = $1`, [gren]))[0]!.t
  const medLenke = (lenke: string) => kall.fasit<{ objekt_id: string }>('select distinct objekt_id from public.referanser where lenke = $1', [lenke])
  const publiserteKoblinger = (objekt: string) =>
    kall.fasit<{ niva: string; referanse_id: string }>(
      `select niva::text, referanse_id from public.referansekoblinger where objekt_id = $1 and tilstand = 'publisert' order by nr`,
      [objekt],
    )

  for (const [hvordan, sammeId] of [
    ['med samme ID', true],
    ['med en annen ID og samme lenke', false],
  ] as const) {
    it(`bruker en ny referanse en annen gren alt har publisert, ${hvordan}`, async () => {
      const lenke = nyLenke()
      const forste = crypto.randomUUID()
      const andre = sammeId ? forste : crypto.randomUUID()
      const a = await grenMedReferanse(forste, lenke)
      const b = await grenMedReferanse(andre, lenke)
      expect((await adm<{ ok: boolean }>('publiser', { gren: a.gren, revisjon: 1 })).ok).toBe(true)

      // Prøvepubliseringen og publiseringen av den andre grenen går, og lager ingen ny referanse.
      expect(await prov(b.gren)).toMatchObject({ ok: true, rapport_ok: true })
      expect(await medLenke(lenke)).toEqual([{ objekt_id: forste }])
      expect((await adm<{ ok: boolean }>('publiser', { gren: b.gren, revisjon: 1 })).ok).toBe(true)
      expect(await adm<Sammendrag>('les', { gren: b.gren })).toMatchObject({ status: 'publisert' })

      expect(await medLenke(lenke)).toEqual([{ objekt_id: forste }])
      expect((await kall.fasit<{ n: number }>('select count(*)::int as n from public.redigerbare_objekter where id = $1', [andre]))[0]!.n).toBe(sammeId ? 1 : 0)
      // Kortet på den andre siden siterer den publiserte referansen, som kilde og i teksten.
      expect(await publiserteKoblinger(b.dosering)).toEqual([
        { niva: 'element', referanse_id: forste },
        { niva: 'inline', referanse_id: forste },
      ])
      const side = JSON.stringify(await publisert(b.slug))
      expect(side).toContain('Dosering med delt kilde')
      if (!sammeId) expect(side).not.toContain(andre)
      await kall.forventSamsvar(b.dosering)
    })
  }

  const utkastrevisjon = async (objekt: string) =>
    (await kall.fasit<{ revisjon: number }>('select revisjon from public.objektstatus where id = $1', [objekt]))[0]!.revisjon

  for (const [hva, sammeId] of [
    ['et upublisert utkast med en annen lenke', true],
    ['et arkivert utkast', false],
  ] as const) {
    it(`bruker ikke en publisert referanse som har ${hva}, men stopper som en konflikt`, async () => {
      const lenke = nyLenke()
      const forste = crypto.randomUUID()
      const a = await grenMedReferanse(forste, lenke)
      const b = await grenMedReferanse(sammeId ? forste : crypto.randomUUID(), lenke)
      expect((await adm<{ ok: boolean }>('publiser', { gren: a.gren, revisjon: 1 })).ok).toBe(true)

      // Noen redigerer den publiserte referansen på vanlig måte uten å publisere.
      const innhold = { tittel: 'Delt kilde', forfattere: 'C', aar: '2026', lenke }
      if (sammeId) {
        await kall.lagre(forste, await utkastrevisjon(forste), { ...innhold, lenke: nyLenke() })
      } else {
        // En sitert referanse kan ikke arkiveres; kortet slutter å sitere den i utkastet først.
        await kall.lagre(a.dosering, await utkastrevisjon(a.dosering), kort(a.side, 'dosering', 'Uten kilden'))
        await kall.lagre(forste, await utkastrevisjon(forste), { ...innhold, arkivert: true })
      }

      expect(await prov(b.gren)).toMatchObject({ ok: false, kode: 'PT409' })
      const telt = await antall()
      const svar = await adm<{ ok: boolean; status: string; kode: string; feil: string }>('publiser', { gren: b.gren, revisjon: 1 })
      expect(svar).toMatchObject({ ok: false, status: 'blokkert', kode: 'PT409' })
      expect(svar.feil).toContain('under redigering')
      expect(await antall()).toEqual(telt)
      expect(await medLenke(lenke)).toEqual([{ objekt_id: forste }])
      expect(JSON.stringify(await publisert(b.slug))).toContain('Gammel dosering')
    })
  }

  // PGlite kjører én transaksjon om gangen, så to samtidige publiseringer kan
  // ikke prøves her; låsen per lenke de ville ventet på, kan det.
  it('låser hver ny lenke på tvers av sidene mens grenen publiseres', async () => {
    const lenke = nyLenke()
    const b = await grenMedReferanse(crypto.randomUUID(), lenke)
    const laaste = await db.transaction(async (tx) => {
      await tx.query('select kuratering.utfor(g, kuratering.tilstand(g), kuratering.forfatter(g), true) from kuratering.grener g where g.id = $1', [b.gren])
      const { rows } = await tx.query<{ n: number }>(
        `select count(*)::int as n from pg_locks l
         where l.locktype = 'advisory' and l.granted and l.pid = pg_backend_pid()
           and ((l.classid::bigint << 32) | l.objid::bigint) = hashtextextended('referanselenke:' || lower(btrim($1)), 0)`,
        [` ${lenke.toUpperCase()} `],
      )
      await tx.rollback()
      return rows[0]!.n
    })
    expect(laaste).toBe(1)
  })

  it('stopper som en konflikt når ID-en er tatt av en referanse med en annen lenke', async () => {
    const id = crypto.randomUUID()
    const a = await grenMedReferanse(id, nyLenke())
    const b = await grenMedReferanse(id, nyLenke())
    expect((await adm<{ ok: boolean }>('publiser', { gren: a.gren, revisjon: 1 })).ok).toBe(true)

    expect(await prov(b.gren)).toMatchObject({ ok: false, kode: 'PT409' })
    const telt = await antall()
    const svar = await adm<{ ok: boolean; status: string; kode: string; feil: string }>('publiser', { gren: b.gren, revisjon: 1 })
    expect(svar).toMatchObject({ ok: false, status: 'blokkert', kode: 'PT409' })
    expect(svar.feil).toContain('alt er i bruk')
    const [grunn] = await kall.fasit<{ status_grunn: string }>('select status_grunn from kuratering.grener where id = $1', [b.gren])
    expect(grunn!.status_grunn).toMatch(/^Konflikt: /)
    expect(await antall()).toEqual(telt)
    expect(JSON.stringify(await publisert(b.slug))).toContain('Gammel dosering')
  })
})

describe('gjenopprettingen', () => {
  const versjonNaa = async (side: string) =>
    (await kall.fasit<{ nr: number }>('select max(nr)::int as nr from public.sideversjoner where infoside = $1', [side]))[0]!.nr
  const importer = (slug: string, tekst: string) => {
    const imp = structuredClone(MAL)
    imp.stoff = slug
    imp.organsystemer[0].frekvenser[0].bivirkninger[0] = tekst
    return db.query('select bivirkninger.importer($1::jsonb)', [JSON.stringify(imp)])
  }
  const innholdIVersjon = async (slug: string, nr: number) => {
    const [v] = await kall.fasit<{ v: { elementer: { id: string; innhold: Json }[]; bivirkninger: unknown[] } }>(
      'select public.les_sideversjon($1, $2) as v',
      [slug, nr],
    )
    return v!.v
  }

  /** En side der doseringen er skrevet om, indikasjonen fjernet, et kort lagt til og en bivirkningskilde importert etter `nr`. */
  async function endretSide() {
    const s = await nyFagside('Gjenopprettstoff')
    await importer(s.slug, 'Syntetisk hodepine')
    const nr = await versjonNaa(s.side)
    await kall.lagre(s.dosering, 1, kort(s.side, 'dosering', 'Senere dosering'))
    await kall.publiser(s.dosering, 2)
    await kall.lagre(s.indikasjon, 1, { ...kort(s.side, 'fjernet', 'Gammel indikasjon'), referanser: [s.ref] })
    await kall.publiser(s.indikasjon, 2)
    const senere = (await kall.opprett('innholdselement', kort(s.side, 'farmakokinetikk', 'Senere kinetikk'))).id
    await kall.publiser(senere, 1)
    const imp = structuredClone(MAL)
    imp.stoff = s.slug
    imp.kilde.nokkel = 'senere-kilde'
    await db.query('select bivirkninger.importer($1::jsonb)', [JSON.stringify(imp)])
    return { ...s, nr, senere }
  }

  it('tar en eldre versjon tilbake som en gren, forhåndsvist, og publiserer den som en ny versjon', async () => {
    const s = await endretSide()
    expect(JSON.stringify(await publisert(s.slug))).toContain('Senere dosering')
    const [biv] = await kall.les<{ gammel: { kilder: { nokkel: string }[] }; naa: { kilder: unknown[] } }>(
      leser,
      'select public.les_sideversjon_bivirkninger($1, $2) as gammel, public.les_bivirkninger($1) as naa',
      [s.slug, s.nr],
    )
    expect(biv!.gammel.kilder.map((k) => k.nokkel)).not.toContain('senere-kilde')
    expect(biv!.naa.kilder).toHaveLength(biv!.gammel.kilder.length + 1)

    expect((await feilFra(() => adm('gjenopprett_versjon', { stoff: s.slug, nr: s.nr }, leser)))?.code).toBe('42501')
    expect((await feilFra(() => agent(claude, 'gjenopprett_versjon', { stoff: s.slug, nr: s.nr })))?.code).toBe('22023')

    const telt = await antall()
    const g = await adm<Sammendrag & { fra_versjon: number; merknader: string[]; grenrevisjon: { teknisk: Teknisk; forhandsvisning: Json } }>(
      'gjenopprett_versjon',
      { stoff: s.slug, nr: s.nr, grunn: 'Feil i senere endring' },
    )
    expect(g).toMatchObject({ status: 'arbeid', art: 'gjenoppretting', revisjon: 1, fra_versjon: s.nr })
    expect(g.grenrevisjon.teknisk, JSON.stringify(g.grenrevisjon.teknisk)).toMatchObject({ ok: true })
    const visning = JSON.stringify(g.grenrevisjon.forhandsvisning)
    expect(visning).toContain('Gammel dosering')
    expect(visning).toContain('Gammel indikasjon')
    expect(visning).not.toContain('senere-kilde')
    // Ingenting er publisert ennå, og prøven har ikke etterlatt noe.
    expect(JSON.stringify(await publisert(s.slug))).toContain('Senere dosering')
    expect((await antall()).versjoner).toBe(telt.versjoner)

    const svar = await adm<{ ok: boolean; versjon: number }>('publiser', { gren: g.id, revisjon: 1 })
    expect(svar.ok).toBe(true)
    const [versjon] = await kall.fasit<{ opphav: string }>('select opphav from public.sideversjoner where infoside = $1 and nr = $2', [s.side, svar.versjon])
    expect(versjon!.opphav).toBe('gjenoppretting')

    // Kortene og bivirkningskildene er som i den gamle versjonen.
    const gammel = await innholdIVersjon(s.slug, s.nr)
    const ny = await innholdIVersjon(s.slug, svar.versjon)
    const kortene = (v: typeof gammel) => Object.fromEntries(v.elementer.map((e) => [e.id, e.innhold]))
    expect(kortene(ny)).toEqual(kortene(gammel))
    expect(ny.bivirkninger.map((b) => (b as { nokkel: string }).nokkel)).toEqual(gammel.bivirkninger.map((b) => (b as { nokkel: string }).nokkel))
    const lest = await publisert<{ elementer: { id: string; innhold: { panel: string } }[] }>(s.slug)
    expect(lest.elementer.find((e) => e.id === s.senere)!.innhold.panel).toBe('fjernet')
    await kall.forventSamsvar(s.indikasjon)

    const [endring] = await kall.fasit<{ gren: string; oppsummering: string; utfort_av: string }>(
      'select e.gren, e.oppsummering, e.utfort_av from public.innholdsendringer e join public.sideversjoner v on v.endring_id = e.id where v.infoside = $1 and v.nr = $2',
      [s.side, svar.versjon],
    )
    expect(endring).toMatchObject({ gren: g.id, utfort_av: admin })
    expect(endring!.oppsummering).toContain(`Gjenoppretting av versjon ${s.nr}`)
  })

  it('tar ikke tilbake den gjeldende versjonen, eller ved siden av en aktiv gren', async () => {
    const s = await nyFagside('Gjenopprettstopp')
    const naa = await versjonNaa(s.side)
    expect((await feilFra(() => adm('gjenopprett_versjon', { stoff: s.slug, nr: naa })))?.code).toBe('22023')
    expect((await feilFra(() => adm('gjenopprett_versjon', { stoff: s.slug, nr: naa + 5 })))?.code).toBe('PT404')
    await kall.lagre(s.dosering, 1, kort(s.side, 'dosering', 'Endret'))
    await kall.publiser(s.dosering, 2)
    await agent(claude, 'apne', { stoff: s.slug, formaal: 'Pågår' })
    expect((await feilFra(() => adm('gjenopprett_versjon', { stoff: s.slug, nr: naa })))?.code).toBe('PT409')
  })

  it('blokkeres når siden publiseres på nytt før gjenopprettingen er publisert', async () => {
    const s = await endretSide()
    const g = await adm<Sammendrag>('gjenopprett_versjon', { stoff: s.slug, nr: s.nr })
    await kall.lagre(s.dosering, 2, kort(s.side, 'dosering', 'Enda senere'))
    await kall.publiser(s.dosering, 3)
    const svar = await adm<{ ok: boolean; status: string; kode: string }>('publiser', { gren: g.id, revisjon: 1 })
    expect(svar).toMatchObject({ ok: false, status: 'blokkert', kode: 'PT409' })
    expect(JSON.stringify(await publisert(s.slug))).toContain('Enda senere')
  })
})

describe('kommentarene', () => {
  interface Traad {
    id: string
    art: string
    status: string
    venter_pa_kurator?: boolean
    anker?: Json
    kommentarer: { tekst: string; handling: string; kurator?: boolean }[]
  }

  it('holder sperrende tråder åpne til kontrolløren lukker dem, gjennom flere kontrollrunder', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })

    // Kontrolløren fester en sperrende tråd til et felt i doseringskortet og ber om endringer.
    const traad = await agent<{ traad: string }>(chatgpt, 'kommenter', {
      gren: k.gren,
      art: 'sperrende',
      anker: { objekt: k.dosering, felt: 'Tekst' },
      tekst: 'Doseringen mangler kilde for maksdosen.',
    })
    expect((await feilFra(() => agent(chatgpt, 'kommenter', { gren: k.gren, anker: { objekt: crypto.randomUUID() }, tekst: 'x' })))?.code).toBe('22023')
    expect((await feilFra(() => agent(claude, 'kommenter', { gren: k.gren, art: 'sperrende', tekst: 'Egen sperre' })))?.code).toBe('42501')
    expect((await feilFra(() => agent(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, runde: 1, beslutning: 'godkjent', begrunnelse: 'ok' })))?.message).toMatch(/Sperrende kommentar er åpen/)
    await agent(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, runde: 1, beslutning: 'endringer', begrunnelse: 'Se kommentaren.' })

    // Kuratoren retter, men kan ikke sende til ny runde før den har svart i tråden.
    await agent(claude, 'skriv', {
      gren: k.gren,
      forventet_revisjon: 1,
      endringer: [{ sett: k.dosering, innhold: kort(k.side, 'dosering', 'Ny dosering med kilde', { referanser: [k.nyRef] }) }],
    })
    expect((await feilFra(() => agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 2 })))?.message).toMatch(/venter på svar/)
    await agent(claude, 'kommenter', { gren: k.gren, svar_pa: traad.traad, tekst: 'Kilde lagt til i revisjon 2.' })
    expect((await feilFra(() => agent(claude, 'lukk_kommentar', { gren: k.gren, kommentar: traad.traad })))?.code).toBe('42501')
    expect((await agent<Sammendrag>(claude, 'til_kontroll', { gren: k.gren, revisjon: 2 })).runde).toBe(2)

    // Den åpne tråden sperrer fortsatt godkjenningen, til kontrolløren lukker den.
    const lest = await agent<{ traader: Traad[]; hindringer: string[] }>(chatgpt, 'les', { gren: k.gren })
    expect(lest.traader[0]).toMatchObject({ art: 'sperrende', status: 'apen', venter_pa_kurator: false, anker: { objekt: k.dosering, felt: 'Tekst' } })
    expect(lest.traader[0]!.kommentarer.map((x) => x.kurator ?? false)).toEqual([false, true])
    expect(lest.hindringer.join(' ')).toMatch(/Sperrende kommentar er åpen/)
    await agent(chatgpt, 'lukk_kommentar', { gren: k.gren, kommentar: traad.traad, tekst: 'Kontrollert mot kilden.', klient_id: 'lukk-r2-0001' })
    expect((await agent<Sammendrag>(chatgpt, 'vurder', { gren: k.gren, revisjon: 2, runde: 2, beslutning: 'godkjent', begrunnelse: 'Kontrollert.' })).status).toBe('godkjent')

    // En lukket tråd kan åpnes igjen, og sperrer da publiseringen.
    await agent(chatgpt, 'gjenapne_kommentar', { gren: k.gren, kommentar: traad.traad, tekst: 'Fant en feil til.', klient_id: 'apne-r2-0001' })
    expect((await feilFra(() => adm('publiser', { gren: k.gren, revisjon: 2 })))?.message).toMatch(/Sperrende kommentar/)
    await adm('lukk_kommentar', { gren: k.gren, kommentar: traad.traad })
    expect((await adm<{ ok: boolean }>('publiser', { gren: k.gren, revisjon: 2 })).ok).toBe(true)
    // Etter publiseringen er grenen avsluttet, og trådene står som historikk.
    expect((await feilFra(() => agent(chatgpt, 'kommenter', { gren: k.gren, tekst: 'For sent' })))?.code).toBe('22023')
    expect((await feilFra(() => adm('gjenapne_kommentar', { gren: k.gren, kommentar: traad.traad, tekst: 'For sent' })))?.message).toContain('avsluttet')
    expect((await feilFra(() => adm('lukk_kommentar', { gren: k.gren, kommentar: lest.traader[0]!.id })))?.message).toContain('avsluttet')
    expect((await adm<Traad[]>('kommentarer', { gren: k.gren }))[0]!.kommentarer.map((x) => x.handling)).toEqual([
      'kommentar', 'kommentar', 'lukket', 'gjenapnet', 'lukket',
    ])
  })

  it('gir en ny svarplikt når kontrolløren åpner en tråd igjen med et nytt funn', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })
    const traad = await agent<{ traad: string }>(chatgpt, 'kommenter', {
      gren: k.gren,
      art: 'sperrende',
      anker: { objekt: k.dosering, felt: 'Tekst' },
      tekst: 'Doseringen mangler kilde.',
    })
    await agent(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, runde: 1, beslutning: 'endringer', begrunnelse: 'Se tråden.' })
    const rett = async (revisjon: number, tekst: string) =>
      agent(claude, 'skriv', {
        gren: k.gren,
        forventet_revisjon: revisjon - 1,
        endringer: [{ sett: k.dosering, innhold: kort(k.side, 'dosering', tekst, { referanser: [k.nyRef] }) }],
      })
    const venter = async () =>
      (await agent<{ traader: Traad[] }>(chatgpt, 'les', { gren: k.gren })).traader.find((t) => t.id === traad.traad)!.venter_pa_kurator

    // Svar fra kuratoren, og kontrolløren lukker tråden.
    await rett(2, 'Dosering med kilde')
    await agent(claude, 'kommenter', { gren: k.gren, svar_pa: traad.traad, tekst: 'Kilde lagt til i revisjon 2.' })
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 2 })
    await agent(chatgpt, 'lukk_kommentar', { gren: k.gren, kommentar: traad.traad, tekst: 'Kontrollert.', klient_id: 'lukk-r2-0001' })

    // Kontrolløren åpner den igjen med et nytt funn: tråden venter på kuratoren igjen, også i appen.
    await agent(chatgpt, 'gjenapne_kommentar', { gren: k.gren, kommentar: traad.traad, tekst: 'Maksdosen stemmer ikke med kilden.', klient_id: 'apne-r2-0001' })
    expect(await venter()).toBe(true)
    expect((await adm<Traad[]>('kommentarer', { gren: k.gren })).find((t) => t.id === traad.traad)).toMatchObject({ status: 'apen', venter_pa_kurator: true })
    await agent(chatgpt, 'vurder', { gren: k.gren, revisjon: 2, runde: 2, beslutning: 'endringer', begrunnelse: 'Se den gjenåpnede tråden.' })

    // En ny revisjon kan ikke sendes til kontroll før kuratoren har svart på det nye funnet.
    await rett(3, 'Dosering med rettet maksdose')
    expect((await feilFra(() => agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 3 })))?.message).toMatch(/venter på svar/)
    await agent(claude, 'kommenter', { gren: k.gren, svar_pa: traad.traad, tekst: 'Maksdosen rettet i revisjon 3.' })
    expect(await venter()).toBe(false)
    expect((await agent<Sammendrag>(claude, 'til_kontroll', { gren: k.gren, revisjon: 3 })).runde).toBe(3)
  })

  it('lar kuratoren skrive merknader og andre ikke lese grenens tråder', async () => {
    const k = await kuratertGren()
    const merknad = await agent<{ traad: string }>(claude, 'kommenter', { gren: k.gren, anker: { seksjon: 'dosering' }, tekst: 'Usikker på barnedosen.' })
    // Et anker må peke på noe som finnes: et felt i et objekt, og en kjent seksjon.
    for (const [anker, melding] of [
      [{ felt: 'Tekst' }, 'høre til et objekt'],
      [{ seksjon: 'doseringg' }, 'ukjent seksjon'],
    ] as const) {
      expect((await feilFra(() => agent(claude, 'kommenter', { gren: k.gren, anker, tekst: 'x' })))?.message).toContain(melding)
    }
    expect((await adm<Traad[]>('kommentarer', { gren: k.gren, apne: true }))[0]).toMatchObject({ id: merknad.traad, art: 'merknad' })
    expect((await feilFra(() => adm('kommentarer', { gren: k.gren }, leser)))?.code).toBe('42501')
    await agent(claude, 'lukk_kommentar', { gren: k.gren, kommentar: merknad.traad, klient_id: 'lukk-merknad-1' })
    expect(await adm<Traad[]>('kommentarer', { gren: k.gren, apne: true })).toEqual([])
    const [rad] = await kall.fasit<{ id: string }>('select id from kuratering.kommentarer where traad = $1 limit 1', [merknad.traad])
    expect((await feilFra(() => db.query('update kuratering.kommentarer set tekst = $1 where id = $2', ['x', rad!.id])))?.code).toBe('42501')
  })

  // Kontrolløren gjennom MCP-koblingen, med databasen bak: lese grenen og
  // fortsette i en tråd den alt har skrevet i, der et nytt forsøk med samme
  // klient_id ikke gir en kommentar til.
  it('lar kontrolløren lese en gren og svare i en eksisterende tråd gjennom MCP-koblingen, nøyaktig én gang', async () => {
    const logg = vi.spyOn(console, 'info').mockImplementation(() => {})
    const mcpKlient = {
      rpc: async (_funksjon: string, a: { nokkel: string; handling: string; data: Json }) => {
        try {
          return { data: await agent(a.nokkel, a.handling, a.data), error: null }
        } catch (e) {
          const f = e as { code?: string; message?: string }
          return { data: null, error: { code: f.code, message: f.message } }
        }
      },
    } as unknown as SupabaseClient
    let id = 0
    const verktoy = async (name: string, args: Json) => {
      const kropp = { jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }
      const foresporsel = new Request(`https://x/api/kuratering-mcp?nokkel=${chatgpt}`, { method: 'POST', body: JSON.stringify(kropp) })
      const { result } = (await (await behandleKurateringMcp(foresporsel, {}, { klient: mcpKlient })).json()) as {
        result: { isError: boolean; structuredContent: Json & { kode?: string } }
      }
      return result
    }
    try {
      const k = await kuratertGren()
      await medDokumenter(k.gren)
      await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })

      const lest = await verktoy('les', { gren: k.gren })
      expect(lest).toMatchObject({ isError: false, structuredContent: { id: k.gren, status: 'klar' } })
      const rot = {
        gren: k.gren,
        anker: { dokument: 'evidensjournal' },
        tekst: 'Delkontroll av revisjon 1: doseringen kontrollert mot kilden.',
        klient_id: `${k.gren}-r1-1`,
      }
      const forste = await verktoy('kommenter', rot)
      expect(forste).toMatchObject({ isError: false, structuredContent: { lagret: true, klient_id: `${k.gren}-r1-1` } })
      const traad = forste.structuredContent.traad as string

      // Svaret på det første forsøket kom aldri fram, så kontrolløren prøver igjen.
      const svar = { gren: k.gren, svar_pa: traad, tekst: 'Videreført: kinetikken kontrollert; ingen nye funn.', klient_id: `${k.gren}-r1-2` }
      const lagret = await verktoy('kommenter', svar)
      const igjen = await verktoy('kommenter', svar)
      expect(lagret.structuredContent).toMatchObject({ lagret: true, traad })
      expect(lagret.structuredContent.alt_lagret).toBeUndefined()
      expect(igjen).toMatchObject({ isError: false, structuredContent: { lagret: true, alt_lagret: true, id: lagret.structuredContent.id, traad } })

      // Den samme ID-en for en annen tekst eller en annen tråd er en feil, og lagrer ingenting.
      expect((await verktoy('kommenter', { ...svar, tekst: 'En annen tekst.' })).structuredContent).toMatchObject({ kode: 'PT409' })
      expect((await verktoy('kommenter', { ...svar, svar_pa: undefined })).structuredContent).toMatchObject({ kode: 'PT409' })
      expect((await verktoy('kommenter', { ...svar, klient_id: 'kort' })).structuredContent).toMatchObject({ kode: '22023' })
      // En ny tråd er den samme bare med den samme arten og det samme ankeret.
      expect((await verktoy('kommenter', rot)).structuredContent).toMatchObject({ alt_lagret: true, id: traad })
      expect((await verktoy('kommenter', { ...rot, art: 'sperrende' })).structuredContent).toMatchObject({ kode: 'PT409' })
      expect((await verktoy('kommenter', { ...rot, anker: { dokument: 'selvtest' } })).structuredContent).toMatchObject({ kode: 'PT409' })
      expect((await verktoy('kommenter', { ...rot, anker: undefined })).structuredContent).toMatchObject({ kode: 'PT409' })
      // Og et svar er ikke den nye tråden det første forsøket åpnet, selv i den samme tråden.
      expect((await verktoy('kommenter', { gren: k.gren, svar_pa: traad, tekst: rot.tekst, klient_id: rot.klient_id })).structuredContent).toMatchObject({ kode: 'PT409' })

      const trader = (await verktoy('kommentarer', { gren: k.gren })).structuredContent as unknown as { resultat: Traad[] }
      const kommentarer = trader.resultat.find((t) => t.id === traad)!.kommentarer as unknown as Json[]
      expect(kommentarer.map((x) => x.klient_id)).toEqual([`${k.gren}-r1-1`, `${k.gren}-r1-2`])
      expect(trader.resultat).toHaveLength(1)
      // Kommentarene vurderer ingenting: grenen venter fortsatt på kontrolløren.
      expect((await agent<{ status: string }>(chatgpt, 'status', { gren: k.gren })).status).toBe('klar')
      // Den samme ID-en kan brukes av en annen agent.
      expect((await agent<Json>(claude, 'kommenter', { ...svar, tekst: 'Kuratorens svar.' })).alt_lagret).toBeUndefined()
      expect(logg.mock.calls.map(([linje]) => JSON.parse(String(linje)).utfall)).toEqual(['ok', 'ok', 'ok', 'ok', 'PT409', 'PT409', '22023', 'ok', 'PT409', 'PT409', 'PT409', 'PT409', 'ok'])
    } finally {
      logg.mockRestore()
    }
  })
})

describe('en ny kontrollrunde uten endringer', () => {
  interface Lest {
    status: string
    hindringer: string[]
    vurderinger: { revisjon: number; beslutning: string; gjelder_denne: boolean }[]
    hendelser: { hendelse: string; fra?: string; revisjon: number; data?: Json }[]
  }
  const les = (gren: string) => agent<Lest>(chatgpt, 'les', { gren })
  const tilKontroll = (gren: string, revisjon = 1) => agent<Sammendrag>(claude, 'til_kontroll', { gren, revisjon })
  const avvist = (gren: string, revisjon = 1) => feilFra(() => tilKontroll(gren, revisjon))
  const vurder = async (gren: string, beslutning: string, revisjon = 1) =>
    agent<Sammendrag>(chatgpt, 'vurder', {
      gren,
      revisjon,
      runde: (await agent<Sammendrag>(chatgpt, 'status', { gren })).runde,
      beslutning,
      begrunnelse: `Syntetisk vurdering: ${beslutning}.`,
    })
  const runder = async (gren: string) =>
    (await les(gren)).hendelser.filter((h) => h.hendelse === 'til_kontroll').map((h) => [h.fra, h.revisjon, h.data])

  it('sender den samme revisjonen fra tilbakemelding til en ny runde når kuratoren har svart, og en godkjenning da kan publiseres', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    await tilKontroll(k.gren)
    // En merknad fra før vurderingen er ikke et svar på den.
    const merknad = await agent<{ traad: string }>(claude, 'kommenter', { gren: k.gren, tekst: 'Doseringen bygger på preparatomtalen.' })
    expect((await vurder(k.gren, 'endringer')).status).toBe('tilbakemelding')
    expect(await avvist(k.gren)).toMatchObject({ code: '22023', message: expect.stringContaining('Svar på vurderingen') })
    // Heller ikke å lukke en tråd, eller en kommentar fra kontrolløren.
    await agent(claude, 'lukk_kommentar', { gren: k.gren, kommentar: merknad.traad, klient_id: 'lukk-merknad-1' })
    await agent(chatgpt, 'kommenter', { gren: k.gren, tekst: 'Kilden er ikke kontrollert ferdig.' })
    expect((await avvist(k.gren))?.message).toContain('Svar på vurderingen')
    expect((await feilFra(() => agent(chatgpt, 'til_kontroll', { gren: k.gren, revisjon: 1 })))?.code).toBe('42501')

    await agent(claude, 'kommenter', { gren: k.gren, anker: { dokument: 'evidensjournal' }, tekst: 'Ingenting å rette: kilden står i evidensjournalen.' })
    expect(await tilKontroll(k.gren)).toMatchObject({ status: 'klar', revisjon: 1, runde: 2 })
    // Hendelsen viser at runden er uten endringer; den første runden er det ikke.
    expect(await runder(k.gren)).toEqual([
      ['tilbakemelding', 1, { runde: 2, uten_endringer: true }],
      ['arbeid', 1, { runde: 1 }],
    ])
    expect((await feilFra(() => agent(claude, 'publiser', { gren: k.gren, revisjon: 1 })))?.message).toContain('Bare en godkjent gren')

    // Godkjenningen i den nye runden er den som gjelder, og grenen kan publiseres.
    expect((await vurder(k.gren, 'godkjent')).status).toBe('godkjent')
    const godkjent = await les(k.gren)
    expect(godkjent.hindringer).toEqual([])
    expect(godkjent.vurderinger.map((v) => [v.revisjon, v.beslutning, v.gjelder_denne])).toEqual([
      [1, 'endringer', false],
      [1, 'godkjent', true],
    ])
    expect((await agent<{ ok: boolean }>(claude, 'publiser', { gren: k.gren, revisjon: 1 })).ok).toBe(true)
    expect(JSON.stringify(await publisert(k.slug))).toContain('Ny kinetikk')
  })

  it('avvises mens en sperrende tråd venter på svar fra kuratoren', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    await tilKontroll(k.gren)
    const traad = await agent<{ traad: string }>(chatgpt, 'kommenter', {
      gren: k.gren,
      art: 'sperrende',
      anker: { objekt: k.dosering, felt: 'Tekst' },
      tekst: 'Maksdosen mangler kilde.',
    })
    await vurder(k.gren, 'endringer')
    // En merknad svarer på vurderingen, men ikke i tråden som venter.
    await agent(claude, 'kommenter', { gren: k.gren, tekst: 'Svar følger i tråden.' })
    expect(await avvist(k.gren)).toMatchObject({ code: '22023', message: expect.stringMatching(/1 sperrende kommentar\(er\) venter på svar/) })
    await agent(claude, 'kommenter', { gren: k.gren, svar_pa: traad.traad, tekst: 'Maksdosen står i preparatomtalen; ingenting å rette.' })
    expect(await tilKontroll(k.gren)).toMatchObject({ status: 'klar', revisjon: 1, runde: 2 })
    // Tråden sperrer godkjenningen til kontrolløren har lukket den.
    expect((await feilFra(() => vurder(k.gren, 'godkjent')))?.message).toMatch(/Sperrende kommentar er åpen/)
  })

  it('stiller de samme kravene som ellers: den siste revisjonen, dokumentene og den siste versjonen av fagsiden', async () => {
    const k = await kuratertGren()
    await agent(claude, 'skriv', {
      gren: k.gren,
      forventet_revisjon: 1,
      endringer: [{ sett: k.dosering, innhold: kort(k.side, 'dosering', 'Ny dosering, andre utkast', { referanser: [k.nyRef] }) }],
    })
    await medDokumenter(k.gren)
    await tilKontroll(k.gren, 2)
    await vurder(k.gren, 'endringer', 2)
    await agent(claude, 'kommenter', { gren: k.gren, tekst: 'Ingenting å rette.' })
    expect(await avvist(k.gren, 1)).toMatchObject({ code: 'PT409', message: expect.stringContaining('Grenen er på revisjon 2, ikke 1') })
    await agent(claude, 'dokument', { gren: k.gren, art: 'selvtest', innhold: {} })
    expect((await avvist(k.gren, 2))?.message).toContain('selvtest: krav må være en liste')
    await medDokumenter(k.gren, ['selvtest'])
    // Noen publiserer siden på vanlig måte i mellomtiden: grenen må oppdateres først.
    await kall.lagre(k.dosering, 1, kort(k.side, 'dosering', 'Manuell dosering'))
    await kall.publiser(k.dosering, 2)
    expect(await avvist(k.gren, 2)).toMatchObject({ code: 'PT409', message: expect.stringContaining('publisert på nytt') })
    expect((await les(k.gren)).status).toBe('tilbakemelding')
  })

  it('lar aldri en eldre godkjenning gjelde etter en senere «endringer» av samme revisjon', async () => {
    const k = await kuratertGren()
    await tilGodkjent(k.gren)
    // En administrator stanser og gjenopptar den godkjente grenen, og den samme revisjonen kontrolleres på nytt.
    await adm('stans', { gren: k.gren, grunn: 'Ny kontroll' })
    expect((await adm<Sammendrag>('gjenoppta', { gren: k.gren })).status).toBe('retting')
    expect(await tilKontroll(k.gren)).toMatchObject({ status: 'klar', revisjon: 1, runde: 2 })
    expect((await runder(k.gren))[0]).toEqual(['retting', 1, { runde: 2, uten_endringer: true }])
    await vurder(k.gren, 'endringer')

    const etter = await les(k.gren)
    expect(etter.vurderinger.map((v) => [v.beslutning, v.gjelder_denne])).toEqual([
      ['godkjent', false],
      ['endringer', true],
    ])
    expect(etter.hindringer).toContain('Revisjon 1 er ikke faglig godkjent.')
    expect((await feilFra(() => adm('publiser', { gren: k.gren, revisjon: 1 })))?.message).toContain('Bare en godkjent gren')

    // Heller ikke etter en ny runde uten endringer gjelder den eldre godkjenningen.
    await agent(claude, 'kommenter', { gren: k.gren, tekst: 'Kontrollert på nytt; ingenting å rette.' })
    expect(await tilKontroll(k.gren)).toMatchObject({ status: 'klar', runde: 3 })
    expect((await les(k.gren)).hindringer).toContain('Revisjon 1 er ikke faglig godkjent.')
    expect((await feilFra(() => agent(claude, 'publiser', { gren: k.gren, revisjon: 1 })))?.message).toContain('Bare en godkjent gren')
    expect((await vurder(k.gren, 'godkjent')).status).toBe('godkjent')
    expect((await adm<{ ok: boolean }>('publiser', { gren: k.gren, revisjon: 1 })).ok).toBe(true)
  })
})

describe('et kall som gjentas etter et tapt svar', () => {
  interface Lest {
    vurderinger: unknown[]
    hendelser: { hendelse: string }[]
  }
  const les = (gren: string) => agent<Lest>(chatgpt, 'les', { gren })

  it('lagrer en innsending, en vurdering og en publisering nøyaktig én gang, og avviser en annen vurdering og en eldre runde', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    const inn = await agent<Json>(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })
    expect(inn).toMatchObject({ status: 'klar', runde: 1 })
    expect(inn.alt_lagret).toBeUndefined()
    expect(await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })).toMatchObject({ status: 'klar', runde: 1, alt_lagret: true })

    const endringer = { gren: k.gren, revisjon: 1, runde: 1, beslutning: 'endringer', begrunnelse: 'Doseringen trenger kilde.' }
    // Uten runden vet ikke OUSFAR hvilken runde vurderingen gjelder.
    const { runde: _, ...utenRunde } = endringer
    expect(await feilFra(() => agent(chatgpt, 'vurder', utenRunde))).toMatchObject({ code: '22023', message: expect.stringContaining('Kontrollrunden mangler') })
    expect(await feilFra(() => agent(chatgpt, 'vurder', { ...endringer, runde: 0 }))).toMatchObject({ code: 'PT409', message: expect.stringContaining('kontrollrunde 1, ikke 0') })
    expect(await agent(chatgpt, 'vurder', endringer)).toMatchObject({ status: 'tilbakemelding' })
    expect(await agent(chatgpt, 'vurder', endringer)).toMatchObject({ status: 'tilbakemelding', alt_lagret: true })
    expect(await agent(chatgpt, 'vurder', { ...endringer, begrunnelse: `  ${endringer.begrunnelse} ` })).toMatchObject({ alt_lagret: true })
    // En annen vurdering av den samme revisjonen, eller den samme fra en annen, avvises, og ingenting lagres.
    for (const [hvem, data] of [
      [() => agent(chatgpt, 'vurder', { ...endringer, beslutning: 'godkjent' }), 'en annen beslutning'],
      [() => agent(chatgpt, 'vurder', { ...endringer, begrunnelse: 'Noe annet.' }), 'en annen begrunnelse'],
      [() => adm('vurder', endringer), 'en annen'],
    ] as const) {
      expect(await feilFra(hvem), data).toMatchObject({ code: 'PT409', message: expect.stringContaining('er alt vurdert i kontrollrunde 1') })
    }
    expect((await les(k.gren)).vurderinger).toHaveLength(1)

    // En ny runde med samme revisjon: et kall fra den forrige runden lander ikke i den nye.
    await agent(claude, 'kommenter', { gren: k.gren, tekst: 'Kilden står i evidensjournalen.' })
    expect(await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })).toMatchObject({ status: 'klar', runde: 2 })
    expect(await feilFra(() => agent(chatgpt, 'vurder', endringer))).toMatchObject({ code: 'PT409', message: expect.stringContaining('kontrollrunde 2, ikke 1') })
    const godkjenning = { ...endringer, runde: 2, beslutning: 'godkjent', begrunnelse: 'Kontrollert mot kildene.' }
    expect(await agent(chatgpt, 'vurder', godkjenning)).toMatchObject({ status: 'godkjent' })
    expect(await agent(chatgpt, 'vurder', godkjenning)).toMatchObject({ status: 'godkjent', alt_lagret: true })
    expect((await les(k.gren)).vurderinger).toHaveLength(2)

    const versjoner = (await antall()).versjoner
    const publisering = await agent<Json>(claude, 'publiser', { gren: k.gren, revisjon: 1 })
    expect(publisering).toMatchObject({ ok: true, status: 'publisert' })
    expect(await agent(claude, 'publiser', { gren: k.gren, revisjon: 1 })).toEqual({ ...publisering, alt_lagret: true })
    expect((await antall()).versjoner).toBe(versjoner + 1)
    expect((await les(k.gren)).hendelser.filter((h) => h.hendelse === 'publisert')).toHaveLength(1)
    // Også etter publiseringen gjelder det ellers: en annen revisjon avvises.
    expect((await feilFra(() => agent(claude, 'publiser', { gren: k.gren, revisjon: 2 })))?.code).toBe('PT409')
  })

  it('lukker og åpner en tråd igjen nøyaktig én gang, også når et gammelt forsøk kommer fram etter en ny handling', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })
    const { traad } = await agent<{ traad: string }>(chatgpt, 'kommenter', {
      gren: k.gren,
      art: 'sperrende',
      anker: { objekt: k.dosering, felt: 'Tekst' },
      tekst: 'Maksdosen mangler kilde.',
    })
    const lukk = { gren: k.gren, kommentar: traad, tekst: 'Kilden er kontrollert.', klient_id: `${k.gren}-lukk-1` }
    const apne = { gren: k.gren, kommentar: traad, tekst: 'Kilden sier noe annet.', klient_id: `${k.gren}-apne-1` }
    const handlinger = async () =>
      (await agent<{ id: string; status: string; kommentarer: { handling: string }[] }[]>(chatgpt, 'kommentarer', { gren: k.gren })).find((t) => t.id === traad)!

    // En agent må gi lukkingen og gjenåpningen en klient-ID.
    for (const [handling, data] of [['lukk_kommentar', lukk], ['gjenapne_kommentar', apne]] as const) {
      const { klient_id: _, ...uten } = data
      expect(await feilFra(() => agent(chatgpt, handling, uten)), handling).toMatchObject({ code: '22023', message: expect.stringContaining('klient_id mangler') })
    }

    expect(await agent(chatgpt, 'lukk_kommentar', lukk)).toEqual({ traad, status: 'lukket', klient_id: lukk.klient_id })
    expect(await agent(chatgpt, 'lukk_kommentar', lukk)).toEqual({ traad, status: 'lukket', klient_id: lukk.klient_id, alt_lagret: true })
    // En ny lukking av en lukket tråd avvises; en ID som er brukt, kan ikke brukes for noe annet, heller ikke for en kommentar.
    expect(await feilFra(() => agent(chatgpt, 'lukk_kommentar', { ...lukk, klient_id: `${k.gren}-lukk-2` }))).toMatchObject({ code: '22023', message: 'Tråden er alt lukket.' })
    expect(await feilFra(() => agent(chatgpt, 'lukk_kommentar', { ...lukk, tekst: 'Noe annet.' }))).toMatchObject({ code: 'PT409', message: expect.stringContaining('alt brukt for noe annet') })
    expect(await feilFra(() => agent(chatgpt, 'gjenapne_kommentar', { ...apne, klient_id: lukk.klient_id }))).toMatchObject({ code: 'PT409' })
    expect(await feilFra(() => agent(chatgpt, 'kommenter', { gren: k.gren, svar_pa: traad, tekst: lukk.tekst, klient_id: lukk.klient_id }))).toMatchObject({
      code: 'PT409',
    })

    // Tråden åpnes igjen. Et gammelt forsøk på lukkingen som kommer fram nå, er alt lagret og lukker den ikke.
    expect(await agent(chatgpt, 'gjenapne_kommentar', apne)).toEqual({ traad, status: 'apen', klient_id: apne.klient_id })
    expect(await agent(chatgpt, 'lukk_kommentar', lukk)).toEqual({ traad, status: 'apen', klient_id: lukk.klient_id, alt_lagret: true })
    expect(await agent(chatgpt, 'gjenapne_kommentar', apne)).toEqual({ traad, status: 'apen', klient_id: apne.klient_id, alt_lagret: true })
    expect(await feilFra(() => agent(chatgpt, 'gjenapne_kommentar', { ...apne, klient_id: `${k.gren}-apne-2` }))).toMatchObject({ code: '22023', message: 'Tråden er åpen.' })
    expect(await handlinger()).toMatchObject({ status: 'apen', kommentarer: [{ handling: 'kommentar' }, { handling: 'lukket' }, { handling: 'gjenapnet' }] })

    // Og omvendt: lukket igjen, og den gamle gjenåpningen åpner den ikke.
    const lukkIgjen = { ...lukk, tekst: 'Rettet og kontrollert.', klient_id: `${k.gren}-lukk-3` }
    expect(await agent(chatgpt, 'lukk_kommentar', lukkIgjen)).toEqual({ traad, status: 'lukket', klient_id: lukkIgjen.klient_id })
    expect(await agent(chatgpt, 'gjenapne_kommentar', apne)).toEqual({ traad, status: 'lukket', klient_id: apne.klient_id, alt_lagret: true })
    expect((await handlinger()).status).toBe('lukket')

    // En administrator i appen sender ingen klient-ID, og trådens status avgjør som før.
    expect(await adm('gjenapne_kommentar', { gren: k.gren, kommentar: traad, tekst: 'Gro ser på den.' })).toEqual({ traad, status: 'apen' })
    expect(await feilFra(() => adm('gjenapne_kommentar', { gren: k.gren, kommentar: traad, tekst: 'Igjen.' }))).toMatchObject({ message: 'Tråden er åpen.' })
    expect((await handlinger()).kommentarer.map((x) => x.handling)).toEqual(['kommentar', 'lukket', 'gjenapnet', 'lukket', 'gjenapnet'])
  })

  it('sier i oversikten hva som venter på hvem, og siden når', async () => {
    const k = await kuratertGren()
    await medDokumenter(k.gren)
    await agent(claude, 'til_kontroll', { gren: k.gren, revisjon: 1 })
    await agent(chatgpt, 'kommenter', { gren: k.gren, art: 'sperrende', anker: { objekt: k.dosering, felt: 'Tekst' }, tekst: 'Maksdosen mangler kilde.' })
    await agent(chatgpt, 'kommenter', { gren: k.gren, tekst: 'Ellers ser det bra ut.' })
    await agent(chatgpt, 'vurder', { gren: k.gren, revisjon: 1, runde: 1, beslutning: 'endringer', begrunnelse: 'Se trådene.' })
    const [gren] = await adm<(Sammendrag & Json)[]>('oversikt', { stoff: k.slug })
    expect(gren).toMatchObject({ status: 'tilbakemelding', apne_sperrer: 1, venter_pa_kurator: 2 })
    const vurdert = (await les(k.gren)).hendelser.find((h) => h.hendelse === 'vurdert') as { kl?: string } | undefined
    expect(gren!.status_kl).toBe(vurdert?.kl)
    // En avsluttet gren har ingen tråder som venter.
    await adm('forkast', { gren: k.gren, grunn: 'Syntetisk' })
    const [forkastet] = await adm<Json[]>('oversikt', { stoff: k.slug, alle: true })
    expect(forkastet).toMatchObject({ status: 'arkivert' })
    expect(forkastet).not.toHaveProperty('apne_sperrer')
  })
})

describe('statusen og agentene', () => {
  it('gir en liten status uten fagtekst til den som kan lese grenen, med det kuratoren gjør nå', async () => {
    const k = await kuratertGren('Statusstoff')
    const annen = await kuratertGren('Annet statusstoff')
    const forAnnen = (await adm<Json>('status', { gren: annen.gren })).kurator_sist_kl
    await agent(claude, 'aktivitet', { gren: k.gren, tekst: 'Kontrollerer doseringen', seksjon: 'dosering', objekt: k.dosering })
    const status = await adm<Json>('status', { gren: k.gren })
    // Det kuratoren gjør i én gren, gjør ikke en annen av grenene dens aktiv.
    expect(Date.parse(String(status.kurator_sist_kl))).toBeGreaterThan(Date.parse(String(forAnnen)))
    expect((await adm<Json>('status', { gren: annen.gren })).kurator_sist_kl).toBe(forAnnen)
    expect(Object.keys(status).sort()).toEqual(
      ['aktivitet', 'apne_sperrer', 'blindfase', 'endring', 'id', 'kurator_sist_kl', 'oppdatert_kl', 'revisjon', 'runde', 'status'].sort(),
    )
    expect(status).toMatchObject({ id: k.gren, status: 'arbeid', revisjon: 1, apne_sperrer: 0, aktivitet: { tekst: 'Kontrollerer doseringen', objekt: k.dosering } })
    expect(JSON.stringify(status)).not.toContain('Ny dosering')
    expect(await agent<Json>(chatgpt, 'status', { gren: k.gren })).toMatchObject({ revisjon: 1 })
    const traad = await agent<{ traad: string }>(chatgpt, 'kommenter', { gren: k.gren, tekst: 'Mangler kilde.', art: 'sperrende' })
    const etterTraad = await adm<{ apne_sperrer: number; endring: number }>('status', { gren: k.gren })
    expect(etterTraad.apne_sperrer).toBe(1)
    // Et svar i tråden endrer ikke sperrene, men gir en ny endring, og lesingen har den samme.
    await agent(claude, 'kommenter', { gren: k.gren, svar_pa: traad.traad, tekst: 'Kilde lagt til.' })
    const etterSvar = await adm<{ apne_sperrer: number; endring: number }>('status', { gren: k.gren })
    expect(etterSvar.apne_sperrer).toBe(1)
    expect(etterSvar.endring).toBeGreaterThan(etterTraad.endring)
    expect((await adm<{ endring: number }>('les', { gren: k.gren })).endring).toBe(etterSvar.endring)
    // Aktiviteten alene er ingen endring.
    await agent(claude, 'aktivitet', { gren: k.gren, tekst: 'Leser kilden' })
    expect((await adm<{ endring: number }>('status', { gren: k.gren })).endring).toBe(etterSvar.endring)
    expect((await feilFra(() => adm('status', { gren: k.gren }, leser)))?.code).toBe('42501')
    expect((await feilFra(() => adm('status', { gren: crypto.randomUUID() })))?.code).toBe('PT404')
  })

  it('gir kurateringskøen grenene uten fagtekst, bare gjennom serveren', async () => {
    const k = await kuratertGren('Køstoff')
    const ko = await db.transaction(async (tx) => {
      await tx.query(`select set_config('role', 'service_role', true)`)
      const { rows } = await tx.query<{ s: Json[] }>('select public.kuratering_kostatus() as s')
      return rows[0]!.s
    })
    const rad = ko.find((g) => g.id === k.gren)!
    expect(Object.keys(rad).sort()).toEqual(['art', 'id', 'oppdatert_kl', 'publisert_kl', 'revisjon', 'runde', 'status', 'stoff'])
    expect(rad).toMatchObject({ stoff: k.slug, art: 'kuratering', status: 'arbeid', revisjon: 1 })
    expect((await feilFra(() => kall.les(admin, 'select public.kuratering_kostatus()')))?.code).toBe('42501')
  })

  it('har hver handling i lista som en funksjon, og gir Claude-kuratoren en nøkkel uten at nøkkelen står i repoet', async () => {
    const mangler = await kall.fasit<{ handling: string }>(
      `select h.handling from kuratering.handlingsliste h
       where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'kuratering' and p.proname = 'h_' || h.handling)`,
    )
    expect(mangler).toEqual([])
    const fil = readFileSync(new URL('../../supabase/migrations/20261016070000_kurateringsagenter.sql', import.meta.url), 'utf8')
    expect(fil).toMatch(/nokkel_sha256 = '[0-9a-f]{64}'/)
    expect(fil).not.toMatch(/far_[0-9a-f]{32,}/)
  })
})

describe('innholdsmodellen i databasen', () => {
  it('har de samme seksjonene som fagsiden', async () => {
    const [rad] = await kall.fasit<{ s: string[] }>('select kuratering.seksjoner() as s')
    expect(rad!.s).toEqual([...PANELREKKEFOLGE])
  })

  it('har de samme kontrollpunktene som dekningsmatrisen, og godtar og avviser de samme matrisene som kuratorverktøyet', async () => {
    const [rad] = await kall.fasit<{ p: string[] }>('select kuratering.kontrollpunkter() as p')
    expect(rad!.p).toEqual(kontrollpunkter())
    const dbFeil = async (m: unknown) =>
      (await kall.fasit<{ f: string[] }>(`select kuratering.dokumentfeil('dekningsmatrise', $1::jsonb) as f`, [JSON.stringify(m)]))[0]!.f
    const m = tomMatrise('de_novo')
    for (const o of m.omrader) Object.assign(o, { begrunnelse: 'Kontrollert.', kilder: ['SPC'], sok: [], bevis: 'Lest.' })
    expect(kontrollerDekning(m)).toEqual([])
    expect(await dbFeil(m)).toEqual([])
    m.omrader[0]!.kilder = ['']
    expect(kontrollerDekning(m)).toHaveLength(1)
    expect(await dbFeil(m)).toHaveLength(1)
  })

  it('har de samme punktene i selvtesten som kuratorverktøyet', async () => {
    const [rad] = await kall.fasit<{ krav: string[]; ikke_relevant: string[]; porter: string[] }>(
      'select kuratering.selvtestkrav() as krav, kuratering.selvtestkrav_kan_vaere_ikke_relevant() as ikke_relevant, kuratering.selvtestporter() as porter',
    )
    expect(rad!.krav).toEqual(SELVTESTKRAV.map((k) => k.nokkel))
    expect(rad!.ikke_relevant).toEqual(SELVTESTKRAV.filter((k) => 'kan_vaere_ikke_relevant' in k).map((k) => k.nokkel))
    expect(rad!.porter).toEqual(SELVTESTPORTER.map((p) => p.nokkel))
    // Malen fra verktøyet har hvert punkt, men holder ikke før status og bevis er fylt ut.
    const mal = tomSelvtest()
    const dbFeil = async (s: unknown) =>
      (await kall.fasit<{ f: string[] }>(`select kuratering.dokumentfeil('selvtest', $1::jsonb) as f`, [JSON.stringify(s)]))[0]!.f
    expect(await dbFeil(mal)).toHaveLength(2)
    for (const o of [...mal.krav, ...mal.porter]) Object.assign(o, { status: 'bestatt', bevis: 'Syntetisk bevis' })
    expect(await dbFeil(mal)).toEqual([])
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
