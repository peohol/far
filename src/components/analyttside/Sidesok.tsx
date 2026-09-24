import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { sok, sti, type Sokedokument } from '../../faginnhold/sok'
import { erSokesnarvei } from '../../hooks/useKeyboard'
import { rullefart } from '../../hooks/useKortHopp'
import { Ikon } from '../ikon/Ikon'
import { detaljkortRundt } from '../seksjoner/Seksjon'
import { useSeksjonsstyring, type Rulleplass } from '../seksjoner/Seksjonsstyring'
import { Shortcut } from '../Shortcut'
import { elementAnker, panelAnker } from './Paneler'
import { TREFFKLASSE } from '../Uthev'

/** Snarveien som henter søket på siden fram, som den står i merket i feltet. */
export const SIDESOK_SNARVEI = 'Ctrl B'

/** Ctrl + B, eller Cmd + B på macOS (se `erSokesnarvei`). */
export function erSidesokSnarvei(event: KeyboardEvent): boolean {
  return erSokesnarvei(event, 'b')
}

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
 * Søket på den åpne siden, et kompakt felt i toppmenyen (i dokken på smale
 * flater). `Ctrl + B` eller `Cmd + B` henter det fram.
 *
 * Treffene fremheves der de står (se `Uthev`) og telles — også i seksjoner
 * og detaljkort som er lukket, der innholdet står skjult. `Enter` går til det
 * neste og `Shift + Enter` til det forrige, og åpner skuffene treffet står i;
 * `Escape` tømmer feltet. Under feltet står, mens det har fokus, hvor mange
 * treff det er og stedene de står — panelet og kortet — som snarveier dit.
 * Stedene finnes med den samme indekseringen som det globale søket bruker
 * (`src/faginnhold/sok.ts`), men søket er sitt eget: det globale fagsøket
 * søker i alle sidene, dette bare i den som står åpen.
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

  // Ctrl/Cmd + B henter søket fram fra hvor som helst på siden, også fra
  // fagsøket. Nettleseren har sin egen bruk av kombinasjonen; her er det søket.
  useEffect(() => {
    const paaTast = (event: KeyboardEvent) => {
      if (!erSidesokSnarvei(event)) return
      event.preventDefault()
      felt.current?.focus()
      felt.current?.select()
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
   * detaljkort inne i stedet. Står stedet i et detaljkort, er det hele kortet
   * som gjelder, så også treff i tittelen i hodet kommer med.
   */
  const gaTilSted = (anker: string) => {
    const element = document.getElementById(anker)
    if (!element) return
    const sted = detaljkortRundt(element) ?? element
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

  const teller = !sporring.trim() ? '' : antall === 0 ? '0' : `${aktiv + 1}/${antall}`

  return (
    <div className="sidesok" role="search" data-sok={sporring.trim() ? 'ja' : 'nei'}>
      <label className="sidesok__felt" htmlFor={id} data-ih="">
        <Ikon navn="pagesearch" storrelse="ui" />
        <span id={`${id}-navn`} className="kun-skjermleser">
          Søk på denne siden
        </span>
        <input
          ref={felt}
          id={id}
          aria-labelledby={`${id}-navn`}
          type="search"
          className="sidesok__input"
          placeholder="På siden"
          value={sporring}
          aria-keyshortcuts="Control+B Meta+B"
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
        {teller && (
          <span className="sidesok__teller" aria-hidden="true">
            {teller}
          </span>
        )}
        <Shortcut always>{SIDESOK_SNARVEI}</Shortcut>
      </label>
      <div className="sidesok__treff">
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
    </div>
  )
}
