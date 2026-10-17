import { useCallback, useEffect, useRef, useState } from 'react'
import { sammenlignSider, sidensKort, type Sideutgave } from '../../faginnhold/sidesammenligning'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import type { Kurateringsklient } from '../../kuratering/klient'
import { AGENTTILSTANDSNAVN, agenttilstand, type Aktivitet, type Grenstatusdata } from '../../kuratering/modell'
import { Merke, type Merketone } from '../Merke'
import { detaljkortRundt } from '../seksjoner/Seksjon'
import { TILPASSET, useSeksjonsstyring } from '../seksjoner/Seksjonsstyring'
import { elementAnker, panelAnker } from '../stoffside/Paneler'

/** Hvor ofte statusen spørres etter når agenten følges, og ellers. */
export const FOLG_HVER = 5_000
export const STATUS_HVER = 30_000

/** Hvor lenge et sted som nettopp er endret, er markert. */
export const NYLIG_I = 4_000
const NYLIG = 'utgave--nylig'

/** Tastene som ruller siden; trykker man på dem, følger man ikke agenten lenger. */
const RULLETASTER = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

const TILSTANDSTONE: Record<ReturnType<typeof agenttilstand>, Merketone> = {
  aktiv: 'referanse',
  venter: 'noytral',
  stanset: 'alvorlig',
  avsluttet: 'noytral',
  brutt: 'toksisk',
}

/**
 * Statusen til grenen, spurt jevnlig — oftere når agenten følges. Statusen er
 * liten og har ingen fagtekst; noe nytt i den gjør at grenen leses på nytt.
 * Feiler spørringen, er tilkoblingen brutt til neste svar kommer.
 */
export function useGrenstatus(klient: Kurateringsklient, gren: string, hver: number) {
  const [status, setStatus] = useState<Grenstatusdata | null>(null)
  const [brutt, setBrutt] = useState(false)
  const sjekk = useCallback(() => {
    klient.status(gren).then(
      (s) => {
        setStatus(s)
        setBrutt(false)
      },
      () => setBrutt(true),
    )
  }, [klient, gren])
  useJevnligSjekk(sjekk, hver)
  return { status, brutt }
}

/** Et sted på siden: et kort, seksjonen det står i, eller bare en seksjon. */
export interface Sted {
  kort?: string
  seksjon?: string
}

/** Stedene som er endret fra én utgave av siden til den neste; et nytt objekt for hver ny utgave. */
export interface Endringene {
  steder: Sted[]
}

/** Seksjonen bivirkningene står i; de er ikke kort, men tabeller (se `sidesammenligning`). */
const BIVIRKNINGSSEKSJON = 'bivirkninger'
/** Kildene til en seksjon er et felt på siden, `kilder-<seksjon>`. */
const SEKSJONSKILDER = 'side:kilder-'

/**
 * Stedene som er endret fra én utgave av siden til den neste og fortsatt står
 * på siden: kortene, med seksjonen de står i, og seksjonene der bivirkningene
 * eller kildene er endret.
 */
export function endredeSteder(for_: Sideutgave, etter: Sideutgave): Sted[] {
  const kortene = new Map(sidensKort(etter.side).map((e) => [e.id, e.innhold.panel]))
  const steder = new Map<string, Sted>()
  for (const e of sammenlignSider(for_, etter)) {
    if (!e.endret) continue
    const id = e.nokkel.slice(0, e.nokkel.indexOf(':'))
    const seksjon = kortene.get(id)
    if (seksjon !== undefined) steder.set(id, { kort: id, seksjon })
    else if (id === 'biv') steder.set(id, { seksjon: BIVIRKNINGSSEKSJON })
    else if (e.nokkel.startsWith(SEKSJONSKILDER)) steder.set(e.nokkel, { seksjon: e.nokkel.slice(SEKSJONSKILDER.length) })
  }
  return [...steder.values()]
}

/**
 * Det som er endret i den siste utgaven som vises, regnet ut i samme tegning
 * som utgaven kommer, så ingenting merkes eller åpnes etter den forrige.
 */
export function useEndringene(visning: Sideutgave | null): Endringene | null {
  const [spor, setSpor] = useState<{
    visning: Sideutgave | null
    endringene: Endringene | null
  }>({ visning, endringene: null })
  if (visning && visning !== spor.visning) {
    const endringene = spor.visning ? { steder: endredeSteder(spor.visning, visning) } : null
    setSpor({ visning, endringene })
    return endringene
  }
  return spor.endringene
}

/** Elementet stedet er på siden: kortet når det står der, ellers seksjonen. */
function elementFor(sted: Sted): HTMLElement | null {
  const kort = sted.kort ? document.getElementById(elementAnker(sted.kort)) : null
  return kort ?? (sted.seksjon ? document.getElementById(panelAnker(sted.seksjon)) : null)
}

/** Flaten som merkes og rulles fram: detaljkortet elementet står i, eller elementet selv. */
function flatenFor(element: HTMLElement): HTMLElement {
  return detaljkortRundt(element) ?? element
}

/** Hvor lenge det ventes på at et sted skal tegnes — innholdet hentes når utgaven skifter. */
const VENT_I = 10_000

/**
 * Kjører `gjor` med elementet til stedet så snart det står på siden: straks,
 * eller når innholdet er tegnet, innen `VENT_I`. Gir tilbake opprydningen.
 */
function naarDetStar(sted: Sted, gjor: (element: HTMLElement) => void): () => void {
  const funnet = elementFor(sted)
  if (funnet) {
    gjor(funnet)
    return () => {}
  }
  const vakt = new MutationObserver(() => {
    const element = elementFor(sted)
    if (!element) return
    stopp()
    gjor(element)
  })
  const frist = window.setTimeout(() => stopp(), VENT_I)
  const stopp = () => {
    vakt.disconnect()
    window.clearTimeout(frist)
  }
  vakt.observe(document.body, { childList: true, subtree: true })
  return stopp
}

/** Klassen, attributtet og teksten som merker stedet agenten arbeider. */
const AGENT = 'utgave--agent'
const AGENTMERKE = 'data-agentmerke'
const AGENTTEKST = 'Agenten arbeider her'

/** Om stedet er der agenten sier den arbeider. */
function sammeSted(sted: Sted, aktivitet: Aktivitet | undefined): boolean {
  return Boolean(aktivitet && (sted.kort ? sted.kort === aktivitet.objekt : sted.seksjon === aktivitet.seksjon))
}

/**
 * Hvor «Følg agenten» skal vise: når en ny utgave er kommet, det som er endret
 * — helst der agenten sier den arbeider — og ellers stedet agenten sier den
 * arbeider med.
 */
function hvorHen(endringene: Endringene | null, nye: boolean, aktivitet: Aktivitet | undefined): Sted | null {
  const endret = nye ? (endringene?.steder ?? []) : []
  const der = endret.find((s) => sammeSted(s, aktivitet)) ?? endret.find((s) => s.seksjon === aktivitet?.seksjon) ?? endret[0]
  if (der) return der
  return aktivitet?.objekt || aktivitet?.seksjon ? { kort: aktivitet.objekt, seksjon: aktivitet.seksjon } : null
}

/**
 * «Følg agenten», inne på siden: åpner seksjonen og detaljkortet agenten
 * arbeider i — eller det den nettopp endret, når en ny revisjon kommer — og
 * ruller dit, og merker stedet så lenge agenten er der. Kortene som er endret,
 * lyser opp en liten stund når en ny revisjon vises, så den som følger med ser
 * hva agenten nettopp gjorde. Står i sidens `SeksjonsstyringKilde`, så den kan
 * åpne skuffene.
 */
export function Agentfolging({
  pa,
  aktivitet,
  endringene,
}: {
  pa: boolean
  aktivitet: Aktivitet | undefined
  endringene: Endringene | null
}) {
  const apneTil = useSeksjonsstyring()?.apneTil
  useNyligEndret(endringene)

  // Endringene som er vist fram; slås følgingen på, er det agenten som vises, ikke det som alt er endret.
  const vist = useRef<Endringene | null>(null)
  useEffect(() => {
    const nye = endringene !== vist.current
    vist.current = endringene
    if (!pa || !apneTil) return
    const sted = hvorHen(endringene, nye, aktivitet)
    if (!sted) return
    let merket: HTMLElement | null = null
    const stopp = naarDetStar(sted, (element) => {
      const flate = flatenFor(element)
      apneTil(flate, TILPASSET)
      flate.classList.add(AGENT)
      flate.setAttribute(AGENTMERKE, AGENTTEKST)
      merket = flate
    })
    return () => {
      stopp()
      merket?.classList.remove(AGENT)
      merket?.removeAttribute(AGENTMERKE)
    }
  }, [pa, apneTil, endringene, aktivitet?.kl, aktivitet?.objekt, aktivitet?.seksjon]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Lar stedene som er endret i den nye revisjonen lyse opp en liten stund, også de som tegnes litt etter. */
function useNyligEndret(endringene: Endringene | null) {
  useEffect(() => {
    if (!endringene?.steder.length) return
    const merket: HTMLElement[] = []
    const stopp = endringene.steder.map((sted) =>
      naarDetStar(sted, (element) => {
        const flate = flatenFor(element)
        flate.classList.add(NYLIG)
        merket.push(flate)
      }),
    )
    const frist = window.setTimeout(() => merket.forEach((e) => e.classList.remove(NYLIG)), NYLIG_I)
    return () => {
      stopp.forEach((s) => s())
      window.clearTimeout(frist)
      merket.forEach((e) => e.classList.remove(NYLIG))
    }
  }, [endringene])
}

/**
 * Slutter å følge agenten når man ruller selv (hjul, berøring eller tastene).
 */
export function useSlaAvVedRulling(pa: boolean, onAv: () => void) {
  useEffect(() => {
    if (!pa) return
    const av = () => onAv()
    const tast = (e: KeyboardEvent) => {
      const felt = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')
      if (!felt && RULLETASTER.has(e.key)) onAv()
    }
    window.addEventListener('wheel', av, { passive: true })
    window.addEventListener('touchmove', av, { passive: true })
    window.addEventListener('keydown', tast)
    return () => {
      window.removeEventListener('wheel', av)
      window.removeEventListener('touchmove', av)
      window.removeEventListener('keydown', tast)
    }
  }, [pa, onAv])
}

/** Hva agenten gjør: aktiv (med belegg), venter, stanset, avsluttet, eller brutt tilkobling. */
export function Agentindikator({ status, brutt }: { status: Grenstatusdata | null; brutt: boolean }) {
  const tilstand = agenttilstand(status, brutt)
  return <Merke tone={TILSTANDSTONE[tilstand]}>{AGENTTILSTANDSNAVN[tilstand]}</Merke>
}
