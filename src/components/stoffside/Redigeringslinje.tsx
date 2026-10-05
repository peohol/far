import { useState } from 'react'
import type { Publiseringssteg } from '../../faginnhold/stoffside'
import { endredeFelt } from '../../faginnhold/historikk'
import { INGEN_REGLER, TOM_STOFFSIDE, type Regeldata, type Stoffsidedata } from '../../faginnhold/lesing'
import { korttittel, panelFor } from '../../faginnhold/paneler'
import { RUS_MODULER } from '../../domain/rus'
import { losRegelsett } from '../../regler/kommentarer'
import { tilScenarioutkast, utkastfelter } from '../../regler/scenarioredigering'
import { regelsettfelterMedTekst } from '../regler/Fortolkningsregler'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Modallag } from '../Modallag'
import { Toppmenyknapp } from '../toppmeny/Toppmenyknapp'
import { useTips } from '../Tips'

export interface RedigeringshandlingerProps {
  /** Utkastet til stoffsiden, når det er den som redigeres. */
  data?: Stoffsidedata
  /** Utkastet til fortolkningsreglene, når det er dem som redigeres. */
  regler?: Regeldata
  /** Regelsettene slik de er publisert, til å si hva som endres. */
  publisert?: Regeldata
  plan: Publiseringssteg[]
  /** Sant mens utkastet hentes etter at redigeringen er slått på. */
  laster: boolean
  onPubliser: () => Promise<void>
  onAvslutt: () => void
}

/**
 * Redigeringsmodusen i toppmenyen (i dokken på smale flater): hva som står
 * upublisert, publiseringen og veien tilbake til lesemodus. Felles for
 * fagsidene og redigeringen av fortolkningsreglene.
 *
 * Før noe publiseres, vises hva som vil bli synlig for alle, i et eget lag.
 */
export function Redigeringshandlinger({
  data = TOM_STOFFSIDE,
  regler = INGEN_REGLER,
  publisert = INGEN_REGLER,
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
  const antall = laster ? 0 : plan.length
  const tips = useTips(status, { skjermleser: false })

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
      {/* Bare ikonet, så menyen får plass også på smale flater: fargen og
          ringen sier at siden redigeres, tallet hvor mange endringer som
          venter, og hele statusen står som tooltip. */}
      <span className="redigeringsstatus" role="status" {...tips.props}>
        <Ikon navn="edit" storrelse="ui" />
        {antall > 0 && (
          <span className="varselmerke" aria-hidden="true">
            {antall}
          </span>
        )}
        <span className="kun-skjermleser">
          Redigeringsmodus. Du ser utkastet. Endringene blir synlige for andre først når de publiseres.
        </span>
        <span className="kun-skjermleser">{status}</span>
      </span>
      <Toppmenyknapp
        ikon="publish"
        variant="primar"
        avslatt={laster ? status : plan.length === 0 ? INGENTING_A_PUBLISERE : undefined}
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
            <li key={steg.id}>{beskrivSteg(steg, data, regler, publisert)}</li>
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

/** Grunnen til at «Publiser» står avslått når utkastet er likt det publiserte. */
export const INGENTING_A_PUBLISERE = 'Det er ikke noe nytt å publisere'

/** Statusen for redigeringen, som tooltip: «Redigerer · utkast med 3 endringer». */
export function statustekst(laster: boolean, antall: number, ferdig: boolean): string {
  if (laster) return 'Henter utkastet …'
  if (antall === 0) return ferdig ? 'Redigerer · alt er publisert' : 'Redigerer · ingen upubliserte endringer'
  return `Redigerer · utkast med ${antall} ${antall === 1 ? 'endring' : 'endringer'}`
}

/**
 * Hva et publiseringssteg gjelder, slik det står i oppsummeringen. For
 * regelsettene står også hva som er endret siden det som er publisert.
 */
export function beskrivSteg(
  steg: Publiseringssteg,
  data: Stoffsidedata,
  regler: Regeldata = INGEN_REGLER,
  publisert: Regeldata = INGEN_REGLER,
): string {
  const medEndringer = (navn: string, endret: string[] | null) =>
    endret && endret.length > 0 ? `${navn} (${endret.join(', ')})` : navn
  switch (steg.slag) {
    case 'intervallregelsett': {
      const [kode, regelsett] = Object.entries(regler.regelsett).find(([, r]) => r.regelsett.id === steg.id) ?? []
      const forrige = kode ? publisert.regelsett[kode] : undefined
      return medEndringer(
        `Fortolkningsreglene for ${kode ?? 'koden'}`,
        regelsett && forrige
          ? endredeFelt(regelsettfelterMedTekst(losRegelsett(forrige)), regelsettfelterMedTekst(losRegelsett(regelsett)))
          : null,
      )
    }
    case 'scenarioregelsett': {
      const [modul, regelsett] =
        Object.entries(regler.scenarioregelsett).find(([, r]) => r.regelsett.id === steg.id) ?? []
      const forrige = modul ? publisert.scenarioregelsett[modul] : undefined
      return medEndringer(
        `Fortolkningsreglene for ${RUS_MODULER.find((m) => m.id === modul)?.navn ?? 'modulen'}`,
        regelsett && forrige
          ? endredeFelt(utkastfelter(tilScenarioutkast(forrige)), utkastfelter(tilScenarioutkast(regelsett)))
          : null,
      )
    }
    case 'thc_regelsett':
      return 'Fortolkningsreglene for THC-syre i urin'
    case 'kommentar': {
      const kommentar = [
        ...Object.values(regler.regelsett),
        ...Object.values(regler.scenarioregelsett),
        ...(regler.thcregelsett ? [regler.thcregelsett] : []),
      ]
        .flatMap((r) => r.kommentarer)
        .find((k) => k.id === steg.id)
      return `Kommentar: ${kommentar?.innhold.navn ?? 'en kommentar fortolkningsreglene bruker'}`
    }
    case 'referanse': {
      const referanse = data.referanser.find((r) => r.id === steg.id)
      return `Referanse: ${referanse?.innhold.tittel || referanse?.innhold.forfattere || 'uten tittel'}`
    }
    case 'infoside':
      return `Siden ${data.infoside?.innhold.navn ?? ''} og kildene for panelene`.replace('  ', ' ')
    case 'innholdselement': {
      const element = data.elementer.find((e) => e.id === steg.id)
      if (!element) return 'Et kort'
      const panel = panelFor(element.innhold.panel)
      const tittel = korttittel(element.innhold.elementtype, element.innhold.data)
      if (!panel) return tittel ? `Fjernet: ${tittel}` : 'Et fjernet kort'
      return [panel.tittel, tittel].filter(Boolean).join(' › ')
    }
  }
}
