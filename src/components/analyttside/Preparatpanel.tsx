import { ELEMENTTYPER, type Paneldefinisjon } from '../../faginnhold/paneler'
import type { Tilleggstekst } from '../../faginnhold/sok'
import { iSetning } from '../../domain/names'
import { ramsOpp } from '../../faginnhold/oppsummering'
import {
  oppsummerGruppe,
  oppsummerPreparater,
  type Preparat,
  type Preparatstyrke,
} from '../../legemiddeldata/preparater'
import { finnKobling, preparatkort, preparatsted, preparattekster } from '../../legemiddeldata/stoffside'
import { Detaljkort } from '../seksjoner/Seksjon'
import { Uthev } from '../Uthev'
import { elementAnker, Panel, Redigerbar, type Panelkontekst } from './Paneler'
import { LegemiddelkoblingSkjema } from './Skjemaer'
import type { Legemiddeltilstand } from './useLegemidler'

export { finnKobling } from '../../legemiddeldata/stoffside'

/** Preparatnavnene, slik søket på siden finner dem, med detaljkortet de står i. */
export function preparatsoketekster(tilstand: Legemiddeltilstand): Tilleggstekst[] {
  return tilstand.status === 'klar' ? preparattekster(tilstand.oversikt) : []
}

/**
 * Seksjonen «Preparater»: preparatene i legemiddeldataene fra FEST for
 * virkestoffene siden er koblet til, gruppert som
 * `legemiddelform → preparat → styrker` med pakningene i detaljkortene.
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
              {koblet && <Preparatvisning tilstand={legemidler} />}
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
      return oppsummerPreparater(tilstand.oversikt) || 'Ingen preparater i FEST'
  }
}

function Preparatvisning({ tilstand }: { tilstand: Legemiddeltilstand }) {
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

  const { utvalg, oversikt } = tilstand
  const utgatte = utvalg.virkestoff.filter((v) => v.utgatt)
  const tomt = oversikt.former.length === 0 && oversikt.godkjenningsfritak.length === 0

  return (
    <>
      {utgatte.length > 0 && (
        <p className="preparater__melding" role="note">
          {utgatte.map((v) => v.navn).join(', ')} står ikke lenger i FEST. Koblingen bør kontrolleres.
        </p>
      )}
      {tomt ? (
        <p className="preparater__melding">Det er ingen preparater med dette virkestoffet i FEST.</p>
      ) : (
        <ul className="preparatformer">
          {oversikt.former.map((f) => (
            <li key={f.id}>
              <Detaljkort id={preparatkort(f.id)} tittel={<Uthev tekst={f.form} />} oppsummering={oppsummerGruppe(f.preparater)}>
                <Preparatliste anker={preparatsted(f.id)} preparater={f.preparater} />
              </Detaljkort>
            </li>
          ))}
          {oversikt.godkjenningsfritak.length > 0 && (
            <li>
              <Detaljkort
                id={preparatkort(null)}
                tittel={<Uthev tekst="Krever godkjenningsfritak" />}
                oppsummering={oppsummerGruppe(oversikt.godkjenningsfritak)}
              >
                <p className="preparater__forklaring">
                  Preparatene har ikke markedsføringstillatelse i Norge.
                </p>
                <Preparatliste anker={preparatsted(null)} preparater={oversikt.godkjenningsfritak} visForm />
              </Detaljkort>
            </li>
          )}
        </ul>
      )}
    </>
  )
}

/**
 * Preparatene i ett detaljkort. Ankeret står på lista, inne i kortet, så søket
 * på siden åpner kortet når det går til et treff her.
 */
function Preparatliste({
  anker,
  preparater,
  visForm = false,
}: {
  anker: string
  preparater: readonly Preparat[]
  visForm?: boolean
}) {
  return (
    <ul className="preparatliste" id={elementAnker(anker)}>
      {preparater.map((p) => (
        <li key={p.id} className="preparat">
          <p className="preparat__navn">
            <Uthev tekst={p.navn} />
            {(visForm || p.langform.length > 0) && (
              <span className="preparat__form">
                <Uthev tekst={(p.langform.length > 0 ? p.langform.join(', ') : p.form).toLocaleLowerCase('nb')} />
              </span>
            )}
            {p.kombinasjon.length > 0 && (
              <span className="preparat__merke">Kombinasjon med {p.kombinasjon.map(iSetning).join(', ')}</span>
            )}
            {p.type && <span className="preparat__merke">{p.type}</span>}
          </p>
          {p.salter.length > 0 && <p className="preparat__salt">Som {p.salter.map(iSetning).join(', ')}</p>}
          <Preparatdetaljer preparat={p} />
          <ul className="preparat__styrker">
            {p.styrker.map((s) => (
              <li key={s.id}>
                <span className="preparat__styrke">
                  <Uthev tekst={s.styrke || s.navn_form_styrke} />
                </span>
                <Styrkedetaljer preparat={p} styrke={s} />
                {s.pakninger.length > 0 && (
                  <span className="preparat__pakninger">
                    {s.pakninger
                      .map((k) => `${k.tekst}${k.varenr ? ` (varenr. ${k.varenr})` : ''}${k.midlertidig_utgatt ? ', midlertidig utgått' : ''}`)
                      .join('; ')}
                  </span>
                )}
                {felles(p, omtaler).length === 0 && <Omtalelenker lenker={s.preparatomtaler} />}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

/**
 * Det alle styrkene har likt, som står én gang på preparatet i stedet for på
 * hver styrke. Tomt når styrkene er ulike.
 */
function felles(preparat: Preparat, verdi: (s: Preparatstyrke) => readonly string[]): readonly string[] {
  const [forste, ...resten] = preparat.styrker.map((s) => verdi(s).join('\n'))
  return forste && resten.every((v) => v === forste) ? forste.split('\n') : []
}

const reseptgruppe = (s: Preparatstyrke) => (s.reseptgruppe ? [s.reseptgruppe] : [])
const omtaler = (s: Preparatstyrke) => s.preparatomtaler

/**
 * Reseptgruppe, administrasjonsvei og preparatomtalen for preparatet. Det
 * som er ulikt mellom styrkene står på hver styrke i stedet.
 */
function Preparatdetaljer({ preparat }: { preparat: Preparat }) {
  const tekst = ramsOpp([...felles(preparat, reseptgruppe), ...preparat.administrasjonsveier])
  const lenker = felles(preparat, omtaler)
  if (!tekst && lenker.length === 0) return null
  return (
    <p className="preparat__detaljer">
      {tekst}
      <Omtalelenker lenker={lenker} />
    </p>
  )
}

/** Deling og knusing for styrken, og reseptgruppen når styrkene har ulike. */
function Styrkedetaljer({ preparat, styrke }: { preparat: Preparat; styrke: Preparatstyrke }) {
  const tekst = ramsOpp([
    ...(felles(preparat, reseptgruppe).length === 0 ? reseptgruppe(styrke) : []),
    ...styrke.handtering,
  ])
  return tekst ? <span className="preparat__handtering">{tekst}</span> : null
}

function Omtalelenker({ lenker }: { lenker: readonly string[] }) {
  return lenker.map((lenke, i) => (
    <a key={lenke} className="preparat__omtale" href={lenke} target="_blank" rel="noopener noreferrer">
      {lenker.length > 1 ? `Preparatomtale ${i + 1}` : 'Preparatomtale'}
    </a>
  ))
}
