import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { plasserTips, TIPSKANT, TIPSPIL, type Plassering } from '../domain/tipsplassering'

/**
 * Tooltipsystemet for hele appen.
 *
 * Én boble av gangen, tegnet i en portal rett på `<body>`. Det er poenget med
 * portalen: boblen er ikke bundet av bredden, høyden eller overflow-en til
 * beholderen ankeret står i, og kan derfor stå like fritt over en knapp i en
 * smal rute som over en overskrift. Plasseringen regnes ut i
 * `src/domain/tipsplassering.ts` og settes som `left`/`top` i vinduet.
 *
 * Tre ting henger sammen og må ikke skilles ad:
 *
 * - `TipsLag` er selve laget. Det må ligge rundt hele appen, én gang.
 * - `useTips` fester et tip på et vilkårlig element — også elementer som
 *   allerede er interaktive, som en knapp.
 * - `Tips` er den vanlige varianten: et stykke tekst med prikkestrek under.
 *
 * Boblen vises både ved peker og ved tastaturfokus. Selve teksten ligger i
 * tillegg skjult hos ankeret og er knyttet til det med `aria-describedby`, så
 * skjermlesere får den uansett om boblen står framme — forklaringen er aldri
 * ren museinformasjon.
 */

interface Aktivt {
  noekkel: string
  innhold: ReactNode
  anker: HTMLElement
}

interface Styring {
  vis: (noekkel: string, innhold: ReactNode, anker: HTMLElement) => void
  skjul: (noekkel: string) => void
  /** Ny tekst i boblen som allerede står framme. */
  oppdater: (noekkel: string, innhold: ReactNode) => void
}

/** Uten et `TipsLag` rundt seg står ankeret som vanlig tekst, uten boble. */
const Kontekst = createContext<Styring>({ vis: () => {}, skjul: () => {}, oppdater: () => {} })

export function TipsLag({ children }: { children: ReactNode }) {
  const [aktivt, setAktivt] = useState<Aktivt | null>(null)

  const styring = useMemo<Styring>(
    () => ({
      vis: (noekkel, innhold, anker) => setAktivt({ noekkel, innhold, anker }),
      // Bare det ankeret som viser boblen, kan lukke den. Ellers ville en
      // «pekeren forlot»-hendelse fra ankeret ved siden av slå av boblen som
      // nettopp ble åpnet.
      skjul: (noekkel) => setAktivt((n) => (n && n.noekkel !== noekkel ? n : null)),
      oppdater: (noekkel, innhold) =>
        setAktivt((n) => (n && n.noekkel === noekkel && n.innhold !== innhold ? { ...n, innhold } : n)),
    }),
    [],
  )

  // Et trykk et annet sted lukker boblen. På berøring kommer det ingen
  // «pekeren forlot»-hendelse, så uten dette ble boblen stående etter et tapp.
  useEffect(() => {
    if (!aktivt) return
    const paaTrykk = (event: Event) => {
      const maal = event.target
      if (maal instanceof Node && aktivt.anker.contains(maal)) return
      setAktivt(null)
    }
    document.addEventListener('pointerdown', paaTrykk, true)
    return () => document.removeEventListener('pointerdown', paaTrykk, true)
  }, [aktivt])

  return (
    <Kontekst.Provider value={styring}>
      {children}
      {aktivt &&
        createPortal(
          // Nøkkelen gir hver boble sin egen måling, så en ny boble aldri
          // rekker å vises et øyeblikk der den forrige sto.
          <Boble key={aktivt.noekkel} anker={aktivt.anker}>
            {aktivt.innhold}
          </Boble>,
          document.body,
        )}
    </Kontekst.Provider>
  )
}

interface Maal {
  plassering: Plassering
  /** Bredden boblen har å ta av, med luft til begge vinduskantene. */
  maks: number
}

function uendret(forrige: Maal | null, plassering: Plassering, maks: number): boolean {
  return (
    forrige !== null &&
    forrige.maks === maks &&
    forrige.plassering.venstre === plassering.venstre &&
    forrige.plassering.topp === plassering.topp &&
    forrige.plassering.side === plassering.side &&
    forrige.plassering.pil === plassering.pil
  )
}

/**
 * Selve boblen. Den tegnes først usynlig, måles, og vises der målingen sier —
 * ellers ville den blinket til i feil hjørne før den fant plassen sin.
 */
function Boble({ anker, children }: { anker: HTMLElement; children: ReactNode }) {
  const boble = useRef<HTMLDivElement>(null)
  const [maal, setMaal] = useState<Maal | null>(null)

  useLayoutEffect(() => {
    const element = boble.current
    if (!element) return

    const mal = () => {
      const a = anker.getBoundingClientRect()
      const b = element.getBoundingClientRect()
      // `clientWidth`/`clientHeight` på rotelementet, ikke `innerWidth`: de
      // holder rullefeltet utenfor, og det er den synlige flaten boblen skal
      // holde seg innenfor.
      const vindu = {
        bredde: document.documentElement.clientWidth,
        hoyde: document.documentElement.clientHeight,
      }
      const plassering = plasserTips(
        { venstre: a.left, topp: a.top, bredde: a.width, hoyde: a.height },
        { bredde: b.width, hoyde: b.height },
        vindu,
      )
      const maks = vindu.bredde - 2 * TIPSKANT
      setMaal((forrige) => (uendret(forrige, plassering, maks) ? forrige : { plassering, maks }))
    }

    mal()

    // Boblen kan skifte størrelse når maksbredden slår inn, og ankeret kan
    // flytte seg når det rulles eller vinduet endres. `true` på rullingen tar
    // også med rulling inne i beholdere på siden.
    const observator = new ResizeObserver(mal)
    observator.observe(element)
    window.addEventListener('scroll', mal, true)
    window.addEventListener('resize', mal)
    return () => {
      observator.disconnect()
      window.removeEventListener('scroll', mal, true)
      window.removeEventListener('resize', mal)
    }
  }, [anker, children])

  const stil = {
    left: `${maal?.plassering.venstre ?? 0}px`,
    top: `${maal?.plassering.topp ?? 0}px`,
    '--tips-pil': `${maal?.plassering.pil ?? 0}px`,
    '--tips-pilbredde': `${TIPSPIL}px`,
    ...(maal && { '--tips-maks': `${maal.maks}px` }),
  } as CSSProperties

  return (
    <div
      ref={boble}
      className={[
        'tipsboble',
        `tipsboble--${maal?.plassering.side ?? 'over'}`,
        maal && 'tipsboble--klar',
      ]
        .filter(Boolean)
        .join(' ')}
      // Teksten leses fra forklaringen som ligger hos ankeret. Boblen er bare
      // bildet av den, og skal ikke telles en gang til.
      aria-hidden="true"
      style={stil}
    >
      {children}
    </div>
  )
}

export interface TipsValg {
  /**
   * Fast id på forklaringen. Trengs bare når noe annet enn ankeret selv også
   * skal peke på den med `aria-describedby` — ellers lages en.
   */
  id?: string
  /**
   * Om forklaringen skal meldes til skjermlesere. Slå av når teksten allerede
   * er elementets eget navn (`aria-label`), så den ikke leses to ganger.
   */
  skjermleser?: boolean
}

export interface TipsFeste {
  /** Spres på elementet tipset skal henge på. */
  props: {
    ref: (element: HTMLElement | null) => void
    'aria-describedby'?: string
    onPointerEnter: () => void
    onPointerLeave: (event: PointerEvent<HTMLElement>) => void
    onFocus: (event: FocusEvent<HTMLElement>) => void
    onBlur: () => void
  }
  /** Forklaringen for skjermlesere. Må rendres, som søsken til ankeret. */
  forklaring: ReactNode
}

/**
 * Fester et tip på et vilkårlig element. Brukes når ankeret allerede har en
 * jobb — en knapp, for eksempel — og derfor ikke kan pakkes inn i `Tips`.
 */
export function useTips(innhold: ReactNode, valg: TipsValg = {}): TipsFeste {
  const { id: fastId, skjermleser = true } = valg
  const laget = useId()
  const id = fastId ?? laget
  const { vis, skjul, oppdater } = useContext(Kontekst)
  const anker = useRef<HTMLElement | null>(null)
  // Teksten leses først når boblen åpnes, så hendelsene ikke må bygges på nytt
  // hver gang den skifter.
  const siste = useRef(innhold)
  siste.current = innhold

  const apne = useCallback(
    (element: HTMLElement | null) => {
      if (element) vis(id, siste.current, element)
    },
    [id, vis],
  )

  // Et anker som forsvinner — et steg som byttes ut — tar boblen med seg.
  useEffect(() => () => skjul(id), [id, skjul])

  // Skifter teksten mens boblen står — som når temaknappen bytter navn i det
  // den klikkes — skal boblen vise den nye med det samme.
  useEffect(() => {
    oppdater(id, innhold)
  }, [id, innhold, oppdater])

  const props = useMemo(
    () => ({
      ref: (element: HTMLElement | null) => {
        anker.current = element
      },
      ...(skjermleser && { 'aria-describedby': id }),
      onPointerEnter: () => apne(anker.current),
      // Ved berøring slutter pekeren å finnes så snart fingeren løftes, og
      // nettleseren sender «forlot» med det samme. Da ville boblen aldri rukket
      // å bli lest. Et tapp lar den bli stående til noe annet berøres, slik
      // laget selv sørger for.
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== 'touch') skjul(id)
      },
      // Bare tastaturfokus. Et klikk viser allerede boblen gjennom pekeren, og
      // skal ikke i tillegg la den bli stående etterpå.
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.currentTarget.matches(':focus-visible')) apne(event.currentTarget)
      },
      onBlur: () => skjul(id),
    }),
    [id, skjermleser, apne, skjul],
  )

  return {
    props,
    forklaring: skjermleser ? (
      <div className="tipsforklaring" id={id}>
        {innhold}
      </div>
    ) : null,
  }
}

export interface TipsProps {
  /**
   * Forklaringen som vises i boblen. Én streng når det holder med en setning
   * eller to; ellers `tipsboble__bolk`-seksjoner med hver sin
   * `tipsboble__tittel`.
   */
  forklaring: ReactNode
  children: ReactNode
  /** Egen klasse på ankeret, til plassering og skrift der det står. */
  className?: string
  /** Se `TipsValg.id`. */
  id?: string
}

/**
 * Et navn eller en overskrift med en forklaring bak seg. Prikkestreken under
 * teksten er hintet om at det er noe å hente.
 *
 * Står det noe ved siden av navnet som ikke skal ha prikkestrek — en
 * fargestrek i en legende, for eksempel — legges selve navnet i en
 * `tipsanker__navn` blant barna. Da flytter streken seg dit.
 */
export function Tips({ forklaring, children, className, id }: TipsProps) {
  const tips = useTips(forklaring, { id })
  return (
    <>
      <span
        className={className ? `tipsanker ${className}` : 'tipsanker'}
        tabIndex={0}
        {...tips.props}
      >
        {children}
      </span>
      {tips.forklaring}
    </>
  )
}
