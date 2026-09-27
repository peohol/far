import { useId, useMemo } from 'react'
import {
  GRUPPEKRITERIER,
  KRITERIENAVN,
  andrevalg,
  erKategori,
  grupperIdeer,
  velgForst,
  type Ide,
  type Idegruppe,
  type Idekategori,
  type Kriterium,
  type Sortering,
} from '../../ideer/modell'
import { Ikon } from '../ikon/Ikon'
import { Forfatterbilde, useForfatternavn, useIdekontekst } from './Idekontekst'
import { Kategorimerke } from './Kategorimerke'
import { Tidspunkt } from './Smadeler'

/**
 * Lista over idéene: kort under overskrifter, med sorteringen øverst.
 * Førstekriteriet gir overskriftene; andre- og tredjekriteriet rekkefølgen
 * under dem (se `grupperIdeer`).
 */
export function Ideliste({
  ideer,
  sortering,
  onSortering,
  onApne,
  onNy,
}: {
  ideer: Ide[]
  sortering: Sortering
  onSortering: (sortering: Sortering) => void
  onApne: (id: string) => void
  onNy: (kategori?: Idekategori) => void
}) {
  const { profiler } = useIdekontekst()
  const grupper = useMemo(() => grupperIdeer(ideer, sortering, profiler), [ideer, sortering, profiler])

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
    </div>
  )
}

function Sorteringsvalg({ sortering, onEndre }: { sortering: Sortering; onEndre: (s: Sortering) => void }) {
  const id = useId()
  return (
    <div className="idesortering">
      <Valgrad
        id={`${id}-forst`}
        navn="Grupper etter"
        valg={GRUPPEKRITERIER}
        valgt={sortering.forst}
        onVelg={(k) => onEndre(velgForst(sortering, k as (typeof GRUPPEKRITERIER)[number]))}
      />
      <Valgrad
        id={`${id}-deretter`}
        navn="Sorter etter"
        valg={andrevalg(sortering.forst)}
        valgt={sortering.deretter}
        onVelg={(k) => onEndre({ ...sortering, deretter: k })}
      />
    </div>
  )
}

function Valgrad({
  id,
  navn,
  valg,
  valgt,
  onVelg,
}: {
  id: string
  navn: string
  valg: readonly Kriterium[]
  valgt: Kriterium
  onVelg: (k: Kriterium) => void
}) {
  return (
    <div className="idesortering__rad" role="group" aria-labelledby={id}>
      <span id={id} className="idesortering__navn">
        {navn}
      </span>
      {valg.map((k) => (
        <button key={k} type="button" className="sokefilter" aria-pressed={k === valgt} onClick={() => onVelg(k)}>
          {KRITERIENAVN[k]}
        </button>
      ))}
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
  return (
    <section className="idegruppe" aria-labelledby={id}>
      <h3 id={id} className="idegruppe__navn">
        {gruppe.kriterium === 'bruker' && <Forfatterbilde id={gruppe.nokkel} storrelse="mini" />}
        <span>{gruppe.navn}</span>
        <span className="idegruppe__antall">{gruppe.ideer.length}</span>
      </h3>
      {gruppe.ideer.length === 0 ? (
        <Nyknapp onNy={() => onNy(erKategori(gruppe.nokkel) ? gruppe.nokkel : undefined)} navn={`Ny idé i ${gruppe.navn.toLowerCase()}`} />
      ) : (
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
      </span>
      <span className="idekort__tall">
        <span className="idekort__tal" data-gitt={ide.mitt_hjerte || undefined}>
          <Ikon navn="heart" storrelse="ui" etikett={`${ide.hjerter} ${ide.hjerter === 1 ? 'hjerte' : 'hjerter'}`} />
          <span aria-hidden="true">{ide.hjerter}</span>
        </span>
        <span className="idekort__tal">
          <Ikon navn="comment" storrelse="ui" etikett={`${ide.kommentarer} ${ide.kommentarer === 1 ? 'kommentar' : 'kommentarer'}`} />
          <span aria-hidden="true">{ide.kommentarer}</span>
        </span>
      </span>
      <span className="idekort__pil" aria-hidden="true">
        <Ikon navn="chev" />
      </span>
    </button>
  )
}

function Nyknapp({ onNy, navn = 'Ny idé' }: { onNy: () => void; navn?: string }) {
  return (
    <button type="button" className="idekort idekort--ny" data-ih="" onClick={onNy} aria-label={navn}>
      <Ikon navn="plus" storrelse="ui" />
      <span>Ny idé</span>
    </button>
  )
}

