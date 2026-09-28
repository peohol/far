import { describe, expect, it } from 'vitest'
import { filnokkel } from '../../faginnhold/import'
import { CBD_STOFFSIDER, NYE_STOFFSIDER } from '../../faginnhold/indikasjoner'
import { STOFFSIDE_DATASETT } from '../../faginnhold/stoffsider'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../analyttkatalog'
import { ANDRE_STOFFER, byggStoffregister, kategorierFor, STOFFREGISTER, type Registerkategori } from '../stoffregister'

/**
 * Stoffregisteret i sidemenyen (`src/data/stoffregister.json`): at hvert
 * stoff appen har en side for, står i en farmakologisk kategori, at
 * inndelingen er den klinikeren har bedt om, og at stoffer med og uten
 * analyttkode står om hverandre.
 */

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)
/** Stoffsidene uten kode som importene lager. */
const STOFFSIDER = [...STOFFSIDE_DATASETT.filer.map(filnokkel), ...NYE_STOFFSIDER, ...CBD_STOFFSIDER]
const SELVSTENDIGE_STOFFSIDER = STOFFSIDER.filter((navn) => !katalog.kodeForSide(navn))
const register = byggStoffregister(katalog, STOFFSIDER)
/** Stoffsidene før GHB-, ketamin- og cannabidiolsidene er laget. */
const STOFFSIDER_UTEN_NYE = STOFFSIDER.filter((s) => ![...NYE_STOFFSIDER, ...CBD_STOFFSIDER].includes(s))

function kategori(navn: string, r: Registerkategori[] = register): Registerkategori {
  const funnet = r.find((k) => k.navn === navn)
  if (!funnet) throw new Error(`fant ikke kategorien ${navn}`)
  return funnet
}

const navnI = (k: Registerkategori, under?: string) =>
  (under ? k.underkategorier.find((u) => u.navn === under)!.stoffer : k.stoffer).map((s) => s.navn)

const alfabetisk = (navn: string[]) => [...navn].sort((a, b) => a.localeCompare(b, 'nb'))

describe('datafilen', () => {
  it('navngir bare sider appen har: koder i katalogen og stoffsider fra importene', () => {
    const kjente = new Set([...katalog.oppforinger.map((o) => o.sidenavn), ...STOFFSIDER].map((n) => n.toLocaleLowerCase('nb')))
    for (const k of STOFFREGISTER.kategorier) {
      for (const navn of [...(k.stoffer ?? []), ...(k.underkategorier ?? []).flatMap((u) => u.stoffer)]) {
        expect(kjente.has(navn.toLocaleLowerCase('nb')) || Boolean(katalog.kodeForSide(navn)), `${k.navn}: ${navn}`).toBe(true)
      }
    }
  })

  it('har hver kategori og underkategori én gang, og hvert stoff én gang i hver', () => {
    const kategorinavn = STOFFREGISTER.kategorier.map((k) => k.navn)
    expect(new Set(kategorinavn).size).toBe(kategorinavn.length)
    expect(kategorinavn).not.toContain(ANDRE_STOFFER)
    for (const k of STOFFREGISTER.kategorier) {
      const under = (k.underkategorier ?? []).map((u) => u.navn)
      expect(new Set(under).size, k.navn).toBe(under.length)
      const stoffer = [...(k.stoffer ?? []), ...(k.underkategorier ?? []).flatMap((u) => u.stoffer)]
      expect(new Set(stoffer).size, k.navn).toBe(stoffer.length)
    }
  })
})

describe('registeret', () => {
  it('har kategoriene i den rekkefølgen klinikeren ba om', () => {
    expect(register.map((k) => k.navn)).toEqual([
      'Antidepressiver',
      'Stemningsstabiliserende',
      'Antipsykotika',
      'Antiepileptika',
      'Alkohol og GHB',
      'Benzodiazepiner og Z-hypnotika',
      'Opioider',
      'Stimulanter',
      'Cannabinoider',
      'Hallusinogene stoffer',
      'Antihypertensiver',
    ])
  })

  it('plasserer hver kode og hver stoffside, så ingenting havner i «Andre stoffer»', () => {
    const koder = new Set(register.flatMap((k) => k.stoffer.flatMap((s) => s.koder)))
    expect([...koder].sort()).toEqual(katalog.oppforinger.map((o) => o.kode).sort())
    const sider = new Set(register.flatMap((k) => k.stoffer.filter((s) => s.kode === null).map((s) => s.side)))
    expect([...sider].sort()).toEqual([...SELVSTENDIGE_STOFFSIDER].sort())
  })

  it('har én linje per side, med alle kodene på siden, når en metabolitt er slått sammen med moderstoffet', () => {
    const benzo = kategori('Benzodiazepiner og Z-hypnotika').stoffer
    expect(benzo.find((s) => s.navn === 'Diazepam')).toEqual({ navn: 'Diazepam', side: 'Diazepam', kode: 'DIAZ', koder: ['DIAZ', 'DMI'] })
    expect(benzo.find((s) => s.navn === 'Oksazepam')?.koder).toEqual(['OXA'])
    expect(navnI(kategori('Opioider'))).not.toContain('O-desmetyltramadol')
    expect(kategori('Opioider').stoffer.find((s) => s.navn === 'Tramadol')?.koder).toEqual(['TRAM', 'OTRAM'])
    expect(kategori('Cannabinoider').stoffer.find((s) => s.navn === 'THC og THC-syre')?.koder).toEqual(['THC', 'IRCAK'])
    expect(kategori('Alkohol og GHB').stoffer.find((s) => s.navn === 'Etanol')?.koder).toEqual(['UETGS', 'UETS'])
    for (const k of register) {
      const sider = k.stoffer.map((s) => s.side)
      expect(new Set(sider).size, k.navn).toBe(sider.length)
    }
  })

  it('deler antidepressivene etter farmakodynamisk klasse', () => {
    const k = kategori('Antidepressiver')
    expect(k.underkategorier.map((u) => u.navn)).toEqual([
      'SSRI',
      'SNRI',
      'NDRI',
      'TCA',
      'Reseptorantagonister (NaSSA)',
      'Multimodale',
      'NMDA-reseptorantagonister',
    ])
    expect(navnI(k, 'SSRI')).toEqual(['Citalopram', 'Escitalopram', 'Fluoksetin', 'Fluvoksamin', 'Paroksetin', 'Sertralin'])
    expect(navnI(k, 'SNRI')).toEqual(['Duloksetin', 'Venlafaksin'])
    expect(navnI(k, 'NDRI')).toEqual(['Hydroksybupropion (kun aktiv metabolitt)'])
    expect(navnI(k, 'NMDA-reseptorantagonister')).toEqual(['Ketamin'])
  })

  it('deler antipsykotika i første- og andregenerasjonsmidler', () => {
    const k = kategori('Antipsykotika')
    expect(k.underkategorier.map((u) => u.navn)).toEqual(['Førstegenerasjonsmidler', 'Andregenerasjonsmidler'])
    expect(navnI(k, 'Førstegenerasjonsmidler')).toContain('Haloperidol')
    expect(navnI(k, 'Andregenerasjonsmidler')).toContain('Klozapin')
    // Sertindol har ingen kode, men står sammen med dem som har.
    expect(navnI(k, 'Andregenerasjonsmidler')).toContain('Sertindol')
  })

  it('beholder underkategoriene antihypertensivene har i datasettet', () => {
    const k = kategori('Antihypertensiver')
    expect(k.underkategorier.map((u) => u.navn)).toEqual([
      'ACE-hemmere',
      'Aldosteronantagonister',
      'Alfa- og betablokkere',
      'Alfablokkere',
      'ARB',
      'Betablokkere',
      'Diuretika',
      'Kalsiumantagonister',
    ])
    const iMetoden = katalog.oppforinger.filter((o) => o.analysemetode === 'AHT').map((o) => o.kode)
    expect(k.stoffer.map((s) => s.kode).sort()).toEqual(iMetoden.sort())
  })

  it('setter stoffer med og uten analyttkode sammen', () => {
    const k = kategori('Antiepileptika')
    expect(k.stoffer.find((s) => s.navn === 'Lamotrigin')?.kode).toBe('LAM')
    expect(k.stoffer.find((s) => s.navn === 'Karbamazepin')?.kode).toBeNull()
    expect(navnI(kategori('Alkohol og GHB'))).toEqual(['Etanol', 'GHB'])
    expect(navnI(kategori('Hallusinogene stoffer'))).toEqual(['Ketamin'])
  })

  it('lar et stoff stå i flere kategorier', () => {
    for (const navn of ['Karbamazepin', 'Lamotrigin', 'Valproat']) {
      expect(navnI(kategori('Stemningsstabiliserende')), navn).toContain(navn)
      expect(navnI(kategori('Antiepileptika')), navn).toContain(navn)
    }
    expect(navnI(kategori('Benzodiazepiner og Z-hypnotika'))).toContain('Klonazepam')
    expect(navnI(kategori('Antiepileptika'))).toContain('Klonazepam')
  })

  it('lister stoffene alfabetisk i hver kategori og underkategori', () => {
    for (const k of register) {
      expect(navnI(k), k.navn).toEqual(alfabetisk(navnI(k)))
      for (const u of k.underkategorier) expect(navnI(k, u.navn), `${k.navn} › ${u.navn}`).toEqual(alfabetisk(navnI(k, u.navn)))
    }
  })

  it('har de samme stoffene med og uten underkategoriene', () => {
    for (const k of register) {
      if (k.underkategorier.length === 0) continue
      const iUnder = new Set(k.underkategorier.flatMap((u) => u.stoffer))
      expect(k.stoffer.filter((s) => !iUnder.has(s)), k.navn).toEqual([])
    }
  })
})

describe('sider som mangler eller ikke er plassert', () => {
  it('utelater et stoff som ennå ikke har noen side, og en kategori som blir tom', () => {
    const utenNye = byggStoffregister(katalog, STOFFSIDER_UTEN_NYE)
    expect(utenNye.map((k) => k.navn)).not.toContain('Hallusinogene stoffer')
    expect(navnI(kategori('Alkohol og GHB', utenNye))).toEqual(['Etanol'])
    expect(navnI(kategori('Cannabinoider', utenNye))).not.toContain('Cannabidiol')
    expect(navnI(kategori('Cannabinoider'))).toContain('Cannabidiol')
    expect(kategori('Antidepressiver', utenNye).underkategorier.map((u) => u.navn)).not.toContain('NMDA-reseptorantagonister')
  })

  it('samler stoffsider som ikke står i registeret, i «Andre stoffer» sist', () => {
    const medNy = byggStoffregister(katalog, [...STOFFSIDER, 'Teststoff'])
    expect(medNy.at(-1)).toEqual({
      navn: ANDRE_STOFFER,
      underkategorier: [],
      stoffer: [{ navn: 'Teststoff', side: 'Teststoff', kode: null, koder: [] }],
    })
  })
})

describe('kategoriene til én stoffside', () => {
  it('gir underkategorien når kategorien er delt opp', () => {
    expect(kategorierFor('Sertralin', katalog)).toEqual([{ kategori: 'Antidepressiver', underkategori: 'SSRI' }])
    expect(kategorierFor('Klozapin', katalog)).toEqual([
      { kategori: 'Antipsykotika', underkategori: 'Andregenerasjonsmidler' },
    ])
  })

  it('gir hver kategori stoffet står i, i registerets rekkefølge', () => {
    expect(kategorierFor('Lamotrigin', katalog)).toEqual([
      { kategori: 'Stemningsstabiliserende' },
      { kategori: 'Antiepileptika' },
    ])
    expect(kategorierFor('ketamin', katalog)).toEqual([
      { kategori: 'Antidepressiver', underkategori: 'NMDA-reseptorantagonister' },
      { kategori: 'Hallusinogene stoffer' },
    ])
  })

  it('stemmer med sidemenyen for hver side, også antihypertensivene', () => {
    for (const side of [...new Set(katalog.oppforinger.map((o) => o.sidenavn)), ...SELVSTENDIGE_STOFFSIDER]) {
      const iMenyen = register.flatMap((k) =>
        k.underkategorier.length > 0
          ? k.underkategorier.filter((u) => u.stoffer.some((s) => s.side === side)).map((u) => `${k.navn} › ${u.navn}`)
          : k.stoffer.some((s) => s.side === side)
            ? [k.navn]
            : [],
      )
      const stier = kategorierFor(side, katalog).map((k) => (k.underkategori ? `${k.kategori} › ${k.underkategori}` : k.kategori))
      expect(stier, side).toEqual(iMenyen)
    }
  })

  it('gir «Andre stoffer» for en side registeret ikke plasserer', () => {
    expect(kategorierFor('Teststoff', katalog)).toEqual([{ kategori: ANDRE_STOFFER }])
  })
})
