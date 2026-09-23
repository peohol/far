/**
 * Scenarioregelsettene i databasen, prøvd mot en ekte Postgres i minnet.
 *
 * Databasen skal håndheve de samme reglene som appen: valideringen i SQL
 * sammenlignes med `validerScenarioregelsett` for dagens regelsett og for en
 * lang rekke endrede utgaver av dem — hull, overlapp, flyttede grenser,
 * manglende kommentarer og feil plassering. Ellers prøves lagring, lesing,
 * publisering, gjenoppretting, samtidighet og hvem som ser hva.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { RUS_REGELSETT } from '../domain/rusregelsett'
import { validerScenarioregelsett, type Scenarioregelsett } from '../domain/scenario'
import { KONFLIKT, type Objektstatus } from '../faginnhold/modell'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

let db: PGlite
let admin: string
let bruker: string
let kall: Faginnholdskall
/** Kommentar-ID i importgrunnlaget → ID i databasen, som er en UUID. */
const kommentarIder = new Map<string, string>()
const uuid = (id: string) => kommentarIder.get(id) ?? kommentarIder.set(id, randomUUID()).get(id)!

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Adminsen', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'vanlig', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
  kall = faginnholdskall(db, admin)
}, 120_000)

/**
 * Regelsettet med databasens kommentar-ID-er. Plasseringene erstattes i stedet
 * for å endres, fordi samme plassering kan brukes av flere scenarier.
 */
function iDatabasen(r: Scenarioregelsett): Scenarioregelsett {
  const kopi = structuredClone(r)
  for (const k of kopi.kommentarer) k.id = uuid(k.id)
  for (const s of kopi.scenarier) {
    if (s.utfall.type !== 'kommentarer') continue
    s.utfall.plasseringer = s.utfall.plasseringer.map((p) => ({ ...p, kommentar: uuid(p.kommentar) }))
  }
  return kopi
}

function regelsett(modul: string): Scenarioregelsett {
  const funnet = RUS_REGELSETT.find((r) => r.modul === modul)
  if (!funnet) throw new Error(`ukjent regelsett i testen: ${modul}`)
  return iDatabasen(funnet)
}

function opprett(r: Scenarioregelsett, av = admin) {
  return kall.rpc(av, 'opprett_utkast', { objekttype: 'scenarioregelsett', innhold: r })
}

function lagre(id: string, forventet: number, r: Scenarioregelsett, av = admin) {
  return kall.rpc(av, 'lagre_utkast', { objekt: id, forventet_revisjon: forventet, innhold: r })
}

async function sqlFeil(r: Scenarioregelsett): Promise<string[]> {
  const rad = await kall.rpc<{ valider_scenarioregelsett: string[] }>(admin, 'valider_scenarioregelsett', {
    innhold: r,
  })
  return rad.valider_scenarioregelsett
}

async function lest(id: string, tilstand: 'utkast' | 'publisert' = 'utkast') {
  const [rad] = await kall.fasit<{ innhold: Scenarioregelsett }>(
    `select intern.les_scenarioregelsett($1, $2) as innhold`,
    [id, tilstand],
  )
  return rad!.innhold
}

/**
 * Endrede utgaver av et regelsett, hver med en beskrivelse: alle
 * sammenligninger byttet, grensene flyttet, scenarier fjernet eller doblet,
 * plasseringer endret.
 */
function varianter(r: Scenarioregelsett): [string, Scenarioregelsett][] {
  const ut: [string, Scenarioregelsett][] = []
  const variant = (navn: string, endre: (k: Scenarioregelsett) => void) => {
    const k = structuredClone(r)
    endre(k)
    ut.push([`${r.modul}: ${navn}`, k])
  }

  r.scenarier.forEach((s, si) => {
    variant(`uten ${s.nokkel}`, (k) => k.scenarier.splice(si, 1))
    variant(`${s.nokkel} to ganger`, (k) => k.scenarier.push({ ...structuredClone(s), nokkel: `${s.nokkel}_kopi` }))
    s.vilkar.forEach((_, vi) => {
      for (const operator of ['<', '<=', '>', '>='] as const) {
        variant(`${s.nokkel} vilkår ${vi} ${operator}`, (k) => (k.scenarier[si]!.vilkar[vi]!.operator = operator))
      }
    })
    if (s.utfall.type === 'kommentarer') {
      const antall = s.utfall.plasseringer.length
      variant(`${s.nokkel} uten siste kommentar`, (k) => {
        const u = k.scenarier[si]!.utfall
        if (u.type === 'kommentarer') u.plasseringer.pop()
      })
      variant(`${s.nokkel} bare tillegg`, (k) => {
        const u = k.scenarier[si]!.utfall
        if (u.type === 'kommentarer') for (const p of u.plasseringer) p.rolle = 'tillegg'
      })
      if (antall > 1) {
        variant(`${s.nokkel} samme merke`, (k) => {
          const u = k.scenarier[si]!.utfall
          if (u.type === 'kommentarer') u.plasseringer[1]!.merke = u.plasseringer[0]!.merke
        })
      }
      variant(`${s.nokkel} alle koder på første`, (k) => {
        const u = k.scenarier[si]!.utfall
        if (u.type === 'kommentarer') u.plasseringer[0]!.koder = [...k.analytter]
      })
      variant(`${s.nokkel} notis med mellomrom`, (k) => {
        const u = k.scenarier[si]!.utfall
        if (u.type === 'kommentarer') u.notiser.push(' ')
      })
    }
    variant(`${s.nokkel} uten påvist`, (k) => (k.scenarier[si]!.pavist = []))
    variant(`${s.nokkel} ukjent kode`, (k) => k.scenarier[si]!.pavist.push('XYZ'))
  })

  r.parametere.forEach((_, pi) => {
    for (const verdi of [0, 0.05, 0.2, 0.5, 1, 3]) {
      variant(`grense ${pi} = ${verdi}`, (k) => (k.parametere[pi]!.verdi = verdi))
    }
    variant(`grense ${pi} uten navn`, (k) => (k.parametere[pi]!.navn = ''))
  })
  r.forhold.forEach((f, fi) => {
    variant(`${f.nokkel} snudd`, (k) => {
      const x = k.forhold[fi]!
      ;[x.teller, x.nevner] = [x.nevner, x.teller]
    })
    variant(`${f.nokkel} uten nevner`, (k) => (k.forhold[fi]!.nevner = []))
    variant(`${f.nokkel} ukjent grense i meldingen`, (k) => (k.forhold[fi]!.nullmelding = 'Se {finnes_ikke}.'))
  })

  variant('ugyldig modul', (k) => (k.modul = 'Ugyldig'))
  variant('dobbel analytt', (k) => k.analytter.push(k.analytter[0]!))
  variant('ugyldig nøkkel', (k) => (k.scenarier[0]!.nokkel = 'Stor'))
  variant('hjelpetekst med ukjent grense', (k) => (k.verdihjelp = 'Høyst {ukjent} %.'))
  variant('ubrukt kommentar', (k) => k.kommentarer.push({ id: randomUUID(), tekst: 'Ubrukt.' }))
  variant('kommentar to ganger', (k) => k.kommentarer.push({ ...k.kommentarer[0]! }))
  variant('tom kommentar', (k) => (k.kommentarer[0]!.tekst = ' '))
  variant('ukjent kommentar', (k) => {
    const u = k.scenarier.find((x) => x.utfall.type === 'kommentarer')!.utfall
    if (u.type === 'kommentarer') u.plasseringer[0]!.kommentar = randomUUID()
  })
  return ut
}

describe('valideringen i databasen', () => {
  it('godtar de importerte regelsettene', async () => {
    for (const r of RUS_REGELSETT) expect(await sqlFeil(iDatabasen(r)), r.modul).toEqual([])
  })

  it('gir de samme feilene som appen for hver endret utgave', async () => {
    let provd = 0
    let ugyldige = 0
    for (const r of RUS_REGELSETT.filter((x) => x.analytter.length > 1)) {
      for (const [navn, variant] of varianter(iDatabasen(r))) {
        const forventet = validerScenarioregelsett(variant)
        expect([...(await sqlFeil(variant))].sort(), navn).toEqual([...forventet].sort())
        provd++
        if (forventet.length > 0) ugyldige++
      }
    }
    // Rutenettet skal ha prøvd mye, og både gyldige og ugyldige utgaver.
    expect(provd).toBeGreaterThan(150)
    expect(ugyldige).toBeGreaterThan(100)
    expect(provd - ugyldige).toBeGreaterThan(5)
  }, 120_000)

  it('avviser et ugyldig regelsett når det lagres, med meldingene', async () => {
    const r = regelsett('tramadolgruppen')
    r.scenarier.pop()
    // Tilleggskommentaren ble bare brukt av scenariet som er borte.
    r.kommentarer.pop()
    const feil = await feilFra(() => opprett(r))
    expect(feil?.code).toBe('22023')
    expect(feil?.message).toBe('Ingen scenarier gjelder når TRAM + OTRAM er påvist.')
  })

  it('avviser feil form før reglene prøves', async () => {
    const r = regelsett('tramadolgruppen') as unknown as Record<string, unknown>
    expect((await feilFra(() => sqlFeil({ ...r, ukjent: 1 } as never)))?.message).toBe('Ukjente felt: ukjent.')
    const utenFelt = { ...r }
    delete utenFelt.scenarier
    expect((await feilFra(() => sqlFeil(utenFelt as never)))?.message).toBe('Mangler felt: scenarier.')
    expect((await feilFra(() => sqlFeil({ ...r, analytter: [1] } as never)))?.message).toBe(
      'Feltet analytter må være en liste med tekster.',
    )
  })

  it('lar bare administratorer validere', async () => {
    const feil = await feilFra(() =>
      kall.rpc(bruker, 'valider_scenarioregelsett', { innhold: regelsett('tramadolgruppen') }),
    )
    expect(feil?.code).toBe('42501')
  })
})

describe('lagring og lesing', () => {
  it('lagrer hvert regelsett og gir det tilbake uendret', async () => {
    for (const mal of RUS_REGELSETT) {
      const r = iDatabasen(mal)
      const status = await opprett(r)
      expect(await lest(status.id), r.modul).toEqual(r)
      await kall.forventSamsvar(status.id)
    }
  }, 60_000)

  it('lar en analyttkode høre til bare ett regelsett, og en modul ha bare ett', async () => {
    const r = regelsett('tramadolgruppen')
    expect((await feilFra(() => opprett(r)))?.message).toBe('Det finnes alt et regelsett for modulen tramadolgruppen.')
    r.modul = 'tramadol-igjen'
    expect((await feilFra(() => opprett(r)))?.message).toBe(
      'Analyttkodene OTRAM, TRAM fortolkes alt av et annet regelsett.',
    )
  })

})

describe('publisering, gjenoppretting og samtidighet', () => {
  let id: string
  let status: Objektstatus
  let r: Scenarioregelsett

  beforeAll(async () => {
    // Et regelsett for egne koder, så det ikke kolliderer med de andre testene.
    r = regelsett('kodeingruppen')
    r.modul = 'kodein-test'
    r.analytter = ['KODT', 'MORT']
    const bytt = (k: string) => ({ KOD: 'KODT', MOR: 'MORT' })[k] ?? k
    for (const f of r.forhold) {
      f.teller = f.teller.map(bytt)
      f.nevner = f.nevner.map(bytt)
    }
    for (const s of r.scenarier) {
      s.pavist = s.pavist.map(bytt)
      if (s.utfall.type === 'kommentarer') for (const p of s.utfall.plasseringer) p.koder = p.koder.map(bytt)
    }
    status = await opprett(r)
    id = status.id
  })

  it('publiserer hele regelsettet, tekstene med', async () => {
    status = await kall.publiser(id, status.revisjon!)
    expect(status.publisert_revisjon).toBe(1)
    expect(await lest(id, 'publisert')).toEqual(r)
  })

  it('viser vanlige brukere bare det publiserte', async () => {
    const endret = structuredClone(r)
    endret.parametere[0]!.verdi = 0.25
    status = await lagre(id, status.revisjon!, endret)
    expect(status.revisjon).toBe(2)

    const vanlig = await kall.les<{ verdi: string; tilstand: string }>(
      bruker,
      `select verdi::text, tilstand from public.scenarioparametere where objekt_id = $1 and nokkel = 'lav_morfin'`,
      [id],
    )
    expect(vanlig).toEqual([{ verdi: '0.2', tilstand: 'publisert' }])
    const adm = await kall.les<{ verdi: string }>(
      admin,
      `select verdi::text from public.scenarioparametere where objekt_id = $1 and nokkel = 'lav_morfin' order by tilstand`,
      [id],
    )
    expect(adm.map((x) => x.verdi).sort()).toEqual(['0.2', '0.25'])
  })

  it('stopper en lagring mot en utdatert revisjon', async () => {
    const feil = await feilFra(() => lagre(id, 1, r))
    expect(feil?.code).toBe(KONFLIKT)
  })

  it('gjenoppretter hele regelsettet på én gang, som en ny revisjon', async () => {
    const endret = structuredClone(r)
    endret.scenarier.reverse()
    endret.parametere[1]!.verdi = 1.5
    endret.kommentarer[0]!.tekst = 'En annen tekst.'
    status = await lagre(id, status.revisjon!, endret)
    expect(status.revisjon).toBe(3)

    status = await kall.gjenopprett(id, 3, 1)
    expect(status.revisjon).toBe(4)
    expect(await lest(id)).toEqual(r)
    const historikk = await kall.revisjoner(id)
    expect(historikk.map((h) => h.handling)).toEqual(['opprettet', 'endret', 'endret', 'gjenopprettet'])
    expect(historikk[3]!.gjenopprettet_fra).toBe(1)
    await kall.forventSamsvar(id)
  })

  it('lar ikke vanlige brukere endre', async () => {
    expect((await feilFra(() => lagre(id, status.revisjon!, r, bruker)))?.code).toBe('42501')
  })

  it('gir ingen skriverett på tabellene', async () => {
    const feil = await feilFra(() =>
      kall.les(admin, `delete from public.scenarier where objekt_id = $1`, [id]),
    )
    expect(feil?.code).toBe('42501')
  })
})
