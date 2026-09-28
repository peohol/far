import { useId, useRef, useState, type ReactNode } from 'react'
import type { Katalogoppforing } from '../../domain/analyttkatalog'
import type { Sideelement } from '../../faginnhold/analyttside'
import {
  DATAKORT,
  DATAKORTGRUPPER,
  OVER,
  datakortGjelder,
  datakortHarVerdi,
  delFormverdi,
  delIntervall,
  lesFormverdier,
  lesIntervallverdi,
  type Datakortdefinisjon,
  type Datakorttype,
  type Formverdi,
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
import { legemiddelformikon } from './panelvisning'
import { DatakortSkjema, FormverdiSkjema, PanelkildeSkjema, type Skjemaresultat } from './Skjemaer'
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
 *
 * Innholdet i hvert kort står midtstilt. Kinetikken viser symbolet og ikke
 * ordet (det står for skjermlesere), og en verdi per legemiddelform, side om
 * side, når kortet har flere.
 *
 * Deler flere koder siden — en metabolitt slått sammen med moderstoffet — har
 * hver kode sine egne kort, merket med stoffnavnet: tramadolsiden viser både
 * referanseområdet for tramadol og for O-desmetyltramadol. Kortene til
 * hovedkoden (den første i `analytter`) lagres uten `gjelder`, de andre med
 * koden (`datakortGjelder`).
 */
export function ViktigeData({
  definisjon,
  kontekst,
  analytter = [],
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  /** Kodene som viser siden, hovedkoden først. */
  analytter?: readonly Katalogoppforing[]
}) {
  const elementer = kontekst.modell.paneler.get(definisjon.nokkel) ?? []
  const flere = analytter.length > 1
  const hovedkode = analytter[0]?.kode ?? null
  const eiere = flere ? analytter : [null]
  const kort = DATAKORT.flatMap((def, plass) =>
    eiere.map((eier): Kortplass => {
      const gjelder = eier && eier.kode !== hovedkode ? eier.kode : null
      return {
        def: def as Datakortdefinisjon,
        type: def.type,
        plass,
        gjelder,
        etikett: eier?.navn ?? null,
        element:
          elementer.find((e) => {
            if (e.elementtype !== def.type) return false
            const kode = datakortGjelder(e.data)
            return gjelder ? kode === gjelder : kode === null || kode === hovedkode
          }) ?? null,
      }
    }),
  )
  const synlige = kort.filter(({ def, element }) => element && datakortHarVerdi(def, element.data))
  if (synlige.length === 0 && !kontekst.redigerer) return null
  return <Flate definisjon={definisjon} kontekst={kontekst} kort={kontekst.redigerer ? kort : synlige} />
}

interface Kortplass {
  def: Datakortdefinisjon
  type: Datakorttype
  /** Plassen i `DATAKORT`, som kortet lagres med. */
  plass: number
  /** Koden kortet gjelder når det ikke er hovedkodens, som lagres i kortet. */
  gjelder: string | null
  /** Stoffet kortet gjelder, når siden har kort for flere. */
  etikett: string | null
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
                  <Datakort key={`${k.type}:${k.gjelder ?? ''}`} {...k} definisjon={definisjon} kontekst={kontekst} />
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
  return (
    <div className="redigeringsrad">
      <Button variant="kant" icon={<Ikon navn="refs" />} className="redigeringsknapp" onClick={() => setApen(true)}>
        Kilder for {definisjon.tittel.toLowerCase()}
      </Button>
      {apen && (
        <PanelkildeSkjema
          tittel={definisjon.tittel}
          referanser={referanser}
          onAvbryt={() => setApen(false)}
          onLagre={async (ider) => {
            await kontekst.handlinger.lagrePanelreferanser(definisjon.nokkel, ider)
            setApen(false)
          }}
        />
      )}
    </div>
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
  gjelder,
  etikett,
  element,
  definisjon,
  kontekst,
}: Kortplass & { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const { ikon, tone } = UTSEENDE[type]
  const lagre =
    (lukk: () => void) =>
    async ({ data, referanser }: Skjemaresultat<object>) => {
      await kontekst.handlinger.lagreElement(element, {
        panel: definisjon.nokkel,
        elementtype: type,
        posisjon: plass,
        data: { ...(data as Record<string, unknown>), ...(gjelder && { gjelder }) },
        referanser,
      })
      lukk()
    }
  const navn = etikett ? `${def.tittel}, ${etikett}` : def.tittel
  const skjemaProps = { tittel: navn, ikon, referanser: element?.referanser ?? [] }

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
        {/* Med symbol står ordet bare for skjermlesere og søket. */}
        <span className={def.symbol ? 'kun-skjermleser' : 'datakort__etikett'}>
          <Uthev tekst={def.tittel} />
        </span>
        {etikett && (
          <span className="datakort__gjelder">
            <span className="kun-skjermleser">, </span>
            <Uthev tekst={etikett} />
          </span>
        )}
      </h3>
      {def.verdi === 'formvis' ? (
        <Redigerbar
          navn={navn}
          element={element}
          redigerer={kontekst.redigerer}
          visning={<Formverdivisning former={lesFormverdier(element?.data).former} />}
          skjema={(lukk) => (
            <FormverdiSkjema {...skjemaProps} start={lesFormverdier(element?.data)} onAvbryt={lukk} onLagre={lagre(lukk)} />
          )}
        />
      ) : (
        <Redigerbar
          navn={navn}
          element={element}
          redigerer={kontekst.redigerer}
          visning={<Intervallvisning data={element?.data} />}
          skjema={(lukk) => (
            <DatakortSkjema
              {...skjemaProps}
              kort={def}
              start={lesIntervallverdi(element?.data)}
              onAvbryt={lukk}
              onLagre={lagre(lukk)}
            />
          )}
        />
      )}
      {element && element.referanser.length > 0 && <Referansefelt ider={element.referanser} niva="element" />}
    </li>
  )
}

const IKKE_OPPGITT = <p className="datakort__tom">Ikke oppgitt</p>

/** Et tall eller område: «> 1 800 nmol/L». Tegnet står i samme store skrift som tallet. */
function Intervallvisning({ data }: { data: unknown }) {
  const deler = delIntervall(lesIntervallverdi(data))
  if (!deler) return IKKE_OPPGITT
  const tegn = deler.forledd === OVER
  return (
    // Delene står med mellomrom imellom, så teksten er den samme som søket leser.
    <p className="datakort__verdi">
      {/* «> 3 600» brytes aldri mellom tegnet og tallet. */}
      <span className="datakort__samlet">
        {deler.forledd && (
          <>
            <span className={tegn ? 'datakort__tall' : 'datakort__forledd'}>
              <Uthev tekst={deler.forledd} />
            </span>{' '}
          </>
        )}
        <span className="datakort__tall">
          <Uthev tekst={deler.tall} />
        </span>
      </span>
      <Enhet enhet={deler.enhet} />
    </p>
  )
}

function Enhet({ enhet }: { enhet: string }) {
  if (!enhet) return null
  return (
    <>
      {' '}
      <span className="datakort__enhet">
        <Uthev tekst={enhet} />
      </span>
    </>
  )
}

/**
 * Verdiene per legemiddelform, side om side: ikonet og navnet på formen, og
 * under den verdien — «33 (29–37) timer», «33 timer» eller «29–37 timer».
 * En verdi uten form står alene, som et vanlig tall.
 */
function Formverdivisning({ former }: { former: readonly Formverdi[] }) {
  if (former.length === 0) return IKKE_OPPGITT
  return (
    <ul className="datakort__former" data-antall={former.length}>
      {former.map((f, i) => (
        <li key={`${i}:${f.form}`} className="datakort__form">
          {f.form && (
            <span className="datakort__formnavn">
              <Ikon navn={legemiddelformikon(f.form)} className="datakort__formikon" />
              <Uthev tekst={f.form} />
              <span className="kun-skjermleser">: </span>
            </span>
          )}
          <Formverditall verdi={f} />
        </li>
      ))}
    </ul>
  )
}

function Formverditall({ verdi }: { verdi: Formverdi }) {
  const deler = delFormverdi(verdi)
  if (!deler) return null
  return (
    <p className="datakort__verdi">
      {deler.typisk && (
        <span className="datakort__tall">
          <Uthev tekst={deler.typisk} />
        </span>
      )}
      {deler.omrade && (
        <>
          {deler.typisk && ' '}
          <span className={deler.typisk ? 'datakort__spenn' : 'datakort__tall'}>
            <Uthev tekst={deler.typisk ? `(${deler.omrade})` : deler.omrade} />
          </span>
        </>
      )}
      <Enhet enhet={deler.enhet} />
    </p>
  )
}
