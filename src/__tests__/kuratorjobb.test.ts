/**
 * Kuratorjobbene (`docs/kuratorjobber.md`): forespørselen, kontrollen av
 * preparatomtalene, og funksjonstesten mot en ekte database, som en vanlig
 * innlogget bruker. Innholdet er syntetisk.
 */
import type { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser } from '../faginnhold/lesing'
import { publiseringsplan } from '../faginnhold/stoffside'
import { foresporselFraFelter, lesForesporsel, MAKS_STOFFER } from '../kuratorjobb/foresporsel'
import { funksjonstest, kontrollerBruker } from '../kuratorjobb/funksjonstest'
import { JOBBGREN, JOBBMAPPE, samletStatus, type Kontroll } from '../kuratorjobb/modell'
import { AVSNITT_4_8, erDmpAdresse, festomtaler, finnAvsnitt, kontrollerPdfsvar, lesPdfinfo, type Pdfsvar } from '../kuratorjobb/spc'
import type { Legemiddelutvalg } from '../legemiddeldata/lesing'
import { SITERING } from '../faginnhold/referanser'
import { AMITRIPTYLIN, synkroniserUtdrag } from './hjelp/fest'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

const ROT = fileURLToPath(new URL('../../', import.meta.url))
const DMP = 'https://produktinformasjon.legemiddelsok.no/preparatomtaler'
const utfall = (kontroller: readonly Kontroll[]) => Object.fromEntries(kontroller.map((k) => [k.id, k.status]))

describe('forespørselen', () => {
  it('tar imot en forespørsel med stoffene og fyller inn oppgavene', () => {
    expect(lesForesporsel(JSON.stringify({ versjon: 1, stoffer: [' citalopram ', 'citalopram'] }))).toEqual({
      foresporsel: { versjon: 1, stoffer: ['citalopram'], oppgaver: ['funksjonstest', 'spc'] },
    })
    expect(
      lesForesporsel(
        JSON.stringify({ versjon: 1, stoffer: ['citalopram'], oppgaver: ['spc'], spc: { adresser: [`${DMP}/06-4251.pdf`], dpi: 200 }, referanse: 'kø-17' }),
      ),
    ).toEqual({
      foresporsel: {
        versjon: 1,
        stoffer: ['citalopram'],
        oppgaver: ['spc'],
        spc: { adresser: [`${DMP}/06-4251.pdf`], maks: 20, dpi: 200 },
        referanse: 'kø-17',
      },
    })
    expect(lesForesporsel(JSON.stringify({ versjon: 1, stoffer: 'alle', oppgaver: ['funksjonstest'] })).foresporsel?.stoffer).toBe('alle')
  })

  it('avviser det som ikke kan kjøres, og sier hva som er galt', () => {
    const feil = (f: unknown) => lesForesporsel(typeof f === 'string' ? f : JSON.stringify(f)).feil ?? []
    expect(feil('{ ikke json')).toEqual(['Forespørselen er ikke gyldig JSON.'])
    expect(feil([])).toEqual(['Forespørselen må være et JSON-objekt.'])
    expect(feil({ versjon: 2, stoffer: ['a'] })).toEqual(['versjon må være 1.'])
    expect(feil({ versjon: 1, stoffer: [] })).toHaveLength(1)
    expect(feil({ versjon: 1, stoffer: ['a'], kjør: 'rm -rf /' })).toEqual(['Ukjent felt: kjør.'])
    expect(feil({ versjon: 1, stoffer: ['a'], oppgaver: ['publiser'] })).toHaveLength(1)
    expect(feil({ versjon: 1, stoffer: 'alle' })).toEqual(['"alle" gjelder bare funksjonstesten; preparatomtalene hentes for stoffer med navn.'])
    expect(feil({ versjon: 1, stoffer: Array.from({ length: MAKS_STOFFER + 1 }, (_, i) => `s${i}`) })).toHaveLength(1)
    expect(feil({ versjon: 1, stoffer: ['a'], spc: { adresser: ['https://example.com/spc.pdf'] } })).toEqual([
      'Ikke en adresse til en preparatomtale hos DMP: https://example.com/spc.pdf',
    ])
    expect(feil({ versjon: 1, stoffer: ['a'], spc: { maks: 0, dpi: 1000, sider: 3 } })).toHaveLength(3)
  })

  it('lages av feltene når jobben startes for hånd', () => {
    expect(lesForesporsel(foresporselFraFelter('citalopram, escitalopram', 'funksjonstest')).foresporsel).toEqual({
      versjon: 1,
      stoffer: ['citalopram', 'escitalopram'],
      oppgaver: ['funksjonstest'],
    })
    expect(lesForesporsel(foresporselFraFelter('alle', 'funksjonstest')).foresporsel?.stoffer).toBe('alle')
  })
})

describe('jobbgrenene', () => {
  it('godtar bare grener under kuratorjobb/', () => {
    for (const gren of ['kuratorjobb/citalopram', 'kuratorjobb/ko/citalopram-2026-10-13', 'kuratorjobb/a.b_c-1']) expect(JOBBGREN.test(gren)).toBe(true)
    for (const gren of ['main', 'kuratorjobb/', 'kuratorjobb/../main', 'kuratorjobb//a', 'x/kuratorjobb/a', 'kuratorjobb/a b', 'kuratorjobb/a;rm']) {
      expect(JOBBGREN.test(gren), gren).toBe(false)
    }
  })

  it('jobbmappen med forespørsler og resultater slås aldri sammen med main', () => {
    expect(existsSync(`${ROT}${JOBBMAPPE}`)).toBe(false)
  })

  it('arbeidsflyten kjører jobben bare fra main, med testbrukeren i et eget miljø', () => {
    const flyt = readFileSync(`${ROT}.github/workflows/kuratorjobb.yml`, 'utf8')
    const kjor = flyt.slice(flyt.indexOf('\n  kjor:'))
    expect(kjor).toContain("github.ref == 'refs/heads/main'")
    expect(kjor).toContain('environment: kuratortest')
    // Ingen hemmeligheter i jobben som videresender fra jobbgrenene.
    expect(flyt.slice(0, flyt.indexOf('\n  kjor:'))).not.toContain('secrets.')
    // Uttrykk står bare som verdien til en nøkkel (som `env`), aldri inne i et skript,
    // så et felt fra forespørselen eller grenen aldri blir en del av en kommando.
    for (const linje of flyt.split('\n').filter((l) => l.includes('${{'))) {
      expect(linje, linje).toMatch(/^\s*(?!run:)[A-Za-z_-]+:\s/)
    }
  })
})

describe('preparatomtalene', () => {
  it('godtar bare DMPs adresser', () => {
    expect(erDmpAdresse(`${DMP}/06-4251.pdf`)).toBe(true)
    expect(erDmpAdresse(`${DMP}/0000-08150.pdf`)).toBe(true)
    for (const a of [
      `http://produktinformasjon.legemiddelsok.no/preparatomtaler/06-4251.pdf`,
      `${DMP}/06-4251.pdf?x=1`,
      `${DMP}/../hemmelig.pdf`,
      `${DMP}/06-4251.docx`,
      'https://produktinformasjon.legemiddelsok.no.example.com/preparatomtaler/06-4251.pdf',
    ]) {
      expect(erDmpAdresse(a), a).toBe(false)
    }
  })

  it('samler preparatene FEST knytter til hver preparatomtale', () => {
    const merkevare = (id: string, navn: string, preparatomtale: string | null) =>
      ({ id, varenavn: navn, navn_form_styrke: `${navn} tab`, produsent: 'Syntetisk', atc: { kode: 'N06AB04', tekst: 'Citalopram' }, legemiddelform: null, legemiddelform_lang: 'Tablett', preparatomtale }) as unknown as Legemiddelutvalg['merkevarer'][number]
    const omtaler = festomtaler({
      merkevarer: [
        merkevare('a', 'A 10', `${DMP}/1.pdf`),
        merkevare('b', 'A 20', `${DMP}/1.pdf`),
        merkevare('c', 'B 10', `${DMP}/2.pdf`),
        merkevare('d', 'C', null),
        merkevare('e', 'D', 'https://www.ema.europa.eu/d.pdf'),
      ],
    })
    expect(omtaler.omtaler.map((o) => [o.adresse, o.preparater.map((p) => p.merkevare_id)])).toEqual([
      [`${DMP}/1.pdf`, ['a', 'b']],
      [`${DMP}/2.pdf`, ['c']],
    ])
    expect(omtaler.uten_omtale.map((p) => p.merkevare_id)).toEqual(['d'])
    expect(omtaler.avviste).toEqual(['https://www.ema.europa.eu/d.pdf'])
    expect(omtaler.omtaler[0]!.preparater[0]).toEqual({
      merkevare_id: 'a',
      varenavn: 'A 10',
      navn_form_styrke: 'A 10 tab',
      produsent: 'Syntetisk',
      atc: 'N06AB04',
      legemiddelform: 'Tablett',
    })
  })

  const pdf = Buffer.from('%PDF-1.5\nsyntetisk innhold\n%%EOF\n', 'latin1')
  const md5 = (b: Uint8Array) => createHash('md5').update(b).digest('base64')
  const svar = (endring: Partial<Pdfsvar> = {}): Pdfsvar => ({
    adresser: [`${DMP}/1.pdf`],
    status: 200,
    hoder: { 'content-type': 'application/pdf', 'content-length': String(pdf.length), 'content-md5': md5(pdf) },
    bytes: pdf,
    ...endring,
  })

  it('godkjenner en hel PDF fra DMP', () => {
    expect(utfall(kontrollerPdfsvar(svar()))).toEqual({ adresse: 'ok', http: 'ok', innholdstype: 'ok', lengde: 'ok', kontrollsum: 'ok', pdf: 'ok' })
  })

  it('stopper en fil som er avkuttet, endret, ikke en PDF eller sendt bort fra DMP', () => {
    const avkuttet = pdf.subarray(0, 12)
    expect(utfall(kontrollerPdfsvar(svar({ bytes: avkuttet })))).toMatchObject({ lengde: 'feil', kontrollsum: 'feil', pdf: 'feil' })
    const endret = Buffer.from(pdf)
    endret[10] = 0x58
    expect(utfall(kontrollerPdfsvar(svar({ bytes: endret })))).toMatchObject({ lengde: 'ok', kontrollsum: 'feil' })
    const html = Buffer.from('<html>Ikke funnet</html>')
    expect(
      utfall(kontrollerPdfsvar(svar({ bytes: html, hoder: { 'content-type': 'text/html', 'content-length': String(html.length) } }))),
    ).toMatchObject({ innholdstype: 'feil', kontrollsum: 'advarsel', pdf: 'feil' })
    expect(utfall(kontrollerPdfsvar(svar({ status: 404 })))).toMatchObject({ http: 'feil' })
    expect(utfall(kontrollerPdfsvar(svar({ adresser: [`${DMP}/1.pdf`, 'https://annen.example/1.pdf'] })))).toMatchObject({ adresse: 'feil' })
  })

  it('finner sidene avsnitt 4.8 står på, uten å la seg lure av henvisninger', () => {
    const sider = [
      '4.4 Advarsler\nse pkt.\n4.8 og 4.9 for mer.',
      'tekst',
      '   4.8   Bivirkninger\nTabell',
      'MedDRA-tabell fortsetter',
      '4.9 Overdosering\n',
    ]
    expect(finnAvsnitt(sider, AVSNITT_4_8)).toEqual({ fra: 3, til: 5 })
    expect(finnAvsnitt(['4.8. Bivirkninger', 'ingen neste overskrift'], AVSNITT_4_8)).toEqual({ fra: 1, til: 2 })
    expect(finnAvsnitt(['ingenting her'], AVSNITT_4_8)).toBeNull()
  })

  it('leser utskriften fra pdfinfo', () => {
    expect(lesPdfinfo('Title:           Portrait SmPC\nPages:           15\nEncrypted:       no\nPDF version:    1.5\n')).toEqual({
      sider: 15,
      pdfversjon: '1.5',
      kryptert: false,
      tittel: 'Portrait SmPC',
      laget: null,
      endret: null,
      produsent: null,
    })
    expect(lesPdfinfo('')).toMatchObject({ sider: null, kryptert: false })
  })
})

describe('det samlede utfallet', () => {
  it('er det verste, og ok når alt annet ikke er aktuelt', () => {
    expect(samletStatus([])).toBe('ok')
    expect(samletStatus(['ikke_aktuelt'])).toBe('ikke_aktuelt')
    expect(samletStatus(['ok', 'ikke_aktuelt'])).toBe('ok')
    expect(samletStatus(['ok', 'advarsel', 'ikke_aktuelt'])).toBe('advarsel')
    expect(samletStatus(['advarsel', 'feil', 'ok'])).toBe('feil')
  })
})

describe('funksjonstesten', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let admin: string
  let bruker: string
  let brukerklient: SupabaseClient

  const dokument = (...innhold: unknown[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: innhold }] })
  const tekst = (text: string) => ({ type: 'text', text })

  beforeAll(async () => {
    db = await nyDatabase()
    await synkroniserUtdrag(db)
    admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    bruker = await opprettBruker(db, { brukernavn: 'kuratortest', fornavn: 'Kurator', etternavn: 'Test', rolle: 'user' })
    kall = faginnholdskall(db, admin)
    const lager = lagFaginnholdslager(kall.klientFor(admin))
    const kilde = (await lager.opprettUtkast('referanse', { tittel: 'Syntetisk lærebok', forfattere: 'Nordmann O', aar: '2020', lenke: '' })).id
    const side = (await lager.opprettUtkast('infoside', { navn: 'Amitriptylin' })).id
    const elementer = [
      { panel: 'preparater', elementtype: 'legemiddelkobling', data: { virkestoff: [{ fest_id: AMITRIPTYLIN, navn: 'Amitriptylin' }] } },
      { panel: 'farmakogenetikk', elementtype: 'clinpgxkobling', data: { kjemikalier: [{ clinpgx_id: 'PA448385', navn: 'amitriptyline' }] } },
      {
        panel: 'farmakodynamikk',
        elementtype: 'riktekst',
        data: { dokument: dokument(tekst('Syntetisk tekst.'), { type: SITERING, attrs: { referanser: [kilde] } }) },
      },
    ]
    for (const [posisjon, e] of elementer.entries()) await lager.opprettUtkast('innholdselement', { infoside: side, posisjon, ...e })
    const leser = lagFaginnholdsleser(kall.klientFor(admin))
    for (const steg of publiseringsplan(await leser.lesStoffside('amitriptylin', 'utkast'))) await lager.publiserUtkast(steg.id, steg.revisjon)
    // Et upublisert utkast, som en vanlig bruker ikke skal se.
    const utkast = await leser.lesStoffside('amitriptylin', 'utkast')
    const tekstelement = utkast.elementer.find((e) => e.innhold.elementtype === 'riktekst')!
    await lager.lagreUtkast(tekstelement.id, tekstelement.revisjon, {
      ...tekstelement.innhold,
      data: { dokument: dokument(tekst('Upublisert syntetisk endring.')) },
    })
    brukerklient = kall.klientFor(bruker)
  }, 120_000)

  it('kontrollerer at testbrukeren er en vanlig bruker', async () => {
    expect(utfall(await kontrollerBruker(brukerklient))).toEqual({ bruker: 'ok' })
    expect(utfall(await kontrollerBruker(kall.klientFor(admin)))).toEqual({ bruker: 'feil' })
  })

  it('leser fagsiden og dataene den viser med appens egne kall', async () => {
    const resultat = await funksjonstest(brukerklient, 'amitriptylin')
    expect(utfall(resultat.kontroller)).toEqual({
      les_stoff: 'ok',
      sidemodell: 'ok',
      referanser: 'ok',
      utkast_skjult: 'ok',
      stoffliste: 'ok',
      fest: 'ok',
      preparatvisning: 'ok',
      interaksjoner: 'ok',
      interaksjonsvisning: 'ok',
      bivirkninger: 'ikke_aktuelt',
      // Kjemikaliet er koblet, men aldri hentet fra ClinPGx, og CPIC er aldri hentet.
      clinpgx: 'advarsel',
      farmakogenetikkvisning: 'ok',
      cpic: 'advarsel',
      cpicvisning: 'ok',
    })
    expect(resultat.status).toBe('advarsel')
    expect(resultat.kontroller.find((k) => k.id === 'les_stoff')).toMatchObject({ rpc: 'les_stoff', antall: { elementer: 3, referanser: 1 } })
    expect(resultat.kontroller.find((k) => k.id === 'fest')!.antall!.merkevarer).toBeGreaterThan(0)
    // Svarene er det appen leste: det publiserte, ikke utkastet.
    expect(JSON.stringify(resultat.svar.les_stoff)).toContain('Syntetisk tekst.')
    expect(JSON.stringify(resultat.svar.les_stoff)).not.toContain('Upublisert')
    expect(Object.keys(resultat.svar).sort()).toEqual(['les_bivirkninger', 'les_cpic', 'les_farmakogenetikk', 'les_interaksjoner', 'les_legemidler', 'les_stoff'])
  })

  it('sier fra når en vanlig bruker ser utkastet', async () => {
    const resultat = await funksjonstest(kall.klientFor(admin), 'amitriptylin')
    expect(utfall(resultat.kontroller).utkast_skjult).toBe('feil')
    expect(resultat.status).toBe('feil')
  })

  it('melder en side som ikke finnes, og hopper over det som trenger den', async () => {
    const resultat = await funksjonstest(brukerklient, 'finnes-ikke')
    expect(utfall(resultat.kontroller)).toMatchObject({ les_stoff: 'feil', fest: 'feil', clinpgx: 'feil', stoffliste: 'feil' })
    expect(resultat.status).toBe('feil')
  })

  it('fortsetter når ett kall feiler, og melder rader appen ville forkastet', async () => {
    const klient = {
      rpc: async (funksjon: string, argumenter?: Record<string, unknown>) => {
        if (funksjon === 'les_legemidler') return { data: null, error: { message: 'syntetisk feil' } }
        if (funksjon === 'les_bivirkninger') {
          return {
            data: {
              kilder: [{ id: 'k1', nokkel: 'syntetisk', type: 'spc', tittel: 'Syntetisk SPC', kontekster: [] }],
              bivirkninger: [{ kilde: 'k1', kontekst: null, organsystem: 'ukjent_system', frekvens: 'vanlige', tekst: 'Syntetisk', posisjon: 1 }],
            },
            error: null,
          }
        }
        return brukerklient.rpc(funksjon, argumenter)
      },
    } as unknown as SupabaseClient
    const resultat = await funksjonstest(klient, 'amitriptylin')
    expect(resultat.kontroller.find((k) => k.id === 'fest')).toMatchObject({ status: 'feil', melding: 'les_legemidler feilet: syntetisk feil' })
    expect(resultat.kontroller.find((k) => k.id === 'bivirkninger')).toMatchObject({ status: 'feil', antall: { rader: 1, rader_appen_viser: 0 } })
    expect(utfall(resultat.kontroller)).toMatchObject({ les_stoff: 'ok', clinpgx: 'advarsel' })
  })
})
