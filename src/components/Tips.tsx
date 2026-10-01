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
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  maksTipsstorrelse,
  plasserTips,
  TIPSLUFT,
  TIPSPIL,
  type Plassering,
  type Storrelse,
} from '../domain/tipsplassering'

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
  /** Ankeret har sluppet boblen. Den lukkes med mindre noe annet holder den. */
  const [sluppet, setSluppet] = useState(false)
  /** Pekeren er inne i en boble som kan rulles, og holder den åpen. */
  const [holdt, setHoldt] = useState(false)
  const noekkel = useRef<string | null>(null)

  const styring = useMemo<Styring>(
    () => ({
      vis: (n, innhold, anker) => {
        noekkel.current = n
        setAktivt({ noekkel: n, innhold, anker })
        setSluppet(false)
      },
      // Bare det ankeret som viser boblen, kan slippe den. Ellers ville en
      // «pekeren forlot»-hendelse fra ankeret ved siden av slå av boblen som
      // nettopp ble åpnet.
      skjul: (n) => {
        if (noekkel.current === n) setSluppet(true)
      },
      oppdater: (n, innhold) =>
        setAktivt((a) => (a && a.noekkel === n && a.innhold !== innhold ? { ...a, innhold } : a)),
    }),
    [],
  )

  const lukk = useCallback(() => {
    noekkel.current = null
    setAktivt(null)
    setSluppet(false)
    setHoldt(false)
  }, [])

  // Ankeret og boblen melder fra hver for seg, og begge svarene kommer i samme
  // oppdatering. Derfor avgjøres lukkingen her og ikke i den enkelte
  // hendelsen — da spiller rekkefølgen deres ingen rolle når pekeren flytter
  // seg fra ankeret og inn i boblen.
  useEffect(() => {
    if (sluppet && !holdt) lukk()
  }, [sluppet, holdt, lukk])

  // Et trykk et annet sted lukker boblen. På berøring kommer det ingen
  // «pekeren forlot»-hendelse, så uten dette ble boblen stående etter et tapp.
  useEffect(() => {
    if (!aktivt) return
    const paaTrykk = (event: Event) => {
      const maal = event.target
      if (!(maal instanceof Node)) return lukk()
      // Trykk i ankeret eller i boblen selv — å dra i rullefeltet, for
      // eksempel — skal ikke lukke.
      if (aktivt.anker.contains(maal)) return
      if (maal instanceof Element && maal.closest('.tipsboble')) return
      lukk()
    }
    document.addEventListener('pointerdown', paaTrykk, true)
    return () => document.removeEventListener('pointerdown', paaTrykk, true)
  }, [aktivt, lukk])

  // Et anker som åpner sin egen meny eller skuff (`aria-expanded`), gir plass
  // til den: boblen ville ellers lagt seg over det som nettopp ble åpnet.
  useEffect(() => {
    if (!aktivt) return
    const { anker } = aktivt
    const sjekk = () => {
      if (anker.getAttribute('aria-expanded') === 'true') lukk()
    }
    sjekk()
    const observator = new MutationObserver(sjekk)
    observator.observe(anker, { attributes: true, attributeFilter: ['aria-expanded'] })
    return () => observator.disconnect()
  }, [aktivt, lukk])

  return (
    <Kontekst.Provider value={styring}>
      {children}
      {aktivt &&
        createPortal(
          // Nøkkelen gir hver boble sin egen måling, så en ny boble aldri
          // rekker å vises et øyeblikk der den forrige sto.
          <Boble key={aktivt.noekkel} anker={aktivt.anker} onHold={setHoldt}>
            {aktivt.innhold}
          </Boble>,
          document.body,
        )}
    </Kontekst.Provider>
  )
}

interface Maal {
  plassering: Plassering
  /** Så stor boblen får bli, med luft til vinduskantene. */
  maks: Storrelse
  /** Sant når forklaringen er høyere enn vinduet og må kunne rulles. */
  rullbar: boolean
}

function uendret(forrige: Maal | null, nytt: Maal): boolean {
  return (
    forrige !== null &&
    forrige.maks.bredde === nytt.maks.bredde &&
    forrige.maks.hoyde === nytt.maks.hoyde &&
    forrige.rullbar === nytt.rullbar &&
    forrige.plassering.venstre === nytt.plassering.venstre &&
    forrige.plassering.topp === nytt.plassering.topp &&
    forrige.plassering.side === nytt.plassering.side &&
    forrige.plassering.pil === nytt.plassering.pil
  )
}

/** Det `useBobleplassering` gir tilbake: festene, klassene og stilen. */
export interface Bobleplassering<T extends HTMLElement> {
  /** Festes på selve boblen — elementet som plasseres. */
  boble: RefObject<T>
  /** Festes på innholdet inni, der rullingen skjer. */
  innhold: RefObject<T>
  /** `tipsboble`-klassene: siden den står på, om den er klar og rullbar. */
  klasser: string
  stil: CSSProperties
}

/**
 * Plasserer en boble ved ankeret, i vinduet. Boblen tegnes først usynlig,
 * måles, og vises der målingen sier — ellers ville den blinket til i feil
 * hjørne før den fant plassen sin. Følger ankeret når det rulles eller
 * vinduet endres.
 *
 * Innholdet ligger i et eget element inni, fordi pilen stikker utenfor
 * boblen: rullingen må skje et sted som ikke klipper den.
 *
 * `oppdatering` er det som kan endre størrelsen på boblen, så den måles på
 * nytt når det skifter. `side` er siden av ankeret den helst står på.
 */
export function useBobleplassering<T extends HTMLElement = HTMLDivElement>(
  anker: HTMLElement,
  oppdatering?: unknown,
  side: Plassering['side'] = 'over',
): Bobleplassering<T> {
  const boble = useRef<T>(null)
  const innhold = useRef<T>(null)
  const [maal, setMaal] = useState<Maal | null>(null)

  useLayoutEffect(() => {
    const element = boble.current
    const kropp = innhold.current
    if (!element || !kropp) return

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
      const nytt: Maal = {
        plassering: plasserTips(
          { venstre: a.left, topp: a.top, bredde: a.width, hoyde: a.height },
          { bredde: b.width, hoyde: b.height },
          vindu,
          side,
        ),
        maks: maksTipsstorrelse(vindu),
        // Én piksels slark: avrundet layout skal ikke gjøre boblen rullbar
        // når alt egentlig får plass.
        rullbar: kropp.scrollHeight > kropp.clientHeight + 1,
      }
      setMaal((forrige) => (uendret(forrige, nytt) ? forrige : nytt))
    }

    mal()

    // Boblen kan skifte størrelse når maksmålene slår inn, og ankeret kan
    // flytte seg når det rulles eller vinduet endres. `true` på rullingen tar
    // også med rulling inne i beholdere på siden.
    const observator = new ResizeObserver(mal)
    observator.observe(element)
    observator.observe(kropp)
    window.addEventListener('scroll', mal, true)
    window.addEventListener('resize', mal)
    return () => {
      observator.disconnect()
      window.removeEventListener('scroll', mal, true)
      window.removeEventListener('resize', mal)
    }
  }, [anker, oppdatering, side])

  const stil = {
    left: `${maal?.plassering.venstre ?? 0}px`,
    top: `${maal?.plassering.topp ?? 0}px`,
    '--tips-pil': `${maal?.plassering.pil ?? 0}px`,
    '--tips-pilbredde': `${TIPSPIL}px`,
    '--tips-luft': `${TIPSLUFT}px`,
    ...(maal && {
      '--tips-maks-bredde': `${maal.maks.bredde}px`,
      '--tips-maks-hoyde': `${maal.maks.hoyde}px`,
    }),
  } as CSSProperties

  const klasser = [
    'tipsboble',
    `tipsboble--${maal?.plassering.side ?? side}`,
    maal && 'tipsboble--klar',
    maal?.rullbar && 'tipsboble--rullbar',
  ]
    .filter(Boolean)
    .join(' ')

  return { boble, innhold, klasser, stil }
}

/** Selve tipsboblen, plassert ved ankeret. */
function Boble({
  anker,
  onHold,
  children,
}: {
  anker: HTMLElement
  onHold: (holdt: boolean) => void
  children: ReactNode
}) {
  const { boble, innhold, klasser, stil } = useBobleplassering(anker, children)

  // Forsvinner boblen mens pekeren er inne i den, kommer det ingen
  // «pekeren forlot» — grepet må slippes her, ellers blir det hengende.
  useEffect(() => () => onHold(false), [onHold])

  return (
    <div
      ref={boble}
      className={klasser}
      // Teksten leses fra forklaringen som ligger hos ankeret. Boblen er bare
      // bildet av den, og skal ikke telles en gang til.
      aria-hidden="true"
      style={stil}
      onPointerEnter={() => onHold(true)}
      onPointerLeave={() => onHold(false)}
    >
      <div ref={innhold} className="tipsboble__innhold">
        {children}
      </div>
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
  // Peker og fokus telles hver for seg. Ellers ville musen som streifer et
  // anker brukeren nettopp tabbet seg til, tatt boblen med seg når den dro —
  // og fokuset som fortsatt står der, gir ingen ny hendelse å åpne den på.
  const peker = useRef(false)
  const fokus = useRef(false)

  const apne = useCallback(
    (element: HTMLElement | null) => {
      if (element) vis(id, siste.current, element)
    },
    [id, vis],
  )

  const lukk = useCallback(() => {
    if (!peker.current && !fokus.current) skjul(id)
  }, [id, skjul])

  // Et anker som forsvinner — et steg som byttes ut — tar boblen med seg.
  useEffect(
    () => () => {
      peker.current = false
      fokus.current = false
      skjul(id)
    },
    [id, skjul],
  )

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
      onPointerEnter: () => {
        peker.current = true
        apne(anker.current)
      },
      // Ved berøring slutter pekeren å finnes så snart fingeren løftes, og
      // nettleseren sender «forlot» med det samme. Da ville boblen aldri rukket
      // å bli lest. Et tapp lar den bli stående til noe annet berøres, slik
      // laget selv sørger for.
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        peker.current = false
        if (event.pointerType !== 'touch') lukk()
      },
      // Bare tastaturfokus. Et klikk viser allerede boblen gjennom pekeren, og
      // skal ikke i tillegg la den bli stående etterpå.
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.matches(':focus-visible')) return
        fokus.current = true
        apne(event.currentTarget)
      },
      onBlur: () => {
        fokus.current = false
        lukk()
      },
    }),
    [id, skjermleser, apne, lukk],
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
