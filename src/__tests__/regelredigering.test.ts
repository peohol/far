/**
 * Redigeringen av regelsettene, simulatoren og sammenligningen historikken
 * viser — de rene funksjonene. At databasen godtar det redigeringen lager,
 * prøves i `intervallregelsett.test.ts`.
 *
 * Regelsettene her er syntetiske.
 */
import { describe, expect, it } from 'vitest'
import { finnRegel, intervallene, regelsettband } from '../domain/intervallregler'
import { CUTOFF_NOKKEL, regelsettvalg } from '../domain/valg'
import {
  jsonfelter,
  ordforskjell,
  sammenlignFelter,
  forrigeSynlige,
  beskrivHandling,
  type Felt,
  type Historikk,
} from '../faginnhold/historikk'
import type { Intervallregelsett } from '../regler/modell'
import {
  brukKommentar,
  delIntervall,
  egenKommentar,
  klargjor,
  kontrollerDeling,
  kontrollerRegelsett,
  ringstart,
  settCutoff,
  settCutoffKommentar,
  settDesimaler,
  settKommentartekst,
  settRing,
  settSkillepunkt,
  slaSammen,
} from '../regler/redigering'
import { regelsettfelter, simuler } from '../regler/visning'

function regelsett(endring: Partial<Intervallregelsett> = {}): Intervallregelsett {
  return {
    analyttkode: 'TESTA',
    enhet: 'nmol/L',
    desimaler: 0,
    skillepunkter: [10, 1800],
    intervaller: [
      { niva: 'under', handling: null, kommentar: 'lav' },
      { niva: 'innenfor', handling: null, kommentar: 'middels' },
      { niva: 'over', handling: 'ring_rekvirent', kommentar: 'hoy' },
    ],
    ringegrense: 1800,
    cutoff: { innledning: 'innledning', kommentar: 'middels' },
    kommentarer: [
      { id: 'lav', tekst: 'Lav syntetisk kommentar.' },
      { id: 'middels', tekst: 'Middels syntetisk kommentar.' },
      { id: 'hoy', tekst: 'Høy syntetisk kommentar.' },
      { id: 'innledning', tekst: 'Syntetisk innledning.' },
    ],
    ...endring,
  }
}

/** ID-er i rekkefølge, så testene vet hva de nye kommentarene heter. */
function ider() {
  let n = 0
  return () => `ny-${++n}`
}

/** Det databasen krever av sammenhengen, sett fra appen. */
function forventSammenhengende(r: Intervallregelsett) {
  expect(r.intervaller).toHaveLength(r.skillepunkter.length + 1)
  const brukt = new Set([...r.intervaller.map((i) => i.kommentar), ...(r.cutoff ? [r.cutoff.innledning, r.cutoff.kommentar] : [])])
  expect(new Set(r.kommentarer.map((k) => k.id))).toEqual(brukt)
  const start = r.intervaller.findIndex((i) => i.handling === 'ring_rekvirent')
  if (start < 0) {
    expect(r.ringegrense).toBeNull()
  } else {
    expect(start).toBeGreaterThan(0)
    expect(r.intervaller.slice(start).every((i) => i.handling === 'ring_rekvirent')).toBe(true)
    const fra = r.skillepunkter[start - 1]!
    expect([fra, Math.round((fra - 10 ** -r.desimaler) * 10 ** r.desimaler) / 10 ** r.desimaler]).toContain(r.ringegrense)
  }
}

describe('redigeringen av et regelsett', () => {
  it('flytter en grense for begge naboene, og ringegrensen med den', () => {
    const r = settSkillepunkt(regelsett(), 1, 2000)
    expect(r.skillepunkter).toEqual([10, 2000])
    expect(r.ringegrense).toBe(2000)
    expect(intervallene(r).map((t) => [t.fra, t.til])).toEqual([
      [null, 10],
      [10, 2000],
      [2000, null],
    ])
    forventSammenhengende(r)
  })

  it('holder en ringegrense «over» grensen ett steg under også når grensen eller desimalene endres', () => {
    const over = settRing(regelsett(), { indeks: 2, over: true })
    expect(over.ringegrense).toBe(1799)
    expect(settSkillepunkt(over, 1, 2000).ringegrense).toBe(1999)
    const finere = settDesimaler(over, 1)
    expect(finere.ringegrense).toBe(1799.9)
    expect(ringstart(finere)).toEqual({ indeks: 2, over: true })
    forventSammenhengende(finere)
  })

  it('deler et intervall i to med samme regel og kommentar, og slår det sammen igjen', () => {
    const delt = delIntervall(regelsett(), 1, 500)
    expect(delt.skillepunkter).toEqual([10, 500, 1800])
    expect(delt.intervaller[1]).toEqual(delt.intervaller[2])
    expect(delt.kommentarer).toHaveLength(4)
    forventSammenhengende(delt)
    expect(slaSammen(delt, 1)).toEqual(regelsett())
  })

  it('deler det øverste intervallet uten å miste ringingen', () => {
    const delt = delIntervall(regelsett(), 2, 5000)
    expect(delt.intervaller.map((i) => i.handling)).toEqual([null, null, 'ring_rekvirent', 'ring_rekvirent'])
    expect(delt.ringegrense).toBe(1800)
    forventSammenhengende(delt)
  })

  it('godtar bare en ny grense inne i intervallet og med riktig oppløsning', () => {
    expect(kontrollerDeling(regelsett(), 1, 10)).toMatch(/inne i intervallet/)
    expect(kontrollerDeling(regelsett(), 1, 1800)).toMatch(/inne i intervallet/)
    expect(kontrollerDeling(regelsett(), 0, 9.5)).toMatch(/desimaler/)
    expect(kontrollerDeling(regelsett(), 0, 0)).toMatch(/over null/)
    expect(kontrollerDeling(regelsett(), 0, 9)).toBeNull()
    expect(() => delIntervall(regelsett(), 1, 1800)).toThrow(/inne i intervallet/)
  })

  it('flytter ringingen opp når intervallet der den begynte, slås sammen med det under', () => {
    const r = slaSammen(regelsett(), 1)
    expect(r.intervaller.map((i) => i.handling)).toEqual([null, null])
    expect(r.ringegrense).toBeNull()
    expect(r.kommentarer.map((k) => k.id)).toEqual(['lav', 'middels', 'innledning'])
    forventSammenhengende(r)
  })

  it('slår av og på ringingen fra et hvilket som helst intervall', () => {
    const ingen = settRing(regelsett(), null)
    expect(ingen.intervaller.every((i) => i.handling === null)).toBe(true)
    expect(ingen.ringegrense).toBeNull()
    const fraMidten = settRing(ingen, { indeks: 1, over: false })
    expect(fraMidten.intervaller.map((i) => i.handling)).toEqual([null, 'ring_rekvirent', 'ring_rekvirent'])
    expect(fraMidten.ringegrense).toBe(10)
    forventSammenhengende(fraMidten)
  })

  it('endrer en delt kommentar ett sted, og gir et intervall en egen når det trengs', () => {
    const delt = delIntervall(regelsett(), 1, 500)
    const endret = settKommentartekst(delt, 'middels', 'Ny tekst.')
    expect(regelsettband(endret).map((b) => b.kommentar)).toEqual([
      'Lav syntetisk kommentar.',
      'Ny tekst.',
      'Ny tekst.',
      'Høy syntetisk kommentar.',
    ])

    const egen = settKommentartekst(egenKommentar(endret, 2, ider()), 'ny-1', 'Egen tekst.')
    expect(regelsettband(egen).map((b) => b.kommentar)).toEqual([
      'Lav syntetisk kommentar.',
      'Ny tekst.',
      'Egen tekst.',
      'Høy syntetisk kommentar.',
    ])
    forventSammenhengende(egen)

    // Tar intervallet i bruk en annen kommentar, forsvinner den ingen bruker.
    const tilbake = brukKommentar(egen, 2, 'middels')
    expect(tilbake.kommentarer.some((k) => k.id === 'ny-1')).toBe(false)
    forventSammenhengende(tilbake)
  })

  it('gjør linjeskift og tabulatorer til mellomrom mens det skrives, og trimmer før lagring', () => {
    const r = settKommentartekst(regelsett(), 'lav', ' To\nlinjer\tog tab. ')
    expect(r.kommentarer[0]!.tekst).toBe(' To linjer og tab. ')
    expect(klargjor(r).kommentarer[0]!.tekst).toBe('To linjer og tab.')
  })

  it('slår cut-off av og på uten å kopiere hovedkommentaren', () => {
    const uten = settCutoff(regelsett(), false)
    expect(uten.cutoff).toBeNull()
    expect(uten.kommentarer.some((k) => k.id === 'innledning')).toBe(false)

    const med = settKommentartekst(settCutoff(uten, true, ider()), 'ny-1', 'Ny innledning.')
    expect(med.cutoff).toEqual({ innledning: 'ny-1', kommentar: 'middels' })
    expect(simuler(med, 'cutoff')?.valg.kommentar).toBe('Ny innledning. Middels syntetisk kommentar.')

    const annen = settCutoffKommentar(med, 'hoy')
    expect(simuler(annen, 'cutoff')?.valg.kommentar).toBe('Ny innledning. Høy syntetisk kommentar.')
    forventSammenhengende(annen)
  })

  it('lar cut-off følge med når intervallet den bygde på, slås sammen eller får en annen kommentar', () => {
    const sammen = slaSammen(regelsett(), 0)
    expect(sammen.cutoff).toEqual({ innledning: 'innledning', kommentar: 'lav' })
    expect(sammen.kommentarer.map((k) => k.id)).toEqual(['lav', 'hoy', 'innledning'])
    forventSammenhengende(sammen)

    const annen = brukKommentar(regelsett(), 1, 'hoy')
    expect(annen.cutoff?.kommentar).toBe('hoy')
    forventSammenhengende(annen)

    const egen = egenKommentar(regelsett(), 1, ider())
    expect(egen.cutoff?.kommentar).toBe('ny-1')
    forventSammenhengende(egen)
  })

  it('kontrollerer grensene og tekstene før lagring', () => {
    expect(kontrollerRegelsett(regelsett())).toBeNull()
    expect(kontrollerRegelsett(regelsett({ skillepunkter: [1800, 10] }))).toMatch(/stige/)
    expect(kontrollerRegelsett(regelsett({ skillepunkter: [10.5, 1800] }))).toMatch(/desimaler/)
    expect(kontrollerRegelsett(regelsett({ skillepunkter: [-1, 1800] }))).toMatch(/over null/)
    expect(kontrollerRegelsett(settKommentartekst(regelsett(), 'lav', '  '))).toMatch(/tekst/)
    expect(kontrollerRegelsett(regelsett({ desimaler: 7 }))).toMatch(/0 til 6/)
    expect(kontrollerRegelsett(settKommentartekst(regelsett(), 'lav', 'x'.repeat(4001)))).toMatch(/4000/)
  })
})

describe('simulatoren', () => {
  const r = regelsett()

  it('gir samme valg som steg 2 for hver verdi, på og rundt grensene', () => {
    const valg = regelsettvalg(r)
    for (const verdi of [0, 9, 9.5, 9.99, 10, 10.01, 1799, 1799.5, 1800, 1800.1, 1e6]) {
      const svar = simuler(r, verdi)!
      expect(svar.intervall).toBe(finnRegel(r, verdi).indeks)
      expect(svar.valg).toEqual(valg[svar.intervall!])
    }
    expect(simuler(r, 9.99)!.valg.label).toBe('< 10')
    expect(simuler(r, 10)!.valg.label).toBe('10 – 1799')
    expect(simuler(r, 1799.5)!.valg.ring).toBe(false)
    expect(simuler(r, 1800)!.valg).toMatchObject({ label: '≥ 1800', ring: true, kommentar: 'Høy syntetisk kommentar.' })
  })

  it('gir cut-off-valget, eller ingenting når regelsettet ikke har det', () => {
    expect(simuler(r, 'cutoff')!.valg).toMatchObject({
      key: CUTOFF_NOKKEL,
      ring: false,
      kommentar: 'Syntetisk innledning. Middels syntetisk kommentar.',
    })
    expect(simuler(regelsett({ cutoff: null, kommentarer: r.kommentarer.slice(0, 3) }), 'cutoff')).toBeNull()
  })
})

describe('sammenligningen', () => {
  it('finner ordene som er fjernet og lagt til, og gjenskaper begge tekstene', () => {
    const for_ = 'Konsentrasjonen er innenfor referanseområdet for pasienter.'
    const etter = 'Konsentrasjonen er godt innenfor referanseområdet.'
    const deler = ordforskjell(for_, etter)
    expect(deler.filter((d) => d.slag !== 'lagt_til').map((d) => d.tekst).join('')).toBe(for_)
    expect(deler.filter((d) => d.slag !== 'fjernet').map((d) => d.tekst).join('')).toBe(etter)
    expect(deler.filter((d) => d.slag === 'lagt_til').map((d) => d.tekst.trim())).toEqual(['godt', 'referanseområdet.'])
    expect(ordforskjell('lik', 'lik')).toEqual([{ slag: 'lik', tekst: 'lik' }])
    expect(ordforskjell('', 'ny')).toEqual([{ slag: 'lagt_til', tekst: 'ny' }])
  })

  it('sammenligner feltene og beholder de fjernede der de sto', () => {
    const f = (nokkel: string, verdi: string): Felt => ({ nokkel, navn: nokkel, verdi })
    const endringer = sammenlignFelter([f('a', '1'), f('b', '2'), f('c', '3')], [f('a', '1'), f('c', '4'), f('d', '5')])
    expect(endringer.map((e) => [e.nokkel, e.for, e.etter, e.endret])).toEqual([
      ['a', '1', '1', false],
      ['b', '2', null, true],
      ['c', '3', '4', true],
      ['d', null, '5', true],
    ])
  })

  it('deler et regelsett i felt for hvert intervall, så en endret grense og kommentar vises for seg', () => {
    const for_ = regelsett()
    const etter = settKommentartekst(settSkillepunkt(for_, 1, 2000), 'hoy', 'Endret høy kommentar.')
    const endret = sammenlignFelter(regelsettfelter(for_), regelsettfelter(etter)).filter((e) => e.endret)
    expect(endret.map((e) => [e.gruppe ?? '', e.navn, e.for, e.etter])).toEqual([
      ['Intervall 2', 'Konsentrasjon', '10 – 1799 nmol/L', '10 – 1999 nmol/L'],
      ['Intervall 3', 'Konsentrasjon', '≥ 1800 nmol/L', '≥ 2000 nmol/L'],
      ['Intervall 3', 'Kommentar', 'Høy syntetisk kommentar.', 'Endret høy kommentar.'],
      ['', 'Ringegrense', '1800 nmol/L', '2000 nmol/L'],
    ])
  })

  it('deler annet innhold etter formen det har', () => {
    expect(jsonfelter({ navn: 'Amitriptylin', panelreferanser: { dose: ['r1', 'r2'] } })).toEqual([
      { nokkel: 'navn', navn: 'navn', verdi: 'Amitriptylin', tekst: true },
      { nokkel: 'panelreferanser.dose[1]', navn: 'panelreferanser.dose[1]', verdi: 'r1', tekst: true },
      { nokkel: 'panelreferanser.dose[2]', navn: 'panelreferanser.dose[2]', verdi: 'r2', tekst: true },
    ])
  })

  it('sammenligner med den nærmeste eldre revisjonen leseren kan se', () => {
    const historikk: Historikk<string> = {
      hendelser: [],
      revisjoner: [
        { revisjon: 1, innhold: 'a' },
        { revisjon: 4, innhold: 'b' },
        { revisjon: 6, innhold: 'c' },
      ],
    }
    expect(forrigeSynlige(historikk, 6)?.revisjon).toBe(4)
    expect(forrigeSynlige(historikk, 1)).toBeNull()
    expect(
      beskrivHandling({
        handling: 'gjenopprettet',
        revisjon: 3,
        gjenopprettet_fra: 1,
        utfort_av_fornavn: 'Ada',
        utfort_av_etternavn: 'Adminsen',
        utfort_kl: '2026-09-22T12:32:00Z',
      }),
    ).toBe('Gjenopprettet fra revisjon 1')
  })
})
