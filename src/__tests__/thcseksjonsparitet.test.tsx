// @vitest-environment jsdom
/**
 * Paritet for arbeidspakke 13: THC-syrereglene vises, prøves og redigeres i
 * seksjonsarkitekturen (`Thcregler` på redigeringssiden for fortolkningen),
 * med de samme delene som konsentrasjonsreglene og scenarioreglene. Flyttingen
 * gjelder visningen og redigeringen; motoren, kontrollen, datamodellen og den
 * kliniske outputen er de samme. Testene her sier det eksplisitt:
 *
 * - «Før» er fasiten fra den opprinnelige modulen (`thc-fasit.json`, over 4000
 *   tilfeller) og fortolkningsmodulen slik den henter reglene
 *   (`thcReglerFra`). «Etter» er modellen seksjonen viser og simulerer med
 *   (`tilThcModell`), og modellen redigeringen simulerer med når ingenting er
 *   endret (`thcUtkastFra` → `lagThcModell`).
 * - Alle tre er den samme modellen, og gir fasiten i hvert eneste tilfelle,
 *   med de samme tallene og figurene helt ned til siste siffer.
 * - På skjermen gir fortolkningsmodulen, simulatoren i seksjonen og simulatoren
 *   i redigeringen den samme kommentaren, det samme varselet og de samme
 *   manglene som fasiten, for ett tilfelle av hvert utfall fasiten har.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import fasitfil from '../domain/__tests__/fasit/thc-fasit.json'
import {
  avvikFraFasit,
  dekodInndata,
  tallavtrykk,
  type Fasit,
  type FasitInndata,
  type FasitUtfall,
} from '../domain/__tests__/hjelp/thcFasit'
import { Thcregler } from '../components/regler/Thcregler'
import { ThcStep } from '../components/ThcStep'
import { TipsLag } from '../components/Tips'
import { renskTall } from '../domain/tallfelt'
import { fortolkThc, lagThcModell, type ThcInndata, type ThcModell, type ThcResultat } from '../domain/thcMotor'
import { byggGraf, figurkurver } from '../domain/thcPlot'
import { thcReglerFra, thcUtkastFra, tilThcModell } from '../faginnhold/thcregler'
import { ShortcutVisibilityProvider } from '../hooks/useShortcutVisibility'
import { THC_MODELL, thcRegelsettutgave } from './hjelp/thcgrunnlag'

const FASIT = fasitfil as Fasit

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
  window.scrollBy = () => {}
})

afterEach(cleanup)

/* --- Modellene før og etter ------------------------------------------------- */

const UTGAVE = thcRegelsettutgave()

/** Modellen fortolkningsmodulen bruker: de publiserte reglene, hentet som i appen. */
function modulmodell(): ThcModell {
  const regler = thcReglerFra({ status: 'klar', data: UTGAVE }, () => {})
  if (regler.status !== 'klar') throw new Error('Modulen skal kunne bruke reglene.')
  return regler.modell
}

/** Modellen seksjonen viser reglene og simulerer med. */
function seksjonsmodell(): ThcModell {
  const m = tilThcModell(UTGAVE)
  if (!m.ok) throw new Error(m.feil.join('\n'))
  return m.modell
}

/** Modellen simulatoren i redigeringen bruker når ingenting er endret. */
function redigeringsmodell(): ThcModell {
  const utkast = thcUtkastFra(UTGAVE)
  if (!utkast) throw new Error('Utkastet skal kunne redigeres.')
  const m = lagThcModell(utkast.regler, utkast.tekster)
  if (!m.ok) throw new Error(m.feil.join('\n'))
  return m.modell
}

function somFasitutfall(r: ThcResultat): FasitUtfall {
  if (r.type === 'mangler') return r
  return {
    type: 'kommentar',
    kommentar: r.kommentar,
    konklusjon: r.konklusjon,
    langtMellomProvene: r.langtMellomProvene,
    grunnlag: r.grunnlag,
  }
}

describe('THC-syre før og etter flyttingen til seksjonsarkitekturen', () => {
  const modeller = { seksjonen: seksjonsmodell(), redigeringen: redigeringsmodell() }

  it('bruker nøyaktig den samme modellen som fortolkningsmodulen og fasiten', () => {
    const modul = modulmodell()
    expect(modul).toStrictEqual(THC_MODELL)
    for (const [hvor, m] of Object.entries(modeller)) expect(m, hvor).toStrictEqual(modul)
  })

  for (const [hvor, m] of Object.entries(modeller)) {
    it(`gir fasiten i hvert eneste tilfelle med modellen ${hvor} bruker`, () => {
      const utfall = FASIT.tilfeller.map(([inn]) => somFasitutfall(fortolkThc(dekodInndata(inn) as ThcInndata, m)))
      expect(utfall.length).toBeGreaterThan(4000)
      const avvik = utfall.flatMap((u, i) => {
        const a = avvikFraFasit(FASIT, i, u)
        return a === null ? [] : [`${JSON.stringify(FASIT.tilfeller[i]![0])}: ${a}`]
      })
      expect(avvik.slice(0, 5)).toEqual([])
      // Tallgrunnlaget og figurene, helt ned til siste siffer.
      const figur = figurkurver(m.regler)
      expect(tallavtrykk(utfall, (g) => byggGraf(g, figur))).toBe(FASIT.tallgrunnlag)
    })
  }
})

/* --- På skjermen ------------------------------------------------------------ */

const DATO = /^\d{4}-\d{2}-\d{2}$/

/** Inndata som kan fylles inn i skjemaet slik de står: tall feltet slipper inn, og gyldige datoer. */
function kanTastes(inn: FasitInndata): boolean {
  const tall = [inn.aktuellVerdi, inn.forrigeVerdi, inn.forrigeUcak, inn.forrigeNkre]
  const datoer = [inn.aktuellDato, inn.forrigeDato]
  return tall.every((t) => renskTall(t) === t) && datoer.every((d) => d === '' || DATO.test(d))
}

/**
 * Ett tilfelle av hvert utfall i fasiten — hver kommentar med og uten varsel,
 * og hver kombinasjon av mangler — som kan tastes inn, med alle tre
 * sikkerhetsmarginene representert.
 */
function utvalg(): { inn: FasitInndata; indeks: number }[] {
  const sett = new Map<string, { inn: FasitInndata; indeks: number }>()
  FASIT.tilfeller.forEach(([kodet, utfall], indeks) => {
    const inn = dekodInndata(kodet)
    const nokkel = JSON.stringify(utfall)
    if (!sett.has(nokkel) && kanTastes(inn)) sett.set(nokkel, { inn, indeks })
  })
  return [...sett.values()]
}

const UTVALG = utvalg()

// Feltene finnes med ledeteksten, ikke med rollen: det er det samme feltet,
// og hundrevis av rolleoppslag gjør testen treg.

/** Huker av eller fjerner haken i en avkryssing, så den står som ønsket. */
function settAvkryssing(rot: HTMLElement, navn: string, onsket: boolean) {
  const boks = within(rot).getByLabelText<HTMLInputElement>(navn)
  expect(boks.type).toBe('checkbox')
  if (boks.checked !== onsket) fireEvent.click(boks)
}

/** Feltgruppen med overskriften `navn` («Forrige prøve», «Denne prøven»). */
function feltgruppe(rot: HTMLElement, navn: string): HTMLElement {
  const gruppe = [...rot.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent === navn)
  if (!gruppe) throw new Error(`Fant ikke «${navn}».`)
  return gruppe
}

function settFelt(rot: HTMLElement, gruppe: string, navn: string, verdi: string) {
  const felt = within(feltgruppe(rot, gruppe)).getByLabelText<HTMLInputElement>(navn)
  if (felt.value !== verdi) fireEvent.change(felt, { target: { value: verdi } })
  expect(felt.value, `${gruppe}: ${navn}`).toBe(verdi)
}

/**
 * Fyller inn skjemaet (`ThcSkjema`, det samme i modulen og simulatorene) slik
 * at det står nøyaktig på inndataene, også feltene som er skjult av
 * avkryssingene: de fylles inn før avkryssingene settes.
 */
function fyllInn(rot: HTMLElement, inn: FasitInndata, marginer: readonly number[]) {
  settAvkryssing(rot, 'Ingen tidligere prøve tilgjengelig', false)
  // Feltene for den som ikke gjelder, først, så det som gjelder, står til slutt.
  const ircak = () => settFelt(rot, 'Forrige prøve', 'IRCAK', inn.forrigeVerdi)
  const underCutoff = () => {
    settFelt(rot, 'Forrige prøve', 'UCAK (THC-syre)', inn.forrigeUcak)
    settFelt(rot, 'Forrige prøve', 'NKRE (kreatinin)', inn.forrigeNkre)
  }
  for (const under of inn.forrigeUnderCutoff ? [false, true] : [true, false]) {
    settAvkryssing(rot, 'Under cut-off', under)
    if (under) underCutoff()
    else ircak()
  }
  settFelt(rot, 'Forrige prøve', 'Prøvedato', inn.forrigeDato)
  settFelt(rot, 'Denne prøven', 'IRCAK', inn.aktuellVerdi)
  settFelt(rot, 'Denne prøven', 'Prøvedato', inn.aktuellDato)
  settAvkryssing(rot, 'Legg kronisk bruk til grunn', inn.kronisk)
  const trinn = String(marginer.indexOf(inn.sikkerhetsmargin))
  const bryter = rot.querySelector<HTMLInputElement>('.trinnbryter__felt')!
  if (bryter.value !== trinn) fireEvent.change(bryter, { target: { value: trinn } })
  expect(bryter.value, `margin ${inn.sikkerhetsmargin}`).toBe(trinn)
  settAvkryssing(rot, 'Ingen tidligere prøve tilgjengelig', inn.ingenTidligere)
}

/** Det skjermen viser: kommentaren og varselet, eller manglene. */
function vist(rot: HTMLElement): unknown {
  const mangler = [...rot.querySelectorAll('.mangelliste li')].map((li) => li.textContent)
  if (mangler.length > 0) return { mangler }
  return {
    kommentar: rot.querySelector('.kommentartekst')?.textContent ?? null,
    varsel: rot.querySelector('.notis--handling') !== null,
  }
}

/** Det fasiten sier at skjermen skal vise for tilfellet. */
function forventet(indeks: number): unknown {
  const [, utfall] = FASIT.tilfeller[indeks]!
  if (utfall[0] === 'm') return { mangler: utfall[1] }
  const [, nr, langt] = utfall as [string, number, number]
  return { kommentar: FASIT.kommentarer[nr], varsel: langt === 1 }
}

const MARGINER = THC_MODELL.regler.sikkerhetsmarginer.map((m) => m.margin)

/** Kjører utvalget gjennom skjemaet i `rot` og gir avvikene fra fasiten. */
function avvikPaaSkjermen(rot: () => HTMLElement): string[] {
  return UTVALG.flatMap(({ inn, indeks }) => {
    fyllInn(rot(), inn, MARGINER)
    const faktisk = vist(rot())
    const ventet = forventet(indeks)
    return JSON.stringify(faktisk) === JSON.stringify(ventet)
      ? []
      : [`${JSON.stringify(inn)}:\n${JSON.stringify(faktisk)}\nventet:\n${JSON.stringify(ventet)}`]
  })
}

describe('THC-syre på skjermen før og etter flyttingen', () => {
  it('har et utvalg med hvert utfall og hver margin i fasiten', () => {
    const utfall = new Set(FASIT.tilfeller.map(([, u]) => JSON.stringify(u)))
    // Utfallene som bare finnes med tall feltet ikke slipper inn, prøves i motoren over.
    expect(UTVALG.length).toBeGreaterThan(utfall.size - 5)
    expect(new Set(UTVALG.map(({ inn }) => inn.sikkerhetsmargin))).toEqual(new Set(MARGINER))
    expect(new Set(UTVALG.map(({ indeks }) => FASIT.tilfeller[indeks]![1][0]))).toEqual(
      new Set(['m', 'uten_forrige', 'ikke_nodvendigvis', 'vanskelig', 'nytt_inntak']),
    )
  })

  it('viser fasiten i fortolkningsmodulen', () => {
    render(
      <TipsLag>
        <ShortcutVisibilityProvider>
          <ThcStep regler={{ status: 'klar', modell: modulmodell() }} onBack={vi.fn()} copy={vi.fn()} flashAt={vi.fn()} />
        </ShortcutVisibilityProvider>
      </TipsLag>,
    )
    const modul = () => screen.getByRole('region', { name: 'Fortolk THC-syre i urin' })
    expect(avvikPaaSkjermen(modul).slice(0, 3)).toEqual([])
  }, 60_000)

  it('viser den samme kommentaren i simulatoren i seksjonen', () => {
    render(
      <TipsLag>
        <Thcregler utgave={UTGAVE} redigerer={false} />
      </TipsLag>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fortolkningsregler' }))
    fireEvent.click(screen.getByRole('button', { name: 'Prøv reglene' }))
    const simulator = () => document.querySelector<HTMLElement>('.simulator')!
    expect(avvikPaaSkjermen(simulator).slice(0, 3)).toEqual([])
  }, 60_000)

  it('viser den samme kommentaren i simulatoren i redigeringen, når ingenting er endret', () => {
    render(
      <TipsLag>
        <Thcregler
          utgave={UTGAVE}
          publisert={UTGAVE}
          redigerer
          onLagre={vi.fn(async () => {})}
          hentNyeste={vi.fn(async () => UTGAVE)}
        />
      </TipsLag>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fortolkningsregler' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rediger reglene' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Fortolkningsreglene for THC-syre i urin' })
    fireEvent.click(within(skjema).getByRole('button', { name: 'Prøv reglene' }))
    const simulator = () => skjema.querySelector<HTMLElement>('.simulator')!
    expect(avvikPaaSkjermen(simulator).slice(0, 3)).toEqual([])
  }, 60_000)
})
