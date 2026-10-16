import { useMemo, useState } from 'react'
import { tidspunkt } from '../../faginnhold/historikk'
import type { Stoffsidedata } from '../../faginnhold/lesing'
import { ankertekst, ankervalg } from '../../kuratering/anker'
import type { Kurateringsklient } from '../../kuratering/klient'
import { erAktiv, type Grendetaljer, type Traad } from '../../kuratering/modell'
import { useBevart } from '../../oppdatering/Bevaring'
import { Button } from '../Button'
import { Merke } from '../Merke'
import { Modallag } from '../Modallag'

const HANDLINGSTEKST: Record<string, string> = { lukket: 'Lukket', gjenapnet: 'Åpnet igjen' }

/** Antallet åpne tråder, og hvor mange av dem som sperrer. */
export function apneTraader(traader: readonly Traad[] = []): { apne: number; sperrende: number } {
  const apne = traader.filter((t) => t.status === 'apen')
  return { apne: apne.length, sperrende: apne.filter((t) => t.art === 'sperrende').length }
}

/**
 * Kommentartrådene i en gren, for administratorene: hver tråd med det den er
 * festet til (siden, et kort, et felt), om den sperrer og om den venter på
 * kuratoren, og svarene. En administrator kan åpne en ny tråd — også en
 * sperrende — svare, lukke og åpne igjen. Databasen avgjør hva som er lov.
 */
export function Kommentartrader({
  apen,
  gren,
  side,
  klient,
  onEndret,
  onLukk,
}: {
  apen: boolean
  gren: Grendetaljer
  /** Siden i revisjonen som vises, til ankrene. */
  side: Stoffsidedata | null
  klient: Kurateringsklient
  onEndret: () => void
  onLukk: () => void
}) {
  const valg = useMemo(() => (side ? ankervalg(side) : []), [side])
  const traader = gren.traader ?? []
  const aktiv = erAktiv(gren.status)
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)

  const utfor = async (handling: () => Promise<unknown>) => {
    setFeil(null)
    setArbeider(true)
    try {
      await handling()
      onEndret()
      return true
    } catch (e) {
      setFeil(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setArbeider(false)
    }
  }

  return (
    <Modallag apen={apen} tittel="Kommentarer" ikon="comment" bred onLukk={onLukk}>
      {aktiv && <NyTraad valg={valg} arbeider={arbeider} onSend={(k) => utfor(() => klient.kommenter(gren.id, k))} />}
      {feil && (
        <p className="utgavebanner__feil" role="alert">
          {feil}
        </p>
      )}
      {traader.length === 0 ? (
        <p className="utgaveliste__tomt">Ingen kommentarer ennå.</p>
      ) : (
        <ul className="utgaveliste" aria-label="Trådene">
          {traader.map((t) => (
            <li key={t.id}>
              <Traadvisning
                traad={t}
                anker={ankertekst(t.anker, valg)}
                aktiv={aktiv}
                arbeider={arbeider}
                onSvar={(tekst) => utfor(() => klient.kommenter(gren.id, { tekst, svarPa: t.id }))}
                onLukkTraad={() => utfor(() => klient.lukkKommentar(gren.id, t.id))}
                onGjenapne={(tekst) => utfor(() => klient.gjenapneKommentar(gren.id, t.id, tekst))}
              />
            </li>
          ))}
        </ul>
      )}
    </Modallag>
  )
}

function NyTraad({
  valg,
  arbeider,
  onSend,
}: {
  valg: ReturnType<typeof ankervalg>
  arbeider: boolean
  onSend: (k: { tekst: string; art: 'merknad' | 'sperrende'; anker?: { objekt?: string; felt?: string } }) => Promise<boolean>
}) {
  const [objekt, setObjekt] = useBevart('ny:objekt', '')
  const [felt, setFelt] = useBevart('ny:felt', '')
  const [art, setArt] = useBevart<'merknad' | 'sperrende'>('ny:art', 'sperrende')
  const [tekst, setTekst] = useBevart('ny:tekst', '')
  const felter = valg.find((v) => v.objekt === objekt)?.felter ?? []
  return (
    <form
      className="utgavebanner__skjema"
      onSubmit={(e) => {
        e.preventDefault()
        const anker = objekt ? { objekt, ...(felt && { felt }) } : undefined
        void onSend({ tekst: tekst.trim(), art, ...(anker && { anker }) }).then((ok) => {
          if (ok) setTekst('')
        })
      }}
    >
      <div className="utgavebanner__handlinger">
        <label>
          Gjelder{' '}
          <select
            value={objekt}
            onChange={(e) => {
              setObjekt(e.target.value)
              setFelt('')
            }}
          >
            <option value="">Hele grenen</option>
            {valg.map((v) => (
              <option key={v.objekt} value={v.objekt}>
                {v.tittel}
              </option>
            ))}
          </select>
        </label>
        {felter.length > 0 && (
          <label>
            Felt{' '}
            <select value={felt} onChange={(e) => setFelt(e.target.value)}>
              <option value="">Hele kortet</option>
              {felter.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Art{' '}
          <select value={art} onChange={(e) => setArt(e.target.value as 'merknad' | 'sperrende')}>
            <option value="sperrende">Sperrende: må lukkes før publisering</option>
            <option value="merknad">Merknad</option>
          </select>
        </label>
      </div>
      <label>
        Ny kommentar
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} required />
      </label>
      <div className="utgavebanner__handlinger">
        <Button type="submit" disabled={arbeider || !tekst.trim()}>
          Legg inn kommentaren
        </Button>
      </div>
    </form>
  )
}

function Traadvisning({
  traad,
  anker,
  aktiv,
  arbeider,
  onSvar,
  onLukkTraad,
  onGjenapne,
}: {
  traad: Traad
  anker: string
  aktiv: boolean
  arbeider: boolean
  onSvar: (tekst: string) => Promise<boolean>
  onLukkTraad: () => Promise<boolean>
  onGjenapne: (tekst: string) => Promise<boolean>
}) {
  const [svar, setSvar] = useBevart(`svar:${traad.id}`, '')
  const apen = traad.status === 'apen'
  const send = (handling: (tekst: string) => Promise<boolean>) => () =>
    void handling(svar.trim()).then((ok) => {
      if (ok) setSvar('')
    })
  return (
    <section className="utgaveliste__rad" aria-label={`Tråd: ${anker}`}>
      <span className="utgaveliste__hode">
        <Merke tone={traad.art === 'sperrende' ? 'alvorlig' : 'noytral'}>{traad.art === 'sperrende' ? 'Sperrende' : 'Merknad'}</Merke>
        <Merke tone={apen ? 'toksisk' : 'referanse'}>{apen ? 'Åpen' : 'Lukket'}</Merke>
        {anker}
        {traad.venter_pa_kurator && <span className="utgaveliste__meta">venter på kuratoren</span>}
      </span>
      <ol className="utgavebanner__liste">
        {traad.kommentarer.map((k) => (
          <li key={k.id}>
            <span className="utgaveliste__meta">
              {[HANDLINGSTEKST[k.handling], k.av, `revisjon ${k.revisjon}`, tidspunkt(k.kl)].filter(Boolean).join(' · ')}
            </span>
            <p className="utgavebanner__linje">{k.tekst}</p>
          </li>
        ))}
      </ol>
      {aktiv && (
        <div className="utgavebanner__skjema">
          <label>
            Svar
            <textarea value={svar} onChange={(e) => setSvar(e.target.value)} />
          </label>
          <div className="utgavebanner__handlinger">
            {apen && (
              <Button variant="kant" disabled={arbeider || !svar.trim()} onClick={send(onSvar)}>
                Svar
              </Button>
            )}
            {apen ? (
              <Button variant="kant" disabled={arbeider} onClick={() => void onLukkTraad()}>
                Lukk tråden
              </Button>
            ) : (
              <Button variant="kant" disabled={arbeider || !svar.trim()} onClick={send(onGjenapne)}>
                Åpne igjen
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
