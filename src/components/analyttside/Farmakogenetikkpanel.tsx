import { useState, type ReactNode } from 'react'
import { ELEMENTTYPER, type Clinpgxkoblingdata, type Paneldefinisjon } from '../../faginnhold/paneler'
import { antall, forhandsvisning, ramsOpp } from '../../faginnhold/oppsummering'
import type { Tilleggstekst } from '../../faginnhold/sok'
import { dato } from '../../legemiddeldata/referanser'
import type { Farmakogenetikkutvalg, Kjemikaliestatus, MedKjemikalier } from '../../clinpgx/lesing'
import {
  kliniskadresse,
  preparatomtaleadresse,
  retningslinjeadresse,
  type KliniskAnnotasjon,
  type Preparatomtale,
  type Retningslinje,
} from '../../clinpgx/modell'
import { clinpgxForeldet, litteraturreferanser } from '../../clinpgx/referanser'
import {
  annotasjonskort,
  annotasjonstittel,
  evidensetikett,
  farmakogenetikktekster,
  finnClinpgxkobling,
  harFarmakogenetikk,
  kjemikaliestatuser,
  kliniskkort,
  klinisktittel,
  LAVERE_EVIDENS_KORT,
  nivaspenn,
  oppsummerFarmakogenetikk,
  sistHentet,
  type Farmakogenetikkvisning,
  type Koblingsgrunnlag,
} from '../../clinpgx/stoffside'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Detaljkort } from '../seksjoner/Seksjon'
import { Referansefelt } from '../referanser/Referansefelt'
import { Uthev } from '../Uthev'
import { useFaginnholdskilde } from './Faginnholdskilde'
import { elementAnker, kortelementer, kortoppsummering, Panel, Redaksjonskort, Redigerbar, type Panelkontekst } from './Paneler'
import { ClinpgxkoblingSkjema } from './Skjemaer'
import type { Farmakogenetikktilstand } from './useFarmakogenetikk'
import '../../styles/farmakogenetikk.css'

/** Tekstene fra ClinPGx søket på siden finner, med detaljkortet de står i. */
export function farmakogenetikksoketekster(tilstand: Farmakogenetikktilstand): Tilleggstekst[] {
  return tilstand.status === 'klar' ? farmakogenetikktekster(tilstand.visning) : []
}

/**
 * Seksjonen «Farmakogenetikk»: øverst de redaksjonelle kortene, som redigeres
 * her, og under dem det OUSFARs kopi av ClinPGx har for kjemikaliene siden er
 * koblet til: retningslinjene, preparatomtalene og de kliniske annotasjonene,
 * hver i sitt detaljkort. ClinPGx-innholdet er referanseinformasjon; det kan
 * ikke redigeres, og ClinPGx står som kilde i seksjonens referansefelt (se
 * `src/clinpgx/referanser.ts`). Koblingen står her, i redigeringsmodus.
 */
export function Farmakogenetikkpanel({
  definisjon,
  kontekst,
  tilstand,
  grunnlag,
  sidenavn,
  onHentet,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  tilstand: Farmakogenetikktilstand
  /** Sidens virkestoff i FEST, som forslagene i koblingen bygger på. */
  grunnlag: Koblingsgrunnlag
  sidenavn: string
  /** Etter at nye data er hentet fra ClinPGx, så siden leser dem. */
  onHentet: () => void
}) {
  const elementer = kortelementer(kontekst, definisjon.nokkel)
  const { kobling } = finnClinpgxkobling(kontekst.modell)
  const koblet = kobling.kjemikalier.length > 0
  const visning = tilstand.status === 'klar' ? tilstand.visning : null
  return (
    <Panel
      definisjon={definisjon}
      kontekst={kontekst}
      tomt={elementer.length === 0 && !koblet}
      oppsummering={ramsOpp([visning && oppsummerFarmakogenetikk(visning), kortoppsummering(elementer)])}
    >
      {/* Står det bare ett redaksjonelt kort, åpnes det bare når ClinPGx ikke har noe ved siden av. */}
      <Redaksjonskort definisjon={definisjon} kontekst={kontekst} elementer={elementer} ettAlene={!koblet} />
      {kontekst.redigerer && (
        <Clinpgxkobling definisjon={definisjon} kontekst={kontekst} grunnlag={grunnlag} sidenavn={sidenavn} onHentet={onHentet} />
      )}
      {koblet && <Clinpgxvisning tilstand={tilstand} kobling={kobling} redigerer={kontekst.redigerer} />}
    </Panel>
  )
}

/* --- Koblingen ------------------------------------------------------------ */

/**
 * Koblingen til ClinPGx, med knappen som henter dataene nå. Etter at
 * koblingen er lagret, hentes dataene for kjemikaliene med en gang, så siden
 * ikke må vente på den ukentlige oppdateringen.
 */
function Clinpgxkobling({
  definisjon,
  kontekst,
  grunnlag,
  sidenavn,
  onHentet,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  grunnlag: Koblingsgrunnlag
  sidenavn: string
  onHentet: () => void
}) {
  const { farmakogenetikk } = useFaginnholdskilde()
  const { element, kobling } = finnClinpgxkobling(kontekst.modell)
  const [henting, setHenting] = useState<{ status: 'henter' } | { status: 'ferdig' | 'feil'; melding: string } | null>(null)
  const navn = 'Koblingen til ClinPGx'

  const hent = async (ider: readonly string[]) => {
    if (!farmakogenetikk || ider.length === 0) return
    setHenting({ status: 'henter' })
    try {
      const svar = await farmakogenetikk.hent(ider)
      setHenting(
        svar.status === 'fullfort'
          ? { status: 'ferdig', melding: 'Dataene er hentet fra ClinPGx.' }
          : { status: 'feil', melding: `Hentingen gikk ikke helt. ${svar.feil ?? 'Se loggen over synkroniseringene.'}` },
      )
    } catch (e) {
      setHenting({ status: 'feil', melding: `Fikk ikke hentet fra ClinPGx. ${e instanceof Error ? e.message : ''}`.trim() })
    }
    onHentet()
  }

  return (
    <div className="farmakogenetikk__kobling">
      <Redigerbar
        navn={navn}
        element={element}
        redigerer
        leggTilTekst="Koble til ClinPGx"
        visning={
          <p className="preparater__kobling">
            {kobling.kjemikalier.length === 0
              ? 'Siden er ikke koblet til ClinPGx. Uten kobling vises bare de redaksjonelle kortene.'
              : `Koblet til ClinPGx: ${kobling.kjemikalier.map((k) => `${k.navn || k.clinpgx_id} (${k.clinpgx_id})`).join(', ')}.`}
          </p>
        }
        ekstra={
          farmakogenetikk &&
          kobling.kjemikalier.length > 0 && (
            <Button
              variant="subtle"
              className="redigeringsknapp"
              disabled={henting?.status === 'henter'}
              onClick={() => void hent(kobling.kjemikalier.map((k) => k.clinpgx_id))}
            >
              {henting?.status === 'henter' ? 'Henter …' : 'Hent fra ClinPGx nå'}
            </Button>
          )
        }
        skjema={(lukk) => (
          <ClinpgxkoblingSkjema
            tittel={navn}
            ikon="dna"
            sidenavn={sidenavn}
            grunnlag={grunnlag}
            start={kobling}
            referanser={element?.referanser ?? []}
            onAvbryt={lukk}
            onLagre={async ({ data, referanser }) => {
              await kontekst.handlinger.lagreElement(element, {
                panel: definisjon.nokkel,
                elementtype: ELEMENTTYPER.clinpgxkobling,
                posisjon: 0,
                data: { ...data },
                referanser,
              })
              lukk()
              void hent(data.kjemikalier.map((k) => k.clinpgx_id))
            }}
          />
        )}
      />
      {henting && henting.status !== 'henter' && (
        <p className="preparater__melding" role={henting.status === 'feil' ? 'alert' : 'status'}>
          {henting.melding}
        </p>
      )}
    </div>
  )
}

/* --- Dataene fra ClinPGx -------------------------------------------------- */

function Clinpgxvisning({
  tilstand,
  kobling,
  redigerer,
}: {
  tilstand: Farmakogenetikktilstand
  kobling: Clinpgxkoblingdata
  redigerer: boolean
}) {
  if (tilstand.status === 'ingen') return null
  if (tilstand.status === 'laster') {
    return (
      <p className="preparater__melding" role="status">
        Henter farmakogenetikken fra ClinPGx …
      </p>
    )
  }
  if (tilstand.status === 'feil') {
    return (
      <p className="preparater__melding" role="alert">
        Fikk ikke hentet farmakogenetikken fra ClinPGx. {tilstand.feil}
      </p>
    )
  }
  const { utvalg, visning } = tilstand
  const kjemikalier = kjemikaliestatuser(utvalg, kobling)
  const hentet = dato(sistHentet(utvalg))
  return (
    <div className="farmakogenetikk">
      <Kjemikaliemeldinger utvalg={utvalg} kjemikalier={kjemikalier} redigerer={redigerer} />
      {harFarmakogenetikk(visning) ? (
        <Grupper visning={visning} />
      ) : (
        kjemikalier.some((k) => k.sist_hentet_kl) && (
          <p className="preparater__melding">
            ClinPGx har ingen retningslinjer, preparatomtaler eller kliniske annotasjoner for{' '}
            {kjemikalienavn(kjemikalier.filter((k) => k.sist_hentet_kl))}.
          </p>
        )
      )}
      <p className="interaksjoner__merknad">
        {ramsOpp([
          'Referanseinformasjon fra ClinPGx, ikke en anbefaling for den enkelte pasient',
          hentet && `sist hentet ${hentet}`,
        ])}
      </p>
    </div>
  )
}

function kjemikalienavn(kjemikalier: readonly Kjemikaliestatus[]): string {
  return kjemikalier.map((k) => k.navn ?? k.id).join(', ')
}

/**
 * Det siden bør si om kopien: kjemikalier som ikke er hentet ennå, som
 * ClinPGx ikke finner lenger, eller der siste henting feilet, og data som
 * ikke er oppdatert på lenge. Feilmeldingen selv vises bare i redigeringen.
 */
function Kjemikaliemeldinger({
  utvalg,
  kjemikalier,
  redigerer,
}: {
  utvalg: Farmakogenetikkutvalg
  kjemikalier: readonly Kjemikaliestatus[]
  redigerer: boolean
}) {
  const meldinger: string[] = []
  for (const k of kjemikalier) {
    const navn = k.navn ?? k.id
    if (!k.finnes) {
      meldinger.push(`ClinPGx finner ikke lenger ${navn} (${k.id}). Koblingen bør kontrolleres; siden viser dataene fra siste henting.`)
    } else if (!k.sist_hentet_kl) {
      meldinger.push(
        k.feil
          ? `${navn} (${k.id}) kunne ikke hentes fra ClinPGx.${redigerer ? ` ${k.feil}` : ''}`
          : `${navn} (${k.id}) er ikke hentet fra ClinPGx ennå. Den ukentlige oppdateringen henter det.`,
      )
    } else if (k.feil && k.feil_kl && k.feil_kl > k.sist_hentet_kl) {
      meldinger.push(
        `Siste henting av ${navn} fra ClinPGx feilet ${dato(k.feil_kl) ?? ''}; siden viser dataene fra ${dato(k.sist_hentet_kl) ?? 'før'}.${redigerer ? ` ${k.feil}` : ''}`,
      )
    }
  }
  const foreldet = clinpgxForeldet(utvalg)
  if (foreldet) meldinger.push(foreldet)
  if (meldinger.length === 0) return null
  return (
    <>
      {meldinger.map((m, i) => (
        <p key={i} className="interaksjoner__ikke-vurdert" role="note">
          {m}
        </p>
      ))}
    </>
  )
}

/** Gruppene i rekkefølge: retningslinjene, preparatomtalene og de kliniske annotasjonene. */
function Grupper({ visning }: { visning: Farmakogenetikkvisning }) {
  const { retningslinjer, preparatomtaler, hoye, lavere } = visning
  return (
    <>
      {retningslinjer.length > 0 && (
        <Gruppe tittel="Retningslinjer">
          {retningslinjer.map((a) => (
            <Annotasjonskort key={a.id} annotasjon={a} lenke={retningslinjeadresse(a.id)} />
          ))}
        </Gruppe>
      )}
      {preparatomtaler.length > 0 && (
        <Gruppe tittel="Farmakogenetiske preparatomtaler">
          {preparatomtaler.map((a) => (
            <Annotasjonskort key={a.id} annotasjon={a} lenke={preparatomtaleadresse(a.id)} />
          ))}
        </Gruppe>
      )}
      {hoye.length + lavere.length > 0 && (
        <Gruppe tittel="Kliniske annotasjoner" dempet>
          {hoye.map((a) => (
            <Klinisk key={a.id} annotasjon={a} />
          ))}
          {lavere.length > 0 && <LavereEvidens annotasjoner={lavere} />}
        </Gruppe>
      )}
    </>
  )
}

/** En gruppe detaljkort med en overskrift som ikke er en egen skuff; siden har bare to nivåer. */
function Gruppe({ tittel, dempet, children }: { tittel: string; dempet?: boolean; children: ReactNode }) {
  return (
    <div className="farmakogenetikk__gruppe" data-dempet={dempet || undefined}>
      <p className="farmakogenetikk__gruppetittel" role="heading" aria-level={3}>
        <Uthev tekst={tittel} />
      </p>
      <ul className="interaksjonsliste">{children}</ul>
    </div>
  )
}

function Clinpgxlenke({ lenke, children }: { lenke: string; children: ReactNode }) {
  return (
    <a className="preparatlenke" href={lenke} target="_blank" rel="noopener noreferrer">
      <Ikon navn="ext" />
      {children}
      <span className="kun-skjermleser"> (åpnes i ny fane)</span>
    </a>
  )
}

/** Merknadene ClinPGx gir en retningslinje eller preparatomtale, som «Dosering». */
function merknader(a: Retningslinje): string[] {
  return [
    a.dosering && 'Dosering',
    a.alternativ && 'Alternativt legemiddel',
    a.annen_veiledning && 'Annen forskrivningsveiledning',
    a.barn && 'Omtaler barn',
  ].filter((m): m is string => !!m)
}

/** Sammendraget som avsnitt, slik ClinPGx deler det. */
function Avsnitt({ tekst }: { tekst: string }) {
  return (
    <>
      {tekst
        .split(/\n\s*\n/)
        .map((a) => a.trim())
        .filter(Boolean)
        .map((a, i) => (
          <p key={i} className="farmakogenetikk__sammendrag">
            <Uthev tekst={a} />
          </p>
        ))}
    </>
  )
}

function Annotasjonskort({
  annotasjon: a,
  lenke,
}: {
  annotasjon: MedKjemikalier<Retningslinje | Preparatomtale>
  lenke: string
}) {
  const kort = annotasjonskort(a.id)
  const testing = 'testing' in a ? a.testing : null
  const tags = merknader(a)
  return (
    <li>
      <Detaljkort
        id={kort}
        ikon="dna"
        tittel={<Uthev tekst={annotasjonstittel(a)} />}
        oppsummering={ramsOpp([testing, forhandsvisning(a.sammendrag, 110)])}
      >
        {/* Ankeret søket peker på står inne i kortet, så å gå dit åpner også kortet. */}
        <div className="interaksjon" id={elementAnker(kort)}>
          {a.sammendrag && <Avsnitt tekst={a.sammendrag} />}
          <dl className="interaksjon__felter">
            <dt>{'testing' in a ? 'Myndighet' : 'Organisasjon'}</dt>
            <dd>{a.kilde || 'Ikke oppgitt'}</dd>
            {a.gener.length > 0 && (
              <>
                <dt>Gener</dt>
                <dd>
                  <Uthev tekst={a.gener.map((g) => g.symbol).join(', ')} />
                </dd>
              </>
            )}
            {testing && (
              <>
                <dt>Testing</dt>
                <dd>
                  <Uthev tekst={testing} />
                </dd>
              </>
            )}
            {tags.length > 0 && (
              <>
                <dt>Inneholder</dt>
                <dd>{tags.join(', ')}</dd>
              </>
            )}
            {a.legemidler.length > 1 && (
              <>
                <dt>Legemidler</dt>
                <dd>{a.legemidler.map((l) => l.navn).join(', ')}</dd>
              </>
            )}
          </dl>
          <p className="preparatlenker">
            <Clinpgxlenke lenke={lenke}>Les hele i ClinPGx</Clinpgxlenke>
          </p>
          <Referansefelt ider={litteraturreferanser(a)} />
        </div>
      </Detaljkort>
    </li>
  )
}

function Klinisk({ annotasjon: a }: { annotasjon: MedKjemikalier<KliniskAnnotasjon> }) {
  const kort = kliniskkort(a.id)
  const lenke = kliniskadresse(a)
  return (
    <li>
      <Detaljkort
        id={kort}
        ikon="dna"
        tittel={<Uthev tekst={klinisktittel(a)} />}
        oppsummering={
          <>
            <span className="farmakogenetikk__niva">{evidensetikett(a.niva)}</span>{' '}
            {ramsOpp([a.gener.map((g) => g.symbol).join(', '), ...a.typer])}
          </>
        }
      >
        <div className="interaksjon" id={elementAnker(kort)}>
          <dl className="interaksjon__felter">
            <dt>Evidensnivå</dt>
            <dd>{evidensetikett(a.niva)}</dd>
            {a.gener.length > 0 && (
              <>
                <dt>Gen</dt>
                <dd>
                  <Uthev tekst={a.gener.map((g) => g.symbol).join(', ')} />
                </dd>
              </>
            )}
            {a.variant && (
              <>
                <dt>Variant</dt>
                <dd>
                  <Uthev tekst={ramsOpp([a.variant, a.rsid !== a.variant && a.rsid])} />
                </dd>
              </>
            )}
            {a.typer.length > 0 && (
              <>
                <dt>Gjelder</dt>
                <dd>{a.typer.join(', ')}</dd>
              </>
            )}
            {a.sykdommer.length > 0 && (
              <>
                <dt>Sykdom</dt>
                <dd>{a.sykdommer.join(', ')}</dd>
              </>
            )}
            {a.fenotyper.length > 0 && (
              <>
                <dt>Genotype og fenotype</dt>
                <dd>
                  {a.fenotyper.map((f) => (
                    <p key={f.allel}>
                      <strong>{f.allel}: </strong>
                      <Uthev tekst={f.fenotype} />
                    </p>
                  ))}
                </dd>
              </>
            )}
          </dl>
          {lenke && (
            <p className="preparatlenker">
              <Clinpgxlenke lenke={lenke}>Se annotasjonen i ClinPGx</Clinpgxlenke>
            </p>
          )}
        </div>
      </Detaljkort>
    </li>
  )
}

/** De kliniske annotasjonene med lavere evidensnivå, samlet i ett kort som en kompakt liste. */
function LavereEvidens({ annotasjoner }: { annotasjoner: readonly MedKjemikalier<KliniskAnnotasjon>[] }) {
  const spenn = nivaspenn(annotasjoner)
  return (
    <li>
      <Detaljkort
        id={LAVERE_EVIDENS_KORT}
        ikon="dna"
        tittel={<Uthev tekst="Lavere evidensnivå" />}
        oppsummering={ramsOpp([
          antall(annotasjoner.length, 'klinisk annotasjon', 'kliniske annotasjoner'),
          spenn && `nivå ${spenn}`,
        ])}
      >
        <div className="interaksjon" id={elementAnker(LAVERE_EVIDENS_KORT)}>
          <table className="farmakogenetikk__tabell">
            <thead>
              <tr>
                <th scope="col">Nivå</th>
                <th scope="col">Gen</th>
                <th scope="col">Variant</th>
                <th scope="col">Gjelder</th>
              </tr>
            </thead>
            <tbody>
              {annotasjoner.map((a) => {
                const lenke = kliniskadresse(a)
                const variant = <Uthev tekst={klinisktittel(a)} />
                return (
                  <tr key={a.id}>
                    <td>{a.niva ?? '–'}</td>
                    <td>
                      <Uthev tekst={a.gener.map((g) => g.symbol).join(', ')} />
                    </td>
                    <td>
                      {lenke ? (
                        <a href={lenke} target="_blank" rel="noopener noreferrer">
                          {variant}
                          <span className="kun-skjermleser"> (åpnes i ny fane)</span>
                        </a>
                      ) : (
                        variant
                      )}
                    </td>
                    <td>{a.typer.join(', ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Detaljkort>
    </li>
  )
}
