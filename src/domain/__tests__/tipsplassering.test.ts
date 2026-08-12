import { describe, expect, it } from 'vitest'
import {
  maksTipsstorrelse,
  plasserTips,
  TIPSHJORNE,
  TIPSKANT,
  TIPSLUFT,
  TIPSPIL,
  type Rute,
  type Storrelse,
} from '../tipsplassering'

const VINDU: Storrelse = { bredde: 1200, hoyde: 800 }
const BOBLE: Storrelse = { bredde: 300, hoyde: 100 }

/** Et anker på 80 × 20 med midtpunktet der man vil ha det. */
function anker(senterX: number, topp: number): Rute {
  return { venstre: senterX - 40, topp, bredde: 80, hoyde: 20 }
}

/** Boblens høyre- og underkant, som testene sjekker mot vinduskanten. */
function hoyre(venstre: number, boble = BOBLE): number {
  return venstre + boble.bredde
}

describe('plasserTips', () => {
  it('står midtstilt over ankeret når det er plass', () => {
    const { venstre, topp, side, pil } = plasserTips(anker(600, 400), BOBLE, VINDU)

    expect(side).toBe('over')
    // Midtstilt: 600 − 300/2.
    expect(venstre).toBe(450)
    // Rett over, med luft: 400 − 10 − 100.
    expect(topp).toBe(290)
    // Pilen midt på boblen, altså rett under ankerets midtpunkt.
    expect(pil).toBe(150)
    expect(venstre + pil).toBe(600)
  })

  it('faller ned under ankeret når det ikke er plass over', () => {
    const naerToppen = anker(600, 40)
    const { topp, side, pil } = plasserTips(naerToppen, BOBLE, VINDU)

    expect(side).toBe('under')
    // Under ankeret, med luft: 40 + 20 + 10.
    expect(topp).toBe(70)
    // Fortsatt midtstilt — bare på den andre siden.
    expect(pil).toBe(150)
  })

  it('blir stående over så lenge det er plass, også nær bunnen', () => {
    expect(plasserTips(anker(600, 700), BOBLE, VINDU).side).toBe('over')
  })

  it('velger siden med mest plass når boblen ikke får plass noe sted', () => {
    const hoyBoble: Storrelse = { bredde: 300, hoyde: 700 }

    // Ankeret ligger over midten: mest plass under.
    expect(plasserTips(anker(600, 300), hoyBoble, VINDU).side).toBe('under')
    // Og under midten: mest plass over.
    expect(plasserTips(anker(600, 500), hoyBoble, VINDU).side).toBe('over')
  })

  it('skyver boblen innenfor venstre vinduskant', () => {
    const { venstre, pil } = plasserTips(anker(30, 400), BOBLE, VINDU)

    expect(venstre).toBe(TIPSKANT)
    // Boblen er ikke lenger midtstilt, men pilen peker fortsatt på ankeret.
    expect(venstre + pil).toBe(30)
  })

  it('skyver boblen innenfor høyre vinduskant', () => {
    const { venstre, pil } = plasserTips(anker(1170, 400), BOBLE, VINDU)

    expect(hoyre(venstre)).toBe(VINDU.bredde - TIPSKANT)
    expect(venstre + pil).toBe(1170)
  })

  it('holder pilen unna hjørnene når ankeret står helt ute i kanten', () => {
    const heltUte = plasserTips(anker(0, 400), BOBLE, VINDU)
    expect(heltUte.pil).toBe(TIPSHJORNE)

    const heltUteTilHoyre = plasserTips(anker(VINDU.bredde, 400), BOBLE, VINDU)
    expect(heltUteTilHoyre.pil).toBe(BOBLE.bredde - TIPSHJORNE)
  })

  it('holder seg innenfor vinduet uansett hvor ankeret står', () => {
    // Boblen er aldri større enn `maksTipsstorrelse` tillater — den er satt
    // som max-width/max-height i CSS-en. Den største av dem er derfor med
    // her: en boble som fyller vinduet helt skal fortsatt havne innenfor.
    const maks = maksTipsstorrelse(VINDU)
    for (const x of [-200, 0, 5, 150, 600, 1050, 1195, 1400]) {
      for (const y of [-50, 0, 5, 100, 400, 780, 795, 900]) {
        for (const boble of [
          BOBLE,
          { bredde: 900, hoyde: 320 },
          { bredde: 60, hoyde: 40 },
          { bredde: 300, hoyde: maks.hoyde },
          maks,
        ]) {
          const p = plasserTips(anker(x, y), boble, VINDU)

          expect(p.venstre).toBeGreaterThanOrEqual(TIPSKANT)
          expect(p.venstre + boble.bredde).toBeLessThanOrEqual(VINDU.bredde - TIPSKANT)
          expect(p.topp).toBeGreaterThanOrEqual(TIPSKANT)
          expect(p.topp + boble.hoyde).toBeLessThanOrEqual(VINDU.hoyde - TIPSKANT)
          // Pilen skal alltid ligge på boblen, ikke utenfor den.
          expect(p.pil).toBeGreaterThanOrEqual(0)
          expect(p.pil).toBeLessThanOrEqual(boble.bredde)
        }
      }
    }
  })

  it('gir maksmål som lar boblen få plass med luft til alle vinduskantene', () => {
    const maks = maksTipsstorrelse(VINDU)

    expect(maks).toEqual({ bredde: VINDU.bredde - 2 * TIPSKANT, hoyde: VINDU.hoyde - 2 * TIPSKANT })
    // En boble på nøyaktig maksmålet skal ikke kunne stikke ut noe sted.
    const p = plasserTips(anker(600, 400), maks, VINDU)
    expect(p.topp).toBe(TIPSKANT)
    expect(p.topp + maks.hoyde).toBe(VINDU.hoyde - TIPSKANT)
    expect(p.venstre).toBe(TIPSKANT)
    expect(p.venstre + maks.bredde).toBe(VINDU.bredde - TIPSKANT)
  })

  it('gir aldri negative maksmål i et vindu som er mindre enn luften', () => {
    expect(maksTipsstorrelse({ bredde: 4, hoyde: 2 })).toEqual({ bredde: 0, hoyde: 0 })
  })

  it('legger boblen mot øvre venstre kant når den er større enn vinduet', () => {
    const svaer: Storrelse = { bredde: 2000, hoyde: 1500 }
    const p = plasserTips(anker(600, 400), svaer, VINDU)

    expect(p.venstre).toBe(TIPSKANT)
    expect(p.topp).toBe(TIPSKANT)
    // Pilen peker fortsatt på ankeret, ikke på boblens midte.
    expect(p.venstre + p.pil).toBe(600)
  })

  it('lar pilspissen få plass i luften mellom ankeret og boblen', () => {
    // Pilen er et kvadrat som roteres 45 grader, så spissen stikker halve
    // diagonalen ut av boblen. Blir den lengre enn luften, legger den seg
    // oppå teksten den peker på.
    expect(TIPSPIL * Math.SQRT1_2).toBeLessThan(TIPSLUFT)
  })
})
