import type { Paneldefinisjon, Panelnokkel } from '../../faginnhold/paneler'
import type { Tilleggstekst } from '../../faginnhold/sok'
import { forhandsvisning } from '../../faginnhold/oppsummering'
import { oppsummerInteraksjoner, type Interaksjon } from '../../legemiddeldata/interaksjoner'
import { interaksjonsreferanser, interaksjonssted as kortsted } from '../../legemiddeldata/referanser'
import { Detaljkort } from '../seksjoner/Seksjon'
import { Referansefelt } from '../referanser/Referansefelt'
import { Uthev } from '../Uthev'
import { elementAnker, Panel, type Panelkontekst } from './Paneler'
import type { Interaksjonstilstand } from './useInteraksjoner'

/** Seksjonen interaksjonene står i. */
export const INTERAKSJONSPANEL: Panelnokkel = 'interaksjoner'

/** Stoffene siden interagerer med, slik søket på siden finner dem, med detaljkortet de står i. */
export function interaksjonssoketekster(tilstand: Interaksjonstilstand): Tilleggstekst[] {
  if (tilstand.status !== 'klar') return []
  return tilstand.oversikt.interaksjoner.map((i): Tilleggstekst => ({
    panel: INTERAKSJONSPANEL,
    element: { id: kortsted(i), tittel: i.med },
    felt: 'overskrift',
    tekst: i.med,
  }))
}

/**
 * Seksjonen «Interaksjoner»: DMPs interaksjoner i FEST for preparatene siden
 * er koblet til, én per detaljkort, de alvorligste først. Ingenting redigeres
 * her; koblingen står i «Preparater». DMPs referanser står i referansefeltet
 * nederst i hvert kort, og FEST som kilde i seksjonens (se
 * `src/legemiddeldata/referanser.ts`).
 */
export function Interaksjonspanel({
  definisjon,
  kontekst,
  koblet,
  interaksjoner,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  koblet: boolean
  interaksjoner: Interaksjonstilstand
}) {
  return (
    <Panel definisjon={definisjon} kontekst={kontekst} tomt={!koblet} oppsummering={oppsummering(interaksjoner)}>
      {!koblet && kontekst.redigerer && (
        <p className="preparater__kobling">
          Interaksjonene hentes fra FEST når siden er koblet til legemiddeldataene under «Preparater».
        </p>
      )}
      {koblet && <Interaksjonsvisning tilstand={interaksjoner} />}
    </Panel>
  )
}

function oppsummering(tilstand: Interaksjonstilstand): string {
  switch (tilstand.status) {
    case 'ingen':
      return ''
    case 'laster':
      return 'Henter interaksjonene …'
    case 'feil':
      return 'Fikk ikke hentet interaksjonene'
    case 'klar':
      return oppsummerInteraksjoner(tilstand.oversikt)
  }
}

function Interaksjonsvisning({ tilstand }: { tilstand: Interaksjonstilstand }) {
  if (tilstand.status === 'ingen') return null
  if (tilstand.status === 'laster') {
    return (
      <p className="preparater__melding" role="status">
        Henter interaksjonene …
      </p>
    )
  }
  if (tilstand.status === 'feil') {
    return (
      <p className="preparater__melding" role="alert">
        Fikk ikke hentet interaksjonene. {tilstand.feil}
      </p>
    )
  }

  const { interaksjoner, atc, ikke_vurdert } = tilstand.oversikt
  return (
    <div className="interaksjoner">
      {ikke_vurdert.length > 0 && (
        <p className="interaksjoner__ikke-vurdert" role="note">
          DMP har ikke vurdert interaksjonene for {ikke_vurdert.join(', ')} ennå. At ingen er oppført, betyr ikke at
          det ikke finnes noen.
        </p>
      )}
      {interaksjoner.length === 0 ? (
        <p className="preparater__melding">
          {atc.length === 0
            ? 'Ingen av preparatene har en ATC-kode i FEST, så interaksjonene kan ikke slås opp.'
            : `FEST har ingen interaksjoner som krever tiltak for ${atc.join(', ')}.`}
        </p>
      ) : (
        <ul className="interaksjonsliste">
          {interaksjoner.map((i) => (
            <li key={i.id}>
              <Detaljkort
                id={kortsted(i)}
                tittel={<Uthev tekst={i.med} />}
                oppsummering={
                  <>
                    <span className={`interaksjon__relevans interaksjon__relevans--${i.relevans}`}>{i.relevanstekst}</span>{' '}
                    {i.klinisk_konsekvens && forhandsvisning(i.klinisk_konsekvens, 110)}
                  </>
                }
              >
                <Interaksjonsdetaljer interaksjon={i} />
              </Detaljkort>
            </li>
          ))}
        </ul>
      )}
      <p className="interaksjoner__merknad">
        {`Interaksjonene er DMPs vurderinger for ${atc.length > 0 ? atc.join(', ') : 'preparatene'}. De der DMP mener ingen tiltak er nødvendig, vises ikke.`}
      </p>
    </div>
  )
}

/** Alt FEST sier om interaksjonen. Ankeret står inne i kortet, så søket på siden åpner det. */
function Interaksjonsdetaljer({ interaksjon: i }: { interaksjon: Interaksjon }) {
  return (
    <div className="interaksjon" id={elementAnker(kortsted(i))}>
      <p className={`interaksjon__relevans interaksjon__relevans--${i.relevans}`}>{i.relevanstekst}</p>
      {i.situasjonskriterier.map((k) => (
        <p key={k} className="interaksjon__situasjon">
          {k}
        </p>
      ))}
      <dl className="interaksjon__felter">
        <dt>Gjelder</dt>
        <dd>
          <Uthev tekst={i.gjelder} /> og <Uthev tekst={i.med} />
        </dd>
        {i.klinisk_konsekvens && (
          <>
            <dt>Klinisk konsekvens</dt>
            <dd>
              <Uthev tekst={i.klinisk_konsekvens} />
            </dd>
          </>
        )}
        {i.mekanisme && (
          <>
            <dt>Mekanisme</dt>
            <dd>
              <Uthev tekst={i.mekanisme} />
            </dd>
          </>
        )}
        {i.handtering.length > 0 && (
          <>
            <dt>Håndtering</dt>
            <dd>
              {i.handtering.map((a, n) => (
                <p key={n}>
                  {a.overskrift && <strong>{a.overskrift}: </strong>}
                  <Uthev tekst={a.tekst} />
                </p>
              ))}
            </dd>
          </>
        )}
        {i.kildegrunnlag && (
          <>
            <dt>Kildegrunnlag</dt>
            <dd>{i.kildegrunnlag}</dd>
          </>
        )}
      </dl>
      <Referansefelt ider={interaksjonsreferanser(i)} />
    </div>
  )
}
