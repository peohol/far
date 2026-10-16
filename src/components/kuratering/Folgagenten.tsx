import { useCallback, useEffect, useRef, useState } from 'react'
import { sammenlignSider, sidensKort, type Sideutgave } from '../../faginnhold/sidesammenligning'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import type { Kurateringsklient } from '../../kuratering/klient'
import { AGENTTILSTANDSNAVN, agenttilstand, type Aktivitet, type Grenstatusdata } from '../../kuratering/modell'
import { Merke, type Merketone } from '../Merke'
import { elementAnker, panelAnker } from '../stoffside/Paneler'

/** Hvor ofte statusen spørres etter når agenten følges, og ellers. */
export const FOLG_HVER = 5_000
export const STATUS_HVER = 30_000

/** Hvor lenge et kort som nettopp er endret, er markert. */
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

/** Kortet, eller seksjonen, agenten sier den arbeider med, når det står på siden. */
function maalet(aktivitet: Aktivitet): HTMLElement | null {
  const kort = aktivitet.objekt ? document.getElementById(elementAnker(aktivitet.objekt)) : null
  if (kort && kort.offsetParent !== null) return kort
  return aktivitet.seksjon ? document.getElementById(panelAnker(aktivitet.seksjon)) : kort
}

/**
 * «Følg agenten»: ruller til det agenten arbeider med hver gang den melder
 * noe nytt, og når siden er lest på nytt. Ruller man selv (hjul, berøring
 * eller tastene), slås følgingen av.
 */
export function useFolging(pa: boolean, aktivitet: Aktivitet | undefined, revisjon: number, onAv: () => void) {
  useEffect(() => {
    if (!pa || !aktivitet) return
    maalet(aktivitet)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [pa, aktivitet?.kl, aktivitet?.objekt, aktivitet?.seksjon, revisjon]) // eslint-disable-line react-hooks/exhaustive-deps

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

/** Kortene som er endret fra én utgave av siden til den neste, og fortsatt står på siden. */
export function endredeKort(for_: Sideutgave, etter: Sideutgave): string[] {
  const kort = new Set(sidensKort(etter.side).map((e) => e.id))
  const ider = sammenlignSider(for_, etter)
    .filter((e) => e.endret)
    .map((e) => e.nokkel.slice(0, e.nokkel.indexOf(':')))
  return [...new Set(ider)].filter((id) => kort.has(id))
}

/**
 * Markerer kortene som er endret en liten stund når en ny revisjon vises,
 * så den som følger med ser hva agenten nettopp gjorde.
 */
export function useNyligEndret(visning: Sideutgave | null) {
  const forrige = useRef<Sideutgave | null>(null)
  useEffect(() => {
    const for_ = forrige.current
    forrige.current = visning
    if (!for_ || !visning || for_ === visning) return
    const elementer = endredeKort(for_, visning)
      .map((id) => document.getElementById(elementAnker(id)))
      .filter((e): e is HTMLElement => e !== null)
    elementer.forEach((e) => e.classList.add(NYLIG))
    const frist = window.setTimeout(() => elementer.forEach((e) => e.classList.remove(NYLIG)), NYLIG_I)
    return () => {
      window.clearTimeout(frist)
      elementer.forEach((e) => e.classList.remove(NYLIG))
    }
  }, [visning])
}

/** Hva agenten gjør: aktiv (med belegg), venter, stanset, avsluttet, eller brutt tilkobling. */
export function Agentindikator({ status, brutt }: { status: Grenstatusdata | null; brutt: boolean }) {
  const tilstand = agenttilstand(status, brutt)
  return <Merke tone={TILSTANDSTONE[tilstand]}>{AGENTTILSTANDSNAVN[tilstand]}</Merke>
}
