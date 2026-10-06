/**
 * SQL-teksten i migrasjonene, slik kontrollene trenger den
 * (`migrasjonshistorikk.ts`, `docs/migrasjoner.md`):
 *
 * - `cliSetninger` deler fila i setninger nøyaktig slik Supabase-CLI-en gjør det
 *   når den lagrer en migrasjon i historikken (`supabase db push`), så
 *   kontrollen kan sammenligne teksten eksakt.
 * - `ikkeAtomiske` finner det som gjør at CLI-en ikke kjører migrasjonen i én
 *   transaksjon, så en feil underveis kan etterlate den halvveis utført.
 * - `utenKommentarer` tar bort kommentarene, så en destruktiv setning ikke
 *   gjemmes av en kommentar mellom ordene (`drop /* … *\/ table`).
 *
 * Delingen og reglene for transaksjonen er overført uendret fra CLI-en versjon
 * 2.117.0 (som er låst i `package.json`), `apps/cli/src/command-internal/`
 * `legacy-sql-split.ts` (`legacySplitAndTrim`), `legacy-migration-file.ts` og
 * `legacy-migration-apply.ts`, MIT-lisens, © Supabase. Den har særheter (som `\`
 * utenfor strenger) som må beholdes for at tekstene skal bli like; oppgraderes
 * CLI-en, kontrolleres den mot den nye versjonen.
 */

interface Tilstand {
  /** Neste tilstand, eller `null` ved en setningsgrense. */
  next(tegn: string, data: string): Tilstand | null
}

const BEGIN_ATOMIC = 'ATOMIC'
const END_ATOMIC = 'END'

// `\p{Nd}` som Go-ens `unicode.IsDigit`, ikke `\p{N}`.
const erIdentifikatortegn = (tegn: string): boolean => /[\p{L}\p{Nd}_$]/u.test(tegn)

function erBeginAtomic(data: string): boolean {
  let offset = data.length - BEGIN_ATOMIC.length
  if (offset < 0 || data.slice(offset).toUpperCase() !== BEGIN_ATOMIC) return false
  if (offset > 0 && erIdentifikatortegn(data[offset - 1]!)) return false
  const prefix = data.slice(0, offset).replace(/\s+$/u, '')
  offset = prefix.length - 'BEGIN'.length
  if (offset < 0 || prefix.slice(offset).toUpperCase() !== 'BEGIN') return false
  if (offset === 0) return true
  return !erIdentifikatortegn(prefix[offset - 1]!)
}

class Klar implements Tilstand {
  next(tegn: string, data: string): Tilstand | null {
    switch (tegn) {
      case '$':
        return new Merke(data.length - tegn.length)
      case "'":
      case '"':
        return new Sitat(tegn)
      case '-':
        return new Kommentar()
      case '/':
        return new Blokk()
      case '\\':
        return new Escape()
      case ';':
        return null
      case '(':
        return new Atomisk(new Klar(), ')')
      case 'c':
      case 'C':
        if (erBeginAtomic(data)) return new Atomisk(new Klar(), END_ATOMIC)
        return this
      default:
        return this
    }
  }
}

class Kommentar implements Tilstand {
  next(tegn: string, data: string): Tilstand | null {
    // En linjekommentar varer til linjeskiftet, som en dollarstreng.
    if (tegn === '-') return new Dollar('\n')
    return new Klar().next(tegn, data)
  }
}

class Blokk implements Tilstand {
  private dybde = 0
  next(tegn: string, data: string): Tilstand | null {
    const vindu = data.slice(-2)
    if (vindu === '/*') {
      this.dybde += 1
      return this
    }
    if (this.dybde === 0) return new Klar().next(tegn, data)
    if (vindu === '*/') {
      this.dybde -= 1
      if (this.dybde === 0) return new Klar()
    }
    return this
  }
}

class Sitat implements Tilstand {
  private escape = false
  constructor(private readonly skilletegn: string) {}
  next(tegn: string, data: string): Tilstand | null {
    if (this.escape) {
      // Et doblet anførselstegn ('' eller "").
      if (tegn === this.skilletegn) {
        this.escape = false
        return this
      }
      return new Klar().next(tegn, data)
    }
    if (tegn === this.skilletegn) this.escape = true
    return this
  }
}

class Dollar implements Tilstand {
  constructor(private readonly skilletegn: string) {}
  next(_tegn: string, data: string): Tilstand | null {
    if (data.slice(-this.skilletegn.length) === this.skilletegn) return new Klar()
    return this
  }
}

class Merke implements Tilstand {
  constructor(private readonly offset: number) {}
  next(tegn: string, data: string): Tilstand | null {
    if (tegn === '$') return new Dollar(data.slice(this.offset))
    if (/[\p{L}\p{Nd}_]/u.test(tegn)) return this
    return new Klar().next(tegn, data)
  }
}

class Escape implements Tilstand {
  next(): Tilstand | null {
    return new Klar()
  }
}

class Atomisk implements Tilstand {
  constructor(
    private forrige: Tilstand,
    private readonly skilletegn: string,
  ) {}
  next(tegn: string, data: string): Tilstand | null {
    // Et skilletegn i et sitat eller en kommentar inni teller ikke.
    const naa = this.forrige.next(tegn, data)
    if (naa !== null) this.forrige = naa
    if (this.forrige instanceof Klar) {
      const vindu = data.slice(-this.skilletegn.length)
      if (vindu.toUpperCase() === this.skilletegn.toUpperCase()) return new Klar()
    }
    return this
  }
}

/**
 * Setningene slik CLI-en lagrer dem i `statements`: delt ved `;` utenfor
 * strenger, kommentarer og funksjonskropper, uten `;` på slutten og blanke tegn
 * i endene, og uten de tomme.
 */
export function cliSetninger(sql: string): string[] {
  const setninger: string[] = []
  const legg = (raa: string) => {
    const setning = raa.replace(/;+$/u, '').trim()
    if (setning.length > 0) setninger.push(setning)
  }
  let tilstand: Tilstand = new Klar()
  let acc = ''
  for (const tegn of Array.from(sql)) {
    acc += tegn
    const neste = tilstand.next(tegn, acc)
    if (neste === null) {
      legg(acc)
      acc = ''
      tilstand = new Klar()
    } else {
      tilstand = neste
    }
  }
  if (acc.length > 0) legg(acc)
  return setninger
}

/** Første linje i en fil CLI-en kjører uten transaksjon (pg-delta). */
const UTEN_TRANSAKSJON = '-- pg-delta: transaction=false'

/** Setningene PostgreSQL ikke kjører i en transaksjon; CLI-en kjører dem for seg, utenfor. */
const UTENFOR_TRANSAKSJONEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY(?:\s|$)/u, 'create index concurrently'],
  [/^DROP\s+INDEX\s+CONCURRENTLY(?:\s|$)/u, 'drop index concurrently'],
  [/^REINDEX(?:\s|\().*\sCONCURRENTLY(?:\s|$)/u, 'reindex concurrently'],
  [/^VACUUM(?:\s|\(|$)/u, 'vacuum'],
  [/^ALTER\s+SYSTEM(?:\s|$)/u, 'alter system'],
  [/^CLUSTER(?:\s|$)/u, 'cluster'],
]
const TRANSAKSJONSKONTROLL = /^(?:BEGIN|START\s+TRANSACTION|COMMIT|END|ABORT|PREPARE\s+TRANSACTION)(?:\s|$)/u

/** Setningen slik CLI-en leser starten: uten BOM, blanke tegn og kommentarer foran, med store bokstaver. */
function starten(sql: string): string {
  const fjernBlanke = (tekst: string) => tekst.replace(/^[ \t\n\r]+/u, '')
  let rest = fjernBlanke(sql)
  while (rest.charCodeAt(0) === 0xfeff) rest = fjernBlanke(rest.slice(1))
  for (;;) {
    if (rest.startsWith('--')) {
      const i = rest.indexOf('\n')
      if (i < 0) return ''
      rest = fjernBlanke(rest.slice(i + 1))
    } else if (rest.startsWith('/*')) {
      const i = rest.indexOf('*/')
      if (i < 0) return rest.toUpperCase()
      rest = fjernBlanke(rest.slice(i + 2))
    } else {
      return rest.trim().toUpperCase()
    }
  }
}

/** En setning som åpner, avslutter eller ruller tilbake en transaksjon (ikke `rollback to`). */
function styrerTransaksjonen(start: string): boolean {
  const ord = start.split(/\s+/u)
  if (ord[0] === 'ROLLBACK') return ord[ord[1] === 'WORK' || ord[1] === 'TRANSACTION' ? 2 : 1] !== 'TO'
  return TRANSAKSJONSKONTROLL.test(start)
}

/**
 * Det som gjør at CLI-en ikke kjører hele migrasjonen og raden i historikken i
 * én transaksjon: setninger som må kjøres utenfor en transaksjon, setninger som
 * styrer transaksjonen selv (`begin`, `commit` …), eller pg-delta-linjen som slår
 * transaksjonen av. Tom når migrasjonen er atomisk.
 */
export function ikkeAtomiske(sql: string): string[] {
  const utenBom = sql.charCodeAt(0) === 0xfeff ? sql.slice(1) : sql
  const funnet = new Set<string>()
  if (utenBom.split('\n', 1)[0]!.replace(/\r$/, '') === UTEN_TRANSAKSJON) funnet.add(UTEN_TRANSAKSJON)
  for (const setning of cliSetninger(sql)) {
    const start = starten(setning)
    for (const [monster, navn] of UTENFOR_TRANSAKSJONEN) if (monster.test(start)) funnet.add(navn)
    if (styrerTransaksjonen(start)) funnet.add('begin/commit')
  }
  return [...funnet]
}

/**
 * Teksten med hver kommentar (`-- …` og `/* … *\/`, også nøstede) byttet mot et
 * mellomrom, slik PostgreSQL leser dem. Strenger (`'…'`, `E'…'`) og navn i
 * anførselstegn (`"…"`) står urørt. Innholdet i dollarstrenger leses som SQL,
 * siden det er der `do`-blokker og funksjoner har setningene sine.
 */
export function utenKommentarer(sql: string): string {
  let ut = ''
  let i = 0
  while (i < sql.length) {
    const tegn = sql[i]!
    const to = sql.slice(i, i + 2)
    if (to === '--') {
      const slutt = sql.indexOf('\n', i)
      i = slutt < 0 ? sql.length : slutt
      ut += ' '
    } else if (to === '/*') {
      let dybde = 0
      do {
        const neste = sql.slice(i, i + 2)
        const endring = neste === '/*' ? 1 : neste === '*/' ? -1 : 0
        dybde += endring
        i += endring ? 2 : 1
      } while (dybde > 0 && i < sql.length)
      ut += ' '
    } else if (tegn === "'" || tegn === '"') {
      // `E'…'` har escape med `\`; ellers er et doblet tegn et escape.
      const forran = sql.slice(Math.max(0, i - 2), i)
      const escape = tegn === "'" && /(^|[^\p{L}\p{Nd}_$])[eE]$/u.test(forran)
      let j = i + 1
      while (j < sql.length) {
        if (escape && sql[j] === '\\') j += 2
        else if (sql[j] === tegn && sql[j + 1] === tegn) j += 2
        else if (sql[j] === tegn) break
        else j += 1
      }
      ut += sql.slice(i, j + 1)
      i = j + 1
    } else {
      ut += tegn
      i += 1
    }
  }
  return ut
}
