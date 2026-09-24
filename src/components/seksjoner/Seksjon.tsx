import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { flushSync } from 'react-dom'
import { TREFFKLASSE, Uthevingskilde, useSokeord } from '../Uthev'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import {
  INNHOLDSATTRIBUTT,
  SKUFFATTRIBUTT,
  SeksjonsstyringKilde,
  skuffnokkel,
  useSeksjonsstyring,
  type Seksjonsstyring,
} from './Seksjonsstyring'
import { useSkjuling } from '../../hooks/useSkjuling'
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
 * - Bare én skuff per nivå står åpen: å åpne en skuff lukker søsknene, men
 *   ikke forelderen (se `Seksjonsstyring`). Når brukeren åpner en skuff,
 *   ruller siden den fram: midtstilt når den får plass, ellers med toppen
 *   øverst.
 *
 * Innholdet står i dokumentet også når skuffen er lukket, skjult med
 * `hidden="until-found"`. Da finner både søket på siden og nettleserens eget
 * søk det: søket åpner skuffene rundt treffet (se `Seksjonsstyring`), og
 * nettleseren sier fra med `beforematch`, som åpner skuffen og lukker
 * søsknene før nettleseren ruller til treffet. Skjult innhold er ellers
 * utenfor tabulatorrekkefølgen og skjermleseren.
 *
 * Åpning og lukking glir raskt, med høyden fra 0fr til 1fr (samme grep som
 * `Details`), og skjer umiddelbart for den som har bedt om mindre bevegelse,
 * og når søket eller en lenke åpner skuffen.
 */

/** Klassen skuffene har; seksjon og detaljkort er varianter av den. */
const KLASSE = 'skuff'

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

/** Detaljkortet elementet står i, om det står i et. */
export function detaljkortRundt(element: Element): HTMLElement | null {
  return element.closest<HTMLElement>(`.${KLASSE}--detalj`)
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
  /**
   * Knapper i hodet, f.eks. «Rediger». Står utenfor knappen som åpner og
   * lukker, men virker på innholdet, så en lukket skuff åpnes når en av dem
   * trykkes.
   */
  handlinger?: ReactNode
  /**
   * Ikonet foran overskriften, fra Atlas-registeret. En seksjon får det i en
   * sirkel, et detaljkort i underpunktstørrelse. Ikonet er pynt: tittelen
   * står alltid i tekst.
   */
  ikon?: Ikonnavn
  /** Om skuffen er åpen når siden tegnes. Lukket når ikke annet er sagt. */
  apenFraStart?: boolean
  className?: string
  children: ReactNode
}

export type SeksjonProps = Felles
export type DetaljkortProps = Felles

/**
 * Hovedseksjon på siden: en skuff med overskrift på nivå 2. Står den ikke i en
 * side med `SeksjonsstyringKilde`, får den sin egen, så detaljkortene i den
 * følger den samme regelen.
 */
export function Seksjon(props: SeksjonProps) {
  const niva = useContext(Nivakontekst)
  const styring = useSeksjonsstyring()
  if (niva) throw new Error(`Seksjonen «${props.id}» står inne i en annen skuff. Siden har bare to nivåer.`)
  if (!styring) {
    return (
      <SeksjonsstyringKilde>
        <Seksjon {...props} />
      </SeksjonsstyringKilde>
    )
  }
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

/** Styringen skuffen står i. En seksjon lager sin egen når siden ikke har en, så den finnes alltid her. */
function useStyring(): Seksjonsstyring {
  const styring = useSeksjonsstyring()
  if (!styring) throw new Error('En skuff må stå i en seksjon.')
  return styring
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
  ikon,
  apenFraStart = false,
  className,
  children,
}: Felles & { slag: 'seksjon' | 'detalj'; sti: readonly string[]; anker: string }) {
  const nokkel = skuffnokkel(sti)
  const styring = useStyring()
  const { registrer } = styring
  // Stien er en ny liste ved hver tegning; nøkkelen sier når den er en annen.
  const stien = useRef(sti)
  stien.current = sti
  useEffect(() => registrer(stien.current, apenFraStart), [registrer, nokkel, apenFraStart])
  const { apen, animer } = styring.tilstand(sti, apenFraStart)
  const sett = (apen: boolean) => styring.sett(sti, apen)
  const id = useId()
  const overskrift = `${id}-overskrift`
  const innholdId = `${id}-innhold`
  const oppsummeringId = `${id}-oppsummering`
  const treffId = `${id}-treff`
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const treff = useTreffI(inner)

  useSkjuling(kropp, inner, apen, animer)

  // Nettleserens eget søk fant noe i den lukkede skuffen. Skuffen åpnes, og
  // søsknene lukkes, før nettleseren ruller til treffet — så treffet står der
  // nettleseren tror det står.
  const { apneTil } = styring
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const aapne = () => flushSync(() => apneTil(el, false))
    el.addEventListener('beforematch', aapne)
    return () => el.removeEventListener('beforematch', aapne)
  }, [apneTil])

  const veksle = () => sett(!apen)
  // Et trykk hvor som helst i hodet åpner og lukker — men ikke på knappene i det.
  const trykkIHodet = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(INTERAKTIVT)) return
    if (!window.getSelection()?.isCollapsed) return
    veksle()
  }
  // Knappene i hodet virker på innholdet, så det må stå fram.
  const trykkPaaHandling = (event: MouseEvent<HTMLDivElement>) => {
    if (!apen && (event.target as Element).closest(INTERAKTIVT)) sett(true)
  }

  const Overskrift = slag === 'seksjon' ? 'h2' : 'h3'
  const Ramme = slag === 'seksjon' ? 'section' : 'div'
  const visOppsummering = !apen && oppsummering != null && oppsummering !== false && oppsummering !== ''
  const visTreff = !apen && treff > 0
  const beskrivelse = [visOppsummering && oppsummeringId, visTreff && treffId].filter(Boolean).join(' ')

  return (
    <Ramme
      id={anker}
      className={[KLASSE, `${KLASSE}--${slag}`, className].filter(Boolean).join(' ')}
      aria-labelledby={overskrift}
      {...(slag === 'detalj' && { role: 'group' })}
      {...{ [SKUFFATTRIBUTT]: nokkel }}
      data-apen={apen || undefined}
      data-stille={!animer || undefined}
      data-ikon={ikon ? '' : undefined}
    >
      {/* `data-ih`: ikonet spiller når hodet får pekeren eller fokus. */}
      <div className={`${KLASSE}__hode`} onClick={trykkIHodet} data-ih="">
        {ikon && (
          <span className={`${KLASSE}__ikon`}>
            <Ikon navn={ikon} storrelse={slag === 'seksjon' ? 'seksjon' : 'underpunkt'} />
          </span>
        )}
        <div className={`${KLASSE}__tekst`}>
          <Overskrift id={overskrift} className={`${KLASSE}__tittel`}>
            <button
              type="button"
              className={`${KLASSE}__knapp`}
              aria-expanded={apen}
              aria-controls={innholdId}
              {...(beskrivelse && { 'aria-describedby': beskrivelse })}
              onClick={veksle}
            >
              <span className={`${KLASSE}__tittelTekst`}>{tittel}</span>
            </button>
            {tittelTillegg}
          </Overskrift>
          {visOppsummering && (
            <p id={oppsummeringId} className={`${KLASSE}__oppsummering`}>
              <Uthevingskilde ord={INGEN_ORD}>{oppsummering}</Uthevingskilde>
            </p>
          )}
        </div>
        {visTreff && (
          <span id={treffId} className={`${KLASSE}__treff`}>
            {treff === 1 ? '1 treff' : `${treff} treff`}
          </span>
        )}
        {handlinger && (
          <div className={`${KLASSE}__handlinger`} onClick={trykkPaaHandling}>
            {handlinger}
          </div>
        )}
        {/* Pilen viser om skuffen er åpen; knappen sier det samme med `aria-expanded`. */}
        <span className={`${KLASSE}__pil`} aria-hidden="true">
          <Ikon navn="chev" />
        </span>
      </div>
      <div ref={kropp} className={`${KLASSE}__kropp`}>
        <div ref={inner} id={innholdId} className={`${KLASSE}__inner`} {...{ [INNHOLDSATTRIBUTT]: '' }}>
          <div className={`${KLASSE}__innhold`}>{children}</div>
        </div>
      </div>
    </Ramme>
  )
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
