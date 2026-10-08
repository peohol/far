import { useId } from 'react'
import type { Paneldefinisjon } from '../../faginnhold/paneler'
import { pubchemUrl } from '../../kjemi/referanser'
import { formeldeler, kjemioppsummering, kjemisted, molvekttekst, type Kjemirad, type Kjemivisning } from '../../kjemi/stoffside'
import { Uthev } from '../Uthev'
import { Kildelenke } from './Farmakogenetikkdeler'
import { elementAnker, Panel, type Panelkontekst } from './Paneler'
import '../../styles/kjemi.css'

/**
 * Seksjonen «Kjemiske grunndata»: forbindelsene stoffet har — selve stoffet og
 * metabolittene laboratoriene måler — med molekylformelen, molekylvekten og
 * identifikatorene fra PubChem, i én tabell. Ingenting her redigeres;
 * forbindelsene og koblingene står i `src/data/forbindelser.ts`, og PubChem
 * står som kilde i referansefeltet (`src/kjemi/`).
 */
export function Kjemipanel({
  definisjon,
  kontekst,
  visning,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  visning: Kjemivisning
}) {
  const overskrift = useId()
  return (
    <Panel
      definisjon={definisjon}
      kontekst={kontekst}
      tomt={visning.rader.length === 0}
      oppsummering={kjemioppsummering(visning) || 'Hentes fra PubChem'}
    >
      <div className="kjemi">
        <p id={overskrift} className="kun-skjermleser">
          Forbindelser med formel, molekylvekt og PubChem-identifikatorer
        </p>
        <div className="serumtabell__rull" role="region" aria-labelledby={overskrift} tabIndex={0}>
          <table className="serumtabell__tabell kjemi__tabell" aria-labelledby={overskrift}>
            <thead>
              <tr>
                <th scope="col">Forbindelse</th>
                <th scope="col">Molekylformel</th>
                <th scope="col">Molekylvekt</th>
                <th scope="col">PubChem</th>
              </tr>
            </thead>
            <tbody>
              {visning.rader.map((r) => (
                <Rad key={r.forbindelse.nokkel} rad={r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  )
}

function Rad({ rad: { forbindelse: f, relasjon, status, data } }: { rad: Kjemirad }) {
  return (
    <tr id={elementAnker(kjemisted(f))}>
      <th scope="row">
        <span className="kjemi__navn">
          <Uthev tekst={f.navn} />
        </span>
        {relasjon === 'metabolitt' && <span className="kjemi__relasjon">Metabolitt</span>}
        {f.merknad && <span className="kjemi__merknad">{f.merknad}</span>}
      </th>
      {data ? (
        <>
          <td>
            <Formel formel={data.formel} />
          </td>
          <td>
            <Uthev tekst={molvekttekst(data.molvekt)} />
          </td>
          <td>
            <Kildelenke lenke={pubchemUrl(data.cid)}>
              <Uthev tekst={`CID ${data.cid}`} />
            </Kildelenke>
            <span className="kjemi__inchikey" title="InChIKey">
              <Uthev tekst={data.inchikey} />
            </span>
          </td>
        </>
      ) : (
        <td colSpan={3} className="kjemi__mangler">
          {status === 'uavklart'
            ? 'Ikke koblet sikkert til en forbindelse i PubChem ennå.'
            : 'Hentes fra PubChem ved neste oppdatering.'}
        </td>
      )}
    </tr>
  )
}

/** Molekylformelen med tallene senket og ladningen hevet. */
function Formel({ formel }: { formel: string }) {
  return (
    <span className="kjemi__formel">
      {formeldeler(formel).map((d, i) =>
        d.slag === 'senket' ? <sub key={i}>{d.tekst}</sub> : d.slag === 'hevet' ? <sup key={i}>{d.tekst}</sup> : <span key={i}>{d.tekst}</span>,
      )}
    </span>
  )
}
