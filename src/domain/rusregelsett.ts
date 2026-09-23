import { rusDatasett, type RusRad } from './rus'
import type { Kommentaroppslag } from './kommentarobjekt'
import type { Scenario, Scenarioplassering, Scenarioregelsett } from './scenario'

/**
 * Dagens rusmiddelregler, skrevet som scenarioregelsett.
 *
 * Dette er importgrunnlaget for arbeidspakke 6: reglene i `rus.ts` oversatt
 * til scenarier, og kommentartekstene fra `rusmidler.json` som egne
 * kommentarobjekter som scenariene peker på. Paritetstestene kjører dem mot dagens motor over alle
 * kombinasjoner av påviste analytter og konsentrasjoner på og rundt
 * grensene, og det er disse regelsettene og kommentarene som legges inn i
 * Supabase.
 *
 * Filen er migreringskode. Den fjernes sammen med `rusmidler.json` når
 * fortolkningen leser regelsettene fra Supabase og paritetstestene står på
 * de importerte dataene.
 */

/** Kommentar-ID-en for en tekst i datasettet: `rad/nøkkel`. */
export function kommentarId(radId: string, nokkel = 'hoved'): string {
  return `${radId}/${nokkel}`
}

/** Alle kommentartekstene i datasettet, etter ID: kommentarobjektene scenariene peker på. */
export const RUS_KOMMENTARER: Kommentaroppslag = new Map(
  rusDatasett.rader.flatMap((r) => Object.entries(r.tekster).map(([n, t]) => [kommentarId(r.id, n), t])),
)

function rad(id: string): RusRad {
  const funnet = rusDatasett.rader.find((r) => r.id === id)
  if (!funnet) throw new Error(`ukjent rad i rusmidler.json: ${id}`)
  return funnet
}

function hoved(radId: string, koder: string[], { nokkel = 'hoved', merke = 'Hovedkommentar' } = {}): Scenarioplassering {
  return { rolle: 'hoved', merke, kommentar: kommentarId(radId, nokkel), koder }
}

function tillegg(radId: string, koder: string[], { nokkel = 'tillegg', merke = 'Tilleggskommentar' } = {}): Scenarioplassering {
  return { rolle: 'tillegg', merke, kommentar: kommentarId(radId, nokkel), koder }
}

/** Et scenario med kommentarer og uten forholdstall. */
function kommentarer(nokkel: string, pavist: string[], plasseringer: Scenarioplassering[], notiser: string[] = []): Scenario {
  return { nokkel, pavist, vilkar: [], utfall: { type: 'kommentarer', plasseringer, notiser } }
}

/** En modul for én analytt: ett scenario, én kommentar. */
function enkelt(radId: string): Scenarioregelsett {
  const kilde = rad(radId)
  const kode = kilde.koder[0]
  if (kode === undefined) throw new Error(`raden ${radId} mangler analyttkode`)
  return {
    modul: radId,
    analytter: [kode],
    verdihjelp: '',
    forhold: [],
    parametere: [],
    scenarier: [kommentarer('pavist', [kode], [hoved(radId, [kode])], Object.values(kilde.merknader))],
  }
}

/* --- Diazepam, N-desmetyldiazepam og oksazepam --------------------------- */

const OXA_FOR_SEG = hoved('oksazepam', ['OXA'], { merke: 'Hovedkommentar for oksazepam' })
const TO_AV_TRE =
  'Fellesskommentaren gjelder når diazepam, desmetyldiazepam og oksazepam alle er påvist. ' +
  'Her er bare to av dem påvist, og de kommenteres hver for seg.'

const diazepamgruppen: Scenarioregelsett = {
  modul: 'diazepamgruppen',
  analytter: ['DIAZ', 'DMI', 'OXA'],
  verdihjelp:
    'Alle tre får den felles kommentaren bare når oksazepam utgjør høyst {oksazepamgrense} % av summen av ' +
    'diazepam og desmetyldiazepam.',
  forhold: [
    {
      nokkel: 'oksazepamandel',
      teller: ['OXA'],
      nevner: ['DIAZ', 'DMI'],
      nullmelding:
        'Summen av diazepam og desmetyldiazepam må være større enn 0 for at {oksazepamgrense} %-regelen skal kunne regnes ut.',
    },
  ],
  parametere: [
    { nokkel: 'oksazepamgrense', navn: 'Oksazepam som andel av diazepam + N-desmetyldiazepam', verdi: 0.1 },
  ],
  scenarier: [
    kommentarer('diaz', ['DIAZ'], [hoved('diazepam', ['DIAZ'])]),
    kommentarer('dmi', ['DMI'], [hoved('desmetyldiazepam', ['DMI'])]),
    kommentarer('oxa', ['OXA'], [hoved('oksazepam', ['OXA'])]),
    kommentarer('diaz_dmi', ['DIAZ', 'DMI'], [hoved('diazepam', ['DIAZ']), tillegg('desmetyldiazepam', ['DMI'])]),
    kommentarer('diaz_oxa', ['DIAZ', 'OXA'], [hoved('diazepam', ['DIAZ']), OXA_FOR_SEG], [TO_AV_TRE]),
    kommentarer('dmi_oxa', ['DMI', 'OXA'], [hoved('desmetyldiazepam', ['DMI']), OXA_FOR_SEG], [TO_AV_TRE]),
    {
      nokkel: 'alle_felles',
      pavist: ['DIAZ', 'DMI', 'OXA'],
      vilkar: [{ forhold: 'oksazepamandel', operator: '<=', parameter: 'oksazepamgrense' }],
      utfall: {
        type: 'kommentarer',
        plasseringer: [hoved('diazepamgruppen-samlet', ['DIAZ']), tillegg('diazepamgruppen-samlet', ['DMI', 'OXA'])],
        notiser: ['Oksazepam ≤ {oksazepamgrense} % av diazepam + N-desmetyldiazepam\n⟶ Felles kommentar for alle tre.'],
      },
    },
    {
      nokkel: 'alle_hver_for_seg',
      pavist: ['DIAZ', 'DMI', 'OXA'],
      vilkar: [{ forhold: 'oksazepamandel', operator: '>', parameter: 'oksazepamgrense' }],
      utfall: {
        type: 'kommentarer',
        plasseringer: [hoved('diazepam', ['DIAZ']), tillegg('desmetyldiazepam', ['DMI']), OXA_FOR_SEG],
        notiser: ['Oksazepam > {oksazepamgrense} % av diazepam + N-desmetyldiazepam\n⟶ Oksazepam kommenteres for seg selv.'],
      },
    },
  ],
}

/* --- Tramadol og O-desmetyltramadol -------------------------------------- */

const tramadolgruppen: Scenarioregelsett = {
  modul: 'tramadolgruppen',
  analytter: ['TRAM', 'OTRAM'],
  verdihjelp: '',
  forhold: [],
  parametere: [],
  scenarier: [
    kommentarer('tram', ['TRAM'], [hoved('tramadolgruppen', ['TRAM'])]),
    kommentarer('otram', ['OTRAM'], [hoved('tramadolgruppen', ['OTRAM'])]),
    kommentarer('begge', ['TRAM', 'OTRAM'], [hoved('tramadolgruppen', ['TRAM']), tillegg('tramadolgruppen', ['OTRAM'])]),
  ],
}

/* --- Kodein og morfin ---------------------------------------------------- */

const grasone = rad('kodein-morfin-grasone').merknader

const kodeingruppen: Scenarioregelsett = {
  modul: 'kodeingruppen',
  analytter: ['KOD', 'MOR'],
  verdihjelp: '',
  forhold: [
    {
      nokkel: 'morfinandel',
      teller: ['MOR'],
      nevner: ['KOD'],
      nullmelding: 'Kodein må være større enn 0 for at forholdet mellom stoffene skal kunne regnes ut.',
    },
  ],
  parametere: [
    { nokkel: 'lav_morfin', navn: 'Morfin som andel av kodein, nedre grense for gråsonen', verdi: 0.2 },
    { nokkel: 'hoy_morfin', navn: 'Morfin som andel av kodein, øvre grense for gråsonen', verdi: 1 },
  ],
  scenarier: [
    kommentarer('kod', ['KOD'], [hoved('kun-kodein', ['KOD'], { nokkel: 'kodein' })]),
    kommentarer('mor', ['MOR'], [hoved('kun-morfin', ['MOR'], { nokkel: 'morfin' })]),
    {
      nokkel: 'hoy_kodein_lav_morfin',
      pavist: ['KOD', 'MOR'],
      vilkar: [{ forhold: 'morfinandel', operator: '<', parameter: 'lav_morfin' }],
      utfall: {
        type: 'kommentarer',
        plasseringer: [
          hoved('hoy-kodein-lav-morfin', ['KOD'], { nokkel: 'kodein' }),
          tillegg('hoy-kodein-lav-morfin', ['MOR'], { nokkel: 'morfin' }),
        ],
        notiser: ['Morfin < {lav_morfin} % av kodein ⟶ Forenlig med inntak av kodein alene.'],
      },
    },
    {
      nokkel: 'grasone',
      pavist: ['KOD', 'MOR'],
      vilkar: [
        { forhold: 'morfinandel', operator: '>=', parameter: 'lav_morfin' },
        { forhold: 'morfinandel', operator: '<=', parameter: 'hoy_morfin' },
      ],
      utfall: {
        type: 'manuell',
        melding: 'Morfin = {lav_morfin}–{hoy_morfin} % av kodein. Vurder manuelt.',
        veiledning: [grasone.kodein, grasone.morfin].filter((t): t is string => Boolean(t)),
      },
    },
    {
      nokkel: 'ordinaer_kombinasjon',
      pavist: ['KOD', 'MOR'],
      vilkar: [{ forhold: 'morfinandel', operator: '>', parameter: 'hoy_morfin' }],
      utfall: {
        type: 'kommentarer',
        plasseringer: [
          hoved('kodein-morfin-ordinaer', ['KOD'], { nokkel: 'kodein', merke: 'Hovedkommentar for kodein' }),
          hoved('kodein-morfin-ordinaer', ['MOR'], { nokkel: 'morfin', merke: 'Hovedkommentar for morfin' }),
        ],
        notiser: ['Morfin > kodein ⟶ Ikke forenlig med inntak av kodein alene.'],
      },
    },
  ],
}

/* --- Amfetamin og metamfetamin ------------------------------------------- */

const amfetamingruppen: Scenarioregelsett = {
  modul: 'amfetamingruppen',
  analytter: ['AMF1', 'MAF1'],
  verdihjelp: '',
  forhold: [],
  parametere: [],
  scenarier: [
    kommentarer('amf', ['AMF1'], [hoved('amfetamin', ['AMF1'])]),
    kommentarer('maf', ['MAF1'], [hoved('metamfetamin', ['MAF1'])]),
    kommentarer('begge', ['AMF1', 'MAF1'], [
      hoved('amfetamingruppen-samlet', ['MAF1']),
      tillegg('amfetamingruppen-samlet', ['AMF1']),
    ]),
  ],
}

/** Regelsettene, i samme rekkefølge som `RUS_MODULER`. */
export const RUS_REGELSETT: Scenarioregelsett[] = [
  enkelt('alprazolam'),
  diazepamgruppen,
  enkelt('klonazepam'),
  enkelt('nitrazepam'),
  enkelt('zolpidem'),
  enkelt('zopiklon'),
  enkelt('thc'),
  enkelt('buprenorfin'),
  enkelt('fentanyl'),
  kodeingruppen,
  enkelt('metadon'),
  enkelt('oksykodon'),
  enkelt('tapentadol'),
  tramadolgruppen,
  amfetamingruppen,
  enkelt('benzoylekgonin'),
  enkelt('mdma'),
]
