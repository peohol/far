import { Fragment, useState } from 'react'
import type { Clinpgxkoblingdata } from '../../faginnhold/paneler'
import { antall, ramsOpp } from '../../faginnhold/oppsummering'
import { dato } from '../../legemiddeldata/referanser'
import type { Litteratur } from '../../clinpgx/modell'
import type { Legemiddel, Par } from '../../cpic/modell'
import { cpicForeldet, publikasjonsider } from '../../cpic/referanser'
import {
  ANDRE_PAR_TITTEL,
  betingelsetekst,
  CPIC_ANDRE_PAR_KORT,
  cpicHentet,
  cpicversjon,
  harCpic,
  retningslinjeoppsummering,
  type Anbefalingsgruppe,
  type Retningslinjekort,
} from '../../cpic/stoffside'
import { Button } from '../Button'
import { Detaljkort } from '../seksjoner/Seksjon'
import { Referansefelt } from '../referanser/Referansefelt'
import { Uthev } from '../Uthev'
import { useFaginnholdskilde } from './Faginnholdskilde'
import { Gruppe, Kildelenke } from './Farmakogenetikkdeler'
import { elementAnker } from './Paneler'
import type { Cpictilstand } from './useFarmakogenetikk'

/**
 * CPICs strukturerte anbefalinger i «Farmakogenetikk»: ett detaljkort per
 * CPIC-retningslinje for legemidlene siden er koblet til, og ett for parene
 * CPIC har vurdert uten retningslinje. Ikke-interaktivt: kortet viser alle
 * anbefalingene CPIC har, med betingelsene, styrken, kilden og versjonen.
 * Implikasjonene og kommentarene står under «Mer om anbefalingen».
 *
 * CPIC-dataene er et eget lag ved siden av ClinPGx (`docs/cpic.md`), og
 * gruppen står for seg med sin egen kilde, så det er tydelig hva som er
 * CPICs forskrivningsanbefalinger og hva som er ClinPGx' annotasjoner.
 */
export function Cpicvisning({
  tilstand,
  kobling,
  litteratur,
  redigerer,
  onHentet,
}: {
  tilstand: Cpictilstand
  kobling: Clinpgxkoblingdata
  /** Publikasjonene ClinPGx-dataene på siden oppgir, så samme publikasjon står én gang. */
  litteratur: readonly Litteratur[]
  redigerer: boolean
  /** Etter at en administrator har hentet CPIC-dataene på nytt. */
  onHentet: () => void
}) {
  if (tilstand.status === 'ingen') return null
  if (tilstand.status === 'laster') {
    return (
      <p className="preparater__melding" role="status">
        Henter anbefalingene fra CPIC …
      </p>
    )
  }
  if (tilstand.status === 'feil') {
    return (
      <p className="preparater__melding" role="alert">
        Fikk ikke hentet anbefalingene fra CPIC. {tilstand.feil}
      </p>
    )
  }
  const { visning } = tilstand
  const henting = redigerer && <CpicHenting onHentet={onHentet} />
  if (!cpicHentet(visning.kilde)) {
    return (
      <div className="farmakogenetikk">
        <p className="interaksjoner__ikke-vurdert" role="note">
          Anbefalingene fra CPIC er ikke hentet ennå. Den ukentlige oppdateringen henter dem.
        </p>
        {henting}
      </div>
    )
  }
  const foreldet = cpicForeldet(visning.kilde)
  if (!harCpic(visning)) {
    const navn = kobling.kjemikalier.map((k) => k.navn || k.clinpgx_id).join(', ')
    return (
      <div className="farmakogenetikk">
        <p className="preparater__melding">
          CPIC har ingen gen–legemiddel-par eller anbefalinger for {navn} ({cpicversjon(visning.kilde, dato)}).
        </p>
        {henting}
      </div>
    )
  }
  const legemidler = new Map(visning.legemidler.map((l) => [l.id, l]))
  const kontrollert = dato(visning.kilde.kontrollert_kl ?? visning.kilde.endret_kl)
  return (
    <div className="farmakogenetikk">
      {foreldet && (
        <p className="interaksjoner__ikke-vurdert" role="note">
          {foreldet}
        </p>
      )}
      <Gruppe
        tittel="Anbefalinger fra CPIC"
        ingress="CPICs strukturerte anbefalinger for forskrivning når pasientens farmakogenetiske resultat allerede er kjent. De sier ikke hvem som bør testes."
      >
        {visning.retningslinjer.map((k) => (
          <Retningslinjekortet key={k.kort} kort={k} legemidler={legemidler} litteratur={litteratur} />
        ))}
        {visning.andre_par.length > 0 && <AndrePar par={visning.andre_par} legemidler={legemidler} />}
      </Gruppe>
      <p className="interaksjoner__merknad">
        {ramsOpp([
          `Anbefalinger fra ${cpicversjon(visning.kilde, dato)}`,
          kontrollert && `sist kontrollert ${kontrollert}`,
          'gjelder et allerede kjent resultat',
        ])}
      </p>
      {henting}
    </div>
  )
}

/** Knappen som henter CPIC-databasen på nytt nå. Bare for administratorer, i redigeringen. */
function CpicHenting({ onHentet }: { onHentet: () => void }) {
  const { cpic } = useFaginnholdskilde()
  const [henting, setHenting] = useState<{ status: 'henter' } | { status: 'ferdig' | 'feil'; melding: string } | null>(null)
  if (!cpic) return null
  const hent = async () => {
    setHenting({ status: 'henter' })
    try {
      const svar = await cpic.hent()
      setHenting(
        svar.status === 'feilet'
          ? { status: 'feil', melding: `Hentingen fra CPIC feilet. ${svar.feil ?? ''}`.trim() }
          : {
              status: 'ferdig',
              melding: svar.status === 'uendret' ? 'CPIC-dataene er kontrollert og uendret.' : 'CPIC-dataene er hentet på nytt.',
            },
      )
    } catch (e) {
      setHenting({ status: 'feil', melding: `Fikk ikke hentet fra CPIC. ${e instanceof Error ? e.message : ''}`.trim() })
    }
    onHentet()
  }
  return (
    <div className="farmakogenetikk__kobling">
      <p className="preparatlenker">
        <Button variant="subtle" className="redigeringsknapp" disabled={henting?.status === 'henter'} onClick={() => void hent()}>
          {henting?.status === 'henter' ? 'Henter …' : 'Hent fra CPIC nå'}
        </Button>
      </p>
      {henting && henting.status !== 'henter' && (
        <p className="preparater__melding" role={henting.status === 'feil' ? 'alert' : 'status'}>
          {henting.melding}
        </p>
      )}
    </div>
  )
}

function legemiddelnavn(legemidler: ReadonlyMap<string, Legemiddel>, id: string): string {
  return legemidler.get(id)?.navn ?? id
}

/** «fjernet 01.02.2024: grunnen», når CPIC har fjernet paret. */
function fjernet(p: Par): string | null {
  if (!p.fjernet) return null
  return ramsOpp([`fjernet${p.fjernet_dato ? ` ${dato(p.fjernet_dato) ?? p.fjernet_dato}` : ''}`, p.fjernet_grunn])
}

/** «CYP2D6 – amitriptyline: CPIC-nivå A, ClinPGx-nivå 1A». */
function partekst(p: Par, legemidler: ReadonlyMap<string, Legemiddel>): string {
  const nivaer = [p.cpic_niva && `CPIC-nivå ${p.cpic_niva}`, p.clinpgx_niva && `ClinPGx-nivå ${p.clinpgx_niva}`]
    .filter(Boolean)
    .join(', ')
  const tillegg = [!p.brukt_i_anbefaling && 'brukes ikke i anbefalingene', fjernet(p)].filter(Boolean).join('; ')
  return `${p.gen} – ${legemiddelnavn(legemidler, p.legemiddel_id)}${nivaer ? `: ${nivaer}` : ''}${tillegg ? ` (${tillegg})` : ''}`
}

function Retningslinjekortet({
  kort: k,
  legemidler,
  litteratur,
}: {
  kort: Retningslinjekort
  legemidler: ReadonlyMap<string, Legemiddel>
  litteratur: readonly Litteratur[]
}) {
  // Med flere legemidler på siden i samme retningslinje står anbefalingene under hvert av dem.
  const perLegemiddel =
    k.legemidler.length > 1
      ? k.legemidler.map((l) => ({ legemiddel: l as Legemiddel | null, grupper: k.grupper.filter((g) => g.legemiddel_id === l.id) }))
      : [{ legemiddel: null, grupper: k.grupper }]
  const flytskjemaer = k.legemidler.filter((l) => l.flytskjema_url)
  return (
    <li>
      <Detaljkort id={k.kort} ikon="dna" tittel={<Uthev tekst={k.retningslinje.navn} />} oppsummering={retningslinjeoppsummering(k)}>
        {/* Ankeret søket peker på står inne i kortet, så å gå dit åpner også kortet. */}
        <div className="interaksjon" id={elementAnker(k.kort)}>
          <dl className="interaksjon__felter">
            <dt>Gen og resultattype</dt>
            <dd>
              {k.gener.map((g) => (
                <p key={g.symbol}>
                  <strong>
                    <Uthev tekst={g.symbol} />
                  </strong>
                  {g.resultattype ? `: slås opp på ${g.resultattype}` : ': CPIC har ikke oppgitt hva det slås opp på'}
                </p>
              ))}
            </dd>
            {k.gener.some((g) => g.resultater.length > 0) && (
              <>
                <dt>Resultatkategorier</dt>
                <dd>
                  {k.gener
                    .filter((g) => g.resultater.length > 0)
                    .map((g) => (
                      <p key={g.symbol}>
                        <strong>{g.symbol}: </strong>
                        <Uthev tekst={g.resultater.join(', ')} />
                      </p>
                    ))}
                </dd>
              </>
            )}
            {k.par.length > 0 && (
              <>
                <dt>Gen–legemiddel-par</dt>
                <dd>
                  {k.par.map((p) => (
                    <p key={p.id}>{partekst(p, legemidler)}</p>
                  ))}
                </dd>
              </>
            )}
            {k.klassifiseringer.length > 0 && (
              <>
                <dt>Styrke</dt>
                <dd>{k.klassifiseringer.join(', ')}</dd>
              </>
            )}
            {k.populasjoner.length > 0 && (
              <>
                <dt>Populasjon</dt>
                <dd>{k.populasjoner.join(', ')}</dd>
              </>
            )}
            {k.retningslinje.bruksmerknad && (
              <>
                <dt>Merknad fra CPIC</dt>
                <dd>{k.retningslinje.bruksmerknad}</dd>
              </>
            )}
          </dl>
          {k.grupper.length === 0 ? (
            <p className="interaksjoner__ikke-vurdert" role="note">
              CPIC har ingen strukturerte anbefalinger for denne retningslinjen i databasen. Veiledningen står i selve
              retningslinjen.
            </p>
          ) : (
            perLegemiddel.map(({ legemiddel, grupper }) => (
              <Fragment key={legemiddel?.id ?? 'alle'}>
                <p className="cpic__overskrift" role="heading" aria-level={4}>
                  {legemiddel ? `Anbefalinger for ${legemiddel.navn}` : 'Anbefalinger'}
                </p>
                <ol className="cpic__anbefalinger">
                  {grupper.map((g) => (
                    <Anbefalingsrad key={g.id} gruppe={g} visPopulasjon={k.populasjoner.length > 1} />
                  ))}
                </ol>
              </Fragment>
            ))
          )}
          <p className="preparatlenker">
            {k.retningslinje.url && <Kildelenke lenke={k.retningslinje.url}>Les retningslinjen</Kildelenke>}
            {flytskjemaer.map((l) => (
              <Kildelenke key={l.id} lenke={l.flytskjema_url!}>
                {flytskjemaer.length > 1 ? `Flytskjema for ${l.navn}` : 'Flytskjema fra CPIC'}
              </Kildelenke>
            ))}
          </p>
          <Referansefelt ider={publikasjonsider(k, litteratur).map((p) => p.id)} />
        </div>
      </Detaljkort>
    </li>
  )
}

/**
 * Én anbefaling, eller flere som er like i alt annet enn aktivitetsverdien:
 * betingelsene, styrken og anbefalingen, og under «Mer om anbefalingen»
 * implikasjonene, kommentarene og CPICs ID-er, så det går an å se nøyaktig
 * hvilke anbefalinger raden står for.
 */
function Anbefalingsrad({ gruppe: g, visPopulasjon }: { gruppe: Anbefalingsgruppe; visPopulasjon: boolean }) {
  const implikasjoner = g.betingelser.filter((b) => b.implikasjon)
  return (
    <li className="cpic__anbefaling">
      <p className="cpic__betingelser">
        {g.betingelser.map((b) => (
          <span key={b.gen} className="cpic__betingelse">
            <Uthev tekst={betingelsetekst(b)} />
          </span>
        ))}
        {visPopulasjon && g.populasjon && <span className="cpic__populasjon">Populasjon: {g.populasjon}</span>}
      </p>
      <p className="cpic__anbefalingstekst">
        <span className="farmakogenetikk__niva">Styrke: {g.klassifisering ?? 'ikke oppgitt'}</span>{' '}
        <Uthev tekst={g.anbefaling ?? 'CPIC har ingen anbefalingstekst for denne kombinasjonen.'} />
      </p>
      <details className="cpic__mer">
        <summary>Mer om anbefalingen</summary>
        <dl className="interaksjon__felter">
          {implikasjoner.map((b) => (
            <Fragment key={b.gen}>
              <dt>Implikasjon, {b.gen}</dt>
              <dd>{b.implikasjon}</dd>
            </Fragment>
          ))}
          {g.kommentarer && (
            <>
              <dt>Kommentarer</dt>
              <dd>{g.kommentarer}</dd>
            </>
          )}
          {g.radtyper.length > 0 && (
            <>
              <dt>Inneholder</dt>
              <dd>{g.radtyper.join(', ')}</dd>
            </>
          )}
          {g.populasjon && (
            <>
              <dt>Populasjon</dt>
              <dd>{g.populasjon}</dd>
            </>
          )}
          <dt>{g.anbefalinger.length === 1 ? 'Anbefaling i CPIC' : 'Anbefalinger i CPIC'}</dt>
          <dd>{g.anbefalinger.join(', ')}</dd>
        </dl>
      </details>
    </li>
  )
}

/** Parene CPIC har vurdert uten en retningslinje med strukturerte anbefalinger, i en kompakt tabell. */
function AndrePar({ par, legemidler }: { par: readonly Par[]; legemidler: ReadonlyMap<string, Legemiddel> }) {
  const flereLegemidler = new Set(par.map((p) => p.legemiddel_id)).size > 1
  return (
    <li>
      <Detaljkort
        id={CPIC_ANDRE_PAR_KORT}
        ikon="dna"
        tittel={<Uthev tekst={ANDRE_PAR_TITTEL} />}
        oppsummering={ramsOpp([[...new Set(par.map((p) => p.gen))].join(', '), antall(par.length, 'par', 'par')])}
      >
        <div className="interaksjon" id={elementAnker(CPIC_ANDRE_PAR_KORT)}>
          <p className="farmakogenetikk__ingress">
            Par CPIC har vurdert, men som ikke har en retningslinje med strukturerte anbefalinger i CPIC-databasen.
          </p>
          <table className="farmakogenetikk__tabell">
            <thead>
              <tr>
                <th scope="col">Gen</th>
                {flereLegemidler && <th scope="col">Legemiddel</th>}
                <th scope="col">CPIC-nivå</th>
                <th scope="col">ClinPGx-nivå</th>
                <th scope="col">Testing</th>
              </tr>
            </thead>
            <tbody>
              {par.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Uthev tekst={p.gen} />
                    {p.fjernet && <> ({fjernet(p)})</>}
                  </td>
                  {flereLegemidler && <td>{legemiddelnavn(legemidler, p.legemiddel_id)}</td>}
                  <td>{p.cpic_niva ?? '–'}</td>
                  <td>{p.clinpgx_niva ?? '–'}</td>
                  <td>{p.pgx_testing ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Detaljkort>
    </li>
  )
}

