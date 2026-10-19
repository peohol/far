import { useCallback, useState } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { visningsnavn } from '@delt/profil'
import { useAvatarlenker } from '../../auth/avatarer'
import { useOkt, useProfil } from '../../auth/okt'
import { useShortcutVisibility } from '../../hooks/useShortcutVisibility'
import { SYSTEM, type Bevegelse, type Tema, type Valg, type Valgstyring } from '../../domain/systemvalg'
import { Bryter } from '../Bryter'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import { Trinnbryter, type Trinnvalg } from '../Trinnbryter'
import { Menyskuff, Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Avatar } from './Avatar'
import { Kontopanel } from './Kontopanel'

export interface KontomenyProps {
  tema: Valgstyring<Tema>
  bevegelse: Valgstyring<Bevegelse>
}

/**
 * Det tredje valget på begge bryterne: å la nettleseren og maskinen avgjøre.
 * «Følg system» får ikke plass ved siden av de to andre, og står som «System».
 */
const FOLG_SYSTEM = { verdi: SYSTEM, merke: 'System', navn: 'Følg system' } as const

const TEMAVALG: readonly Trinnvalg<Valg<Tema>>[] = [
  { verdi: 'lyst', merke: 'Lyst', ikon: 'sun' },
  { verdi: 'moerkt', merke: 'Mørkt', ikon: 'moon' },
  { ...FOLG_SYSTEM, ikon: 'skjerm' },
]

const BEVEGELSESVALG: readonly Trinnvalg<Valg<Bevegelse>>[] = [
  { verdi: 'redusert', merke: 'Ja' },
  { verdi: 'full', merke: 'Nei' },
  FOLG_SYSTEM,
]

/**
 * Kontoen, fra avataren helt til høyre i toppmenyen: hvem appen er logget inn
 * som, veien til egen profil, preferansene og utlogging.
 */
export function Kontomeny({ tema, bevegelse }: KontomenyProps) {
  const profil = useProfil()
  const { loggUt } = useOkt()
  const lenker = useAvatarlenker([profil])
  const lenke = profil.avatar_path ? (lenker.get(profil.avatar_path) ?? null) : null
  const navn = visningsnavn(profil)

  const [kontopanel, setKontopanel] = useBevart('kontopanel', false)
  const [preferanser, setPreferanser] = useState(false)
  // Fast identitet: `Modallag` kobler den til lukkehendelsen på dialogen.
  const lukkKontopanel = useCallback(() => setKontopanel(false), [])

  return (
    <>
      <Nedtrekksmeny
        className="kontomeny"
        knapp={{
          ikon: 'user',
          etikett: `Kontoen din – ${navn}`,
          variant: 'aksent',
          className: 'kontomeny__knapp',
          innhold: <Avatar profil={profil} lenke={lenke} storrelse="liten" />,
        }}
        etikett="Konto"
        lag="kontomeny"
        // Neste gang menyen åpnes, står preferansene lukket igjen.
        onApne={() => setPreferanser(false)}
      >
        {(lukk) => (
          <>
            <div className="kontomeny__hode">
              <Avatar profil={profil} lenke={lenke} storrelse="middels" />
              <div className="kontomeny__hvem">
                <span className="kontomeny__navn">{navn}</span>
                <span className="kontomeny__brukernavn">{profil.username}</span>
              </div>
              {profil.role === 'admin' && (
                <span className="kontomeny__merke">
                  <Ikon navn="shield" />
                  Admin
                </span>
              )}
            </div>
            <ul className="nedtrekk__valg">
              <li>
                <Menyvalg
                  ikon="user"
                  tekst="Endre navn og profilbilde"
                  onClick={() => {
                    // Menyen lukkes først, så vinduet gir fokus tilbake til avataren.
                    lukk()
                    setKontopanel(true)
                  }}
                />
              </li>
              <Preferanser
                apen={preferanser}
                onVeksle={() => setPreferanser((a) => !a)}
                tema={tema}
                bevegelse={bevegelse}
              />
              <li>
                <Menyvalg ikon="logout" tekst="Logg ut" onClick={() => void loggUt()} />
              </li>
            </ul>
          </>
        )}
      </Nedtrekksmeny>
      <Kontopanel apen={kontopanel} onLukk={lukkKontopanel} />
    </>
  )
}

/**
 * «Preferanser»: en skuff i menyen med hurtigtastene, temaet og bevegelsen
 * (`Menyskuff`).
 */
function Preferanser({
  apen,
  onVeksle,
  tema,
  bevegelse,
}: {
  apen: boolean
  onVeksle: () => void
} & KontomenyProps) {
  const hurtigtaster = useShortcutVisibility()
  return (
    <Menyskuff ikon="gears" tekst="Preferanser" apen={apen} onVeksle={onVeksle}>
      <Bryter className="nedtrekk__bryter" pa={hurtigtaster.visible} onEndre={hurtigtaster.toggle}>
        <Ikon navn="keys" storrelse="ui" />
        Vis hurtigtaster
      </Bryter>
      <Trevalg ikon="tema" tekst="Tema" valg={TEMAVALG} styring={tema} />
      <Trevalg ikon="bevegelse" tekst="Reduser bevegelse" valg={BEVEGELSESVALG} styring={bevegelse} />
    </Menyskuff>
  )
}

/** Et valg i skuffen med flere enn to muligheter: navnet over, bryteren under. */
function Trevalg<V extends string>({
  ikon,
  tekst,
  valg,
  styring,
}: {
  ikon: Ikonnavn
  tekst: string
  valg: readonly Trinnvalg<Valg<V>>[]
  styring: Valgstyring<V>
}) {
  return (
    <div className="nedtrekk__trinn" data-ih="">
      <span className="nedtrekk__trinnnavn" aria-hidden="true">
        <Ikon navn={ikon} storrelse="ui" />
        {tekst}
      </span>
      <Trinnbryter etikett={tekst} valg={valg} verdi={styring.valg} onVelg={styring.velg} />
    </div>
  )
}
