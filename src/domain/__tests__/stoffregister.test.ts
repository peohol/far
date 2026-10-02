import { describe, expect, it } from 'vitest'
import { IKONNAVN, KATEGORIIKON_PLASSHOLDER, kategoriikon } from '../../components/ikon/register'
import { filnokkel } from '../../faginnhold/import'
import { CBD_STOFFSIDER, NYE_STOFFSIDER } from '../../faginnhold/indikasjoner'
import { STOFFSIDE_DATASETT } from '../../faginnhold/stoffsider'
import { ANALYTTKATALOG } from '../analyttkatalog'
import { navnenokkel } from '../sokenavn'
import {
  ANDRE_STOFFER,
  byggStoffregister,
  kontrollerStoffregister,
  STOFFREGISTER,
  STOFFREGISTERDATA,
  stoffslug,
  type Registerdata,
  type Registerkategori,
} from '../stoffregister'

/**
 * Stoffregisteret (`src/data/stoffregister.json`): stoffene med nøkkel og
 * navn, de eksplisitte koblingene til laboratorieanalyttene, og kategoriene i
 * sidemenyen. Registeret er fasit for stoffene; analyttkatalogen er det ikke.
 */

/** Stoffsidene importene lager. */
const IMPORTERTE = [...STOFFSIDE_DATASETT.filer.map(filnokkel), ...NYE_STOFFSIDER, ...CBD_STOFFSIDER]

/** Importerte sider en senere migrasjon har gitt stoffets navn (`*_cbd_stoffside.sql`). */
const OMDOPTE: Readonly<Record<string, string>> = { Cannabidiol: 'CBD' }

function kategori(navn: string, r: readonly Registerkategori[] = STOFFREGISTER.kategorier): Registerkategori {
  const funnet = r.find((k) => k.navn === navn)
  if (!funnet) throw new Error(`fant ikke kategorien ${navn}`)
  return funnet
}

const navnI = (k: Registerkategori, under?: string) =>
  (under ? k.underkategorier.find((u) => u.navn === under)!.stoffer : k.stoffer).map((s) => s.navn)

const alfabetisk = (navn: string[]) => [...navn].sort((a, b) => a.localeCompare(b, 'nb'))

describe('datafilen', () => {
  it('består kontrollen: gyldige nøkler, unike aliaser, koblinger til kjente stoffer og ett primært stoff per kode', () => {
    expect(kontrollerStoffregister()).toEqual([])
  })

  it('finner feilene kontrollen skal finne', () => {
    const feil: Registerdata = {
      stoffer: [
        { slug: 'a', navn: 'A', aliaser: ['B'] },
        { slug: 'b', navn: 'B' },
        { slug: 'Ugyldig', navn: 'Ugyldig' },
      ],
      analyttkoblinger: [
        { kode: 'X', stoff: 'a', relasjon: 'selve_stoffet' },
        { kode: 'X', stoff: 'b', relasjon: 'metabolitt' },
        { kode: 'Y', stoff: 'finnes-ikke', relasjon: 'navnelikhet' },
      ],
      kategorier: [{ navn: 'K', stoffer: ['ukjent'] }],
    }
    const meldinger = kontrollerStoffregister(feil).join('\n')
    expect(meldinger).toContain('ugyldig nøkkel')
    expect(meldinger).toContain('er nøkkelen til et annet stoff')
    expect(meldinger).toContain('X har 2 primære stoffer')
    expect(meldinger).toContain('peker på et stoff som ikke finnes')
    expect(meldinger).toContain('ukjent relasjon')
    expect(meldinger).toContain('ukjent')
  })

  it('kobler hver kode fortolkningen kjenner, til ett primært stoff, og ingen koder den ikke kjenner', () => {
    for (const { kode } of ANALYTTKATALOG.oppforinger) {
      expect(STOFFREGISTER.primartStoffFor(kode), kode).toBeDefined()
    }
    for (const { kode } of STOFFREGISTER.koblinger) expect(ANALYTTKATALOG.finn(kode), kode).toBeDefined()
  })

  it('navngir aldri et stoff etter metabolitten analytten måler', () => {
    for (const k of STOFFREGISTER.koblinger.filter((k) => k.relasjon === 'metabolitt')) {
      const stoff = navnenokkel(STOFFREGISTER.finn(k.stoff)!.navn)
      for (const komponent of ANALYTTKATALOG.finn(k.kode)!.komponenter) expect(navnenokkel(komponent), k.kode).not.toBe(stoff)
    }
  })

  it('har et stoff for hver stoffside importene lager', () => {
    for (const navn of IMPORTERTE) expect(STOFFREGISTER.kanonisk(navn)?.navn, navn).toBe(OMDOPTE[navn] ?? navn)
  })

  it('gir hvert stoff en plass i en kategori, så ingenting havner i «Andre stoffer»', () => {
    expect(STOFFREGISTER.kategorier.map((k) => k.navn)).not.toContain(ANDRE_STOFFER)
    for (const stoff of STOFFREGISTER.stoffer) {
      expect(STOFFREGISTER.kategorierFor(stoff.slug), stoff.slug).not.toEqual([{ kategori: ANDRE_STOFFER }])
    }
  })

  it('har hver kategori og underkategori én gang, og hvert stoff én gang i hver', () => {
    const kategorinavn = STOFFREGISTERDATA.kategorier.map((k) => k.navn)
    expect(new Set(kategorinavn).size).toBe(kategorinavn.length)
    for (const k of STOFFREGISTERDATA.kategorier) {
      const under = (k.underkategorier ?? []).map((u) => u.navn)
      expect(new Set(under).size, k.navn).toBe(under.length)
      const stoffer = [...(k.stoffer ?? []), ...(k.underkategorier ?? []).flatMap((u) => u.stoffer)]
      expect(new Set(stoffer).size, k.navn).toBe(stoffer.length)
    }
  })
})

describe('nøklene', () => {
  it('lager en stabil, URL-vennlig nøkkel av navnet', () => {
    expect(stoffslug('Bupropion')).toBe('bupropion')
    expect(stoffslug('  N-desmetyldiazepam ')).toBe('n-desmetyldiazepam')
    expect(stoffslug('Paliperidon (hydroksyrisperidon)')).toBe('paliperidon-hydroksyrisperidon')
    expect(stoffslug('Æøå ß é')).toBe('aeoa-ss-e')
    expect(stoffslug('!!!')).toBe('')
  })

  it('finner stoffet etter nøkkelen, navnet eller et alias', () => {
    expect(STOFFREGISTER.kanonisk('bupropion')?.slug).toBe('bupropion')
    expect(STOFFREGISTER.kanonisk('Hydroksybupropion')?.slug).toBe('bupropion')
    expect(STOFFREGISTER.kanonisk('N-desmetyldiazepam')?.slug).toBe('diazepam')
    expect(STOFFREGISTER.kanonisk('THC-syre')?.slug).toBe('thc')
    expect(STOFFREGISTER.kanonisk('EtS')?.slug).toBe('etanol')
    expect(STOFFREGISTER.kanonisk('Nortriptylin')?.slug).toBe('nortriptylin')
    expect(STOFFREGISTER.kanonisk('HBUP')).toBeUndefined()
    expect(STOFFREGISTER.finn('hydroksybupropion')).toBeUndefined()
  })

  it('fører de gamle adressene til sidene som fikk moderstoffets navn, dit', () => {
    for (const [gammel, ny] of [
      ['benzoylekgonin', 'kokain'],
      ['cannabidiol', 'cbd'],
      ['enalaprilat', 'enalapril'],
      ['ramiprilat', 'ramipril'],
      ['losartansyre', 'losartan'],
      ['kanrenon', 'spironolakton'],
      ['o-desmetylvenlafaksin', 'venlafaksin'],
    ]) {
      expect(STOFFREGISTER.finn(gammel!), gammel).toBeUndefined()
      expect(STOFFREGISTER.kanonisk(gammel!)?.slug, gammel).toBe(ny)
    }
  })
})

describe('registeret med sidene i databasen', () => {
  it('tar navnet siden har i databasen, og legger en ukjent side i «Andre stoffer» sist', () => {
    const r = byggStoffregister([
      { id: '1', slug: 'bupropion', navn: 'Bupropion (Wellbutrin)' },
      { id: '2', slug: 'teststoff', navn: 'Teststoff' },
    ])
    expect(r.finn('bupropion')?.navn).toBe('Bupropion (Wellbutrin)')
    expect(r.kategorier.at(-1)).toEqual({
      navn: ANDRE_STOFFER,
      underkategorier: [],
      stoffer: [{ slug: 'teststoff', navn: 'Teststoff', koder: [] }],
    })
    expect(r.kategorierFor('teststoff')).toEqual([{ kategori: ANDRE_STOFFER }])
  })

  it('lar en side hvis nøkkel er et alias, være: den er ikke et eget stoff', () => {
    const r = byggStoffregister([{ id: '1', slug: 'hydroksybupropion', navn: 'Hydroksybupropion' }])
    expect(r.finn('hydroksybupropion')).toBeUndefined()
    expect(r.stoffer.map((s) => s.slug)).toEqual(STOFFREGISTER.stoffer.map((s) => s.slug))
  })
})

describe('sidemenyen', () => {
  it('har kategoriene i den rekkefølgen klinikeren ba om', () => {
    expect(STOFFREGISTER.kategorier.map((k) => k.navn)).toEqual([
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

  it('har én linje per stoff, med kodene stoffet primært er koblet til som sekundær informasjon', () => {
    const benzo = kategori('Benzodiazepiner og Z-hypnotika').stoffer
    expect(benzo.find((s) => s.slug === 'diazepam')).toEqual({ slug: 'diazepam', navn: 'Diazepam', koder: ['DIAZ', 'DMI'] })
    expect(benzo.find((s) => s.slug === 'oksazepam')?.koder).toEqual(['OXA'])
    expect(navnI(kategori('Opioider'))).not.toContain('O-desmetyltramadol')
    expect(kategori('Opioider').stoffer.find((s) => s.slug === 'tramadol')?.koder).toEqual(['TRAM', 'OTRAM'])
    expect(kategori('Cannabinoider').stoffer.find((s) => s.slug === 'thc')).toEqual({ slug: 'thc', navn: 'THC', koder: ['THC', 'IRCAK'] })
    expect(kategori('Alkohol og GHB').stoffer.find((s) => s.slug === 'etanol')?.koder).toEqual(['UETGS', 'UETS'])
    const ad = kategori('Antidepressiver').stoffer
    expect(ad.find((s) => s.slug === 'bupropion')).toEqual({ slug: 'bupropion', navn: 'Bupropion', koder: ['HBUP'] })
    expect(ad.find((s) => s.slug === 'amitriptylin')?.koder).toEqual(['AMTNORSUM'])
    // Nortriptylin er sitt eget stoff; AMTNORSUM er ikke nortriptylins primære analytt.
    expect(ad.find((s) => s.slug === 'nortriptylin')?.koder).toEqual(['NOR'])
    expect(ad.map((s) => s.navn)).not.toContain('Hydroksybupropion')
    expect(kategori('Antipsykotika').stoffer.find((s) => s.slug === 'paliperidon')?.koder).toEqual(['PALI'])
    for (const k of STOFFREGISTER.kategorier) {
      const slugs = k.stoffer.map((s) => s.slug)
      expect(new Set(slugs).size, k.navn).toBe(slugs.length)
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
    expect(navnI(k, 'NDRI')).toEqual(['Bupropion'])
    expect(navnI(k, 'TCA')).toContain('Amitriptylin')
    expect(navnI(k, 'TCA')).toContain('Nortriptylin')
    expect(navnI(k, 'NMDA-reseptorantagonister')).toEqual(['Ketamin'])
  })

  it('deler antipsykotika i første- og andregenerasjonsmidler', () => {
    const k = kategori('Antipsykotika')
    expect(k.underkategorier.map((u) => u.navn)).toEqual(['Førstegenerasjonsmidler', 'Andregenerasjonsmidler'])
    expect(navnI(k, 'Førstegenerasjonsmidler')).toContain('Haloperidol')
    for (const navn of ['Klozapin', 'Kariprazin', 'Paliperidon', 'Risperidon', 'Sertindol']) {
      expect(navnI(k, 'Andregenerasjonsmidler')).toContain(navn)
    }
  })

  it('deler antihypertensivene i underkategorier, med hver analytt i metoden', () => {
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
    const iMetoden = ANALYTTKATALOG.oppforinger.filter((o) => o.analysemetode === 'AHT').map((o) => o.kode)
    expect(k.stoffer.flatMap((s) => s.koder).sort()).toEqual(iMetoden.sort())
  })

  it('setter stoffer med og uten analyttkode sammen', () => {
    const k = kategori('Antiepileptika')
    expect(k.stoffer.find((s) => s.slug === 'lamotrigin')?.koder).toEqual(['LAM'])
    expect(k.stoffer.find((s) => s.slug === 'karbamazepin')?.koder).toEqual([])
    expect(navnI(kategori('Alkohol og GHB'))).toEqual(['Etanol', 'GHB'])
    expect(navnI(kategori('Hallusinogene stoffer'))).toEqual(['Ketamin'])
    expect(navnI(kategori('Cannabinoider'))).toEqual(['CBD', 'THC'])
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
    for (const k of STOFFREGISTER.kategorier) {
      expect(navnI(k), k.navn).toEqual(alfabetisk(navnI(k)))
      for (const u of k.underkategorier) expect(navnI(k, u.navn), `${k.navn} › ${u.navn}`).toEqual(alfabetisk(navnI(k, u.navn)))
    }
  })

  it('har de samme stoffene med og uten underkategoriene', () => {
    for (const k of STOFFREGISTER.kategorier) {
      if (k.underkategorier.length === 0) continue
      const iUnder = new Set(k.underkategorier.flatMap((u) => u.stoffer.map((s) => s.slug)))
      expect(k.stoffer.filter((s) => !iUnder.has(s.slug)), k.navn).toEqual([])
    }
  })
})

describe('kategoriene til ett stoff', () => {
  it('gir underkategorien når kategorien er delt opp', () => {
    expect(STOFFREGISTER.kategorierFor('sertralin')).toEqual([{ kategori: 'Antidepressiver', underkategori: 'SSRI' }])
    expect(STOFFREGISTER.kategorierFor('bupropion')).toEqual([{ kategori: 'Antidepressiver', underkategori: 'NDRI' }])
  })

  it('gir hver kategori stoffet står i, i registerets rekkefølge', () => {
    expect(STOFFREGISTER.kategorierFor('lamotrigin')).toEqual([{ kategori: 'Stemningsstabiliserende' }, { kategori: 'Antiepileptika' }])
    expect(STOFFREGISTER.kategorierFor('ketamin')).toEqual([
      { kategori: 'Antidepressiver', underkategori: 'NMDA-reseptorantagonister' },
      { kategori: 'Hallusinogene stoffer' },
    ])
  })

  it('stemmer med sidemenyen for hvert stoff', () => {
    for (const stoff of STOFFREGISTER.stoffer) {
      const iMenyen = STOFFREGISTER.kategorier.flatMap((k) =>
        k.underkategorier.length > 0
          ? k.underkategorier.filter((u) => u.stoffer.some((s) => s.slug === stoff.slug)).map((u) => `${k.navn} › ${u.navn}`)
          : k.stoffer.some((s) => s.slug === stoff.slug)
            ? [k.navn]
            : [],
      )
      const stier = STOFFREGISTER.kategorierFor(stoff.slug).map((k) =>
        k.underkategori ? `${k.kategori} › ${k.underkategori}` : k.kategori,
      )
      expect(stier, stoff.slug).toEqual(iMenyen)
    }
  })
})

describe('kategoriikonene', () => {
  it('gir hver kategori i datafilen sitt eget ikon fra ikonregisteret', () => {
    const ikoner = STOFFREGISTERDATA.kategorier.map((k) => k.ikon)
    for (const [i, ikon] of ikoner.entries()) {
      const navn = STOFFREGISTERDATA.kategorier[i]!.navn
      expect(IKONNAVN, navn).toContain(ikon)
      expect(ikon, navn).not.toBe(KATEGORIIKON_PLASSHOLDER)
    }
    expect(new Set(ikoner).size).toBe(ikoner.length)
    expect(STOFFREGISTER.kategorier.map((k) => k.ikon)).toEqual(ikoner)
  })

  it('gir plassholderen til en kategori uten ikon eller med et ukjent navn', () => {
    const data: Registerdata = {
      ...STOFFREGISTERDATA,
      kategorier: [{ navn: 'Ny kategori', stoffer: ['diazepam'] }],
    }
    const register = byggStoffregister([], data)
    const [ny, andre] = register.kategorier
    expect(ny?.ikon).toBeUndefined()
    expect(andre?.navn).toBe(ANDRE_STOFFER)
    expect(kategoriikon(ny?.ikon)).toBe(KATEGORIIKON_PLASSHOLDER)
    expect(kategoriikon(andre?.ikon)).toBe(KATEGORIIKON_PLASSHOLDER)
    expect(kategoriikon('finnesIkke')).toBe(KATEGORIIKON_PLASSHOLDER)
    expect(kategoriikon('toString')).toBe(KATEGORIIKON_PLASSHOLDER)
    expect(kategoriikon('katOpioider')).toBe('katOpioider')
  })
})
