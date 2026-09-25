// @vitest-environment jsdom
/**
 * Fortolkningsmodulen for THC-syre med reglene og tekstene fra Supabase,
 * prøvd i en nettleser i minnet: mens de hentes, når de ikke kan brukes, og
 * når de er der. At motoren gir det samme som den opprinnelige modulen for
 * alle innstillinger, prøves i `thcParitet.test.ts` og
 * `fortolkningUendret.test.ts`; her prøves det at modulen faktisk bruker
 * reglene den får.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ThcStep } from '../components/ThcStep'
import { TipsLag } from '../components/Tips'
import { fortolkThc, lagThcModell, tomThcInndata, type ThcModell, type ThcRegler } from '../domain/thcMotor'
import type { ThcRegelsett } from '../domain/thcRegelsett'
import type { ThcTekster } from '../domain/thcTekster'
import { thcReglerFra } from '../faginnhold/thcregler'
import { ShortcutVisibilityProvider } from '../hooks/useShortcutVisibility'
import { marginvalg } from '../domain/thcVisning'
import { medPekerhendelser, trykkPaaValg } from './hjelp/pekerhendelser'
import { THC_MODELL, THC_REGELSETT, THC_TEKSTER, thcRegelsettutgave } from './hjelp/thcgrunnlag'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollBy = () => {}
  medPekerhendelser()
})

afterEach(cleanup)

function visSteg(regler: ThcRegler) {
  const copy = vi.fn(async (_tekst: string) => true)
  render(
    <TipsLag>
      <ShortcutVisibilityProvider>
        <ThcStep regler={regler} onBack={vi.fn()} copy={copy} flashAt={vi.fn()} />
      </ShortcutVisibilityProvider>
    </TipsLag>,
  )
  return copy
}

function modell(regler: ThcRegelsett = THC_REGELSETT, tekster: ThcTekster = THC_TEKSTER): ThcModell {
  const m = lagThcModell(regler, tekster)
  if (!m.ok) throw new Error(m.feil.join('\n'))
  return m.modell
}

const gruppe = (navn: string) => within(screen.getByRole('group', { name: navn }))

describe('fortolkningsmodulen for THC-syre', () => {
  it('sier fra mens reglene hentes, og har ingenting å kopiere', () => {
    visSteg({ status: 'laster' })
    expect(screen.getByRole('status').textContent).toBe('Fortolkningsreglene hentes …')
    expect(screen.getByRole('heading', { name: 'THC-syre i urin' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Kopier/ })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('sier hvorfor når reglene ikke kan brukes, og lar brukeren prøve igjen', async () => {
    const user = userEvent.setup()
    const provIgjen = vi.fn()
    visSteg({ status: 'feil', melding: 'Fortolkningsreglene kunne ikke hentes. Nede.', provIgjen })
    expect(screen.getByRole('alert').textContent).toBe('Fortolkningsreglene kunne ikke hentes. Nede.')
    expect(screen.queryByRole('button', { name: /Kopier/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Prøv igjen' }))
    expect(provIgjen).toHaveBeenCalledOnce()
  })

  it('fortolker med de publiserte reglene og kopierer kommentaren motoren gir', async () => {
    const user = userEvent.setup()
    const copy = visSteg({ status: 'klar', modell: THC_MODELL })
    await user.type(gruppe('Forrige prøve').getByRole('textbox', { name: 'IRCAK' }), '120')
    await user.type(gruppe('Forrige prøve').getByLabelText('Prøvedato'), '2026-02-01')
    await user.type(gruppe('Denne prøven').getByRole('textbox', { name: 'IRCAK' }), '80')
    await user.type(gruppe('Denne prøven').getByLabelText('Prøvedato'), '2026-02-08')

    const forventet = fortolkThc(
      {
        ...tomThcInndata(THC_REGELSETT),
        forrigeVerdi: '120',
        forrigeDato: '2026-02-01',
        aktuellVerdi: '80',
        aktuellDato: '2026-02-08',
      },
      THC_MODELL,
    )
    if (forventet.type !== 'kommentar') throw new Error('Tilfellet skal gi en kommentar.')
    expect(screen.getByText(forventet.kommentar)).toBeTruthy()
    // Visualiseringen og forklaringen står når det er en forrige prøve å sammenligne med.
    expect(screen.getByText('Visualisering')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Kopier kommentar/ }))
    expect(copy).toHaveBeenCalledWith(forventet.kommentar)
  })

  it('gir kommentaren motoren gir for hver margin som trykkes på bryteren, og kopierer med mellomrom der', async () => {
    const user = userEvent.setup()
    const copy = visSteg({ status: 'klar', modell: THC_MODELL })
    const inn = {
      ...tomThcInndata(THC_REGELSETT),
      forrigeVerdi: '120',
      forrigeDato: '2026-02-01',
      aktuellVerdi: '95',
      aktuellDato: '2026-02-04',
    }
    await user.type(gruppe('Forrige prøve').getByRole('textbox', { name: 'IRCAK' }), inn.forrigeVerdi)
    await user.type(gruppe('Forrige prøve').getByLabelText('Prøvedato'), inn.forrigeDato)
    await user.type(gruppe('Denne prøven').getByRole('textbox', { name: 'IRCAK' }), inn.aktuellVerdi)
    await user.type(gruppe('Denne prøven').getByLabelText('Prøvedato'), inn.aktuellDato)

    const skala = screen.getByRole('slider', { name: 'Sikkerhetsmargin' })
    const kommentarer = new Set<string>()
    for (const { margin } of THC_REGELSETT.sikkerhetsmarginer) {
      trykkPaaValg(marginvalg(margin))
      expect(skala.getAttribute('aria-valuetext')).toBe(marginvalg(margin))
      const forventet = fortolkThc({ ...inn, sikkerhetsmargin: margin }, THC_MODELL)
      if (forventet.type !== 'kommentar') throw new Error('Tilfellet skal gi en kommentar.')
      expect(screen.getByText(forventet.kommentar)).toBeTruthy()
      kommentarer.add(forventet.kommentar)

      // Trykket gir skalaen fokus, og mellomrom kopierer derfra som før.
      expect(document.activeElement).toBe(skala)
      await user.keyboard(' ')
      expect(copy).toHaveBeenLastCalledWith(forventet.kommentar)
    }
    // Tilfellet er valgt så marginen faktisk endrer konklusjonen.
    expect(kommentarer.size).toBeGreaterThan(1)
  })

  it('bruker tekstene, marginene og varselgrensen i regelsettet den får', async () => {
    const user = userEvent.setup()
    const regler: ThcRegelsett = {
      ...THC_REGELSETT,
      varsel_dager_mellom: 5,
      sikkerhetsmarginer: THC_REGELSETT.sikkerhetsmarginer.filter((m) => m.margin !== 0.99),
    }
    const tekster = { ...THC_TEKSTER, apning: 'Syntetisk åpning: {nivå} konsentrasjon.' }
    visSteg({ status: 'klar', modell: modell(regler, tekster) })

    expect(screen.getByRole('slider', { name: 'Sikkerhetsmargin' }).getAttribute('aria-valuetext')).toBe('90 %')
    expect((screen.getByRole('slider', { name: 'Sikkerhetsmargin' }) as HTMLInputElement).max).toBe('1')

    await user.type(gruppe('Forrige prøve').getByRole('textbox', { name: 'IRCAK' }), '120')
    await user.type(gruppe('Forrige prøve').getByLabelText('Prøvedato'), '2026-02-01')
    await user.type(gruppe('Denne prøven').getByRole('textbox', { name: 'IRCAK' }), '80')
    await user.type(gruppe('Denne prøven').getByLabelText('Prøvedato'), '2026-02-08')

    expect(screen.getByText(/^Syntetisk åpning: høy konsentrasjon\./)).toBeTruthy()
    expect(screen.getByRole('note').textContent).toContain('Det er mer enn 5 dager mellom prøvene.')
    await user.click(screen.getByRole('button', { name: 'Huk av nå' }))
    expect(screen.getByRole('checkbox', { name: 'Ingen tidligere prøve tilgjengelig' })).toHaveProperty('checked', true)
  })

  it('gir ingen kommentar når nye regler ikke har marginen skjemaet står på', async () => {
    const user = userEvent.setup()
    const vis = (m: ThcModell) => (
      <TipsLag>
        <ShortcutVisibilityProvider>
          <ThcStep regler={{ status: 'klar', modell: m }} onBack={vi.fn()} copy={vi.fn()} flashAt={vi.fn()} />
        </ShortcutVisibilityProvider>
      </TipsLag>
    )
    const { rerender } = render(vis(THC_MODELL))
    const skala = screen.getByRole('slider', { name: 'Sikkerhetsmargin' })
    fireEvent.change(skala, { target: { value: '2' } })
    expect(skala.getAttribute('aria-valuetext')).toBe('99 %')
    await user.type(gruppe('Forrige prøve').getByRole('textbox', { name: 'IRCAK' }), '120')
    await user.type(gruppe('Forrige prøve').getByLabelText('Prøvedato'), '2026-02-01')
    await user.type(gruppe('Denne prøven').getByRole('textbox', { name: 'IRCAK' }), '80')
    await user.type(gruppe('Denne prøven').getByLabelText('Prøvedato'), '2026-02-08')
    expect(screen.getByRole('button', { name: /Kopier kommentar/ })).toBeTruthy()

    const uten99 = THC_REGELSETT.sikkerhetsmarginer.filter((m) => m.margin !== 0.99)
    rerender(vis(modell({ ...THC_REGELSETT, sikkerhetsmarginer: uten99 })))
    expect(screen.getByText('Mangler')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Kopier kommentar/ })).toBeNull()
  })
})

/* --- Reglene slik appen henter dem --------------------------------------- */

describe('THC-reglene slik appen henter dem', () => {
  const provIgjen = () => {}

  it('gir den samme modellen som reglene og tekstene de ble importert fra', () => {
    const regler = thcReglerFra({ status: 'klar', data: thcRegelsettutgave() }, provIgjen)
    expect(regler).toEqual({ status: 'klar', modell: THC_MODELL })
  })

  it('venter mens reglene hentes, og sier fra med en vei til å prøve igjen når de ikke kunne hentes', () => {
    expect(thcReglerFra({ status: 'laster' }, provIgjen)).toEqual({ status: 'laster' })
    expect(thcReglerFra({ status: 'feil', melding: 'Nede.' }, provIgjen)).toEqual({
      status: 'feil',
      melding: 'Fortolkningsreglene kunne ikke hentes. Nede.',
      provIgjen,
    })
  })

  it('sier fra når det ikke finnes noe publisert regelsett', () => {
    expect(thcReglerFra({ status: 'klar', data: null }, provIgjen)).toMatchObject({
      status: 'feil',
      melding: expect.stringContaining('ingen publiserte regler for THC-syre i urin'),
    })
  })

  it('bruker ikke et regelsett som ikke består kontrollen, eller som mangler en tekst', () => {
    const ugyldig = thcRegelsettutgave()
    ugyldig.regelsett.innhold.varsel_dager_mellom = 0
    const utenTekst = thcRegelsettutgave()
    utenTekst.kommentarer = utenTekst.kommentarer.slice(1)
    for (const data of [ugyldig, utenTekst]) {
      expect(thcReglerFra({ status: 'klar', data }, provIgjen)).toMatchObject({
        status: 'feil',
        melding: expect.stringContaining('Reglene for THC-syre i urin er ikke gyldige'),
      })
    }
  })
})
