import { useId, useMemo, useRef, useState } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { tomtDokument, type Riktekstdokument } from '../../faginnhold/riktekst'
import { byggTraad, erNyKommentar, tekstTilLagring, type Kommentar, type Kommentarnode } from '../../traad/modell'
import { useSkjuling } from '../../hooks/useSkjuling'
import { UnderOverskrift } from '../Overskriftsniva'
import { Riktekst } from '../stoffside/Riktekst'
import { Rikteksteditor } from '../stoffside/Rikteksteditor'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Forfatterbilde, useForfatternavn, useForfatterkontekst } from './Forfatterkontekst'
import { Bekreftknapp, Hjerteknapp, Idehandling, Slettknapp, Tidspunkt } from './Smadeler'
import '../../styles/traad.css'

/**
 * Veien kommentarene i én tråd lagres: under en idé eller i en diskusjon.
 * Databasen avgjør hvem som får gjøre hva; kanalen sier hva knappene skal
 * tilby.
 */
export interface Kommentarkanal {
  /** Tråden, til navnene det som skrives, tas vare på under (`useBevart`). */
  traad: string
  opprett: (forelder: string | null, tekst: Riktekstdokument) => Promise<void>
  endre: (kommentar: string, tekst: Riktekstdokument) => Promise<void>
  /** En kommentar med svar står igjen uten tekst; databasen avgjør det. */
  slett: (kommentar: string) => Promise<void>
  /** En administrator kan slette andres kommentarer (idéene). */
  adminSletter: boolean
  /** En administrator kan skjule innholdet i en kommentar (diskusjonene). */
  skjul?: (kommentar: string) => Promise<void>
}

/**
 * Kommentartråden under en idé eller i en diskusjon, med svar i svar som på
 * Reddit: hvert nivå rykker inn, og en loddrett linje viser hvilken kommentar
 * svarene hører til. Et trykk på linja, eller på pilen i hodet, legger
 * kommentaren og svarene under den sammen — med den samme glidningen som
 * skuffene på stoffsidene.
 *
 * En frosset tråd (en arkivert eller overført idé, en arkivert diskusjon) kan
 * leses, men ingen kan kommentere, svare, endre, slette eller gi hjerter.
 */
export function Kommentartraad({
  kanal,
  kommentarer,
  sistSett,
  onEndret,
  onHjerte,
  laast = false,
}: {
  kanal: Kommentarkanal
  kommentarer: readonly Kommentar[]
  /** Når tråden sist var åpnet før nå; kommentarer fra andre etter det er nye. */
  sistSett: string | null
  /** Tråden er endret, og hentes på nytt. */
  onEndret: () => Promise<unknown>
  onHjerte: (kommentar: Kommentar) => void
  laast?: boolean
}) {
  const { meg } = useForfatterkontekst()
  const erNy = (kommentar: Kommentar) => erNyKommentar(kommentar, sistSett, meg.id)
  const noder = useMemo(() => byggTraad(kommentarer), [kommentarer])
  const antall = kommentarer.filter((k) => !k.slettet).length
  const id = useId()

  return (
    <section className="idetraad" aria-labelledby={id}>
      <h4 id={id} className="idetraad__tittel">
        {antall === 0 ? 'Kommentarer' : `${antall} ${antall === 1 ? 'kommentar' : 'kommentarer'}`}
      </h4>
      {laast ? (
        <p className="idetraad__laast">
          <Ikon navn="lock" storrelse="ui" />
          Tråden er frosset. Den kan leses, men ikke kommenteres.
        </p>
      ) : (
        <Kommentarskriver kanal={kanal} forelder={null} onSendt={onEndret} />
      )}
      {noder.length > 0 && (
        <ol className="kommentarer">
          {noder.map((node) => (
            <Kommentarvisning key={node.kommentar.id} node={node} kanal={kanal} erNy={erNy} onEndret={onEndret} onHjerte={onHjerte} laast={laast} />
          ))}
        </ol>
      )}
    </section>
  )
}

function Kommentarvisning({
  node,
  kanal,
  erNy,
  onEndret,
  onHjerte,
  laast,
}: {
  node: Kommentarnode
  kanal: Kommentarkanal
  erNy: (kommentar: Kommentar) => boolean
  onEndret: () => Promise<unknown>
  onHjerte: (kommentar: Kommentar) => void
  laast: boolean
}) {
  const { kommentar, svar, antallSvar } = node
  const { meg, admin } = useForfatterkontekst()
  const navn = useForfatternavn(kommentar.forfatter_id)
  const [apen, setApen] = useState(true)
  // Et svar eller en endring som skrives, overlever en oppdatering av appen.
  const [svarer, setSvarer] = useBevart(`kommentar:${kommentar.id}/svarer`, false)
  const [endrer, setEndrer] = useBevart(`kommentar:${kommentar.id}/endrer`, false)
  const [feil, setFeil] = useState<string | null>(null)
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const innholdId = useId()
  useSkjuling(kropp, inner, apen)

  const eier = !laast && !kommentar.slettet && kommentar.forfatter_id === meg.id
  const skjult = Boolean(kommentar.skjult)
  const veksle = () => setApen((a) => !a)
  const skjulteSvar = !apen && antallSvar > 0

  const utfor = async (handling: (kommentar: string) => Promise<void>) => {
    try {
      await handling(kommentar.id)
      await onEndret()
    } catch (e) {
      setFeil((e as Error).message)
    }
  }

  return (
    <li className="kommentar" data-apen={apen || undefined} data-slettet={kommentar.slettet || undefined}>
      <div className="kommentar__hode">
        <Forfatterbilde id={kommentar.forfatter_id} storrelse="mini" />
        <span className="kommentar__navn">{kommentar.slettet ? 'Slettet' : navn}</span>
        {!kommentar.slettet && (
          <span className="kommentar__tid">
            <Tidspunkt iso={kommentar.opprettet_kl} endret={kommentar.endret_kl} />
          </span>
        )}
        {erNy(kommentar) && <span className="kommentar__ny">Ny</span>}
        {skjulteSvar && (
          <span className="kommentar__skjult">{antallSvar} svar</span>
        )}
        <button
          type="button"
          className="kommentar__veksle"
          aria-expanded={apen}
          aria-controls={innholdId}
          aria-label={apen ? `Skjul kommentaren${antallSvar > 0 ? ' og svarene' : ''}` : 'Vis kommentaren'}
          onClick={veksle}
        >
          <Ikon navn="chev" />
        </button>
      </div>
      {/* Linja langs kommentaren legger den sammen, som på Reddit. Knappen i hodet gjør det samme for tastaturet. */}
      <button type="button" className="kommentar__linje" tabIndex={-1} aria-hidden="true" onClick={veksle} />
      <div ref={kropp} className="kommentar__kropp">
        <div ref={inner} id={innholdId} className="kommentar__inner">
          {endrer ? (
            <Kommentarskriver
              kanal={kanal}
              forelder={kommentar.forelder_id}
              kommentar={kommentar}
              onSendt={async () => {
                setEndrer(false)
                await onEndret()
              }}
              onAvbryt={() => setEndrer(false)}
            />
          ) : skjult ? (
            <p className="kommentar__skjultmerknad">Innholdet er skjult av en administrator.</p>
          ) : (
            !kommentar.slettet && (
              <UnderOverskrift niva={4}>
                <Riktekst dokument={kommentar.tekst} />
              </UnderOverskrift>
            )
          )}
          {feil && (
            <p className="skjemafeil" role="alert">
              {feil}
            </p>
          )}
          {!kommentar.slettet && !endrer && (
            <div className="idehandlinger idehandlinger--kommentar">
              <Hjerteknapp antall={kommentar.hjerter} gitt={kommentar.mitt_hjerte} onVeksle={() => onHjerte(kommentar)} hva="kommentaren" laast={laast} />
              {!laast && (
                <Idehandling ikon="reply" aria-expanded={svarer} onClick={() => setSvarer((s) => !s)}>
                  Svar
                </Idehandling>
              )}
              {eier && !skjult && (
                <Idehandling ikon="edit" onClick={() => setEndrer(true)}>
                  Rediger
                </Idehandling>
              )}
              {!laast && (eier || (admin && kanal.adminSletter)) && <Slettknapp hva="kommentaren" onSlett={() => void utfor(kanal.slett)} />}
              {admin && kanal.skjul && !laast && !skjult && !eier && (
                <Bekreftknapp
                  ikon="skjul"
                  tekst="Skjul"
                  bekreftTekst="Bekreft skjuling"
                  etikett="Skjul innholdet i kommentaren"
                  bekreftEtikett="Bekreft at innholdet i kommentaren skjules for godt"
                  onBekreft={() => void utfor(kanal.skjul!)}
                />
              )}
            </div>
          )}
          {svarer && (
            <Kommentarskriver
              kanal={kanal}
              forelder={kommentar.id}
              onSendt={async () => {
                setSvarer(false)
                await onEndret()
              }}
              onAvbryt={() => setSvarer(false)}
            />
          )}
          {svar.length > 0 && (
            <ol className="kommentarer">
              {svar.map((barn) => (
                <Kommentarvisning key={barn.kommentar.id} node={barn} kanal={kanal} erNy={erNy} onEndret={onEndret} onHjerte={onHjerte} laast={laast} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * Feltet for en ny kommentar, et svar eller en endring. Den nye kommentaren
 * øverst står sammenlagt som et felt til noen trykker i det; svaret og
 * endringen åpnes ferdig til å skrive i.
 */
function Kommentarskriver({
  kanal,
  forelder,
  kommentar,
  onSendt,
  onAvbryt,
}: {
  kanal: Kommentarkanal
  forelder: string | null
  /** Kommentaren som endres. Uten: en ny. */
  kommentar?: Kommentar
  onSendt: () => Promise<unknown>
  /** Uten: feltet legger seg sammen igjen i stedet for å forsvinne. */
  onAvbryt?: () => void
}) {
  // Det som skrives, overlever en oppdatering av appen.
  const skriver = `skriver:${kanal.traad}:${kommentar ? `endre:${kommentar.id}` : `svar:${forelder ?? 'ny'}`}`
  const [apen, setApen] = useBevart(`${skriver}/apen`, Boolean(onAvbryt))
  const [tekst, setTekst] = useBevart<Riktekstdokument>(`${skriver}/tekst`, () => kommentar?.tekst ?? tomtDokument())
  /** Øker for hver sending, så editoren begynner tom igjen. */
  const [runde, setRunde] = useState(0)
  const [sender, setSender] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const innhold = tekstTilLagring(tekst)
  const etikett = kommentar ? 'Endre kommentaren' : forelder ? 'Svar' : 'Ny kommentar'

  const avbryt = () => {
    setTekst(tomtDokument())
    setRunde((r) => r + 1)
    setFeil(null)
    if (onAvbryt) onAvbryt()
    else setApen(false)
  }

  const send = async () => {
    if (!innhold || sender) return
    setSender(true)
    setFeil(null)
    try {
      if (kommentar) await kanal.endre(kommentar.id, innhold)
      else await kanal.opprett(forelder, innhold)
      setTekst(tomtDokument())
      setRunde((r) => r + 1)
      if (!onAvbryt) setApen(false)
      await onSendt()
    } catch (e) {
      setFeil((e as Error).message)
    } finally {
      setSender(false)
    }
  }

  if (!apen) {
    return (
      <button type="button" className="kommentarfelt" onClick={() => setApen(true)}>
        <Ikon navn="comment" storrelse="ui" />
        <span>Skriv en kommentar</span>
      </button>
    )
  }

  return (
    <div
      className="kommentarskriver"
      onKeyDown={(e) => {
        // Ctrl/Cmd + Enter sender, som i de fleste kommentarfelt.
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void send()
        }
      }}
    >
      <Rikteksteditor key={runde} dokument={tekst} onEndre={setTekst} etikett={etikett} referanser={false} autofokus kompakt />
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper kommentarskriver__knapper">
        <Button variant="subtle" onClick={avbryt}>
          Avbryt
        </Button>
        <Button className="knapp--kompakt" disabled={!innhold || sender} onClick={() => void send()}>
          {kommentar ? 'Lagre' : forelder ? 'Svar' : 'Kommenter'}
        </Button>
      </div>
    </div>
  )
}
