import { useId, useMemo } from 'react'
import { OPPGAVESTATUSNAVN, oppgavekode } from '../../ideer/modell'
import { grupperOppgaver, iEndringsloggen, type Oppgave } from '../../ideer/oppgaver'
import { visEndringslogg } from '../endringsloggvisning'
import { Ikon } from '../ikon/Ikon'
import { Ikonknapp } from '../Ikonknapp'
import { Forfatterbilde, useForfatternavn } from './Idekontekst'
import { Ideskuff } from './Ideskuff'
import { Kategorimerke, Oppgavekode } from './Merker'
import { Tidspunkt } from './Smadeler'

/** Skuffen med de utførte, etter navnet laget husker den under. */
export const SKUFF_UTFORTE = 'utforte'

/**
 * Oppgavene under statusene med arbeid igjen, og de utførte i en lukket skuff
 * nederst. Hver oppgave har nummeret sitt, og hver utførte en knapp til
 * føringen i endringsloggen.
 */
export function Oppgaveliste({
  oppgaver,
  onApne,
  apneSkuffer,
  onVeksleSkuff,
}: {
  oppgaver: Oppgave[]
  onApne: (id: string) => void
  apneSkuffer: ReadonlySet<string>
  onVeksleSkuff: (navn: string) => void
}) {
  const { aktive, utforte } = useMemo(() => grupperOppgaver(oppgaver), [oppgaver])

  return (
    <div className="ideliste">
      {aktive.map((gruppe) => (
        <Statusgruppe key={gruppe.status} status={gruppe.status} oppgaver={gruppe.oppgaver} onApne={onApne} />
      ))}
      <Ideskuff
        tittel="Utførte oppgaver"
        ikon="done"
        antall={utforte.length}
        apen={apneSkuffer.has(SKUFF_UTFORTE)}
        onVeksle={() => onVeksleSkuff(SKUFF_UTFORTE)}
      >
        {utforte.length === 0 ? (
          <p className="idegruppe__tom">Ingen oppgaver er utført ennå.</p>
        ) : (
          <ul className="idekortliste">
            {utforte.map((oppgave) => (
              <li key={oppgave.id} className="oppgaverad">
                <Oppgavekort oppgave={oppgave} onApne={() => onApne(oppgave.id)} />
                {iEndringsloggen(oppgave.endringslogg) && oppgave.nummer !== null && (
                  <Ikonknapp
                    ikon="history"
                    etikett={`Se ${oppgavekode(oppgave.nummer)} i endringsloggen (versjon ${oppgave.endringslogg})`}
                    variant="stille"
                    utenTips
                    onClick={() => visEndringslogg(oppgave.endringslogg)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Ideskuff>
    </div>
  )
}

function Statusgruppe({
  status,
  oppgaver,
  onApne,
}: {
  status: Oppgave['status']
  oppgaver: Oppgave[]
  onApne: (id: string) => void
}) {
  const id = useId()
  return (
    <section className="idegruppe" aria-labelledby={id}>
      <h3 id={id} className="idegruppe__navn">
        <span className="statusprikk" data-status={status} aria-hidden="true" />
        <span>{OPPGAVESTATUSNAVN[status]}</span>
        <span className="idegruppe__antall">{oppgaver.length}</span>
      </h3>
      {oppgaver.length === 0 ? (
        <p className="idegruppe__tom">Ingen oppgaver.</p>
      ) : (
        <ul className="idekortliste">
          {oppgaver.map((oppgave) => (
            <li key={oppgave.id}>
              <Oppgavekort oppgave={oppgave} onApne={() => onApne(oppgave.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Et kort i lista. Hele kortet er knappen som åpner oppgaven. */
function Oppgavekort({ oppgave, onApne }: { oppgave: Oppgave; onApne: () => void }) {
  const navn = useForfatternavn(oppgave.forfatter_id)
  const utfort = oppgave.status === 'utfort'
  return (
    <button type="button" className="idekort" data-oppgave={oppgave.id} data-ih="" onClick={onApne}>
      <span className="idekort__tittel">
        {oppgave.nummer !== null && <Oppgavekode nummer={oppgave.nummer} />}
        {oppgave.tittel}
      </span>
      <span className="idekort__meta">
        <Forfatterbilde id={oppgave.forfatter_id} storrelse="mini" />
        <span className="idekort__navn">{navn}</span>
        <span aria-hidden="true">·</span>
        <Hendelse oppgave={oppgave} />
        <Kategorimerke kategori={oppgave.kategori} />
        {!utfort && !oppgave.har_prompt && <span className="idekort__slettes">Ingen prompt ennå</span>}
      </span>
      <span className="idekort__pil" aria-hidden="true">
        <Ikon navn="chev" />
      </span>
    </button>
  )
}

/** Det siste som skjedde med oppgaven, med tiden: utført, tatt av en agent eller overført. */
function Hendelse({ oppgave }: { oppgave: Oppgave }) {
  const [hva, iso] =
    oppgave.status === 'utfort' && oppgave.utfort_kl
      ? ['utført', oppgave.utfort_kl]
      : oppgave.status === 'haandteres' && oppgave.tatt_kl
        ? ['tatt av en agent', oppgave.tatt_kl]
        : ['overført', oppgave.overfort_kl]
  return (
    <span>
      {hva} <Tidspunkt iso={iso} />
    </span>
  )
}
