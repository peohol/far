import { describe, expect, it } from 'vitest'
import { flyttingMellom, type Rute } from '../flytting'

const rute = (venstre: number, topp: number, bredde: number, hoyde: number): Rute => ({
  venstre,
  topp,
  bredde,
  hoyde,
})

describe('flukten fra båndknappen til kopibeviset', () => {
  it('setter beviset tilbake dit knappen sto', () => {
    // Knappen sto nede til høyre for der beviset lander, og er like stor.
    const flytting = flyttingMellom(rute(480, 620, 160, 48), rute(400, 300, 160, 48))

    expect(flytting).toEqual({ x: 80, y: 320, skala: 1 })
  })

  it('flytter beviset oppover når knappen sto lenger ned', () => {
    // Positiv y er startpunktet: beviset begynner der nede og glir opp på plass.
    expect(flyttingMellom(rute(0, 700, 100, 40), rute(0, 250, 100, 40)).y).toBeGreaterThan(0)
  })

  it('leser skalaen av høyden, som følger skriften', () => {
    // Beviset landet med større skrift enn knappen hadde: 40 mot 80 i høyden
    // er halv skrift, og beviset skal starte i knappens.
    expect(flyttingMellom(rute(0, 0, 120, 40), rute(0, 0, 200, 80)).skala).toBe(0.5)
  })

  it('lar den strukne knappebredden være, så ikonet og tallene ikke spretter', () => {
    // Båndknappene deler bredden i kortet likt og er bredere enn innholdet
    // sitt. Er skriften like stor, skal beviset starte i sin egen bredde,
    // midt i knappen — bare knapperuten trekker seg sammen rundt innholdet.
    const flytting = flyttingMellom(rute(100, 0, 240, 48), rute(0, 0, 137, 48))

    expect(flytting.skala).toBe(1)
    // Midtpunktene faller sammen: innholdet står stille i overgangen.
    expect(68.5 + flytting.x).toBe(220)
  })

  it('måler mellom midtpunktene, siden skaleringen går om midten', () => {
    // Samme venstrekant, halv størrelse: uten senterregningen ville beviset
    // startet en halv bredde ved siden av knappen.
    const flytting = flyttingMellom(rute(0, 0, 100, 20), rute(0, 0, 200, 40))

    expect(flytting).toEqual({ x: -50, y: -10, skala: 0.5 })
    // Skalert om midten dekker beviset nøyaktig ruten knappen sto i.
    const midte = 100 + flytting.x
    expect(midte - (200 * flytting.skala) / 2).toBe(0)
    expect(midte + (200 * flytting.skala) / 2).toBe(100)
  })

  it('lar beviset ligge i ro når knappen sto akkurat der det landet', () => {
    const samme = rute(120, 340, 180, 52)

    expect(flyttingMellom(samme, { ...samme })).toEqual({ x: 0, y: 0, skala: 1 })
  })

  it('beholder bevisets egen størrelse når en av rutene ikke er målt', () => {
    // En rute uten høyde — et element som ikke er tegnet — skal ikke gi en
    // skala på null eller uendelig og få beviset til å forsvinne.
    expect(flyttingMellom(rute(0, 500, 0, 0), rute(0, 200, 200, 50)).skala).toBe(1)
    expect(flyttingMellom(rute(0, 500, 200, 50), rute(0, 200, 0, 0)).skala).toBe(1)
  })
})
