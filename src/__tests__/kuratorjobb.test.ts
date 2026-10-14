/**
 * Kuratorjobbene (`docs/kuratorjobber.md`): forespørselen, kontrollen av
 * preparatomtalene, og funksjonstesten mot en ekte database, som en vanlig
 * innlogget bruker. Innholdet er syntetisk.
 */
import type { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser } from '../faginnhold/lesing'
import { publiseringsplan } from '../faginnhold/stoffside'
import { foresporselFraFelter, lesForesporsel, MAKS_STOFFER } from '../kuratorjobb/foresporsel'
import { funksjonstest, kontrollerBruker } from '../kuratorjobb/funksjonstest'
import { JOBBGREN, JOBBMAPPE, offentligFeil, samletStatus, type Kontroll } from '../kuratorjobb/modell'
import { AVSNITT_4_8, erDmpAdresse, festomtaler, finnAvsnitt, kontrollerPdfsvar, lesPdfinfo, vurderDekning, type Festomtaler, type Pdfsvar } from '../kuratorjobb/spc'
import type { Legemiddelutvalg } from '../legemiddeldata/lesing'
import { SITERING } from '../faginnhold/referanser'
import { lagFplager } from '../farmakologiportalen/lager'
import { synkroniserFarmakologiportalen } from '../farmakologiportalen/synk'
import { byggForbindelsesregister, FORBINDELSER, type Forbindelse } from '../kjemi/forbindelser'
import { lagKjemilager } from '../kjemi/lager'
import { synkroniserKjemi } from '../kjemi/synk'
import { falskFpApi, falskPubchemApi, FPLISTER } from './hjelp/datakilder'
import { AMITRIPTYLIN, kallSom, synkroniserUtdrag } from './hjelp/fest'
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

/** Skriptet til steget med navnet i arbeidsflyten, slik Actions kjører det. */
function stegskript(flyt: string, navn: string): string {
  const linjer = flyt.split('\n')
  const steg = linjer.findIndex((l) => l.trim() === `- name: ${navn}`)
  const run = linjer.findIndex((l, i) => i > steg && /^\s*run: \|$/.test(l))
  const innrykk = linjer[run]!.search(/\S/)
  const kropp: string[] = []
  for (const l of linjer.slice(run + 1)) {
    if (l.trim() && l.search(/\S/) <= innrykk) break
    kropp.push(l)
  }
  const fjern = Math.min(...kropp.filter((l) => l.trim()).map((l) => l.search(/\S/)))
  return kropp.map((l) => l.slice(fjern)).join('\n')
}

describe('startveiene', () => {
  const flyt = readFileSync(`${ROT}.github/workflows/kuratorjobb.yml`, 'utf8')
  const git = (mappe: string, ...a: string[]) =>
    execFileSync('git', ['-c', 'user.name=Syntetisk', '-c', 'user.email=syntetisk@example.invalid', '-c', 'init.defaultBranch=main', ...a], { cwd: mappe, encoding: 'utf8' })

  /**
   * Kjører stegene som lager og melder jobben, med en lokal kopi av repoet
   * som «origin» og det ekte skriptet. `npm` er byttet ut med et kall til
   * skriptet, siden mappen med koden her ikke er en kopi av repoet.
   */
  function kjorSteg(mappe: string, navn: string, env: Record<string, string>) {
    execFileSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', stegskript(flyt, navn)], {
      cwd: join(mappe, 'jobb'),
      env: { ...process.env, PATH: `${join(mappe, 'bin')}:${process.env.PATH}`, GITHUB_ENV: join(mappe, 'github_env'), KJORING: 'https://example.invalid/kjoring/1', ...env },
      stdio: 'pipe',
    })
  }

  function oppsett(): string {
    const mappe = mkdtempSync(join(tmpdir(), 'kuratorjobb-'))
    for (const m of ['bin', 'kode', 'kilde']) mkdirSync(join(mappe, m))
    writeFileSync(
      join(mappe, 'bin', 'npm'),
      `#!/usr/bin/env bash\n# npm run -s kuratorjobb -- <argumenter>\nshift 4\nexec "${ROT}node_modules/.bin/vite-node" --root "${ROT}" "${ROT}scripts/kuratorjobb.ts" -- "$@"\n`,
    )
    chmodSync(join(mappe, 'bin', 'npm'), 0o755)
    git(mappe, 'init', '-q', '--bare', 'origin.git')
    const kilde = join(mappe, 'kilde')
    git(kilde, 'init', '-q')
    writeFileSync(join(kilde, 'README.md'), 'Syntetisk\n')
    git(kilde, 'add', '-A')
    git(kilde, 'commit', '-qm', 'Start')
    git(kilde, 'push', '-q', '../origin.git', 'HEAD:refs/heads/main')
    return mappe
  }

  const lesPaGren = (mappe: string, gren: string, fil: string) => JSON.parse(git(join(mappe, 'origin.git'), 'show', `${gren}:${fil}`))

  it('startet for hånd med stoffene: lager grenen med forespørselen og melder jobben startet', () => {
    const mappe = oppsett()
    try {
      git(mappe, 'clone', '-q', '-b', 'main', 'origin.git', 'jobb')
      const gren = 'kuratorjobb/manuell-1'
      kjorSteg(mappe, 'Lag grenen for en jobb startet med stoffene', { GREN: gren, STOFFER: 'citalopram, escitalopram', OPPGAVER: 'funksjonstest' })
      kjorSteg(mappe, 'Meld at jobben er startet', { GREN: gren })
      expect(lesPaGren(mappe, gren, 'kuratorjobb/foresporsel.json')).toEqual({ versjon: 1, stoffer: ['citalopram', 'escitalopram'], oppgaver: ['funksjonstest'] })
      const status = lesPaGren(mappe, gren, 'kuratorjobb/resultat/status.json')
      expect(status).toMatchObject({ status: 'kjorer', jobb: { gren } })
      const foresporsel = git(join(mappe, 'origin.git'), 'show', `${gren}:kuratorjobb/foresporsel.json`)
      expect(status.jobb.foresporsel_sha256).toBe(createHash('sha256').update(foresporsel).digest('hex'))
    } finally {
      rmSync(mappe, { recursive: true, force: true })
    }
  }, 60_000)

  it('startet av en forespørsel på en jobbgren: melder jobben startet på samme gren', () => {
    const mappe = oppsett()
    try {
      const gren = 'kuratorjobb/citalopram'
      const kilde = join(mappe, 'kilde')
      git(kilde, 'switch', '-qc', gren)
      mkdirSync(join(kilde, 'kuratorjobb'))
      writeFileSync(join(kilde, 'kuratorjobb', 'foresporsel.json'), JSON.stringify({ versjon: 1, stoffer: ['citalopram'], referanse: 'kø-1' }))
      git(kilde, 'add', '-A')
      git(kilde, 'commit', '-qm', 'Forespørsel')
      git(kilde, 'push', '-q', '../origin.git', `HEAD:refs/heads/${gren}`)
      git(mappe, 'clone', '-q', '-b', gren, 'origin.git', 'jobb')
      kjorSteg(mappe, 'Meld at jobben er startet', { GREN: gren })
      expect(lesPaGren(mappe, gren, 'kuratorjobb/resultat/status.json')).toMatchObject({ status: 'kjorer', jobb: { gren } })
      expect(lesPaGren(mappe, gren, 'kuratorjobb/foresporsel.json')).toMatchObject({ referanse: 'kø-1' })
      expect(readFileSync(join(mappe, 'github_env'), 'utf8')).toContain(`JOBB_GREN=${gren}`)
    } finally {
      rmSync(mappe, { recursive: true, force: true })
    }
  }, 60_000)
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
    expect(omtaler.avviste.map((o) => [o.adresse, o.preparater.map((p) => p.merkevare_id)])).toEqual([['https://www.ema.europa.eu/d.pdf', ['e']]])
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
    expect(utfall(kontrollerPdfsvar(svar({ bytes: html, hoder: { 'content-type': 'application/octet-stream' } })))).toMatchObject({ innholdstype: 'feil', pdf: 'feil' })
    expect(utfall(kontrollerPdfsvar(svar({ status: 404 })))).toMatchObject({ http: 'feil' })
    expect(utfall(kontrollerPdfsvar(svar({ adresser: [`${DMP}/1.pdf`, 'https://annen.example/1.pdf'] })))).toMatchObject({ adresse: 'feil' })
  })

  it('godtar en PDF etter innholdet når DMP oppgir en annen innholdstype, med en advarsel', () => {
    for (const type of ['application/octet-stream', 'binary/octet-stream', undefined]) {
      const hoder: Record<string, string> = { 'content-length': String(pdf.length), 'content-md5': md5(pdf) }
      if (type) hoder['content-type'] = type
      const kontroller = kontrollerPdfsvar(svar({ hoder }))
      expect(utfall(kontroller), type).toEqual({ adresse: 'ok', http: 'ok', innholdstype: 'advarsel', lengde: 'ok', kontrollsum: 'ok', pdf: 'ok' })
      expect(kontroller.find((k) => k.id === 'innholdstype')!.melding).toContain(type ?? 'ikke oppgitt')
      expect(samletStatus(kontroller.map((k) => k.status))).toBe('advarsel')
    }
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

describe('dekningen av preparatomtalene', () => {
  const preparat = (id: string) => ({ merkevare_id: id, varenavn: `Syntetisk ${id}`, navn_form_styrke: `Syntetisk ${id} tab`, produsent: 'Syntetisk', atc: 'N06AB04', legemiddelform: 'Tablett' })
  const a = `${DMP}/a.pdf`
  const b = `${DMP}/b.pdf`
  const fest = (endring: Partial<Festomtaler> = {}): Festomtaler => ({
    omtaler: [
      { adresse: a, preparater: [preparat('1'), preparat('2')] },
      { adresse: b, preparater: [preparat('3')] },
    ],
    avviste: [],
    uten_omtale: [],
    ...endring,
  })
  const grunner = (r: ReturnType<typeof vurderDekning>) => r.dekning.mangler.map((m) => [m.merkevare_id, m.grunn])

  it('er dekket bare når hvert preparat i FEST har en hentet omtale', () => {
    const r = vurderDekning(fest(), { valgte: [a, b], utelatt: [], hentet: new Set([a, b]), dokumenter: 2 })
    expect(r.kontroll.status).toBe('ok')
    expect(r.dekning).toEqual({ dekket: true, preparater: 3, hentet: 3, dokumenter: 2, mangler: [] })
  })

  it('melder preparater uten omtale hos DMP, som sentralt godkjente, med en sporbar liste', () => {
    const r = vurderDekning(fest({ uten_omtale: [preparat('4')], avviste: [{ adresse: 'https://www.ema.europa.eu/x.pdf', preparater: [preparat('5')] }] }), {
      valgte: [a, b],
      utelatt: [],
      hentet: new Set([a, b]),
      dokumenter: 2,
    })
    expect(r.kontroll.status).toBe('advarsel')
    expect(r.dekning).toMatchObject({ dekket: false, preparater: 5, hentet: 3 })
    expect(grunner(r)).toEqual([['5', 'ikke_dmp'], ['4', 'uten_omtale']])
    expect(r.dekning.mangler[0]).toMatchObject({ varenavn: 'Syntetisk 5', produsent: 'Syntetisk', atc: 'N06AB04', adresse: 'https://www.ema.europa.eu/x.pdf' })
    expect(r.kontroll.melding).toContain('SPC-behovet er ikke dekket')
  })

  it('likestiller aldri «ingen fil hentet» med at behovet er dekket', () => {
    // Bare sentralt godkjente preparater: ingenting å hente hos DMP.
    const bareEma = vurderDekning(fest({ omtaler: [], uten_omtale: [preparat('1')] }), { valgte: [], utelatt: [], hentet: new Set(), dokumenter: 0 })
    expect(bareEma.kontroll.status).toBe('advarsel')
    expect(bareEma.dekning).toMatchObject({ dekket: false, preparater: 1, hentet: 0 })
    expect(grunner(bareEma)).toEqual([['1', 'uten_omtale']])
    // FEST oppgir ingen preparater, eller FEST kunne ikke leses.
    for (const f of [fest({ omtaler: [] }), null]) {
      const r = vurderDekning(f, { valgte: [], utelatt: [], hentet: new Set(), dokumenter: 0 })
      expect(r.kontroll.status).toBe('advarsel')
      expect(r.dekning.dekket).toBe(false)
    }
    // Hentingen feilet for alle.
    const feilet = vurderDekning(fest(), { valgte: [a, b], utelatt: [], hentet: new Set(), dokumenter: 0 })
    expect(feilet.kontroll.status).toBe('advarsel')
    expect(grunner(feilet)).toEqual([['1', 'ikke_hentet'], ['2', 'ikke_hentet'], ['3', 'ikke_hentet']])
  })

  it('skiller preparater over grensen og preparater forespørselen ikke ba om', () => {
    const utelatt = vurderDekning(fest(), { valgte: [a], utelatt: [b], hentet: new Set([a]), dokumenter: 1 })
    expect(utelatt.kontroll.status).toBe('advarsel')
    expect(grunner(utelatt)).toEqual([['3', 'utelatt']])
    const oppgitt = vurderDekning(fest(), { valgte: [a], utelatt: [], hentet: new Set([a]), dokumenter: 1 })
    expect(oppgitt.kontroll.status).toBe('ikke_aktuelt')
    expect(oppgitt.dekning.dekket).toBe(false)
    expect(grunner(oppgitt)).toEqual([['3', 'ikke_valgt']])
  })
})

describe('feilene i det offentlige resultatet', () => {
  const hemmelig = 'Syntetisk hemmelig verdi'

  it('har typen og koden, aldri teksten', () => {
    expect(offentligFeil({ message: `invalid input syntax for type uuid: "${hemmelig}"`, code: '22P02', details: hemmelig, hint: hemmelig })).toBe(
      'kode 22P02; teksten publiseres ikke',
    )
    expect(offentligFeil({ message: hemmelig, code: 'PGRST116', status: 406 })).toBe('kode PGRST116, HTTP 406; teksten publiseres ikke')
    expect(offentligFeil(new TypeError(hemmelig))).toBe('TypeError; teksten publiseres ikke')
    expect(offentligFeil(new Error(hemmelig))).toBe('uten kode; teksten publiseres ikke')
    expect(offentligFeil(hemmelig)).toBe('uten kode; teksten publiseres ikke')
    // Felt som ikke ser ut som en kode, tas ikke med.
    expect(offentligFeil({ code: hemmelig, status: hemmelig })).toBe('uten kode; teksten publiseres ikke')
    const navngitt = new Error(hemmelig)
    navngitt.name = hemmelig
    expect(offentligFeil(navngitt)).not.toContain(hemmelig)
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
      // PubChem og Farmakologiportalen er aldri hentet i denne databasen.
      kjemi: 'advarsel',
      kjemivisning: 'ok',
      laboratorieanalyser: 'advarsel',
      laboratorievisning: 'ok',
    })
    expect(resultat.status).toBe('advarsel')
    expect(resultat.kontroller.find((k) => k.id === 'les_stoff')).toMatchObject({ rpc: 'les_stoff', antall: { elementer: 3, referanser: 1 } })
    expect(resultat.kontroller.find((k) => k.id === 'fest')!.antall!.merkevarer).toBeGreaterThan(0)
    // Resultatet publiseres på en offentlig gren: bare utfall og tall, ikke innholdet bak innloggingen.
    const publisert = JSON.stringify(resultat)
    for (const innhold of ['Syntetisk tekst', 'Upublisert', 'Syntetisk lærebok', 'Nordmann', 'Rita', 'Redaktør', 'redaktor']) expect(publisert).not.toContain(innhold)
    expect(Object.keys(resultat).sort()).toEqual(['kontroller', 'status', 'stoff'])
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
        if (funksjon === 'les_legemidler') return { data: null, error: { message: 'Syntetisk hemmelig verdi', code: '22P02' } }
        if (funksjon === 'les_cpic') throw new TypeError('Syntetisk hemmelig verdi')
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
    expect(resultat.kontroller.find((k) => k.id === 'fest')).toMatchObject({ status: 'feil', melding: 'les_legemidler feilet (uten kode; teksten publiseres ikke).' })
    expect(resultat.kontroller.find((k) => k.id === 'cpic')).toMatchObject({ status: 'feil', melding: 'les_cpic feilet (TypeError; teksten publiseres ikke).' })
    // Teksten i feilene fra databasen og appen kommer aldri med i resultatet.
    expect(JSON.stringify(resultat)).not.toContain('hemmelig')
    expect(resultat.kontroller.find((k) => k.id === 'bivirkninger')).toMatchObject({ status: 'feil', antall: { rader: 1, rader_appen_viser: 0 } })
    expect(utfall(resultat.kontroller)).toMatchObject({ les_stoff: 'ok', clinpgx: 'advarsel' })
  })
})

describe('funksjonstesten: kjemiske grunndata og laboratorieanalysene', () => {
  let db: PGlite
  let brukerklient: SupabaseClient
  const finn = (nokkel: string) => FORBINDELSER.finn(nokkel)!

  beforeAll(async () => {
    db = await nyDatabase()
    const admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'kuratortest', fornavn: 'Kurator', etternavn: 'Test', rolle: 'user' })
    const kall = faginnholdskall(db, admin)
    const lager = lagFaginnholdslager(kall.klientFor(admin))
    const side = (await lager.opprettUtkast('infoside', { navn: 'Citalopram' })).id
    await lager.opprettUtkast('innholdselement', { infoside: side, posisjon: 0, panel: 'indikasjon', elementtype: 'riktekst', data: { dokument: { type: 'doc', content: [] } } })
    const leser = lagFaginnholdsleser(kall.klientFor(admin))
    for (const steg of publiseringsplan(await leser.lesStoffside('citalopram', 'utkast'))) await lager.publiserUtkast(steg.id, steg.revisjon)
    // Kopiene slik synkroniseringene lager dem, av de ekte utdragene.
    const kjemiregister = byggForbindelsesregister([finn('citalopram'), finn('desmetylcitalopram')])
    await synkroniserKjemi({ lager: lagKjemilager(kallSom(db, 'service_role')), api: falskPubchemApi(), register: kjemiregister })
    await synkroniserFarmakologiportalen({ lager: lagFplager(kallSom(db, 'service_role')), api: falskFpApi() })
    brukerklient = kall.klientFor(bruker)
  }, 120_000)

  it('leser dataene med appens lesere, kontrollerer koblingene og bygger begge seksjonene', async () => {
    const resultat = await funksjonstest(brukerklient, 'citalopram')
    expect(utfall(resultat.kontroller)).toMatchObject({ kjemi: 'ok', kjemivisning: 'ok', laboratorieanalyser: 'ok', laboratorievisning: 'ok' })
    const kontroll = (id: string) => resultat.kontroller.find((k) => k.id === id)!
    expect(kontroll('kjemi')).toMatchObject({ rpc: 'les_kjemi', antall: { forbindelser: 2, hentet: 2, ikke_hentet: 0, uavklarte: 0, rader: 2, rader_appen_viser: 2 } })
    expect(kontroll('laboratorieanalyser')).toMatchObject({ rpc: 'les_laboratorieanalyser', antall: { forbindelser: 2, koblet: 2, usikre: 0 } })
    expect(kontroll('laboratorieanalyser').antall!.analyser).toBeGreaterThan(0)
    const visning = kontroll('laboratorievisning').antall!
    expect(visning.rader).toBeGreaterThan(0)
    expect(visning.tabeller).toBeGreaterThan(0)
    // Resultatet er offentlig: ingen laboratorier, analyser eller verdier fra kopien.
    const publisert = JSON.stringify(resultat)
    for (const lab of FPLISTER['/labs']!) expect(publisert).not.toContain(String(lab.name))
    expect(publisert).not.toContain('C20H21FN2O')
  })

  it('melder en kobling som ikke stemmer med kopien', async () => {
    const citalopram = finn('citalopram')
    const annenInchikey: Forbindelse = { ...citalopram, pubchem: { ...citalopram.pubchem!, inchikey: 'AAAAAAAAAAAAAA-UHFFFAOYSA-N' } }
    const borteIPortalen: Forbindelse = {
      ...finn('desmetylcitalopram'),
      farmakologiportalen: { status: 'verifisert', id: '99999', navn: 'Desmetylcitalopram', kontrollert: '2026-10-08', grunnlag: 'Syntetisk.' },
    }
    const resultat = await funksjonstest(brukerklient, 'citalopram', { register: byggForbindelsesregister([annenInchikey, borteIPortalen]) })
    expect(utfall(resultat.kontroller)).toMatchObject({ kjemi: 'feil', laboratorieanalyser: 'feil' })
    expect(resultat.kontroller.find((k) => k.id === 'laboratorieanalyser')!.antall).toMatchObject({ mangler: 1 })
    expect(resultat.status).toBe('feil')
  })

  it('melder en komponent som har fått et annet navn i portalen', async () => {
    const omdopt: Forbindelse = {
      ...finn('desmetylcitalopram'),
      navn: 'Syntetisk',
      engelsk: 'syntetisk',
      nokkel: 'syntetisk',
      farmakologiportalen: { status: 'verifisert', id: '795', navn: 'Syntetisk', kontrollert: '2026-10-08', grunnlag: 'Syntetisk.' },
    }
    const resultat = await funksjonstest(brukerklient, 'citalopram', { register: byggForbindelsesregister([finn('citalopram'), omdopt]) })
    expect(resultat.kontroller.find((k) => k.id === 'laboratorieanalyser')).toMatchObject({ status: 'advarsel', antall: { nytt_navn: 1 } })
  })

  it('advarer når kopiene ikke er hentet på lenge', async () => {
    const om30dager = () => new Date(Date.now() + 30 * 86_400_000)
    const resultat = await funksjonstest(brukerklient, 'citalopram', { na: om30dager })
    expect(utfall(resultat.kontroller)).toMatchObject({ kjemi: 'advarsel', laboratorieanalyser: 'advarsel' })
  })

  it('melder rader appens lesere forkaster', async () => {
    const klient = {
      rpc: async (funksjon: string, argumenter?: Record<string, unknown>) => {
        const svar = await brukerklient.rpc(funksjon, argumenter)
        if (funksjon === 'les_kjemi') {
          const data = svar.data as { forbindelser: unknown[] }
          return { ...svar, data: { ...data, forbindelser: [...data.forbindelser, { cid: 2771, data: { cid: 2771 } }] } }
        }
        if (funksjon === 'les_laboratorieanalyser') {
          const data = svar.data as { analyser: unknown[]; institusjoner?: unknown[] }
          return {
            ...svar,
            data: { ...data, analyser: [...data.analyser, { id: 'x', data: { komponent_id: '536' } }], institusjoner: [...(data.institusjoner ?? []), { id: 'y', data: {} }] },
          }
        }
        return svar
      },
    } as unknown as SupabaseClient
    const resultat = await funksjonstest(klient, 'citalopram')
    expect(resultat.kontroller.find((k) => k.id === 'kjemi')).toMatchObject({ status: 'feil', antall: { rader: 3, rader_appen_viser: 2 } })
    expect(resultat.kontroller.find((k) => k.id === 'laboratorieanalyser')).toMatchObject({ status: 'feil', antall: { forkastet: 2 } })
  })
})
