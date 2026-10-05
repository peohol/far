/**
 * SQL-teksten i migrasjonene, slik kontrollene trenger den
 * (`migrasjonshistorikk.ts`, `docs/migrasjoner.md`):
 *
 * - `cliSetninger` deler fila i setninger nøyaktig slik Supabase-CLI-en gjør det
 *   når den lagrer en migrasjon i historikken (`supabase db push`), så
 *   kontrollen kan sammenligne teksten eksakt.
 * - `utenKommentarer` tar bort kommentarene, så en destruktiv setning ikke
 *   gjemmes av en kommentar mellom ordene (`drop /* … *\/ table`).
 *
 * Delingen er overført uendret fra CLI-en versjon 2.117.0 (som er låst i
 * `package.json`), `apps/cli/src/command-internal/legacy-sql-split.ts`
 * (`legacySplitAndTrim`), MIT-lisens, © Supabase. Den har særheter (som `\`
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
