/**
 * Varslene som rene funksjoner: valgene, føringene i endringsloggen som
 * varsler, tallet på bjella og tekstene.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Endring } from '../domain/versjon'
import {
  DATABASEKATEGORIER,
  KATEGORIREKKEFOLGE,
  antallUleste,
  endringsvarsler,
  erValgt,
  deletekst,
  endredeDeler,
  favorittside,
  favorittsted,
  idetekst,
  lesEndringsloggstatus,
  lesVarselliste,
  lesVarselvalg,
  merkEndringerLest,
  merketall,
  navneliste,
  objekttekst,
  samleVarsler,
  startstatus,
  type Databasevarsel,
} from '../varsler/modell'

const endring = (versjon: string, dato: string, ekstra: Partial<Endring> = {}): Endring => ({
  versjon,
  dato,
  sammendrag: `Versjon ${versjon}`,
  typer: ['Funksjonalitet'],
  omfang: 'Mindre omfang',
  punkter: ['Noe'],
  ...ekstra,
})

const LOGG = [
  endring('1.3.0', '2026-09-29', { endrerFortolkning: true }),
  endring('1.2.0', '2026-09-20'),
  endring('1.1.0', '2026-08-01'),
  endring('1.0.0', '2026-07-01'),
]
const NAA = new Date('2026-09-29T15:00:00')

describe('kategoriene og valgene', () => {
  it('har de samme kategoriene som databasen', () => {
    const mappe = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
    const fil = readdirSync(mappe).find((navn) => navn.endsWith('_varsler.sql'))!
    const sql = readFileSync(mappe + fil, 'utf8')
    const verdier = /create type public\.varselkategori as enum \(([^)]*)\)/.exec(sql)![1]!.match(/'([^']+)'/g)!
    expect(verdier.map((v) => v.slice(1, -1))).toEqual([...DATABASEKATEGORIER])
    expect(KATEGORIREKKEFOLGE).toEqual(expect.arrayContaining([...DATABASEKATEGORIER, 'funksjonalitet']))
  })

  it('holder de obligatoriske på, og bruker standarden til brukeren har valgt', () => {
    const valg = lesVarselvalg({ fortolkning: false, aktive_ideer: false, favoritter: 'ja', ukjent: true })
    expect(valg).toEqual({ fortolkning: false, aktive_ideer: false })
    expect(erValgt('fortolkning', valg)).toBe(true)
    expect(erValgt('mine_ideer', valg)).toBe(true)
    expect(erValgt('aktive_ideer', valg)).toBe(false)
    expect(erValgt('funksjonalitet', valg)).toBe(true)
    expect(erValgt('favoritter', valg)).toBe(false)
    expect(erValgt('favoritter', { favoritter: true })).toBe(true)
    expect(lesVarselvalg(null)).toEqual({})
  })

  it('har favorittene av til brukeren slår dem på', () => {
    expect(erValgt('favoritter', {})).toBe(false)
    expect(erValgt('favoritter', { favoritter: true })).toBe(true)
  })
})

describe('endringsloggen', () => {
  it('lar en ny bruker begynne med den nyeste føringen som varsel', () => {
    expect(startstatus(LOGG)).toEqual({ fra: '1.2.0', lest: [] })
    expect(endringsvarsler(LOGG, startstatus(LOGG), NAA).map((v) => [v.endring.versjon, v.kategori, v.lest])).toEqual([
      ['1.3.0', 'fortolkning', false],
    ])
  })

  it('viser de uleste og de leste fra de siste 30 dagene', () => {
    const status = { fra: '1.0.0', lest: ['1.1.0', '1.2.0'] }
    expect(endringsvarsler(LOGG, status, NAA).map((v) => [v.endring.versjon, v.kategori, v.lest])).toEqual([
      ['1.3.0', 'fortolkning', false],
      ['1.2.0', 'funksjonalitet', true],
    ])
  })

  it('flytter starten forbi de eldste leste som har passert fristen', () => {
    const status = merkEndringerLest(LOGG, { fra: '1.0.0', lest: [] }, ['1.1.0', '1.3.0'], NAA)
    expect(status).toEqual({ fra: '1.1.0', lest: ['1.3.0'] })
    // 1.2.0 er ulest og holder 1.3.0 igjen.
    expect(merkEndringerLest(LOGG, status, ['1.2.0'], NAA)).toEqual({ fra: '1.1.0', lest: ['1.3.0', '1.2.0'] })
  })

  it('varsler ikke føringer som ikke merkes i appen, og lar dem ikke holde starten igjen', () => {
    const logg = [
      endring('1.3.1', '2026-09-29', { utenVarsel: true }),
      ...LOGG.slice(0, 2),
      endring('1.1.1', '2026-08-02', { utenVarsel: true }),
      ...LOGG.slice(2),
    ]
    expect(startstatus(logg)).toEqual({ fra: '1.2.0', lest: [] })
    expect(endringsvarsler(logg, { fra: '1.0.0', lest: [] }, NAA).map((v) => v.endring.versjon)).toEqual(['1.3.0', '1.2.0', '1.1.0'])
    expect(merkEndringerLest(logg, { fra: '1.0.0', lest: [] }, ['1.1.0'], NAA)).toEqual({ fra: '1.1.1', lest: [] })
    // En endring i fortolkningen varsles alltid.
    const begge = [endring('1.4.0', '2026-09-29', { utenVarsel: true, endrerFortolkning: true }), ...LOGG]
    expect(endringsvarsler(begge, { fra: '1.3.0', lest: [] }, NAA).map((v) => [v.endring.versjon, v.kategori])).toEqual([['1.4.0', 'fortolkning']])
  })

  it('leser bare en gyldig status', () => {
    expect(lesEndringsloggstatus({ fra: '1.2.0', lest: ['1.3.0', 'x', 4] })).toEqual({ fra: '1.2.0', lest: ['1.3.0'] })
    expect(lesEndringsloggstatus({ fra: 'x' })).toBeNull()
    expect(lesEndringsloggstatus(null)).toBeNull()
  })
})

const ideVarsel = (ekstra: Partial<Databasevarsel> = {}): Databasevarsel => ({
  kilde: 'database',
  id: 'v1',
  kategori: 'mine_ideer',
  ide: { id: 'i1', tittel: 'Mørk modus', forfatterId: 'kari' },
  hendelser: [
    { kl: '2026-09-29T10:00:00Z', av: 'ola', kommentar: 'k1', svarTil: null },
    { kl: '2026-09-29T11:00:00Z', av: 'per', kommentar: 'k2', svarTil: 'kari' },
    { kl: '2026-09-29T12:00:00Z', av: 'ola', kommentar: 'k3', svarTil: null },
  ],
  oppdatert_kl: '2026-09-29T12:00:00Z',
  lest: false,
  ...ekstra,
})

const NAVN: Record<string, string> = { ola: 'Ola', per: 'Per', kari: 'Kari' }
const navn = (id: string) => NAVN[id] ?? id

describe('tekstene', () => {
  it('lister navnene, de siste først og hver én gang', () => {
    expect(navneliste(['Ola'])).toBe('Ola')
    expect(navneliste(['Ola', 'Per'])).toBe('Ola og Per')
    expect(navneliste(['Ola', 'Per', 'Kari'])).toBe('Ola, Per og Kari')
    expect(navneliste(['Ola', 'Per', 'Kari', 'Liv'])).toBe('Ola, Per og 2 andre')
    expect(idetekst(ideVarsel(), 'kari', navn)).toBe('Ola og Per kommenterte idéen din')
  })

  it('sier svar når det bare er svar til deg, og aktive når du bare har kommentert', () => {
    const svar = ideVarsel({ ide: { id: 'i1', tittel: 'x', forfatterId: 'ola' }, hendelser: [{ kl: '', av: 'per', kommentar: 'k', svarTil: 'kari' }] })
    expect(idetekst(svar, 'kari', navn)).toBe('Per svarte på kommentaren din')
    expect(idetekst({ ...svar, kategori: 'aktive_ideer' }, 'kari', navn)).toBe('Per kommenterte en idé du har kommentert')
  })

  it('navngir kommentarer og regelsett', () => {
    expect(objekttekst({ id: '1', type: 'kommentar', navn: 'AMIS – innenfor', analyttkode: 'AMIS' })).toBe('Kommentaren «AMIS – innenfor»')
    expect(objekttekst({ id: '2', type: 'scenarioregelsett', navn: 'DIAZ · DMI', analyttkode: 'DIAZ' })).toBe('Reglene for DIAZ · DMI')
  })

  it('sier hvilken favorittside som er endret, og hvilke deler, i sidens rekkefølge', () => {
    const side = (navn: string) => ({ id: 's1', navn, stoff: 'bupropion' })
    const varsel = ideVarsel({
      kategori: 'favoritter',
      ide: null,
      hendelser: [
        { kl: '', av: 'ola', side: side('Bupropion'), deler: ['farmakokinetikk'] },
        { kl: '', av: 'per', side: side('Bupropion'), deler: ['dosering', 'navn'] },
        { kl: '', av: 'ola', side: side('Bupropion XL'), deler: ['farmakokinetikk', 'identitet'] },
      ],
    })
    expect(favorittside(varsel)?.navn).toBe('Bupropion XL')
    const deler = endredeDeler(varsel)
    expect(deler).toEqual(['navn', 'identitet', 'dosering', 'farmakokinetikk'])
    expect(deletekst(deler)).toBe('Navnet, Identitet, Dosering og Farmakokinetikk')
    // Lenken går til den første delen som er et sted på siden.
    expect(favorittsted(deler)).toEqual(['dosering'])
    expect(favorittsted(['navn'])).toEqual([])
  })

  it('viser over ni som «9+»', () => {
    expect(merketall(3)).toBe('3')
    expect(merketall(10)).toBe('9+')
  })
})

describe('samlet', () => {
  it('teller de uleste i kategoriene brukeren har valgt', () => {
    const endringer = endringsvarsler(LOGG, { fra: '1.1.0', lest: [] }, NAA)
    const uleste = { mine_ideer: 2, aktive_ideer: 3, fortolkning: 1 }
    expect(antallUleste(uleste, endringer, {})).toBe(2 + 3 + 1 + 2)
    expect(antallUleste(uleste, endringer, { aktive_ideer: false, funksjonalitet: false })).toBe(2 + 1 + 1)
  })

  it('viser de uleste først, og ellers de nyeste først, bare i valgte kategorier', () => {
    const endringer = endringsvarsler(LOGG, { fra: '1.1.0', lest: ['1.2.0'] }, NAA)
    const gammel = ideVarsel({ id: 'gammel', oppdatert_kl: '2026-09-01T10:00:00Z' })
    const aktiv = ideVarsel({ id: 'aktiv', kategori: 'aktive_ideer', oppdatert_kl: '2026-09-29T23:00:00Z' })
    const lest = ideVarsel({ id: 'lest', lest: true, oppdatert_kl: '2026-09-29T14:00:00Z' })
    const ider = (valg = {}) => samleVarsler([gammel, aktiv, lest, ...endringer], valg).map((v) => v.id)
    expect(ider()).toEqual(['aktiv', 'endring:1.3.0', 'gammel', 'lest', 'endring:1.2.0'])
    expect(ider({ aktive_ideer: false, funksjonalitet: false })).toEqual(['endring:1.3.0', 'gammel', 'lest'])
  })

  it('leser svaret fra databasen og hopper over det som ikke har formen', () => {
    const liste = lesVarselliste({
      lest_kl: '2026-09-29T12:00:00Z',
      varsler: [
        {
          id: 'v1',
          kategori: 'fortolkning',
          ide: null,
          hendelser: [{ kl: 'x', av: 'a', objekt: { id: 'o', type: 'kommentar', navn: 'N', analyttkode: null } }],
          oppdatert_kl: 'x',
          lest_kl: null,
        },
        {
          id: 'v4',
          kategori: 'favoritter',
          ide: null,
          hendelser: [{ kl: 'x', av: 'a', side: { id: 's', navn: 'Litium', stoff: 'litium' }, deler: ['tdm', 4] }],
          oppdatert_kl: 'x',
          lest_kl: 'x',
        },
        { id: 'v2', kategori: 'ukjent', hendelser: [{}] },
        { id: 'v3', kategori: 'mine_ideer', hendelser: [] },
      ],
    })
    expect(liste.varsler.map((v) => [v.id, v.lest, v.hendelser[0]!.objekt?.navn])).toEqual([
      ['v1', false, 'N'],
      ['v4', true, undefined],
    ])
    expect(liste.varsler[1]!.hendelser[0]).toMatchObject({ side: { id: 's', navn: 'Litium', stoff: 'litium' }, deler: ['tdm'] })
  })
})
