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
import { regelplan } from '../faginnhold/stoffside'
import { THC_TEKSTBOLKER } from '../domain/thcTekster'
import { INGEN_REGLER } from '../faginnhold/lesing'
import {
  lagreThcUtkast,
  medLasteDeler,
  tallSomFelt,
  THC_KURVEFELT,
  THC_LASTE_DELER,
  thcEndringer,
  thcUtgavefelter,
  thcUtkastfelter,
  thcUtkastfeil,
  type ThcRegelsettutgave,
  type ThcUtkast,
} from '../faginnhold/thcregler'
import { endredeFelt } from '../faginnhold/historikk'
import { innholdsfelter } from '../faginnhold/innholdsfelter'
import { Samtidighetskonflikt, type Faginnholdslager } from '../faginnhold/lagring'
import type { Objektstatus } from '../faginnhold/modell'
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
    const tekster = { ...THC_TEKSTER, uten_forrige: 'Syntetisk påvisningstid.' }
    expect(thcEndringer(utgave, { ...THC_REGELSETT }, tekster)).toEqual({
      kommentarer: [
        {
          id: 'thc-uten_forrige',
          revisjon: 1,
          innhold: { ...utgave.kommentarer.find((k) => k.id === 'thc-uten_forrige')!.innhold, tekst: 'Syntetisk påvisningstid.' },
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
    const utenNiva = { ...THC_TEKSTER, introsetning: 'THC-syre er påvist.' }
    expect(thcUtkastfeil(utgave, THC_REGELSETT, utenNiva)).toEqual(['Teksten «Introsetning» må inneholde {nivå}.'])
    // Teksten kan bruke datoen, men kommentaren har ikke hatt den, og plassholderne i en kommentar står fast.
    const medDato = { ...THC_TEKSTER, kort_tid: `${THC_TEKSTER.kort_tid} {forrige prøvedato}.` }
    const tittel = THC_TEKSTBOLKER.kort_tid.tittel
    expect(thcUtkastfeil(utgave, THC_REGELSETT, medDato)).toEqual([
      `Teksten «${tittel}»: Kommentarteksten har plassholdere som ikke er oppgitt: {forrige prøvedato}.`,
    ])
    // Også de felles setningene kontrolleres.
    expect(thcUtkastfeil(utgave, THC_REGELSETT, { ...THC_TEKSTER, sporsmalsetning: ' ' })).toEqual([
      'Teksten «Spørsmålsetning» er tom.',
    ])
    expect(thcUtkastfeil(utgave, { ...THC_REGELSETT, kort_tid_dager: 0 }, THC_TEKSTER)).toEqual([
      'Grensen for kort tid mellom prøvene må være et helt antall døgn, minst 1.',
    ])
    expect(thcUtkastfeil(utgave, { ...THC_REGELSETT, varsel_dager_mellom: 0 }, THC_TEKSTER)).toEqual([
      'Varselet om tid mellom prøvene må være et helt antall døgn, minst 1.',
    ])
  })
})

describe('feltene historikken og sammenligningene viser', () => {
  it('navngir hver del av reglene som i redigeringen, og hver tekstbolk', () => {
    const felter = thcUtkastfelter({ regler: THC_REGELSETT, tekster: THC_TEKSTER })
    const navn = felter.map((f) => (f.gruppe ? `${f.gruppe}: ${f.navn}` : f.navn))
    expect(navn).toContain('Nivå 2: Fra og med (IRCAK)')
    expect(navn).toContain('Sikkerhetsmargin: Standard')
    expect(navn).toContain('Måleusikkerhet: CV for THC-syre')
    expect(navn).toContain('Kronisk bruk: Nytt inntak over')
    expect(navn).toContain('Den gule kurven: k1')
    expect(navn).toContain('Felles setninger: Introsetning')
    expect(navn).toContain(`Kommentarene: ${THC_TEKSTBOLKER.nytt_inntak_nylig.tittel}`)
    expect(navn).toContain('Kommentarene: Kort tid mellom prøvene: avsluttes med spørsmålsetningen')
    expect(new Set(felter.map((f) => f.nokkel)).size).toBe(felter.length)
    expect(felter.find((f) => f.nokkel === 'tekst-introsetning')?.verdi).toBe(THC_TEKSTER.introsetning)
    expect(felter.find((f) => f.nokkel === 'sporsmal-kort_tid')?.verdi).toBe('Ja')
    expect(felter.find((f) => f.nokkel === 'sporsmal-nytt_inntak')?.verdi).toBe('Nei')
    expect(felter.find((f) => f.nokkel === 'margin-standard')?.verdi).toBe('90 %')
  })

  it('viser en endring helt ned i siste siffer', () => {
    const gul = THC_REGELSETT.kurver.gul
    const nabo = gul.k1 + Number.EPSILON * gul.k1
    expect(nabo).not.toBe(gul.k1)
    const endret = { ...THC_REGELSETT, kurver: { ...THC_REGELSETT.kurver, gul: { ...gul, k1: nabo } } }
    expect(
      endredeFelt(
        thcUtkastfelter({ regler: THC_REGELSETT, tekster: THC_TEKSTER }),
        thcUtkastfelter({ regler: endret, tekster: THC_TEKSTER }),
      ),
    ).toEqual(['Den gule kurven: k1'])
  })

  it('viser navnet på kommentaren hver bolk peker på i historikken for regelsettet', () => {
    const utgave = thcRegelsettutgave()
    const felter = innholdsfelter('thc_regelsett', utgave.regelsett.innhold)
    expect(felter.find((f) => f.nokkel === 'tekst-introsetning')?.verdi).toBe('thc-introsetning')
    // Et utkast og utgaven det står i, gir de samme feltene.
    expect(thcUtgavefelter(utgave)).toEqual(thcUtkastfelter({ regler: THC_REGELSETT, tekster: THC_TEKSTER }))
  })
})

describe('de låste delene', () => {
  it('lagres alltid slik de står i det lagrede, også når utkastet har noe annet', async () => {
    const utgave = thcRegelsettutgave()
    const lagreThcRegelsett = vi.fn(async () => ({}) as Objektstatus)
    const lager = { lagreThcRegelsett } as unknown as Faginnholdslager
    const kurver = { ...THC_REGELSETT.kurver, gul: { ...THC_REGELSETT.kurver.gul, k1: 0.5 } }
    const regler = { ...THC_REGELSETT, kurver, konverteringsfaktor: 2, varsel_dager_mellom: 21 }
    await lagreThcUtkast(lager, utgave, { regler, tekster: THC_TEKSTER })
    expect(lagreThcRegelsett).toHaveBeenCalledOnce()
    expect(lagreThcRegelsett).toHaveBeenCalledWith(
      'thc-regelsett',
      3,
      { ...THC_REGELSETT, varsel_dager_mellom: 21, tekstbolker: utgave.regelsett.innhold.tekstbolker },
      [],
    )
    // Er bare de låste delene ulike, lagres ingenting.
    lagreThcRegelsett.mockClear()
    await lagreThcUtkast(lager, utgave, { regler: { ...THC_REGELSETT, kurver, konverteringsfaktor: 2 }, tekster: THC_TEKSTER })
    expect(lagreThcRegelsett).not.toHaveBeenCalled()
  })

  it('er kurvene og konverteringsfaktoren', () => {
    expect(medLasteDeler({ ...THC_REGELSETT, konverteringsfaktor: 2 }, THC_REGELSETT)).toStrictEqual(THC_REGELSETT)
    expect([...THC_LASTE_DELER].sort()).toEqual(['konverteringsfaktor', 'kurver'])
  })
})

describe('lagringen', () => {
  it('lagrer en endret tekst og regelsettet i ett kall, mot revisjonene som ble åpnet', async () => {
    const utgave = thcRegelsettutgave()
    const lagreThcRegelsett = vi.fn(async () => ({}) as Objektstatus)
    const tekster = { ...THC_TEKSTER, introsetning: `${THC_TEKSTER.introsetning} Syntetisk.` }
    await lagreThcUtkast({ lagreThcRegelsett } as unknown as Faginnholdslager, utgave, { regler: THC_REGELSETT, tekster })
    // Regelsettet er uendret, men tas med, så en nyere revisjon av det også gir en konflikt.
    expect(lagreThcRegelsett).toHaveBeenCalledOnce()
    expect(lagreThcRegelsett).toHaveBeenCalledWith('thc-regelsett', 3, utgave.regelsett.innhold, [
      expect.objectContaining({ id: 'thc-introsetning', innhold: expect.objectContaining({ tekst: tekster.introsetning }) }),
    ])
  })
})

describe('publiseringen', () => {
  it('publiserer de endrede tekstene før regelsettet som peker på dem', () => {
    const utgave: ThcRegelsettutgave = thcRegelsettutgave()
    utgave.regelsett = { ...utgave.regelsett, revisjon: 4 }
    utgave.kommentarer = utgave.kommentarer.map((k) => (k.id === 'thc-introsetning' ? { ...k, revisjon: 2 } : k))
    expect(regelplan({ ...INGEN_REGLER, thcregelsett: utgave })).toEqual([
      { slag: 'kommentar', id: 'thc-introsetning', revisjon: 2 },
      { slag: 'thc_regelsett', id: 'thc-regelsett', revisjon: 4 },
    ])
    expect(regelplan({ ...INGEN_REGLER, thcregelsett: thcRegelsettutgave() })).toEqual([])
  })
})

describe('redigeringen av THC-syrereglene', () => {
  function visRedigering(
    utgave = thcRegelsettutgave(),
    {
      onLagre = vi.fn(async (_utkast: ThcUtkast, _grunnlag?: ThcRegelsettutgave) => {}),
      hentNyeste = vi.fn(async () => utgave as ThcRegelsettutgave | null),
      publisert = thcRegelsettutgave(),
    } = {},
  ) {
    render(
      <TipsLag>
        <Thcregler utgave={utgave} publisert={publisert} redigerer onLagre={onLagre} hentNyeste={hentNyeste} />
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
    render(<Thcregler utgave={thcRegelsettutgave()} redigerer={false} onLagre={vi.fn()} hentNyeste={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Rediger reglene' })).toBeNull()
  })

  it('lagrer en endret tekst og en endret margin, med tallene som ikke er rørt, urørt', async () => {
    const user = userEvent.setup()
    const onLagre = visRedigering()
    const skjema = await apne(user)

    const tekst = skjema.getByRole('textbox', { name: 'Ikke vurdert mot tidligere prøve: lav og middels høy' })
    await user.clear(tekst)
    await user.type(tekst, 'Syntetisk påvisningstid.')
    const margin = skjema.getByRole('textbox', { name: 'Margin 3 (%)' })
    await user.clear(margin)
    await user.type(margin, '95')
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))

    expect(onLagre).toHaveBeenCalledOnce()
    const [{ regler, tekster }, grunnlag] = onLagre.mock.calls[0]!
    expect(grunnlag).toBeUndefined()
    expect(tekster).toEqual({ ...THC_TEKSTER, uten_forrige: 'Syntetisk påvisningstid.' })
    expect(regler.sikkerhetsmarginer[2]!.margin).toBe(0.95)
    expect(thcUtkastfeil(thcRegelsettutgave(), regler, tekster)).toEqual([])
    // Alt annet står nøyaktig som før, helt ned til siste siffer.
    expect({ ...regler, sikkerhetsmarginer: THC_REGELSETT.sikkerhetsmarginer }).toStrictEqual(THC_REGELSETT)
  })

  it('lagrer spørsmålsetningen og grensen for kort tid, og viser kommentaren slik den blir', async () => {
    const user = userEvent.setup()
    const onLagre = visRedigering()
    const skjema = await apne(user)

    const nytt = within(skjema.getByRole('group', { name: 'Nytt inntak' }))
    const [ovrige, nylig] = nytt.getAllByRole('checkbox', { name: 'Avslutt med spørsmålsetningen' })
    expect(ovrige).toHaveProperty('checked', false)
    await user.click(nylig!)
    expect(nytt.getAllByText(/^Slik blir den:/)[1]!.parentElement!.textContent).toContain(
      `etter prøve tatt 04.07.2026. ${THC_TEKSTER.sporsmalsetning}`,
    )
    const kortTid = skjema.getByRole('textbox', { name: 'Kort tid ved færre enn (dager mellom prøvene)' })
    await user.clear(kortTid)
    await user.type(kortTid, '2')
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))

    const [{ regler, tekster }] = onLagre.mock.calls[0]!
    expect(tekster).toEqual(THC_TEKSTER)
    expect(regler.kort_tid_dager).toBe(2)
    // I fast rekkefølge, uansett hvilken som ble huket av sist.
    expect(regler.med_sporsmalsetning).toEqual([
      'vanskelig',
      'vanskelig_nylig',
      'nytt_inntak_nylig',
      'samlet_vurdering',
      'under_cutoff_ikke_nodvendigvis',
      'kort_tid',
    ])
  })

  it('viser kurvene og konverteringsfaktoren, men lar dem ikke endres', async () => {
    const user = userEvent.setup()
    visRedigering()
    const skjema = await apne(user)
    const kurver = within(skjema.getByRole('group', { name: 'Utskillelseskurvene' }))
    expect(kurver.queryAllByRole('textbox')).toEqual([])
    expect(kurver.getByText('Kurvene er låst og kan bare endres i koden.')).toBeTruthy()
    const gronn = THC_REGELSETT.kurver.gronn
    expect(kurver.getByText(new RegExp(`^${gronn.navn}: a1 `)).textContent).toBe(
      `${gronn.navn}: ${THC_KURVEFELT.map((f) => `${f} ${tallSomFelt(gronn[f])}`).join(' · ')}`,
    )
    expect(skjema.queryByRole('textbox', { name: /^(a1|k1|a2|k2) / })).toBeNull()
    expect(skjema.queryByRole('textbox', { name: 'Konverteringsfaktor' })).toBeNull()
  })

  it('sier hva som må rettes, og lagrer ikke før det er gjort', async () => {
    const user = userEvent.setup()
    const onLagre = visRedigering()
    const skjema = await apne(user)
    const intro = skjema.getByRole('textbox', { name: 'Introsetning' })
    await user.clear(intro)
    await user.type(intro, 'THC-syre er påvist.')
    expect(skjema.getByRole('alert').textContent).toContain('Teksten «Introsetning» må inneholde {nivå}.')
    expect(skjema.getByRole('button', { name: 'Lagre utkast' })).toHaveProperty('disabled', true)
    expect(onLagre).not.toHaveBeenCalled()
  })

  it('prøver utkastet i simulatoren slik det står i skjemaet', async () => {
    const user = userEvent.setup()
    visRedigering()
    const skjema = await apne(user)
    const intro = skjema.getByRole('textbox', { name: 'Introsetning' })
    await user.clear(intro)
    // Krøllparentesene må skrives dobbelt for user-event.
    await user.type(intro, 'Syntetisk åpning i {{nivå} konsentrasjon.')
    await user.click(skjema.getByRole('button', { name: 'Prøv reglene' }))
    await user.click(skjema.getByRole('checkbox', { name: 'Ingen tidligere prøve tilgjengelig' }))
    await user.type(skjema.getByRole('group', { name: 'Denne prøven' }).querySelector('input')!, '10')
    // Både simulatoren og eksemplene under tekstene viser den nye introsetningen.
    const treff = skjema.getAllByText(/^Syntetisk åpning i lav konsentrasjon\./)
    expect(treff.some((e) => e.closest('.simulator__resultat'))).toBe(true)
    expect(treff.some((e) => e.closest('.thc-kommentarredigering'))).toBe(true)
  })

  it('lukker uten å lagre når ingenting er endret', async () => {
    const user = userEvent.setup()
    const onLagre = visRedigering()
    const skjema = await apne(user)
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))
    expect(onLagre).not.toHaveBeenCalled()
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('sier hvilke felt som ikke er publisert, som de andre regelsettene', async () => {
    const utgave = thcRegelsettutgave({
      regler: { ...THC_REGELSETT, varsel_dager_mellom: 21 },
      tekster: { ...THC_TEKSTER, introsetning: 'Syntetisk åpning i {nivå} konsentrasjon.' },
    })
    utgave.regelsett = { ...utgave.regelsett, revisjon: 4 }
    utgave.kommentarer = utgave.kommentarer.map((k) => (k.id === 'thc-introsetning' ? { ...k, revisjon: 2 } : k))
    visRedigering(utgave)
    expect(
      screen.getByText('Ikke publisert: Varsel ved mer enn (dager mellom prøvene), Felles setninger: Introsetning.'),
    ).toBeTruthy()
    // Historikken for hver tekst står i det samme detaljkortet som for de andre regelsettene.
    expect(screen.getByText('Historikken for hver kommentar')).toBeTruthy()
  })

  it('sier ingenting om publisering når alt er publisert', () => {
    visRedigering()
    expect(screen.queryByText(/Ikke publisert/)).toBeNull()
  })

  it('lar brukeren sammenligne og lagre over når noen andre har lagret i mellomtiden', async () => {
    const user = userEvent.setup()
    const deres = thcRegelsettutgave({ regler: { ...THC_REGELSETT, varsel_dager_mellom: 28 } })
    deres.regelsett = { ...deres.regelsett, revisjon: 5 }
    const onLagre = vi.fn(async (_utkast: ThcUtkast, grunnlag?: ThcRegelsettutgave) => {
      if (!grunnlag) throw new Samtidighetskonflikt(5, 3)
    })
    const hentNyeste = vi.fn(async () => deres)
    visRedigering(thcRegelsettutgave(), { onLagre, hentNyeste })
    const skjema = await apne(user)

    const varsel = skjema.getByRole('textbox', { name: 'Varsel ved mer enn (dager mellom prøvene)' })
    await user.clear(varsel)
    await user.type(varsel, '35')
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))
    const konflikt = within(await skjema.findByRole('alert'))
    expect(konflikt.getByText(/Noen andre har lagret reglene mens du redigerte/)).toBeTruthy()
    expect(skjema.getByRole('button', { name: 'Lagre utkast' })).toHaveProperty('disabled', true)

    await user.click(konflikt.getByRole('button', { name: 'Sammenlign med deres' }))
    expect(hentNyeste).toHaveBeenCalledOnce()
    expect(konflikt.getByText(/revisjon 5/)).toBeTruthy()
    await user.click(konflikt.getByRole('button', { name: 'Lagre mine over deres' }))
    expect(onLagre).toHaveBeenLastCalledWith(
      { regler: { ...THC_REGELSETT, varsel_dager_mellom: 35 }, tekster: THC_TEKSTER },
      deres,
      // Uten oppsummering til endringsloggen.
      undefined,
    )
  })
})
