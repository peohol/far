import type { Analyttkatalog, Katalogoppforing } from '../../domain/analyttkatalog'
import { analyttadresse } from '../../domain/rute'
import { iSetning } from '../../domain/names'
import type { Analyttsidedata } from '../../faginnhold/lesing'
import type { Paneldefinisjon } from '../../faginnhold/paneler'
import { useRef } from 'react'
import { Referansefelt } from '../referanser/Referansefelt'
import { useSidereferanser } from '../referanser/Sidereferanser'
import { useFastSted } from '../seksjoner/Seksjonsstyring'
import { Metalinje } from '../Metalinje'
import { Uthev } from '../Uthev'
import { panelAnker } from './Paneler'
import '../../styles/monograf-topp.css'

/** Et stoff analysen omfatter, med kodene som har det som sin side. */
export interface Komponent {
  navn: string
  koder: string[]
}

/**
 * Stoffene analysen omfatter. Når siden finnes i databasen, er det
 * komponentene der som gjelder; ellers de statiske datasettenes.
 */
export function komponenterFor(
  oppforing: Katalogoppforing,
  data: Analyttsidedata,
  katalog: Analyttkatalog,
): Komponent[] {
  if (data.analytt && data.komponenter.length > 0) {
    return data.komponenter.map((k) => ({ navn: k.innhold.navn, koder: k.koder }))
  }
  return oppforing.komponenter.map((navn) => {
    const kode = katalog.kodeForSide(navn)
    return { navn, koder: kode ? [kode] : [] }
  })
}

/**
 * Panel 1: hva siden handler om. Metalinjen med analyttkoden, metoden og
 * kategorien, virkestoffet som hovedoverskrift, og for sumanalysene hvilke
 * stoffer koden omfatter — med lenker til sidene deres, uten å gjøre dem til
 * hovedanalytt. Står alltid fram, over viktige data (`ViktigeData.tsx`).
 * Et stoff uten analyttkode (`oppforing` er `null`) har ingen metalinje, men
 * sier fra om at laboratoriet ikke har noen analyse for det.
 */
export function Identitetspanel({
  definisjon,
  oppforing,
  navn,
  komponenter,
  overskriftId,
}: {
  definisjon: Paneldefinisjon
  oppforing: Katalogoppforing | null
  navn: string
  komponenter: Komponent[]
  overskriftId: string
}) {
  const panelreferanser = useSidereferanser().panelreferanser[definisjon.nokkel] ?? []
  const sum = komponenter.length > 1
  const flate = useRef<HTMLElement>(null)
  useFastSted(definisjon.nokkel, flate)

  return (
    <section ref={flate} id={panelAnker(definisjon.nokkel)} className="identitet" aria-labelledby={overskriftId}>
      {oppforing ? (
        <Metalinje koder={[oppforing.kode]} metode={oppforing.analysemetode} kategori={oppforing.kategori} />
      ) : (
        <p className="metalinje">Stoffside uten labkode</p>
      )}
      <h1 id={overskriftId} className="identitet__navn" tabIndex={-1}>
        <Uthev tekst={navn} />
      </h1>

      {sum && oppforing && (
        <p className="identitet__komponenter">
          <Uthev tekst={`${oppforing.kode} er en sumanalyse og omfatter `} />
          {komponenter.map((k, i) => (
            <span key={k.navn}>
              {i > 0 && (i === komponenter.length - 1 ? ' og ' : ', ')}
              <Komponentlenke komponent={k} gjeldende={oppforing.kode} />
            </span>
          ))}
          .
        </p>
      )}
      <Referansefelt ider={panelreferanser} niva="panel" />
    </section>
  )
}

/** Stoffet, med lenke til sidene for de andre kodene som har det som sin side. */
function Komponentlenke({ komponent, gjeldende }: { komponent: Komponent; gjeldende: string }) {
  const tekst = iSetning(komponent.navn)
  const andre = komponent.koder.filter((k) => k !== gjeldende)
  return (
    <>
      <Uthev tekst={tekst} />
      {andre.map((kode) => (
        <span key={kode}>
          {' '}
          <a
            className="komponentlenke"
            href={analyttadresse(kode)}
            aria-label={`${tekst}: åpne informasjonssiden for ${kode}`}
          >
            ({kode})
          </a>
        </span>
      ))}
    </>
  )
}
