// @vitest-environment jsdom
/**
 * Reglene for dra-og-slipp i redigeringen av stoffregisteret
 * (`registerdra.ts`) og at det som løftes, blir under pekeren
 * (`holdGrepet`). Selve draget prøves i nettleseren: testmiljøet har ingen
 * peker og ingen utforming (se `useSortering`).
 */
import type { SortableBoard } from '@peohol/smett'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  KATEGORIER,
  alfabetiskPlass,
  dragmodus,
  hoppAlfabetisk,
  plasserAlfabetisk,
} from '../components/stoffregister/registerdra'
import { holdGrepet } from '../hooks/useSortering'

afterEach(() => {
  document.body.innerHTML = ''
})

/** Et brett der det bare telles hvor ofte Smett får vite at noe er flyttet. */
function lagBrett(dropTarget: unknown = null) {
  return { sync: vi.fn(), dropTarget } as unknown as SortableBoard & { sync: ReturnType<typeof vi.fn> }
}

/** En liste med stoffene, alfabetisk som i redigeringen. */
function stoffliste(navn: string, stoffer: string[], synlig = true): HTMLUListElement {
  const liste = document.createElement('ul')
  liste.dataset.dndContainer = `stoffer:${navn}`
  liste.setAttribute('data-alfabetisk', '')
  for (const s of stoffer) liste.append(stoff(s))
  // jsdom har ingen utforming: en liste som vises, får en firkant.
  liste.getClientRects = () => (synlig ? [new DOMRect(0, 0, 10, 10)] : []) as unknown as DOMRectList
  document.body.append(liste)
  return liste
}

function stoff(navn: string): HTMLLIElement {
  const li = document.createElement('li')
  li.dataset.dndId = navn
  li.dataset.slag = 'stoff'
  li.dataset.navn = navn
  return li
}

const navnI = (liste: HTMLElement) => [...liste.children].map((el) => (el as HTMLElement).dataset.navn)

describe('alfabetiskPlass', () => {
  it('gir plassen foran det første som kommer etter i alfabetet, og sist når ingenting gjør det', () => {
    expect(alfabetiskPlass('Bupropion', ['Amitriptylin', 'Doksepin'])).toBe(1)
    expect(alfabetiskPlass('Aripiprazol', ['Amitriptylin', 'Doksepin'])).toBe(1)
    expect(alfabetiskPlass('Abc', ['Amitriptylin'])).toBe(0)
    expect(alfabetiskPlass('Zopiklon', ['Amitriptylin', 'Doksepin'])).toBe(2)
    expect(alfabetiskPlass('Bupropion', [])).toBe(0)
  })

  it('sorterer æ, ø og å sist, og uten hensyn til store bokstaver', () => {
    expect(alfabetiskPlass('Ølstoff', ['Zopiklon', 'Åstoff'])).toBe(1)
    expect(alfabetiskPlass('bupropion', ['Amitriptylin', 'Citalopram'])).toBe(1)
  })
})

describe('dragmodus', () => {
  it('skiller et stoff, en kategori øverst og en underkategori', () => {
    const kategorier = document.createElement('ol')
    kategorier.dataset.dndContainer = KATEGORIER
    const kategori = document.createElement('li')
    const under = document.createElement('ol')
    under.dataset.dndContainer = 'under:Antidepressiver'
    const underkategori = document.createElement('li')
    under.append(underkategori)
    kategori.append(under)
    kategorier.append(kategori)
    expect(dragmodus(stoff('Bupropion'))).toBe('stoff')
    expect(dragmodus(kategori)).toBe('kategori')
    expect(dragmodus(underkategori)).toBe('underkategori')
  })
})

describe('plasserAlfabetisk', () => {
  it('legger stoffet på sin alfabetiske plass i lista pekeren er over, og sier fra til Smett', () => {
    const fra = stoffliste('NDRI', ['Bupropion'])
    const til = stoffliste('TCA', ['Amitriptylin', 'Doksepin', 'Klomipramin'])
    const bupropion = fra.firstElementChild as HTMLElement
    const brett = lagBrett({ kind: 'container', element: til })
    expect(plasserAlfabetisk(bupropion, brett)).toBe(true)
    expect(navnI(til)).toEqual(['Amitriptylin', 'Bupropion', 'Doksepin', 'Klomipramin'])
    expect(brett.sync).toHaveBeenCalledTimes(1)
    // Står det alt der, gjøres ingenting.
    expect(plasserAlfabetisk(bupropion, brett)).toBe(false)
    expect(brett.sync).toHaveBeenCalledTimes(1)
  })

  it('rydder opp der dnd-kit la stoffet, og hopper over plassholderen', () => {
    const liste = stoffliste('TCA', ['Amitriptylin', 'Doksepin', 'Klomipramin'])
    const plassholder = stoff('Bupropion')
    plassholder.setAttribute('data-dnd-placeholder', '')
    liste.prepend(plassholder)
    const bupropion = stoff('Bupropion')
    liste.append(bupropion)
    plasserAlfabetisk(bupropion, lagBrett())
    expect(navnI(liste)).toEqual(['Bupropion', 'Amitriptylin', 'Bupropion', 'Doksepin', 'Klomipramin'])
    expect(liste.children[2]).toBe(bupropion)
  })
})

describe('hoppAlfabetisk', () => {
  it('tar stoffet til den neste eller forrige lista som vises, uansett hvor dnd-kit la det', () => {
    const ndri = stoffliste('NDRI', ['Bupropion'])
    stoffliste('lukket', ['Agomelatin'], false)
    const tca = stoffliste('TCA', ['Amitriptylin', 'Doksepin'])
    const bupropion = ndri.firstElementChild as HTMLElement
    const brett = lagBrett()

    expect(hoppAlfabetisk(bupropion, brett, document.body, ndri, 1)).toBe(tca)
    expect(navnI(tca)).toEqual(['Amitriptylin', 'Bupropion', 'Doksepin'])
    // Den siste lista: stoffet blir der det er.
    expect(hoppAlfabetisk(bupropion, brett, document.body, tca, 1)).toBe(tca)
    // Tilbake, forbi lista som er lukket.
    tca.prepend(bupropion)
    expect(hoppAlfabetisk(bupropion, brett, document.body, tca, -1)).toBe(ndri)
    expect(navnI(ndri)).toEqual(['Bupropion'])
    expect(brett.sync).toHaveBeenCalledTimes(3)
  })
})

describe('holdGrepet', () => {
  afterEach(() => {
    delete (document.documentElement as { scrollTop?: number }).scrollTop
  })

  /** En liste der det som står over elementet, krymper med `krymp` piksler når `endre` kalles. */
  function oppsett(topp: number, krymp: number) {
    const liste = document.createElement('ol')
    const element = document.createElement('li')
    liste.append(element)
    document.body.append(liste)
    let skjult = false
    element.getBoundingClientRect = () => new DOMRect(0, skjult ? topp - krymp : topp, 100, 40)
    liste.getBoundingClientRect = () => new DOMRect(0, 0, 100, 2000)
    // Som i en nettleser: siden kan ikke rulles lenger opp enn til toppen.
    const rulling = document.scrollingElement ?? document.documentElement
    let rullet = 0
    Object.defineProperty(rulling, 'scrollTop', {
      configurable: true,
      get: () => rullet,
      set: (verdi: number) => (rullet = Math.max(0, verdi)),
    })
    return { liste, element, rulling, endre: () => (skjult = true) }
  }

  it('ruller siden opp like mye som det over det løftede foldet seg sammen, og holder lista like høy', () => {
    const { liste, element, rulling, endre } = oppsett(900, 600)
    rulling.scrollTop = 1000
    const ferdig = holdGrepet(liste, element, endre)
    expect(rulling.scrollTop).toBe(400)
    expect(liste.style.paddingTop).toBe('')
    expect(liste.style.minHeight).toBe('2000px')
    expect(document.documentElement.style.overflowAnchor).toBe('none')
    ferdig()
    expect(liste.style.minHeight).toBe('')
    expect(document.documentElement.style.overflowAnchor).toBe('')
  })

  it('legger det som ikke kan rulles, til som luft øverst i lista', () => {
    const { liste, element, rulling, endre } = oppsett(900, 600)
    rulling.scrollTop = 250
    const ferdig = holdGrepet(liste, element, endre)
    expect(rulling.scrollTop).toBe(0)
    expect(liste.style.paddingTop).toBe('350px')
    ferdig()
    expect(liste.style.paddingTop).toBe('')
  })
})
