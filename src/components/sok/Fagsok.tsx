import { useDeferredValue, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { sokeside } from '../../domain/rute'
import { FAGSOK_LAG } from '../../hooks/useKeyboard'
import type { Sokeindekstilstand } from '../../hooks/useSokeindeks'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Fagsokfelt } from '../toppmeny/Fagsokfelt'
import { Toppmenyknapp } from '../toppmeny/Toppmenyknapp'
import { Markert } from './Markert'
import { useFagsoketreff } from './useFagsoketreff'

/** Flest treff i rullegardinen. Resten står på søkesiden. */
export const MAKS_I_RULLEGARDIN = 6

export interface FagsokProps {
  /** Indeksen over fagstoffet (`useSokeindeks`). */
  indeks: Sokeindekstilstand
  /** Ber om indeksen: første gang feltet får fokus, og etter en feil. */
  onKrev: () => void
  /** Søket i adressen mens søkesiden står åpen, så feltet viser det samme. */
  sporring?: string
  /** Linja under et stoff: koden, analysemetoden og kategorien. */
  beskrivSide?: (kode: string) => string | undefined
  /** Går til adressen: et treff, eller søkesiden. */
  onGaaTil: (adresse: string) => void
}

/**
 * Det globale fagsøket i toppmenyen: feltet, og en rullegardin med de beste
 * treffene i alle de publiserte stoffsidene. Det er noe annet enn analyttsøket
 * som driver fortolkningen, og rører det ikke.
 *
 * Feltet er en kombinasjonsboks: piltastene velger et treff, `Enter` åpner
 * det, og `Escape` lukker rullegardinen (deretter tømmer den feltet). Uten
 * valgt treff går `Enter` til søkesiden, der alle treffene står. Mens fokus
 * står her, er fagsøket et lag over appen (`FAGSOK_LAG`), så det som skrives,
 * aldri når tastene i fortolkningen bak.
 */
export function Fagsok({ indeks, onKrev, sporring, beskrivSide, onGaaTil }: FagsokProps) {
  const id = useId()
  const felt = useRef<HTMLInputElement>(null)
  const [verdi, setVerdi] = useState(sporring ?? '')
  const [fokus, setFokus] = useState(false)
  const [apen, setApen] = useState(false)
  const [aktiv, setAktiv] = useState(0)
  const soket = useDeferredValue(verdi)
  const { treff, vis } = useFagsoketreff(indeks, soket, beskrivSide)
  const viste = treff.slice(0, MAKS_I_RULLEGARDIN).map(vis)
  const harSok = verdi.trim() !== ''
  const visListe = fokus && apen && harSok
  // Treffene henger etter feltet mens React regner ut det nye søket. Da står
  // ingen rad valgt, så `Enter` går til søkesiden med teksten i feltet i
  // stedet for å åpne et treff fra søket før.
  const forsinket = soket !== verdi
  // Listen kan ha blitt kortere siden raden ble valgt.
  const valgtIndeks = aktiv < 0 || forsinket ? -1 : Math.min(aktiv, viste.length - 1)
  const valgt = visListe ? viste[valgtIndeks] : undefined

  // Søkesiden og feltet viser det samme søket.
  useEffect(() => {
    if (sporring !== undefined) setVerdi(sporring)
  }, [sporring])

  const endre = (ny: string) => {
    setVerdi(ny)
    setApen(true)
    setAktiv(0)
    onKrev()
  }

  const ga = (adresse: string) => {
    setApen(false)
    felt.current?.blur()
    onGaaTil(adresse)
  }
  const visAlle = () => ga(sokeside(verdi.trim()))

  const paaTast = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!harSok) return
        event.preventDefault()
        if (!apen) return setApen(true)
        // Over det første treffet står ingen valgt: da går `Enter` til søkesiden.
        const siste = Math.max(viste.length - 1, 0)
        setAktiv(event.key === 'ArrowDown' ? Math.min(valgtIndeks + 1, siste) : Math.max(valgtIndeks - 1, -1))
        return
      }
      case 'Enter':
        if (!harSok) return
        event.preventDefault()
        if (valgt) ga(valgt.adresse)
        else visAlle()
        return
      case 'Escape':
        event.preventDefault()
        if (visListe) setApen(false)
        else if (verdi) setVerdi('')
        else felt.current?.blur()
        return
    }
  }

  // Fokus kan gå til knappene i rullegardinen uten at den lukkes.
  const utAv = (event: FocusEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setFokus(false)
    setApen(false)
  }

  const listeId = `${id}-treff`
  const radId = (i: number) => `${id}-treff-${i}`

  return (
    <div
      className="fagsokkilde"
      {...(fokus && { 'data-lag': FAGSOK_LAG })}
      onFocus={() => {
        setFokus(true)
        setApen(true)
        onKrev()
      }}
      onBlur={utAv}
    >
      <Fagsokfelt
        ref={felt}
        verdi={verdi}
        onEndre={endre}
        onKeyDown={paaTast}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visListe}
        aria-controls={listeId}
        {...(valgt && { 'aria-activedescendant': radId(valgtIndeks) })}
      >
        <div className="fagsok__rullegardin" hidden={!visListe}>
          <Liste
            indeks={indeks}
            onKrev={onKrev}
            antall={treff.length}
            forsinket={forsinket}
          >
            <div id={listeId} role="listbox" aria-label="Treff i fagstoff" className="fagsok__treff">
              {viste.map((t, i) => (
                <a
                  key={t.nokkel}
                  id={radId(i)}
                  href={t.adresse}
                  role="option"
                  aria-selected={i === valgtIndeks}
                  tabIndex={-1}
                  className="fagsok__rad"
                  data-ih=""
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setAktiv(i)}
                  onClick={(e) => {
                    e.preventDefault()
                    ga(t.adresse)
                  }}
                >
                  <span className="fagsok__radikon">
                    <Ikon navn={t.ikon} storrelse="ui" />
                  </span>
                  <span className="fagsok__radtekst">
                    <span className="fagsok__radtittel">
                      <Markert {...t.tittel} />
                    </span>
                    <span className="fagsok__radsti">
                      {t.sti.join(' › ')}
                      {t.utdrag && (
                        <>
                          {' · '}
                          <Markert {...t.utdrag} />
                        </>
                      )}
                    </span>
                  </span>
                  <span className="fagsok__radtype">{t.type}</span>
                </a>
              ))}
            </div>
          </Liste>
          <div className="fagsok__bunn">
            <span className="fagsok__hint" aria-hidden="true">
              ↑ ↓ velg · Enter åpne · Esc lukk
            </span>
            <Toppmenyknapp ikon="search" variant="primar" onClick={visAlle}>
              {`Vis alle treff (${treff.length})`}
            </Toppmenyknapp>
          </div>
        </div>
      </Fagsokfelt>
    </div>
  )
}

/** Innholdet i rullegardinen etter hvor langt indeksen har kommet. */
function Liste({
  indeks,
  onKrev,
  antall,
  forsinket,
  children,
}: {
  indeks: Sokeindekstilstand
  onKrev: () => void
  antall: number
  forsinket: boolean
  children: React.ReactNode
}) {
  if (indeks.status === 'feil') {
    return (
      <div className="fagsok__melding" role="alert">
        <p>Fikk ikke hentet fagstoffet.</p>
        <Button variant="subtle" onClick={onKrev}>
          Prøv igjen
        </Button>
      </div>
    )
  }
  if (indeks.status !== 'klar') {
    return (
      <p className="fagsok__melding" role="status">
        Henter fagstoffet …
      </p>
    )
  }
  return (
    <>
      {antall === 0 && !forsinket && <p className="fagsok__melding">Ingen treff i fagstoffet.</p>}
      {children}
      <p className="kun-skjermleser" role="status">
        {forsinket ? '' : antall === 1 ? '1 treff' : `${antall} treff`}
      </p>
    </>
  )
}
