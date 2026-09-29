import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { flyttOppgaveTilbake, frigiOppgave, hentOppgave, lagreOppgave, settOppgaveKlar } from '../../ideer/api'
import { TITTEL_MEST, oppgavekode } from '../../ideer/modell'
import { PROMPT_MEST, iEndringsloggen, type Oppgavedetaljer } from '../../ideer/oppgaver'
import { Forlatvarsel } from '../stoffside/Skjemaer'
import { Button } from '../Button'
import { visEndringslogg } from '../endringsloggvisning'
import { Ikon } from '../ikon/Ikon'
import { Felt } from '../konto/Felt'
import { useIdekontekst } from './Idekontekst'
import { Ideside } from './Ideside'
import { Kategorimerke, Oppgavekode, Oppgavestatusmerke } from './Merker'
import { Bekreftknapp, Tidspunkt } from './Smadeler'
import type { Skjemastatus } from './useForlatvakt'

/**
 * Én planlagt oppgave: statusen, prompten og idéen den kom fra, med den
 * frosne kommentartråden.
 *
 * En administrator gir oppgaven en overskrift og skriver prompten — oppgaven
 * formulert så godt at en språkmodell kan lese den og utføre den — og merker
 * oppgaven klar til implementering når den er det. Den første lagringen gjør
 * oppgaven påbegynt. Oppgaven kan også flyttes tilbake til idéene, som er den eneste
 * måten å ta den bort på. Andre leser.
 *
 * Mens en agent håndterer oppgaven, kan den ikke endres. En administrator kan
 * frigi den, så den blir klar igjen. En utført oppgave har en knapp til
 * føringen i endringsloggen, og kan ikke endres.
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
  /** Om overskriften eller prompten har endringer som ikke er lagret, eller lagres nå. */
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
  const [skjemastatus, setSkjemastatus] = useState<Skjemastatus>('uendret')
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

  useEffect(() => onStatus(skjemastatus), [skjemastatus, onStatus])

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
  const handteres = oppgave.status === 'haandteres'
  const redigerer = admin && !utfort && !handteres
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
                endret <Tidspunkt iso={oppgave.endret_kl} />
              </span>
            </>
          )}
          {oppgave.tatt_kl && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                tatt av en agent <Tidspunkt iso={oppgave.tatt_kl} />
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

      {handteres && (
        <div className="idemerknad" role="note">
          <Ikon navn="gears" storrelse="ui" />
          <p>
            <strong>Håndteres nå av en agent.</strong> Oppgaven kan ikke endres imens.
            {oppgave.nummer !== null && ` En avbrutt økt fortsetter med /utfor-oppgaver ${oppgavekode(oppgave.nummer)}.`}
            {admin && ' Er agenten stoppet, kan du frigi oppgaven, så den blir klar igjen.'}
          </p>
          {admin && (
            <div className="idemerknad__handlinger">
              <Bekreftknapp
                ikon="reset"
                tekst="Frigi oppgaven"
                bekreftTekst="Bekreft: frigi oppgaven"
                onBekreft={() => void utfor(() => frigiOppgave(oppgave.id))}
              />
            </div>
          )}
        </div>
      )}

      {redigerer ? (
        <Oppgaveskjema
          lagret={{ tittel: oppgave.tittel, prompt: oppgave.prompt }}
          forlater={forlater}
          onForkast={onForkast}
          onFortsett={onFortsett}
          onStatus={setSkjemastatus}
          onLagre={(innhold) => utfor(() => lagreOppgave(oppgave.id, innhold))}
        />
      ) : (
        <Prompt prompt={oppgave.prompt} />
      )}

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
              disabled={arbeider || !oppgave.har_prompt || skjemastatus !== 'uendret'}
              title={!oppgave.har_prompt ? 'Skriv og lagre prompten først.' : skjemastatus !== 'uendret' ? 'Lagre endringene først.' : undefined}
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

/** Prompten: det en språkmodell skal utføre oppgaven etter, som ren tekst. */
function Prompt({ prompt }: { prompt: string }) {
  const id = useId()
  return (
    <section className="oppgaveprompt" aria-labelledby={id}>
      <h4 id={id} className="idetraad__tittel">
        Prompt
      </h4>
      {prompt.trim() ? <p className="oppgaveprompt__tekst">{prompt}</p> : <p className="idegruppe__tom">Ingen prompt ennå.</p>}
    </section>
  )
}

interface Oppgaveinnhold {
  tittel: string
  prompt: string
}

/**
 * Det en administrator skriver på oppgaven: overskriften, som oppgaven vises
 * og omtales med, og prompten. De lagres sammen.
 */
function Oppgaveskjema({
  lagret,
  forlater,
  onForkast,
  onFortsett,
  onStatus,
  onLagre,
}: {
  lagret: Oppgaveinnhold
  forlater: boolean
  onForkast: () => void
  onFortsett: () => void
  onStatus: (status: Skjemastatus) => void
  onLagre: (innhold: Oppgaveinnhold) => Promise<boolean>
}) {
  const [tittel, setTittel] = useState(lagret.tittel)
  const [prompt, setPrompt] = useState(lagret.prompt)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const id = useId()
  const endret = tittel.trim() !== lagret.tittel || prompt !== lagret.prompt
  const status: Skjemastatus = lagrer ? 'lagrer' : endret ? 'ulagret' : 'uendret'
  useEffect(() => onStatus(status), [status, onStatus])
  // Forsvinner skjemaet midt i en lagring, fordi en agent tok oppgaven i
  // mellomtiden, er det ikke noe igjen å vokte.
  useEffect(() => () => onStatus('uendret'), [onStatus])

  const lagre = async () => {
    if (!endret || lagrer) return
    const skrevet = tittel
    const ren = skrevet.trim()
    if (ren === '') return setFeil('Skriv en overskrift.')
    setFeil(null)
    onFortsett()
    setLagrer(true)
    // Mellomrom rundt overskriften tas bort, men ikke over noe som er skrevet mens den ble lagret.
    if (await onLagre({ tittel: ren, prompt })) setTittel((naa) => (naa === skrevet ? ren : naa))
    setLagrer(false)
  }

  const forkast = () => {
    setTittel(lagret.tittel)
    setPrompt(lagret.prompt)
    setFeil(null)
  }

  return (
    <div
      className="oppgaveskjema"
      onKeyDown={(e) => {
        // Ctrl/Cmd + Enter lagrer, som i kommentarfeltene; Enter gjør det i overskriften.
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (e.target as HTMLElement).tagName === 'INPUT')) {
          e.preventDefault()
          void lagre()
        }
      }}
    >
      <Felt
        merkelapp="Overskrift"
        value={tittel}
        maxLength={TITTEL_MEST}
        hjelp="Det oppgaven heter i lista og når Claude viser til den. Idéens egen overskrift står under."
        onChange={(e) => setTittel(e.target.value)}
      />
      <div className="felt oppgaveprompt">
        <label className="felt__merkelapp" htmlFor={id}>
          Prompt
        </label>
        <textarea
          id={id}
          className="felt__inndata felt__inndata--flerlinje oppgaveprompt__felt"
          rows={Math.max(8, prompt.split('\n').length + 1)}
          maxLength={PROMPT_MEST}
          value={prompt}
          aria-describedby={`${id}-hjelp`}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <span id={`${id}-hjelp`} className="felt__hjelp">
          Skriv oppgaven slik at en språkmodell kan utføre den uten å spørre: hva som skal endres, hvor i appen, og hvordan
          resultatet skal se ut og oppføre seg. Den første lagringen gjør oppgaven påbegynt.
        </span>
      </div>
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      {forlater ? (
        <Forlatvarsel onForkast={onForkast} onFortsett={onFortsett} />
      ) : (
        endret && (
          <div className="skjema__knapper ideskjema__knapper">
            <Button variant="subtle" disabled={lagrer} onClick={forkast}>
              Forkast endringene
            </Button>
            <Button className="knapp--kompakt" disabled={lagrer} onClick={() => void lagre()}>
              {lagrer ? 'Lagrer …' : 'Lagre endringene'}
            </Button>
          </div>
        )
      )}
    </div>
  )
}
