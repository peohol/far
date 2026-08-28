import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CloseIcon, MenuIcon } from './icons'
import { useTips } from './Tips'
import { byggMeny, type Menyanalytt, type Menymetode } from '../domain/analysemetoder'
import { optionColourVars } from '../domain/optionColours'
import { rullefart } from '../hooks/useKortHopp'
import type { Analyte } from '../types'

/**
 * Sidemenyen: oversikten over analysemetodene, og filteret for søket.
 *
 * Menyen har to jobber. Den er en vei inn til en analytt for den som heller
 * vil bla enn å søke, og den avgjør hvilken analysemetode søket leter i.
 *
 * Innholdet bygges av de samme søkeoppføringene som søket bruker, så listene
 * kan ikke komme i utakt med det appen faktisk kan kommentere.
 *
 * Menyen er et lag over appen, på linje med endringsloggen: `data-lag` sier
 * fra til `lagLiggerOver()`, slik at appens egne taster holder seg i ro mens
 * den står åpen.
 */

/** Hvor lenge det ventes før en nyåpnet skuff hentes fram i bildet. */
const ETTER_GLIDNING = 300

/** Alt som kan få fokus i panelet. */
const FOKUSERBART = 'button, input, [href], [tabindex]:not([tabindex="-1"])'

/**
 * Feltene i panelet som faktisk kan nås nå.
 *
 * Innholdet i en lukket skuff er satt `visibility: hidden`, og den arves, så
 * det holder å lese den av for å utelate hele skuffen.
 */
function naabare(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return []
  return [...panel.querySelectorAll<HTMLElement>(FOKUSERBART)].filter(
    (el) => getComputedStyle(el).visibility !== 'hidden',
  )
}

export interface SidemenyProps {
  /** Søkeoppføringene menyen bygges av — de samme som søket leter i. */
  pool: Analyte[]
  /** Analysemetoden søket er begrenset til. `null` er alle metodene. */
  metodefilter: string | null
  onFilter: (metode: string | null) => void
  /** Trykk på et virkestoff: rett inn i kommenteringsmodulen dens. */
  onVelgAnalytt: (analyte: Analyte) => void
}

export function Sidemeny({ pool, metodefilter, onFilter, onVelgAnalytt }: SidemenyProps) {
  const [apen, setApen] = useState(false)
  /** Av gjemmer kategoriene og lister virkestoffene i én alfabetisk bolk. */
  const [visKategorier, setVisKategorier] = useState(true)
  /** Metoden med åpen skuff — bare én av gangen. */
  const [apenSkuff, setApenSkuff] = useState<string | null>(null)
  const panelId = useId()
  const panel = useRef<HTMLElement>(null)

  const meny = useMemo(() => byggMeny(pool), [pool])

  /**
   * Knappens navn sier fra når filteret står på. Et filter brukeren har
   * glemt, gjør at analytter ikke lenger kan søkes opp, og det skal ikke være
   * noe man må åpne menyen for å oppdage.
   */
  const knappenavn = apen
    ? 'Lukk menyen'
    : metodefilter
      ? `Vis analysemetoder – søket er begrenset til ${metodefilter}`
      : 'Vis analysemetoder'
  const knappetips = useTips(knappenavn, { skjermleser: false })

  const lukk = useCallback(() => setApen(false), [])

  const veksle = useCallback(() => setApen((forrige) => !forrige), [])

  /**
   * Escape lukker menyen. Appens egen Esc ligger stille så lenge laget står
   * over den, så de to kan ikke utløses av det samme tastetrykket.
   *
   * Tabulator går rundt i menyen så lenge den står åpen. Appen bak er
   * mørklagt, og fokus skal ikke kunne havne på en knapp man ikke ser: fra
   * det siste feltet i panelet går turen tilbake til menyknappen, som også er
   * lukkeknappen, og motsatt vei derfra.
   */
  useEffect(() => {
    if (!apen) return
    function paaTast(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setApen(false)
        return
      }
      if (event.key !== 'Tab') return

      const knapp = document.querySelector<HTMLElement>('.menyknapp')
      const felter = naabare(panel.current)
      const siste = felter[felter.length - 1] ?? knapp
      if (!knapp || !siste) return

      if (event.shiftKey && document.activeElement === knapp) {
        event.preventDefault()
        siste.focus()
      } else if (!event.shiftKey && document.activeElement === siste) {
        event.preventDefault()
        knapp.focus()
      }
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [apen])

  const velg = useCallback(
    (analyte: Analyte) => {
      setApen(false)
      onVelgAnalytt(analyte)
    },
    [onVelgAnalytt],
  )

  return (
    <>
      <button
        type="button"
        className="menyknapp"
        data-filter={metodefilter ? 'ja' : 'nei'}
        aria-label={knappenavn}
        aria-expanded={apen}
        aria-controls={panelId}
        onClick={veksle}
        {...knappetips.props}
      >
        {apen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Mørklegger og slører hovedinnholdet, og lukker menyen ved trykk. Den
          ligger som et eget lag i stedet for som et filter på innholdet, så
          verktøylinja og de andre faste elementene beholder plassen sin. */}
      <div
        className="menylag"
        onClick={lukk}
        aria-hidden="true"
        {...(apen && { 'data-lag': 'meny' })}
      />

      <nav
        ref={panel}
        id={panelId}
        className="sidemeny"
        aria-label="Analysemetoder"
        data-apen={apen ? 'ja' : 'nei'}
      >
        <div className="sidemeny__topp">
          <h2 className="sidemeny__tittel">Analysemetoder</h2>
        </div>

        <div className="sidemeny__innhold">
          <label className="menyveksle">
            <input
              type="checkbox"
              checked={visKategorier}
              onChange={(e) => setVisKategorier(e.target.checked)}
            />
            <span>Vis kategorier</span>
          </label>

          <fieldset className="menyfilter">
            <legend className="kun-skjermleser">Begrens søket til én analysemetode</legend>

            <ul className="menyliste">
              <li className="menyrad menyrad--alle">
                <label className="menyvalg">
                  <input
                    type="radio"
                    name="analysemetodefilter"
                    checked={metodefilter === null}
                    onChange={() => onFilter(null)}
                  />
                  <span className="menyvalg__merke">Inkluder alle analysemetoder</span>
                </label>
              </li>

              {meny.map((metode, i) => (
                <Skuff
                  key={metode.kode}
                  metode={metode}
                  farger={optionColourVars(i, meny.length)}
                  apen={apenSkuff === metode.kode}
                  valgt={metodefilter === metode.kode}
                  visKategorier={visKategorier}
                  onVeksle={() =>
                    setApenSkuff((forrige) => (forrige === metode.kode ? null : metode.kode))
                  }
                  onFilter={() => onFilter(metode.kode)}
                  onVelgAnalytt={velg}
                />
              ))}
            </ul>
          </fieldset>
        </div>
      </nav>
    </>
  )
}

/**
 * Én analysemetode: radioknappen som filtrerer søket, tittelen som åpner
 * skuffen, og virkestoffene i den.
 *
 * Skuffen glir opp og igjen med `grid-template-rows: 0fr ↔ 1fr`, som ellers i
 * appen. Lukket innhold settes usynlig når glidningen er over, så det heller
 * ikke nås med tabulator eller skjermleser.
 */
function Skuff({
  metode,
  farger,
  apen,
  valgt,
  visKategorier,
  onVeksle,
  onFilter,
  onVelgAnalytt,
}: {
  metode: Menymetode
  farger: Record<string, string>
  apen: boolean
  valgt: boolean
  visKategorier: boolean
  onVeksle: () => void
  onFilter: () => void
  onVelgAnalytt: (analyte: Analyte) => void
}) {
  const id = useId()
  const rad = useRef<HTMLLIElement>(null)
  const filtertips = useTips(`Vis bare treff fra ${metode.kode} i søket`, { skjermleser: false })

  // En skuff som åpnes nederst i lista skal ikke bli stående utenfor bildet.
  // Rullingen venter til glidningen er over — først da vet vi hvor høy den ble.
  useEffect(() => {
    if (!apen) return
    const el = rad.current
    if (!el) return
    const frist = window.setTimeout(
      // Øverst i panelet: da er hele lista i bildet, uansett hvor i menyen
      // skuffen står.
      () => el.scrollIntoView({ behavior: rullefart(), block: 'start' }),
      ETTER_GLIDNING,
    )
    return () => window.clearTimeout(frist)
  }, [apen])

  const kategorier = visKategorier ? metode.kategorier : []

  return (
    <li ref={rad} className="menyskuff" data-apen={apen ? 'ja' : 'nei'} style={farger}>
      <div className="menyskuff__hode">
        <label className="menyvalg menyvalg--skuff" {...filtertips.props}>
          <input
            type="radio"
            name="analysemetodefilter"
            checked={valgt}
            onChange={onFilter}
            aria-label={`Vis bare treff fra ${metode.kode} – ${metode.beskrivelse}`}
          />
        </label>

        <button
          type="button"
          className="menyskuff__tittel"
          aria-expanded={apen}
          aria-controls={id}
          onClick={onVeksle}
        >
          <span className="menyskuff__kode">{metode.kode}</span>
          <span className="menyskuff__beskrivelse">{metode.beskrivelse}</span>
        </button>
      </div>

      <div id={id} className="menyskuff__kropp">
        <div className="menyskuff__inner">
          {kategorier.length > 0 ? (
            kategorier.map((kategori) => (
              <section className="menykategori" key={kategori.navn}>
                <h3 className="menykategori__navn">{kategori.navn}</h3>
                <Virkestoffer analytter={kategori.analytter} onVelg={onVelgAnalytt} />
              </section>
            ))
          ) : (
            <Virkestoffer analytter={metode.analytter} onVelg={onVelgAnalytt} />
          )}
        </div>
      </div>
    </li>
  )
}

/** Virkestoffene i en skuff eller en kategori, alfabetisk. */
function Virkestoffer({
  analytter,
  onVelg,
}: {
  analytter: Menyanalytt[]
  onVelg: (analyte: Analyte) => void
}) {
  return (
    <ul className="menyanalytter">
      {analytter.map((oppforing) => (
        <li key={oppforing.kode}>
          <button type="button" className="menyanalytt" onClick={() => onVelg(oppforing.analyte)}>
            <span className="menyanalytt__navn">{oppforing.navn}</span>
            <span className="menyanalytt__kode">{oppforing.kode}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
