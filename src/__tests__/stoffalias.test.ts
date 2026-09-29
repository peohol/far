import { describe, expect, it } from 'vitest'
import { ANALYTTKATALOG, FORTOLKNINGSOPPFORINGER } from '../domain/analyttkatalog'
import { search } from '../domain/search'
import { navnenokkel } from '../domain/sokenavn'
import { STOFFREGISTER, STOFFREGISTERDATA, kontrollerStoffregister, type Registerdata } from '../domain/stoffregister'
import { indekserKunnskapsbase } from '../faginnhold/globaltSok'
import { lagSokeindeks, sokGlobalt } from '../faginnhold/sok'

/**
 * Aliasene i stoffregisteret er likestilte søkenavn for stoffet: et eksakt
 * alias finner stoffsiden like direkte som navnet, både i fagsøket og i
 * søket etter analytter i fortolkningen, og aldri en annen side.
 */

const indeks = lagSokeindeks(indekserKunnskapsbase({ sider: [], legemidler: null, interaksjoner: null }))

/** Det beste treffet i fagsøket: stoffet og poengene. */
function forste(sporring: string) {
  const [treff] = sokGlobalt(indeks, sporring)
  return treff && { stoff: treff.dokument.sted.side.stoff, poeng: treff.poeng }
}

function koder(sporring: string): string[] {
  return search(sporring, FORTOLKNINGSOPPFORINGER).map((h) => h.analyte.kode)
}

describe('navnenøkkelen', () => {
  it.each([
    ['Δ9-THC', 'delta-9-THC', 'delta 9 thc', 'DELTA9THC'],
    ['THC-COOH', 'THCCOOH', 'thc cooh', 'Thc-cooh'],
    ['quetiapine', 'quetiapin', 'Kvetiapin', 'KVETIAPIN'],
    ['clozapine', 'klozapin', 'Klozapin', 'klozapine'],
    ['EXP-3174', 'EXP3174', 'exp 3174', 'eksp3174'],
    ['γ-hydroxybutyrate', 'gamma-hydroxybutyrate', 'gamma hydroksybutyrat', 'Gamma-Hydroksybutyrat'],
    ['ethyl sulphate', 'etylsulfat', 'ethyl sulfate', 'Etyl-sulfat'],
    ['hydroksysmørsyre', 'hydroksysmorsyre', 'Hydroksysmørsyre', 'HYDROKSYSMØRSYRE'],
  ])('ser bort fra skrivemåten: %s', (...varianter) => {
    expect(new Set(varianter.map(navnenokkel)).size).toBe(1)
  })

  it('holder ulike stoffer fra hverandre', () => {
    expect(navnenokkel('citalopram')).not.toBe(navnenokkel('escitalopram'))
    expect(navnenokkel('amfetamin')).not.toBe(navnenokkel('metamfetamin'))
    expect(navnenokkel('')).toBe('')
    expect(navnenokkel('– ·')).toBe('')
  })
})

describe('aliasene i fagsøket', () => {
  it.each([
    ['CBD', 'cannabidiol'],
    ['cannabidiol', 'cannabidiol'],
    ['quetiapine', 'kvetiapin'],
    ['kvetiapin', 'kvetiapin'],
    ['alcohol', 'etanol'],
    ['alkohol', 'etanol'],
    ['etanol', 'etanol'],
    ['sodium oxybate', 'ghb'],
    ['natriumoksybat', 'ghb'],
    ['GHB', 'ghb'],
    ['nordazepam', 'diazepam'],
    ['diazepam', 'diazepam'],
    ['THC-COOH', 'thc'],
    ['THCCOOH', 'thc'],
    ['thc cooh', 'thc'],
    ['Δ9-THC', 'thc'],
    ['delta 9 thc', 'thc'],
    ['THC', 'thc'],
    ['paliperidone', 'paliperidon'],
    ['9-hydroxyrisperidone', 'paliperidon'],
    ['9-hydroksyrisperidon', 'paliperidon'],
    ['hydroksyrisperidon', 'paliperidon'],
    ['paliperidon', 'paliperidon'],
    ['spironolactone', 'kanrenon'],
    ['kokain', 'benzoylekgonin'],
  ])('«%s» gir %s først, som et eksakt navn', (sporring, stoff) => {
    expect(forste(sporring)).toEqual({ stoff, poeng: 0 })
  })

  it('rangerer et eksakt alias som et eksakt navn, foran et navn som bare begynner med søket', () => {
    // «meth» er et alias for Metamfetamin; Metadon begynner bare med det.
    expect(forste('meth')).toEqual({ stoff: 'metamfetamin', poeng: 0 })
    expect(forste('CBD')!.poeng).toBe(forste('Cannabidiol')!.poeng)
  })

  it('er ufølsom for store bokstaver, bindestrek og mellomrom, og norsk og engelsk stavemåte', () => {
    for (const sporring of ['QUETIAPINE', 'Quetiapin', 'kvetiapine']) expect(forste(sporring)?.stoff).toBe('kvetiapin')
    for (const sporring of ['EXP 3174', 'exp3174', 'EXP-3174']) expect(forste(sporring)?.stoff).toBe('losartansyre')
    for (const sporring of ['o desmetyltramadol', 'O-DSMT', 'odsmt']) expect(forste(sporring)?.stoff).toBe('tramadol')
  })

  it('finner hvert stoff først på hvert av aliasene sine', () => {
    for (const stoff of STOFFREGISTER.stoffer) {
      for (const alias of stoff.aliaser) expect(forste(alias), `${alias} → ${stoff.slug}`).toEqual({ stoff: stoff.slug, poeng: 0 })
    }
  })

  it('lar aldri et alias føre til en annen side enn stoffets', () => {
    for (const stoff of STOFFREGISTER.stoffer) {
      for (const alias of stoff.aliaser) {
        const andre = sokGlobalt(indeks, alias).filter(
          (t) => t.dokument.felt === 'alias' && t.dokument.sted.side.stoff !== stoff.slug && t.poeng === 0,
        )
        expect(andre, alias).toEqual([])
      }
    }
  })

  it('lar Risperidon-siden være uten hydroksyrisperidon som alias', () => {
    const risperidon = indeks.dokumenter.filter((d) => d.sted.side.stoff === 'risperidon' && d.felt === 'alias')
    expect(risperidon.map((d) => d.tekst)).toEqual(['risperidone'])
  })
})

describe('aliasene i søket etter analytter', () => {
  it.each([
    ['quetiapine', 'KVE'],
    ['kvetiapin', 'KVE'],
    ['paliperidone', 'PALI'],
    ['9-hydroxyrisperidone', 'PALI'],
    ['spironolakton', 'KANR'],
    ['THC-COOH', 'IRCAK'],
    ['delta 9 thc', 'THC'],
    ['alcohol', 'UETGS · UETS'],
    ['nordazepam', 'DIAZ · DMI · OXA'],
    ['cocaine', 'BEZ1'],
    ['ecstasy', 'ECS1'],
  ])('«%s» gir %s først', (sporring, kode) => {
    expect(koder(sporring)[0]).toBe(kode)
  })

  it('finner både analysen for stoffet og sumanalysen det inngår i', () => {
    // Sumanalysen har hydroksyrisperidon som delanalytt, så begge er eksakte treff.
    expect(koder('hydroksyrisperidon').slice(0, 2).sort()).toEqual(['PALI', 'RISPSUM'])
  })
})

describe('kollisjonskontrollen', () => {
  function med(stoffer: Registerdata['stoffer']): Registerdata {
    return { ...STOFFREGISTERDATA, stoffer: [...STOFFREGISTERDATA.stoffer, ...stoffer] }
  }

  it('godtar registeret slik det står', () => {
    expect(kontrollerStoffregister()).toEqual([])
  })

  it('stopper et alias som er et annet stoffs navn, også skrevet på en annen måte', () => {
    expect(kontrollerStoffregister(med([{ slug: 'x', navn: 'X', aliaser: ['Kvetiapine'] }]))).toContain(
      'Aliaset «Kvetiapine» (x) er det samme navnet som et annet stoff har.',
    )
  })

  it('stopper et alias som står på to stoffer, også skrevet på en annen måte', () => {
    expect(kontrollerStoffregister(med([{ slug: 'x', navn: 'X', aliaser: ['THC COOH'] }]))).toContain(
      'Aliaset «THC COOH» (x) er det samme navnet som et annet stoff har.',
    )
  })

  it('lar ingen alias være koden til en analytt et annet stoff er primært stoff for', () => {
    const kodeeier = new Map(
      ANALYTTKATALOG.oppforinger.flatMap((a) => {
        const stoff = STOFFREGISTER.primartStoffFor(a.kode)
        return stoff ? [[navnenokkel(a.kode), stoff.slug] as const] : []
      }),
    )
    for (const stoff of STOFFREGISTER.stoffer) {
      for (const alias of stoff.aliaser) {
        const eier = kodeeier.get(navnenokkel(alias))
        if (eier) expect(eier, alias).toBe(stoff.slug)
      }
    }
  })

  it('fører et navn skrevet på en annen måte til stoffet, som for en gammel adresse', () => {
    expect(STOFFREGISTER.kanonisk('Quetiapin')?.slug).toBe('kvetiapin')
    expect(STOFFREGISTER.kanonisk('delta 9 THC')?.slug).toBe('thc')
    expect(STOFFREGISTER.kanonisk('hydroksyrisperidon')?.slug).toBe('paliperidon')
    expect(STOFFREGISTER.kanonisk('ukjentstoff')).toBeUndefined()
  })
})
