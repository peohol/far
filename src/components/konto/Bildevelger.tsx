import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { AVATAR_STORRELSE } from '@delt/profil'
import { lagAvatar } from '../../auth/bilde'
import { Button } from '../Button'
import { ImageIcon, RotateIcon } from '../icons'

/** Største fil vi tar imot fra disken. Bildet krymper uansett før opplasting. */
const STORSTE_FIL = 15 * 1024 * 1024

export interface BildevelgerProps {
  /** Avataren som vises når ingen redigering pågår. */
  visning: ReactNode
  /** Kalles med det ferdige bildet: kvadratisk WebP, klart til opplasting. */
  onValgt: (bilde: Blob) => void
}

/**
 * Velger og tilpasser profilbildet.
 *
 * Bildet flyttes, zoomes og roteres i en sirkel som viser nøyaktig det som
 * blir lagret. Beskjæring og komprimering skjer i nettleseren, så det er bare
 * det ferdige bildet som sendes videre.
 */
export function Bildevelger({ visning, onValgt }: BildevelgerProps) {
  const filvelger = useRef<HTMLInputElement>(null)
  const [kilde, setKilde] = useState<string | null>(null)
  const [midtpunkt, setMidtpunkt] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotasjon, setRotasjon] = useState(0)
  const [utsnitt, setUtsnitt] = useState<Area | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)

  // Adressen til den valgte fila lever bare så lenge den er i bruk.
  useEffect(() => {
    if (!kilde) return
    return () => URL.revokeObjectURL(kilde)
  }, [kilde])

  const avbryt = useCallback(() => {
    setKilde(null)
    setMidtpunkt({ x: 0, y: 0 })
    setZoom(1)
    setRotasjon(0)
    setUtsnitt(null)
  }, [])

  const velgFil = (hendelse: React.ChangeEvent<HTMLInputElement>) => {
    const fil = hendelse.target.files?.[0]
    // Feltet nullstilles, så den samme fila kan velges om igjen etterpå.
    hendelse.target.value = ''
    if (!fil) return
    if (!fil.type.startsWith('image/')) {
      setFeil('Velg en bildefil.')
      return
    }
    if (fil.size > STORSTE_FIL) {
      setFeil('Bildet er for stort. Velg et mindre bilde.')
      return
    }
    setFeil(null)
    setKilde(URL.createObjectURL(fil))
  }

  const bruk = async () => {
    if (!kilde || !utsnitt) return
    setArbeider(true)
    try {
      onValgt(await lagAvatar(kilde, utsnitt, rotasjon))
      avbryt()
    } catch (aarsak) {
      setFeil(aarsak instanceof Error ? aarsak.message : 'Bildet kunne ikke behandles.')
    } finally {
      setArbeider(false)
    }
  }

  if (!kilde) {
    return (
      <div className="bildevelger">
        <div className="bildevelger__visning">
          {visning}
          <Button variant="subtle" icon={<ImageIcon />} onClick={() => filvelger.current?.click()}>
            Velg profilbilde
          </Button>
        </div>
        <input
          ref={filvelger}
          className="kun-skjermleser"
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={velgFil}
        />
        {feil && (
          <p className="skjemafeil" role="alert">
            {feil}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bildevelger">
      <div className="bildevelger__flate">
        <Cropper
          image={kilde}
          crop={midtpunkt}
          zoom={zoom}
          rotation={rotasjon}
          aspect={1}
          cropShape="round"
          showGrid={false}
          minZoom={1}
          maxZoom={5}
          // Standardoppførselen holder bildet dekkende over sirkelen, slik at
          // resultatet aldri får gjennomsiktige hjørner.
          cropSize={{ width: 220, height: 220 }}
          onCropChange={setMidtpunkt}
          onZoomChange={setZoom}
          onRotationChange={setRotasjon}
          onCropComplete={(_, piksler) => setUtsnitt(piksler)}
        />
      </div>

      <p className="bildevelger__veiledning">
        Dra bildet på plass, og bruk glidebryteren til å zoome. Sirkelen viser hva som blir lagret.
      </p>

      <div className="bildevelger__styring">
        <label className="bildevelger__zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.01}
            value={zoom}
            onChange={(hendelse) => setZoom(Number(hendelse.target.value))}
          />
        </label>
        <Button
          variant="subtle"
          icon={<RotateIcon />}
          onClick={() => setRotasjon((forrige) => (forrige + 90) % 360)}
        >
          Roter
        </Button>
      </div>

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      <div className="bildevelger__knapper">
        <Button onClick={() => void bruk()} disabled={arbeider || !utsnitt}>
          {arbeider ? 'Behandler …' : 'Bruk bildet'}
        </Button>
        <Button variant="subtle" onClick={avbryt}>
          Avbryt
        </Button>
      </div>

      <p className="bildevelger__notis">
        Bildet lagres som {AVATAR_STORRELSE} × {AVATAR_STORRELSE} piksler.
      </p>
    </div>
  )
}
