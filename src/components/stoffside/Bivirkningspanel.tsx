import type { Paneldefinisjon } from '../../faginnhold/paneler'
import { forhandsvisning, ramsOpp } from '../../faginnhold/oppsummering'
import type { Tilleggstekst } from '../../faginnhold/sok'
import { frekvens, gruppeid, gruppenavn, undergruppeid, VISNINGER, type Gruppe, type Gruppenokkel, type Visning } from '../../bivirkninger/modell'
import { bivirkningsreferanseId } from '../../bivirkninger/referanser'
import {
  bivirkningstekster,
  gruppeoppsummering,
  oppsummerBivirkninger,
  undergruppeHarMer,
  undergruppeoppsummering,
  type Bivirkningsvisning,
} from '../../bivirkninger/stoffside'
import { Ikon } from '../ikon/Ikon'
import { Referansepille } from '../referanser/Referansepille'
import { Detaljkort, Underkort, Underkortrutenett } from '../seksjoner/Seksjon'
import { Trinnbryter } from '../Trinnbryter'
import { Uthev } from '../Uthev'
import { elementAnker, kortelementer, kortoppsummering, Panel, Redaksjonskort, type Panelkontekst } from './Paneler'
import { bivirkningsikon } from './panelvisning'
import type { Bivirkningstilstand } from './useFarmakogenetikk'
import '../../styles/bivirkninger.css'

const VISNINGSVALG = VISNINGER.map((v) => ({ verdi: v.kode, merke: v.navn }))

/** Tekstene i bivirkningene søket på siden finner, i visningen som står. */
export function bivirkningssoketekster(tilstand: Bivirkningstilstand, visning: Visning): Tilleggstekst[] {
  return tilstand.status === 'klar' ? bivirkningstekster(tilstand.visning, visning) : []
}

/** Om seksjonen har bivirkninger fra preparatomtalene å vise. */
export function harBivirkninger(tilstand: Bivirkningstilstand): boolean {
  return tilstand.status === 'klar' && tilstand.visning.data.bivirkninger.length > 0
}

/**
 * Seksjonen «Bivirkninger»: øverst bivirkningene fra preparatomtalene, gruppert
 * etter frekvens eller etter organsystem, og under dem de redaksjonelle kortene.
 *
 * Det er ett datasett, og bryteren øverst bestemmer bare hvordan det vises
 * (`docs/bivirkninger.md`). Gruppene er detaljkort tegnet som overskrifter, i
 * styringen for siden som andre detaljkort; i hver står kombinasjonene som
 * underkort med ikon, navn og punktliste. Bare kombinasjoner med bivirkninger
 * vises. Dataene kan ikke redigeres her; de importeres, og kildene står i
 * seksjonens referansefelt.
 */
export function Bivirkningspanel({
  definisjon,
  kontekst,
  tilstand,
  visning,
  onVelgVisning,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  tilstand: Bivirkningstilstand
  visning: Visning
  onVelgVisning: (visning: Visning) => void
}) {
  const elementer = kortelementer(kontekst, definisjon.nokkel)
  const data = harBivirkninger(tilstand) && tilstand.status === 'klar' ? tilstand.visning : null
  return (
    <Panel
      definisjon={definisjon}
      kontekst={kontekst}
      tomt={elementer.length === 0 && !data}
      oppsummering={ramsOpp([data && oppsummerBivirkninger(data.data), kortoppsummering(elementer)])}
    >
      {data ? (
        <Bivirkningsgrupper visning={data} valgt={visning} onVelg={onVelgVisning} />
      ) : (
        <Melding tilstand={tilstand} redigerer={kontekst.redigerer} />
      )}
      <Redaksjonskort definisjon={definisjon} kontekst={kontekst} elementer={elementer} ettAlene={!data} />
    </Panel>
  )
}

/** Det seksjonen sier når den ikke har bivirkninger å vise: at de hentes, at det gikk galt, eller — for redaktøren — at ingen er importert. */
function Melding({ tilstand, redigerer }: { tilstand: Bivirkningstilstand; redigerer: boolean }) {
  if (tilstand.status === 'feil') {
    return (
      <p className="preparater__melding" role="alert">
        Fikk ikke hentet bivirkningene. {tilstand.feil}
      </p>
    )
  }
  if (tilstand.status !== 'klar' || !redigerer) return null
  return (
    <p className="preparater__melding">
      Ingen bivirkninger er importert fra preparatomtaler ennå. De importeres for seg og kan ikke skrives inn her.
    </p>
  )
}

function Bivirkningsgrupper({
  visning,
  valgt,
  onVelg,
}: {
  visning: Bivirkningsvisning
  valgt: Visning
  onVelg: (visning: Visning) => void
}) {
  const grupper = visning.grupper[valgt]
  return (
    <div className="bivirkninger">
      <div className="bivirkninger__visning">
        <Trinnbryter etikett="Vis bivirkningene etter" valg={VISNINGSVALG} verdi={valgt} onVelg={onVelg} />
      </div>
      <ul className="overskriftskortene">
        {grupper.map((gruppe) => (
          <li key={gruppeid(gruppe.nokkel)}>
            <Bivirkningsgruppe gruppe={gruppe} flereKilder={visning.flereKilder} alene={grupper.length === 1} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Frekvensdefinisjonen ved navnet, «≥ 1/10», så kategorien alltid står sammen med det den betyr. */
function Definisjon({ nokkel }: { nokkel: Gruppenokkel }) {
  if (nokkel.slag !== 'frekvens') return null
  return <span className="bivirkninger__definisjon">{frekvens(nokkel.kode).definisjon}</span>
}

function Bivirkningsgruppe({ gruppe, flereKilder, alene }: { gruppe: Gruppe; flereKilder: boolean; alene: boolean }) {
  const id = gruppeid(gruppe.nokkel)
  return (
    <Detaljkort
      id={id}
      // Organsystemene har lange navn; overskriften er på størrelse med seksjonens i begge visningene.
      className="overskriftskort overskriftskort--lang"
      // Med bare én gruppe er det ingenting å velge mellom.
      apenFraStart={alene}
      tittel={
        <>
          <Ikon navn={bivirkningsikon(gruppe.nokkel)} className="overskriftskort__ikon" />
          <Uthev tekst={gruppenavn(gruppe.nokkel)} />
        </>
      }
      tittelTillegg={<Definisjon nokkel={gruppe.nokkel} />}
      oppsummering={forhandsvisning(gruppeoppsummering(gruppe))}
    >
      <Underkortrutenett
        etikett={gruppenavn(gruppe.nokkel)}
        apenFraStart={gruppe.undergrupper.length === 1 ? undergruppeid(gruppe.nokkel, gruppe.undergrupper[0]!.nokkel) : null}
      >
        {gruppe.undergrupper.map((under) => {
          const uid = undergruppeid(gruppe.nokkel, under.nokkel)
          const sammendrag = undergruppeoppsummering(under)
          return (
            <Underkort
              key={uid}
              id={uid}
              anker={elementAnker(uid)}
              kanApnes={undergruppeHarMer(under, flereKilder)}
              ikon={bivirkningsikon(under.nokkel)}
              tittel={<Uthev tekst={gruppenavn(under.nokkel)} />}
              tittelTillegg={<Definisjon nokkel={under.nokkel} />}
              oppsummering={forhandsvisning(sammendrag)}
            >
              <ul className="bivirkninger__liste">
                {under.bivirkninger.map((b) => (
                  <li key={`${b.kilde}:${b.posisjon}`}>
                    <Uthev tekst={b.tekst} />
                    {flereKilder && <Referansepille ider={[bivirkningsreferanseId({ id: b.kilde })]} />}
                    {b.fotnote && (
                      <span className="bivirkninger__fotnote">
                        <Uthev tekst={b.fotnote} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Underkort>
          )
        })}
      </Underkortrutenett>
    </Detaljkort>
  )
}
