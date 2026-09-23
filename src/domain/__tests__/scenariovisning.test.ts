import { describe, expect, it } from 'vitest'
import { RUS_KOMMENTARER, RUS_REGELSETT } from '../rusregelsett'
import { beskrivForhold, beskrivRegelsett, formaterAndel } from '../scenariovisning'

function regelsett(modul: string) {
  const funnet = RUS_REGELSETT.find((r) => r.modul === modul)
  if (!funnet) throw new Error(`ukjent regelsett i testen: ${modul}`)
  return structuredClone(funnet)
}

describe('regelsettet skrevet ut for analyttsiden', () => {
  it('skriver forholdstall og andeler lesbart', () => {
    const [oksazepamandel] = regelsett('diazepamgruppen').forhold
    const [morfinandel] = regelsett('kodeingruppen').forhold
    expect(beskrivForhold(oksazepamandel!)).toBe('OXA / (DIAZ + DMI)')
    expect(beskrivForhold(morfinandel!)).toBe('MOR / KOD')
    expect(formaterAndel(0.1)).toBe('10 %')
    expect(formaterAndel(0.125)).toBe('12,5 %')
    expect(formaterAndel(1 / 3)).toBe('33,33 %')
  })

  it('sorterer scenariene etter hva som er påvist, og skriver vilkårene med grensen i prosent', () => {
    const b = beskrivRegelsett(regelsett('diazepamgruppen'), RUS_KOMMENTARER)
    expect(b.grenser).toEqual([
      { nokkel: 'oksazepamgrense', navn: 'Oksazepam som andel av diazepam + N-desmetyldiazepam', prosent: '10 %' },
    ])
    expect(b.scenarier.map((s) => s.pavist.join('+'))).toEqual([
      'DIAZ',
      'DMI',
      'OXA',
      'DIAZ+DMI',
      'DIAZ+OXA',
      'DMI+OXA',
      'DIAZ+DMI+OXA',
      'DIAZ+DMI+OXA',
    ])
    const [felles, hverForSeg] = b.scenarier.slice(-2)
    expect(felles!.vilkar).toEqual(['OXA / (DIAZ + DMI) ≤ 10 %'])
    expect(hverForSeg!.vilkar).toEqual(['OXA / (DIAZ + DMI) > 10 %'])
    expect(b.scenarier[0]!.ikkePavist).toEqual(['DMI', 'OXA'])
    expect(felles!.utfall).toEqual({
      type: 'kommentarer',
      plasseringer: [
        { rolle: 'hoved', merke: 'Hovedkommentar', tekstnummer: 5, koder: ['DIAZ'] },
        { rolle: 'tillegg', merke: 'Tilleggskommentar', tekstnummer: 6, koder: ['DMI', 'OXA'] },
      ],
      notiser: ['Oksazepam ≤ 10 % av diazepam + N-desmetyldiazepam\n⟶ Felles kommentar for alle tre.'],
    })
  })

  it('nummererer hver tekst én gang, i den rekkefølgen den først brukes, og teller bruken', () => {
    const r = regelsett('diazepamgruppen')
    const b = beskrivRegelsett(r, RUS_KOMMENTARER)
    const brukt = r.scenarier.flatMap((s) => (s.utfall.type === 'kommentarer' ? s.utfall.plasseringer.map((p) => p.kommentar) : []))
    expect(b.tekster.map((t) => t.id).sort()).toEqual([...new Set(brukt)].sort())
    expect(b.tekster[0]).toMatchObject({ id: 'diazepam/hoved', brukesAv: 4 })
    // Oksazepams egen kommentar står i «bare OXA» og tre scenarier til.
    expect(b.tekster.find((t) => t.id === 'oksazepam/hoved')?.brukesAv).toBe(4)
    for (const t of b.tekster) expect(t.tekst).toBe(RUS_KOMMENTARER.get(t.id))
  })

  it('viser gråsonen med grensene flettet inn og følger en endret grense', () => {
    const r = regelsett('kodeingruppen')
    r.parametere[0]!.verdi = 0.25
    const grasone = beskrivRegelsett(r, RUS_KOMMENTARER).scenarier.find((s) => s.scenario.nokkel === 'grasone')!
    expect(grasone.vilkar).toEqual(['MOR / KOD ≥ 25 %', 'MOR / KOD ≤ 100 %'])
    expect(grasone.utfall).toMatchObject({ type: 'manuell', melding: 'Morfin = 25–100 % av kodein. Vurder manuelt.' })
  })
})
