import { useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ramsOpp } from '../../faginnhold/oppsummering'
import type { Preparatpakning } from '../../legemiddeldata/preparater'
import {
  byttbarhetstekst,
  fordelMerker,
  type Byttbarhet,
  type Preparatdetalj,
  type Preparatmerke,
  type Preparatstyrkedetalj,
} from '../../legemiddeldata/preparatmodell'
import { FEST_KILDE } from '../../legemiddeldata/referanser'
import { rullefart } from '../../hooks/useKortHopp'
import { useSkjuling } from '../../hooks/useSkjuling'
import { Ikon } from '../ikon/Ikon'
import { Merke } from '../Merke'
import { Modallag } from '../Modallag'
import { Referansefelt } from '../referanser/Referansefelt'
import { formikonnavn, Handteringsmerker, Preparatmerker } from './Merker'

/**
 * Preparatvinduet: alt FEST har om ett preparat, gruppert (Atlas:
 * `Modal` med `FactTile`, `HandlingChip` og `PackageTable`). Identiteten er
 * preparatet, med alle styrkene; styrken det ble åpnet fra, står åpen og er
 * merket. På smale flater er det et ark nedenfra.
 *
 * Det som er likt for alle styrkene, står én gang øverst; det som er ulikt,
 * står ved hver styrke. Ingenting av det dagens visning hadde, går tapt.
 */
export function Preparatmodal({
  preparat,
  fraStyrke,
  sidenavn,
  onLukk,
}: {
  preparat: Preparatdetalj
  /** Stoffsiden vinduet står på; den står i linjen over tittelen. */
  sidenavn: string
  /** Styrken vinduet ble åpnet fra. */
  fraStyrke: string
  onLukk: () => void
}) {
  const overskrift = useId()
  const [apen, setApen] = useState<string | null>(fraStyrke)
  const flereReseptgrupper = preparat.reseptgrupper.length > 1
  const flereProdusenter = preparat.produsenter.length > 1
  const felles = fellesOmtaler(preparat.styrker)
  // Hodet har merkene som gjelder hele preparatet; resten står ved styrken.
  const merker = fordelMerker(preparat)

  return (
    <Modallag
      apen
      tittel={preparat.navn}
      onLukk={onLukk}
      ark
      meta={ramsOpp([sidenavn, preparat.form])}
      ikon={formikonnavn(preparat.ikon)}
      undertittel={preparat.produsenter.join(', ') || undefined}
      merker={merker.felles.length > 0 ? <Preparatmerker merker={merker.felles} /> : undefined}
      lukketekst="Lukk preparatet"
    >
      <dl className="preparatfakta">
        <Fakta navn="Reseptgruppe" verdi={preparat.reseptgrupper.map(utenForledd).join(', ')} />
        <Fakta navn="Administrasjon" verdi={preparat.administrasjonsveier.join(', ')} />
        <Fakta navn="Virkestoff" verdi={(preparat.salter.length > 0 ? preparat.salter : preparat.virkestoff).join(', ')} />
        {preparat.kombinasjon.length > 0 && <Fakta navn="Kombinert med" verdi={preparat.kombinasjon.join(', ')} />}
        <Fakta navn="ATC" verdi={preparat.atc.map((k) => k.kode).join(', ')} />
        {/* Den korte formen står over tittelen; den lange bare når den sier mer. */}
        <Fakta navn="Legemiddelform" verdi={preparat.langform.join(', ')} />
      </dl>

      <section className="preparatstyrker" aria-labelledby={overskrift}>
        <h3 id={overskrift} className="preparatstyrker__tittel">
          Styrker, håndtering og pakninger
        </h3>
        <ul className="preparatstyrker__liste">
          {preparat.styrker.map((s, i) => (
            <Styrkerad
              key={s.styrke_id}
              styrke={s}
              merker={merker.egne[i]!}
              apen={apen === s.styrke_id}
              fra={fraStyrke === s.styrke_id}
              onVeksle={() => setApen((a) => (a === s.styrke_id ? null : s.styrke_id))}
              visReseptgruppe={flereReseptgrupper}
              visProdusent={flereProdusenter}
              visOmtaler={felles === null}
            />
          ))}
        </ul>
      </section>

      {felles && felles.length > 0 && <Omtalelenker lenker={felles} />}
      <Referansefelt ider={[FEST_KILDE]} niva="element" />
    </Modallag>
  )
}

/** Nøkkelfakta som flis; tom verdi vises ikke. */
function Fakta({ navn, verdi }: { navn: string; verdi: string }) {
  if (!verdi) return null
  return (
    <div className="preparatfakta__flis">
      <dt>{navn}</dt>
      <dd>{verdi}</dd>
    </div>
  )
}

/** «Reseptgruppe C» blir «C» under overskriften «Reseptgruppe». Annen tekst står som FEST har den. */
function utenForledd(reseptgruppe: string): string {
  return reseptgruppe.replace(/^Reseptgruppe\s+/i, '')
}

/** Lenkene til preparatomtalen når de er de samme for alle styrkene, ellers `null`. */
function fellesOmtaler(styrker: readonly Preparatstyrkedetalj[]): string[] | null {
  const [forste, ...resten] = styrker.map((s) => s.preparatomtaler.join('\n'))
  return forste !== undefined && resten.every((l) => l === forste) ? styrker[0]!.preparatomtaler : null
}

function Styrkerad({
  styrke,
  merker,
  apen,
  fra,
  onVeksle,
  visReseptgruppe,
  visProdusent,
  visOmtaler,
}: {
  styrke: Preparatstyrkedetalj
  /** Merkene bare denne styrken har. */
  merker: readonly Preparatmerke[]
  apen: boolean
  fra: boolean
  onVeksle: () => void
  visReseptgruppe: boolean
  visProdusent: boolean
  visOmtaler: boolean
}) {
  const id = useId()
  const rad = useRef<HTMLLIElement>(null)
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const pakninger = styrke.pakninger.length
  useSkjuling(kropp, inner, apen)

  // Nettleserens søk fant noe i en lukket styrke: åpne den før den ruller dit.
  const apneForFunn = useRef(onVeksle)
  apneForFunn.current = apen ? () => {} : onVeksle
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const funnet = () => flushSync(() => apneForFunn.current())
    el.addEventListener('beforematch', funnet)
    return () => el.removeEventListener('beforematch', funnet)
  }, [])

  // Styrken vinduet ble åpnet fra, rulles fram.
  useEffect(() => {
    if (fra) rad.current?.scrollIntoView({ behavior: rullefart(), block: 'nearest' })
  }, [fra])

  return (
    <li ref={rad} className="preparatstyrke" data-apen={apen || undefined} data-fra={fra || undefined}>
      <div className="preparatstyrke__hode">
        <button
          type="button"
          className="preparatstyrke__knapp"
          aria-expanded={apen}
          aria-controls={`${id}-innhold`}
          onClick={onVeksle}
        >
          <span className="preparatstyrke__styrke">{styrke.styrke || 'Uten oppgitt styrke'}</span>
          {styrke.presisering && <span className="preparatstyrke__presisering">{styrke.presisering}</span>}
          <span className="preparatstyrke__antall">
            {pakninger === 1 ? '1 pakning' : `${pakninger} pakninger`}
          </span>
          <span className="preparatstyrke__pil" aria-hidden="true">
            <Ikon navn="chev" />
          </span>
        </button>
        <span className="preparatstyrke__merker">
          <Preparatmerker merker={merker} />
          <Handteringsmerker handtering={styrke.handtering} />
          {fra && <Merke tone="aksent">Åpnet herfra</Merke>}
        </span>
      </div>
      <div ref={kropp} className="preparatstyrke__kropp">
        <div ref={inner} id={`${id}-innhold`} className="preparatstyrke__inner">
          <div className="preparatstyrke__innhold">
            <p className="preparatstyrke__fest">
              {ramsOpp([
                styrke.navn_form_styrke.join(', '),
                visReseptgruppe && styrke.reseptgrupper.join(', '),
                visProdusent && styrke.produsenter.join(', '),
              ])}
            </p>
            {styrke.byttbarhet.length > 0 && <Byttbarhetsliste byttbarhet={styrke.byttbarhet} />}
            {pakninger > 0 && <Pakningstabell pakninger={styrke.pakninger} />}
            {visOmtaler && styrke.preparatomtaler.length > 0 && <Omtalelenker lenker={styrke.preparatomtaler} />}
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * Hva styrken kan byttes med i apotek, etter byttegruppene i FEST, med FESTs
 * merknad når gruppen har en. Står ingenting, er ingen av pakningene i en
 * byttegruppe med andre preparater.
 */
function Byttbarhetsliste({ byttbarhet }: { byttbarhet: readonly Byttbarhet[] }) {
  return (
    <ul className="preparatbytte">
      {byttbarhet.map((b) => (
        <li key={b.kode}>
          {byttbarhetstekst(b)}
          {b.merknad && <span className="preparatbytte__merknad">Merknad i FEST: {b.merknad}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Pakningene med varenummer (Atlas: `PackageTable`). Refusjon står ikke i FEST-kopien og vises ikke. */
function Pakningstabell({ pakninger }: { pakninger: readonly Preparatpakning[] }) {
  return (
    <table className="pakningstabell">
      <thead>
        <tr>
          <th scope="col">Pakning</th>
          <th scope="col">Varenr.</th>
        </tr>
      </thead>
      <tbody>
        {pakninger.map((p) => (
          <tr key={p.id}>
            <td>
              <span className="pakningstabell__pakning">
                <Ikon navn="pack" className="pakningstabell__ikon" />
                {p.tekst || 'Pakning'}
                {p.midlertidig_utgatt && <Merke>Midlertidig utgått</Merke>}
              </span>
            </td>
            <td className="pakningstabell__varenr">{p.varenr}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Omtalelenker({ lenker }: { lenker: readonly string[] }) {
  return (
    <p className="preparatlenker">
      {lenker.map((lenke, i) => (
        <a key={lenke} className="preparatlenke" href={lenke} target="_blank" rel="noopener noreferrer">
          <Ikon navn="ext" />
          {lenker.length > 1 ? `Preparatomtale ${i + 1}` : 'Preparatomtale'}
          <span className="kun-skjermleser"> (åpnes i ny fane)</span>
        </a>
      ))}
    </p>
  )
}
