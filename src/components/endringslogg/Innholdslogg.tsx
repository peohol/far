import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Endringsloggleser } from '../../endringslogg/api'
import {
  markorEtter,
  migrasjonslenker,
  type Endring,
  type Endringsdel,
  type Endringsside,
  type Rapport,
} from '../../endringslogg/modell'
import { beskrivelser, delnavn, endringslinjer, sammendrag } from '../../endringslogg/oppsummering'
import { endringssidenokkel } from '../../endringslogg/sider'
import { fulltNavn, tidspunkt } from '../../faginnhold/historikk'
import { innholdsfelter } from '../../faginnhold/innholdsfelter'
import { OBJEKTTYPER, type Objekttype } from '../../faginnhold/modell'
import { panelFor } from '../../faginnhold/paneler'
import { useBevart } from '../../oppdatering/Bevaring'
import { Bryter } from '../Bryter'
import { Button } from '../Button'
import { Historikkvindu } from '../historikk/Historikkvindu'
import { Ikonknapp } from '../Ikonknapp'
import { FORSTE_FORING, Loggskuff } from '../Loggskuff'
import { Merke, type Merketone } from '../Merke'
import { Modallag } from '../Modallag'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import '../../styles/innholdslogg.css'

/** Hvor mange endringer som hentes om gangen. */
const SIDE = 30

const AKTOR: Record<Endring['aktor'], { navn: string; tone: Merketone }> = {
  bruker: { navn: 'Person', tone: 'flate' },
  agent: { navn: 'KI-agent', tone: 'aksent' },
  system: { navn: 'System', tone: 'noytral' },
}

type Lasting =
  | { status: 'laster'; endringer: Endring[] }
  | { status: 'feil'; feil: string; endringer: Endring[] }
  | { status: 'klar'; endringer: Endring[]; flere: boolean }

/**
 * Endringsloggen for siden som står åpen: en diskret knapp i toppmenyen, og
 * et lag med endringene i innholdet, nyeste først — hvem som gjorde dem (en
 * person, en navngitt KI-agent eller systemet), når, og hva. Hver endring kan
 * foldes ut med delene den besto av, rapporten fra en kuratering, migrasjonen
 * og lenkene en agent oppga, og sammenligningen med revisjonen før i
 * historikken.
 *
 * Andre enn administratorer ser bare det som er publisert; det håndhever
 * databasen (`public.les_endringslogg`, `docs/innholdsendringer.md`).
 */
export function Innholdslogg({
  side,
  sidenavn,
  leser,
  admin,
}: {
  side: Endringsside
  sidenavn: string
  leser: Endringsloggleser
  admin: boolean
}) {
  const [apen, setApen] = useBevart('innholdslogg', false)
  const lukk = useCallback(() => setApen(false), [setApen])
  return (
    <>
      <ToppmenyInnhold spor="endringslogg">
        <Ikonknapp
          ikon="history"
          etikett="Endringslogg"
          className="innholdslogg__knapp"
          aria-haspopup="dialog"
          onClick={() => setApen(true)}
        />
      </ToppmenyInnhold>
      {apen && <Loggvindu side={side} sidenavn={sidenavn} leser={leser} admin={admin} onLukk={lukk} />}
    </>
  )
}

function Loggvindu({
  side,
  sidenavn,
  leser,
  admin,
  onLukk,
}: {
  side: Endringsside
  sidenavn: string
  leser: Endringsloggleser
  admin: boolean
  onLukk: () => void
}) {
  const [medUtkast, setMedUtkast] = useBevart('innholdslogg/utkast', true)
  const [medRutiner, setMedRutiner] = useBevart('innholdslogg/rutiner', false)
  const [apenSkuff, setApenSkuff] = useBevart<string | null>('innholdslogg/apen', null)
  const [lasting, setLasting] = useState<Lasting>({ status: 'laster', endringer: [] })
  const [sammenligner, setSammenligner] = useState<Endringsdel | null>(null)
  const nokkel = endringssidenokkel(side)
  const valg = useMemo(() => ({ medUtkast: admin && medUtkast, medRutiner, antall: SIDE }), [admin, medUtkast, medRutiner])

  useEffect(() => {
    let gjelder = true
    setLasting({ status: 'laster', endringer: [] })
    leser
      .les(JSON.parse(nokkel) as Endringsside, valg)
      .then(({ endringer, flere }) => gjelder && setLasting({ status: 'klar', endringer, flere }))
      .catch((e: Error) => gjelder && setLasting({ status: 'feil', feil: e.message, endringer: [] }))
    return () => {
      gjelder = false
    }
  }, [leser, nokkel, valg])

  const hentEldre = async () => {
    const siste = lasting.endringer.at(-1)
    if (!siste) return
    const endringer = lasting.endringer
    setLasting({ status: 'laster', endringer })
    try {
      const neste = await leser.les(side, { ...valg, etter: markorEtter(siste) })
      setLasting({ status: 'klar', endringer: [...endringer, ...neste.endringer], flere: neste.flere })
    } catch (e) {
      setLasting({ status: 'feil', feil: (e as Error).message, endringer })
    }
  }

  return (
    <>
      <Modallag apen tittel={`Endringslogg: ${sidenavn}`} ikon="history" onLukk={onLukk} autofokus={FORSTE_FORING} tettKropp>
        <div className="innholdslogg__valg">
          {admin && (
            <Bryter pa={medUtkast} onEndre={setMedUtkast}>
              Vis utkast
            </Bryter>
          )}
          <Bryter pa={medRutiner} onEndre={setMedRutiner}>
            Vis rutineendringer
          </Bryter>
        </div>

        {lasting.endringer.length > 0 && (
          <ul className="logg__liste">
            {lasting.endringer.map((endring) => (
              <Foring
                key={endring.id}
                endring={endring}
                apen={apenSkuff === endring.id}
                onVeksle={() => setApenSkuff((a) => (a === endring.id ? null : endring.id))}
                onSammenlign={setSammenligner}
              />
            ))}
          </ul>
        )}
        {lasting.status === 'laster' && <p role="status">Henter endringene …</p>}
        {lasting.status === 'feil' && (
          <p className="innholdslogg__feil" role="alert">
            Fikk ikke hentet endringsloggen. {lasting.feil}
          </p>
        )}
        {lasting.status === 'klar' && lasting.endringer.length === 0 && (
          <p className="innholdslogg__tom">Ingen endringer å vise ennå.</p>
        )}
        {lasting.status === 'klar' && lasting.flere && (
          <div className="innholdslogg__flere">
            <Button variant="subtle" onClick={() => void hentEldre()}>
              Vis eldre endringer
            </Button>
          </div>
        )}
      </Modallag>

      {sammenligner && erObjekttype(sammenligner.type) && (
        <Historikkvindu
          apen
          navn={delnavn(sammenligner)}
          objekt={sammenligner.objekt}
          felter={(innhold) => innholdsfelter(sammenligner.type as Objekttype, innhold as never)}
          forstValgt={sammenligner.til}
          forstMot={sammenligner.fra}
          onLukk={() => setSammenligner(null)}
        />
      )}
    </>
  )
}

const erObjekttype = (type: string): type is Objekttype => (OBJEKTTYPER as readonly string[]).includes(type)

/** Hvem som gjorde endringen, slik den står i loggen. */
export function hvem(endring: Endring): string {
  const person = endring.person && fulltNavn(endring.person)
  if (endring.aktor === 'bruker') return person || 'Ukjent person'
  return endring.agent?.navn ?? (endring.aktor === 'agent' ? 'Ukjent agent' : 'Systemet')
}

function Foring({
  endring,
  apen,
  onVeksle,
  onSammenlign,
}: {
  endring: Endring
  apen: boolean
  onVeksle: () => void
  onSammenlign: (del: Endringsdel) => void
}) {
  const aktor = AKTOR[endring.aktor]
  return (
    <Loggskuff
      apen={apen}
      onVeksle={onVeksle}
      data-endring={endring.id}
      merking={
        <>
          <span className="innholdslogg__tid">{tidspunkt(endring.kl)}</span> ·{' '}
          <span className="innholdslogg__hvem">{hvem(endring)}</span>
        </>
      }
      sammendrag={sammendrag(endring)}
      merker={
        <>
          <Merke tone={aktor.tone}>{aktor.navn}</Merke>
          {endring.art === 'kuratering' && <Merke tone="referanse">Kuratering</Merke>}
          {endring.utkast && <Merke tone="fritak">Utkast</Merke>}
        </>
      }
    >
      <Detaljer endring={endring} onSammenlign={onSammenlign} />
    </Loggskuff>
  )
}

function Blokk({ tittel, children }: { tittel: string; children: ReactNode }) {
  return (
    <section className="innholdslogg__blokk">
      <h3 className="innholdslogg__overskrift">{tittel}</h3>
      {children}
    </section>
  )
}

function Punkter({ punkter }: { punkter: readonly ReactNode[] }) {
  return (
    <ul className="innholdslogg__punkter">
      {punkter.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ul>
  )
}

function Detaljer({ endring, onSammenlign }: { endring: Endring; onSammenlign: (del: Endringsdel) => void }) {
  const endret = beskrivelser(endringslinjer(endring))
  return (
    <div className="innholdslogg__kropp">
      {endring.agent && (
        <Blokk tittel="Utført av">
          <p>
            <strong>{endring.agent.navn}</strong>
            {endring.agent.beskrivelse && ` — ${endring.agent.beskrivelse}`}
          </p>
        </Blokk>
      )}
      {endring.rapport ? (
        <Rapportvisning rapport={endring.rapport} />
      ) : (
        endret.length > 0 && (
          <Blokk tittel="Hva som ble endret">
            <Punkter punkter={endret} />
          </Blokk>
        )
      )}
      {endring.deler.length > 0 && (
        <Blokk tittel="Sammenlign med versjonen før">
          <ul className="innholdslogg__punkter">
            {endring.deler.map((del) => (
              <li key={`${del.objekt}:${del.til}`} className="innholdslogg__del">
                <span className="innholdslogg__del-tekst">{delnavn(del)}</span>
                {erObjekttype(del.type) && (
                  <button type="button" className="innholdslogg__sammenlign" onClick={() => onSammenlign(del)}>
                    {del.fra === null ? 'Vis' : 'Sammenlign'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Blokk>
      )}
      <Kilder endring={endring} />
    </div>
  )
}

/** Rapporten en KI-agent leverte med kurateringen: hva som faktisk ble gjort, seksjon for seksjon. */
function Rapportvisning({ rapport }: { rapport: Rapport }) {
  const lister: [string, string[]][] = [
    ['Nye opplysninger', rapport.nye_opplysninger],
    ['Korrigeringer', rapport.korrigeringer],
    ['Endringer i kildegrunnlaget', rapport.kildegrunnlag],
    ['Uavklarte mangler', rapport.mangler],
  ]
  return (
    <>
      {rapport.seksjoner.map((s) => (
        <Blokk key={s.seksjon} tittel={panelFor(s.seksjon)?.tittel ?? s.seksjon}>
          <Punkter
            punkter={[
              ...s.nytt.map((t) => `Nytt: ${t}`),
              ...s.endret.map((t) => `Endret: ${t}`),
              ...s.fjernet.map((t) => `Fjernet: ${t}`),
            ]}
          />
        </Blokk>
      ))}
      {lister.map(
        ([tittel, punkter]) =>
          punkter.length > 0 && (
            <Blokk key={tittel} tittel={tittel}>
              <Punkter punkter={punkter} />
            </Blokk>
          ),
      )}
    </>
  )
}

/** Migrasjonen og lenkene en agent eller systemet gjorde endringen med. */
function Kilder({ endring }: { endring: Endring }) {
  if (!endring.migrasjon && endring.lenker.length === 0) return null
  const migrasjon = endring.migrasjon && migrasjonslenker(endring.migrasjon)
  return (
    <Blokk tittel="Kilde">
      {endring.migrasjon && (
        <p>
          Migrasjonen <code>{endring.migrasjon}</code>{' '}
          {endring.verifisert ? '— bekreftet kjørt i databasen.' : '— ikke funnet i databasens migrasjonshistorikk.'}
        </p>
      )}
      <ul className="innholdslogg__lenker">
        {migrasjon && (
          <>
            <li>
              <a href={migrasjon.fil} target="_blank" rel="noreferrer">
                Se migrasjonen<span className="kun-skjermleser"> (åpnes i ny fane)</span>
              </a>
            </li>
            <li>
              <a href={migrasjon.historikk} target="_blank" rel="noreferrer">
                Se endringen i GitHub<span className="kun-skjermleser"> (åpnes i ny fane)</span>
              </a>
            </li>
          </>
        )}
        {endring.lenker.map((lenke) => (
          <li key={lenke}>
            <a href={lenke} target="_blank" rel="noreferrer">
              {lenketekst(lenke)}
              <span className="kun-skjermleser"> (åpnes i ny fane)</span>
            </a>
          </li>
        ))}
      </ul>
    </Blokk>
  )
}

/** «PR #187», «Commit a1b2c3d». */
export function lenketekst(lenke: string): string {
  const pr = /\/pull\/(\d+)/.exec(lenke)
  if (pr) return `PR #${pr[1]}`
  const commit = /\/commit\/([0-9a-f]{7})/i.exec(lenke)
  return commit ? `Commit ${commit[1]}` : lenke
}
