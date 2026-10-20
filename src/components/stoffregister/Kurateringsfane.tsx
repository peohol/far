import { useCallback, useId, useMemo, type ReactNode } from 'react'
import { stoffadresse } from '../../domain/rute'
import type { Registerkategori, Registerstoff } from '../../domain/stoffregister'
import { antall, ramsOpp } from '../../faginnhold/oppsummering'
import { useHenting } from '../../hooks/useHenting'
import type { Kurateringsklient } from '../../kuratering/klient'
import { ARTSNAVN } from '../../kuratering/modell'
import {
  FASENAVN,
  FASER,
  FREMDRIFTSNAVN,
  perFagside,
  type Kurateringsfase,
  type Kurateringsrad,
  type Sidekuratering,
} from '../../kuratering/sidestatus'
import { useBevart } from '../../oppdatering/Bevaring'
import { Button } from '../Button'
import { Merke, type Merketone } from '../Merke'
import { Trinnbryter, type Trinnvalg } from '../Trinnbryter'
import { Tidspunkt } from '../traad/Smadeler'

type Visning = Kurateringsfase | 'alle'
type Sortering = 'nyeste' | 'eldste' | 'stoffgruppe' | 'navn'

const VISNINGER: readonly Trinnvalg<Visning>[] = [
  { verdi: 'alle', merke: 'Alle', navn: 'Alle fagsidene' },
  ...FASER.map((f) => ({ verdi: f, merke: FASENAVN[f] })),
]

const SORTERINGER: readonly Trinnvalg<Sortering>[] = [
  { verdi: 'nyeste', merke: 'Nyeste', navn: 'Nyeste kuratering først' },
  { verdi: 'eldste', merke: 'Eldste', navn: 'Eldste kuratering først' },
  { verdi: 'stoffgruppe', merke: 'Stoffgruppe' },
  { verdi: 'navn', merke: 'Navn' },
]

const FASETONE: Record<Kurateringsfase, Merketone> = { pagaar: 'aksent', kuratert: 'referanse', ikke_kuratert: 'noytral' }

/** Én fagside i oversikten: stoffet, stoffgruppen og statusen. */
export interface Kurateringslinje {
  stoff: Registerstoff
  /** Stoffgruppen stoffet står først i, i registerets rekkefølge. */
  gruppe: { navn: string; plass: number }
  fase: Kurateringsfase
  /** Når kurateringen statusen gjelder, startet eller ble publisert; tom uten. */
  kl: string
  side: Sidekuratering<Kurateringsrad> | null
}

/**
 * Hver aktive fagside i registeret én gang, med stoffgruppen den står først i
 * og statusen av kurateringene (`src/kuratering/sidestatus.ts`).
 */
export function kurateringslinjer(kategorier: readonly Registerkategori[], rader: readonly Kurateringsrad[]): Kurateringslinje[] {
  const sider = perFagside(rader)
  const linjer = new Map<string, Kurateringslinje>()
  let plass = 0
  const legg = (stoffer: readonly Registerstoff[], navn: string) => {
    for (const stoff of stoffer) {
      if (linjer.has(stoff.slug)) continue
      const side = sider.get(stoff.slug) ?? null
      linjer.set(stoff.slug, { stoff, gruppe: { navn, plass }, fase: side?.fase ?? 'ikke_kuratert', kl: side?.kl ?? '', side })
    }
    plass += 1
  }
  for (const k of kategorier) {
    legg(k.direkte, k.navn)
    for (const u of k.underkategorier) legg(u.stoffer, `${k.navn} › ${u.navn}`)
  }
  return [...linjer.values()]
}

const paaNavn = (a: Kurateringslinje, b: Kurateringslinje) => a.stoff.navn.localeCompare(b.stoff.navn, 'nb')
const tid = (l: Kurateringslinje) => Date.parse(l.kl) || 0

/** Linjene i rekkefølgen som er valgt. Uten tidspunkt står de sist, alfabetisk. */
export function sorter(linjer: readonly Kurateringslinje[], sortering: Sortering): Kurateringslinje[] {
  const etterTid = (retning: 1 | -1) => (a: Kurateringslinje, b: Kurateringslinje) =>
    (tid(a) ? 0 : 1) - (tid(b) ? 0 : 1) || retning * (tid(a) - tid(b)) || paaNavn(a, b)
  const regel = {
    nyeste: etterTid(-1),
    eldste: etterTid(1),
    stoffgruppe: (a: Kurateringslinje, b: Kurateringslinje) => a.gruppe.plass - b.gruppe.plass || paaNavn(a, b),
    navn: paaNavn,
  }[sortering]
  return [...linjer].sort(regel)
}

/** Det som står om kurateringen, i ord: hvor langt den er kommet og når. */
function Kurateringstekst({ linje }: { linje: Kurateringslinje }) {
  const { side } = linje
  if (!side) return null
  const { aktiv, publisert } = side
  if (aktiv) {
    return (
      <>
        {ARTSNAVN[aktiv.art]}: {FREMDRIFTSNAVN[aktiv.status]?.toLowerCase()}, startet <Tidspunkt iso={aktiv.opprettet_kl} />
        {publisert?.publisert_kl && (
          <>
            {' '}
            · sist kuratert <Tidspunkt iso={publisert.publisert_kl} />
          </>
        )}
      </>
    )
  }
  if (publisert?.publisert_kl) {
    return (
      <>
        {ARTSNAVN[publisert.art]} publisert <Tidspunkt iso={publisert.publisert_kl} />
        {side.antallPublisert > 1 && ` · ${antall(side.antallPublisert, 'kuratering', 'kurateringer')} i alt`}
      </>
    )
  }
  return null
}

function Linje({ linje, visGruppe }: { linje: Kurateringslinje; visGruppe: boolean }) {
  return (
    <li className="registerrad kurateringsrad">
      <a className="registerrad__navn" href={stoffadresse(linje.stoff.slug)}>
        {linje.stoff.navn}
      </a>
      <Merke tone={FASETONE[linje.fase]}>{FASENAVN[linje.fase]}</Merke>
      <span className="registerrad__meta">
        {visGruppe && linje.gruppe.navn}
        {visGruppe && linje.fase !== 'ikke_kuratert' && ' · '}
        <Kurateringstekst linje={linje} />
      </span>
    </li>
  )
}

function Liste({ linjer, etikett, visGruppe }: { linjer: readonly Kurateringslinje[]; etikett: string; visGruppe: boolean }) {
  return (
    <ul className="registerliste" aria-label={etikett}>
      {linjer.map((l) => (
        <Linje key={l.stoff.slug} linje={l} visGruppe={visGruppe} />
      ))}
    </ul>
  )
}

function Gruppe({ navn, children }: { navn: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className="registerunderkategori" aria-labelledby={id}>
      <h3 id={id} className="registerunderkategori__navn">
        {navn}
      </h3>
      {children}
    </section>
  )
}

/** Oppsummeringen øverst: hvor mange fagsider som er kuratert, pågår og gjenstår. */
export function kurateringsoppsummering(linjer: readonly Kurateringslinje[]): string {
  return ramsOpp(FASER.map((f) => `${linjer.filter((l) => l.fase === f).length} ${FASENAVN[f].toLowerCase()}`))
}

/**
 * Fanen «Kurateringer» i stoffregisteret, for alle innloggede: hver fagside én
 * gang, med om den er kuratert (minst én kuratering er publisert), om en
 * kuratering pågår, eller om den ikke er kuratert ennå. Uten de tekniske
 * detaljene administratorene ser i kurateringsmenyen, men med den samme
 * statusen. Kan vises etter status og sorteres etter tidspunktet, stoffgruppen
 * eller navnet; valgene huskes over en oppdatering av appen.
 */
export function Kurateringsfane({ kategorier, klient }: { kategorier: readonly Registerkategori[]; klient: Kurateringsklient }) {
  const { tilstand, hentPaNytt } = useHenting(useCallback(() => klient.kurateringer(), [klient]))
  const [visning, setVisning] = useBevart<Visning>('kurateringer:visning', 'alle')
  const [sortering, setSortering] = useBevart<Sortering>('kurateringer:sortering', 'nyeste')
  const linjer = useMemo(
    () => (tilstand.status === 'klar' ? kurateringslinjer(kategorier, tilstand.data) : []),
    [kategorier, tilstand],
  )
  const synlige = useMemo(
    () => sorter(visning === 'alle' ? linjer : linjer.filter((l) => l.fase === visning), sortering),
    [linjer, visning, sortering],
  )
  if (tilstand.status === 'laster') return <p className="stoffregisterside__laster">Henter kurateringene …</p>
  if (tilstand.status === 'feil') {
    return (
      <div className="sidevarsel" role="alert">
        <p>Fikk ikke hentet kurateringene. {tilstand.melding}</p>
        <Button variant="subtle" onClick={hentPaNytt}>
          Prøv igjen
        </Button>
      </div>
    )
  }

  const grupper = sortering === 'stoffgruppe' ? grupperEtterStoffgruppe(synlige) : null
  return (
    <div className="kurateringsfane">
      <p className="metalinje">{kurateringsoppsummering(linjer)}</p>
      <p className="stoffregisterside__hjelp">
        En fagside er kuratert når minst én kuratering av den er publisert: kontrollert mot kildene og lagt ut på
        siden. Pågår betyr at en kuratering er i arbeid eller til kontroll, og ingenting av den vises på siden før den
        er godkjent og publisert.
      </p>
      <div className="kurateringsfane__valg">
        <Trinnbryter etikett="Vis fagsidene som er" valg={VISNINGER} verdi={visning} onVelg={setVisning} />
        <Trinnbryter etikett="Sorter etter" valg={SORTERINGER} verdi={sortering} onVelg={setSortering} />
      </div>
      {synlige.length === 0 ? (
        <p className="registerarkiv__tomt">Ingen fagsider her.</p>
      ) : grupper ? (
        grupper.map((g) => (
          <Gruppe key={g.navn} navn={g.navn}>
            <Liste linjer={g.linjer} etikett={g.navn} visGruppe={false} />
          </Gruppe>
        ))
      ) : (
        <Liste linjer={synlige} etikett="Fagsidene" visGruppe />
      )}
    </div>
  )
}

/** Linjene etter stoffgruppen de står først i, i registerets rekkefølge. */
function grupperEtterStoffgruppe(linjer: readonly Kurateringslinje[]): { navn: string; linjer: Kurateringslinje[] }[] {
  const grupper: { navn: string; linjer: Kurateringslinje[] }[] = []
  for (const l of linjer) {
    const siste = grupper.at(-1)
    if (siste?.navn === l.gruppe.navn) siste.linjer.push(l)
    else grupper.push({ navn: l.gruppe.navn, linjer: [l] })
  }
  return grupper
}
