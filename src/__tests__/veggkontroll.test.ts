/**
 * Regelen som holder innloggingsveggen på plass, prøvd ut.
 *
 * `scripts/kontroller-vegg.mjs` er den varige grensen: den avgjør ved hver
 * bygging hva som får utleveres uten innlogging. Derfor skal den selv være
 * kontrollert — og særlig at den feiler lukket, slik at en modul ingen har
 * tenkt på havner innenfor og ikke utenfor.
 */
import { describe, expect, it } from 'vitest'
// @ts-expect-error - byggeskriptet er vanlig JavaScript uten typer.
import { APNE_MODULER, kontroller } from '../../scripts/kontroller-vegg.mjs'

const KLINISK = 'klinisk-abc123.js'
const APEN = 'index-abc123.js'

/** En åpen pakke satt sammen av de modulene som oppgis. */
function pakke(kilder: string[], innhold = '') {
  return { navn: APEN, kilder: kilder.map((k) => `../../${k}`), innhold }
}

function kjor(apne: ReturnType<typeof pakke>[], beskyttede = [KLINISK]) {
  return kontroller({ beskyttede, apne }).feil as string[]
}

/** Alt som er ført opp som åpent, så bare det som prøves ut skiller seg ut. */
const ALLE_APNE = [...(APNE_MODULER as Map<string, string>).keys()]

describe('egen kode utenfor veggen', () => {
  it('slipper gjennom det som er ført opp som åpent', () => {
    expect(kjor([pakke(ALLE_APNE)])).toEqual([])
  })

  it('stanser en modul som ikke er ført opp, uansett hvor den ligger', () => {
    for (const ny of [
      'src/components/ThcForklaring.tsx',
      'src/hooks/useKommentarflyt.ts',
      'src/nyttOmrade/hvasomhelst.ts',
      'supabase/functions/_delt/noeannet.ts',
    ]) {
      const feil = kjor([pakke([...ALLE_APNE, ny])])
      expect(feil).toHaveLength(1)
      expect(feil[0]).toContain(ny)
    }
  })

  it('stanser en ny modul selv om den ikke inneholder klinisk tekst', () => {
    // Tekstsporene er en ekstra skanse, ikke regelen. Regelen er listen.
    expect(kjor([pakke([...ALLE_APNE, 'src/components/Nykomling.tsx'], 'helt nøytral tekst')]))
      .toHaveLength(1)
  })

  it('bryr seg ikke om moduler hentet inn utenfra', () => {
    expect(kjor([pakke([...ALLE_APNE, 'node_modules/react/index.js'])])).toEqual([])
  })
})

describe('når noe annet er galt med delingen', () => {
  it('feiler når kildekartet mangler, i stedet for å si at veggen står', () => {
    const feil = kjor([{ navn: APEN, kilder: null, innhold: '' } as never])
    expect(feil).toHaveLength(1)
    expect(feil[0]).toContain('Mangler kildekart')
  })

  it('feiler når den kliniske pakken ikke er der', () => {
    expect(kjor([pakke(ALLE_APNE)], []).join(' ')).toContain('0 kliniske pakker')
  })

  it('feiler på klinisk tekst i en åpen pakke', () => {
    const feil = kjor([pakke(ALLE_APNE, 'noe om Referanseområde her')])
    expect(feil).toHaveLength(1)
    expect(feil[0]).toContain('Referanseområde')
  })

  it('sier fra om en oppføring som ikke lenger trengs', () => {
    const feil = kjor([pakke(ALLE_APNE.filter((s) => s !== 'src/auth/bilde.ts'))])
    expect(feil).toHaveLength(1)
    expect(feil[0]).toContain('src/auth/bilde.ts')
  })
})

describe('listen over åpne moduler', () => {
  it('gir en grunn for hver oppføring', () => {
    for (const [sti, grunn] of APNE_MODULER as Map<string, string>) {
      expect(grunn, sti).toMatch(/\S/)
    }
  })
})
