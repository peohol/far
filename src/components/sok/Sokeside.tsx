import { useEffect, useId, useMemo, useState } from 'react'
import { TREFFGRUPPER, sidenokkel, treffgruppe, type Soketreff, type Treffgruppe } from '../../faginnhold/sok'
import { useLukkMedEscape } from '../../hooks/useLukkMedEscape'
import type { Sokeindekstilstand } from '../../hooks/useSokeindeks'
import { Button } from '../Button'
import { Lastesirkel } from '../Lasteindikator'
import { Ikon } from '../ikon/Ikon'
import { Lukkeknapp } from '../Lukkeknapp'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import { Markert } from './Markert'
import { GRUPPENAVN, HENTER_MER, type Treffvisning } from './treffvisning'
import { useFagsoketreff } from './useFagsoketreff'

/** Flest treff som vises i en gruppe før «Vis alle». */
export const GRUPPEGRENSE = 20

export interface SokesideProps {
  /** Søket fra adressen. */
  q: string
  indeks: Sokeindekstilstand
  onKrev: () => void
  beskrivSide?: (stoff: string) => string | undefined
  /** Tilbake til fortolkningen slik den sto. */
  onLukk: () => void
}

type Filter = Treffgruppe | 'alle'

/**
 * Søkesiden (`#/sok?q=…`): alle treffene i fagstoffet for et søk, gruppert
 * etter hva de er — stoff, preparater, tekst og referanser — i rangeringens
 * rekkefølge. Hvert treff dyplenker til seksjonen eller kortet det står i.
 * Søket skrives i fagsøket i toppmenyen; siden viser bare resultatet.
 */
export function Sokeside({ q, indeks, onKrev, beskrivSide, onLukk }: SokesideProps) {
  const overskrift = useId()
  const [filter, setFilter] = useState<Filter>('alle')
  const { treff, vis } = useFagsoketreff(indeks, q, beskrivSide)
  const sporring = q.trim()

  useEffect(onKrev, [onKrev])
  useLukkMedEscape(onLukk)

  useEffect(() => {
    const forrige = document.title
    document.title = sporring ? `«${sporring}» – Søk i fagstoff – OUSFAR` : 'Søk i fagstoff – OUSFAR'
    return () => {
      document.title = forrige
    }
  }, [sporring])

  // Et nytt søk begynner med alle treffene, øverst, med fokus på overskriften.
  useEffect(() => {
    setFilter('alle')
    window.scrollTo({ top: 0 })
    document.getElementById(overskrift)?.focus({ preventScroll: true })
  }, [sporring, overskrift])

  const grupper = useMemo(() => {
    const per = new Map<Treffgruppe, typeof treff>(TREFFGRUPPER.map((g) => [g, []]))
    for (const t of treff) per.get(treffgruppe(t.dokument.felt))!.push(t)
    return TREFFGRUPPER.map((gruppe) => ({ gruppe, treff: per.get(gruppe)! }))
  }, [treff])
  const monografer = useMemo(() => new Set(treff.map((t) => sidenokkel(t.dokument.sted.side))).size, [treff])
  const viste = grupper.filter((g) => g.treff.length > 0 && (filter === 'alle' || g.gruppe === filter))

  return (
    <section className="sokeside" aria-labelledby={overskrift}>
      <ToppmenyInnhold spor="handlinger">
        <Lukkeknapp onLukk={onLukk} />
      </ToppmenyInnhold>

      <header className="sokeside__hode">
        <p className="sokeside__overtittel">Søk i fagstoff</p>
        <h1 id={overskrift} className="sokeside__sok" tabIndex={-1}>
          {sporring ? `«${sporring}»` : 'Søk i fagstoff'}
        </h1>
        {indeks.status === 'klar' && sporring && (
          <p className="sokeside__antall" role="status">
            {treff.length === 0
              ? 'Ingen treff'
              : `${antallTekst(treff.length, 'treff', 'treff')} i ${antallTekst(monografer, 'monograf', 'monografer')}`}
          </p>
        )}
      </header>

      {!sporring ? (
        <p className="sokeside__melding">Skriv det du leter etter i søkefeltet øverst.</p>
      ) : indeks.status === 'feil' ? (
        <div className="sidevarsel" role="alert">
          <p>Fikk ikke hentet fagstoffet. {indeks.melding}</p>
          <Button variant="subtle" onClick={onKrev}>
            Prøv igjen
          </Button>
        </div>
      ) : indeks.status !== 'klar' ? (
        <p className="sokeside__melding" role="status">
          <Lastesirkel /> Henter fagstoffet …
        </p>
      ) : (
        <>
          {indeks.henterMer && (
            <p className="sokeside__melding">
              <Lastesirkel /> {HENTER_MER} Flere treff kan komme til.
            </p>
          )}
          {indeks.indeks.festfeil && (
            <p className="sidevarsel" role="note">
              Preparatene og interaksjonene fra FEST er ikke med i søket nå, fordi de ikke kunne hentes.
            </p>
          )}
          {treff.length > 0 && (
            <div className="sokeside__filter" role="group" aria-label="Vis treff">
              <Filterknapp navn="Alle" antall={treff.length} valgt={filter === 'alle'} onVelg={() => setFilter('alle')} />
              {grupper.map(({ gruppe, treff: gruppetreff }) => (
                <Filterknapp
                  key={gruppe}
                  navn={GRUPPENAVN[gruppe].fane}
                  antall={gruppetreff.length}
                  valgt={filter === gruppe}
                  onVelg={() => setFilter(gruppe)}
                />
              ))}
            </div>
          )}
          {viste.map(({ gruppe, treff: gruppetreff }) => (
            <Treffgruppevisning
              // Et nytt søk eller filter viser de første treffene igjen.
              key={`${gruppe}\n${sporring}`}
              navn={GRUPPENAVN[gruppe].overskrift}
              treff={gruppetreff}
              vis={vis}
            />
          ))}
        </>
      )}
    </section>
  )
}

function antallTekst(antall: number, entall: string, flertall: string): string {
  return `${antall} ${antall === 1 ? entall : flertall}`
}

function Filterknapp({ navn, antall, valgt, onVelg }: { navn: string; antall: number; valgt: boolean; onVelg: () => void }) {
  return (
    <button type="button" className="sokefilter" aria-pressed={valgt} disabled={antall === 0} onClick={onVelg}>
      {navn}
      <span className="sokefilter__antall">{antall}</span>
    </button>
  )
}

function Treffgruppevisning({
  navn,
  treff,
  vis,
}: {
  navn: string
  treff: Soketreff[]
  vis: (treff: Soketreff) => Treffvisning
}) {
  const overskrift = useId()
  const [alle, setAlle] = useState(false)
  // Bare treffene som vises, gjøres klare til visning: et kort søk kan ha tusenvis.
  const viste = (alle ? treff : treff.slice(0, GRUPPEGRENSE)).map(vis)
  return (
    <section className="treffgruppe" aria-labelledby={overskrift}>
      <h2 id={overskrift} className="treffgruppe__navn">
        {navn}
        <span className="treffgruppe__antall">{treff.length}</span>
      </h2>
      <ul className="treffgruppe__liste">
        {viste.map((t) => (
          <li key={t.nokkel}>
            <a className="sokeresultat" href={t.adresse} data-gruppe={t.gruppe} data-ih="">
              <span className="sokeresultat__ikon">
                <Ikon navn={t.ikon} storrelse="ui" />
              </span>
              <span className="sokeresultat__tekst">
                <span className="sokeresultat__sti">{t.sti.join(' › ')}</span>
                <span className="sokeresultat__tittel">
                  <Markert {...t.tittel} />
                </span>
                {t.utdrag && (
                  <span className="sokeresultat__utdrag">
                    <Markert {...t.utdrag} />
                  </span>
                )}
              </span>
              <span className="sokeresultat__pil" aria-hidden="true">
                <Ikon navn="chev" />
              </span>
            </a>
          </li>
        ))}
      </ul>
      {!alle && treff.length > GRUPPEGRENSE && (
        <Button variant="subtle" onClick={() => setAlle(true)}>
          {`Vis alle ${treff.length}`}
        </Button>
      )}
    </section>
  )
}
