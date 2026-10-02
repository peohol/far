import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { stoffadresse } from '../../domain/rute'
import {
  ANDRE_STOFFER,
  ANDRE_STOFFER_ID,
  type Registerstoff,
  type Registerunderkategori,
  type Stoffregister,
} from '../../domain/stoffregister'
import { antall } from '../../faginnhold/oppsummering'
import { useSortering, type Flytting } from '../../hooks/useSortering'
import { useBevart } from '../../oppdatering/Bevaring'
import { useStoffregisterkilde } from '../../stoffregister/Stoffregisterkilde'
import { erEkteKategori, kanSletteKategori, kanSletteStoff } from '../../stoffregister/modell'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Ikonknapp } from '../Ikonknapp'
import { Felt } from '../konto/Felt'
import { Menyskuff, Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Kategorialternativer } from './Kategorialternativer'
import { kategoriikon } from '../ikon/register'
import { DRA, KATEGORIER, registerveileder, STOFFER, UNDER } from './registerdra'
import { useRegisterhandling } from './Registerhandling'

/** Mellom kategorien og nøkkelen i ID-en et stoff har på brettet: `<kategori>|<nøkkel>`. */
const SKILLE = '|'
/** Foran ID-en til en kategori på brettet. */
const KATEGORI = 'kategori:'

/** Kategorien i databasen, eller `null` for «Andre stoffer», som ikke er noen. */
const iDatabasen = (id: string) => (erEkteKategori(id) ? id : null)

/** En kategori eller underkategori på brettet: stoffene direkte i den, og underkategoriene. */
interface Brettgruppe {
  id: string
  navn: string
  ikon: string | null
  /** Alle stoffene, også dem i underkategoriene. */
  stoffer: readonly Registerstoff[]
  direkte: readonly Registerstoff[]
  underkategorier: readonly Registerunderkategori[]
}

/** Hvilke kategorier som er lukket i redigeringen. */
interface Lukking {
  erLukket: (id: string) => boolean
  veksle: (id: string) => void
  apne: (id: string) => void
}

const Lukkekontekst = createContext<Lukking>({ erLukket: () => false, veksle: () => {}, apne: () => {} })

/**
 * Redigeringen av stoffregisteret på helsiden: kategoriene med
 * underkategoriene og stoffene i dem, alt på ett brett.
 *
 * Hver kategori, underkategori og hvert stoff har en meny (`Objektmeny`) med
 * det som kan gjøres med det: gi nytt navn, flytte, arkivere og slette. En
 * kategori kan lukkes, så brettet blir kortere.
 *
 * Det dras med Smett (`useSortering`), med reglene fra Huskis
 * (`registerdra.ts`): kategoriene opp og ned, en underkategori til en annen
 * kategori eller opp som egen kategori, og stoffene mellom kategoriene og
 * underkategoriene. Et stoff som dras til «Andre stoffer», tas ut av
 * kategorien det sto i. Stoffene står alltid alfabetisk, så å dra et stoff
 * innenfor samme liste gjør ingenting.
 *
 * Hver endring lagres med en gang, og vises før databasen har svart.
 */
export function Redigeringsbrett() {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const brett = useRef<HTMLDivElement>(null)
  const [lukkede, setLukkede] = useBevart<string[]>('lukket', [])
  const register = kilde?.register
  const handlinger = kilde?.handlinger

  const apne = useCallback((id: string) => setLukkede((l) => l.filter((x) => x !== id)), [setLukkede])
  const lukking = useMemo<Lukking>(
    () => ({
      erLukket: (id) => lukkede.includes(id),
      veksle: (id) => setLukkede((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])),
      apne,
    }),
    [lukkede, setLukkede, apne],
  )
  const veileder = useMemo(() => registerveileder(() => brett.current, apne), [apne])

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
      const navn = (register && finnGruppe(register, id)?.navn) ?? 'kategorien'
      return liste.startsWith(UNDER) ? `underkategoriene i ${navn}` : navn
    },
    [register],
  )
  useSortering(brett, onFlytt, navnPaaListe, true, { rullInne: false, loddrett: false, handtak: DRA, veileder })

  if (!kilde || !register) return null
  const kategorier = register.inndeling.filter((k) => erEkteKategori(k.id))
  const andre = register.inndeling.find((k) => k.id === ANDRE_STOFFER_ID)
  const alleLukket = kategorier.length > 0 && kategorier.every((k) => lukkede.includes(k.id))

  return (
    <Lukkekontekst.Provider value={lukking}>
      <div className="registerbrett">
        <div className="registerbrett__verktoy">
          <Button
            variant="subtle"
            icon={<Ikon navn="chev" />}
            onClick={() => setLukkede(alleLukket ? [] : kategorier.map((k) => k.id))}
          >
            {alleLukket ? 'Åpne alle' : 'Lukk alle'}
          </Button>
        </div>
        <div ref={brett} className="registerbrett__lister">
          <ol className="brettliste" data-dnd-container={KATEGORIER} data-tar="hovedkategori kategori">
            {kategorier.map((k, i) => (
              <Brettkategori key={k.id} gruppe={k} forelder={null} indeks={i} antallSosken={kategorier.length} />
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
    </Lukkekontekst.Provider>
  )
}

/** Kategorien eller underkategorien med ID-en. */
function finnGruppe(register: Stoffregister, id: string): Brettgruppe | undefined {
  for (const k of register.inndeling) {
    if (k.id === id) return k
    const u = k.underkategorier.find((x) => x.id === id)
    if (u) return { ...u, direkte: u.stoffer, underkategorier: [] }
  }
  return undefined
}

/**
 * En kategori, eller en underkategori i `forelder`: overskriften, som det dras
 * i, og innholdet, som kan lukkes.
 */
function Brettkategori({
  gruppe,
  forelder,
  indeks,
  antallSosken,
}: {
  gruppe: Brettgruppe
  forelder: string | null
  indeks: number
  antallSosken: number
}) {
  const { erLukket, veksle, apne } = useContext(Lukkekontekst)
  const [nyUnder, setNyUnder] = useBevart(`ny-under:${gruppe.id}`, false)
  const [endrer, setEndrer] = useBevart(`endre:${gruppe.id}`, false)
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const innhold = useId()
  if (!kilde) return null
  const lukket = erLukket(gruppe.id)
  const underkategorier = gruppe.underkategorier.map((u) => ({ ...u, direkte: u.stoffer, underkategorier: [] }))
  const Overskrift = forelder ? 'h4' : 'h3'
  const ikon = forelder ? undefined : kategoriikon(gruppe.ikon)

  return (
    <li
      className={['brettkategori', forelder && 'brettkategori--under'].filter(Boolean).join(' ')}
      data-dnd-id={`${KATEGORI}${gruppe.id}`}
      // En kategori med underkategorier kan ikke selv bli en underkategori.
      data-slag={gruppe.underkategorier.length > 0 ? 'hovedkategori' : 'kategori'}
      data-navn={gruppe.navn}
      data-kategori={gruppe.id}
      data-lukket={lukket || undefined}
    >
      <div className="brettkategori__hode" data-dra="">
        <Ikonknapp
          ikon="chev"
          etikett={`${lukket ? 'Vis' : 'Skjul'} innholdet i ${gruppe.navn}`}
          variant="stille"
          storrelse="liten"
          className="brettkategori__pil"
          aria-expanded={!lukket}
          aria-controls={innhold}
          utenTips
          onClick={() => veksle(gruppe.id)}
        />
        {ikon && <Ikon navn={ikon} storrelse="ui" className="brettkategori__ikon" />}
        {endrer ? (
          <Navneskjema
            merkelapp={`Nytt navn på ${gruppe.navn}`}
            start={gruppe.navn}
            knapp="Lagre"
            onAvbryt={() => setEndrer(false)}
            onLagre={async (nytt) => {
              if (nytt !== gruppe.navn && !(await utfor(() => kilde.handlinger.endreKategori(gruppe.id, nytt)))) return
              setEndrer(false)
            }}
          />
        ) : (
          <Overskrift className="brettkategori__navn">{gruppe.navn}</Overskrift>
        )}
        <span className="brettkategori__antall">{antall(gruppe.stoffer.length, 'stoff', 'stoffer')}</span>
        {!endrer && (
          <Kategorimeny
            gruppe={gruppe}
            forelder={forelder}
            indeks={indeks}
            antallSosken={antallSosken}
            onEndreNavn={() => setEndrer(true)}
            onNyUnderkategori={
              forelder
                ? undefined
                : () => {
                    apne(gruppe.id)
                    setNyUnder(true)
                  }
            }
          />
        )}
      </div>
      <div id={innhold} className="brettkategori__kropp">
        <Brettstoffer kategori={gruppe.id} navn={gruppe.navn} stoffer={gruppe.direkte} />
        {!forelder && (
          <ol className="brettliste brettliste--under" data-dnd-container={`${UNDER}${gruppe.id}`} data-tar="kategori">
            {underkategorier.map((u, i) => (
              <Brettkategori key={u.id} gruppe={u} forelder={gruppe.id} indeks={i} antallSosken={underkategorier.length} />
            ))}
          </ol>
        )}
        {nyUnder && <Nykategori forelder={gruppe.id} onFerdig={() => setNyUnder(false)} />}
      </div>
    </li>
  )
}

/**
 * Stoffene i en kategori, underkategori eller «Andre stoffer», alfabetisk, i
 * et rutenett. En tom liste står likevel, så noe kan slippes i den.
 */
function Brettstoffer({ kategori, navn, stoffer }: { kategori: string; navn: string; stoffer: readonly Registerstoff[] }) {
  return (
    <ul
      className="brettstoffer"
      data-dnd-container={`${STOFFER}${kategori}`}
      data-tar="stoff"
      data-alfabetisk=""
      aria-label={`Stoffene i ${navn}`}
    >
      {stoffer.map((s) => (
        <li key={s.slug} className="brettstoff" data-dnd-id={`${kategori}${SKILLE}${s.slug}`} data-slag="stoff" data-navn={s.navn} data-dra="">
          <span className="brettstoff__navn">{s.navn}</span>
          <Stoffmeny stoff={s} kategori={kategori} />
        </li>
      ))}
    </ul>
  )
}

/* --- Menyene ------------------------------------------------------------------------ */

/**
 * Menyknappen til høyre på en kategori, en underkategori eller et stoff, med
 * det som kan gjøres med det. Innholdet tegnes først når menyen åpnes, og et
 * trykk i den løfter aldri det den står på.
 */
function Objektmeny({ navn, children }: { navn: string; children: (lukk: () => void) => ReactNode }) {
  return (
    <div className="objektmeny" data-dnd-ignore="">
      <Nedtrekksmeny
        knapp={{ ikon: 'more', etikett: `Mer for ${navn}`, variant: 'stille', storrelse: 'liten', utenTips: true }}
        etikett={`Mer for ${navn}`}
        lag="objektmeny"
        lat
      >
        {(lukk) => <ul className="nedtrekk__valg">{children(lukk)}</ul>}
      </Nedtrekksmeny>
    </div>
  )
}

/** Et valg som må trykkes to ganger, for det som ikke kan angres: «Slett» og så «Bekreft sletting». */
function Bekreftvalg({ tekst, bekreftTekst, onBekreft }: { tekst: string; bekreftTekst: string; onBekreft: () => void }) {
  const [bekrefter, setBekrefter] = useState(false)
  return (
    <li>
      <Menyvalg ikon="trash" tekst={bekrefter ? bekreftTekst : tekst} onClick={() => (bekrefter ? onBekreft() : setBekrefter(true))} />
    </li>
  )
}

/** Kategoriene og underkategoriene som valg, utenom `utenom`. */
function Kategoriknapper({
  register,
  utenom,
  onVelg,
}: {
  register: Stoffregister
  utenom: ReadonlySet<string>
  onVelg: (id: string) => void
}) {
  const valg = register.inndeling
    .filter((k) => erEkteKategori(k.id))
    .flatMap((k) => [
      { id: k.id, navn: k.navn, under: false },
      ...k.underkategorier.map((u) => ({ id: u.id, navn: u.navn, under: true })),
    ])
    .filter((v) => !utenom.has(v.id))
  if (valg.length === 0) return <p className="objektmeny__tomt">Ingen andre kategorier.</p>
  return (
    <ul className="objektmeny__kategorier">
      {valg.map((v) => (
        <li key={v.id}>
          <button type="button" className={['objektmeny__kategori', v.under && 'objektmeny__kategori--under'].filter(Boolean).join(' ')} onClick={() => onVelg(v.id)}>
            {v.navn}
          </button>
        </li>
      ))}
    </ul>
  )
}

function Kategorimeny({
  gruppe,
  forelder,
  indeks,
  antallSosken,
  onEndreNavn,
  onNyUnderkategori,
}: {
  gruppe: Brettgruppe
  forelder: string | null
  indeks: number
  antallSosken: number
  onEndreNavn: () => void
  onNyUnderkategori?: () => void
}) {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const [flytter, setFlytter] = useState(false)
  if (!kilde) return null
  const { register, handlinger, admin } = kilde
  const { id, navn } = gruppe
  const slett = kanSletteKategori({ stoffer: [...gruppe.stoffer] }, admin)
  const flytt = (til: string | null, plass: number) => void utfor(() => handlinger.flyttKategori(id, til, plass))
  const toppkategorier = register.inndeling.filter((k) => erEkteKategori(k.id))
  // En kategori med underkategorier kan bare stå øverst.
  const kanFlyttesInn = gruppe.underkategorier.length === 0
  const nyeForeldre = kanFlyttesInn ? toppkategorier.filter((k) => k.id !== id && k.id !== forelder) : []

  return (
    <Objektmeny navn={navn}>
      {(lukk) => {
        const gjor = (handling: () => void) => () => {
          lukk()
          handling()
        }
        return (
          <>
            <li>
              <Menyvalg ikon="edit" tekst="Gi nytt navn" onClick={gjor(onEndreNavn)} />
            </li>
            {onNyUnderkategori && (
              <li>
                <Menyvalg ikon="plus" tekst="Ny underkategori" onClick={gjor(onNyUnderkategori)} />
              </li>
            )}
            {indeks > 0 && (
              <li>
                <Menyvalg ikon="opp" tekst="Flytt opp" onClick={gjor(() => flytt(forelder, indeks - 1))} />
              </li>
            )}
            {indeks < antallSosken - 1 && (
              <li>
                <Menyvalg ikon="ned" tekst="Flytt ned" onClick={gjor(() => flytt(forelder, indeks + 1))} />
              </li>
            )}
            {(forelder || nyeForeldre.length > 0) && (
              <Menyskuff ikon="stoffregister" tekst="Flytt til" apen={flytter} onVeksle={() => setFlytter((a) => !a)}>
                <ul className="objektmeny__kategorier">
                  {forelder && (
                    <li>
                      <button type="button" className="objektmeny__kategori" onClick={gjor(() => flytt(null, toppkategorier.length))}>
                        Egen kategori
                      </button>
                    </li>
                  )}
                  {nyeForeldre.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        className="objektmeny__kategori"
                        onClick={gjor(() => flytt(k.id, k.underkategorier.length))}
                      >
                        Under {k.navn}
                      </button>
                    </li>
                  ))}
                </ul>
              </Menyskuff>
            )}
            <li>
              <Menyvalg
                ikon="arkiv"
                tekst="Arkiver"
                onClick={gjor(
                  () =>
                    void utfor(() => handlinger.arkiverKategori(id, true), {
                      melding: `${navn} er arkivert.`,
                      angre: () => handlinger.arkiverKategori(id, false),
                    }),
                )}
              />
            </li>
            {slett.lov && (
              <Bekreftvalg
                tekst="Slett"
                bekreftTekst="Bekreft sletting"
                onBekreft={gjor(() => void utfor(() => handlinger.slettKategori(id)))}
              />
            )}
          </>
        )
      }}
    </Objektmeny>
  )
}

function Stoffmeny({ stoff, kategori }: { stoff: Registerstoff; kategori: string }) {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const [skuff, setSkuff] = useState<'flytt' | 'legg-til' | null>(null)
  if (!kilde) return null
  const { register, handlinger, admin } = kilde
  const fra = iDatabasen(kategori)
  const har = new Set(register.plasseringerFor(stoff.slug).map((p) => p.id))
  const slett = kanSletteStoff(stoff, admin)
  const veksle = (hvilken: 'flytt' | 'legg-til') => () => setSkuff((s) => (s === hvilken ? null : hvilken))
  const navnPaa = fra && finnGruppe(register, fra)?.navn

  return (
    <Objektmeny navn={stoff.navn}>
      {(lukk) => {
        const gjor = (handling: () => void) => () => {
          lukk()
          handling()
        }
        const plasser = (fraKategori: string | null) => (til: string) =>
          gjor(() => void utfor(() => handlinger.plasserStoff(stoff.slug, fraKategori, til)))()
        return (
          <>
            <li>
              <Menyvalg
                ikon="indik"
                tekst="Åpne fagside"
                onClick={gjor(() => {
                  window.location.hash = stoffadresse(stoff.slug)
                })}
              />
            </li>
            <Menyskuff ikon="stoffregister" tekst="Flytt til" apen={skuff === 'flytt'} onVeksle={veksle('flytt')}>
              <Kategoriknapper register={register} utenom={har} onVelg={plasser(fra)} />
            </Menyskuff>
            {fra && (
              <Menyskuff ikon="plus" tekst="Legg også til i" apen={skuff === 'legg-til'} onVeksle={veksle('legg-til')}>
                <Kategoriknapper register={register} utenom={har} onVelg={plasser(null)} />
              </Menyskuff>
            )}
            {fra && (
              <li>
                <Menyvalg
                  ikon="close"
                  tekst={`Ta ut av ${navnPaa ?? 'kategorien'}`}
                  onClick={gjor(() => void utfor(() => handlinger.plasserStoff(stoff.slug, fra, null)))}
                />
              </li>
            )}
            <li>
              <Menyvalg
                ikon="arkiv"
                tekst="Arkiver"
                onClick={gjor(
                  () =>
                    void utfor(() => handlinger.arkiverStoff(stoff.slug, true), {
                      melding: `${stoff.navn} er arkivert.`,
                      angre: () => handlinger.arkiverStoff(stoff.slug, false),
                    }),
                )}
              />
            </li>
            {slett.lov && (
              <li>
                <Menyvalg
                  ikon="trash"
                  tekst="Slett"
                  {...(admin && { hint: 'Til papirkurven' })}
                  // Den som slettet, kan angre det, også uten å se papirkurven.
                  onClick={gjor(
                    () =>
                      void utfor(() => handlinger.slettStoff(stoff.slug), {
                        melding: `${stoff.navn} er slettet.`,
                        angre: () => handlinger.gjenopprettStoff(stoff.slug),
                      }),
                  )}
                />
              </li>
            )}
          </>
        )
      }}
    </Objektmeny>
  )
}

/* --- Skjemaene ---------------------------------------------------------------------- */

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
      data-dnd-ignore=""
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
