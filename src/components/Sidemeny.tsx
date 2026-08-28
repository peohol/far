import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Shortcut } from './Shortcut'
import { CloseIcon, MenuIcon } from './icons'
import { useTips } from './Tips'
import {
  byggMeny,
  metodefarger,
  metodesnarvei,
  type Menyanalytt,
  type Menymetode,
} from '../domain/analysemetoder'
import { lagLiggerOver } from '../hooks/useKeyboard'
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

/** Tasten som åpner og lukker menyen. */
const MENY_SNARVEI = 'Ctrl + M'

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
  const knapp = useRef<HTMLButtonElement | null>(null)

  const meny = useMemo(() => byggMeny(pool), [pool])

  /**
   * Knappens navn sier fra når filteret står på. Et filter brukeren har
   * glemt, gjør at analytter ikke lenger kan søkes opp, og det skal ikke være
   * noe man må åpne menyen for å oppdage.
   */
  const knappenavn = metodefilter
    ? `Vis analysemetoder – søket er begrenset til ${metodefilter}`
    : 'Vis analysemetoder'
  const knappetips = useTips(knappenavn, { skjermleser: false })
  // Tipset og fokuset skal på det samme elementet, så de to ref-ene slås sammen.
  const { ref: tipsRef, ...knappeprops } = knappetips.props
  const settKnapp = useCallback(
    (element: HTMLButtonElement | null) => {
      knapp.current = element
      tipsRef(element)
    },
    [tipsRef],
  )

  const apne = useCallback(() => setApen(true), [])

  /** Lukking gir fokus tilbake til knappen, som er synlig igjen. */
  const lukk = useCallback(() => {
    setApen(false)
    knapp.current?.focus()
  }, [])

  /**
   * Ctrl + M åpner og lukker menyen. Den ligger utenom `useKeyboard`, som med
   * vilje slipper alle modifikatorkombinasjoner gjennom til nettleseren; dette
   * er den ene snarveien i appen som trenger en.
   */
  useEffect(() => {
    function paaTast(event: KeyboardEvent) {
      if (!event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.toLowerCase() !== 'm') return
      // Et annet lag over appen — endringsloggen — har forrangen.
      if (!apen && lagLiggerOver()) return
      event.preventDefault()
      if (apen) lukk()
      else apne()
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [apen, apne, lukk])

  /**
   * Escape lukker menyen. Appens egen Esc ligger stille så lenge laget står
   * over den, så de to kan ikke utløses av det samme tastetrykket.
   *
   * Tabulator går rundt i panelet så lenge menyen står åpen. Menyknappen
   * ligger skjult bak panelet, og appen bak er mørklagt: fokus skal ikke kunne
   * havne på noe man ikke ser.
   */
  useEffect(() => {
    if (!apen) return
    function paaTast(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        lukk()
        return
      }
      if (event.key !== 'Tab') return

      const felter = naabare(panel.current)
      const forste = felter[0]
      const siste = felter[felter.length - 1]
      if (!forste || !siste) return

      // Panelet selv har fokus rett etter åpning, og ligger foran det første
      // feltet: derfra går veien bakover til det siste, ikke ut av menyen.
      const foran = document.activeElement === forste || document.activeElement === panel.current
      if (event.shiftKey && foran) {
        event.preventDefault()
        siste.focus()
      } else if (!event.shiftKey && document.activeElement === siste) {
        event.preventDefault()
        forste.focus()
      }
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [apen, lukk])

  // Fokus følger med inn i panelet, ellers ville det blitt stående på
  // menyknappen som nå ligger skjult bak det. Panelet selv tar imot fokuset,
  // så tabulator begynner på toppen og ingen knapp trykkes ved et uhell.
  useEffect(() => {
    if (apen) panel.current?.focus()
  }, [apen])

  const velg = useCallback(
    (analyte: Analyte) => {
      // Ikke `lukk()`: det nye steget tar fokus selv, og skal ikke få det
      // revet tilbake til menyknappen.
      setApen(false)
      onVelgAnalytt(analyte)
    },
    [onVelgAnalytt],
  )

  return (
    <>
      {/* Står filteret på, utvider knappen seg til en pille med metodekoden i
          metodens egen farge. Da går det fram av hjørnet alene hva søket er
          begrenset til, uten at menyen må åpnes. */}
      <button
        ref={settKnapp}
        type="button"
        className="menyknapp"
        data-filter={metodefilter ? 'ja' : 'nei'}
        style={metodefilter ? metodefarger(metodefilter) : undefined}
        aria-label={knappenavn}
        aria-expanded={apen}
        aria-controls={panelId}
        aria-keyshortcuts="Control+M"
        onClick={apne}
        {...knappeprops}
      >
        <MenuIcon />
        {metodefilter && <span className="menyknapp__filter">{metodefilter}</span>}
        <Shortcut>{MENY_SNARVEI}</Shortcut>
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
        tabIndex={-1}
      >
        <div className="sidemeny__topp">
          <h2 className="sidemeny__tittel">Analysemetoder</h2>
          <button
            type="button"
            className="sidemeny__lukk"
            aria-label="Lukk menyen"
            onClick={lukk}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Bryteren og «alle»-valget står fast øverst. De gjelder hele lista,
            og skal ikke kunne rulles bort fra den. */}
        <label className="menyveksle">
          <input
            type="checkbox"
            checked={visKategorier}
            onChange={(e) => setVisKategorier(e.target.checked)}
          />
          <span>Vis kategorier</span>
        </label>

        <div
          className="menyfilter"
          role="radiogroup"
          aria-label="Begrens søket til én analysemetode"
        >
          <label className="menyvalg menyvalg--alle">
            <input
              type="radio"
              name="analysemetodefilter"
              checked={metodefilter === null}
              onChange={() => onFilter(null)}
            />
            <span className="menyvalg__merke">Inkluder alle analysemetoder</span>
          </label>

          <ul className="menyliste">
            {meny.map((metode) => (
              <Skuff
                key={metode.kode}
                metode={metode}
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
        </div>
      </nav>
    </>
  )
}

/**
 * Én analysemetode: radioknappen som filtrerer søket, tittelen som åpner
 * skuffen, og virkestoffene i den.
 *
 * Skuffen bærer metodens egen farge — den samme som pillen i analyttkortet og
 * menyknappen når filteret står på den.
 *
 * Selve skuffen glir opp og igjen med `grid-template-rows: 0fr ↔ 1fr`, som
 * ellers i appen. Lukket innhold settes usynlig når glidningen er over, så det
 * heller ikke nås med tabulator eller skjermleser.
 */
function Skuff({
  metode,
  apen,
  valgt,
  visKategorier,
  onVeksle,
  onFilter,
  onVelgAnalytt,
}: {
  metode: Menymetode
  apen: boolean
  valgt: boolean
  visKategorier: boolean
  onVeksle: () => void
  onFilter: () => void
  onVelgAnalytt: (analyte: Analyte) => void
}) {
  const id = useId()
  const rad = useRef<HTMLLIElement>(null)
  const snarvei = metodesnarvei(metode.kode)
  const filtertips = useTips(`Vis bare treff fra ${metode.kode} i søket`, { skjermleser: false })

  // En skuff som åpnes nederst i lista skal ikke bli stående utenfor bildet.
  // Rullingen venter til glidningen er over — først da vet vi hvor høy den ble.
  useEffect(() => {
    if (!apen) return
    const el = rad.current
    if (!el) return
    const frist = window.setTimeout(
      // Øverst i lista: da er hele skuffen i bildet, uansett hvor i menyen den
      // står.
      () => el.scrollIntoView({ behavior: rullefart(), block: 'start' }),
      ETTER_GLIDNING,
    )
    return () => window.clearTimeout(frist)
  }, [apen])

  const kategorier = visKategorier ? metode.kategorier : []

  return (
    <li
      ref={rad}
      className="menyskuff"
      data-apen={apen ? 'ja' : 'nei'}
      style={metodefarger(metode.kode)}
    >
      <div className="menyskuff__hode">
        {/* Tipset henger på selve radioknappen og ikke på etiketten rundt:
            etiketten får aldri fokus selv, og forklaringen ville da bare vært
            å få med pekeren. */}
        <label className="menyvalg menyvalg--skuff">
          <input
            type="radio"
            name="analysemetodefilter"
            checked={valgt}
            onChange={onFilter}
            aria-label={`Vis bare treff fra ${metode.kode} – ${metode.beskrivelse}`}
            {...(snarvei && { 'aria-keyshortcuts': snarvei.replace(/ /g, '') })}
            {...filtertips.props}
          />
        </label>

        <button
          type="button"
          className="menyskuff__tittel"
          aria-expanded={apen}
          aria-controls={id}
          onClick={onVeksle}
        >
          <span className="menyskuff__merking">
            <span className="menyskuff__kode">{metode.kode}</span>
            {snarvei && <Shortcut>{snarvei}</Shortcut>}
          </span>
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
