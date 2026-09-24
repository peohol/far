import { useState } from 'react'
import type { Publiseringssteg } from '../../faginnhold/analyttside'
import { endredeFelt } from '../../faginnhold/historikk'
import type { Analyttsidedata, Regelsettutgave } from '../../faginnhold/lesing'
import { lesKinetikk, panelFor } from '../../faginnhold/paneler'
import { losRegelsett } from '../../regler/kommentarer'
import { regelsettfelterMedTekst } from '../regler/Fortolkningsregler'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Modallag } from '../Modallag'
import { Toppmenyknapp } from '../toppmeny/Toppmenyknapp'

export interface RedigeringshandlingerProps {
  data: Analyttsidedata
  publisertRegelsett: Regelsettutgave | null
  plan: Publiseringssteg[]
  /** Sant mens utkastet hentes etter at redigeringen er slått på. */
  laster: boolean
  onPubliser: () => Promise<void>
  onAvslutt: () => void
}

/**
 * Redigeringsmodusen i toppmenyen (i dokken på smale flater): hva som står
 * upublisert, publiseringen og veien tilbake til lesemodus.
 *
 * Før noe publiseres, vises hva som vil bli synlig for alle, i et eget lag.
 */
export function Redigeringshandlinger({
  data,
  publisertRegelsett,
  plan,
  laster,
  onPubliser,
  onAvslutt,
}: RedigeringshandlingerProps) {
  const [bekrefter, setBekrefter] = useState(false)
  const [publiserer, setPubliserer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [ferdig, setFerdig] = useState(false)
  const status = statustekst(laster, plan.length, ferdig)

  const publiser = async () => {
    setPubliserer(true)
    setFeil(null)
    try {
      await onPubliser()
      setFerdig(true)
      setBekrefter(false)
    } catch (e) {
      setFeil((e as Error).message)
    } finally {
      setPubliserer(false)
    }
  }

  return (
    <>
      <span className="redigeringsstatus" role="status">
        <Ikon navn="edit" storrelse="ui" />
        <span className="kun-skjermleser">
          Redigeringsmodus. Du ser utkastet. Endringene blir synlige for andre først når de publiseres.
        </span>
        {/* På smale flater kan teksten bli kuttet; hele står da som tooltip. */}
        <span className="redigeringsstatus__tekst" title={status}>
          {status}
        </span>
      </span>
      <Toppmenyknapp
        ikon="publish"
        variant="primar"
        disabled={laster || plan.length === 0}
        aria-haspopup="dialog"
        onClick={() => {
          setFeil(null)
          setBekrefter(true)
        }}
      >
        Publiser
      </Toppmenyknapp>
      <Toppmenyknapp ikon="close" aria-pressed="true" onClick={onAvslutt}>
        Avslutt redigering
      </Toppmenyknapp>

      <Modallag
        apen={bekrefter}
        tittel="Publiser endringene"
        ikon="publish"
        onLukk={() => setBekrefter(false)}
      >
        <p className="publisering__ingress">Dette blir publisert og synlig for alle:</p>
        <ul className="publisering__liste">
          {plan.map((steg) => (
            <li key={steg.id}>{beskrivSteg(steg, data, publisertRegelsett)}</li>
          ))}
        </ul>
        {feil && (
          <p className="skjemafeil" role="alert">
            {feil}
          </p>
        )}
        <div className="skjema__knapper">
          <Button variant="subtle" onClick={() => setBekrefter(false)}>
            Avbryt
          </Button>
          <Button className="knapp--kompakt" disabled={publiserer} onClick={() => void publiser()}>
            {publiserer ? 'Publiserer …' : 'Publiser nå'}
          </Button>
        </div>
      </Modallag>
    </>
  )
}

/** Teksten i statuspillen: «Redigerer · utkast med 3 endringer». */
export function statustekst(laster: boolean, antall: number, ferdig: boolean): string {
  if (laster) return 'Henter utkastet …'
  if (antall === 0) return ferdig ? 'Redigerer · alt er publisert' : 'Redigerer · ingen upubliserte endringer'
  return `Redigerer · utkast med ${antall} ${antall === 1 ? 'endring' : 'endringer'}`
}

/**
 * Hva et publiseringssteg gjelder, slik det står i oppsummeringen. For
 * regelsettet står også hva som er endret siden det som er publisert.
 */
export function beskrivSteg(
  steg: Publiseringssteg,
  data: Analyttsidedata,
  publisertRegelsett: Regelsettutgave | null = null,
): string {
  switch (steg.slag) {
    case 'intervallregelsett': {
      const regelsett = data.regelsett
      const navn = `Fortolkningsreglene for ${regelsett?.regelsett.innhold.analyttkode ?? 'koden'}`
      if (!regelsett || !publisertRegelsett) return navn
      const endret = endredeFelt(
        regelsettfelterMedTekst(losRegelsett(publisertRegelsett)),
        regelsettfelterMedTekst(losRegelsett(regelsett)),
      )
      return endret.length > 0 ? `${navn} (${endret.join(', ')})` : navn
    }
    case 'kommentar': {
      const kommentar = data.regelsett?.kommentarer.find((k) => k.id === steg.id)
      return `Kommentar: ${kommentar?.innhold.navn ?? 'en kommentar fortolkningsreglene bruker'}`
    }
    case 'referanse': {
      const referanse = data.referanser.find((r) => r.id === steg.id)
      return `Referanse: ${referanse?.innhold.tittel || referanse?.innhold.forfattere || 'uten tittel'}`
    }
    case 'komponent': {
      const side = data.komponenter.find((k) => k.id === steg.id)
      return `Siden for ${side?.innhold.navn ?? 'en komponent'}`
    }
    case 'infoside':
      return `Siden ${data.infoside?.innhold.navn ?? ''} og kildene for panelene`.replace('  ', ' ')
    case 'laboratorieanalytt':
      return `Analyttkoden ${data.analytt?.innhold.kode ?? ''}`
    case 'innholdselement': {
      const element = data.elementer.find((e) => e.id === steg.id)
      if (!element) return 'Et kort'
      const panel = panelFor(element.innhold.panel)
      const tittel = lesKinetikk(element.innhold.data).tittel
      if (!panel) return tittel ? `Fjernet: ${tittel}` : 'Et fjernet kort'
      return [panel.tittel, tittel].filter(Boolean).join(' › ')
    }
  }
}
