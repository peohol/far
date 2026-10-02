import { useEffect, useId, useRef, type ReactNode } from 'react'
import { stoffadresse } from '../../domain/rute'
import { ANDRE_STOFFER_ID, type Registerkategori, type Registerstoff } from '../../domain/stoffregister'
import { antall, forhandsvisning, ramsOpp } from '../../faginnhold/oppsummering'
import { useLukkMedEscape } from '../../hooks/useLukkMedEscape'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import { useStoffregisterkilde, type Stoffregisterkilde } from '../../stoffregister/Stoffregisterkilde'
import { kanSletteKategori, kanSletteStoff } from '../../stoffregister/modell'
import { Button } from '../Button'
import { Ikonknapp } from '../Ikonknapp'
import { Lukkeknapp } from '../Lukkeknapp'
import { Seksjon } from '../seksjoner/Seksjon'
import { SeksjonsstyringKilde } from '../seksjoner/Seksjonsstyring'
import { Skuffrutenett } from '../seksjoner/Skuffrutenett'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import { Toppmenyknapp } from '../toppmeny/Toppmenyknapp'
import { Bekreftknapp, Idehandling, Slettknapp, Tidspunkt } from '../traad/Smadeler'
import { kategoriikon } from '../ikon/register'
import { PAPIRKURVDAGER, slettesForGodt } from './papirkurv'
import { Redigeringsbrett } from './Redigeringsbrett'
import { Registerhandlingskilde, useRegisterhandling } from './Registerhandling'
import { Stoffkort, type Stoffkortvalg } from './Stoffkort'
import '../../styles/monograf-topp.css'

export interface StoffregistersideProps extends Stoffkortvalg {
  /** Tilbake til fortolkningen slik den sto. */
  onLukk: () => void
}

/**
 * Helsiden for stoffregisteret (`#/stoffregister`): hele registeret, med sine
 * egne diskusjoner, og stedet det redigeres.
 *
 * Den er bygd som fagsidene: en seksjon per kategori, med underkategoriene som
 * mellomtitler, og et detaljkort per stoff (`Stoffkort`). Sidemenyen og
 * helsiden viser det samme registeret, fra den samme kilden.
 *
 * «Rediger» bytter til redigeringen (`Redigeringsbrett`): kategoriene og
 * underkategoriene kan lages, gis nytt navn, flyttes, arkiveres og slettes,
 * og stoffene dras mellom dem. Nederst står arkivet, og for administratorer
 * papirkurven.
 *
 * Tastene: `Escape` lukker siden.
 */
export function Stoffregisterside(props: StoffregistersideProps) {
  useLukkMedEscape(props.onLukk)
  return (
    <Bevaringsomrade navn="stoffregister">
      <Registerhandlingskilde>
        <Innhold {...props} />
      </Registerhandlingskilde>
    </Bevaringsomrade>
  )
}

function Innhold({ katalog, onApneFortolkning, onLukk }: StoffregistersideProps) {
  const kilde = useStoffregisterkilde()
  const [modus, setModus] = useBevart<'lese' | 'rediger'>('modus', 'lese')
  const overskrift = useId()

  useEffect(() => {
    const forrige = document.title
    document.title = 'Stoffregister – OUSFAR'
    return () => {
      document.title = forrige
    }
  }, [])
  // Siden begynner øverst, med fokus på tittelen, som en fagside.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.getElementById(overskrift)?.focus({ preventScroll: true })
  }, [overskrift])

  if (!kilde) return null
  const { register } = kilde
  const redigerer = modus === 'rediger'
  const ekte = register.kategorier.filter((k) => k.id !== ANDRE_STOFFER_ID)

  return (
    <section className="stoffregisterside" aria-labelledby={overskrift} data-modus={modus}>
      <ToppmenyInnhold spor="handlinger">
        {redigerer ? (
          <Toppmenyknapp ikon="done" variant="primar" onClick={() => setModus('lese')}>
            Ferdig
          </Toppmenyknapp>
        ) : (
          <Ikonknapp ikon="edit" etikett="Rediger stoffregisteret" aria-pressed="false" onClick={() => setModus('rediger')} />
        )}
        <Lukkeknapp onLukk={onLukk} />
      </ToppmenyInnhold>

      <header className="stoffregisterside__topp">
        <h1 id={overskrift} className="identitet__navn" tabIndex={-1}>
          Stoffregister
        </h1>
        {register.lastet && (
          <p className="metalinje">
            {antall(register.stoffer.length, 'stoff', 'stoffer')} i {antall(ekte.length, 'kategori', 'kategorier')}
          </p>
        )}
        {redigerer && (
          <p className="stoffregisterside__hjelp">
            Dra kategoriene i overskriften og stoffene hvor som helst dit de skal stå, eller bruk mellomrom og
            piltastene. Menyen til høyre på hver av dem har resten: nytt navn, flytting, arkivering og sletting.
            Stoffene står alltid alfabetisk. Endringene lagres med en gang.
          </p>
        )}
      </header>

      {kilde.feil && (
        <div className="sidevarsel" role="alert">
          <p>Fikk ikke hentet stoffregisteret. {kilde.feil}</p>
          <Button variant="subtle" onClick={kilde.hentPaNytt}>
            Prøv igjen
          </Button>
        </div>
      )}
      {!register.lastet && !kilde.feil && <p className="stoffregisterside__laster">Henter stoffregisteret …</p>}

      {register.lastet && (
        <SeksjonsstyringKilde bevares>
          {redigerer ? (
            <Redigeringsbrett />
          ) : (
            <div className="stoffregisterside__kategorier">
              {register.kategorier.map((k) => (
                <Kategoriseksjon key={k.id} kategori={k} katalog={katalog} onApneFortolkning={onApneFortolkning} />
              ))}
            </div>
          )}
          <Arkiv kilde={kilde} />
          {kilde.admin && <Papirkurv kilde={kilde} />}
        </SeksjonsstyringKilde>
      )}
    </section>
  )
}

/** Én kategori: stoffene direkte i den, og underkategoriene med mellomtittel. */
function Kategoriseksjon({ kategori, ...valg }: Stoffkortvalg & { kategori: Registerkategori }) {
  const oppsummering = ramsOpp([
    antall(kategori.stoffer.length, 'stoff', 'stoffer'),
    forhandsvisning(ramsOpp(kategori.underkategorier.map((u) => u.navn))),
  ])
  return (
    <Seksjon id={kategori.id} tittel={kategori.navn} ikon={kategoriikon(kategori.ikon)} oppsummering={oppsummering}>
      {kategori.direkte.length > 0 && (
        <Stoffrutenett gruppe={kategori.id} stoffer={kategori.direkte} {...valg} />
      )}
      {kategori.underkategorier.map((u) => (
        <Underkategori key={u.id} navn={u.navn}>
          <Stoffrutenett gruppe={u.id} stoffer={u.stoffer} {...valg} />
        </Underkategori>
      ))}
    </Seksjon>
  )
}

function Underkategori({ navn, children }: { navn: string; children: ReactNode }) {
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

function Stoffrutenett({ gruppe, stoffer, ...valg }: Stoffkortvalg & { gruppe: string; stoffer: readonly Registerstoff[] }) {
  return (
    <Skuffrutenett className="stoffkortene">
      {stoffer.map((s) => (
        <li key={s.slug}>
          <Stoffkort id={`${gruppe}.${s.slug}`} stoff={s} {...valg} />
        </li>
      ))}
    </Skuffrutenett>
  )
}

/* --- Arkivet og papirkurven -------------------------------------------------------- */

/** Hvem som gjorde det og når: «Lars Leser · 2. okt.». */
function Hvemnaar({ hvem, iso }: { hvem: string | null; iso: string }) {
  return (
    <span className="registerrad__meta">
      {hvem && <>{hvem} · </>}
      <Tidspunkt iso={iso} />
    </span>
  )
}

/**
 * Det som er arkivert: stoffene og kategoriene. Alle kan hente dem tilbake,
 * og slette det de ellers kunne slettet. En arkivert kategori står utenfor
 * registeret; stoffene i den står i «Andre stoffer» til den hentes tilbake.
 */
function Arkiv({ kilde }: { kilde: Stoffregisterkilde }) {
  const { register, handlinger, admin } = kilde
  const { utfor } = useRegisterhandling()
  const { arkiv, arkiverteKategorier } = register
  const tomt = arkiv.length === 0 && arkiverteKategorier.length === 0
  return (
    <Seksjon
      id="arkiv"
      className="registerarkiv"
      tittel="Arkiv"
      ikon="arkiv"
      oppsummering={
        tomt
          ? 'Ingenting er arkivert'
          : ramsOpp([
              arkiv.length > 0 && antall(arkiv.length, 'stoff', 'stoffer'),
              arkiverteKategorier.length > 0 && antall(arkiverteKategorier.length, 'kategori', 'kategorier'),
            ])
      }
    >
      {tomt && <p className="registerarkiv__tomt">Ingenting er arkivert.</p>}
      {arkiv.length > 0 && (
        <ul className="registerliste" aria-label="Arkiverte stoffer">
          {arkiv.map((s) => {
            const slett = kanSletteStoff(s, admin)
            return (
              <li key={s.slug} className="registerrad">
                <a className="registerrad__navn" href={stoffadresse(s.slug)}>
                  {s.navn}
                </a>
                <Hvemnaar hvem={s.endret_av} iso={s.endret_kl} />
                <span className="registerrad__handlinger">
                  <Idehandling
                    ikon="reset"
                    onClick={() =>
                      void utfor(() => handlinger.arkiverStoff(s.slug, false), {
                        melding: `${s.navn} er hentet tilbake.`,
                        angre: () => handlinger.arkiverStoff(s.slug, true),
                      })
                    }
                  >
                    Hent tilbake
                  </Idehandling>
                  {slett.lov && <Slettknapp hva={s.navn} onSlett={() => void utfor(() => handlinger.slettStoff(s.slug))} />}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {arkiverteKategorier.length > 0 && (
        <ul className="registerliste" aria-label="Arkiverte kategorier">
          {arkiverteKategorier.map((k) => {
            const navn = k.forelder ? `${k.forelder} › ${k.navn}` : k.navn
            return (
              <li key={k.id} className="registerrad">
                <span className="registerrad__navn">{navn}</span>
                <span className="registerrad__meta">
                  {antall(k.antall, 'stoff', 'stoffer')} · <Tidspunkt iso={k.arkivert_kl} />
                </span>
                <span className="registerrad__handlinger">
                  <Idehandling ikon="reset" onClick={() => void utfor(() => handlinger.arkiverKategori(k.id, false))}>
                    Hent tilbake
                  </Idehandling>
                  {kanSletteKategori({ stoffer: Array(k.antall) }, admin).lov && (
                    <Slettknapp hva={navn} onSlett={() => void utfor(() => handlinger.slettKategori(k.id))} />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Seksjon>
  )
}

/**
 * Papirkurven, som bare administratorer ser: fagsidene som er slettet. De kan
 * hentes tilbake, eller slettes for godt med en gang; ellers slettes de for
 * godt etter 30 dager. En side noe annet i historikken peker på, blir liggende.
 */
function Papirkurv({ kilde }: { kilde: Stoffregisterkilde }) {
  const { register, handlinger } = kilde
  const { utfor } = useRegisterhandling()
  const { papirkurv } = register
  const tommer = useRef(false)
  const tom = async () => {
    if (tommer.current) return
    tommer.current = true
    const for_ = papirkurv.length
    await utfor(async () => {
      const slettet = await handlinger.tomPapirkurven()
      if (slettet < for_) {
        throw new Error(
          `${antall(slettet, 'fagside', 'fagsider')} ble slettet for godt. ${antall(for_ - slettet, 'fagside', 'fagsider')} ble liggende, fordi noe annet i historikken peker på dem.`,
        )
      }
    })
    tommer.current = false
  }
  return (
    <Seksjon
      id="papirkurv"
      className="registerarkiv"
      tittel="Papirkurv"
      ikon="trash"
      oppsummering={papirkurv.length === 0 ? 'Papirkurven er tom' : antall(papirkurv.length, 'fagside', 'fagsider')}
      handlinger={
        papirkurv.length > 0 && (
          <Bekreftknapp ikon="trash" tekst="Tøm papirkurven" bekreftTekst="Bekreft tømming" onBekreft={() => void tom()} />
        )
      }
    >
      <p className="registerarkiv__hjelp">
        Bare administratorer ser papirkurven. Det som ligger her, slettes for godt etter {PAPIRKURVDAGER} dager.
      </p>
      {papirkurv.length === 0 ? (
        <p className="registerarkiv__tomt">Papirkurven er tom.</p>
      ) : (
        <ul className="registerliste" aria-label="Fagsidene i papirkurven">
          {papirkurv.map((s) => (
            <li key={s.slug} className="registerrad">
              <a className="registerrad__navn" href={stoffadresse(s.slug)}>
                {s.navn}
              </a>
              <span className="registerrad__meta">
                <Hvemnaar hvem={s.endret_av} iso={s.endret_kl} /> · slettes for godt {slettesForGodt(s.endret_kl)}
              </span>
              <span className="registerrad__handlinger">
                <Idehandling ikon="reset" onClick={() => void utfor(() => handlinger.gjenopprettStoff(s.slug))}>
                  Gjenopprett
                </Idehandling>
                <Bekreftknapp
                  ikon="trash"
                  tekst="Slett for godt"
                  bekreftTekst="Bekreft"
                  etikett={`Slett ${s.navn} for godt`}
                  bekreftEtikett={`Bekreft at ${s.navn} slettes for godt`}
                  onBekreft={() => void utfor(() => handlinger.slettStoffForGodt(s.slug))}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Seksjon>
  )
}
