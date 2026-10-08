import { useId } from 'react'
import { VISNINGSENHETER, type Visningsenhet } from '../../enheter/konsentrasjon'
import type { Paneldefinisjon } from '../../faginnhold/paneler'
import { fpUrl } from '../../farmakologiportalen/api'
import {
  harEgenBenevning,
  laboppsummering,
  labsted,
  maleomrade,
  type Labrad,
  type Labtabell,
  type Labvisning,
} from '../../farmakologiportalen/stoffside'
import { useBevart } from '../../oppdatering/Bevaring'
import { Trinnbryter, type Trinnvalg } from '../Trinnbryter'
import { Uthev } from '../Uthev'
import { Kildelenke } from './Farmakogenetikkdeler'
import { elementAnker, Panel, type Panelkontekst } from './Paneler'
import '../../styles/laboratorier.css'

const ENHETSVALG: readonly Trinnvalg<Visningsenhet>[] = VISNINGSENHETER.map((e) => ({ verdi: e, merke: e }))
const erVisningsenhet = (v: unknown): v is Visningsenhet => VISNINGSENHETER.some((e) => e === v)

/**
 * Seksjonen «Analyse ved norske laboratorier»: analysene laboratoriene oppgir
 * i Farmakologiportalen for forbindelsene stoffet har, én tabell per
 * matrise, med måleområdene i enheten brukeren velger. Ingenting her
 * redigeres; koblingene står i `src/data/forbindelser.ts`, og portalen står
 * som kilde i referansefeltet (`src/farmakologiportalen/`).
 */
export function Laboratoriepanel({
  definisjon,
  kontekst,
  visning,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  visning: Labvisning
}) {
  const [lagret, setEnhet] = useBevart<Visningsenhet>('laboratorieenhet', 'µg/L')
  const enhet = erVisningsenhet(lagret) ? lagret : 'µg/L'
  return (
    <Panel
      definisjon={definisjon}
      kontekst={kontekst}
      tomt={visning.tabeller.length === 0}
      oppsummering={laboppsummering(visning) || 'Hentes fra Farmakologiportalen'}
    >
      <div className="laboratorier">
        <div className="laboratorier__valg">
          <Trinnbryter etikett="Vis måleområdene i" valg={ENHETSVALG} verdi={enhet} onVelg={setEnhet} />
        </div>
        {visning.tabeller.map((t) => (
          <Tabell key={t.nokkel} tabell={t} enhet={enhet} />
        ))}
        {visning.usikre.length > 0 && (
          <p className="laboratorier__merknad">
            Koblingen til Farmakologiportalen er bare kontrollert på navnet for {visning.usikre.map((f) => f.navn).join(', ')}, så
            måleområdene for {visning.usikre.length === 1 ? 'den' : 'dem'} regnes ikke om mellom masse og stoffmengde.
          </p>
        )}
        <p className="laboratorier__merknad">
          Bare analyser laboratoriene tilbyr nå, er med. Omregningen bruker molekylvekten fra PubChem; sumanalyser regnes ikke
          om mellom masse og stoffmengde.
        </p>
      </div>
    </Panel>
  )
}

function Tabell({ tabell, enhet }: { tabell: Labtabell; enhet: Visningsenhet }) {
  const overskrift = useId()
  const benevning = tabell.rader.some((r) => harEgenBenevning(r, enhet))
  return (
    <div className="laboratorier__tabell">
      <p id={overskrift} className="laboratorier__tittel">
        <Uthev tekst={tabell.tittel} />
      </p>
      <div className="serumtabell__rull" role="region" aria-labelledby={overskrift} tabIndex={0}>
        <table className="serumtabell__tabell laboratorier__rader" aria-labelledby={overskrift}>
          <thead>
            <tr>
              {tabell.visAnalytt && <th scope="col">Analytt</th>}
              <th scope="col">Laboratorium</th>
              <th scope="col">Metode</th>
              <th scope="col">Måleområde ({enhet})</th>
              {benevning && <th scope="col">Benevning</th>}
            </tr>
          </thead>
          <tbody>
            {tabell.rader.map((r) => (
              <Rad key={r.id} rad={r} tabell={tabell} enhet={enhet} benevning={benevning} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Rad({ rad: r, tabell, enhet, benevning }: { rad: Labrad; tabell: Labtabell; enhet: Visningsenhet; benevning: boolean }) {
  const omrade = maleomrade(r, enhet)
  const lab = (
    <>
      <span className="laboratorier__lab">
        {r.laboratorium_id ? (
          <Kildelenke lenke={fpUrl.laboratorium(r.laboratorium_id)}>
            <Uthev tekst={r.laboratorium} />
          </Kildelenke>
        ) : (
          <Uthev tekst={r.laboratorium} />
        )}
      </span>
      {r.institusjon && !r.laboratorium.includes(r.institusjon) && (
        <span className="laboratorier__tillegg">
          <Uthev tekst={r.institusjon} />
        </span>
      )}
      {tabell.visProvemateriale && r.provemateriale && <span className="laboratorier__tillegg">{r.provemateriale}</span>}
    </>
  )
  return (
    <tr id={elementAnker(labsted(r.id))}>
      {tabell.visAnalytt && (
        <th scope="row">
          <Uthev tekst={r.analytt} />
        </th>
      )}
      {tabell.visAnalytt ? <td>{lab}</td> : <th scope="row">{lab}</th>}
      <td>{r.metode ? <Uthev tekst={r.metode} /> : <span className="laboratorier__mangler">Ikke oppgitt</span>}</td>
      <td>
        <Kildelenke lenke={fpUrl.analyse(r.id)}>
          <span className={omrade.tekst === 'Ikke oppgitt' ? 'laboratorier__mangler' : 'laboratorier__omrade'}>
            {omrade.tekst}
            {omrade.enhet && ` ${omrade.enhet}`}
          </span>
          <span className="kun-skjermleser"> i Farmakologiportalen</span>
        </Kildelenke>
      </td>
      {benevning && <td>{harEgenBenevning(r, enhet) ? r.benevning : ''}</td>}
    </tr>
  )
}
