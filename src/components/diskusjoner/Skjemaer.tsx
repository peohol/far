import { useId, useState, type FormEvent } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { tomtDokument, type Riktekstdokument } from '../../faginnhold/riktekst'
import { endreKategori, opprettDiskusjon, opprettKategori } from '../../diskusjoner/api'
import {
  KATEGORINAVN_MEST,
  emojiFeil,
  kategorinavnFeil,
  type Diskusjonskategori,
  type Diskusjonsside,
} from '../../diskusjoner/modell'
import { TITTEL_MEST, tekstTilLagring } from '../../traad/modell'
import { Rikteksteditor } from '../stoffside/Rikteksteditor'
import { Button } from '../Button'
import { Felt } from '../konto/Felt'

/**
 * Emojiene som foreslås for en ny kategori. Alle andre kan skrives inn med
 * tastaturets emojivelger; forslagene sparer den som ikke kjenner den.
 */
const FORSLAG = ['💬', '💊', '🧪', '📈', '⚠️', '🩺', '🧠', '📚', '❓', '💡', '🔬', '📋'] as const

/** Hvordan emojivelgeren åpnes, for dem som ikke vet det. */
const EMOJIHJELP = 'Windows: Win + punktum. Mac: Ctrl + Cmd + mellomrom.'

interface Kategoriverdier {
  navn: string
  emoji: string
}

/**
 * Navnet og emojien til en kategori, med forslag til emojier som ikke er tatt
 * på siden. Feilene vises først når noen har prøvd å lagre.
 */
function Kategorifelter({
  verdier,
  onEndre,
  kategorier,
  unntak,
  visFeil,
  autofokus = false,
}: {
  verdier: Kategoriverdier
  onEndre: (verdier: Kategoriverdier) => void
  kategorier: readonly Diskusjonskategori[]
  /** Kategorien som endres, som får beholde sitt eget navn og sin egen emoji. */
  unntak?: string
  visFeil: boolean
  autofokus?: boolean
}) {
  const navnFeil = visFeil ? kategorinavnFeil(verdier.navn, kategorier, unntak) : null
  const emojiFeilen = visFeil ? emojiFeil(verdier.emoji, kategorier, unntak) : null
  const tatt = new Set(kategorier.filter((k) => k.id !== unntak).map((k) => k.emoji))
  const forslag = FORSLAG.filter((e) => !tatt.has(e))
  const forslagId = useId()

  return (
    <div className="kategorifelter">
      <div className="kategorifelter__rad">
        <Felt
          merkelapp="Emoji"
          className="kategorifelter__emoji"
          value={verdier.emoji}
          maxLength={16}
          autoComplete="off"
          aria-invalid={Boolean(emojiFeilen) || undefined}
          onChange={(e) => onEndre({ ...verdier, emoji: e.target.value.trim() })}
        />
        <Felt
          merkelapp="Kategori"
          value={verdier.navn}
          maxLength={KATEGORINAVN_MEST}
          autoComplete="off"
          autoFocus={autofokus}
          aria-invalid={Boolean(navnFeil) || undefined}
          onChange={(e) => onEndre({ ...verdier, navn: e.target.value })}
        />
      </div>
      {forslag.length > 0 && (
        <div className="emojiforslag" role="group" aria-labelledby={forslagId}>
          <span id={forslagId} className="kun-skjermleser">
            Forslag til emoji
          </span>
          {forslag.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="emojiforslag__valg"
              aria-pressed={verdier.emoji === emoji}
              onClick={() => onEndre({ ...verdier, emoji })}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <p className="felt__hjelp">Andre emojier: {EMOJIHJELP}</p>
      {(emojiFeilen || navnFeil) && (
        <p className="skjemafeil" role="alert">
          {emojiFeilen ?? navnFeil}
        </p>
      )}
    </div>
  )
}

/** En ny kategori, eller nytt navn og ny emoji på en som finnes. */
export function Kategoriskjema({
  side,
  kategori,
  kategorier,
  onAvbryt,
  onLagret,
}: {
  side: Diskusjonsside
  /** Kategorien som endres. Uten: en ny. */
  kategori?: Diskusjonskategori
  kategorier: readonly Diskusjonskategori[]
  onAvbryt: () => void
  onLagret: () => void
}) {
  const [verdier, setVerdier] = useBevart<Kategoriverdier>(`kategori:${kategori?.id ?? 'ny'}`, {
    navn: kategori?.navn ?? '',
    emoji: kategori?.emoji ?? '',
  })
  const [provd, setProvd] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)

  const lagre = async (event: FormEvent) => {
    event.preventDefault()
    setProvd(true)
    if (kategorinavnFeil(verdier.navn, kategorier, kategori?.id) || emojiFeil(verdier.emoji, kategorier, kategori?.id)) return
    setLagrer(true)
    setFeil(null)
    try {
      if (kategori) await endreKategori(kategori.id, verdier.navn, verdier.emoji)
      else await opprettKategori(side, verdier.navn, verdier.emoji)
      onLagret()
    } catch (e) {
      setFeil((e as Error).message)
      setLagrer(false)
    }
  }

  return (
    <form className="diskusjonsskjema" onSubmit={(e) => void lagre(e)} noValidate aria-label={kategori ? 'Endre kategorien' : 'Ny kategori'}>
      <h3 className="diskusjonsskjema__tittel">{kategori ? 'Endre kategorien' : 'Ny kategori'}</h3>
      <Kategorifelter verdier={verdier} onEndre={setVerdier} kategorier={kategorier} unntak={kategori?.id} visFeil={provd} autofokus />
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt} disabled={lagrer}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={lagrer}>
          {lagrer ? 'Lagrer …' : kategori ? 'Lagre' : 'Opprett'}
        </Button>
      </div>
    </form>
  )
}

/** Verdien i kategorivalget som betyr en ny kategori sammen med tråden. */
const NY_KATEGORI = ''

/**
 * En ny tråd: overskrift og første innlegg, som en idé, i en kategori på
 * siden eller i en ny kategori som lages sammen med tråden.
 */
export function Traadskjema({
  side,
  kategori: startkategori,
  kategorier,
  onAvbryt,
  onLagret,
}: {
  side: Diskusjonsside
  /** Kategorien tråden begynner i, fra «Ny tråd» nederst i en kategori. */
  kategori?: string
  kategorier: readonly Diskusjonskategori[]
  onAvbryt: () => void
  onLagret: (id: string) => void
}) {
  const [kategori, setKategori] = useBevart<string>('ny-traad/kategori', startkategori ?? kategorier[0]?.id ?? NY_KATEGORI)
  const [ny, setNy] = useBevart<Kategoriverdier>('ny-traad/ny-kategori', { navn: '', emoji: '' })
  const [tittel, setTittel] = useBevart('ny-traad/tittel', '')
  const [tekst, setTekst] = useBevart<Riktekstdokument>('ny-traad/tekst', tomtDokument)
  const [provd, setProvd] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const kategoriId = useId()
  const tekstId = useId()

  const valgt = kategorier.some((k) => k.id === kategori) ? kategori : NY_KATEGORI
  const nyKategori = valgt === NY_KATEGORI

  const lagre = async (event: FormEvent) => {
    event.preventDefault()
    setProvd(true)
    if (nyKategori && (kategorinavnFeil(ny.navn, kategorier) || emojiFeil(ny.emoji, kategorier))) return
    if (!tittel.trim()) return setFeil('Skriv en overskrift.')
    setLagrer(true)
    setFeil(null)
    try {
      onLagret(
        await opprettDiskusjon(side, {
          tittel,
          tekst: tekstTilLagring(tekst),
          kategori: nyKategori ? ny : { id: valgt },
        }),
      )
    } catch (e) {
      setFeil((e as Error).message)
      setLagrer(false)
    }
  }

  return (
    <form className="diskusjonsskjema" onSubmit={(e) => void lagre(e)} noValidate aria-label="Ny tråd">
      <h3 className="diskusjonsskjema__tittel">Ny tråd</h3>
      <div className="felt">
        <label className="felt__merkelapp" htmlFor={kategoriId}>
          Kategori
        </label>
        <select id={kategoriId} className="felt__inndata" value={valgt} onChange={(e) => setKategori(e.target.value)}>
          {kategorier.map((k) => (
            <option key={k.id} value={k.id}>
              {k.emoji} {k.navn}
            </option>
          ))}
          <option value={NY_KATEGORI}>＋ Ny kategori …</option>
        </select>
      </div>
      {nyKategori && <Kategorifelter verdier={ny} onEndre={setNy} kategorier={kategorier} visFeil={provd} />}
      <Felt
        merkelapp="Overskrift"
        value={tittel}
        maxLength={TITTEL_MEST}
        autoFocus={!nyKategori}
        onChange={(e) => setTittel(e.target.value)}
      />
      <div className="felt">
        <span className="felt__merkelapp" id={tekstId}>
          Innlegg
        </span>
        <Rikteksteditor dokument={tekst} onEndre={setTekst} etikett="Innlegg" referanser={false} kompakt />
      </div>
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt} disabled={lagrer}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={lagrer}>
          {lagrer ? 'Lagrer …' : 'Publiser'}
        </Button>
      </div>
    </form>
  )
}
