import type { ReactNode } from 'react'
import {
  MERKER,
  NODER,
  OVERSKRIFTSELEMENT,
  overskriftsniva,
  type Riktekstnode,
  type Tekstmerke,
} from '../../faginnhold/riktekst'
import { Referansepille } from '../referanser/Referansepille'
import { Uthev } from '../Uthev'

/**
 * En riktekst i lesemodus.
 *
 * Dokumentet er renset på forhånd (`rensDokument`), så her vises bare de
 * nodene og merkene som er tillatt. Siteringene blir referansepiller med
 * numrene de har på siden, og all tekst går gjennom søkefremhevingen.
 */
export function Riktekst({ dokument }: { dokument: Riktekstnode }) {
  return <div className="riktekst">{barn(dokument)}</div>
}

function barn(node: Riktekstnode): ReactNode[] {
  return (node.content ?? []).map((under, i) => <Node key={i} node={under} />)
}

function Node({ node }: { node: Riktekstnode }): ReactNode {
  switch (node.type) {
    case NODER.avsnitt:
      return <p>{barn(node)}</p>
    case NODER.overskrift: {
      const Overskrift = OVERSKRIFTSELEMENT[overskriftsniva(node.attrs)]
      return <Overskrift>{barn(node)}</Overskrift>
    }
    case NODER.skillelinje:
      return <hr />
    case NODER.punktliste:
      return <ul>{barn(node)}</ul>
    case NODER.nummerertListe:
      return <ol>{barn(node)}</ol>
    case NODER.listepunkt:
      return <li>{barn(node)}</li>
    case NODER.linjeskift:
      return <br />
    case NODER.sitering: {
      const ider = node.attrs?.referanser
      return Array.isArray(ider) ? <Referansepille ider={ider as string[]} niva="inline" /> : null
    }
    case NODER.tekst:
      return (node.marks ?? []).reduceRight<ReactNode>(
        (innhold, merke) => <Merke merke={merke}>{innhold}</Merke>,
        <Uthev tekst={node.text ?? ''} />,
      )
    default:
      return <>{barn(node)}</>
  }
}

function Merke({ merke, children }: { merke: Tekstmerke; children: ReactNode }) {
  switch (merke.type) {
    case MERKER.fet:
      return <strong>{children}</strong>
    case MERKER.kursiv:
      return <em>{children}</em>
    case MERKER.understreket:
      return <u>{children}</u>
    case MERKER.senket:
      return <sub>{children}</sub>
    case MERKER.hevet:
      return <sup>{children}</sup>
    case MERKER.lenke:
      return (
        <a href={String(merke.attrs?.href ?? '')} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    default:
      return <>{children}</>
  }
}
