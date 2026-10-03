import type { Paneldefinisjon } from '../../faginnhold/paneler'
import { forhandsvisning, ramsOpp } from '../../faginnhold/oppsummering'
import type { Tilleggstekst } from '../../faginnhold/sok'
import { frekvens, gruppeid, gruppenavn, undergruppeid, VISNINGER, type Gruppe, type Gruppenokkel, type Visning } from '../../bivirkninger/modell'
import { bivirkningsreferanseId } from '../../bivirkninger/referanser'
import {
  bivirkningstekster,
  gruppeoppsummering,
  oppsummerBivirkninger,
  undergruppeoppsummering,
  type Bivirkningstabell,
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
 * underkort med ikon, navn og oppsummering, som åpnes til punktlista. Bare
 * kombinasjoner med bivirkninger vises. Har siden flere tabeller (flere
 * preparatomtaler, eller flere tabeller i én), står hver for seg med navnet
 * over, og radene blandes aldri. Dataene kan ikke redigeres her; de
 * importeres, og kildene står i seksjonens referansefelt.
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
  const alene = visning.tabeller.length === 1
  return (
    <div className="bivirkninger">
      <div className="bivirkninger__visning">
        <Trinnbryter etikett="Vis bivirkningene etter" valg={VISNINGSVALG} verdi={valgt} onVelg={onVelg} />
      </div>
      {visning.tabeller.map((tabell) => (
        <Bivirkningstabellvisning
          key={tabell.id ?? ''}
          tabell={tabell}
          valgt={valgt}
          medKilde={visning.flereKilder}
          alene={alene}
        />
      ))}
    </div>
  )
}

/**
 * Én tabell: gruppene, og navnet over når det trengs for å skille den fra de
 * andre — med frekvensgrunnlaget, merknaden og, når kildene er flere, kilden.
 */
function Bivirkningstabellvisning({
  tabell,
  valgt,
  medKilde,
  alene,
}: {
  tabell: Bivirkningstabell
  valgt: Visning
  medKilde: boolean
  alene: boolean
}) {
  const grupper = tabell.grupper[valgt]
  const liste = (
    <ul className="overskriftskortene">
      {grupper.map((gruppe) => (
        <li key={gruppeid(gruppe.nokkel)}>
          <Bivirkningsgruppe gruppe={gruppe} tabell={tabell.id} alene={alene && grupper.length === 1} />
        </li>
      ))}
    </ul>
  )
  if (!tabell.navn) return liste
  const etikett = `bivirkningstabell-${tabell.id ?? 'eneste'}`
  const { frekvensgrunnlag, merknad } = tabell.kontekst ?? {}
  return (
    <div className="bivirkninger__tabell" role="group" aria-labelledby={etikett}>
      <div className="bivirkninger__tabellhode">
        <p id={etikett} className="bivirkninger__tabellnavn">
          <Uthev tekst={tabell.navn} />
          {medKilde && <Referansepille ider={[bivirkningsreferanseId(tabell.kilde)]} />}
        </p>
        {frekvensgrunnlag && (
          <p className="bivirkninger__tabellinfo">
            Frekvensgrunnlag: <Uthev tekst={frekvensgrunnlag} />
          </p>
        )}
        {merknad && (
          <p className="bivirkninger__tabellinfo">
            <Uthev tekst={merknad} />
          </p>
        )}
      </div>
      {liste}
    </div>
  )
}

/** Frekvensdefinisjonen ved navnet, «≥ 1/10», så kategorien alltid står sammen med det den betyr. */
function Definisjon({ nokkel }: { nokkel: Gruppenokkel }) {
  if (nokkel.slag !== 'frekvens') return null
  return <span className="bivirkninger__definisjon">{frekvens(nokkel.kode).definisjon}</span>
}

function Bivirkningsgruppe({ gruppe, tabell, alene }: { gruppe: Gruppe; tabell: string | null; alene: boolean }) {
  const id = gruppeid(gruppe.nokkel, tabell)
  return (
    <Detaljkort
      id={id}
      // Organsystemene har lange navn; overskriften er på størrelse med seksjonens i begge visningene.
      className="overskriftskort overskriftskort--lang"
      // Med bare én gruppe på siden er det ingenting å velge mellom.
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
        apenFraStart={gruppe.undergrupper.length === 1 ? undergruppeid(gruppe.nokkel, gruppe.undergrupper[0]!.nokkel, tabell) : null}
      >
        {gruppe.undergrupper.map((under) => {
          const uid = undergruppeid(gruppe.nokkel, under.nokkel, tabell)
          return (
            <Underkort
              key={uid}
              id={uid}
              anker={elementAnker(uid)}
              ikon={bivirkningsikon(under.nokkel)}
              tittel={<Uthev tekst={gruppenavn(under.nokkel)} />}
              tittelTillegg={<Definisjon nokkel={under.nokkel} />}
              oppsummering={forhandsvisning(undergruppeoppsummering(under))}
            >
              <ul className="bivirkninger__liste">
                {under.bivirkninger.map((b) => (
                  <li key={`${b.kilde}:${b.posisjon}`}>
                    <Uthev tekst={b.tekst} />
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
