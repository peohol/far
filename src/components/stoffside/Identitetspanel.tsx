import type { Laboratorieanalytt } from '../../domain/analyttkatalog'
import type { KobletAnalytt } from '../../domain/koblinger'
import { stoffadresse } from '../../domain/rute'
import { iSetning } from '../../domain/names'
import type { Kategoristi, Stoffregister } from '../../domain/stoffregister'
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

/** «a», «a og b», «a, b og c». */
function oppramsing(deler: readonly string[]): string {
  return deler.length <= 1 ? (deler[0] ?? '') : `${deler.slice(0, -1).join(', ')} og ${deler.at(-1)}`
}

/**
 * Hva koblingen sier om analytten, i en setning, sett fra stoffet: at
 * analytten er en metabolitt av det, eller hvilke stoffer sumanalysen
 * omfatter. `null` når analytten er selve stoffet.
 */
export function koblingstekst({ kobling, analytt }: KobletAnalytt, stoffnavn: string): string | null {
  switch (kobling.relasjon) {
    case 'metabolitt':
      return `${analytt.kode} måler ${iSetning(analytt.navn)}, en metabolitt av ${iSetning(stoffnavn)}.`
    case 'sumanalyse':
      return `${analytt.kode} er en sumanalyse og omfatter ${oppramsing(analytt.komponenter.map(iSetning))}.`
    default:
      return null
  }
}

/**
 * Panel 1: hva siden handler om. Over navnet står kategoriene stoffet har i
 * stoffregisteret, de samme som i sidemenyen («Antidepressiver › SSRI»).
 * Stoffet er hovedoverskriften — aldri en analytt.
 *
 * Under den står laboratorieanalyttene stoffet er koblet til i
 * stoffregisteret, som sekundær informasjon: koden, som åpner fortolkningen,
 * og analysemetoden den inngår i. Er analytten en metabolitt eller en
 * sumanalyse, sier en setning det, med merknaden koblingen har. Er koden koblet
 * til andre stoffer også, lenker «Se også» til sidene deres — bare der
 * registeret har en slik kobling. Står alltid fram, over viktige data
 * (`ViktigeData.tsx`).
 */
export function Identitetspanel({
  definisjon,
  navn,
  slug,
  analytter,
  register,
  kategorier,
  overskriftId,
  onApneFortolkning,
}: {
  definisjon: Paneldefinisjon
  navn: string
  /** Stoffets nøkkel, så «Se også» ikke lenker til siden selv. */
  slug: string
  /** Analyttene stoffet er koblet til (`analytterForStoff`). */
  analytter: readonly KobletAnalytt[]
  register: Stoffregister
  /** Kategoriene i stoffregisteret (`kategorierFor`). */
  kategorier: Kategoristi[]
  overskriftId: string
  /** Åpner fortolkningsmodulen analytten hører til. */
  onApneFortolkning: (analytt: Laboratorieanalytt) => void
}) {
  const panelreferanser = useSidereferanser().panelreferanser[definisjon.nokkel] ?? []
  const metodegrupper = analytter.reduce<Laboratorieanalytt[][]>((grupper, { analytt }) => {
    const gruppe = grupper.find((g) => g[0]?.analysemetode === analytt.analysemetode)
    if (gruppe) gruppe.push(analytt)
    else grupper.push([analytt])
    return grupper
  }, [])
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
      {metodegrupper.map((gruppe) => (
        <p className="identitet__analyse" key={gruppe[0]!.analysemetode}>
          {gruppe.map((analytt, i) => (
            <Fragment key={analytt.kode}>
              {i > 0 && <span aria-hidden="true">·</span>}
              <Analyttkodeknapp kode={analytt.kode} onApne={() => onApneFortolkning(analytt)} />
            </Fragment>
          ))}
          <span aria-hidden="true">·</span>
          <span>Inngår i</span>
          <Metodepille metode={gruppe[0]!.analysemetode} />
        </p>
      ))}

      {analytter.map((koblet) => {
        const tekst = [koblingstekst(koblet, navn), koblet.kobling.merknad].filter(Boolean).join(' ')
        const andre = register
          .stofferFor(koblet.analytt.kode)
          .filter((k) => k.stoff !== slug)
          .flatMap((k) => register.finn(k.stoff) ?? [])
        if (!tekst && andre.length === 0) return null
        return (
          <p className="identitet__komponenter" key={koblet.analytt.kode}>
            {tekst && <Uthev tekst={tekst} />}
            {andre.length > 0 && (
              <>
                {tekst && ' '}
                <Uthev tekst="Se også " />
                {andre.map((stoff, i) => (
                  <Fragment key={stoff.slug}>
                    {i > 0 && (i === andre.length - 1 ? ' og ' : ', ')}
                    <a
                      className="komponentlenke"
                      href={stoffadresse(stoff.slug)}
                      aria-label={`${stoff.navn}: åpne fagsiden, som også er koblet til ${koblet.analytt.kode}`}
                    >
                      <Uthev tekst={stoff.navn} />
                    </a>
                  </Fragment>
                ))}
                .
              </>
            )}
          </p>
        )
      })}
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
