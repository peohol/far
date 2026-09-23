import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { sok, sti, type Sokedokument } from '../../faginnhold/sok'
import { rullefart } from '../../hooks/useKortHopp'
import { useSeksjonsstyring, type Rulleplass } from '../seksjoner/Seksjonsstyring'
import { Shortcut } from '../Shortcut'
import { elementAnker, panelAnker } from './Paneler'
import { TREFFKLASSE } from '../Uthev'

/** Tasten som setter fokus i søket, når fokus ikke står i et felt. */
export const SOK_SNARVEI = '/'

/** Flest steder som listes under søket. */
const MAKS_STEDER = 6

const AKTIV = `${TREFFKLASSE}--aktiv`

export interface SidesokProps {
  sporring: string
  onEndre: (sporring: string) => void
  /** Siden treffene fremheves i. */
  beholder: RefObject<HTMLElement>
  /** Søkedokumentene for siden, så treffene kan listes etter hvor de står. */
  dokumenter: readonly Sokedokument[]
  /** Endres når innholdet på siden endres, så treffene telles på nytt. */
  innholdsnokkel: unknown
}

/**
 * Søket på den åpne siden.
 *
 * Treffene fremheves der de står (se `Uthev`) og telles — også i seksjoner
 * og detaljkort som er lukket, der innholdet står skjult. `Enter` går til det
 * neste og `Shift + Enter` til det forrige, og åpner skuffene treffet står i;
 * `Escape` tømmer feltet. Under feltet står stedene treffene er — panelet og
 * kortet — som snarveier dit.
 * Stedene finnes med den samme indekseringen som det globale søket skal
 * bruke (`src/faginnhold/sok.ts`).
 */
export function Sidesok({ sporring, onEndre, beholder, dokumenter, innholdsnokkel }: SidesokProps) {
  const id = useId()
  const felt = useRef<HTMLInputElement>(null)
  const [antall, setAntall] = useState(0)
  const [aktiv, setAktiv] = useState(0)
  const styring = useSeksjonsstyring()

  /** Viser elementet: åpner skuffene det står i, og ruller det fram. */
  const vis = (element: Element, plass: Rulleplass) => {
    if (styring) styring.apneTil(element, plass)
    else if (plass) element.scrollIntoView({ behavior: rullefart(), block: plass })
  }

  const steder = useMemo(() => {
    const sett = new Map<string, { sti: string[]; anker: string }>()
    for (const { dokument } of sok(dokumenter, sporring, 200)) {
      const { sted } = dokument
      if (!sted.panel) continue
      const anker = sted.element ? elementAnker(sted.element.id) : panelAnker(sted.panel.nokkel)
      if (!sett.has(anker)) sett.set(anker, { sti: sti(sted).slice(1), anker })
    }
    return [...sett.values()].slice(0, MAKS_STEDER)
  }, [dokumenter, sporring])

  const merker = () => [...(beholder.current?.querySelectorAll<HTMLElement>(`mark.${TREFFKLASSE}`) ?? [])]

  // Treffene telles etter at fremhevingen er tegnet.
  useEffect(() => {
    const alle = merker()
    setAntall(alle.length)
    setAktiv((a) => (alle.length === 0 ? 0 : Math.min(a, alle.length - 1)))
  }, [sporring, innholdsnokkel])

  useEffect(() => {
    const alle = merker()
    alle.forEach((m, i) => m.classList.toggle(AKTIV, i === aktiv))
  })

  // «/» henter søket fram fra hvor som helst på siden.
  useEffect(() => {
    const paaTast = (event: KeyboardEvent) => {
      if (event.key !== SOK_SNARVEI || event.ctrlKey || event.metaKey || event.altKey) return
      const aktivt = document.activeElement
      if (aktivt instanceof HTMLElement && (aktivt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(aktivt.tagName))) return
      if (document.querySelector('dialog[open], [data-lag]')) return
      event.preventDefault()
      felt.current?.focus()
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [])

  const ga = (retning: 1 | -1) => {
    const alle = merker()
    if (alle.length === 0) return
    const neste = (aktiv + retning + alle.length) % alle.length
    setAktiv(neste)
    const merke = alle[neste]
    if (merke) vis(merke, 'center')
  }

  /**
   * Går til stedet, og gjør det første treffet der til det aktive. Er det et
   * treff, er det treffet som vises, så skuffene det står i åpnes — også et
   * detaljkort inne i stedet.
   */
  const gaTilSted = (anker: string) => {
    const sted = document.getElementById(anker)
    if (!sted) return
    const alle = merker()
    const forste = alle.findIndex((m) => sted.contains(m))
    if (forste === -1) return vis(sted, 'start')
    setAktiv(forste)
    vis(alle[forste]!, 'center')
  }

  const status = !sporring.trim()
    ? ''
    : antall === 0
      ? 'Ingen treff på siden'
      : `Treff ${aktiv + 1} av ${antall}`

  return (
    <div className="sidesok" role="search">
      <label className="sidesok__felt" htmlFor={id}>
        <span className="kun-skjermleser">Søk på denne siden</span>
        <input
          ref={felt}
          id={id}
          type="search"
          className="sidesok__input"
          placeholder="Søk på siden"
          value={sporring}
          aria-keyshortcuts={SOK_SNARVEI}
          aria-describedby={`${id}-status`}
          onChange={(e) => {
            onEndre(e.target.value)
            setAktiv(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ga(e.shiftKey ? -1 : 1)
            } else if (e.key === 'Escape' && sporring) {
              e.preventDefault()
              e.stopPropagation()
              onEndre('')
            }
          }}
        />
        <Shortcut>{SOK_SNARVEI}</Shortcut>
      </label>
      <p id={`${id}-status`} className="sidesok__status" role="status">
        {status}
      </p>
      {steder.length > 0 && (
        <ul className="sidesok__steder" aria-label="Hvor treffene står">
          {steder.map(({ sti: deler, anker }) => (
            <li key={anker}>
              {/* Knapp og ikke lenke: adressefeltet skal peke på siden, ikke
                  på et sted i den. */}
              <button
                type="button"
                className="sidesok__sted"
                onClick={() => gaTilSted(anker)}
              >
                {deler.join(' › ')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
