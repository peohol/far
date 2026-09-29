import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { flyttOppgaveTilbake, hentOppgave, lagreOppgaveprompt, settOppgaveKlar } from '../../ideer/api'
import { oppgavekode } from '../../ideer/modell'
import { PROMPT_MEST, iEndringsloggen, type Oppgavedetaljer } from '../../ideer/oppgaver'
import { Forlatvarsel } from '../analyttside/Skjemaer'
import { Button } from '../Button'
import { visEndringslogg } from '../endringsloggvisning'
import { Ikon } from '../ikon/Ikon'
import { useIdekontekst } from './Idekontekst'
import { Ideside } from './Ideside'
import { Kategorimerke, Oppgavekode, Oppgavestatusmerke } from './Merker'
import { Bekreftknapp, Tidspunkt } from './Smadeler'
import type { Skjemastatus } from './useForlatvakt'

/**
 * Én planlagt oppgave: statusen, prompten og idéen den kom fra, med den
 * frosne kommentartråden.
 *
 * En administrator skriver prompten — oppgaven formulert så godt at en
 * språkmodell kan lese den og utføre den — og merker oppgaven klar til
 * implementering når den er det. Den første lagringen setter oppgaven under
 * arbeid. Oppgaven kan også flyttes tilbake til idéene, som er den eneste
 * måten å ta den bort på. Andre leser.
 *
 * En utført oppgave har nummeret sitt og en knapp til føringen i
 * endringsloggen, og kan ikke endres.
 */
export function Oppgaveside({
  id,
  onStatus,
  forlater,
  onForkast,
  onFortsett,
  onFlyttetTilbake,
  onEndret,
}: {
  id: string
  /** Om prompten har endringer som ikke er lagret, eller lagres nå. */
  onStatus: (status: Skjemastatus) => void
  /** Brukeren vil forlate siden med endringer som ikke er lagret. */
  forlater: boolean
  onForkast: () => void
  onFortsett: () => void
  onFlyttetTilbake: () => void
  /** Oppgaven er endret, så lista bør hentes på nytt. */
  onEndret: () => void
}) {
  const { admin } = useIdekontekst()
  const [oppgave, setOppgave] = useState<Oppgavedetaljer | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)
  const [promptstatus, setPromptstatus] = useState<Skjemastatus>('uendret')
  const tittel = useRef<HTMLHeadingElement>(null)

  const hent = useCallback(async () => {
    try {
      const hentet = await hentOppgave(id)
      if (!hentet) setFeil('Oppgaven finnes ikke lenger.')
      setOppgave(hentet)
    } catch {
      setFeil('Fikk ikke hentet oppgaven.')
    }
  }, [id])

  useEffect(() => {
    void hent()
  }, [hent])

  useEffect(() => onStatus(promptstatus), [promptstatus, onStatus])

  // Fokus på overskriften når oppgaven er hentet, så skjermlesere leser hvor man er.
  const lastet = oppgave !== null
  useEffect(() => {
    if (lastet) tittel.current?.focus({ preventScroll: true })
  }, [lastet])

  /** En endring av oppgaven. Etterpå hentes den på nytt, så det som vises, er det som er lagret. */
  const utfor = async (handling: () => Promise<void>): Promise<boolean> => {
    if (arbeider) return false
    setArbeider(true)
    setFeil(null)
    try {
      await handling()
      onEndret()
      return true
    } catch (e) {
      setFeil((e as Error).message)
      return false
    } finally {
      await hent()
      setArbeider(false)
    }
  }

  if (!oppgave) {
    return feil ? (
      <p className="skjemafeil" role="alert">
        {feil}
      </p>
    ) : null
  }

  const utfort = oppgave.status === 'utfort'
  const redigerer = admin && !utfort
  const publisert = iEndringsloggen(oppgave.endringslogg)

  return (
    <article className="ideside oppgaveside" aria-labelledby={`oppgave-${oppgave.id}`}>
      <header className="ideside__hode">
        <p className="ideside__merker">
          <Oppgavestatusmerke status={oppgave.status} />
          <Kategorimerke kategori={oppgave.kategori} />
          {oppgave.nummer !== null && <Oppgavekode nummer={oppgave.nummer} />}
        </p>
        <h3 ref={tittel} id={`oppgave-${oppgave.id}`} className="ideside__tittel" tabIndex={-1}>
          {oppgave.tittel}
        </h3>
        <p className="forfatterlinje">
          <span>
            Overført <Tidspunkt iso={oppgave.overfort_kl} />
          </span>
          {oppgave.endret_kl && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                prompten endret <Tidspunkt iso={oppgave.endret_kl} />
              </span>
            </>
          )}
          {oppgave.utfort_kl && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                utført <Tidspunkt iso={oppgave.utfort_kl} />
              </span>
            </>
          )}
        </p>
      </header>

      {utfort && (
        <div className="idemerknad" role="note">
          <Ikon navn="done" storrelse="ui" />
          <p>
            <strong>Utført{oppgave.nummer !== null && ` som ${oppgavekode(oppgave.nummer)}`}.</strong>{' '}
            {publisert
              ? 'Endringsloggen sier hva som ble gjort.'
              : `Føringen i endringsloggen (versjon ${oppgave.endringslogg}) er ikke publisert ennå.`}
          </p>
          {publisert && (
            <div className="idemerknad__handlinger">
              <Button variant="kant" icon={<Ikon navn="history" storrelse="ui" />} onClick={() => visEndringslogg(oppgave.endringslogg)}>
                Se i endringsloggen
              </Button>
            </div>
          )}
        </div>
      )}

      <Prompt
        prompt={oppgave.prompt}
        redigerer={redigerer}
        forlater={forlater}
        onForkast={onForkast}
        onFortsett={onFortsett}
        onStatus={setPromptstatus}
        onLagre={(tekst) => utfor(() => lagreOppgaveprompt(oppgave.id, tekst))}
      />

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      {redigerer && (
        <div className="idevalgknapper" role="group" aria-label="Hva skjer med oppgaven">
          {oppgave.status === 'klar' ? (
            <Button
              variant="kant"
              icon={<Ikon navn="reset" storrelse="ui" />}
              disabled={arbeider}
              onClick={() => void utfor(() => settOppgaveKlar(oppgave.id, false))}
            >
              Ikke klar likevel
            </Button>
          ) : (
            <Button
              variant="kant"
              icon={<Ikon navn="yes" storrelse="ui" />}
              disabled={arbeider || !oppgave.har_prompt || promptstatus !== 'uendret'}
              title={!oppgave.har_prompt ? 'Skriv og lagre prompten først.' : promptstatus !== 'uendret' ? 'Lagre prompten først.' : undefined}
              onClick={() => void utfor(() => settOppgaveKlar(oppgave.id, true))}
            >
              Klar til implementering
            </Button>
          )}
          <Bekreftknapp
            ikon="back"
            tekst="Flytt tilbake til idéer"
            bekreftTekst="Bekreft: flytt tilbake til idéer"
            onBekreft={() =>
              void utfor(async () => {
                await flyttOppgaveTilbake(oppgave.id)
                onFlyttetTilbake()
              })
            }
          />
        </div>
      )}

      <section className="oppgaveside__ide" aria-labelledby={`oppgave-${oppgave.id}-ide`}>
        <h4 id={`oppgave-${oppgave.id}-ide`} className="idetraad__tittel">
          Idéen oppgaven kom fra
        </h4>
        <Ideside id={oppgave.ide_id} innebygd />
      </section>
    </article>
  )
}

/**
 * Prompten: det en språkmodell skal utføre oppgaven etter, som ren tekst.
 * En administrator skriver i feltet og lagrer; andre leser den.
 */
function Prompt({
  prompt,
  redigerer,
  forlater,
  onForkast,
  onFortsett,
  onStatus,
  onLagre,
}: {
  prompt: string
  redigerer: boolean
  forlater: boolean
  onForkast: () => void
  onFortsett: () => void
  onStatus: (status: Skjemastatus) => void
  onLagre: (tekst: string) => Promise<boolean>
}) {
  const [tekst, setTekst] = useState(prompt)
  const [lagrer, setLagrer] = useState(false)
  const id = useId()
  const endret = tekst !== prompt
  const status: Skjemastatus = lagrer ? 'lagrer' : endret ? 'ulagret' : 'uendret'
  useEffect(() => onStatus(status), [status, onStatus])

  const lagre = async () => {
    if (!endret || lagrer) return
    onFortsett()
    setLagrer(true)
    await onLagre(tekst)
    setLagrer(false)
  }

  if (!redigerer) {
    return (
      <section className="oppgaveprompt" aria-labelledby={id}>
        <h4 id={id} className="idetraad__tittel">
          Prompt
        </h4>
        {prompt.trim() ? <p className="oppgaveprompt__tekst">{prompt}</p> : <p className="idegruppe__tom">Ingen prompt ennå.</p>}
      </section>
    )
  }

  return (
    <div
      className="felt oppgaveprompt"
      onKeyDown={(e) => {
        // Ctrl/Cmd + Enter lagrer, som i kommentarfeltene.
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void lagre()
        }
      }}
    >
      <label className="felt__merkelapp" htmlFor={id}>
        Prompt
      </label>
      <textarea
        id={id}
        className="felt__inndata felt__inndata--flerlinje oppgaveprompt__felt"
        rows={Math.max(8, tekst.split('\n').length + 1)}
        maxLength={PROMPT_MEST}
        value={tekst}
        aria-describedby={`${id}-hjelp`}
        onChange={(e) => setTekst(e.target.value)}
      />
      <span id={`${id}-hjelp`} className="felt__hjelp">
        Skriv oppgaven slik at en språkmodell kan utføre den uten å spørre: hva som skal endres, hvor i appen, og hvordan
        resultatet skal se ut og oppføre seg. Den første lagringen setter oppgaven under arbeid.
      </span>
      {forlater ? (
        <Forlatvarsel onForkast={onForkast} onFortsett={onFortsett} />
      ) : (
        endret && (
          <div className="skjema__knapper ideskjema__knapper">
            <Button variant="subtle" disabled={lagrer} onClick={() => setTekst(prompt)}>
              Forkast endringene
            </Button>
            <Button className="knapp--kompakt" disabled={lagrer} onClick={() => void lagre()}>
              {lagrer ? 'Lagrer …' : 'Lagre prompten'}
            </Button>
          </div>
        )
      )}
    </div>
  )
}
