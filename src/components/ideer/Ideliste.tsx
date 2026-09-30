import { useId, useMemo } from 'react'
import {
  ARKIVFRIST_DAGER,
  GRUPPEKRITERIER,
  KRITERIENAVN,
  andrevalg,
  dagerTilSletting,
  erKategori,
  grupperIdeer,
  idetilstand,
  velgForst,
  type Ide,
  type Idegruppe,
  type Idekategori,
  type Sortering,
} from '../../ideer/modell'
import { Ikon } from '../ikon/Ikon'
import { Forfatterbilde, useForfatternavn, useForfatterkontekst } from '../traad/Forfatterkontekst'
import { Ideskuff } from './Ideskuff'
import { Kategorimerke, Oppgavekode, Oppgavestatusmerke } from './Merker'
import { Tidspunkt, Valgrad } from '../traad/Smadeler'

/** Skuffene nederst i lista, etter navnet laget husker dem under. */
export const SKUFF_OVERFORT = 'overfort'
export const SKUFF_ARKIV = 'arkiv'

/**
 * Lista over idéene: kort under overskrifter, med sorteringen øverst.
 * Førstekriteriet gir overskriftene; andre- og tredjekriteriet rekkefølgen
 * under dem (se `grupperIdeer`). Under hver kategori står en knapp for en ny
 * idé i den.
 *
 * Nederst står to skuffer: idéene som er overført til Planlagte oppgaver, som
 * åpner oppgaven, og arkivet med dem som ikke er aktuelle.
 */
export function Ideliste({
  ideer,
  sortering,
  onSortering,
  onApne,
  onNy,
  onOppgave,
  apneSkuffer,
  onVeksleSkuff,
}: {
  ideer: Ide[]
  sortering: Sortering
  onSortering: (sortering: Sortering) => void
  onApne: (id: string) => void
  onNy: (kategori?: Idekategori) => void
  /** Et kort for en overført idé åpner oppgaven i Planlagte oppgaver. */
  onOppgave: (oppgave: string) => void
  apneSkuffer: ReadonlySet<string>
  onVeksleSkuff: (navn: string) => void
}) {
  const { profiler } = useForfatterkontekst()
  const { apne, overforte, arkiverte } = useMemo(() => {
    const etter = (tilstand: ReturnType<typeof idetilstand>) => ideer.filter((i) => idetilstand(i) === tilstand)
    return {
      apne: etter('apen'),
      overforte: etter('overfort'),
      arkiverte: etter('arkivert').sort((a, b) => Date.parse(b.arkivert_kl!) - Date.parse(a.arkivert_kl!)),
    }
  }, [ideer])
  const grupper = useMemo(() => grupperIdeer(apne, sortering, profiler), [apne, sortering, profiler])

  return (
    <div className="ideliste">
      <Sorteringsvalg sortering={sortering} onEndre={onSortering} />
      {grupper.length === 0 ? (
        <Nyknapp onNy={() => onNy()} />
      ) : (
        grupper.map((gruppe) => (
          <Gruppe key={gruppe.nokkel} gruppe={gruppe} sortering={sortering} onApne={onApne} onNy={onNy} />
        ))
      )}
      {overforte.length > 0 && (
        <Ideskuff
          tittel="Planlagte oppgaver"
          ikon="oppgaver"
          antall={overforte.length}
          forklaring="Idéene som er overført til Planlagte oppgaver. Et trykk åpner oppgaven."
          apen={apneSkuffer.has(SKUFF_OVERFORT)}
          onVeksle={() => onVeksleSkuff(SKUFF_OVERFORT)}
        >
          <Kortliste ideer={overforte} onApne={(ide) => onOppgave(ide.oppgave!.id)} />
        </Ideskuff>
      )}
      {arkiverte.length > 0 && (
        <Ideskuff
          tittel="Ikke aktuelt"
          ikon="arkiv"
          antall={arkiverte.length}
          forklaring={`Idéene slettes automatisk ${ARKIVFRIST_DAGER} dager etter at de ble lagt her.`}
          apen={apneSkuffer.has(SKUFF_ARKIV)}
          onVeksle={() => onVeksleSkuff(SKUFF_ARKIV)}
        >
          <Kortliste ideer={arkiverte} onApne={(ide) => onApne(ide.id)} />
        </Ideskuff>
      )}
    </div>
  )
}

/** Kortene i en skuff, med kategori og forfatter på hvert. */
function Kortliste({ ideer, onApne }: { ideer: Ide[]; onApne: (ide: Ide) => void }) {
  return (
    <ul className="idekortliste">
      {ideer.map((ide) => (
        <li key={ide.id}>
          <Idekort ide={ide} visKategori visForfatter onApne={() => onApne(ide)} />
        </li>
      ))}
    </ul>
  )
}

function Sorteringsvalg({ sortering, onEndre }: { sortering: Sortering; onEndre: (s: Sortering) => void }) {
  return (
    <div className="idesortering">
      <Valgrad
        navn="Grupper etter"
        valg={GRUPPEKRITERIER}
        valgt={sortering.forst}
        etiketter={KRITERIENAVN}
        onVelg={(k) => onEndre(velgForst(sortering, k))}
      />
      <Valgrad
        navn="Sorter etter"
        valg={andrevalg(sortering.forst)}
        valgt={sortering.deretter}
        etiketter={KRITERIENAVN}
        onVelg={(k) => onEndre({ ...sortering, deretter: k })}
      />
    </div>
  )
}

function Gruppe({
  gruppe,
  sortering,
  onApne,
  onNy,
}: {
  gruppe: Idegruppe
  sortering: Sortering
  onApne: (id: string) => void
  onNy: (kategori?: Idekategori) => void
}) {
  const id = useId()
  const kategori = gruppe.kriterium === 'kategori' && erKategori(gruppe.nokkel) ? gruppe.nokkel : null
  return (
    <section className="idegruppe" aria-labelledby={id}>
      <h3 id={id} className="idegruppe__navn">
        {gruppe.kriterium === 'bruker' && <Forfatterbilde id={gruppe.nokkel} storrelse="mini" />}
        <span>{gruppe.navn}</span>
        <span className="idegruppe__antall">{gruppe.ideer.length}</span>
      </h3>
      {gruppe.ideer.length > 0 && (
        <ul className="idekortliste">
          {gruppe.ideer.map((ide) => (
            <li key={ide.id}>
              <Idekort
                ide={ide}
                visKategori={sortering.forst !== 'kategori'}
                visForfatter={sortering.forst !== 'bruker'}
                onApne={() => onApne(ide.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {/* En ny idé i kategorien, under den nederste. Gruppert etter bruker hører den ikke hjemme under noen. */}
      {kategori && <Nyknapp onNy={() => onNy(kategori)} navn={`Ny idé i ${gruppe.navn.toLowerCase()}`} />}
    </section>
  )
}

/** Et kort i lista. Hele kortet er knappen som åpner idéen. */
function Idekort({
  ide,
  visKategori,
  visForfatter,
  onApne,
}: {
  ide: Ide
  visKategori: boolean
  visForfatter: boolean
  onApne: () => void
}) {
  const navn = useForfatternavn(ide.forfatter_id)
  const nye = ide.nye_kommentarer
  return (
    <button type="button" className="idekort" data-ide={ide.id} data-ih="" onClick={onApne}>
      <span className="idekort__tittel">{ide.tittel}</span>
      <span className="idekort__meta">
        {visForfatter && (
          <>
            <Forfatterbilde id={ide.forfatter_id} storrelse="mini" />
            <span className="idekort__navn">{navn}</span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <Tidspunkt iso={ide.opprettet_kl} />
        {visKategori && <Kategorimerke kategori={ide.kategori} />}
        {ide.oppgave && <Oppgavestatusmerke status={ide.oppgave.status} />}
        {ide.oppgave?.nummer != null && <Oppgavekode nummer={ide.oppgave.nummer} />}
        {!ide.oppgave && ide.arkivert_kl && <Slettes arkivertKl={ide.arkivert_kl} />}
      </span>
      <span className="idekort__tall">
        <span className="idekort__tal" data-gitt={ide.mitt_hjerte || undefined}>
          <Ikon navn="heart" storrelse="ui" etikett={`${ide.hjerter} ${ide.hjerter === 1 ? 'hjerte' : 'hjerter'}`} />
          <span aria-hidden="true">{ide.hjerter}</span>
        </span>
        <span className="idekort__tal" data-nytt={nye > 0 || undefined}>
          <Ikon
            navn="comment"
            storrelse="ui"
            etikett={`${ide.kommentarer} ${ide.kommentarer === 1 ? 'kommentar' : 'kommentarer'}${nye > 0 ? `, ${nye} ${nye === 1 ? 'ny' : 'nye'}` : ''}`}
          />
          <span aria-hidden="true">{ide.kommentarer}</span>
          {nye > 0 && <span className="nyprikk" aria-hidden="true" />}
        </span>
      </span>
      <span className="idekort__pil" aria-hidden="true">
        <Ikon navn="chev" />
      </span>
    </button>
  )
}

/** Når en arkivert idé slettes, i hele dager. */
function Slettes({ arkivertKl }: { arkivertKl: string }) {
  const dager = dagerTilSletting(arkivertKl)
  return <span className="idekort__slettes">{dager <= 1 ? 'Slettes i morgen' : `Slettes om ${dager} dager`}</span>
}

function Nyknapp({ onNy, navn = 'Ny idé' }: { onNy: () => void; navn?: string }) {
  return (
    <button type="button" className="idekort idekort--ny" data-ih="" onClick={onNy} aria-label={navn}>
      <Ikon navn="plus" storrelse="ui" />
      <span>Ny idé</span>
    </button>
  )
}

