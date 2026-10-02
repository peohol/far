import { describe, expect, it } from 'vitest'
import { IKONNAVN, KATEGORIIKON_PLASSHOLDER, kategoriikon } from '../../components/ikon/register'
import { filnokkel } from '../../faginnhold/import'
import { CBD_STOFFSIDER, NYE_STOFFSIDER } from '../../faginnhold/indikasjoner'
import { STOFFSIDE_DATASETT } from '../../faginnhold/stoffsider'
import { ANALYTTKATALOG } from '../analyttkatalog'
import { navnenokkel } from '../sokenavn'
import { GRUNNINNDELING, GRUNNSTRUKTUR, kategoriid } from '../../__tests__/hjelp/registerstruktur'
import {
  ANDRE_STOFFER,
  ANDRE_STOFFER_ID,
  byggStoffregister,
  kontrollerStoffregister,
  STOFFREGISTER,
  STOFFREGISTERDATA,
  stoffslug,
  type Registerdata,
  type Registerkategori,
  type Registerstruktur,
} from '../stoffregister'

/**
 * Stoffregisteret: stoffene med nøkkel og navn og de eksplisitte koblingene til
 * laboratorieanalyttene (`src/data/stoffregister.json`), og inndelingen i
 * kategorier, arkivet og papirkurven (databasen). Registeret er fasit for
 * stoffene; analyttkatalogen er det ikke.
 */

/** Registeret med inndelingen databasen får første gang. */
const REGISTER = byggStoffregister([], STOFFREGISTERDATA, GRUNNSTRUKTUR)

/** Stoffsidene importene lager. */
const IMPORTERTE = [...STOFFSIDE_DATASETT.filer.map(filnokkel), ...NYE_STOFFSIDER, ...CBD_STOFFSIDER]

/** Importerte sider en senere migrasjon har gitt stoffets navn (`*_cbd_stoffside.sql`). */
const OMDOPTE: Readonly<Record<string, string>> = { Cannabidiol: 'CBD' }

function kategori(navn: string, r: readonly Registerkategori[] = REGISTER.kategorier): Registerkategori {
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
    }
    const meldinger = kontrollerStoffregister(feil).join('\n')
    expect(meldinger).toContain('ugyldig nøkkel')
    expect(meldinger).toContain('er nøkkelen til et annet stoff')
    expect(meldinger).toContain('X har 2 primære stoffer')
    expect(meldinger).toContain('peker på et stoff som ikke finnes')
    expect(meldinger).toContain('ukjent relasjon')
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

})

describe('inndelingen databasen får første gang', () => {
  it('gir hvert stoff en plass i en kategori, så ingenting havner i «Andre stoffer»', () => {
    expect(REGISTER.kategorier.map((k) => k.navn)).not.toContain(ANDRE_STOFFER)
    for (const stoff of REGISTER.stoffer) {
      expect(REGISTER.kategorierFor(stoff.slug), stoff.slug).not.toEqual([{ kategori: ANDRE_STOFFER }])
    }
  })

  it('nevner bare stoffer som finnes', () => {
    for (const p of GRUNNSTRUKTUR.plasseringer) expect(STOFFREGISTER.finn(p.stoff), `${p.kategori}: ${p.stoff}`).toBeDefined()
  })

  it('har hver kategori og underkategori én gang, og hvert stoff én gang i hver', () => {
    const kategorinavn = GRUNNINNDELING.map((k) => k.navn)
    expect(new Set(kategorinavn).size).toBe(kategorinavn.length)
    for (const k of GRUNNINNDELING) {
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
    const r = byggStoffregister(
      [
        { id: '1', slug: 'bupropion', navn: 'Bupropion (Wellbutrin)', innhold: true },
        { id: '2', slug: 'teststoff', navn: 'Teststoff', innhold: false },
      ],
      STOFFREGISTERDATA,
      GRUNNSTRUKTUR,
    )
    expect(r.finn('bupropion')?.navn).toBe('Bupropion (Wellbutrin)')
    expect(r.kategorier.at(-1)).toMatchObject({
      id: ANDRE_STOFFER_ID,
      navn: ANDRE_STOFFER,
      underkategorier: [],
      stoffer: [{ slug: 'teststoff', navn: 'Teststoff', koder: [], side: true, innhold: false, analytter: false }],
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
    expect(REGISTER.kategorier.map((k) => k.navn)).toEqual([
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
    expect(benzo.find((s) => s.slug === 'diazepam')).toMatchObject({ slug: 'diazepam', navn: 'Diazepam', koder: ['DIAZ', 'DMI'] })
    expect(benzo.find((s) => s.slug === 'oksazepam')?.koder).toEqual(['OXA'])
    expect(navnI(kategori('Opioider'))).not.toContain('O-desmetyltramadol')
    expect(kategori('Opioider').stoffer.find((s) => s.slug === 'tramadol')?.koder).toEqual(['TRAM', 'OTRAM'])
    expect(kategori('Cannabinoider').stoffer.find((s) => s.slug === 'thc')).toMatchObject({ slug: 'thc', navn: 'THC', koder: ['THC', 'IRCAK'] })
    expect(kategori('Alkohol og GHB').stoffer.find((s) => s.slug === 'etanol')?.koder).toEqual(['UETGS', 'UETS'])
    const ad = kategori('Antidepressiver').stoffer
    expect(ad.find((s) => s.slug === 'bupropion')).toMatchObject({ slug: 'bupropion', navn: 'Bupropion', koder: ['HBUP'] })
    expect(ad.find((s) => s.slug === 'amitriptylin')?.koder).toEqual(['AMTNORSUM'])
    // Nortriptylin er sitt eget stoff; AMTNORSUM er ikke nortriptylins primære analytt.
    expect(ad.find((s) => s.slug === 'nortriptylin')?.koder).toEqual(['NOR'])
    expect(ad.map((s) => s.navn)).not.toContain('Hydroksybupropion')
    expect(kategori('Antipsykotika').stoffer.find((s) => s.slug === 'paliperidon')?.koder).toEqual(['PALI'])
    for (const k of REGISTER.kategorier) {
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
    for (const k of REGISTER.kategorier) {
      expect(navnI(k), k.navn).toEqual(alfabetisk(navnI(k)))
      for (const u of k.underkategorier) expect(navnI(k, u.navn), `${k.navn} › ${u.navn}`).toEqual(alfabetisk(navnI(k, u.navn)))
    }
  })

  it('har de samme stoffene med og uten underkategoriene', () => {
    for (const k of REGISTER.kategorier) {
      if (k.underkategorier.length === 0) continue
      const iUnder = new Set(k.underkategorier.flatMap((u) => u.stoffer.map((s) => s.slug)))
      expect(k.stoffer.filter((s) => !iUnder.has(s.slug)), k.navn).toEqual([])
    }
  })
})

describe('kategoriene til ett stoff', () => {
  it('gir underkategorien når kategorien er delt opp', () => {
    expect(REGISTER.kategorierFor('sertralin')).toEqual([{ kategori: 'Antidepressiver', ikon: 'katAntidepressiver', underkategori: 'SSRI' }])
    expect(REGISTER.kategorierFor('bupropion')).toEqual([{ kategori: 'Antidepressiver', ikon: 'katAntidepressiver', underkategori: 'NDRI' }])
  })

  it('gir hver kategori stoffet står i, i registerets rekkefølge', () => {
    expect(REGISTER.kategorierFor('lamotrigin')).toEqual([
      { kategori: 'Stemningsstabiliserende', ikon: 'katStemningsstabiliserende' },
      { kategori: 'Antiepileptika', ikon: 'katAntiepileptika' },
    ])
    expect(REGISTER.kategorierFor('ketamin')).toEqual([
      { kategori: 'Antidepressiver', ikon: 'katAntidepressiver', underkategori: 'NMDA-reseptorantagonister' },
      { kategori: 'Hallusinogene stoffer', ikon: 'katHallusinogener' },
    ])
  })

  it('stemmer med sidemenyen for hvert stoff', () => {
    for (const stoff of REGISTER.stoffer) {
      const iMenyen = REGISTER.kategorier.flatMap((k) => [
        ...(k.direkte.some((s) => s.slug === stoff.slug) ? [k.navn] : []),
        ...k.underkategorier.filter((u) => u.stoffer.some((s) => s.slug === stoff.slug)).map((u) => `${k.navn} › ${u.navn}`),
      ])
      const stier = REGISTER.kategorierFor(stoff.slug).map((k) =>
        k.underkategori ? `${k.kategori} › ${k.underkategori}` : k.kategori,
      )
      expect(stier, stoff.slug).toEqual(iMenyen)
    }
  })
})

describe('inndelingen i databasen', () => {
  const med = (endring: Partial<Registerstruktur>) => byggStoffregister([], STOFFREGISTERDATA, { ...GRUNNSTRUKTUR, ...endring })

  it('har ingen kategorier før inndelingen er hentet', () => {
    expect(STOFFREGISTER.lastet).toBe(false)
    expect(STOFFREGISTER.kategorier).toEqual([])
    expect(STOFFREGISTER.kategorierFor('sertralin')).toEqual([])
    expect(REGISTER.lastet).toBe(true)
  })

  it('tar med tomme kategorier og underkategorier i redigeringen, men ikke i menyen', () => {
    const r = med({
      kategorier: [
        ...GRUNNSTRUKTUR.kategorier,
        { id: 'tom', forelder: null, navn: 'Tom', posisjon: 0.5, ikon: 'pille', arkivert_kl: null },
        { id: 'tom-under', forelder: kategoriid('Opioider'), navn: 'Tom under', posisjon: 0, ikon: null, arkivert_kl: null },
      ],
    })
    expect(r.inndeling.map((k) => k.navn).slice(0, 3)).toEqual(['Antidepressiver', 'Tom', 'Stemningsstabiliserende'])
    expect(r.inndeling.find((k) => k.id === 'tom')).toMatchObject({ ikon: 'pille', stoffer: [] })
    expect(r.inndeling.find((k) => k.navn === 'Opioider')?.underkategorier.map((u) => u.navn)).toEqual(['Tom under'])
    expect(r.inndeling.at(-1)).toMatchObject({ id: ANDRE_STOFFER_ID, stoffer: [] })
    expect(r.kategorier.map((k) => k.navn)).not.toContain('Tom')
    expect(r.kategorier.find((k) => k.navn === 'Opioider')?.underkategorier).toEqual([])
    // Opioidene står direkte i kategorien, ved siden av den tomme underkategorien.
    expect(r.kategorierFor('morfin')).toEqual([{ kategori: 'Opioider', ikon: 'katOpioider' }])
  })

  it('legger stoffene i en arkivert kategori i «Andre stoffer», og teller dem i arkivet', () => {
    const r = med({
      kategorier: GRUNNSTRUKTUR.kategorier.map((k) =>
        k.id === kategoriid('Antidepressiver') ? { ...k, arkivert_kl: '2026-10-02T08:00:00Z' } : k,
      ),
    })
    expect(r.kategorier.map((k) => k.navn)).not.toContain('Antidepressiver')
    expect(r.kategorierFor('sertralin')).toEqual([{ kategori: ANDRE_STOFFER }])
    expect(r.kategorierFor('ketamin')).toEqual([{ kategori: 'Hallusinogene stoffer', ikon: 'katHallusinogener' }])
    expect(navnI(kategori(ANDRE_STOFFER, r.kategorier))).toContain('Sertralin')
    expect(r.arkiverteKategorier).toMatchObject([{ navn: 'Antidepressiver', forelder: null }])
    const ad = GRUNNINNDELING.find((k) => k.navn === 'Antidepressiver')!
    expect(r.arkiverteKategorier[0]!.antall).toBe(new Set(ad.underkategorier!.flatMap((u) => u.stoffer)).size)
  })

  it('tar arkiverte stoffer og stoffer i papirkurven ut av registeret, men finner dem fortsatt', () => {
    const r = med({
      status: [
        { stoff: 'sertralin', status: 'arkivert', endret_kl: '2026-10-01T08:00:00Z', endret_av: 'Lars Leser' },
        { stoff: 'karbamazepin', status: 'papirkurv', endret_kl: '2026-10-01T08:00:00Z', endret_av: null },
        { stoff: 'ghb', status: 'papirkurv', endret_kl: '2026-10-02T08:00:00Z', endret_av: null },
        { stoff: 'cbd', status: 'fjernet', endret_kl: '2026-10-02T08:00:00Z', endret_av: null },
      ],
    })
    expect(r.status('sertralin')).toBe('arkivert')
    expect(r.status('karbamazepin')).toBe('papirkurv')
    expect(r.status('cbd')).toBe('fjernet')
    expect(r.status('bupropion')).toBe('aktiv')
    expect(r.stoffer.map((s) => s.slug)).not.toContain('sertralin')
    expect(r.finn('sertralin')?.navn).toBe('Sertralin')
    expect(r.finn('cbd')).toBeUndefined()
    expect(r.kanonisk('Cannabidiol')).toBeUndefined()
    expect(navnI(kategori('Antidepressiver', r.kategorier), 'SSRI')).not.toContain('Sertralin')
    expect(navnI(kategori('Antiepileptika', r.kategorier))).not.toContain('Karbamazepin')
    expect(r.arkiv).toMatchObject([{ slug: 'sertralin', endret_av: 'Lars Leser' }])
    expect(r.papirkurv.map((s) => s.slug)).toEqual(['ghb', 'karbamazepin'])
    expect(r.kategorier.map((k) => k.navn)).not.toContain(ANDRE_STOFFER)
  })

  it('sier om hvert stoff har analytter, en fagside og innhold på den', () => {
    const r = byggStoffregister(
      [
        { id: '1', slug: 'karbamazepin', navn: 'Karbamazepin', innhold: false },
        { id: '2', slug: 'bupropion', navn: 'Bupropion' },
      ],
      STOFFREGISTERDATA,
      GRUNNSTRUKTUR,
    )
    expect(r.menystoff('karbamazepin')).toMatchObject({ side: true, innhold: false, analytter: false })
    // Uten svar om innholdet regnes siden som å ha det, så den ikke slettes ved en feil.
    expect(r.menystoff('bupropion')).toMatchObject({ side: true, innhold: true, analytter: true })
    expect(r.menystoff('etanol')).toMatchObject({ side: false, innhold: false, analytter: true })
  })
})

describe('kategoriikonene', () => {
  it('gir hver kategori i inndelingen databasen fikk først, sitt eget ikon fra ikonregisteret', () => {
    const ikoner = GRUNNINNDELING.map((k) => k.ikon)
    for (const [i, ikon] of ikoner.entries()) {
      const navn = GRUNNINNDELING[i]!.navn
      expect(IKONNAVN, navn).toContain(ikon)
      expect(ikon, navn).not.toBe(KATEGORIIKON_PLASSHOLDER)
    }
    expect(new Set(ikoner).size).toBe(ikoner.length)
    expect(REGISTER.kategorier.filter((k) => k.id !== ANDRE_STOFFER_ID).map((k) => k.ikon)).toEqual(ikoner)
  })

  it('gir plassholderen til en kategori uten ikon eller med et ukjent navn', () => {
    const register = byggStoffregister([], STOFFREGISTERDATA, {
      kategorier: [{ id: 'ny', forelder: null, navn: 'Ny kategori', posisjon: 0, ikon: null, arkivert_kl: null }],
      plasseringer: [{ stoff: 'diazepam', kategori: 'ny' }],
      status: [],
    })
    const [ny, andre] = register.kategorier
    expect(ny?.ikon).toBeNull()
    expect(andre?.navn).toBe(ANDRE_STOFFER)
    expect(kategoriikon(ny?.ikon)).toBe(KATEGORIIKON_PLASSHOLDER)
    expect(kategoriikon(andre?.ikon)).toBe(KATEGORIIKON_PLASSHOLDER)
    expect(kategoriikon('finnesIkke')).toBe(KATEGORIIKON_PLASSHOLDER)
    expect(kategoriikon('toString')).toBe(KATEGORIIKON_PLASSHOLDER)
    expect(kategoriikon('katOpioider')).toBe('katOpioider')
  })
})
