/**
 * Dekningsoversikten for ClinPGx: hver publiserte stoffside står her nøyaktig
 * én gang, med én status og grunnen til den (`docs/clinpgx.md`). Testene
 * kontrollerer at listen er lik sidene migrasjonene lager, så en ny stoffside
 * ikke kan komme inn uten at ClinPGx-statusen blir tatt stilling til.
 *
 * Sidene som er koblet, kommer fra importene i `clinpgxkoblinger.ts`; resten
 * står i {@link UKOBLEDE_STOFFSIDER}. En kobling krever navnet og minst ett
 * uavhengig kjennetegn til; en metabolitt kobles aldri automatisk til
 * moderstoffet.
 *
 * Modulen brukes av testene og dokumentasjonen, ikke av appen.
 */
import { CLINPGXKOBLINGSIMPORTER, koblingsgrunnlagstekst } from './clinpgxkoblinger'


/**
 * Noen ClinPGx-koblinger ble importert før fagsiden fikk sitt kanoniske
 * virkestoffnavn. Migrasjonsgrunnlaget beholder det historiske navnet, mens
 * dekningsoversikten bruker navnet siden har i dagens stoffregister.
 */
const KANONISKE_KOBLINGSSIDENAVN: Readonly<Record<string, string>> = {
  'Paliperidon (hydroksyrisperidon)': 'Paliperidon',
}

export function gjeldendeClinpgxside(navn: string): string {
  return KANONISKE_KOBLINGSSIDENAVN[navn] ?? navn
}

/** Statusene en side kan ha, med teksten oversikten bruker. */
export const DEKNINGSSTATUSER = {
  koblet: 'Koblet til ClinPGx og verifisert',
  krever_kuratering: 'Relevant objekt finnes i ClinPGx, men krever kuratert kobling',
  ikke_i_clinpgx: 'ClinPGx har ikke relevant objekt',
  metabolitt: 'Metabolitt eller analytisk komponent, kobles ikke automatisk til moderstoffet',
  uavklart: 'Uavklart, krever faglig vurdering',
} as const

export type Dekningsstatus = keyof typeof DEKNINGSSTATUSER

/** Et kjemikalie i ClinPGx: accession-ID-en og navnet ClinPGx gir det. */
export interface ClinpgxObjekt {
  clinpgx_id: string
  navn: string
}

interface Felles {
  /** Navnet på stoffsiden. */
  side: string
  grunn: string
}

export interface KobletSide extends Felles {
  status: 'koblet'
  kjemikalier: ClinpgxObjekt[]
  /** Importen (migrasjonen) koblingen kommer fra. */
  migrasjon: string
}

export type UkobletSide = Felles &
  (
    | { status: 'krever_kuratering'; kandidater: ClinpgxObjekt[] }
    | { status: 'ikke_i_clinpgx'; sokt: string[] }
    | {
        status: 'metabolitt'
        /** Moderstoffet i ClinPGx, og OUSFARs side for det når den finnes. */
        moderstoff: ClinpgxObjekt & { side: string | null }
        /** Kjemikaliene ClinPGx har for metabolitten selv, om noen. */
        egne: ClinpgxObjekt[]
      }
    | { status: 'uavklart' }
  )

export type Dekning = KobletSide | UkobletSide

/**
 * Stoffsidene som ikke er koblet, med grunnen. Kontrollert mot ClinPGx
 * 26. september 2026, også hvilke annotasjoner metabolittene har.
 */
export const UKOBLEDE_STOFFSIDER: readonly UkobletSide[] = [
  {
    side: 'Dehydroaripiprazol',
    status: 'metabolitt',
    moderstoff: { side: 'Aripiprazol', clinpgx_id: 'PA10026', navn: 'aripiprazole' },
    egne: [{ clinpgx_id: 'PA166170895', navn: 'dehydroaripiprazole' }],
    grunn: 'Aktiv metabolitt av aripiprazol. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner.',
  },
  {
    side: 'Desmetyldoksepin',
    status: 'metabolitt',
    moderstoff: { side: 'Doksepin', clinpgx_id: 'PA449409', navn: 'doxepin' },
    egne: [{ clinpgx_id: 'PA166131337', navn: 'desmethyldoxepin' }],
    grunn: 'Aktiv metabolitt av doksepin. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner.',
  },
  {
    side: 'Desmetylkariprazin',
    status: 'metabolitt',
    moderstoff: { side: 'Kariprazin', clinpgx_id: 'PA166177476', navn: 'cariprazine' },
    egne: [{ clinpgx_id: 'PA166356841', navn: 'desmethyl cariprazine' }],
    grunn: 'Aktiv metabolitt av kariprazin. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner.',
  },
  {
    side: 'Desmetylklomipramin',
    status: 'metabolitt',
    moderstoff: { side: 'Klomipramin', clinpgx_id: 'PA449048', navn: 'clomipramine' },
    egne: [{ clinpgx_id: 'PA166131507', navn: 'desmethyl clomipramine' }],
    grunn: 'Aktiv metabolitt av klomipramin. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner.',
  },
  {
    side: 'Desmetylmianserin',
    status: 'metabolitt',
    moderstoff: { side: 'Mianserin', clinpgx_id: 'PA134687937', navn: 'mianserin' },
    egne: [],
    grunn: 'Metabolitt av mianserin. ClinPGx har ikke metabolitten som eget kjemikalie.',
  },
  {
    side: 'Didesmetylkariprazin',
    status: 'metabolitt',
    moderstoff: { side: 'Kariprazin', clinpgx_id: 'PA166177476', navn: 'cariprazine' },
    egne: [{ clinpgx_id: 'PA166356881', navn: 'didesmethyl cariprazine' }],
    grunn: 'Aktiv metabolitt av kariprazin. ClinPGx har metabolitten som eget kjemikalie, uten annotasjoner.',
  },
  {
    side: 'Bupropion',
    status: 'krever_kuratering',
    kandidater: [{ clinpgx_id: 'PA448687', navn: 'bupropion' }],
    grunn:
      'Fagsiden gjelder virkestoffet bupropion; laboratoriet måler metabolitten hydroksybupropion (HBUP). ClinPGx har bupropion som eget kjemikalie; koblingen er ikke lagt inn ennå. Metabolitten har to egne kjemikalier i ClinPGx (PA166226561, PA166170175), begge uten annotasjoner.',
  },
  {
    side: 'Norfluoksetin',
    status: 'metabolitt',
    moderstoff: { side: 'Fluoksetin', clinpgx_id: 'PA449673', navn: 'fluoxetine' },
    egne: [
      { clinpgx_id: 'PA166131377', navn: 'r-norfluoxetine' },
      { clinpgx_id: 'PA166131313', navn: 's-norfluoxetine' },
    ],
    grunn: 'Aktiv metabolitt av fluoksetin. ClinPGx har bare de to enantiomerene hver for seg, uten annotasjoner.',
  },
  {
    side: 'O-desmetyltramadol',
    status: 'metabolitt',
    moderstoff: { side: 'Tramadol', clinpgx_id: 'PA451735', navn: 'tramadol' },
    egne: [{ clinpgx_id: 'PA166131379', navn: 'o-desmethyltramadol' }],
    grunn:
      'Aktiv metabolitt av tramadol. ClinPGx har metabolitten som eget kjemikalie med kliniske annotasjoner; om siden skal vise dem, tramadols data eller begge, er en faglig vurdering.',
  },
  {
    side: 'THC',
    status: 'krever_kuratering',
    kandidater: [{ clinpgx_id: 'PA449421', navn: 'dronabinol' }],
    grunn:
      'Siden ble laget 27. september 2026 for å vise Sativex fra FEST. ClinPGx har THC som dronabinol (kontrollert samme dag); koblingen er ikke lagt inn ennå.',
  },
  {
    side: 'Cannabidiol',
    status: 'krever_kuratering',
    kandidater: [{ clinpgx_id: 'PA166175791', navn: 'cannabidiol' }],
    grunn:
      'Siden ble laget 27. september 2026 for å vise Epidyolex fra FEST. ClinPGx har cannabidiol (kontrollert samme dag); koblingen er ikke lagt inn ennå.',
  },
  {
    side: 'Tapentadol',
    status: 'krever_kuratering',
    kandidater: [{ clinpgx_id: 'PA166179720', navn: 'tapentadol' }],
    grunn:
      'Siden ble laget 28. september 2026 med indikasjonen og preparatene fra FEST. ClinPGx har tapentadol (kontrollert samme dag); koblingen er ikke lagt inn ennå.',
  },
]

/** Hver publiserte stoffside med status, sortert etter navnet. */
export function clinpgxdekning(): Dekning[] {
  const koblet = new Map<string, KobletSide>()
  for (const { migrasjon, koblinger } of CLINPGXKOBLINGSIMPORTER) {
    for (const k of koblinger) {
      const sidenavn = gjeldendeClinpgxside(k.side)
      const side = koblet.get(sidenavn) ?? { side: sidenavn, status: 'koblet', kjemikalier: [], grunn: '', migrasjon }
      side.kjemikalier.push({ clinpgx_id: k.clinpgx_id, navn: k.navn })
      side.grunn = [side.grunn, `${k.navn}: ${koblingsgrunnlagstekst(k)}`].filter(Boolean).join(' ')
      koblet.set(sidenavn, side)
    }
  }
  return [...koblet.values(), ...UKOBLEDE_STOFFSIDER].sort((a, b) => a.side.localeCompare(b.side, 'nb'))
}

/** Hvor mange sider som har hver status. */
export function dekningstelling(dekning: readonly Dekning[] = clinpgxdekning()): Record<Dekningsstatus, number> {
  const telling = Object.fromEntries(Object.keys(DEKNINGSSTATUSER).map((s) => [s, 0])) as Record<Dekningsstatus, number>
  for (const d of dekning) telling[d.status] += 1
  return telling
}

const objekter = (liste: readonly ClinpgxObjekt[]) => liste.map((o) => `${o.navn} (${o.clinpgx_id})`).join(', ') || '–'

/** ClinPGx-objektene og det som står om dem, for en side som ikke er koblet. */
function detaljer(d: UkobletSide): string {
  switch (d.status) {
    case 'krever_kuratering':
      return `Kandidater: ${objekter(d.kandidater)}`
    case 'ikke_i_clinpgx':
      return `Søkt etter: ${d.sokt.join(', ')}`
    case 'metabolitt':
      return `Moderstoff: ${objekter([d.moderstoff])}, side: ${d.moderstoff.side ?? 'ingen'}. Metabolitten selv: ${objekter(d.egne)}`
    case 'uavklart':
      return '–'
  }
}

const rad = (celler: readonly string[]) => `| ${celler.join(' | ')} |`
const tabell = (hode: readonly string[], rader: readonly (readonly string[])[]) =>
  [rad(hode), rad(hode.map(() => '---')), ...rader.map(rad)].join('\n')

/**
 * Oversikten som Markdown: tellingen per status, koblingene med grunnlaget,
 * og sidene som ikke er koblet. Den står i `docs/clinpgx.md`, og testene
 * kontrollerer at den er lik listene.
 */
export function clinpgxdekningsoversikt(): string {
  const dekning = clinpgxdekning()
  const telling = dekningstelling(dekning)
  const statuser = Object.keys(DEKNINGSSTATUSER) as Dekningsstatus[]
  const oppsummering = tabell(
    ['Status', 'Sider'],
    [...statuser.map((s) => [DEKNINGSSTATUSER[s], String(telling[s])]), ['Til sammen', String(dekning.length)]],
  )
  const koblinger = CLINPGXKOBLINGSIMPORTER.flatMap(({ migrasjon, koblinger }) =>
    koblinger.map((k) => ({ ...k, side: gjeldendeClinpgxside(k.side), migrasjon })),
  )
  const koblet = tabell(
    ['Stoffside', 'FEST-virkestoff', 'Siden koblet til FEST', 'ClinPGx-navn', 'ClinPGx-ID', 'Grunnlag', 'Migrasjon'],
    koblinger.map((k) => [
      k.side,
      `${k.virkestoff} (${k.engelsk})`,
      k.fest_id ? 'ja' : 'nei',
      k.navn,
      k.clinpgx_id,
      koblingsgrunnlagstekst(k),
      k.migrasjon,
    ]),
  )
  const ukoblet = tabell(
    ['Stoffside', 'Status', 'ClinPGx', 'Grunn'],
    dekning.filter((d): d is UkobletSide => d.status !== 'koblet').map((d) => [d.side, DEKNINGSSTATUSER[d.status], detaljer(d), d.grunn]),
  )
  return `${oppsummering}\n\nKoblet:\n\n${koblet}\n\nIkke koblet:\n\n${ukoblet}`
}
