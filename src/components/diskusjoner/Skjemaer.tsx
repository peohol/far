import { useEffect, useId, useState, type FormEvent } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { tomtDokument, type Riktekstdokument } from '../../faginnhold/riktekst'
import { endreKategori, flyttDiskusjonTilSide, hentDiskusjoner, opprettDiskusjon, opprettKategori, type Kategorivalg } from '../../diskusjoner/api'
import {
  KATEGORINAVN_MEST,
  emojiFeil,
  grupper,
  kategorinavnFeil,
  type Diskusjonskategori,
  type Diskusjonsside,
  type Diskusjonssider,
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
 * Hvilken kategori tråden skal i: en på siden, eller en ny, med feltene for
 * den. `valgt` er ID-en, eller {@link NY_KATEGORI}.
 */
function Kategorivelger({
  valgt,
  onVelg,
  ny,
  onNy,
  kategorier,
  visFeil,
  disabled = false,
}: {
  valgt: string
  onVelg: (valgt: string) => void
  ny: Kategoriverdier
  onNy: (ny: Kategoriverdier) => void
  kategorier: readonly Diskusjonskategori[]
  visFeil: boolean
  disabled?: boolean
}) {
  const id = useId()
  return (
    <>
      <div className="felt">
        <label className="felt__merkelapp" htmlFor={id}>
          Kategori
        </label>
        <select id={id} className="felt__inndata" value={valgt} disabled={disabled} onChange={(e) => onVelg(e.target.value)}>
          {kategorier.map((k) => (
            <option key={k.id} value={k.id}>
              {k.emoji} {k.navn}
            </option>
          ))}
          <option value={NY_KATEGORI}>＋ Ny kategori …</option>
        </select>
      </div>
      {valgt === NY_KATEGORI && <Kategorifelter verdier={ny} onEndre={onNy} kategorier={kategorier} visFeil={visFeil} />}
    </>
  )
}

/** Kategorien slik funksjonene i databasen tar den, eller `null` når den nye ikke er gyldig på siden. */
function kategorivalg(valgt: string, ny: Kategoriverdier, kategorier: readonly Diskusjonskategori[]): Kategorivalg | null {
  if (valgt !== NY_KATEGORI) return { id: valgt }
  return kategorinavnFeil(ny.navn, kategorier) || emojiFeil(ny.emoji, kategorier) ? null : ny
}

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
  const tekstId = useId()

  const valgt = kategorier.some((k) => k.id === kategori) ? kategori : NY_KATEGORI

  const lagre = async (event: FormEvent) => {
    event.preventDefault()
    setProvd(true)
    const maal = kategorivalg(valgt, ny, kategorier)
    if (!maal) return
    if (!tittel.trim()) return setFeil('Skriv en overskrift.')
    setLagrer(true)
    setFeil(null)
    try {
      onLagret(await opprettDiskusjon(side, { tittel, tekst: tekstTilLagring(tekst), kategori: maal }))
    } catch (e) {
      setFeil((e as Error).message)
      setLagrer(false)
    }
  }

  return (
    <form className="diskusjonsskjema" onSubmit={(e) => void lagre(e)} noValidate aria-label="Ny tråd">
      <h3 className="diskusjonsskjema__tittel">Ny tråd</h3>
      <Kategorivelger valgt={valgt} onVelg={setKategori} ny={ny} onNy={setNy} kategorier={kategorier} visFeil={provd} />
      <Felt
        merkelapp="Overskrift"
        value={tittel}
        maxLength={TITTEL_MEST}
        autoFocus={valgt !== NY_KATEGORI}
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

/**
 * Flytter tråden til en annen side: en fagside eller fortolkningen av en
 * analytt, i en kategori der eller i en ny. Kommentarene følger med.
 */
export function Flytteskjema({
  id,
  side,
  sider,
  onAvbryt,
  onFlyttet,
}: {
  /** Tråden. */
  id: string
  /** Siden tråden står på nå. */
  side: Diskusjonsside
  sider: Diskusjonssider
  onAvbryt: () => void
  onFlyttet: (til: Diskusjonsside) => void
}) {
  const [til, setTil] = useBevart<Diskusjonsside | ''>(`traad:${id}/flytt/side`, '')
  const [kategori, setKategori] = useBevart<string | null>(`traad:${id}/flytt/kategori`, null)
  const [ny, setNy] = useBevart<Kategoriverdier>(`traad:${id}/flytt/ny-kategori`, { navn: '', emoji: '' })
  // Kategoriene på siden tråden skal til, når de er hentet.
  const [kategorier, setKategorier] = useState<{ side: Diskusjonsside; liste: Diskusjonskategori[] } | null>(null)
  const [provd, setProvd] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const sideId = useId()

  useEffect(() => {
    if (!til) return
    let aktuell = true
    hentDiskusjoner(til).then(
      (oversikt) => aktuell && setKategorier({ side: til, liste: grupper(oversikt).kategorier.map((g) => g.kategori) }),
      () => aktuell && setFeil('Fikk ikke hentet kategoriene på siden.'),
    )
    return () => {
      aktuell = false
    }
  }, [til])

  const hentet = til && kategorier?.side === til ? kategorier.liste : null
  const valgt =
    hentet && (kategori === NY_KATEGORI || hentet.some((k) => k.id === kategori)) ? (kategori as string) : (hentet?.[0]?.id ?? NY_KATEGORI)

  const velgSide = (side: string) => {
    setTil(side as Diskusjonsside | '')
    setKategori(null)
    setProvd(false)
    setFeil(null)
  }

  const flytt = async (event: FormEvent) => {
    event.preventDefault()
    setProvd(true)
    if (!til) return setFeil('Velg siden tråden skal flyttes til.')
    if (!hentet) return
    const maal = kategorivalg(valgt, ny, hentet)
    if (!maal) return
    setLagrer(true)
    setFeil(null)
    try {
      await flyttDiskusjonTilSide(id, til, maal)
      onFlyttet(til)
    } catch (e) {
      setFeil((e as Error).message)
      setLagrer(false)
    }
  }

  const gruppe = (etikett: string, valg: Diskusjonssider['fagsider']) => {
    const andre = valg.filter((v) => v.side !== side)
    return (
      andre.length > 0 && (
        <optgroup label={etikett}>
          {andre.map((v) => (
            <option key={v.side} value={v.side}>
              {v.navn}
            </option>
          ))}
        </optgroup>
      )
    )
  }

  return (
    <form className="diskusjonsskjema diskusjonsskjema--flytt" onSubmit={(e) => void flytt(e)} noValidate aria-label="Flytt tråden">
      <h4 className="diskusjonsskjema__tittel">Flytt til en annen side</h4>
      <div className="felt">
        <label className="felt__merkelapp" htmlFor={sideId}>
          Side
        </label>
        <select id={sideId} className="felt__inndata" value={til} autoFocus disabled={lagrer} onChange={(e) => velgSide(e.target.value)}>
          <option value="" disabled>
            Velg en side …
          </option>
          {gruppe('Fagsider', sider.fagsider)}
          {gruppe('Fortolkning', sider.fortolkninger)}
        </select>
      </div>
      {til && !hentet && !feil && <p className="felt__hjelp">Henter kategoriene …</p>}
      {hentet && (
        <Kategorivelger
          valgt={valgt}
          onVelg={setKategori}
          ny={ny}
          onNy={setNy}
          kategorier={hentet}
          visFeil={provd}
          disabled={lagrer}
        />
      )}
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt} disabled={lagrer}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={lagrer || !hentet}>
          {lagrer ? 'Flytter …' : 'Flytt'}
        </Button>
      </div>
    </form>
  )
}
