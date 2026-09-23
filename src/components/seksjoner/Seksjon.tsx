import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { TREFFKLASSE, Uthevingskilde, useSokeord } from '../Uthev'
import {
  SKUFFATTRIBUTT,
  skuffnokkel,
  useSeksjonsstyring,
  type Skufftilstand,
} from './Seksjonsstyring'
import '../../styles/seksjoner.css'

/**
 * Progressiv detaljering på en side: seksjoner som trekkspillskuffer, og
 * detaljkort inne i dem. Beskrevet i `docs/seksjoner.md`.
 *
 * - Lukket viser en skuff overskriften og en kort oppsummering.
 * - Åpnet viser den innholdet, som kan ha detaljkort som åpnes for seg.
 * - Det er to nivåer og ikke flere: seksjon → detaljkort. En seksjon i en
 *   seksjon, eller et detaljkort utenfor en seksjon eller i et annet, er en
 *   programmeringsfeil og stopper tegningen.
 *
 * Innholdet står i dokumentet også når skuffen er lukket, skjult med
 * `hidden="until-found"`. Da finner både søket på siden og nettleserens eget
 * søk det: søket åpner skuffene rundt treffet (se `Seksjonsstyring`), og
 * nettleseren sier fra med `beforematch`, som åpner skuffen. Skjult innhold er
 * ellers utenfor tabulatorrekkefølgen og skjermleseren.
 *
 * Åpning og lukking glir raskt, med høyden fra 0fr til 1fr (samme grep som
 * `Details`), og skjer umiddelbart for den som har bedt om mindre bevegelse,
 * og når søket eller en lenke åpner skuffen.
 */

/** Klassen skuffene har; seksjon og detaljkort er varianter av den. */
const KLASSE = 'skuff'

/** Hvor lenge skjulingen venter på at lukkingen skal gli ferdig, før den skjer likevel. */
const MAKS_GLIDETID = 450

/** Nivået en skuff står på, så to nivåer ikke blir flere. */
type Niva = { slag: 'seksjon'; id: string } | { slag: 'detalj' }
const Nivakontekst = createContext<Niva | null>(null)

/** Ankeret en seksjon har på siden. */
export function seksjonsanker(id: string): string {
  return `panel-${id}`
}

/** Ankeret et detaljkort har på siden. */
export function detaljanker(seksjon: string, kort: string): string {
  return `${seksjonsanker(seksjon)}--${kort}`
}

interface Felles {
  /**
   * Fast nøkkel for skuffen. Står i adressen (`#/analytt/KODE/<seksjon>/<kort>`)
   * og i ankeret, og må derfor ikke endres når innholdet endres.
   */
  id: string
  /** Overskriften. Tekst som skal kunne fremheves av søket, går gjennom `Uthev`. */
  tittel: ReactNode
  /**
   * Står i overskriften etter tittelen, utenfor knappen som åpner og lukker —
   * for noe som selv kan trykkes på, som en referansepille.
   */
  tittelTillegg?: ReactNode
  /**
   * Kort oppsummering som vises når skuffen er lukket, f.eks. «12 preparater
   * · 3 legemiddelformer». Søket fremhever ikke i den; treffene telles i
   * innholdet.
   */
  oppsummering?: ReactNode
  /** Knapper i hodet, f.eks. «Rediger». Står utenfor knappen som åpner og lukker. */
  handlinger?: ReactNode
  /** Om skuffen er åpen når siden tegnes. Lukket når ikke annet er sagt. */
  apenFraStart?: boolean
  className?: string
  children: ReactNode
}

export type SeksjonProps = Felles
export type DetaljkortProps = Felles

/** Hovedseksjon på siden: en skuff med overskrift på nivå 2. */
export function Seksjon(props: SeksjonProps) {
  const niva = useContext(Nivakontekst)
  if (niva) throw new Error(`Seksjonen «${props.id}» står inne i en annen skuff. Siden har bare to nivåer.`)
  return (
    <Nivakontekst.Provider value={{ slag: 'seksjon', id: props.id }}>
      <Skuff {...props} slag="seksjon" sti={[props.id]} anker={seksjonsanker(props.id)} />
    </Nivakontekst.Provider>
  )
}

/** Detaljkort i en seksjon: en mindre skuff med overskrift på nivå 3. */
export function Detaljkort(props: DetaljkortProps) {
  const niva = useContext(Nivakontekst)
  if (niva?.slag !== 'seksjon') {
    throw new Error(`Detaljkortet «${props.id}» må stå rett i en seksjon. Siden har bare to nivåer.`)
  }
  return (
    <Nivakontekst.Provider value={{ slag: 'detalj' }}>
      <Skuff {...props} slag="detalj" sti={[niva.id, props.id]} anker={detaljanker(niva.id, props.id)} />
    </Nivakontekst.Provider>
  )
}

/** Tilstanden til skuffen: fra styringen for siden når den finnes, ellers skuffens egen. */
function useSkufftilstand(nokkel: string, apenFraStart: boolean): [Skufftilstand, (apen: boolean) => void] {
  const styring = useSeksjonsstyring()
  const [egen, setEgen] = useState<Skufftilstand>({ apen: apenFraStart, animer: true })
  const registrer = styring?.registrer
  useEffect(() => registrer?.(nokkel, apenFraStart), [registrer, nokkel, apenFraStart])
  if (styring) return [styring.tilstand(nokkel, apenFraStart), (apen) => styring.sett(nokkel, apen)]
  return [egen, (apen) => setEgen({ apen, animer: true })]
}

/** Interaktivt innhold i hodet som har sin egen jobb når det trykkes på. */
const INTERAKTIVT = 'button, a, input, select, textarea, label, summary, [role="button"]'

/** Tomme søkeord: oppsummeringen fremheves ikke, så treffene bare telles i innholdet. */
const INGEN_ORD: readonly string[] = []

function Skuff({
  slag,
  sti,
  anker,
  tittel,
  tittelTillegg,
  oppsummering,
  handlinger,
  apenFraStart = false,
  className,
  children,
}: Felles & { slag: 'seksjon' | 'detalj'; sti: readonly string[]; anker: string }) {
  const nokkel = skuffnokkel(sti)
  const [{ apen, animer }, sett] = useSkufftilstand(nokkel, apenFraStart)
  const id = useId()
  const overskrift = `${id}-overskrift`
  const innholdId = `${id}-innhold`
  const oppsummeringId = `${id}-oppsummering`
  const treffId = `${id}-treff`
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const treff = useTreffI(inner)

  useSkjuling(kropp, inner, apen, animer)

  // Nettleserens eget søk fant noe i den lukkede skuffen.
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const aapne = () => sett(true)
    el.addEventListener('beforematch', aapne)
    return () => el.removeEventListener('beforematch', aapne)
  })

  const veksle = () => sett(!apen)
  // Et trykk hvor som helst i hodet åpner og lukker — men ikke på knappene i det.
  const trykkIHodet = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(INTERAKTIVT)) return
    if (!window.getSelection()?.isCollapsed) return
    veksle()
  }

  const Overskrift = slag === 'seksjon' ? 'h2' : 'h3'
  const Ramme = slag === 'seksjon' ? 'section' : 'div'
  const visOppsummering = !apen && oppsummering != null && oppsummering !== false && oppsummering !== ''
  const visTreff = !apen && treff > 0
  const beskrivelse = [visOppsummering && oppsummeringId, visTreff && treffId].filter(Boolean).join(' ')

  return (
    <Ramme
      id={anker}
      className={[KLASSE, `${KLASSE}--${slag}`, slag === 'seksjon' && 'kort kort--start', className]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={overskrift}
      {...(slag === 'detalj' && { role: 'group' })}
      {...{ [SKUFFATTRIBUTT]: nokkel }}
      data-apen={apen || undefined}
      data-stille={!animer || undefined}
    >
      <div className={`${KLASSE}__hode`} onClick={trykkIHodet}>
        <Overskrift id={overskrift} className={`${KLASSE}__tittel`}>
          <button
            type="button"
            className={`${KLASSE}__knapp`}
            aria-expanded={apen}
            aria-controls={innholdId}
            {...(beskrivelse && { 'aria-describedby': beskrivelse })}
            onClick={veksle}
          >
            <span className={`${KLASSE}__pil`} aria-hidden="true" />
            <span className={`${KLASSE}__tittelTekst`}>{tittel}</span>
          </button>
          {tittelTillegg}
        </Overskrift>
        {visTreff && (
          <span id={treffId} className={`${KLASSE}__treff`}>
            {treff === 1 ? '1 treff' : `${treff} treff`}
          </span>
        )}
        {handlinger && <div className={`${KLASSE}__handlinger`}>{handlinger}</div>}
        {visOppsummering && (
          <p id={oppsummeringId} className={`${KLASSE}__oppsummering`}>
            <Uthevingskilde ord={INGEN_ORD}>{oppsummering}</Uthevingskilde>
          </p>
        )}
      </div>
      <div ref={kropp} className={`${KLASSE}__kropp`}>
        <div ref={inner} id={innholdId} className={`${KLASSE}__inner`}>
          <div className={`${KLASSE}__innhold`}>{children}</div>
        </div>
      </div>
    </Ramme>
  )
}

/**
 * Skjuler innholdet når skuffen lukkes — etter at lukkingen har glidd ferdig,
 * så innholdet ikke forsvinner før det rakk å gli sammen — og viser det straks
 * skuffen åpnes. Mens skuffen glir, bærer kroppen `data-glir`, og innholdet
 * klippes; ellers står det fritt, så fokusrammer og bobler ikke kuttes.
 */
function useSkjuling(
  kropp: RefObject<HTMLDivElement>,
  inner: RefObject<HTMLDivElement>,
  apen: boolean,
  animer: boolean,
) {
  const tegnet = useRef(false)
  useLayoutEffect(() => {
    const boks = kropp.current
    const el = inner.current
    if (!boks || !el) return
    const forste = !tegnet.current
    tegnet.current = true
    const glir = animer && !forste && !redusertBevegelse()

    if (apen) el.removeAttribute('hidden')
    if (!glir) {
      delete boks.dataset.glir
      if (!apen) el.setAttribute('hidden', 'until-found')
      return
    }

    boks.dataset.glir = ''
    let ferdig = false
    const avslutt = () => {
      if (ferdig) return
      ferdig = true
      boks.removeEventListener('transitionend', paaSlutt)
      window.clearTimeout(frist)
      delete boks.dataset.glir
      if (!apen) el.setAttribute('hidden', 'until-found')
    }
    const paaSlutt = (event: TransitionEvent) => {
      if (event.target === boks && event.propertyName === 'grid-template-rows') avslutt()
    }
    boks.addEventListener('transitionend', paaSlutt)
    const frist = window.setTimeout(avslutt, MAKS_GLIDETID)
    // Snur skuffen før den er ferdig, overtar neste runde uten å skjule.
    return () => {
      ferdig = true
      boks.removeEventListener('transitionend', paaSlutt)
      window.clearTimeout(frist)
    }
  }, [kropp, inner, apen, animer])
}

function redusertBevegelse(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Hvor mange søketreff som står i innholdet. Vises på lukkede skuffer. */
function useTreffI(inner: RefObject<HTMLElement>): number {
  const ord = useSokeord()
  const [antall, setAntall] = useState(0)
  // Uten avhengigheter: treffene telles etter hver tegning, og tellingen er billig.
  useEffect(() => {
    setAntall(ord.length === 0 ? 0 : (inner.current?.querySelectorAll(`mark.${TREFFKLASSE}`).length ?? 0))
  })
  return antall
}
