import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { flushSync } from 'react-dom'
import { TREFFKLASSE, Uthevingskilde, useSokeord } from '../Uthev'
import { UnderOverskrift } from '../Overskriftsniva'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import {
  INNHOLDSATTRIBUTT,
  SKUFFATTRIBUTT,
  SeksjonsstyringKilde,
  VIS_HENDELSE,
  skuffnokkel,
  useSeksjonsstyring,
  type Seksjonsstyring,
} from './Seksjonsstyring'
import { useSkjuling } from '../../hooks/useSkjuling'
import { useRutenettflytting } from './Skuffrutenett'
import { useFlytting } from '../../hooks/useFlytting'
import { rullefart } from '../../hooks/useKortHopp'
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
 * og når søket eller en lenke åpner skuffen. Detaljkort i et `Skuffrutenett`
 * vokser og flytter seg sammen med naboene i stedet.
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
export interface DetaljkortProps extends Felles {
  /**
   * Om kortet kan åpnes. Et kort åpnes bare når det har mer å vise enn det
   * som står i det lukket: har det ikke det, er det et fast kort som viser
   * innholdet sitt rett under tittelen, uten pil og uten knapp. Innholdet
   * (`children`) skal da være så kort at det står fram i sin helhet. Det er
   * kortserien som vet hva den har å vise, og som avgjør (se `Kortserie` i
   * `Paneler.tsx`). Kan åpnes når ikke annet er sagt.
   */
  kanApnes?: boolean
}

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

/**
 * Detaljkort i en seksjon: en mindre skuff med overskrift på nivå 3, eller et
 * fast kort når det ikke har noe mer å vise (`kanApnes={false}`).
 */
export function Detaljkort({ kanApnes = true, ...props }: DetaljkortProps) {
  const niva = useContext(Nivakontekst)
  if (niva?.slag !== 'seksjon') {
    throw new Error(`Detaljkortet «${props.id}» må stå rett i en seksjon. Siden har bare to nivåer.`)
  }
  const sti = [niva.id, props.id]
  const anker = detaljanker(niva.id, props.id)
  return (
    <Nivakontekst.Provider value={{ slag: 'detalj' }}>
      {kanApnes ? <Skuff {...props} slag="detalj" sti={sti} anker={anker} /> : <Fastkort {...props} sti={sti} anker={anker} />}
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
  apenFraStart = false,
  ...resten
}: Felles & { slag: 'seksjon' | 'detalj'; sti: readonly string[]; anker: string }) {
  const nokkel = skuffnokkel(sti)
  const styring = useStyring()
  const { registrer, apneTil } = styring
  // Stien er en ny liste ved hver tegning; nøkkelen sier når den er en annen.
  const stien = useRef(sti)
  stien.current = sti
  useEffect(() => registrer(stien.current, apenFraStart), [registrer, nokkel, apenFraStart])
  const { apen, animer } = styring.tilstand(sti, apenFraStart)
  // Et detaljkort i et rutenett vokser og flytter seg med naboene i stedet for å gli opp (se `Skuffrutenett`).
  const rutenett = useRutenettflytting()
  const flyttes = slag === 'detalj' && rutenett !== null
  // Nettleserens eget søk fant noe i den lukkede skuffen. Skuffen åpnes, og
  // søsknene lukkes, før nettleseren ruller til treffet — så treffet står der
  // nettleseren tror det står.
  const funnet = useCallback((inner: HTMLElement) => apneTil(inner, false), [apneTil])

  return (
    <Skufframme
      {...resten}
      slag={slag}
      niva={slag === 'seksjon' ? 2 : 3}
      anker={anker}
      apen={apen}
      animer={animer}
      flyttes={flyttes}
      skuff={nokkel}
      onSett={(apnes) => {
        if (flyttes) rutenett()
        styring.sett(sti, apnes)
      }}
      onFunnet={funnet}
    />
  )
}

/**
 * Det en skuff tegner: hodet med ikon, tittel, oppsummering, treff, knapper
 * og pil, og kroppen som glir opp og igjen. Om den er åpen, og hva et trykk
 * gjør, bestemmer den som bruker den: en seksjon eller et detaljkort i
 * styringen for siden (`Skuff`), eller et underkort i en visning som styrer
 * seg selv (`Underkort`).
 */
function Skufframme({
  slag,
  niva,
  anker,
  apen,
  animer,
  flyttes,
  skuff,
  onSett,
  onFunnet,
  onVis,
  tittel,
  tittelTillegg,
  oppsummering,
  handlinger,
  ikon,
  className,
  children,
}: Omit<Felles, 'id' | 'apenFraStart'> & {
  slag: 'seksjon' | 'detalj'
  niva: 2 | 3 | 4
  anker?: string
  apen: boolean
  /** Usann når skiftet skal skje straks, uten å gli. */
  animer: boolean
  /** Sant når et rutenett flytter kortet i stedet for at det glir opp. */
  flyttes: boolean
  /** Nøkkelen i styringen for siden. Et underkort har ingen. */
  skuff?: string
  onSett: (apen: boolean) => void
  /** Nettleserens eget søk fant noe i den lukkede skuffen. */
  onFunnet: (inner: HTMLElement) => void
  /** Søket på siden skal vise noe i skuffen (`VIS_HENDELSE`). */
  onVis?: () => void
}) {
  const id = useId()
  const overskrift = `${id}-overskrift`
  const innholdId = `${id}-innhold`
  const oppsummeringId = `${id}-oppsummering`
  const treffId = `${id}-treff`
  const ramme = useRef<HTMLElement>(null)
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const treff = useTreffI(inner)

  useSkjuling(kropp, inner, apen, animer && !flyttes)

  // Skuffen må stå åpen før nettleseren ruller til treffet.
  const funnet = useRef(onFunnet)
  funnet.current = onFunnet
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const aapne = () => flushSync(() => funnet.current(el))
    el.addEventListener('beforematch', aapne)
    return () => el.removeEventListener('beforematch', aapne)
  }, [])

  const vis = useRef(onVis)
  vis.current = onVis
  useEffect(() => {
    const el = ramme.current
    if (!el || !vis.current) return
    const vises = () => vis.current?.()
    el.addEventListener(VIS_HENDELSE, vises)
    return () => el.removeEventListener(VIS_HENDELSE, vises)
  }, [])

  const veksle = () => onSett(!apen)
  // Et trykk hvor som helst i hodet åpner og lukker — men ikke på knappene i det.
  const trykkIHodet = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(INTERAKTIVT)) return
    if (!window.getSelection()?.isCollapsed) return
    veksle()
  }
  // Knappene i hodet virker på innholdet, så det må stå fram.
  const trykkPaaHandling = (event: MouseEvent<HTMLDivElement>) => {
    if (!apen && (event.target as Element).closest(INTERAKTIVT)) onSett(true)
  }

  const Overskrift = OVERSKRIFTER[niva]
  const Ramme = slag === 'seksjon' ? 'section' : 'div'
  const visOppsummering = !apen && oppsummering != null && oppsummering !== false && oppsummering !== ''
  const visTreff = !apen && treff > 0
  const beskrivelse = [visOppsummering && oppsummeringId, visTreff && treffId].filter(Boolean).join(' ')

  return (
    <Ramme
      ref={ramme as RefObject<HTMLDivElement>}
      id={anker}
      className={[KLASSE, `${KLASSE}--${slag}`, className].filter(Boolean).join(' ')}
      aria-labelledby={overskrift}
      {...(slag === 'detalj' && { role: 'group' })}
      {...(skuff !== undefined && { [SKUFFATTRIBUTT]: skuff })}
      data-apen={apen || undefined}
      data-stille={!animer || undefined}
      data-flyttes={flyttes || undefined}
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
        <div ref={inner} id={innholdId} className={`${KLASSE}__inner`} {...(skuff !== undefined && { [INNHOLDSATTRIBUTT]: '' })}>
          <div className={`${KLASSE}__innhold`}>
            <UnderOverskrift niva={niva}>{children}</UnderOverskrift>
          </div>
        </div>
      </div>
    </Ramme>
  )
}

const OVERSKRIFTER = { 2: 'h2', 3: 'h3', 4: 'h4' } as const

/**
 * Et detaljkort uten noe mer å vise: tittelen med innholdet rett under, slik
 * et lukket kort viser oppsummeringen sin, men i sin helhet. Det har ingen
 * knapp og ingen pil, for det er ingenting å åpne. Kortet er ikke en skuff i
 * styringen, men et sted som alltid står fram: en direktelenke dit åpner
 * seksjonen og ruller dit, og søket åpner seksjonen rundt et treff i det.
 */
function Fastkort({ sti, anker, ...resten }: Felles & { sti: readonly string[]; anker: string }) {
  const { fastSted } = useStyring()
  const ramme = useRef<HTMLDivElement>(null)
  const nokkel = skuffnokkel(sti)
  const stien = useRef(sti)
  stien.current = sti
  useEffect(() => {
    if (ramme.current) return fastSted(stien.current, ramme.current)
  }, [fastSted, nokkel])
  return <Fastramme {...resten} ramme={ramme} anker={anker} niva={3} />
}

/** Det et fast kort tegner: hodet med ikon og tittel, og innholdet rett under tittelen. */
function Fastramme({
  ramme,
  anker,
  niva,
  tittel,
  tittelTillegg,
  ikon,
  className,
  children,
}: Pick<Felles, 'tittel' | 'tittelTillegg' | 'ikon' | 'className' | 'children'> & {
  ramme?: RefObject<HTMLDivElement>
  anker?: string
  niva: 3 | 4
}) {
  const overskrift = `${useId()}-overskrift`
  const Overskrift = OVERSKRIFTER[niva]
  return (
    <div
      ref={ramme}
      id={anker}
      className={[KLASSE, `${KLASSE}--detalj`, `${KLASSE}--fast`, className].filter(Boolean).join(' ')}
      role="group"
      aria-labelledby={overskrift}
      data-ikon={ikon ? '' : undefined}
    >
      <div className={`${KLASSE}__hode`}>
        {ikon && (
          <span className={`${KLASSE}__ikon`}>
            <Ikon navn={ikon} storrelse="underpunkt" />
          </span>
        )}
        <div className={`${KLASSE}__tekst`}>
          <Overskrift id={overskrift} className={`${KLASSE}__tittel`}>
            <span className={`${KLASSE}__tittelTekst`}>{tittel}</span>
            {tittelTillegg}
          </Overskrift>
          <div className={`${KLASSE}__fastinnhold`}>
            <UnderOverskrift niva={niva}>{children}</UnderOverskrift>
          </div>
        </div>
      </div>
    </div>
  )
}

/* --- Underkort: en visning i et detaljkort som styrer seg selv ------------ */

interface Underkortstyring {
  apen: string | null
  /** Et trykk: åpner eller lukker kortet med flytting. */
  veksle: (id: string, apnes: boolean) => void
  /** Søket eller nettleseren skal vise noe i kortet: åpne det straks. */
  vis: (id: string) => void
}

const Underkortkontekst = createContext<Underkortstyring | null>(null)

/**
 * Kort i et rutenett inne i et detaljkort, når innholdet i kortet selv er en
 * samling som åpnes for seg — som organsystemene under en frekvens i
 * «Bivirkninger». Kortene ser ut og oppfører seg som detaljkort: bare ett står
 * åpent om gangen, et åpnet kort tar hele bredden og naboene glir dit de skal
 * (`useFlytting`), og et kort uten mer å vise er fast (`kanApnes={false}`).
 *
 * Det er ikke et tredje nivå med skuffer: rutenettet styrer seg selv og står
 * ikke i styringen for siden eller i adressen, slik styrkene i «Preparater»
 * gjør det. Innholdet i et lukket kort står i dokumentet med
 * `hidden="until-found"`, så nettleserens søk og søket på siden finner det og
 * åpner kortet (`beforematch` og `VIS_HENDELSE`).
 */
export function Underkortrutenett({
  etikett,
  apenFraStart = null,
  className,
  children,
}: {
  /** Navnet skjermlesere oppgir for lista. */
  etikett: string
  /** Kortet som står åpent fra start, om noe. */
  apenFraStart?: string | null
  className?: string
  children: ReactNode
}) {
  const niva = useContext(Nivakontekst)
  if (niva?.slag !== 'detalj') throw new Error('Underkortene må stå i et detaljkort.')
  const [apen, setApen] = useState<string | null>(apenFraStart)
  const liste = useRef<HTMLUListElement>(null)
  // Kortet brukeren åpnet, rulles fram når det har vokst ferdig.
  const rullTil = useRef(false)
  const husk = useFlytting(liste, {
    etter: () => {
      if (!rullTil.current) return
      rullTil.current = false
      liste.current?.querySelector(':scope > li > [data-apen]')?.scrollIntoView({ behavior: rullefart(), block: 'nearest' })
    },
  })
  const veksle = useCallback(
    (id: string, apnes: boolean) => {
      husk()
      rullTil.current = apnes
      setApen(apnes ? id : null)
    },
    [husk],
  )
  const styring = useMemo<Underkortstyring>(() => ({ apen, veksle, vis: setApen }), [apen, veksle])
  return (
    <Underkortkontekst.Provider value={styring}>
      <ul ref={liste} className={['skuffrutenett', 'underkortrutenett', className].filter(Boolean).join(' ')} aria-label={etikett}>
        {children}
      </ul>
    </Underkortkontekst.Provider>
  )
}

/**
 * Ett kort i et `Underkortrutenett`, med overskrift på nivå 4. Som et
 * detaljkort kan det åpnes bare når det har mer å vise; ellers er det fast og
 * viser `children` rett under tittelen.
 */
export function Underkort({
  id,
  anker,
  kanApnes = true,
  ...resten
}: Omit<DetaljkortProps, 'apenFraStart' | 'handlinger'> & {
  /** ID-en kortet har i dokumentet, så søket kan peke dit. */
  anker?: string
}) {
  const styring = useContext(Underkortkontekst)
  if (!styring) throw new Error(`Underkortet «${id}» må stå i et Underkortrutenett.`)
  const { vis } = styring
  const visDette = useCallback(() => vis(id), [vis, id])
  const klasse = [`${KLASSE}--underkort`, resten.className].filter(Boolean).join(' ')
  return (
    <li>
      {kanApnes ? (
        <Skufframme
          {...resten}
          className={klasse}
          slag="detalj"
          niva={4}
          anker={anker}
          apen={styring.apen === id}
          animer
          flyttes
          onSett={(apnes) => styring.veksle(id, apnes)}
          onFunnet={visDette}
          onVis={visDette}
        />
      ) : (
        <Fastramme {...resten} className={klasse} anker={anker} niva={4} />
      )}
    </li>
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
