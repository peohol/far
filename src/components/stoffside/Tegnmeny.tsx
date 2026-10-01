import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { medBruktTegn, nyligeTegn, tegngrupper, type Spesialtegn } from '../../faginnhold/spesialtegn'
import { useBobleplassering } from '../Tips'

/** Gruppa man stod i og tegnene man nettopp brukte, i nettleseren. */
const GRUPPENOKKEL = 'far:spesialtegn.gruppe'
const NYLIGENOKKEL = 'far:spesialtegn.nylige'

/** Laget menyen er mens den står åpen (`data-lag`), så appens egne taster ligger i ro. */
const TEGNMENY_LAG = 'tegnmeny'

/** Leser fra nettleserens lagring. Er den sperret, åpner menyen like godt uten. */
function les(nokkel: string): string | null {
  try {
    return localStorage.getItem(nokkel)
  } catch {
    return null
  }
}

/** Skriver til nettleserens lagring. Er den full eller sperret, går valget tapt uten at noen trenger å vite det. */
function skriv(nokkel: string, verdi: string) {
  try {
    localStorage.setItem(nokkel, verdi)
  } catch {
    /* privat nettlesermodus e.l. */
  }
}

function lagredeNylige(): string[] {
  try {
    return nyligeTegn(JSON.parse(les(NYLIGENOKKEL) ?? '[]'))
  } catch {
    return []
  }
}

export interface TegnmenyProps {
  /** Knappen menyen hører til og står ved. */
  anker: HTMLElement
  /** Menyen ble åpnet med tastaturet: fokus går da inn i den. */
  medTastatur: boolean
  /**
   * Setter tegnet inn der markøren står i teksten. `iTeksten` sier om fokus
   * skal til teksten; fra tastaturet blir det i stedet stående i menyen.
   */
  onSett: (tegn: string, iTeksten: boolean) => void
  /** Lukker menyen. `iMenyen` sier om fokus stod i den, så det kan sendes tilbake til teksten. */
  onLukk: (iMenyen: boolean) => void
}

/**
 * Spesialtegnene som en meny ved knappen i verktøyraden, med gruppene fra
 * mdeditz som faner og de sist brukte først.
 *
 * Menyen blir stående etter et trykk: tegnene kommer sjelden ett og ett, og
 * markøren står igjen i teksten, så neste trykk lander der forrige slapp. Det
 * er også derfor «Nylig» ikke tegnes om mens menyen er åpen — rutene ville
 * flyttet seg under fingeren. Med pekeren rører menyen ikke fokus, så markøren
 * blir stående i teksten; åpnet med tastaturet går fokus til fanen som er valgt.
 * Escape og et trykk utenfor lukker den.
 */
export function Tegnmeny({ anker, medTastatur, onSett, onLukk }: TegnmenyProps) {
  const [grupper] = useState(() => tegngrupper(lagredeNylige()))
  const [gruppeId, setGruppeId] = useState(() => {
    const lagret = les(GRUPPENOKKEL)
    return (grupper.find((g) => g.id === lagret) ?? grupper[0])!.id
  })
  const [pekt, setPekt] = useState<Spesialtegn | null>(null)
  const gruppe = grupper.find((g) => g.id === gruppeId) ?? grupper[0]!
  const { boble, innhold, klasser, stil } = useBobleplassering<HTMLDivElement>(anker, gruppeId, 'under')
  const rutenett = useRef<HTMLDivElement>(null)
  const id = useId()

  const lukk = useRef(onLukk)
  lukk.current = onLukk

  // Escape hører til menyen, det innerste laget, også når fokus står i
  // teksten: ellers ville samme tastetrykk lukket vinduet menyen står i.
  useEffect(() => {
    const paaTast = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      lukk.current(boble.current?.contains(document.activeElement) ?? false)
    }
    const paaTrykk = (event: PointerEvent) => {
      const mal = event.target as Node
      if (boble.current?.contains(mal) || anker.contains(mal)) return
      lukk.current(false)
    }
    document.addEventListener('keydown', paaTast, true)
    document.addEventListener('pointerdown', paaTrykk, true)
    return () => {
      document.removeEventListener('keydown', paaTast, true)
      document.removeEventListener('pointerdown', paaTrykk, true)
    }
  }, [anker, boble])

  // Bare når menyen åpnes.
  const forsteTastatur = useRef(medTastatur)
  useEffect(() => {
    if (forsteTastatur.current) boble.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
  }, [boble])

  const velgGruppe = (nyId: string) => {
    setGruppeId(nyId)
    setPekt(null)
    skriv(GRUPPENOKKEL, nyId)
    if (rutenett.current) rutenett.current.scrollTop = 0
  }

  // Piltastene veksler mellom gruppene, slik en fanerad pleier å gjøre.
  const paaFanetast = (event: KeyboardEvent<HTMLDivElement>) => {
    const steg = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!steg) return
    event.preventDefault()
    const fra = grupper.findIndex((g) => g.id === gruppeId)
    const neste = grupper[(fra + steg + grupper.length) % grupper.length]!
    velgGruppe(neste.id)
    requestAnimationFrame(() =>
      boble.current?.querySelector<HTMLElement>(`[data-gruppe="${neste.id}"]`)?.focus(),
    )
  }

  return (
    <div
      ref={boble}
      id={id}
      className={`${klasser} tegnmeny`}
      style={stil}
      role="dialog"
      aria-label="Spesialtegn"
      data-lag={TEGNMENY_LAG}
    >
      <div ref={innhold} className="tipsboble__innhold tegnmeny__innhold">
        <div className="tegnmeny__faner" role="group" aria-label="Grupper" onKeyDown={paaFanetast}>
          {grupper.map((g) => (
            <button
              key={g.id}
              type="button"
              className="tegnmeny__fane"
              data-gruppe={g.id}
              aria-pressed={g.id === gruppe.id}
              // Bare den valgte fanen står i tabulatorrekka, så neste Tab går
              // inn i rutenettet.
              tabIndex={g.id === gruppe.id ? 0 : -1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => velgGruppe(g.id)}
            >
              {g.etikett}
            </button>
          ))}
        </div>
        <div
          ref={rutenett}
          className="tegnmeny__rutenett"
          role="group"
          aria-label={gruppe.etikett}
          onPointerLeave={() => setPekt(null)}
        >
          {gruppe.tegn.map((spesialtegn) => {
            const [tegn, navn] = spesialtegn
            return (
              <button
                key={tegn}
                type="button"
                className="tegnmeny__tegn"
                aria-label={navn}
                title={navn}
                // Markeringen i teksten skal ikke forsvinne av at ruta trykkes.
                onMouseDown={(e) => e.preventDefault()}
                onPointerEnter={() => setPekt(spesialtegn)}
                onFocus={() => setPekt(spesialtegn)}
                onClick={(e) => {
                  skriv(NYLIGENOKKEL, JSON.stringify(medBruktTegn(lagredeNylige(), tegn)))
                  // Kom trykket fra tastaturet (et klikk uten detalj), blir
                  // fokus stående på ruta, så neste tegn kan velges uten å
                  // tabulere seg inn hit på nytt.
                  onSett(tegn, e.detail !== 0)
                }}
              >
                {tegn}
              </button>
            )
          })}
        </div>
        {/* Navnet på tegnet det pekes på, ellers gruppa. Linja står fast, så menyen ikke hopper. */}
        <p className="tegnmeny__navn" aria-hidden="true">
          {pekt?.[1] ?? gruppe.etikett}
        </p>
      </div>
    </div>
  )
}
