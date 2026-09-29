import { useId, useMemo, useRef, useState } from 'react'
import { tomtDokument, type Riktekstdokument } from '../../faginnhold/riktekst'
import { endreKommentar, opprettKommentar, slettKommentar } from '../../ideer/api'
import { byggTraad, erNyKommentar, tekstTilLagring, type Idetraad, type Kommentar, type Kommentarnode } from '../../ideer/modell'
import { useSkjuling } from '../../hooks/useSkjuling'
import { Riktekst } from '../stoffside/Riktekst'
import { Rikteksteditor } from '../stoffside/Rikteksteditor'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Forfatterbilde, useForfatternavn, useIdekontekst } from './Idekontekst'
import { Hjerteknapp, Idehandling, Slettknapp, Tidspunkt } from './Smadeler'

/**
 * Kommentartråden under en idé, med svar i svar som på Reddit: hvert nivå
 * rykker inn, og en loddrett linje viser hvilken kommentar svarene hører til.
 * Et trykk på linja, eller på pilen i hodet, legger kommentaren og svarene
 * under den sammen — med den samme glidningen som skuffene på stoffsidene.
 */
export function Kommentartraad({
  traad,
  sistSett,
  onEndret,
  onHjerte,
}: {
  traad: Idetraad
  /** Når idéen sist var åpnet før nå; kommentarer fra andre etter det er nye. */
  sistSett: string | null
  /** Tråden er endret, og hentes på nytt. */
  onEndret: () => Promise<unknown>
  onHjerte: (kommentar: Kommentar) => void
}) {
  const { meg } = useIdekontekst()
  const erNy = (kommentar: Kommentar) => erNyKommentar(kommentar, sistSett, meg.id)
  const noder = useMemo(() => byggTraad(traad.kommentarer), [traad.kommentarer])
  const antall = traad.kommentarer.filter((k) => !k.slettet).length
  const id = useId()

  return (
    <section className="idetraad" aria-labelledby={id}>
      <h4 id={id} className="idetraad__tittel">
        {antall === 0 ? 'Kommentarer' : `${antall} ${antall === 1 ? 'kommentar' : 'kommentarer'}`}
      </h4>
      <Kommentarskriver ide={traad.id} forelder={null} onSendt={onEndret} />
      {noder.length > 0 && (
        <ol className="kommentarer">
          {noder.map((node) => (
            <Kommentarvisning key={node.kommentar.id} node={node} ide={traad.id} erNy={erNy} onEndret={onEndret} onHjerte={onHjerte} />
          ))}
        </ol>
      )}
    </section>
  )
}

function Kommentarvisning({
  node,
  ide,
  erNy,
  onEndret,
  onHjerte,
}: {
  node: Kommentarnode
  ide: string
  erNy: (kommentar: Kommentar) => boolean
  onEndret: () => Promise<unknown>
  onHjerte: (kommentar: Kommentar) => void
}) {
  const { kommentar, svar, antallSvar } = node
  const { meg, admin } = useIdekontekst()
  const navn = useForfatternavn(kommentar.forfatter_id)
  const [apen, setApen] = useState(true)
  const [svarer, setSvarer] = useState(false)
  const [endrer, setEndrer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const innholdId = useId()
  useSkjuling(kropp, inner, apen)

  const eier = !kommentar.slettet && kommentar.forfatter_id === meg.id
  const veksle = () => setApen((a) => !a)
  const skjulteSvar = !apen && antallSvar > 0

  const slett = async () => {
    try {
      await slettKommentar(kommentar.id)
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
              ide={ide}
              forelder={kommentar.forelder_id}
              kommentar={kommentar}
              onSendt={async () => {
                setEndrer(false)
                await onEndret()
              }}
              onAvbryt={() => setEndrer(false)}
            />
          ) : (
            !kommentar.slettet && <Riktekst dokument={kommentar.tekst} />
          )}
          {feil && (
            <p className="skjemafeil" role="alert">
              {feil}
            </p>
          )}
          {!kommentar.slettet && !endrer && (
            <div className="idehandlinger idehandlinger--kommentar">
              <Hjerteknapp antall={kommentar.hjerter} gitt={kommentar.mitt_hjerte} onVeksle={() => onHjerte(kommentar)} hva="kommentaren" />
              <Idehandling ikon="reply" aria-expanded={svarer} onClick={() => setSvarer((s) => !s)}>
                Svar
              </Idehandling>
              {eier && (
                <Idehandling ikon="edit" onClick={() => setEndrer(true)}>
                  Rediger
                </Idehandling>
              )}
              {(eier || admin) && <Slettknapp hva="kommentaren" onSlett={() => void slett()} />}
            </div>
          )}
          {svarer && (
            <Kommentarskriver
              ide={ide}
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
                <Kommentarvisning key={barn.kommentar.id} node={barn} ide={ide} erNy={erNy} onEndret={onEndret} onHjerte={onHjerte} />
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
  ide,
  forelder,
  kommentar,
  onSendt,
  onAvbryt,
}: {
  ide: string
  forelder: string | null
  /** Kommentaren som endres. Uten: en ny. */
  kommentar?: Kommentar
  onSendt: () => Promise<unknown>
  /** Uten: feltet legger seg sammen igjen i stedet for å forsvinne. */
  onAvbryt?: () => void
}) {
  const [apen, setApen] = useState(Boolean(onAvbryt))
  const [tekst, setTekst] = useState<Riktekstdokument>(kommentar?.tekst ?? tomtDokument())
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
      if (kommentar) await endreKommentar(kommentar.id, innhold)
      else await opprettKommentar(ide, forelder, innhold)
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
