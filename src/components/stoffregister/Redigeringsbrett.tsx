import { useCallback, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { stoffadresse } from '../../domain/rute'
import {
  ANDRE_STOFFER,
  ANDRE_STOFFER_ID,
  type Registerkategori,
  type Registerstoff,
  type Registerunderkategori,
} from '../../domain/stoffregister'
import { antall } from '../../faginnhold/oppsummering'
import { HANDTAK, useSortering, type Flytting } from '../../hooks/useSortering'
import { useBevart } from '../../oppdatering/Bevaring'
import { useStoffregisterkilde } from '../../stoffregister/Stoffregisterkilde'
import { erEkteKategori, kanSletteKategori } from '../../stoffregister/modell'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Felt } from '../konto/Felt'
import { Idehandling, Slettknapp } from '../traad/Smadeler'
import { Kategorialternativer } from './Kategorialternativer'
import { kategoriikon, type Ikonnavn } from '../ikon/register'
import { useRegisterhandling } from './Registerhandling'

/** Lista med kategoriene øverst. */
const KATEGORIER = 'kategorier'
/** Lista med underkategoriene i en kategori: `under:<ID>`. */
const UNDER = 'under:'
/** Lista med stoffene i en kategori eller underkategori: `stoffer:<ID>`. */
const STOFFER = 'stoffer:'
/** Mellom kategorien og nøkkelen i ID-en et stoff har på brettet: `<kategori>|<nøkkel>`. */
const SKILLE = '|'
/** Foran ID-en til en kategori på brettet. */
const KATEGORI = 'kategori:'

/** Kategorien i databasen, eller `null` for «Andre stoffer», som ikke er noen. */
const iDatabasen = (id: string) => (erEkteKategori(id) ? id : null)

/**
 * Redigeringen av stoffregisteret på helsiden: kategoriene med
 * underkategoriene og stoffene i dem, alt på ett brett.
 *
 * Det dras med Smett (`useSortering`): kategoriene opp og ned, en
 * underkategori til en annen kategori eller opp som egen kategori, en kategori
 * uten underkategorier inn i en annen, og stoffene mellom kategoriene og
 * underkategoriene. Et stoff som dras til «Andre stoffer», tas ut av kategorien
 * det sto i. Stoffene står alltid alfabetisk, så å dra et stoff innenfor samme
 * liste gjør ingenting. Knappene «Flytt opp» og «Flytt ned» gjør det samme for
 * kategoriene uten å dra; et stoff kan også legges til og tas ut fra kortet
 * sitt.
 *
 * Hver endring lagres med en gang, og vises før databasen har svart.
 */
export function Redigeringsbrett() {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const brett = useRef<HTMLDivElement>(null)
  const register = kilde?.register
  const handlinger = kilde?.handlinger

  const onFlytt = useCallback(
    ({ id, slag, til, indeks }: Flytting) => {
      if (!handlinger) return
      if (slag === 'stoff') {
        const [fra = '', slug = ''] = id.split(SKILLE)
        const maal = til.slice(STOFFER.length)
        if (!til.startsWith(STOFFER) || maal === fra) return
        void utfor(() => handlinger.plasserStoff(slug, iDatabasen(fra), iDatabasen(maal)))
      } else {
        const kategori = id.slice(KATEGORI.length)
        const forelder = til === KATEGORIER ? null : til.startsWith(UNDER) ? til.slice(UNDER.length) : undefined
        if (forelder === undefined) return
        void utfor(() => handlinger.flyttKategori(kategori, forelder, indeks))
      }
    },
    [handlinger, utfor],
  )
  const navnPaaListe = useCallback(
    (liste: string) => {
      if (liste === KATEGORIER) return 'kategoriene'
      const id = liste.slice(liste.indexOf(':') + 1)
      const kategori = register?.inndeling.find((k) => k.id === id)
      const under = register?.inndeling.flatMap((k) => k.underkategorier).find((u) => u.id === id)
      const navn = kategori?.navn ?? under?.navn ?? 'kategorien'
      return liste.startsWith(UNDER) ? `underkategoriene i ${navn}` : navn
    },
    [register],
  )
  useSortering(brett, onFlytt, navnPaaListe, true, { rullInne: false })

  if (!kilde || !register) return null
  const kategorier = register.inndeling.filter((k) => erEkteKategori(k.id))
  const andre = register.inndeling.find((k) => k.id === ANDRE_STOFFER_ID)

  return (
    <div className="registerbrett">
      <div ref={brett} className="registerbrett__lister">
        <ol className="brettliste" data-dnd-container={KATEGORIER} data-tar="hovedkategori kategori">
          {kategorier.map((k, i) => (
            <Brettkategori key={k.id} kategori={k} forste={i === 0} siste={i === kategorier.length - 1} indeks={i} />
          ))}
        </ol>
        {andre && (
          <section className="brettkategori brettkategori--andre" aria-label={ANDRE_STOFFER}>
            <div className="brettkategori__hode">
              <h3 className="brettkategori__navn">{ANDRE_STOFFER}</h3>
              <span className="brettkategori__antall">{antall(andre.stoffer.length, 'stoff', 'stoffer')}</span>
            </div>
            <p className="registerbrett__merknad">Stoffene uten kategori. Dra et stoff hit for å ta det ut av kategorien det står i.</p>
            <Brettstoffer kategori={ANDRE_STOFFER_ID} navn={ANDRE_STOFFER} stoffer={andre.stoffer} />
          </section>
        )}
      </div>
      <Nykategori forelder={null} />
      {kilde.handlinger.opprettStoffside && <Nyfagside />}
    </div>
  )
}

/** En kategori øverst: hodet, stoffene direkte i den og underkategoriene. */
function Brettkategori({
  kategori,
  forste,
  siste,
  indeks,
}: {
  kategori: Registerkategori
  forste: boolean
  siste: boolean
  indeks: number
}) {
  const [nyUnder, setNyUnder] = useBevart(`ny-under:${kategori.id}`, false)
  return (
    <li
      className="brettkategori"
      data-dnd-id={`${KATEGORI}${kategori.id}`}
      // En kategori med underkategorier kan ikke selv bli en underkategori.
      data-slag={kategori.underkategorier.length > 0 ? 'hovedkategori' : 'kategori'}
      data-navn={kategori.navn}
    >
      <Kategorihode
        id={kategori.id}
        forelder={null}
        navn={kategori.navn}
        ikon={kategoriikon(kategori.ikon)}
        antallStoffer={kategori.stoffer.length}
        forste={forste}
        siste={siste}
        indeks={indeks}
        ekstra={
          <Idehandling ikon="plus" aria-expanded={nyUnder} onClick={() => setNyUnder((a) => !a)}>
            Ny underkategori
          </Idehandling>
        }
      />
      <Brettstoffer kategori={kategori.id} navn={kategori.navn} stoffer={kategori.direkte} />
      <ol className="brettliste brettliste--under" data-dnd-container={`${UNDER}${kategori.id}`} data-tar="kategori">
        {kategori.underkategorier.map((u, i) => (
          <Brettunderkategori
            key={u.id}
            underkategori={u}
            forelder={kategori.id}
            forste={i === 0}
            siste={i === kategori.underkategorier.length - 1}
            indeks={i}
          />
        ))}
      </ol>
      {nyUnder && <Nykategori forelder={kategori.id} onFerdig={() => setNyUnder(false)} />}
    </li>
  )
}

function Brettunderkategori({
  underkategori,
  forelder,
  forste,
  siste,
  indeks,
}: {
  underkategori: Registerunderkategori
  forelder: string
  forste: boolean
  siste: boolean
  indeks: number
}) {
  return (
    <li className="brettkategori brettkategori--under" data-dnd-id={`${KATEGORI}${underkategori.id}`} data-slag="kategori" data-navn={underkategori.navn}>
      <Kategorihode
        id={underkategori.id}
        forelder={forelder}
        navn={underkategori.navn}
        antallStoffer={underkategori.stoffer.length}
        forste={forste}
        siste={siste}
        indeks={indeks}
      />
      <Brettstoffer kategori={underkategori.id} navn={underkategori.navn} stoffer={underkategori.stoffer} />
    </li>
  )
}

/**
 * Hodet på en kategori eller underkategori: håndtaket, navnet (som kan
 * endres), antallet stoffer og handlingene.
 */
function Kategorihode({
  id,
  forelder,
  navn,
  ikon,
  antallStoffer,
  forste,
  siste,
  indeks,
  ekstra,
}: {
  id: string
  forelder: string | null
  navn: string
  ikon?: Ikonnavn
  antallStoffer: number
  forste: boolean
  siste: boolean
  indeks: number
  ekstra?: ReactNode
}) {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const [endrer, setEndrer] = useBevart(`endre:${id}`, false)
  if (!kilde) return null
  const { handlinger, admin } = kilde
  const slett = kanSletteKategori({ stoffer: Array(antallStoffer) }, admin)
  const flytt = (til: number) => void utfor(() => handlinger.flyttKategori(id, forelder, til))
  const Overskrift = forelder ? 'h4' : 'h3'

  return (
    <>
      <div className="brettkategori__hode">
        <span className={HANDTAK.slice(1)} aria-hidden="true" title="Dra for å flytte kategorien">
          <Ikon navn="more" storrelse="ui" />
        </span>
        {ikon && <Ikon navn={ikon} storrelse="ui" className="brettkategori__ikon" />}
        {endrer ? (
          <Navneskjema
            merkelapp={`Nytt navn på ${navn}`}
            start={navn}
            knapp="Lagre"
            onAvbryt={() => setEndrer(false)}
            onLagre={async (nytt) => {
              if (nytt !== navn && !(await utfor(() => handlinger.endreKategori(id, nytt)))) return
              setEndrer(false)
            }}
          />
        ) : (
          <Overskrift className="brettkategori__navn">{navn}</Overskrift>
        )}
        <span className="brettkategori__antall">{antall(antallStoffer, 'stoff', 'stoffer')}</span>
      </div>
      {!endrer && (
        <div className="idehandlinger brettkategori__handlinger">
          <Idehandling ikon="edit" onClick={() => setEndrer(true)}>
            Gi nytt navn
          </Idehandling>
          {!forste && (
            <Idehandling ikon="opp" onClick={() => flytt(indeks - 1)}>
              Flytt opp
            </Idehandling>
          )}
          {!siste && (
            <Idehandling ikon="ned" onClick={() => flytt(indeks + 1)}>
              Flytt ned
            </Idehandling>
          )}
          {ekstra}
          <Idehandling
            ikon="arkiv"
            onClick={() =>
              void utfor(() => handlinger.arkiverKategori(id, true), {
                melding: `${navn} er arkivert.`,
                angre: () => handlinger.arkiverKategori(id, false),
              })
            }
          >
            Arkiver
          </Idehandling>
          {slett.lov && <Slettknapp hva={navn} onSlett={() => void utfor(() => handlinger.slettKategori(id))} />}
        </div>
      )}
    </>
  )
}

/** Stoffene i en kategori, underkategori eller «Andre stoffer», alfabetisk. En tom liste står likevel, så noe kan slippes i den. */
function Brettstoffer({ kategori, navn, stoffer }: { kategori: string; navn: string; stoffer: readonly Registerstoff[] }) {
  return (
    <ul className="brettstoffer" data-dnd-container={`${STOFFER}${kategori}`} data-tar="stoff" aria-label={`Stoffene i ${navn}`}>
      {stoffer.map((s) => (
        <li key={s.slug} className="brettstoff" data-dnd-id={`${kategori}${SKILLE}${s.slug}`} data-slag="stoff" data-navn={s.navn}>
          <span className={HANDTAK.slice(1)} aria-hidden="true" title="Dra for å flytte stoffet">
            <Ikon navn="more" storrelse="ui" />
          </span>
          <a className="brettstoff__navn" href={stoffadresse(s.slug)}>
            {s.navn}
          </a>
          {s.koder.length > 0 && <span className="brettstoff__koder">{s.koder.join(' · ')}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Et navn som skrives inn og lagres: en ny kategori, eller et nytt navn på en. */
function Navneskjema({
  merkelapp,
  start = '',
  knapp,
  onLagre,
  onAvbryt,
}: {
  merkelapp: string
  start?: string
  knapp: string
  onLagre: (navn: string) => Promise<void>
  onAvbryt?: () => void
}) {
  const [navn, setNavn] = useBevart(`navn:${merkelapp}`, start)
  const [lagrer, setLagrer] = useState(false)
  const send = async (e: FormEvent) => {
    e.preventDefault()
    const renset = navn.trim()
    if (!renset || lagrer) return
    setLagrer(true)
    try {
      await onLagre(renset)
      setNavn('')
    } finally {
      setLagrer(false)
    }
  }
  return (
    <form
      className="registerskjema"
      onSubmit={(e) => void send(e)}
      onKeyDown={(e) => {
        // Escape avbryter skjemaet, ikke hele siden.
        if (e.key === 'Escape' && onAvbryt) {
          e.preventDefault()
          e.stopPropagation()
          onAvbryt()
        }
      }}
    >
      <Felt merkelapp={merkelapp} value={navn} maxLength={80} autoFocus={Boolean(onAvbryt)} onChange={(e) => setNavn(e.target.value)} />
      <Button type="submit" variant="kant" disabled={!navn.trim() || lagrer}>
        {lagrer ? 'Lagrer …' : knapp}
      </Button>
      {onAvbryt && (
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
      )}
    </form>
  )
}

/** En ny kategori øverst, sist i registeret, eller en ny underkategori i `forelder`. */
function Nykategori({ forelder, onFerdig }: { forelder: string | null; onFerdig?: () => void }) {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  if (!kilde) return null
  return (
    <Navneskjema
      merkelapp={forelder ? 'Ny underkategori' : 'Ny kategori'}
      knapp="Legg til"
      {...(onFerdig && { onAvbryt: onFerdig })}
      onLagre={async (navn) => {
        if (await utfor(() => kilde.handlinger.opprettKategori(navn, forelder))) onFerdig?.()
      }}
    />
  )
}

/**
 * En ny fagside, for administratorene: navnet, og kategorien den skal stå i.
 * Finnes stoffet alt — etter navnet eller et alias — åpnes siden det har.
 * Ellers lages siden med navnet og en nøkkel av det, og åpnes.
 */
function Nyfagside() {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const [navn, setNavn] = useBevart('ny-fagside', '')
  const [kategori, setKategori] = useBevart('ny-fagside/kategori', '')
  const [lager, setLager] = useState(false)
  const kategoriId = useId()
  const opprett = kilde?.handlinger.opprettStoffside
  if (!kilde || !opprett) return null
  const apne = (slug: string) => {
    setNavn('')
    window.location.hash = stoffadresse(slug)
  }
  const send = async (e: FormEvent) => {
    e.preventDefault()
    const renset = navn.trim()
    if (!renset || lager) return
    const kjent = kilde.register.kanonisk(renset)
    if (kjent) return apne(kjent.slug)
    setLager(true)
    let slug = ''
    const laget = await utfor(async () => {
      slug = await opprett(renset, kategori || null)
    })
    setLager(false)
    if (laget) apne(slug)
  }
  return (
    <form className="registerskjema registerskjema--fagside" onSubmit={(e) => void send(e)}>
      <Felt merkelapp="Ny fagside" value={navn} maxLength={200} onChange={(e) => setNavn(e.target.value)} />
      <div className="felt">
        <label className="felt__merkelapp" htmlFor={kategoriId}>
          Kategori
        </label>
        <select id={kategoriId} className="felt__inndata" value={kategori} onChange={(e) => setKategori(e.target.value)}>
          <option value="">{ANDRE_STOFFER}</option>
          <Kategorialternativer register={kilde.register} />
        </select>
      </div>
      <Button type="submit" variant="kant" disabled={!navn.trim() || lager}>
        {lager ? 'Lager …' : 'Lag fagside'}
      </Button>
    </form>
  )
}
