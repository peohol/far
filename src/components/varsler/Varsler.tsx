import { useEffect, useId, useMemo, useState } from 'react'
import { visningsnavn, type Profil } from '@delt/profil'
import { hentAlleProfiler } from '../../auth/api'
import { useProfil } from '../../auth/okt'
import { FORTOLKNINGSSEKSJON, fortolkningsseksjonFor, stoffadresseForAnalytt } from '../../domain/koblinger'
import { stoffadresse } from '../../domain/rute'
import { formaterDato } from '../../domain/versjon'
import {
  VARSELGRUPPER,
  VARSELKATEGORIER,
  aktorer,
  deletekst,
  diskusjonstekst,
  endredeDeler,
  erDiskusjonsvarsel,
  erValgt,
  favorittside,
  favorittsted,
  fortolkningsobjekter,
  idetekst,
  kategorierIGrupper,
  navneliste,
  objekttekst,
  type Databasevarsel,
  type Endringsvarsel,
  type Fortolkningsobjekt,
  type Varsel,
  type Varselgruppe,
} from '../../varsler/modell'
import { Bryter } from '../Bryter'
import { Button } from '../Button'
import { visEndringslogg } from '../endringsloggvisning'
import { visIde } from '../ideer/idevisning'
import { visDiskusjon } from '../diskusjoner/diskusjonsvisning'
import { adresseForSide } from '../../diskusjoner/modell'
import { Tidspunkt } from '../traad/Smadeler'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import { Ikonknapp } from '../Ikonknapp'
import { Modallag } from '../Modallag'
import type { Varselstatus } from './useVarsler'
import '../../styles/varsler.css'

/** Flest publiserte objekter som står i et fortolkningsvarsel før resten telles opp. */
const FLEST_OBJEKTER = 5

type Side = 'liste' | 'innstillinger'

/**
 * Varselvinduet, fra bjella i toppmenyen: varslene brukeren har valgt, de
 * uleste først, og innstillingene for hvilke kategorier som varsles.
 *
 * Et varsel leder dit det gjelder — idéen, tråden i diskusjonene på siden
 * den står på, stoffsiden med reglene eller føringen i endringsloggen — og
 * er lest når man går dit, eller når det merkes lest her.
 */
export function Varsler({ apen, onLukk, status }: { apen: boolean; onLukk: () => void; status: Varselstatus }) {
  const [side, setSide] = useState<Side>('liste')
  const [profiler, setProfiler] = useState<Profil[]>([])
  const { hent } = status

  useEffect(() => {
    if (!apen) return
    setSide('liste')
    hent()
    void hentAlleProfiler().then(setProfiler, () => undefined)
  }, [apen, hent])

  const uleste = status.varsler?.some((v) => !v.lest) ?? false

  return (
    <Modallag
      apen={apen}
      tittel={side === 'liste' ? 'Varsler' : 'Varselinnstillinger'}
      ikon="bell"
      tilbake={side === 'innstillinger' ? { etikett: 'Tilbake til varslene', onTilbake: () => setSide('liste') } : undefined}
      onLukk={onLukk}
      handling={
        side === 'liste' ? (
          <>
            <Button variant="subtle" className="knapp--kompakt" icon={<Ikon navn="done" />} disabled={!uleste} onClick={status.merkAlleLest}>
              Merk alle som lest
            </Button>
            <Ikonknapp ikon="gears" etikett="Varselinnstillinger" variant="stille" utenTips onClick={() => setSide('innstillinger')} />
          </>
        ) : null
      }
    >
      {side === 'liste' ? (
        <Varselliste status={status} profiler={profiler} onLukk={onLukk} />
      ) : (
        <Innstillinger status={status} />
      )}
    </Modallag>
  )
}

function Varselliste({ status, profiler, onLukk }: { status: Varselstatus; profiler: Profil[]; onLukk: () => void }) {
  const meg = useProfil()
  const navn = useMemo(() => {
    const oppslag = new Map([...profiler, meg].map((p) => [p.id, visningsnavn(p)]))
    return (id: string) => oppslag.get(id) ?? 'Ukjent bruker'
  }, [profiler, meg])

  if (status.feil && !status.varsler) {
    return (
      <p className="skjemafeil" role="alert">
        {status.feil}
      </p>
    )
  }
  if (!status.varsler) return <p className="varsler__tom">Henter varslene …</p>
  if (status.varsler.length === 0) return <p className="varsler__tom">Ingen varsler ennå.</p>

  const nye = status.varsler.filter((v) => !v.lest)
  const tidligere = status.varsler.filter((v) => v.lest)

  /** Går dit varselet gjelder: merker det lest og lukker vinduet først. */
  const ga = (varsel: Varsel, videre?: () => void) => {
    status.merkLest(varsel)
    onLukk()
    videre?.()
  }

  const rad = (varsel: Varsel) => (
    <Varselrad key={varsel.id} varsel={varsel} meg={meg.id} navn={navn} onGa={ga} onLest={() => status.merkLest(varsel)} />
  )

  return (
    <div className="varsler">
      {nye.length > 0 && <Varselgruppe tittel="Nye">{nye.map(rad)}</Varselgruppe>}
      {tidligere.length > 0 && <Varselgruppe tittel="Tidligere">{tidligere.map(rad)}</Varselgruppe>}
    </div>
  )
}

function Varselgruppe({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <section className="varselgruppe" aria-labelledby={id}>
      <h3 id={id} className="varselgruppe__navn">
        {tittel}
      </h3>
      <ul className="varselliste">{children}</ul>
    </section>
  )
}

const KATEGORIIKON: Record<Varsel['kategori'], Ikonnavn> = {
  fortolkning: 'interp',
  mine_ideer: 'comment',
  aktive_ideer: 'comment',
  nye_ideer: 'idea',
  funksjonalitet: 'history',
  favoritter: 'star',
  mine_diskusjoner: 'diskusjon',
  aktive_diskusjoner: 'diskusjon',
  favorittdiskusjoner: 'diskusjon',
}

interface RadProps {
  varsel: Varsel
  meg: string
  navn: (id: string) => string
  onGa: (varsel: Varsel, videre?: () => void) => void
  onLest: () => void
}

/** Ett varsel: ikonet for kategorien, hva som har skjedd, når, og «Merk som lest» mens det er ulest. */
function Varselrad(props: RadProps) {
  const { varsel, onLest } = props
  return (
    <li className="varsel" data-ulest={!varsel.lest || undefined} data-kategori={varsel.kategori}>
      <span className="varsel__ikon" aria-hidden="true">
        <Ikon navn={KATEGORIIKON[varsel.kategori]} storrelse="ui" />
      </span>
      <div className="varsel__innhold">
        {varsel.kilde === 'endringslogg' ? <Endringsinnhold {...props} varsel={varsel} /> : <Databaseinnhold {...props} varsel={varsel} />}
      </div>
      {!varsel.lest && (
        <Ikonknapp ikon="done" etikett="Merk som lest" variant="stille" storrelse="liten" utenTips onClick={onLest} />
      )}
    </li>
  )
}

function Endringsinnhold({ varsel, onGa }: RadProps & { varsel: Endringsvarsel }) {
  const { endring } = varsel
  return (
    <>
      <button type="button" className="varsel__tittel" data-ih="" onClick={() => onGa(varsel, () => visEndringslogg(endring.versjon))}>
        {endring.sammendrag}
      </button>
      <p className="varsel__meta">
        {varsel.kategori === 'fortolkning' ? 'Endrer fortolkningen' : 'Ny versjon'} · versjon {endring.versjon} ·{' '}
        <time dateTime={endring.dato}>{formaterDato(endring.dato)}</time>
      </p>
    </>
  )
}

function Databaseinnhold({ varsel, meg, navn, onGa }: RadProps & { varsel: Databasevarsel }) {
  const hvem = navneliste(aktorer(varsel.hendelser).map(navn))
  const tid = <Tidspunkt iso={varsel.oppdatert_kl} />

  if (varsel.kategori === 'fortolkning') {
    const objekter = fortolkningsobjekter(varsel)
    const resten = objekter.length - FLEST_OBJEKTER
    return (
      <>
        <p className="varsel__tittel">Fortolkningen er endret</p>
        <ul className="varsel__objekter">
          {objekter.slice(0, FLEST_OBJEKTER).map((objekt) => (
            <li key={objekt.id}>
              <Objektlenke objekt={objekt} onGa={() => onGa(varsel)} />
            </li>
          ))}
          {resten > 0 && <li>og {resten} til</li>}
        </ul>
        <p className="varsel__meta">
          Publisert av {hvem} · {tid}
        </p>
      </>
    )
  }

  if (varsel.kategori === 'favoritter') {
    const side = favorittside(varsel)
    const deler = endredeDeler(varsel)
    const tittel = `${hvem} endret ${side?.navn ?? 'en favorittside'}`
    return (
      <>
        {side ? (
          <a className="varsel__tittel" data-ih="" href={stoffadresse(side.stoff, favorittsted(deler))} onClick={() => onGa(varsel)}>
            {tittel}
          </a>
        ) : (
          <p className="varsel__tittel">{tittel}</p>
        )}
        <p className="varsel__meta">
          {deler.length > 0 && <>{deletekst(deler)} · </>}
          {tid}
        </p>
      </>
    )
  }

  if (erDiskusjonsvarsel(varsel)) {
    const diskusjon = varsel.diskusjon
    const tekst = diskusjonstekst(varsel, meg, navn)
    const kommentarer = varsel.hendelser.filter((h) => h.kommentar).length
    return (
      <>
        {diskusjon ? (
          <a
            className="varsel__tittel"
            data-ih=""
            href={adresseForSide(diskusjon.side)}
            onClick={() => onGa(varsel, () => visDiskusjon(diskusjon.side, diskusjon.id))}
          >
            {tekst}
          </a>
        ) : (
          <p className="varsel__tittel">{tekst}</p>
        )}
        <p className="varsel__meta">
          {diskusjon && <span className="varsel__ide">«{diskusjon.tittel}»</span>}
          {kommentarer > 1 && <> · {kommentarer} kommentarer</>} · {tid}
        </p>
      </>
    )
  }

  const ide = varsel.ide
  const antall = varsel.hendelser.length
  return (
    <>
      <button type="button" className="varsel__tittel" data-ih="" onClick={() => ide && onGa(varsel, () => visIde({ id: ide.id }))}>
        {idetekst(varsel, meg, navn)}
      </button>
      <p className="varsel__meta">
        {ide && <span className="varsel__ide">«{ide.tittel}»</span>}
        {antall > 1 && <> · {antall} kommentarer</>} · {tid}
      </p>
    </>
  )
}

/** Adressen til reglene for en analyttkode på stoffsiden, når koden har en side. */
function regeladresse(kode: string | null): string | undefined {
  return kode ? stoffadresseForAnalytt(kode, [fortolkningsseksjonFor(kode) ?? FORTOLKNINGSSEKSJON]) : undefined
}

function Objektlenke({ objekt, onGa }: { objekt: Fortolkningsobjekt; onGa: () => void }) {
  const tekst = objekttekst(objekt)
  const adresse = regeladresse(objekt.analyttkode)
  return adresse ? (
    <a className="varsel__lenke" href={adresse} onClick={onGa}>
      {tekst}
    </a>
  ) : (
    <span>{tekst}</span>
  )
}

const GRUPPEIKON: Record<Varselgruppe, Ikonnavn> = {
  fortolkning: 'interp',
  ideer: 'idea',
  diskusjoner: 'diskusjon',
  favoritter: 'star',
  appen: 'history',
}

/**
 * Hvilke kategorier brukeren får varsel om, gruppert etter hva de gjelder,
 * med ikon og overskrift. De obligatoriske står på og kan ikke slås av.
 */
function Innstillinger({ status }: { status: Varselstatus }) {
  return (
    <div className="varselinnstillinger">
      <p className="varselinnstillinger__ingress">Velg hva du vil få varsel om. Endringer i fortolkningen og svar til deg får alle.</p>
      {kategorierIGrupper().map(({ gruppe, kategorier }) => (
        <Innstillingsgruppe key={gruppe} gruppe={gruppe}>
          {kategorier.map((kategori) => {
            const { tittel, forklaring, obligatorisk } = VARSELKATEGORIER[kategori]
            return (
              <li key={kategori} className="varselinnstilling">
                <Bryter pa={erValgt(kategori, status.valg)} laast={obligatorisk} onEndre={(pa) => status.endreValg(kategori, pa)}>
                  <span className="varselinnstilling__tittel">{tittel}</span>
                  <span className="varselinnstilling__forklaring">
                    {forklaring}
                    {obligatorisk && ' Kan ikke slås av.'}
                  </span>
                </Bryter>
              </li>
            )
          })}
        </Innstillingsgruppe>
      ))}
    </div>
  )
}

function Innstillingsgruppe({ gruppe, children }: { gruppe: Varselgruppe; children: React.ReactNode }) {
  const id = useId()
  return (
    <section className="varselinnstillinger__gruppe" aria-labelledby={id}>
      <h3 id={id} className="varselinnstillinger__overskrift">
        <span className="varselinnstillinger__ikon" aria-hidden="true">
          <Ikon navn={GRUPPEIKON[gruppe]} storrelse="ui" />
        </span>
        {VARSELGRUPPER[gruppe].tittel}
      </h3>
      <ul className="varselinnstillinger__liste">{children}</ul>
    </section>
  )
}
