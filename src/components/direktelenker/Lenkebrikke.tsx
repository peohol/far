import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { fullLenke, lesLenkemal, type Lenkemal } from '../../direktelenker/mal'
import { lenkedeler, lenkeslagnavn, type Lenkedeler } from '../../direktelenker/modell'
import { kortTid } from '../../traad/modell'
import { Ikon } from '../ikon/Ikon'
import { LUKKETID } from '../referanser/Referansepille'
import { useBobleplassering } from '../Tips'
import { useDirektelenkekilde } from './Direktelenkekilde'
import { apneDirektelenke } from './navigasjon'
import { useLenkemaal, type Lenketilstand } from './useLenkemaal'
import '../../styles/direktelenker.css'

/** Hvor lenge pekeren må hvile på brikken før forhåndsvisningen kommer, så den ikke blinker forbi. */
export const VISES_ETTER = 250

/** Det en lenkebrikke viser, med navnet den ble lagret med til oppslaget er gjort. */
function useBrikke(attrs: Record<string, unknown>): { mal: Lenkemal | null; tilstand: Lenketilstand; deler: Lenkedeler | null; etikett: string } {
  const mal = lesLenkemal(attrs)
  const tilstand = useLenkemaal(mal)
  const { sidenavn } = useDirektelenkekilde()
  const deler =
    tilstand.status === 'klar' ? lenkedeler(tilstand.maal, tilstand.maal.slag === 'diskusjon' ? sidenavn(tilstand.maal.side) : '') : null
  return { mal, tilstand, deler, etikett: typeof attrs.etikett === 'string' ? attrs.etikett : '' }
}

/**
 * Innholdet i brikken: et ikon for hva den peker på, siden eller «Idéer»,
 * emojien og overskriften, og hvem kommentaren er fra. Før oppslaget er gjort,
 * og når det ikke finnes lenger, står navnet den ble lagret med.
 */
function Brikkeinnhold({ mal, deler, etikett }: { mal: Lenkemal | null; deler: Lenkedeler | null; etikett: string }) {
  return (
    <>
      <Ikon navn={mal?.kommentar ? 'comment' : mal?.slag === 'ide' ? 'idea' : 'diskusjon'} storrelse="ui" />
      {mal && <span className="kun-skjermleser">{lenkeslagnavn(mal)}: </span>}
      {deler ? (
        <>
          <span className="lenkebrikke__sted">{deler.sted}</span>
          <span className="lenkebrikke__tittel">
            {deler.emoji && <span aria-hidden="true">{deler.emoji} </span>}
            {deler.tittel}
          </span>
          {deler.kommentar && <span className="lenkebrikke__kommentar">{deler.kommentar}</span>}
        </>
      ) : (
        <span className="lenkebrikke__tittel">{etikett || 'Direktelenke'}</span>
      )}
    </>
  )
}

/**
 * En direktelenke i en tekst, som en brikke: hvilken side og tråd (eller idé)
 * den fører til, med emojien og overskriften slik de er nå. Når pekeren hviler
 * på den, eller den får fokus fra tastaturet, vises en forhåndsvisning av det
 * den peker på; et klikk går dit. Peker den på noe som ikke finnes lenger, er
 * den overstreket og fører ingen steder.
 *
 * Brikken er en vanlig lenke med hele adressen, så den kan åpnes i en ny fane
 * eller kopieres med høyreklikk.
 */
export function Lenkebrikke({ attrs }: { attrs: Record<string, unknown> }) {
  const { mal, tilstand, deler, etikett } = useBrikke(attrs)
  const lenke = useRef<HTMLAnchorElement>(null)
  const [apen, setApen] = useState(false)
  const tidtaker = useRef<ReturnType<typeof setTimeout>>()
  const bobleId = useId()
  const borte = tilstand.status === 'borte'

  const vent = (apne: boolean, etter: number) => {
    clearTimeout(tidtaker.current)
    tidtaker.current = setTimeout(() => setApen(apne), etter)
  }
  useEffect(() => () => clearTimeout(tidtaker.current), [])

  if (!mal) return <span className="lenkebrikke" data-borte="">{etikett}</span>

  const ga = (event: MouseEvent<HTMLAnchorElement>) => {
    if (borte) {
      event.preventDefault()
      return
    }
    // Ny fane, nytt vindu og nedlasting går til nettleseren.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    clearTimeout(tidtaker.current)
    setApen(false)
    void apneDirektelenke(mal)
  }

  return (
    <span
      className="lenkebrikke-feste"
      onPointerEnter={(event) => event.pointerType !== 'touch' && vent(true, VISES_ETTER)}
      onPointerLeave={(event) => event.pointerType !== 'touch' && vent(false, LUKKETID)}
    >
      <a
        ref={lenke}
        className="lenkebrikke"
        data-borte={borte || undefined}
        aria-describedby={apen ? bobleId : undefined}
        // Peker den på noe som er borte, fører den ingen steder, heller ikke i
        // en ny fane, men står igjen i tabulatorrekkefølgen med forhåndsvisningen.
        {...(borte
          ? { role: 'link', tabIndex: 0, 'aria-disabled': true, title: 'Lenken peker på noe som ikke finnes lenger' }
          : { href: fullLenke(mal) })}
        onClick={ga}
        onFocus={(event) => event.currentTarget.matches(':focus-visible') && setApen(true)}
        onBlur={() => setApen(false)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !apen) return
          event.stopPropagation()
          setApen(false)
        }}
      >
        <Brikkeinnhold mal={mal} deler={deler} etikett={etikett} />
      </a>
      {apen && lenke.current && (
        <Lenkeboble id={bobleId} anker={lenke.current} mal={mal} tilstand={tilstand} deler={deler} />
      )}
    </span>
  )
}

/** Brikken slik den står i editoren: den samme, men den fører ingen steder mens teksten skrives. */
export function Lenkebrikkevisning({ attrs, valgt }: { attrs: Record<string, unknown>; valgt: boolean }) {
  const { mal, tilstand, deler, etikett } = useBrikke(attrs)
  return (
    <span className="lenkebrikke" data-valgt={valgt || undefined} data-borte={tilstand.status === 'borte' || undefined}>
      <Brikkeinnhold mal={mal} deler={deler} etikett={etikett} />
    </span>
  )
}

function Lenkeboble({
  id,
  anker,
  mal,
  tilstand,
  deler,
}: {
  id: string
  anker: HTMLElement
  mal: Lenkemal
  tilstand: Lenketilstand
  deler: Lenkedeler | null
}) {
  const { boble, innhold, klasser, stil } = useBobleplassering<HTMLSpanElement>(anker, tilstand.status, 'under')
  return (
    <span ref={boble} id={id} role="tooltip" className={`${klasser} lenkeboble`} style={stil}>
      <span ref={innhold} className="tipsboble__innhold">
        <Lenkeforhandsvisning mal={mal} tilstand={tilstand} deler={deler} />
      </span>
    </span>
  )
}

/**
 * Forhåndsvisningen av det en direktelenke peker på: hva det er og hvor, kategorien,
 * overskriften, hvem som skrev det og når, begynnelsen av teksten og antall
 * kommentarer — og kommentaren, når lenken peker på en. Brukes i boblen ved
 * brikken og i panelet der lenken settes inn. Bare spenn, så den kan stå
 * inne i et avsnitt.
 */
export function Lenkeforhandsvisning({ mal, tilstand, deler }: { mal: Lenkemal; tilstand: Lenketilstand; deler: Lenkedeler | null }) {
  if (tilstand.status !== 'klar' || !deler) {
    const tekst =
      tilstand.status === 'laster'
        ? 'Henter …'
        : tilstand.status === 'borte'
          ? 'Lenken peker på noe som ikke finnes lenger.'
          : 'Fikk ikke hentet det lenken peker på.'
    return <span className="lenkevisning lenkevisning--tom">{tekst}</span>
  }
  const { maal } = tilstand
  const merknader = [
    maal.slag === 'ide' && maal.overfort ? 'Overført til planlagte oppgaver' : null,
    maal.arkivert ? (maal.slag === 'ide' ? 'Ikke aktuelt' : 'Arkivert') : null,
  ].filter(Boolean)
  const kommentarer = `${maal.kommentarer} ${maal.kommentarer === 1 ? 'kommentar' : 'kommentarer'}`

  return (
    <span className="lenkevisning">
      <span className="lenkevisning__hode">
        <Ikon navn={mal.slag === 'ide' ? 'idea' : 'diskusjon'} storrelse="ui" />
        <span>{mal.slag === 'ide' ? 'Idé' : `Diskusjon · ${deler.sted}`}</span>
      </span>
      <span className="lenkevisning__kategori">
        {deler.emoji && <span aria-hidden="true">{deler.emoji} </span>}
        {deler.kategori}
      </span>
      <span className="lenkevisning__tittel">{deler.tittel}</span>
      <span className="lenkevisning__meta">
        {[maal.forfatter ?? 'Ukjent bruker', kortTid(maal.opprettet_kl), kommentarer, ...merknader].join(' · ')}
      </span>
      {maal.skjult ? (
        <span className="lenkevisning__utdrag lenkevisning__utdrag--merknad">Innholdet er skjult av en administrator.</span>
      ) : (
        maal.utdrag && <span className="lenkevisning__utdrag">{maal.utdrag}</span>
      )}
      {maal.kommentar && (
        <span className="lenkevisning__kommentar">
          <span className="lenkevisning__meta">
            <Ikon navn="comment" storrelse="ui" />
            {maal.kommentar.slettet
              ? 'Kommentaren er slettet'
              : `Kommentar fra ${maal.kommentar.forfatter ?? 'ukjent bruker'} · ${kortTid(maal.kommentar.opprettet_kl)}`}
          </span>
          {maal.kommentar.skjult ? (
            <span className="lenkevisning__utdrag lenkevisning__utdrag--merknad">Innholdet er skjult av en administrator.</span>
          ) : (
            maal.kommentar.utdrag && <span className="lenkevisning__utdrag">{maal.kommentar.utdrag}</span>
          )}
        </span>
      )}
    </span>
  )
}
