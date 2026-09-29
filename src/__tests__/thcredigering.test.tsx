// @vitest-environment jsdom
/**
 * Redigeringen av THC-syrereglene og -tekstene på THC-siden: hva som
 * lagres, hva som stoppes før det når databasen, og at simulatoren prøver
 * utkastet slik det står. At databasen godtar og avviser det samme, prøves i
 * `thcRegelsettlagring.test.ts`.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Thcregler } from '../components/regler/Thcregler'
import { TipsLag } from '../components/Tips'
import { publiseringsplan } from '../faginnhold/stoffside'
import { THC_TEKSTBOLKER } from '../domain/thcTekster'
import { INGEN_REGLER, TOM_STOFFSIDE } from '../faginnhold/lesing'
import { thcEndringer, thcUtkastfeil, type ThcRegelsettutgave } from '../faginnhold/thcregler'
import { THC_REGELSETT, THC_TEKSTER, thcRegelsettutgave } from './hjelp/thcgrunnlag'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
})

afterEach(cleanup)

describe('endringene som lagres', () => {
  const utgave = thcRegelsettutgave()

  it('er ingenting når ingenting er endret', () => {
    expect(thcEndringer(utgave, THC_REGELSETT, THC_TEKSTER)).toEqual({ kommentarer: [], regelsett: null })
    expect(thcUtkastfeil(utgave, THC_REGELSETT, THC_TEKSTER)).toEqual([])
  })

  it('er bare kommentaren når bare en tekst er endret', () => {
    const tekster = { ...THC_TEKSTER, pavisningstid: 'Syntetisk påvisningstid.' }
    expect(thcEndringer(utgave, { ...THC_REGELSETT }, tekster)).toEqual({
      kommentarer: [
        {
          id: 'thc-pavisningstid',
          revisjon: 1,
          innhold: { ...utgave.kommentarer.find((k) => k.id === 'thc-pavisningstid')!.innhold, tekst: 'Syntetisk påvisningstid.' },
        },
      ],
      regelsett: null,
    })
  })

  it('er regelsettet, med de samme tekstbolkene, når reglene er endret', () => {
    const regler = { ...THC_REGELSETT, varsel_dager_mellom: 21 }
    expect(thcEndringer(utgave, regler, THC_TEKSTER)).toEqual({
      kommentarer: [],
      regelsett: {
        id: 'thc-regelsett',
        revisjon: 3,
        innhold: { ...regler, tekstbolker: utgave.regelsett.innhold.tekstbolker },
      },
    })
  })

  it('stopper en tekst som mister eller får en plassholder, og ugyldige regler', () => {
    const utenNiva = { ...THC_TEKSTER, apning: 'THC-syre er påvist.' }
    expect(thcUtkastfeil(utgave, THC_REGELSETT, utenNiva)).toEqual(['Tekstbolken «Åpning» må inneholde {nivå}.'])
    // Bolken kan bruke datoen, men kommentaren har ikke hatt den, og plassholderne i en kommentar står fast.
    const medDato = { ...THC_TEKSTER, under_cutoff_vanskelig: `${THC_TEKSTER.under_cutoff_vanskelig} {forrige prøvedato}.` }
    const bolk = THC_TEKSTBOLKER.under_cutoff_vanskelig.tittel
    expect(thcUtkastfeil(utgave, THC_REGELSETT, medDato)).toEqual([
      `Tekstbolken «${bolk}»: Kommentarteksten har plassholdere som ikke er oppgitt: {forrige prøvedato}.`,
    ])
    expect(thcUtkastfeil(utgave, { ...THC_REGELSETT, varsel_dager_mellom: 0 }, THC_TEKSTER)).toEqual([
      'Varselet om tid mellom prøvene må være et helt antall døgn, minst 1.',
    ])
  })
})

describe('publiseringen', () => {
  it('publiserer de endrede tekstene før regelsettet som peker på dem', () => {
    const utgave: ThcRegelsettutgave = thcRegelsettutgave()
    utgave.regelsett = { ...utgave.regelsett, revisjon: 4 }
    utgave.kommentarer = utgave.kommentarer.map((k) => (k.id === 'thc-apning' ? { ...k, revisjon: 2 } : k))
    // Reglene hører til fortolkningssystemet og kommer for seg, ikke gjennom
    // stoffsiden; en side uten upubliserte endringer gir bare reglene.
    expect(publiseringsplan(TOM_STOFFSIDE, { ...INGEN_REGLER, thcregelsett: utgave })).toEqual([
      { slag: 'kommentar', id: 'thc-apning', revisjon: 2 },
      { slag: 'thc_regelsett', id: 'thc-regelsett', revisjon: 4 },
    ])
    expect(publiseringsplan(TOM_STOFFSIDE, { ...INGEN_REGLER, thcregelsett: thcRegelsettutgave() })).toEqual([])
  })
})

describe('redigeringen på THC-siden', () => {
  function visRedigering(utgave = thcRegelsettutgave()) {
    const onLagre = vi.fn(async () => {})
    render(
      <TipsLag>
        <Thcregler utgave={utgave} redigerer onLagre={onLagre} />
      </TipsLag>,
    )
    return onLagre
  }

  async function apne(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Fortolkningsregler' }))
    await user.click(screen.getByRole('button', { name: 'Rediger reglene' }))
    return within(screen.getByRole('form', { name: 'Rediger: Fortolkningsreglene for THC-syre i urin' }))
  }

  it('finnes bare for administratorer i redigeringsmodus', () => {
    render(<Thcregler utgave={thcRegelsettutgave()} redigerer={false} onLagre={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Rediger reglene' })).toBeNull()
  })

  it('lagrer en endret tekst og en endret margin, med tallene som ikke er rørt, urørt', async () => {
    const user = userEvent.setup()
    const onLagre = visRedigering()
    const skjema = await apne(user)

    const tekst = skjema.getByRole('textbox', { name: 'Påvisningstid' })
    await user.clear(tekst)
    await user.type(tekst, 'Syntetisk påvisningstid.')
    const margin = skjema.getByRole('textbox', { name: 'Margin 3 (%)' })
    await user.clear(margin)
    await user.type(margin, '95')
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))

    expect(onLagre).toHaveBeenCalledOnce()
    const [regler, tekster] = onLagre.mock.calls[0]! as unknown as [typeof THC_REGELSETT, typeof THC_TEKSTER]
    expect(tekster).toEqual({ ...THC_TEKSTER, pavisningstid: 'Syntetisk påvisningstid.' })
    expect(regler.sikkerhetsmarginer[2]!.margin).toBe(0.95)
    expect(thcUtkastfeil(thcRegelsettutgave(), regler, tekster)).toEqual([])
    // Alt annet står nøyaktig som før, helt ned til siste siffer.
    expect({ ...regler, sikkerhetsmarginer: THC_REGELSETT.sikkerhetsmarginer }).toStrictEqual(THC_REGELSETT)
  })

  it('sier hva som må rettes, og lagrer ikke før det er gjort', async () => {
    const user = userEvent.setup()
    const onLagre = visRedigering()
    const skjema = await apne(user)
    const apning = skjema.getByRole('textbox', { name: 'Åpning' })
    await user.clear(apning)
    await user.type(apning, 'THC-syre er påvist.')
    expect(skjema.getByRole('alert').textContent).toContain('Tekstbolken «Åpning» må inneholde {nivå}.')
    expect(skjema.getByRole('button', { name: 'Lagre utkast' })).toHaveProperty('disabled', true)
    expect(onLagre).not.toHaveBeenCalled()
  })

  it('prøver utkastet i simulatoren slik det står i skjemaet', async () => {
    const user = userEvent.setup()
    visRedigering()
    const skjema = await apne(user)
    const apning = skjema.getByRole('textbox', { name: 'Åpning' })
    await user.clear(apning)
    // Krøllparentesene må skrives dobbelt for user-event.
    await user.type(apning, 'Syntetisk åpning i {{nivå} konsentrasjon.')
    await user.click(skjema.getByRole('button', { name: 'Prøv reglene' }))
    await user.click(skjema.getByRole('checkbox', { name: 'Ingen tidligere prøve tilgjengelig' }))
    await user.type(skjema.getByRole('group', { name: 'Denne prøven' }).querySelector('input')!, '10')
    expect(skjema.getByText(/^Syntetisk åpning i lav konsentrasjon\./)).toBeTruthy()
  })

  it('lukker uten å lagre når ingenting er endret', async () => {
    const user = userEvent.setup()
    const onLagre = visRedigering()
    const skjema = await apne(user)
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))
    expect(onLagre).not.toHaveBeenCalled()
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('sier hva som ikke er publisert', async () => {
    const utgave = thcRegelsettutgave()
    utgave.kommentarer = utgave.kommentarer.map((k) => (k.id === 'thc-apning' ? { ...k, revisjon: 2 } : k))
    visRedigering(utgave)
    expect(screen.getByText('Ikke publisert: «THC-syre: Åpning».')).toBeTruthy()
  })
})
