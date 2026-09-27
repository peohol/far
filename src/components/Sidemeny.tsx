import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Felt } from './konto/Felt'
import { Shortcut } from './Shortcut'
import { Ikon } from './ikon/Ikon'
import { useTips } from './Tips'
import type { Analyttkatalog } from '../domain/analyttkatalog'
import { analyttadresse, stoffadresse } from '../domain/rute'
import { byggStoffregister, type Registerkategori, type Registerstoff } from '../domain/stoffregister'
import { fokusIFagsok, lagLiggerOver } from '../hooks/useKeyboard'
import { rullefart } from '../hooks/useKortHopp'

/**
 * Sidemenyen: stoffregisteret.
 *
 * Menyen er veien inn til informasjonssiden for hvert stoff, ordnet etter
 * farmakologisk klasse (`src/domain/stoffregister.ts`). Stoffene med og uten
 * analyttkode står om hverandre; de med kode viser koden. Søket i
 * fortolkningen filtreres ikke herfra, men fra hovedsiden (`Filterbytte`).
 *
 * Innholdet bygges av katalogen — de samme søkeoppføringene som søket bruker
 * — og stoffsidene uten kode i databasen, så lista ikke kan komme i utakt med
 * det appen har sider for. Stoffene er lenker, så de også kan åpnes i en ny
 * fane. Redaktørene kan lage en ny stoffside nederst.
 *
 * Menyen er et lag over appen, på linje med endringsloggen: `data-lag` sier
 * fra til `lagLiggerOver()`, slik at appens egne taster holder seg i ro mens
 * den står åpen.
 */

/** Hvor lenge det ventes før en nyåpnet skuff hentes fram i bildet. */
const ETTER_GLIDNING = 300

/** Tasten som åpner og lukker menyen. */
const MENY_SNARVEI = 'Ctrl + M'

/** Navnet på menyen, i tittelen og for skjermlesere. */
const TITTEL = 'Stoffregister'

/** Merket menyen bærer som `data-lag` mens den står åpen. */
const MENY_LAG = 'meny'

/** Sant mens sidemenyen står åpen over appen. */
export function sidemenyenErApen(): boolean {
  return document.querySelector(`[data-lag="${MENY_LAG}"]`) !== null
}

/** Alt som kan få fokus i panelet. */
const FOKUSERBART = 'button, input, [href], [tabindex]:not([tabindex="-1"])'

/**
 * Feltene i panelet som faktisk kan nås nå.
 *
 * Innholdet i en lukket skuff er satt `visibility: hidden`, og den arves, så
 * det holder å lese den av for å utelate hele skuffen.
 */
function naabare(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return []
  return [...panel.querySelectorAll<HTMLElement>(FOKUSERBART)].filter(
    (el) => getComputedStyle(el).visibility !== 'hidden',
  )
}

export interface SidemenyProps {
  /** Kodene appen har sider for — de samme som søket leter i. */
  katalog: Analyttkatalog
  /** Navnene på stoffsidene uten analyttkode. */
  stoffsider?: readonly string[]
  /** Sant når brukeren kan lage en ny stoffside. */
  kanOpprette?: boolean
}

export function Sidemeny({ katalog, stoffsider = [], kanOpprette = false }: SidemenyProps) {
  const [apen, setApen] = useState(false)
  /** Av gjemmer underkategoriene og lister stoffene i hver kategori i én alfabetisk bolk. */
  const [visUnderkategorier, setVisUnderkategorier] = useState(true)
  /** Kategorien med åpen skuff — bare én av gangen. */
  const [apenSkuff, setApenSkuff] = useState<string | null>(null)
  const panelId = useId()
  const panel = useRef<HTMLElement>(null)
  const knapp = useRef<HTMLButtonElement | null>(null)

  const register = useMemo(() => byggStoffregister(katalog, stoffsider), [katalog, stoffsider])

  const knappenavn = 'Vis stoffregisteret'
  const knappetips = useTips(knappenavn, { skjermleser: false })
  // Tipset og fokuset skal på det samme elementet, så de to ref-ene slås sammen.
  const { ref: tipsRef, ...knappeprops } = knappetips.props
  const settKnapp = useCallback(
    (element: HTMLButtonElement | null) => {
      knapp.current = element
      tipsRef(element)
    },
    [tipsRef],
  )

  const apne = useCallback(() => setApen(true), [])

  /** Lukking gir fokus tilbake til knappen, som er synlig igjen. */
  const lukk = useCallback(() => {
    setApen(false)
    knapp.current?.focus()
  }, [])

  /**
   * Ctrl + M åpner og lukker menyen. Den ligger utenom `useKeyboard`, som med
   * vilje slipper alle modifikatorkombinasjoner gjennom til nettleseren; dette
   * er den ene snarveien i appen som trenger en.
   */
  useEffect(() => {
    function paaTast(event: KeyboardEvent) {
      if (!event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.toLowerCase() !== 'm') return
      // Et annet lag over appen — endringsloggen — har forrangen. Fagsøket
      // er et lag bare for tastene i siden bak; menyen åpnes også derfra.
      if (!apen && lagLiggerOver() && !fokusIFagsok()) return
      event.preventDefault()
      if (apen) lukk()
      else apne()
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [apen, apne, lukk])

  /**
   * Escape lukker menyen. Appens egen Esc ligger stille så lenge laget står
   * over den, så de to kan ikke utløses av det samme tastetrykket.
   *
   * Tabulator går rundt i panelet så lenge menyen står åpen. Menyknappen
   * ligger skjult bak panelet, og appen bak er mørklagt: fokus skal ikke kunne
   * havne på noe man ikke ser.
   */
  useEffect(() => {
    if (!apen) return
    function paaTast(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        lukk()
        return
      }
      if (event.key !== 'Tab') return

      const felter = naabare(panel.current)
      const forste = felter[0]
      const siste = felter[felter.length - 1]
      if (!forste || !siste) return

      // Panelet selv har fokus rett etter åpning, og ligger foran det første
      // feltet: derfra går veien bakover til det siste, ikke ut av menyen.
      const foran = document.activeElement === forste || document.activeElement === panel.current
      if (event.shiftKey && foran) {
        event.preventDefault()
        siste.focus()
      } else if (!event.shiftKey && document.activeElement === siste) {
        event.preventDefault()
        forste.focus()
      }
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [apen, lukk])

  // Fokus følger med inn i panelet, ellers ville det blitt stående på
  // menyknappen som nå ligger skjult bak det. Panelet selv tar imot fokuset,
  // så tabulator begynner på toppen og ingen knapp trykkes ved et uhell.
  useEffect(() => {
    if (apen) panel.current?.focus()
  }, [apen])

  // Ikke `lukk()`: informasjonssiden tar fokus selv, og skal ikke få det revet
  // tilbake til menyknappen. Lenken gjør resten.
  const velg = useCallback(() => setApen(false), [])
  const veksle = useCallback((skuff: string) => setApenSkuff((forrige) => (forrige === skuff ? null : skuff)), [])

  return (
    <>
      <button
        ref={settKnapp}
        type="button"
        className="menyknapp"
        aria-label={knappenavn}
        aria-expanded={apen}
        aria-controls={panelId}
        aria-keyshortcuts="Control+M"
        onClick={apne}
        {...knappeprops}
      >
        <Ikon navn="menu" storrelse="ui" />
        <Shortcut>{MENY_SNARVEI}</Shortcut>
      </button>

      {/* Mørklegger og slører hovedinnholdet, og lukker menyen ved trykk. Den
          ligger som et eget lag i stedet for som et filter på innholdet, så
          verktøylinja og de andre faste elementene beholder plassen sin. */}
      <div
        className="menylag"
        onClick={lukk}
        aria-hidden="true"
        {...(apen && { 'data-lag': MENY_LAG })}
      />

      <nav
        ref={panel}
        id={panelId}
        className="sidemeny"
        aria-label={TITTEL}
        data-apen={apen ? 'ja' : 'nei'}
        tabIndex={-1}
      >
        <div className="sidemeny__topp">
          <h2 className="sidemeny__tittel">{TITTEL}</h2>
          <button
            type="button"
            className="sidemeny__lukk"
            aria-label="Lukk menyen"
            onClick={lukk}
          >
            <Ikon navn="close" storrelse="ui" />
          </button>
        </div>

        {/* Bryteren gjelder hele lista, og står fast øverst i stedet for å
            rulle bort med den. */}
        <label className="bryter menyveksle">
          <input
            type="checkbox"
            role="switch"
            checked={visUnderkategorier}
            onChange={(e) => setVisUnderkategorier(e.target.checked)}
          />
          <span className="bryter__spor" aria-hidden="true" />
          <span>Vis underkategorier</span>
        </label>

        <ul className="menyliste">
          {register.map((kategori) => (
            <Kategoriskuff
              key={kategori.navn}
              kategori={kategori}
              apen={apenSkuff === kategori.navn}
              visUnderkategorier={visUnderkategorier}
              onVeksle={() => veksle(kategori.navn)}
              onVelg={velg}
            />
          ))}
        </ul>

        {kanOpprette && <NyStoffside onOpprett={velg} />}
      </nav>
    </>
  )
}

/** Én kategori: tittelen som åpner skuffen, og stoffene i den, med eller uten underkategoriene. */
function Kategoriskuff({
  kategori,
  apen,
  visUnderkategorier,
  onVeksle,
  onVelg,
}: {
  kategori: Registerkategori
  apen: boolean
  visUnderkategorier: boolean
  onVeksle: () => void
  onVelg: () => void
}) {
  const underkategorier = visUnderkategorier ? kategori.underkategorier : []
  // Står noen stoffer direkte i kategorien ved siden av underkategoriene, står
  // de først, uten overskrift.
  const iUnder = new Set(underkategorier.flatMap((u) => u.stoffer))
  const direkte = underkategorier.length > 0 ? kategori.stoffer.filter((s) => !iUnder.has(s)) : kategori.stoffer

  return (
    <Skuff
      apen={apen}
      onVeksle={onVeksle}
      tittel={
        <>
          <span className="menyskuff__beskrivelse">{kategori.navn}</span>
          <span className="menyskuff__antall" aria-label={`${kategori.stoffer.length} stoffer`}>
            {kategori.stoffer.length}
          </span>
        </>
      }
    >
      {direkte.length > 0 && <Stoffer stoffer={direkte} onVelg={onVelg} />}
      {underkategorier.map((u) => (
        <section className="menykategori" key={u.navn}>
          <h3 className="menykategori__navn">{u.navn}</h3>
          <Stoffer stoffer={u.stoffer} onVelg={onVelg} />
        </section>
      ))}
    </Skuff>
  )
}

/**
 * En skuff i menyen: tittelen som åpner skuffen, og innholdet.
 *
 * Selve skuffen glir opp og igjen med `grid-template-rows: 0fr ↔ 1fr`, som
 * ellers i appen. Lukket innhold settes usynlig når glidningen er over, så det
 * heller ikke nås med tabulator eller skjermleser.
 */
function Skuff({
  apen,
  onVeksle,
  tittel,
  children,
}: {
  apen: boolean
  onVeksle: () => void
  tittel: ReactNode
  children: ReactNode
}) {
  const id = useId()
  const rad = useRef<HTMLLIElement>(null)

  // En skuff som åpnes nederst i lista skal ikke bli stående utenfor bildet.
  // Rullingen venter til glidningen er over — først da vet vi hvor høy den ble.
  useEffect(() => {
    if (!apen) return
    const el = rad.current
    if (!el) return
    const frist = window.setTimeout(
      // Øverst i lista: da er hele skuffen i bildet, uansett hvor i menyen den
      // står.
      () => el.scrollIntoView({ behavior: rullefart(), block: 'start' }),
      ETTER_GLIDNING,
    )
    return () => window.clearTimeout(frist)
  }, [apen])

  return (
    <li ref={rad} className="menyskuff" data-apen={apen ? 'ja' : 'nei'}>
      <div className="menyskuff__hode">
        <button
          type="button"
          className="menyskuff__tittel"
          aria-expanded={apen}
          aria-controls={id}
          onClick={onVeksle}
        >
          {tittel}
          <Ikon navn="chev" className="menyskuff__pil" />
        </button>
      </div>

      <div id={id} className="menyskuff__kropp">
        <div className="menyskuff__inner">{children}</div>
      </div>
    </li>
  )
}

/**
 * Feltet redaktørene lager en ny stoffside med. Siden åpnes med navnet, og
 * opprettes i databasen første gang noe lagres på den.
 */
function NyStoffside({ onOpprett }: { onOpprett: () => void }) {
  const [navn, setNavn] = useState('')
  return (
    <form
      className="menyny"
      onSubmit={(e) => {
        e.preventDefault()
        const renset = navn.trim()
        if (!renset) return
        onOpprett()
        setNavn('')
        window.location.hash = stoffadresse(renset)
      }}
    >
      <Felt merkelapp="Ny stoffside" value={navn} maxLength={200} onChange={(e) => setNavn(e.target.value)} />
      <Button type="submit" variant="kant" disabled={!navn.trim()}>
        Åpne
      </Button>
    </form>
  )
}

/** Stoffene i en kategori eller underkategori, alfabetisk, som lenker til informasjonssidene. */
function Stoffer({ stoffer, onVelg }: { stoffer: readonly Registerstoff[]; onVelg: () => void }) {
  return (
    <ul className="menyanalytter">
      {stoffer.map((stoff) => (
        <li key={stoff.kode ?? stoff.side}>
          <a
            className="menyanalytt"
            href={stoff.kode ? analyttadresse(stoff.kode) : stoffadresse(stoff.side)}
            onClick={onVelg}
          >
            <span className="menyanalytt__navn">{stoff.navn}</span>
            {stoff.kode && <span className="menyanalytt__kode">{stoff.kode}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}
