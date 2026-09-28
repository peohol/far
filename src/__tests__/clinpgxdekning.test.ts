/**
 * Dekningsoversikten for ClinPGx (`src/faginnhold/clinpgxdekning.ts`): at hver
 * publiserte stoffside migrasjonene lager, står der nøyaktig én gang med én
 * status, at statusene henger sammen med koblingene, at en metabolitt peker på
 * et moderstoff som selv er koblet, og at oversikten i `docs/clinpgx.md` er
 * lik listene. Kommer det en ny stoffside, feiler testen til siden har fått
 * en ClinPGx-status.
 */
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  clinpgxdekning,
  clinpgxdekningsoversikt,
  DEKNINGSSTATUSER,
  gjeldendeClinpgxside,
  dekningstelling,
  UKOBLEDE_STOFFSIDER,
  type Dekning,
} from '../faginnhold/clinpgxdekning'
import { ALLE_CLINPGXKOBLINGER, CLINPGXKOBLINGSIMPORTER } from '../faginnhold/clinpgxkoblinger'
import { ELEMENTTYPER, lesClinpgxkobling } from '../faginnhold/paneler'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)
/** Den første migrasjonen som trenger administratoren importene føres på. */
const FORSTE_IMPORT = migrasjonsfiler().find((f) =>
  readFileSync(new URL(f, MIGRASJONSMAPPE), 'utf8').includes("p.username = 'peohol'"),
)!

const DEKNING = clinpgxdekning()
const perSide = new Map<string, Dekning>(DEKNING.map((d) => [d.side, d]))

describe('dekningsoversikten', () => {
  it('har hver side nøyaktig én gang, med en kjent status og en grunn', () => {
    expect(perSide.size).toBe(DEKNING.length)
    for (const d of DEKNING) {
      expect(Object.keys(DEKNINGSSTATUSER), d.side).toContain(d.status)
      expect(d.grunn.trim(), d.side).not.toBe('')
    }
  })

  it('er koblet for nøyaktig sidene som har en kobling i importene, med dagens sidenavn', () => {
    const koblet = DEKNING.filter((d) => d.status === 'koblet').map((d) => d.side)
    expect(new Set(koblet)).toEqual(new Set(ALLE_CLINPGXKOBLINGER.map((k) => gjeldendeClinpgxside(k.side))))
    for (const d of DEKNING) {
      if (d.status !== 'koblet') continue
      expect(d.kjemikalier, d.side).toEqual(
        ALLE_CLINPGXKOBLINGER
          .filter((k) => gjeldendeClinpgxside(k.side) === d.side)
          .map((k) => ({ clinpgx_id: k.clinpgx_id, navn: k.navn })),
      )
    }
  })

  it('peker for hver metabolitt på moderstoffets kjemikalie, og på siden som er koblet til det', () => {
    for (const u of UKOBLEDE_STOFFSIDER) {
      if (u.status !== 'metabolitt') continue
      expect(u.moderstoff.clinpgx_id, u.side).toMatch(/^PA\d+$/)
      for (const e of u.egne) expect(e.clinpgx_id, u.side).toMatch(/^PA\d+$/)
      // Metabolitten kobles ikke til moderstoffets kjemikalie.
      expect(u.egne.map((e) => e.clinpgx_id), u.side).not.toContain(u.moderstoff.clinpgx_id)
      if (u.moderstoff.side === null) {
        expect(perSide.has(u.moderstoff.navn), u.side).toBe(false)
        continue
      }
      const moder = perSide.get(u.moderstoff.side)
      expect(moder?.status, u.side).toBe('koblet')
      if (moder?.status === 'koblet') expect(moder.kjemikalier.map((k) => k.clinpgx_id), u.side).toContain(u.moderstoff.clinpgx_id)
    }
  })

  it('har kandidater og søkeord der statusen sier det', () => {
    for (const u of UKOBLEDE_STOFFSIDER) {
      if (u.status === 'krever_kuratering') expect(u.kandidater.length, u.side).toBeGreaterThan(0)
      if (u.status === 'ikke_i_clinpgx') expect(u.sokt.length, u.side).toBeGreaterThan(0)
    }
  })

  it('teller hver side én gang', () => {
    const telling = dekningstelling()
    expect(Object.values(telling).reduce((a, b) => a + b, 0)).toBe(DEKNING.length)
  })

  it('står i docs/clinpgx.md, lik listene', () => {
    const dok = readFileSync(new URL('../../docs/clinpgx.md', import.meta.url), 'utf8')
    expect(dok).toContain(clinpgxdekningsoversikt())
  })
})

describe('mot sidene migrasjonene lager', () => {
  let publiserte: string[]
  let koblinger: Map<string, string[]>

  beforeAll(async () => {
    const db = await nyDatabase({ til: FORSTE_IMPORT })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORT })
    publiserte = (
      await db.query<{ navn: string }>("select navn from public.infosider where tilstand = 'publisert' order by navn")
    ).rows.map((r) => r.navn)
    const rader = (
      await db.query<{ navn: string; data: unknown }>(
        `select i.navn, e.data from public.infosider i join public.innholdselementer e on e.infoside_id = i.objekt_id
         where i.tilstand = 'publisert' and e.tilstand = 'publisert' and e.elementtype = $1 and e.panel <> 'fjernet'`,
        [ELEMENTTYPER.clinpgxkobling],
      )
    ).rows
    koblinger = new Map(rader.map((r) => [r.navn, lesClinpgxkobling(r.data).kjemikalier.map((k) => k.clinpgx_id)]))
  }, 600_000)

  it('har en ClinPGx-status for hver publiserte stoffside, og ingen for sider som ikke finnes', () => {
    const mangler = publiserte.filter((s) => !perSide.has(s))
    expect(mangler, 'Stoffsidene mangler ClinPGx-status i src/faginnhold/clinpgxdekning.ts').toEqual([])
    const ukjente = DEKNING.map((d) => d.side).filter((s) => !publiserte.includes(s))
    expect(ukjente, 'Sidene i dekningsoversikten finnes ikke').toEqual([])
  })

  it('legger inn koblingene som ikke krever FEST, bare fra migrasjonene i repoet', () => {
    // Testdatabasen har ingen FEST-koblinger, så bare importene uten FEST-krav kommer inn, men de kommer helt.
    const forventet = new Map<string, string[]>()
    for (const k of CLINPGXKOBLINGSIMPORTER.filter((i) => !i.festkrav).flatMap((i) => i.koblinger)) {
      forventet.set(k.side, [...(forventet.get(k.side) ?? []), k.clinpgx_id])
    }
    expect(forventet.size).toBeGreaterThan(10)
    expect(koblinger).toEqual(forventet)
    // De to sidene som bare har FEST-koblingen i produksjonen, kobles også fra repoet alene.
    expect(koblinger.get('Levomepromazin')).toEqual(['PA164743234'])
    expect(koblinger.get('O-desmetylvenlafaksin')).toEqual(['PA165958374'])
  })
})
