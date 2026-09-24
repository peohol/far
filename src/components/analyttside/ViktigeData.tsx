import { useId, useRef, useState, type ReactNode } from 'react'
import type { Sideelement } from '../../faginnhold/analyttside'
import {
  DATAKORT,
  DATAKORTGRUPPER,
  delIntervall,
  harVerdi,
  lesIntervallverdi,
  type Datakortdefinisjon,
  type Datakorttype,
  type Paneldefinisjon,
} from '../../faginnhold/paneler'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import { Referansefelt } from '../referanser/Referansefelt'
import { useSidereferanser } from '../referanser/Sidereferanser'
import { useFastSted } from '../seksjoner/Seksjonsstyring'
import { Uthev } from '../Uthev'
import { elementAnker, panelAnker, Redigerbar, type Panelkontekst } from './Paneler'
import { DatakortSkjema, PanelkildeSkjema, type Skjemaresultat } from './Skjemaer'
import '../../styles/monograf-topp.css'

/**
 * Hvordan hvert kort ser ut: konseptikonet fra Atlas, og for konsentrasjonene
 * tonen kortet farges i. Tonen er bare støtte — etiketten og verdien er det
 * som gjelder, og grønt for referanseområdet sier ikke at noe er trygt.
 */
const UTSEENDE: Record<Datakorttype, { ikon: Ikonnavn; tone?: 'referanse' | 'toksisk' | 'alvorlig' }> = {
  referanseomrade: { ikon: 'ref', tone: 'referanse' },
  toksisk_omrade: { ikon: 'tox', tone: 'toksisk' },
  alvorlig_intoksikasjon: { ikon: 'sev', tone: 'alvorlig' },
  halveringstid: { ikon: 'hl' },
  steady_state: { ikon: 'ss' },
}

/**
 * «Viktige data»: nøkkeltallene rett under stoffnavnet, alltid synlige.
 *
 * Det er ikke en seksjon som åpnes og lukkes, og tittelen vises ikke — bare
 * skjermlesere får den, som navnet på området. Kortene står i to grupper:
 * konsentrasjonene i serum (referanseområde, toksisk, alvorlig/dødelig) og
 * kinetikken (t₁/₂ og tₛₛ). I lesemodus vises bare kortene som har en verdi,
 * og ingenting når ingen har det; i redigeringsmodus står alle kortene fram.
 */
export function ViktigeData({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const elementer = kontekst.modell.paneler.get(definisjon.nokkel) ?? []
  const kort = DATAKORT.map((def, plass) => ({
    def: def as Datakortdefinisjon,
    type: def.type,
    plass,
    element: elementer.find((e) => e.elementtype === def.type) ?? null,
  }))
  const synlige = kort.filter(({ element }) => element && harVerdi(lesIntervallverdi(element.data)))
  if (synlige.length === 0 && !kontekst.redigerer) return null
  return <Flate definisjon={definisjon} kontekst={kontekst} kort={kontekst.redigerer ? kort : synlige} />
}

interface Kortplass {
  def: Datakortdefinisjon
  type: Datakorttype
  /** Plassen i `DATAKORT`, som kortet lagres med. */
  plass: number
  element: Sideelement | null
}

function Flate({
  definisjon,
  kontekst,
  kort,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  kort: Kortplass[]
}) {
  const flate = useRef<HTMLElement>(null)
  useFastSted(definisjon.nokkel, flate)
  const feltreferanser = useSidereferanser().panelreferanser[definisjon.nokkel] ?? []

  return (
    <section ref={flate} id={panelAnker(definisjon.nokkel)} className="viktige-data" aria-label={definisjon.tittel}>
      {kontekst.redigerer && <Panelkilder definisjon={definisjon} kontekst={kontekst} />}
      <div className="viktige-data__grupper">
        {DATAKORTGRUPPER.map((gruppe) => {
          const iGruppen = kort.filter(({ def }) => def.gruppe === gruppe.nokkel)
          return (
            iGruppen.length > 0 && (
              <Gruppe key={gruppe.nokkel} nokkel={gruppe.nokkel} tittel={gruppe.tittel}>
                {iGruppen.map((k) => (
                  <Datakort key={k.type} {...k} definisjon={definisjon} kontekst={kontekst} />
                ))}
              </Gruppe>
            )
          )
        })}
      </div>
      <Referansefelt ider={feltreferanser} niva="panel" />
    </section>
  )
}

function Gruppe({ nokkel, tittel, children }: { nokkel: string; tittel: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className={`viktige-data__gruppe viktige-data__gruppe--${nokkel}`} role="group" aria-labelledby={id}>
      <h2 id={id} className="viktige-data__gruppetittel">
        {tittel}
      </h2>
      <ul className="viktige-data__kort">{children}</ul>
    </div>
  )
}

/** Kildene for hele området, som i de andre panelene — bare i redigeringsmodus. */
function Panelkilder({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const [apen, setApen] = useState(false)
  const referanser = kontekst.modell.panelreferanser[definisjon.nokkel] ?? []
  if (!apen) {
    return (
      <div className="redigeringsrad">
        <Button variant="kant" icon={<Ikon navn="refs" />} className="redigeringsknapp" onClick={() => setApen(true)}>
          Kilder for {definisjon.tittel.toLowerCase()}
        </Button>
      </div>
    )
  }
  return (
    <PanelkildeSkjema
      tittel={definisjon.tittel}
      referanser={referanser}
      onAvbryt={() => setApen(false)}
      onLagre={async (ider) => {
        await kontekst.handlinger.lagrePanelreferanser(definisjon.nokkel, ider)
        setApen(false)
      }}
    />
  )
}

/** Symbolet med den senkede delen, f.eks. t₁/₂ fra «t_1/2». */
function Symbol({ symbol }: { symbol: string }) {
  const [grunn, senket] = symbol.split('_')
  return (
    <span className="datakort__symbol" aria-hidden="true">
      {grunn}
      {senket && <sub>{senket}</sub>}
    </span>
  )
}

function Datakort({
  def,
  type,
  plass,
  element,
  definisjon,
  kontekst,
}: Kortplass & { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const { ikon, tone } = UTSEENDE[type]
  const verdi = lesIntervallverdi(element?.data)
  const deler = delIntervall(verdi)

  return (
    <li
      className={`datakort datakort--${def.gruppe}${tone ? ` datakort--${tone}` : ''}`}
      data-ih=""
      {...(element && { id: elementAnker(element.id) })}
    >
      {def.gruppe === 'kinetikk' ? (
        <div className="datakort__plot">
          <Ikon navn={ikon} storrelse="plot" />
        </div>
      ) : (
        <Ikon navn={ikon} storrelse="konsept" className="datakort__ikon" />
      )}
      <h3 className="datakort__tittel">
        {def.symbol && <Symbol symbol={def.symbol} />}
        <span className="datakort__etikett">
          <Uthev tekst={def.tittel} />
        </span>
      </h3>
      <Redigerbar
        navn={def.tittel}
        element={element}
        redigerer={kontekst.redigerer}
        visning={
          deler ? (
            <>
              {/* Delene står med mellomrom imellom, så teksten er den samme som søket leser. */}
              <p className="datakort__verdi">
                {deler.forledd && (
                  <>
                    <span className="datakort__forledd">
                      <Uthev tekst={deler.forledd} />
                    </span>{' '}
                  </>
                )}
                <span className="datakort__tall">
                  <Uthev tekst={deler.tall} />
                </span>
                {deler.enhet && (
                  <>
                    {' '}
                    <span className="datakort__enhet">
                      <Uthev tekst={deler.enhet} />
                    </span>
                  </>
                )}
              </p>
              {verdi.forbehold && (
                <p className="datakort__forbehold">
                  <Uthev tekst={verdi.forbehold} />
                </p>
              )}
            </>
          ) : (
            <p className="datakort__tom">Ikke oppgitt</p>
          )
        }
        skjema={(lukk) => (
          <DatakortSkjema
            kort={def}
            tittel={def.tittel}
            start={verdi}
            referanser={element?.referanser ?? []}
            onAvbryt={lukk}
            onLagre={async ({ data, referanser }: Skjemaresultat<object>) => {
              await kontekst.handlinger.lagreElement(element, {
                panel: definisjon.nokkel,
                elementtype: type,
                posisjon: plass,
                data: data as Record<string, unknown>,
                referanser,
              })
              lukk()
            }}
          />
        )}
      />
      {element && element.referanser.length > 0 && <Referansefelt ider={element.referanser} niva="element" />}
    </li>
  )
}
