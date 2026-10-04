// @vitest-environment jsdom
/**
 * Stoffsidens øvrige paneler i Atlas-uttrykket (UX-plan PR H): seksjonsikonene,
 * ikonregisteret for farmakokinetikken, doseringskortene og serumtabellen med
 * kildens oppbygning.
 *
 * Serumtabellen er det viktigste: den leser de lagrede radene tilbake til
 * matrisen i `originaldata/Psykofarmaka.pdf`, og skal aldri vise et annet tall
 * eller en annen tekst enn det som er lagret. Derfor prøves den mot hele
 * importdatasettet.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Serumtabell } from '../components/stoffside/Serumtabell'
import { kinetikkikon, seksjonsikon, tekstvisning } from '../components/stoffside/panelvisning'
import { IKONNAVN } from '../components/ikon/register'
import { Detaljkort, Seksjon } from '../components/seksjoner/Seksjon'
import { doseringskort } from '../faginnhold/doseringskort'
import { doserader, kinetikktittel, tilDokument, type Persentiltabell } from '../faginnhold/import'
import { PANELER, PANELER_MED_FASTE_KORT, fasteKort, panelFor, type Doserad } from '../faginnhold/paneler'
import { PSYKOFARMAKA_FILER } from '../faginnhold/psykofarmaka'
import { klartekst } from '../faginnhold/riktekst'
import { lesSerumtabell, persentiltekst, PROSJEKTMERKNAD, type Serumblokk } from '../faginnhold/serumtabell'

beforeAll(() => {
  window.matchMedia = ((sporring: string) => ({ matches: sporring.includes('reduce') })) as typeof window.matchMedia
})

afterEach(cleanup)

/* --- Serumtabellen -------------------------------------------------------- */

/** Matrisen slik importdatasettet har den, med bare dosene som ble lagret (en dose uten tall lagres ikke). */
function forventetMatrise(tabell: Persentiltabell): Serumblokk {
  return {
    slag: 'persentiler',
    stoff: tabell.stoff,
    kilde: tabell.kilde,
    enhet: tabell.enhet,
    kolonner: tabell.doser
      .map((dose, i) => ({
        dose,
        antall: tabell.antall[i] ?? null,
        p10: tabell.p10[i] ?? null,
        median: tabell.median[i] ?? null,
        p90: tabell.p90[i] ?? null,
      }))
      .filter((k) => persentiltekst(k.median, k.p10, k.p90, tabell.enhet) !== ''),
  }
}

describe('serumtabellen leses tilbake til kildens matrise', () => {
  const medSerum = PSYKOFARMAKA_FILER.filter((fil) => fil.serumkonsentrasjoner)

  it.each(medSerum.map((fil) => [fil.kode, fil] as const))('%s: samme tall, stoff og kilder som datasettet', (_, fil) => {
    const serum = fil.serumkonsentrasjoner!
    const forventet: Serumblokk[] = (serum.tabeller ?? []).map(forventetMatrise)
    const prosjekt = serum.referanseomradeprosjektet
    if (prosjekt) forventet.push({ slag: 'prosjekt', doser: prosjekt.doser, enhet: prosjekt.enhet, p10: prosjekt.p10, p90: prosjekt.p90 })
    if (serum.rader?.length) forventet.push({ slag: 'rader', rader: serum.rader })
    expect(lesSerumtabell(doserader(serum))).toEqual(forventet)
  })

  it('dekker hele datasettet: ingen importert rad faller til vanlige rader uten grunn', () => {
    for (const fil of medSerum) {
      const blokker = lesSerumtabell(doserader(fil.serumkonsentrasjoner!))
      const frie = blokker.flatMap((b) => (b.slag === 'rader' ? b.rader : []))
      expect(frie, fil.kode).toEqual(fil.serumkonsentrasjoner!.rader ?? [])
    }
  })

  const kvetiapin = (): Doserad[] => doserader(PSYKOFARMAKA_FILER.find((f) => f.kode === 'KVE')!.serumkonsentrasjoner!)

  it('viser en rad en redaktør har endret, nøyaktig som den er lagret', () => {
    const rader = kvetiapin()
    rader[2] = { ...rader[2]!, konsentrasjon: 'Median ca. 140 nmol/L (10.–90. persentil: 36–272)' }
    const blokker = lesSerumtabell(rader)
    expect(blokker.map((b) => b.slag)).toEqual(['persentiler', 'rader', 'persentiler', 'prosjekt'])
    expect(blokker[1]).toEqual({ slag: 'rader', rader: [rader[2]] })
  })

  it('godtar ikke et tall som ikke skrives tilbake likt', () => {
    const [rad] = kvetiapin()
    // To mellomrom, eller et tall uten norsk tusenskille, lages ikke av importen.
    for (const konsentrasjon of ['Median 46  nmol/L (10.–90. persentil: 16–756)', 'Median 46 nmol/L (10.–90. persentil: 16–0756)']) {
      expect(lesSerumtabell([{ ...rad!, konsentrasjon }])[0]!.slag).toBe('rader')
    }
    expect(lesSerumtabell([{ ...rad!, regime: '1 gang daglig' }])[0]!.slag).toBe('rader')
    expect(lesSerumtabell([{ ...rad!, merknad: 'Kvetiapin. Jönsson et al. (2019).' }])[0]!.slag).toBe('rader')
  })

  it('leser grenser alene og tall med tusenskille', () => {
    const merknad = 'Stoff. 1 200 prøver. Kilde (2020)'
    const rader: Doserad[] = [
      { dose: '10 mg', regime: '', konsentrasjon: persentiltekst(1234, null, 2500, 'nmol/L'), merknad },
      { dose: '20 mg', regime: '', konsentrasjon: persentiltekst(null, 12.5, null, 'nmol/L'), merknad },
      { dose: '1–2 mg', regime: '', konsentrasjon: persentiltekst(null, 5, 9, 'nmol/L'), merknad: PROSJEKTMERKNAD },
    ]
    expect(lesSerumtabell(rader)).toEqual([
      {
        slag: 'persentiler',
        stoff: 'Stoff',
        kilde: 'Kilde (2020)',
        enhet: 'nmol/L',
        kolonner: [
          { dose: '10 mg', antall: 1200, p10: null, median: 1234, p90: 2500 },
          { dose: '20 mg', antall: 1200, p10: 12.5, median: null, p90: null },
        ],
      },
      { slag: 'prosjekt', doser: '1–2 mg', enhet: 'nmol/L', p10: 5, p90: 9 },
    ])
  })
})

describe('serumtabellen på siden', () => {
  it('har dosene som kolonner og målene som rader, som i PDF-en', () => {
    render(<Serumtabell rader={kvetiapinrader()} tittel="Serumkonsentrasjoner" />)
    const [matrise, prosjekt] = screen.getAllByRole('table')
    const kolonner = within(matrise!).getAllByRole('columnheader').map((th) => th.textContent)
    expect(kolonner).toEqual(['Dose', '50 mg', '100 mg', '200 mg', '300 mg', '400 mg', '600 mg', '800 mg', '1000 mg', 'Alle'])
    const rader = within(matrise!).getAllByRole('rowheader').map((th) => th.textContent)
    expect(rader).toEqual(['Antall prøver', '10-persentil (nmol/L)', 'Median (nmol/L)', '90-persentil (nmol/L)'])
    const median = within(matrise!).getByRole('rowheader', { name: 'Median (nmol/L)' }).parentElement!
    expect([...median.querySelectorAll('td')].map((td) => td.textContent)).toEqual(
      ['46', '85', '140', '205', '217', '328', '335', '430', '198'],
    )
    const antall = within(matrise!).getByRole('rowheader', { name: 'Antall prøver' }).parentElement!
    expect(antall.querySelector('td:last-child')!.textContent).toBe('5 853')
    expect(within(prosjekt!).getAllByRole('cell').map((td) => td.textContent)).toEqual(['57', '639'])
    expect(screen.getByRole('heading', { name: 'Referanseområdeprosjektet 2005–2008, dose 50–1000 mg' })).toBeTruthy()
    // Kildene står i panelets referansefelt, ikke som tekst over tabellene.
    expect(screen.queryByText(/Jönsson|Diakonhjemmet/)).toBeNull()
    // Tabellen kan rulles sidelengs med tastaturet.
    expect(matrise!.closest('[role="region"]')!.getAttribute('tabindex')).toBe('0')
  })

  it('merker et tall kilden ikke har, i stedet for å la cellen stå tom', () => {
    const fil = PSYKOFARMAKA_FILER.find((f) => f.kode === 'AMTNORSUM')!
    const rader = doserader({ tabeller: [{ ...fil.serumkonsentrasjoner!.tabeller![0]!, median: [118, null, 260, 317, 412, 503, 594, 919, null] }] })
    render(<Serumtabell rader={rader} tittel="Serumkonsentrasjoner" />)
    const median = screen.getByRole('rowheader', { name: 'Median (nmol/L)' }).parentElement!
    expect(median.querySelectorAll('td')[1]!.textContent).toBe('—ikke oppgitt')
  })

  it('viser rader som ikke er persentiler med bare kolonnene som er i bruk', () => {
    const rader = PSYKOFARMAKA_FILER.find((f) => f.kode === 'HBUP')!.serumkonsentrasjoner!.rader!
    render(<Serumtabell rader={rader} tittel="Serumkonsentrasjoner" />)
    const kolonner = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(kolonner).toEqual(['Dose', 'Doseringsregime', 'Serumkonsentrasjon', 'Betingelser og merknader'])
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(
      rader.flatMap((r) => [r.dose, r.regime, r.konsentrasjon, r.merknad]),
    )
  })
})

function kvetiapinrader(): Doserad[] {
  return doserader(PSYKOFARMAKA_FILER.find((f) => f.kode === 'KVE')!.serumkonsentrasjoner!)
}

/* --- Ikonene -------------------------------------------------------------- */

describe('seksjonsikonene', () => {
  it('gir alle panelene unntatt identiteten et ikon fra registeret', () => {
    for (const { nokkel } of PANELER) {
      const ikon = seksjonsikon(nokkel)
      if (nokkel === 'identitet') expect(ikon).toBeUndefined()
      else expect(IKONNAVN, nokkel).toContain(ikon)
    }
    expect(seksjonsikon('fortolkning')).toBe('interp')
    expect(seksjonsikon('noe-nytt')).toBeUndefined()
  })

  it('står i sirkelen foran tittelen, som pynt, med tittelen som navn på knappen', () => {
    render(
      <Seksjon id="dosering" ikon="dose" tittel="Dosering" oppsummering="10–40 mg">
        <Detaljkort id="kort" ikon="elim" tittel="Eliminasjon">
          Tekst
        </Detaljkort>
      </Seksjon>,
    )
    const seksjon = document.getElementById('panel-dosering')!
    expect(seksjon.hasAttribute('data-ikon')).toBe(true)
    const ikon = seksjon.querySelector('.skuff__ikon svg')!
    expect(ikon.getAttribute('data-ikon')).toBe('dose')
    expect(ikon.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('button', { name: 'Dosering' })).toBeTruthy()
    expect(document.querySelector('#panel-dosering--kort .skuff__ikon svg')!.getAttribute('data-storrelse')).toBe('underpunkt')
  })

  it('lar en skuff uten ikon være uten', () => {
    render(
      <Seksjon id="x" tittel="X">
        Tekst
      </Seksjon>,
    )
    expect(document.getElementById('panel-x')!.hasAttribute('data-ikon')).toBe(false)
    expect(document.querySelector('#panel-x .skuff__ikon')).toBeNull()
  })
})

describe('ikonregisteret for farmakokinetikken', () => {
  it('kjenner alle overskriftene i datasettet, og bare «Annet» får det generiske', () => {
    const titler = new Set(PSYKOFARMAKA_FILER.flatMap((f) => (f.farmakokinetikk ?? []).map((k) => kinetikktittel(k.tittel))))
    const ikoner = Object.fromEntries([...titler].map((t) => [t, kinetikkikon(t)]))
    expect(ikoner).toEqual({
      Biotilgjengelighet: 'bio',
      tₘₐₓ: 'peak',
      't½': 'hl',
      tₛₛ: 'ss',
      Proteinbinding: 'protein',
      Vd: 'dist',
      Eliminasjon: 'elim',
      'CYP-enzymer (substrat)': 'metab',
      Interaksjoner: 'inter',
      Annet: 'fallback',
    })
  })

  it('leser fri tekst etter mening, og faller trygt tilbake', () => {
    expect(kinetikkikon('Absorpsjon')).toBe('absorp')
    // Hvert fast kort har sitt eget ikon, i alle seksjonene med faste kort.
    for (const panel of PANELER_MED_FASTE_KORT) {
      const ikoner = fasteKort(panelFor(panel)!)!.map(kinetikkikon)
      expect(ikoner, panel).not.toContain('fallback')
      expect(new Set(ikoner).size, panel).toBe(ikoner.length)
    }
    expect(fasteKort(panelFor('toksisitet_forgiftning')!)!.map(kinetikkikon)).toEqual([
      'toksiskDose',
      'tox',
      'forgiftningsbilde',
      'sev',
      'toksikokinetikk',
      'antidot',
    ])
    expect(fasteKort(panelFor('graviditet_amming')!)!.map(kinetikkikon)).toEqual(['foster', 'nyfodt', 'amming', 'fertilitet'])
    // «Amming» står ikke inne i et annet ord.
    expect(kinetikkikon('Stamming')).toBe('fallback')
    expect(kinetikkikon('Toleranseutvikling')).toBe('toleranse')
    expect(kinetikkikon('Abstinens, seponeringssyndrom og rebound-effekter')).toBe('abstinens')
    expect(kinetikkikon('Addiksjon')).toBe('vane')
    expect(kinetikkikon('Lært mestringsavhengighet')).toBe('krykke')
    expect(kinetikkikon('Misbrukspotensial')).toBe('misbruk')
    expect(kinetikkikon('  Distribusjonsvolum ')).toBe('dist')
    expect(kinetikkikon('Metabolisme')).toBe('metab')
    expect(kinetikkikon('Halveringstid')).toBe('hl')
    expect(kinetikkikon('tmax')).toBe('peak')
    expect(kinetikkikon('Tid til steady state')).toBe('ss')
    expect(kinetikkikon('Farmakogenetikk')).toBe('fallback')
    expect(kinetikkikon('')).toBe('fallback')
    expect(IKONNAVN).toContain('fallback')
  })
})

/* --- Doseringen ----------------------------------------------------------- */

describe('doseringskortene', () => {
  const kort = (tekst: Parameters<typeof tilDokument>[0]) => doseringskort(tilDokument(tekst))
  const vis = (k: ReturnType<typeof kort>) => k?.map(({ etikett, innhold }) => [etikett, klartekst({ type: 'doc', content: innhold })])

  it('deler «Etikett: verdi» uten å endre et ord', () => {
    expect(vis(kort(['Immediate release: (25) 50–800 mg', 'Extended release: 50–800 mg']))).toEqual([
      ['Immediate release', '(25) 50–800 mg'],
      ['Extended release', '50–800 mg'],
    ])
    expect(vis(kort(['10–40 mg']))).toEqual([[null, '10–40 mg']])
  })

  it('beholder lenker og formatering i verdien', () => {
    const [depot] = kort(['Depotinjeksjon: 400 mg, se [Abilify Maintena](https://www.felleskatalogen.no/x) for dosering'])!.slice(0)
    expect(depot!.etikett).toBe('Depotinjeksjon')
    expect(depot!.innhold.some((n) => n.marks?.some((m) => m.type === 'link'))).toBe(true)
    expect(klartekst({ type: 'doc', content: depot!.innhold }).replace(/\s+/g, ' ')).toBe('400 mg, se Abilify Maintena for dosering')
  })

  it('deler ikke når det som står foran kolonet, ikke er en etikett', () => {
    expect(vis(kort(['25–150 mg: for depressiv lidelse']))).toEqual([[null, '25–150 mg: for depressiv lidelse']])
    const lang = 'En lang innledning som ikke er en etikett i det hele tatt: 5 mg'
    expect(vis(kort([lang]))).toEqual([[null, lang]])
  })

  it('viser tekst med lister som vanlig tekst', () => {
    expect(kort(['Voksne:', { punkter: ['5 mg'] }])).toBeNull()
  })

  it('gjelder bare doseringen', () => {
    expect(tekstvisning('dosering')).toBe('dosering')
    expect(tekstvisning('farmakodynamikk')).toBe('lesing')
    expect(tekstvisning('indikasjon')).toBe('lesing')
  })
})
