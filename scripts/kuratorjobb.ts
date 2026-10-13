/**
 * Kjører en kuratorjobb (`docs/kuratorjobber.md`). GitHub Actions kaller
 * skriptet i `.github/workflows/kuratorjobb.yml`; det kan også kjøres lokalt.
 *
 *   npm run kuratorjobb -- start <jobbmappe>
 *   npm run kuratorjobb -- kjor <jobbmappe>
 *   npm run kuratorjobb -- gren <navn>
 *   npm run kuratorjobb -- felter <stoffer> <oppgaver>
 *
 * `<jobbmappe>` er roten av jobbgrenen, med forespørselen i
 * `kuratorjobb/foresporsel.json`. `start` skriver status `kjorer`; `kjor`
 * tømmer resultatmappen, kjører oppgavene og skriver resultatet. Skriptet
 * avslutter med 0 også når kontroller feiler: utfallet står i `status.json`,
 * og arbeidsflyten feiler selv etter at resultatet er lagret. `gren` avslutter
 * med 1 når navnet ikke er en jobbgren. `felter` skriver forespørselen for en
 * jobb som er startet for hånd med kommaseparerte stoffer og oppgaver.
 *
 * Miljøet:
 * - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`: prosjektet, de offentlige verdiene appen også har.
 * - `OUSFAR_TESTBRUKER`, `OUSFAR_TESTPASSORD`: testbrukeren, en vanlig bruker. Hemmelige; skrives aldri ut.
 * - `JOBB_GREN`, `FORESPORSEL_COMMIT`, `KODE_COMMIT`, `KJORING`: hva jobben gjelder, til resultatet.
 *
 * Skriptet leser forespørselen som data og kjører aldri noe fra jobbgrenen.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execFile } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { internAuthAdresse } from '@delt/brukernavn'
import { byggStoffregister } from '../src/domain/stoffregister'
import { lagFaginnholdsleser } from '../src/faginnhold/lesing'
import { foresporselFraFelter, lesForesporsel } from '../src/kuratorjobb/foresporsel'
import { funksjonstest, kontrollerBruker } from '../src/kuratorjobb/funksjonstest'
import {
  FORESPORSELSFIL,
  JOBBGREN,
  KURATORJOBBVERSJON,
  RESULTATMAPPE,
  SPCGRENSER,
  STATUSFIL,
  resultatfil,
  samletStatus,
  type Foresporsel,
  type Jobbstatus,
  type Kontroll,
  type Oppgave,
  type Stoffstatus,
  type Utfall,
} from '../src/kuratorjobb/modell'
import {
  AVSNITT_4_8,
  erDmpAdresse,
  finnAvsnitt,
  kontrollerPdfsvar,
  lesFestomtaler,
  lesPdfinfo,
  sha256,
  type Festomtaler,
  type Festpreparat,
  type Pdfinfo,
  type Pdfsvar,
} from '../src/kuratorjobb/spc'
import { BRUKERAGENT } from '../src/kjemi/pubchem'
import { lagHofligHenting } from '../src/server/hofligHenting'

const kjorProgram = promisify(execFile)
const [kommando, rot = '', ...resten] = process.argv.slice(2).filter((a) => a !== '--')
if (!['start', 'kjor', 'gren', 'felter'].includes(kommando ?? '') || !rot) {
  console.error('Bruk: npm run kuratorjobb -- start|kjor <jobbmappe> | gren <navn> | felter <stoffer> <oppgaver>')
  process.exit(2)
}

const miljo = (navn: string) => process.env[navn]?.trim() || null
const iMappe = (sti: string) => join(rot, sti)
const naa = () => new Date().toISOString()

function skrivJson(sti: string, data: unknown) {
  mkdirSync(join(iMappe(sti), '..'), { recursive: true })
  writeFileSync(iMappe(sti), `${JSON.stringify(data, null, 2)}\n`)
}

function lesForesporselsfil(): { tekst: string | null; sha: string | null } {
  try {
    const bytes = readFileSync(iMappe(FORESPORSELSFIL))
    return { tekst: bytes.toString('utf8'), sha: sha256(bytes) }
  } catch {
    return { tekst: null, sha: null }
  }
}

function grunnstatus(sha: string | null): Jobbstatus {
  return {
    versjon: KURATORJOBBVERSJON,
    status: 'kjorer',
    jobb: {
      gren: miljo('JOBB_GREN') ?? '',
      foresporsel_commit: miljo('FORESPORSEL_COMMIT'),
      foresporsel_sha256: sha,
      kode_commit: miljo('KODE_COMMIT'),
      kjoring: miljo('KJORING'),
      startet_kl: naa(),
      ferdig_kl: null,
    },
    foresporsel: null,
    referanse: null,
    feil: [],
    bruker: [],
    stoffer: {},
  }
}

/* --- Innloggingen -------------------------------------------------------- */

/** Klienten som testbrukeren, slik appen logger inn. `null` med grunnen når det ikke går. */
async function loggInn(): Promise<{ klient: SupabaseClient } | { feil: string }> {
  const url = miljo('SUPABASE_URL')
  const nokkel = miljo('SUPABASE_PUBLISHABLE_KEY')
  const brukernavn = miljo('OUSFAR_TESTBRUKER')
  const passord = process.env.OUSFAR_TESTPASSORD ?? ''
  if (!url || !nokkel) return { feil: 'SUPABASE_URL og SUPABASE_PUBLISHABLE_KEY mangler i miljøet.' }
  if (!brukernavn || !passord) {
    return { feil: 'Testbrukeren er ikke satt opp: hemmelighetene OUSFAR_TESTBRUKER og OUSFAR_TESTPASSORD mangler (docs/kuratorjobber.md).' }
  }
  const klient = createClient(url, nokkel, { auth: { persistSession: false, autoRefreshToken: false } })
  let adresse: string
  try {
    adresse = internAuthAdresse(brukernavn)
  } catch {
    return { feil: 'OUSFAR_TESTBRUKER er ikke et gyldig brukernavn.' }
  }
  const { error } = await klient.auth.signInWithPassword({ email: adresse, password: passord })
  // Feilmeldingen fra Auth tas ikke med; den kan si noe om kontoen.
  if (error) return { feil: `Testbrukeren kunne ikke logge inn (${error.status ?? 'ukjent status'}). Kontroller brukernavnet og passordet i hemmelighetene.` }
  return { klient }
}

/* --- Preparatomtalene ---------------------------------------------------- */

const henting = lagHofligHenting({
  avstand: 500,
  tidsgrense: 120_000,
  hoder: { 'user-agent': BRUKERAGENT, accept: 'application/pdf' },
})

/** Hoder som tas vare på i proveniensen. */
const PROVENIENSHODER = ['content-type', 'content-length', 'content-md5', 'last-modified', 'etag', 'date'] as const

/** Henter fila og følger videresendinger, så lenge hver adresse er DMPs. */
async function hentPdf(adresse: string): Promise<Pdfsvar> {
  const adresser = [adresse]
  for (let forsok = 0; ; forsok += 1) {
    try {
      let url = adresse
      for (let hopp = 0; hopp <= 5; hopp += 1) {
        const res = await henting(url, { redirect: 'manual' })
        const hoder: Record<string, string> = {}
        res.headers.forEach((v, n) => (hoder[n.toLowerCase()] = v))
        const videre = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
        if (videre) {
          await res.body?.cancel().catch(() => undefined)
          url = new URL(videre, url).toString()
          adresser.push(url)
          if (!erDmpAdresse(url)) return { adresser, status: res.status, hoder, bytes: new Uint8Array() }
          continue
        }
        return { adresser, status: res.status, hoder, bytes: new Uint8Array(await res.arrayBuffer()) }
      }
      throw new Error('For mange videresendinger.')
    } catch (e) {
      if (forsok >= 2) throw e
      await new Promise((ferdig) => setTimeout(ferdig, 2000 * 2 ** forsok))
    }
  }
}

interface Spcadresse {
  adresse: string
  endelig_adresse: string | null
  hentet_kl: string
  hoder: Partial<Record<(typeof PROVENIENSHODER)[number], string>>
  /** Preparatene i FEST som viser til adressen. */
  preparater: Festpreparat[]
  status: Utfall
  kontroller: Kontroll[]
  /** Dokumentet fila ble til, etter SHA-256. `null` når den ikke kunne brukes. */
  dokument: string | null
}

interface Spcdokument {
  sha256: string
  bytes: number
  mappe: string
  pdf: Pdfinfo
  filer: { pdf: string; tekst: string; sidetekster: string[]; sidebilder: string[] }
  /** Sidene avsnitt 4.8 Bivirkninger står på, etter teksten; `null` når overskriften ikke ble funnet. */
  avsnitt_4_8: { fra: number; til: number } | null
  status: Utfall
  kontroller: Kontroll[]
}

const sidenavn = (i: number, ending: string) => `side-${String(i).padStart(3, '0')}.${ending}`

/** Tekstuttrekket og sidebildene for en PDF som er lagret i mappen. */
async function behandlePdf(mappe: string, sha: string, bytes: number, dpi: number): Promise<Spcdokument> {
  const kontroller: Kontroll[] = []
  const pdfsti = `${mappe}/original.pdf`
  const info = lesPdfinfo((await kjorProgram('pdfinfo', [iMappe(pdfsti)])).stdout)
  kontroller.push(
    info.sider === null
      ? { id: 'pdfinfo', status: 'feil', melding: 'PDF-en kan ikke leses: antallet sider er ukjent.' }
      : info.kryptert
        ? { id: 'pdfinfo', status: 'advarsel', melding: `PDF-en er kryptert (${info.sider} sider); uttrekket kan være ufullstendig.`, antall: { sider: info.sider } }
        : { id: 'pdfinfo', status: 'ok', melding: `PDF-en kan leses (${info.sider} sider).`, antall: { sider: info.sider } },
  )
  const dokument: Spcdokument = {
    sha256: sha,
    bytes,
    mappe,
    pdf: info,
    filer: { pdf: pdfsti, tekst: `${mappe}/tekst.txt`, sidetekster: [], sidebilder: [] },
    avsnitt_4_8: null,
    status: 'feil',
    kontroller,
  }
  if (info.sider === null) return dokument

  const tekst = (await kjorProgram('pdftotext', ['-layout', '-enc', 'UTF-8', iMappe(pdfsti), '-'], { maxBuffer: 64 * 1024 * 1024 })).stdout
  writeFileSync(iMappe(dokument.filer.tekst), tekst)
  // pdftotext skiller sidene med sideskift.
  const sider = tekst.split('\f').slice(0, info.sider)
  mkdirSync(iMappe(`${mappe}/tekst`), { recursive: true })
  sider.forEach((s, i) => {
    const sti = `${mappe}/tekst/${sidenavn(i + 1, 'txt')}`
    writeFileSync(iMappe(sti), s)
    dokument.filer.sidetekster.push(sti)
  })
  const tegn = tekst.replace(/\s/g, '').length
  kontroller.push(
    sider.length !== info.sider
      ? { id: 'tekst', status: 'advarsel', melding: `Tekstuttrekket har ${sider.length} sider, PDF-en ${info.sider}.`, antall: { tegn } }
      : tegn < 200 * info.sider
        ? { id: 'tekst', status: 'advarsel', melding: 'Lite tekst i PDF-en; den kan være skannet. Bruk sidebildene.', antall: { tegn } }
        : { id: 'tekst', status: 'ok', melding: 'Teksten er trukket ut side for side.', antall: { tegn } },
  )
  dokument.avsnitt_4_8 = finnAvsnitt(sider, AVSNITT_4_8)
  kontroller.push(
    dokument.avsnitt_4_8
      ? { id: 'avsnitt_4_8', status: 'ok', melding: `Overskriften «4.8 Bivirkninger» står på side ${dokument.avsnitt_4_8.fra}.` }
      : { id: 'avsnitt_4_8', status: 'advarsel', melding: 'Fant ikke overskriften «4.8 Bivirkninger» i teksten. Se sidebildene.' },
  )

  const bildemappe = iMappe(`${mappe}/sider`)
  mkdirSync(bildemappe, { recursive: true })
  await kjorProgram('pdftoppm', ['-r', String(dpi), '-gray', '-png', iMappe(pdfsti), join(bildemappe, 'side')], { maxBuffer: 16 * 1024 * 1024 })
  // pdftoppm nummererer med så mange sifre som antallet sider krever; navnene gjøres faste.
  const laget = readdirSync(bildemappe)
    .map((f) => ({ f, n: Number(/^side-(\d+)\.png$/.exec(f)?.[1]) }))
    .filter((b) => Number.isInteger(b.n))
    .sort((a, b) => a.n - b.n)
  for (const { f, n } of laget) {
    renameSync(join(bildemappe, f), join(bildemappe, sidenavn(n, 'png')))
    dokument.filer.sidebilder.push(`${mappe}/sider/${sidenavn(n, 'png')}`)
  }
  kontroller.push(
    laget.length === info.sider
      ? { id: 'sidebilder', status: 'ok', melding: `Et bilde av hver side, ${dpi} dpi i gråtoner.`, antall: { sider: laget.length } }
      : { id: 'sidebilder', status: 'feil', melding: `Fikk ${laget.length} sidebilder for ${info.sider} sider.`, antall: { sider: laget.length } },
  )
  dokument.status = samletStatus(kontroller.map((k) => k.status))
  return dokument
}

async function spc(klient: SupabaseClient | null, stoff: string, valg: NonNullable<Foresporsel['spc']>) {
  const kontroller: Kontroll[] = []
  const maks = valg.maks ?? SPCGRENSER.maks.standard
  const dpi = valg.dpi ?? SPCGRENSER.dpi.standard
  const mappe = `${RESULTATMAPPE}/${stoff}/spc`

  let fest: (Festomtaler & { kontrollert_kl: string | null }) | null = null
  if (klient) {
    try {
      fest = await lesFestomtaler(klient, stoff)
      kontroller.push(
        fest
          ? { id: 'fest', status: 'ok', melding: `FEST oppgir ${fest.omtaler.length} preparatomtaler hos DMP for stoffet.`, antall: { omtaler: fest.omtaler.length, uten_omtale: fest.uten_omtale.length } }
          : { id: 'fest', status: valg.adresser ? 'ikke_aktuelt' : 'feil', melding: 'Siden finnes ikke eller er ikke koblet til FEST; FEST oppgir ingen preparatomtaler.' },
      )
    } catch (e) {
      kontroller.push({ id: 'fest', status: 'feil', melding: `Kunne ikke lese preparatomtalene i FEST: ${e instanceof Error ? e.message : String(e)}` })
    }
  } else {
    kontroller.push({
      id: 'fest',
      status: valg.adresser ? 'advarsel' : 'feil',
      melding: 'Ikke innlogget; preparatomtalene i FEST kunne ikke slås opp, og adressene står uten preparatene FEST knytter til dem.',
    })
  }

  const preparaterFor = new Map((fest?.omtaler ?? []).map((o) => [o.adresse, o.preparater]))
  const alle = valg.adresser ?? (fest?.omtaler.map((o) => o.adresse) ?? [])
  const valgte = alle.slice(0, maks)
  const utelatt = alle.slice(maks)
  if (utelatt.length > 0) kontroller.push({ id: 'maks', status: 'advarsel', melding: `${utelatt.length} preparatomtaler er utelatt (maks ${maks}); se «utelatt».` })
  if (valg.adresser) {
    const ukjente = valg.adresser.filter((a) => fest && !preparaterFor.has(a))
    if (ukjente.length > 0) kontroller.push({ id: 'i_fest', status: 'advarsel', melding: `Adresser FEST ikke oppgir for stoffet: ${ukjente.join(', ')}` })
  }

  const dokumenter = new Map<string, Spcdokument>()
  const adresser: Spcadresse[] = []
  for (const adresse of valgte) {
    const rad: Spcadresse = {
      adresse,
      endelig_adresse: null,
      hentet_kl: naa(),
      hoder: {},
      preparater: preparaterFor.get(adresse) ?? [],
      status: 'feil',
      kontroller: [],
      dokument: null,
    }
    adresser.push(rad)
    let svar: Pdfsvar
    try {
      svar = await hentPdf(adresse)
    } catch (e) {
      rad.kontroller.push({ id: 'henting', status: 'feil', melding: `Kunne ikke hente fila: ${e instanceof Error ? e.message : String(e)}` })
      continue
    }
    rad.endelig_adresse = svar.adresser.at(-1) ?? adresse
    for (const h of PROVENIENSHODER) if (svar.hoder[h] !== undefined) rad.hoder[h] = svar.hoder[h]
    rad.kontroller.push(...kontrollerPdfsvar(svar))
    rad.status = samletStatus(rad.kontroller.map((k) => k.status))
    if (rad.status === 'feil') continue

    const sha = sha256(svar.bytes)
    rad.dokument = sha
    if (!dokumenter.has(sha)) {
      const dokmappe = `${mappe}/${sha.slice(0, 16)}`
      mkdirSync(iMappe(dokmappe), { recursive: true })
      writeFileSync(iMappe(`${dokmappe}/original.pdf`), svar.bytes)
      try {
        dokumenter.set(sha, await behandlePdf(dokmappe, sha, svar.bytes.length, dpi))
      } catch (e) {
        dokumenter.set(sha, {
          sha256: sha,
          bytes: svar.bytes.length,
          mappe: dokmappe,
          pdf: lesPdfinfo(''),
          filer: { pdf: `${dokmappe}/original.pdf`, tekst: '', sidetekster: [], sidebilder: [] },
          avsnitt_4_8: null,
          status: 'feil',
          kontroller: [{ id: 'pdfverktoy', status: 'feil', melding: `PDF-verktøyene feilet: ${e instanceof Error ? e.message : String(e)}` }],
        })
      }
    }
  }

  if (valgte.length === 0 && kontroller.every((k) => k.status !== 'feil')) {
    kontroller.push({ id: 'ingen', status: 'ikke_aktuelt', melding: 'Ingen preparatomtaler å hente.' })
  }
  const status = samletStatus([
    ...kontroller.map((k) => k.status),
    ...adresser.map((a) => a.status),
    ...[...dokumenter.values()].map((d) => d.status),
  ])
  return {
    stoff,
    status,
    kilde: valg.adresser ? 'foresporsel' : 'fest',
    dpi,
    fest: fest ? { kontrollert_kl: fest.kontrollert_kl, avviste: fest.avviste, uten_omtale: fest.uten_omtale } : null,
    kontroller,
    adresser,
    dokumenter: [...dokumenter.values()],
    utelatt,
  }
}

/* --- Jobben -------------------------------------------------------------- */

async function kjor() {
  const { tekst, sha } = lesForesporselsfil()
  rmSync(iMappe(RESULTATMAPPE), { recursive: true, force: true })
  const status = grunnstatus(sha)
  const ferdig = () => {
    status.jobb.ferdig_kl = naa()
    status.status = samletStatus([
      ...(status.feil.length > 0 ? (['feil'] as Utfall[]) : []),
      ...status.bruker.map((k) => k.status),
      ...Object.values(status.stoffer).map((s) => s.status),
    ])
    skrivJson(STATUSFIL, status)
    console.log(`Kuratorjobben er ferdig: ${status.status}`)
    for (const [stoff, s] of Object.entries(status.stoffer)) {
      console.log(`  ${stoff}: ${s.status} (${Object.entries(s.oppgaver).map(([o, r]) => `${o} ${r?.status}`).join(', ')})`)
    }
    for (const f of status.feil) console.log(`  feil: ${f}`)
  }

  if (tekst === null) {
    status.feil.push(`Fant ikke ${FORESPORSELSFIL} på grenen.`)
    return ferdig()
  }
  const lest = lesForesporsel(tekst)
  if (lest.feil) {
    status.feil.push(...lest.feil)
    return ferdig()
  }
  const foresporsel = lest.foresporsel
  status.foresporsel = foresporsel
  status.referanse = foresporsel.referanse ?? null

  const innlogging = await loggInn()
  const klient = 'klient' in innlogging ? innlogging.klient : null
  if (!klient) {
    const feil = (innlogging as { feil: string }).feil
    // Uten innlogging kan bare preparatomtaler med oppgitte adresser hentes.
    if (foresporsel.oppgaver.includes('funksjonstest') || !foresporsel.spc?.adresser) status.feil.push(feil)
    else status.bruker.push({ id: 'innlogging', status: 'advarsel', melding: feil })
  } else {
    status.bruker.push({ id: 'innlogging', status: 'ok', melding: 'Testbrukeren logget inn som appen gjør.' }, ...(await kontrollerBruker(klient)))
  }
  if (status.feil.length > 0) return ferdig()

  // Stoffene etter registeret slik appen bygger det, med fagsidene i databasen.
  const sider = klient ? await lagFaginnholdsleser(klient).lesStoffliste('publisert') : []
  const register = byggStoffregister(sider)
  const stoffer =
    foresporsel.stoffer === 'alle'
      ? sider.map((s) => s.slug)
      : foresporsel.stoffer.flatMap((navn) => {
          const stoff = register.kanonisk(navn)
          if (!stoff) status.feil.push(`Kjenner ikke stoffet «${navn}» i stoffregisteret.`)
          return stoff ? [stoff.slug] : []
        })
  if (status.feil.length > 0) return ferdig()

  const brukerOk = status.bruker.every((k) => k.status !== 'feil')
  for (const stoff of [...new Set(stoffer)]) {
    const oppgaver: Stoffstatus['oppgaver'] = {}
    const lagre = (oppgave: Oppgave, resultat: { status: Utfall } & Record<string, unknown>) => {
      const fil = resultatfil(oppgave, stoff)
      skrivJson(fil, resultat)
      oppgaver[oppgave] = { status: resultat.status, fil }
    }
    if (foresporsel.oppgaver.includes('funksjonstest')) {
      if (klient && brukerOk) {
        const { svar, ...resultat } = await funksjonstest(klient, stoff)
        const svarfiler: Record<string, string> = {}
        // Svarene tas bare med for stoffer med navn; for alle sidene ville de blitt for store.
        for (const [rpc, data] of foresporsel.stoffer === 'alle' ? [] : Object.entries(svar)) {
          const fil = `${RESULTATMAPPE}/${stoff}/svar/${rpc}.json`
          skrivJson(fil, data)
          svarfiler[rpc] = fil
        }
        lagre('funksjonstest', { ...resultat, svar: svarfiler })
      } else {
        lagre('funksjonstest', { stoff, status: 'feil', kontroller: [{ id: 'bruker', status: 'feil', melding: 'Testbrukeren kan ikke brukes; se «bruker» i status.json.' }] })
      }
    }
    if (foresporsel.oppgaver.includes('spc')) lagre('spc', await spc(klient, stoff, foresporsel.spc ?? {}))
    status.stoffer[stoff] = { status: samletStatus(Object.values(oppgaver).map((o) => o.status)), oppgaver }
    console.log(`${stoff}: ${status.stoffer[stoff].status}`)
  }
  ferdig()
}

if (kommando === 'gren') {
  process.exit(JOBBGREN.test(rot) ? 0 : 1)
} else if (kommando === 'felter') {
  process.stdout.write(`${foresporselFraFelter(rot, resten[0] ?? '')}\n`)
} else if (kommando === 'start') {
  const { sha } = lesForesporselsfil()
  rmSync(iMappe(RESULTATMAPPE), { recursive: true, force: true })
  skrivJson(STATUSFIL, grunnstatus(sha))
} else {
  await kjor()
}
