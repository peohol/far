import { ELEMENTTYPER, type Paneldefinisjon } from '../../faginnhold/paneler'
import type { Tilleggstekst } from '../../faginnhold/sok'
import { oppsummerPreparatvisning } from '../../legemiddeldata/preparatmodell'
import { finnKobling, preparattekster } from '../../legemiddeldata/stoffside'
import { Legemiddelformer } from '../preparater/Legemiddelformer'
import { elementAnker, Panel, Redigerbar, type Panelkontekst } from './Paneler'
import { LegemiddelkoblingSkjema } from './Skjemaer'
import type { Legemiddeltilstand } from './useLegemidler'
import '../../styles/preparater.css'

export { finnKobling, PREPARATPANEL } from '../../legemiddeldata/stoffside'

/** Preparatnavnene, slik søket på siden finner dem, med detaljkortet de står i. */
export function preparatsoketekster(tilstand: Legemiddeltilstand): Tilleggstekst[] {
  return tilstand.status === 'klar' ? preparattekster(tilstand.visning) : []
}

/**
 * Seksjonen «Preparater»: preparatene i legemiddeldataene fra FEST for
 * virkestoffene siden er koblet til, som
 * `legemiddelform → styrke → preparat → preparatvindu` (se
 * `src/components/preparater/`).
 *
 * Koblingen er det eneste som redigeres her. Den lagres med FESTs ID og
 * publiseres som annet innhold på siden; preparatene selv kommer rett fra
 * kopien av FEST og endres aldri i OUSFAR.
 */
export function Preparatpanel({
  definisjon,
  kontekst,
  sidenavn,
  legemidler,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  sidenavn: string
  legemidler: Legemiddeltilstand
}) {
  const { modell, redigerer, handlinger } = kontekst
  const { element, kobling } = finnKobling(modell)
  const koblet = kobling.virkestoff.length > 0

  return (
    <Panel
      definisjon={definisjon}
      kontekst={kontekst}
      tomt={!koblet}
      oppsummering={oppsummering(legemidler)}
    >
      <div className="preparater" {...(element && { id: elementAnker(element.id) })}>
        <Redigerbar
          navn="Koblingen til legemiddeldataene"
          element={element}
          redigerer={redigerer}
          leggTilTekst="Koble til legemiddeldataene"
          visning={
            <>
              {redigerer && (
                <p className="preparater__kobling">
                  {koblet
                    ? `Koblet til ${kobling.virkestoff.map((v) => v.navn || v.fest_id).join(', ')} i FEST.`
                    : 'Ikke koblet til legemiddeldataene ennå.'}
                </p>
              )}
              {koblet && <Preparatvisning tilstand={legemidler} sidenavn={sidenavn} />}
            </>
          }
          skjema={(lukk) => (
            <LegemiddelkoblingSkjema
              tittel="Koblingen til legemiddeldataene"
              sidenavn={sidenavn}
              start={kobling}
              referanser={element?.referanser ?? []}
              onAvbryt={lukk}
              onLagre={async ({ data, referanser }) => {
                await handlinger.lagreElement(element, {
                  panel: definisjon.nokkel,
                  elementtype: ELEMENTTYPER.legemiddelkobling,
                  posisjon: 0,
                  data: { ...data },
                  referanser,
                })
                lukk()
              }}
            />
          )}
        />
      </div>
    </Panel>
  )
}

function oppsummering(tilstand: Legemiddeltilstand): string {
  switch (tilstand.status) {
    case 'ingen':
      return ''
    case 'laster':
      return 'Henter preparatene …'
    case 'feil':
      return 'Fikk ikke hentet preparatene'
    case 'klar':
      return oppsummerPreparatvisning(tilstand.visning) || 'Ingen preparater i FEST'
  }
}

function Preparatvisning({ tilstand, sidenavn }: { tilstand: Legemiddeltilstand; sidenavn: string }) {
  if (tilstand.status === 'ingen') return null
  if (tilstand.status === 'laster') {
    return (
      <p className="preparater__melding" role="status">
        Henter preparatene …
      </p>
    )
  }
  if (tilstand.status === 'feil') {
    return (
      <p className="preparater__melding" role="alert">
        Fikk ikke hentet preparatene. {tilstand.feil}
      </p>
    )
  }

  const { utvalg, visning } = tilstand
  const utgatte = utvalg.virkestoff.filter((v) => v.utgatt)

  return (
    <>
      {utgatte.length > 0 && (
        <p className="preparater__melding" role="note">
          {utgatte.map((v) => v.navn).join(', ')} står ikke lenger i FEST. Koblingen bør kontrolleres.
        </p>
      )}
      {visning.former.length === 0 ? (
        <p className="preparater__melding">Det er ingen preparater med dette virkestoffet i FEST.</p>
      ) : (
        <Legemiddelformer visning={visning} sidenavn={sidenavn} />
      )}
    </>
  )
}
