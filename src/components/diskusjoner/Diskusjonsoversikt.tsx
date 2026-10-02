import { useCallback, useId, useRef, useState } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import {
  UKATEGORISERTE,
  type Diskusjon,
  type Diskusjonskategori,
  type Gruppering,
} from '../../diskusjoner/modell'
import { kortTid } from '../../traad/modell'
import { Ikon } from '../ikon/Ikon'
import { Bekreftknapp, Idehandling } from '../traad/Smadeler'
import { HANDTAK, useSortering, type Flytting } from '../../hooks/useSortering'

/** `data-dnd-container` på lista over kategoriene. */
export const KATEGORILISTE = 'kategorier'
/** Og på «Ukategoriserte», som ikke tar imot noe. */
const UKATEGORISERT_LISTE = 'ukategoriserte'

/**
 * Trådene på siden, i kategoriene sine: kategoriene med emoji og navn, og
 * trådene under hver, med «Ny tråd» nederst. Kategoriene og trådene kan dras
 * opp og ned, og trådene mellom kategoriene (`useSortering`); de samme
 * flyttingene kan gjøres med knapper, for kategoriene her og for trådene inne
 * i tråden.
 *
 * «Ukategoriserte» står bare når en kategori er løst opp og trådene i den
 * ikke er flyttet ennå. Den tar ikke imot nye tråder. Arkivet står nederst,
 * lukket til det åpnes.
 */
export function Diskusjonsoversikt({
  gruppering,
  kategorier,
  onApne,
  onNyTraad,
  onNyKategori,
  onEndreKategori,
  onLosOpp,
  onFlyttKategori,
  onFlyttTraad,
}: {
  gruppering: Gruppering
  kategorier: readonly Diskusjonskategori[]
  onApne: (id: string) => void
  /** En ny tråd, i kategorien den ble startet fra, eller uten. */
  onNyTraad: (kategori?: string) => void
  onNyKategori: () => void
  onEndreKategori: (kategori: Diskusjonskategori) => void
  onLosOpp: (kategori: Diskusjonskategori) => void
  onFlyttKategori: (kategori: string, indeks: number) => void
  onFlyttTraad: (traad: string, kategori: string, indeks: number) => void
}) {
  const brett = useRef<HTMLDivElement>(null)
  const [arkivApent, setArkivApent] = useBevart('arkiv', false)
  const arkivId = useId()

  const onFlytt = useCallback(
    ({ id, slag, til, indeks }: Flytting) => {
      if (slag === 'kategori') onFlyttKategori(id, indeks)
      else if (slag === 'traad' && til !== UKATEGORISERT_LISTE && til !== KATEGORILISTE) onFlyttTraad(id, til, indeks)
    },
    [onFlyttKategori, onFlyttTraad],
  )
  const navnPaaListe = useCallback(
    (liste: string) =>
      liste === KATEGORILISTE
        ? 'kategoriene'
        : liste === UKATEGORISERT_LISTE
          ? UKATEGORISERTE.navn
          : (kategorier.find((k) => k.id === liste)?.navn ?? 'kategorien'),
    [kategorier],
  )
  useSortering(brett, onFlytt, navnPaaListe)

  const { kategorier: grupper, ukategoriserte, arkiv } = gruppering

  return (
    <div className="diskusjonsoversikt">
      <div ref={brett} className="diskusjonsbrett">
        {ukategoriserte.length > 0 && (
          <section className="diskusjonskategori diskusjonskategori--ukategorisert" aria-labelledby={`${arkivId}-u`}>
            <h3 id={`${arkivId}-u`} className="diskusjonskategori__hode">
              <span className="diskusjonskategori__emoji" aria-hidden="true">
                {UKATEGORISERTE.emoji}
              </span>
              <span className="diskusjonskategori__navn">{UKATEGORISERTE.navn}</span>
            </h3>
            <p className="diskusjonskategori__merknad">Trådene her har mistet kategorien sin. Flytt dem til en kategori.</p>
            <Traadliste liste={UKATEGORISERT_LISTE} diskusjoner={ukategoriserte} onApne={onApne} />
          </section>
        )}

        {grupper.length === 0 && ukategoriserte.length === 0 && (
          <p className="diskusjonsoversikt__tom">Ingen tråder på denne siden ennå. Start den første.</p>
        )}

        <ol className="kategoriliste" data-dnd-container={KATEGORILISTE} data-tar="kategori">
          {grupper.map(({ kategori, diskusjoner }, indeks) => (
            <Kategori
              key={kategori.id}
              kategori={kategori}
              diskusjoner={diskusjoner}
              forste={indeks === 0}
              siste={indeks === grupper.length - 1}
              onApne={onApne}
              onNyTraad={() => onNyTraad(kategori.id)}
              onEndre={() => onEndreKategori(kategori)}
              onLosOpp={() => onLosOpp(kategori)}
              onFlytt={(til) => onFlyttKategori(kategori.id, til)}
              indeks={indeks}
            />
          ))}
        </ol>
      </div>

      <div className="diskusjonsoversikt__nye">
        <button type="button" className="nytraadknapp" onClick={() => onNyTraad()}>
          <Ikon navn="plus" storrelse="ui" />
          <span>Ny tråd</span>
        </button>
        <button type="button" className="nytraadknapp" onClick={onNyKategori}>
          <Ikon navn="plus" storrelse="ui" />
          <span>Ny kategori</span>
        </button>
      </div>

      {arkiv.length > 0 && (
        <section className="diskusjonsarkiv" data-apen={arkivApent || undefined}>
          <h3 className="diskusjonsarkiv__hode">
            <button type="button" aria-expanded={arkivApent} aria-controls={arkivId} onClick={() => setArkivApent((a) => !a)}>
              <Ikon navn="arkiv" storrelse="ui" />
              <span>Arkiv</span>
              <span className="diskusjonsarkiv__antall" aria-label={`${arkiv.length} tråder`}>
                {arkiv.length}
              </span>
              <Ikon navn="chev" storrelse="ui" className="diskusjonsarkiv__pil" />
            </button>
          </h3>
          <ul id={arkivId} className="traadliste" hidden={!arkivApent}>
            {arkiv.map((d) => (
              <li key={d.id} className="traadrad">
                <Traadknapp diskusjon={d} onApne={onApne} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Én kategori: hodet med emoji, navn og handlinger, trådene, og «Ny tråd» nederst. */
function Kategori({
  kategori,
  diskusjoner,
  indeks,
  forste,
  siste,
  onApne,
  onNyTraad,
  onEndre,
  onLosOpp,
  onFlytt,
}: {
  kategori: Diskusjonskategori
  diskusjoner: Diskusjon[]
  indeks: number
  forste: boolean
  siste: boolean
  onApne: (id: string) => void
  onNyTraad: () => void
  onEndre: () => void
  onLosOpp: () => void
  onFlytt: (indeks: number) => void
}) {
  const [handlinger, setHandlinger] = useState(false)
  const id = useId()
  const nye = diskusjoner.filter((d) => d.usett).length

  return (
    <li
      className="diskusjonskategori"
      data-dnd-id={kategori.id}
      data-slag="kategori"
      data-navn={`${kategori.emoji} ${kategori.navn}`}
      data-kategori={kategori.id}
      aria-labelledby={id}
    >
      <div className="diskusjonskategori__hode">
        <span className={HANDTAK.slice(1)} aria-hidden="true" title="Dra for å flytte kategorien">
          <Ikon navn="more" storrelse="ui" />
        </span>
        <h3 id={id} className="diskusjonskategori__tittel">
          <span className="diskusjonskategori__emoji" aria-hidden="true">
            {kategori.emoji}
          </span>
          <span className="diskusjonskategori__navn">{kategori.navn}</span>
          {nye > 0 && (
            <span className="nyttmerke" aria-label={`${nye} med nytt`}>
              {nye}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="diskusjonskategori__mer"
          aria-expanded={handlinger}
          aria-label={`Handlinger for ${kategori.navn}`}
          onClick={() => setHandlinger((h) => !h)}
        >
          <Ikon navn="gears" storrelse="ui" />
        </button>
        {handlinger && (
          <div className="idehandlinger diskusjonskategori__handlinger">
            <Idehandling ikon="edit" onClick={onEndre}>
              Endre
            </Idehandling>
            {!forste && (
              <Idehandling ikon="opp" onClick={() => onFlytt(indeks - 1)}>
                Flytt opp
              </Idehandling>
            )}
            {!siste && (
              <Idehandling ikon="ned" onClick={() => onFlytt(indeks + 1)}>
                Flytt ned
              </Idehandling>
            )}
            <Bekreftknapp
              ikon="trash"
              tekst="Løs opp"
              bekreftTekst="Bekreft"
              etikett={`Løs opp ${kategori.navn}`}
              bekreftEtikett={`Bekreft at ${kategori.navn} løses opp. Trådene havner under ${UKATEGORISERTE.navn}.`}
              onBekreft={onLosOpp}
            />
          </div>
        )}
      </div>
      <Traadliste liste={kategori.id} tar="traad" diskusjoner={diskusjoner} onApne={onApne} />
      <button type="button" className="nytraadknapp nytraadknapp--kategori" onClick={onNyTraad}>
        <Ikon navn="plus" storrelse="ui" />
        <span>Ny tråd</span>
      </button>
    </li>
  )
}

/** Trådene i én liste. Lista har bare trådene i seg, så Smett kan ordne dem. */
function Traadliste({
  liste,
  tar,
  diskusjoner,
  onApne,
}: {
  liste: string
  tar?: string
  diskusjoner: Diskusjon[]
  onApne: (id: string) => void
}) {
  return (
    <ol className="traadliste" data-dnd-container={liste} data-tar={tar}>
      {diskusjoner.map((d) => (
        <li key={d.id} className="traadrad" data-dnd-id={d.id} data-slag="traad" data-navn={d.tittel}>
          <span className={HANDTAK.slice(1)} aria-hidden="true" title="Dra for å flytte tråden">
            <Ikon navn="more" storrelse="ui" />
          </span>
          <Traadknapp diskusjon={d} onApne={onApne} />
        </li>
      ))}
    </ol>
  )
}

/** Tråden i en liste: overskriften, kommentarene og når det sist skjedde noe, og et merke når noe er nytt. */
export function Traadknapp({ diskusjon, onApne, utdrag }: { diskusjon: Diskusjon; onApne: (id: string) => void; utdrag?: string | null }) {
  const { kommentarer } = diskusjon
  return (
    <button type="button" className="traadknapp" data-traad={diskusjon.id} onClick={() => onApne(diskusjon.id)}>
      <span className="traadknapp__tittel">
        {diskusjon.usett && <span className="nyttprikk" aria-label="Nytt" />}
        {diskusjon.tittel}
      </span>
      {utdrag && <span className="traadknapp__utdrag">{utdrag}</span>}
      <span className="traadknapp__meta">
        <Ikon navn="comment" storrelse="ui" />
        {kommentarer} · {kortTid(diskusjon.siste_kl)}
      </span>
    </button>
  )
}
