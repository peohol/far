import type { Analyttkatalog, Katalogoppforing } from '../../domain/analyttkatalog'
import { analyttadresse } from '../../domain/rute'
import { iSetning } from '../../domain/names'
import type { Kategoristi } from '../../domain/stoffregister'
import type { Analyttsidedata } from '../../faginnhold/lesing'
import type { Paneldefinisjon } from '../../faginnhold/paneler'
import { Fragment, useRef } from 'react'
import { Referansefelt } from '../referanser/Referansefelt'
import { useSidereferanser } from '../referanser/Sidereferanser'
import { useFastSted } from '../seksjoner/Seksjonsstyring'
import { Metodepille } from '../Metodepille'
import { useTips } from '../Tips'
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
 * Panel 1: hva siden handler om. Over navnet står kategoriene stoffet har i
 * stoffregisteret, de samme som i sidemenyen («Antidepressiver › SSRI»), for
 * stoffer med og uten analyttkode. Virkestoffet er hovedoverskriften. Under
 * den står analysen når stoffet har en: analyttkoden, som åpner fortolkningen,
 * og analysemetoden den inngår i. For sumanalysene står til sist hvilke
 * stoffer koden omfatter — med lenker til sidene deres, uten å gjøre dem til
 * hovedanalytt. Står alltid fram, over viktige data (`ViktigeData.tsx`).
 */
export function Identitetspanel({
  definisjon,
  oppforing,
  navn,
  komponenter,
  kategorier,
  overskriftId,
  onApneFortolkning,
}: {
  definisjon: Paneldefinisjon
  oppforing: Katalogoppforing | null
  navn: string
  komponenter: Komponent[]
  /** Kategoriene i stoffregisteret (`kategorierFor`). */
  kategorier: Kategoristi[]
  overskriftId: string
  /** Åpner fortolkningsmodulen analyttkoden hører til. */
  onApneFortolkning: () => void
}) {
  const panelreferanser = useSidereferanser().panelreferanser[definisjon.nokkel] ?? []
  const sum = komponenter.length > 1
  const flate = useRef<HTMLElement>(null)
  useFastSted(definisjon.nokkel, flate)

  return (
    <section ref={flate} id={panelAnker(definisjon.nokkel)} className="identitet" aria-labelledby={overskriftId}>
      <p className="metalinje">
        {kategorier.map((k, i) => (
          <Fragment key={nokkel(k)}>
            {i > 0 && <span aria-hidden="true">·</span>}
            <span>
              {k.kategori}
              {k.underkategori && (
                <>
                  {' '}
                  <span aria-hidden="true">›</span> {k.underkategori}
                </>
              )}
            </span>
          </Fragment>
        ))}
      </p>
      <h1 id={overskriftId} className="identitet__navn" tabIndex={-1}>
        <Uthev tekst={navn} />
      </h1>
      {oppforing && (
        <p className="identitet__analyse">
          <Analyttkodeknapp kode={oppforing.kode} onApne={onApneFortolkning} />
          <span aria-hidden="true">·</span>
          <span>Inngår i</span>
          <Metodepille metode={oppforing.analysemetode} />
        </p>
      )}

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

function nokkel(k: Kategoristi): string {
  return `${k.kategori}/${k.underkategori ?? ''}`
}

/**
 * Analyttkoden som pille, og veien til fortolkningen: den samme handlingen som
 * «Åpne fortolkning» i toppmenyen, der koden står.
 */
function Analyttkodeknapp({ kode, onApne }: { kode: string; onApne: () => void }) {
  const tips = useTips(`Åpne fortolkningen for ${kode}`, { skjermleser: false })
  return (
    <button
      type="button"
      className="pille pille--kode"
      aria-label={`${kode} – åpne fortolkningen`}
      onClick={onApne}
      {...tips.props}
    >
      <span className="pille__verdi">{kode}</span>
    </button>
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
