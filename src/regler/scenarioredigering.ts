/**
 * Endringene redigeringen gjør på et scenarioregelsett, som rene funksjoner.
 *
 * Redigeringen endrer det en fagperson skriver og justerer: grensene,
 * tekstene og hvilken kommentar hver plassering bruker. Hvilke scenarier som
 * finnes, hva som er påvist i dem og vilkårene står fast; de er modellen
 * (`docs/scenarioregler.md`), og ingen generell regelbygger.
 *
 * Kommentarene er egne objekter. Utkastet har tekstene ved siden av
 * regelsettet, etter ID, og lagres som regelsettet og de nye og endrede
 * kommentarene sammen (`lagre_scenarioregelsett` i databasen).
 */
import { validerKommentar, type Kommentarinnhold, type Kommentaroppslag } from '../domain/kommentarobjekt'
import { validerScenarioregelsett, type Scenario, type Scenarioregelsett } from '../domain/scenario'
import { somProsent } from '../domain/scenario'
import { beskrivForhold, beskrivRegelsett, OPERATORTEGN } from '../domain/scenariovisning'
import type { Felt } from '../faginnhold/historikk'
import type { Kommentarvisning } from './visning'
import type { Scenarioregelsettutgave, Utgave } from '../faginnhold/lesing'
import { kommentaroppslag, tekstendringer, type Kommentarendring } from './kommentarer'
import { nyKommentarId, type NyId } from './redigering'

/** Et regelsett under redigering, med tekstene til kommentarene redigeringen kjenner. */
export interface Scenarioutkast {
  regelsett: Scenarioregelsett
  tekster: Kommentaroppslag
}

/** Utgaven som utkast til redigeringen. */
export function tilScenarioutkast(utgave: Scenarioregelsettutgave): Scenarioutkast {
  return { regelsett: utgave.regelsett.innhold, tekster: kommentaroppslag(utgave.kommentarer) }
}

/** ID-ene til kommentarene regelsettet bruker, i den rekkefølgen de brukes, hver én gang. */
export function scenariokommentarer(regelsett: Scenarioregelsett): string[] {
  return [
    ...new Set(
      regelsett.scenarier.flatMap((s) => (s.utfall.type === 'kommentarer' ? s.utfall.plasseringer.map((p) => p.kommentar) : [])),
    ),
  ]
}

/* --- Endringene ----------------------------------------------------------- */

function endreScenario(regelsett: Scenarioregelsett, nokkel: string, endre: (s: Scenario) => Scenario): Scenarioregelsett {
  return { ...regelsett, scenarier: regelsett.scenarier.map((s) => (s.nokkel === nokkel ? endre(s) : s)) }
}

/** Grensen som andel: 0,1 er 10 %. */
export function settGrense(regelsett: Scenarioregelsett, nokkel: string, verdi: number): Scenarioregelsett {
  return { ...regelsett, parametere: regelsett.parametere.map((p) => (p.nokkel === nokkel ? { ...p, verdi } : p)) }
}

export function settGrensenavn(regelsett: Scenarioregelsett, nokkel: string, navn: string): Scenarioregelsett {
  return { ...regelsett, parametere: regelsett.parametere.map((p) => (p.nokkel === nokkel ? { ...p, navn } : p)) }
}

export function settVerdihjelp(regelsett: Scenarioregelsett, verdihjelp: string): Scenarioregelsett {
  return { ...regelsett, verdihjelp }
}

/** Meldingen som vises når nevneren i forholdstallet er 0. */
export function settNullmelding(regelsett: Scenarioregelsett, forhold: string, nullmelding: string): Scenarioregelsett {
  return { ...regelsett, forhold: regelsett.forhold.map((f) => (f.nokkel === forhold ? { ...f, nullmelding } : f)) }
}

/** Meldingen i et scenario som skal vurderes manuelt. */
export function settMelding(regelsett: Scenarioregelsett, scenario: string, melding: string): Scenarioregelsett {
  return endreScenario(regelsett, scenario, (s) => (s.utfall.type === 'manuell' ? { ...s, utfall: { ...s.utfall, melding } } : s))
}

/** Notisene over kommentarene, eller veiledningen ved en manuell vurdering. */
export type Tekstliste = 'notiser' | 'veiledning'

export function settTekstliste(
  regelsett: Scenarioregelsett,
  scenario: string,
  liste: Tekstliste,
  tekster: string[],
): Scenarioregelsett {
  return endreScenario(regelsett, scenario, (s) => {
    if (liste === 'notiser' && s.utfall.type === 'kommentarer') return { ...s, utfall: { ...s.utfall, notiser: tekster } }
    if (liste === 'veiledning' && s.utfall.type === 'manuell') return { ...s, utfall: { ...s.utfall, veiledning: tekster } }
    return s
  })
}

/** Lar plasseringen med merket bruke en annen kommentar. */
export function brukKommentar(regelsett: Scenarioregelsett, scenario: string, merke: string, id: string): Scenarioregelsett {
  return endreScenario(regelsett, scenario, (s) =>
    s.utfall.type === 'kommentarer'
      ? {
          ...s,
          utfall: {
            ...s.utfall,
            plasseringer: s.utfall.plasseringer.map((p) => (p.merke === merke ? { ...p, kommentar: id } : p)),
          },
        }
      : s,
  )
}

/** Ny tekst i kommentaren. Den gjelder alle plasseringene som bruker den. */
export function settKommentartekst(utkast: Scenarioutkast, id: string, tekst: string): Scenarioutkast {
  return { ...utkast, tekster: new Map(utkast.tekster).set(id, tekst) }
}

/**
 * Gir plasseringen sin egen kommentar, med samme tekst som den har nå, så
 * teksten kan endres der uten å endre den for de andre som bruker den.
 */
export function egenKommentar(
  utkast: Scenarioutkast,
  scenario: string,
  merke: string,
  nyId: NyId = nyKommentarId,
): Scenarioutkast {
  const s = utkast.regelsett.scenarier.find((x) => x.nokkel === scenario)
  const plassering = s?.utfall.type === 'kommentarer' ? s.utfall.plasseringer.find((p) => p.merke === merke) : undefined
  if (!plassering) return utkast
  const id = nyId()
  return {
    regelsett: brukKommentar(utkast.regelsett, scenario, merke, id),
    tekster: new Map(utkast.tekster).set(id, utkast.tekster.get(plassering.kommentar) ?? ''),
  }
}

/** Plasseringene som bruker kommentaren: scenariet og merket. */
export function kommentarbrukere(regelsett: Scenarioregelsett, id: string): { scenario: string; merke: string }[] {
  return regelsett.scenarier.flatMap((s) =>
    s.utfall.type === 'kommentarer'
      ? s.utfall.plasseringer.filter((p) => p.kommentar === id).map((p) => ({ scenario: s.nokkel, merke: p.merke }))
      : [],
  )
}

/* --- Før lagringen ----------------------------------------------------------- */

/** Utkastet med mellomrom i endene av tekstene fjernet, slik det lagres. */
export function klargjorScenarioutkast(utkast: Scenarioutkast): Scenarioutkast {
  const t = (tekst: string) => tekst.trim()
  const r = utkast.regelsett
  return {
    regelsett: {
      ...r,
      verdihjelp: t(r.verdihjelp),
      forhold: r.forhold.map((f) => ({ ...f, nullmelding: t(f.nullmelding) })),
      parametere: r.parametere.map((p) => ({ ...p, navn: t(p.navn) })),
      scenarier: r.scenarier.map((s) => ({
        ...s,
        utfall:
          s.utfall.type === 'manuell'
            ? { ...s.utfall, melding: t(s.utfall.melding), veiledning: s.utfall.veiledning.map(t) }
            : { ...s.utfall, notiser: s.utfall.notiser.map(t) },
      })),
    },
    tekster: new Map([...utkast.tekster].map(([id, tekst]) => [id, t(tekst)])),
  }
}

/**
 * Feilene i utkastet, slik appen og databasen kontrollerer dem: regelsettet
 * — med dekningen, så hver kombinasjon gir nøyaktig ett scenario — og
 * tekstene regelsettet bruker. `tekstnavn` sier hvilken tekst en feil gjelder.
 */
export function kontrollerScenarioutkast(utkast: Scenarioutkast, tekstnavn: (id: string) => string): string[] {
  const feil = validerScenarioregelsett(utkast.regelsett, utkast.tekster)
  for (const id of scenariokommentarer(utkast.regelsett)) {
    const tekst = utkast.tekster.get(id)
    if (tekst === undefined) continue
    // Navnet kontrolleres ikke her; det settes ved lagringen.
    for (const f of validerKommentar({ navn: '–', tekst, plassholdere: [] })) feil.push(`${tekstnavn(id)}: ${f}`)
  }
  return [...new Set(feil)]
}

/**
 * Navnet en ny kommentar får: modulen, hva som er påvist og merket, som
 * «Diazepam – påvist DIAZ + OXA – Hovedkommentar for oksazepam». Navnet følger
 * ikke med i pasientsvaret.
 */
export function scenariokommentarnavn(modulnavn: string, regelsett: Scenarioregelsett, id: string): string {
  for (const s of regelsett.scenarier) {
    if (s.utfall.type !== 'kommentarer') continue
    const plassering = s.utfall.plasseringer.find((p) => p.kommentar === id)
    if (plassering) return `${modulnavn} – påvist ${s.pavist.join(' + ')} – ${plassering.merke}`
  }
  return `${modulnavn} – kommentar`
}

/**
 * Kommentarene som må lagres for at regelsettet skal peke på det
 * redigeringen viser: de nye, og de som har fått en annen tekst. `lagrede`
 * er kommentarobjektene slik de er lest, den nyeste først.
 */
export function scenariokommentarendringer(
  utkast: Scenarioutkast,
  modulnavn: string,
  ...lagrede: readonly (readonly Utgave<Kommentarinnhold>[])[]
): Kommentarendring[] {
  return tekstendringer(
    scenariokommentarer(utkast.regelsett).map((id) => ({ id, tekst: utkast.tekster.get(id) ?? '' })),
    (id) => scenariokommentarnavn(modulnavn, utkast.regelsett, id),
    ...lagrede,
  )
}

/* --- Feltene ------------------------------------------------------------------ */

/** Scenariene i den rekkefølgen og med de numrene stoffsiden viser dem. */
export function scenarionumre(regelsett: Scenarioregelsett): Map<string, number> {
  return new Map(beskrivRegelsett(regelsett, new Map()).scenarier.map((b, i) => [b.scenario.nokkel, i + 1]))
}

/**
 * Feltene i et scenarioregelsett, slik historikken, konflikten og
 * oppsummeringen før publiseringen sammenligner dem: hjelpeteksten, grensene,
 * meldingene når et forholdstall ikke kan regnes ut, og for hvert scenario
 * vilkårene og utfallet. Scenariene kjennes igjen på nøkkelen og nummereres
 * som på stoffsiden; tekstene står slik de er skrevet, med `{grense}`.
 */
export function scenariofelter(regelsett: Scenarioregelsett, kommentar: Kommentarvisning): Felt[] {
  const grense = new Map(regelsett.parametere.map((p) => [p.nokkel, p]))
  const forhold = new Map(regelsett.forhold.map((f) => [f.nokkel, f]))
  const felter: Felt[] = []
  if (regelsett.forhold.length > 0 || regelsett.verdihjelp) {
    felter.push({ nokkel: 'verdihjelp', navn: 'Hjelpetekst for konsentrasjonene', verdi: regelsett.verdihjelp || 'Ingen', tekst: true })
  }
  regelsett.parametere.forEach((p, i) =>
    felter.push({ nokkel: `grense-${p.nokkel}`, gruppe: 'Grenser', navn: `Grense ${i + 1}`, verdi: `${p.navn}: ${somProsent(p.verdi)} %` }),
  )
  for (const f of regelsett.forhold) {
    felter.push({
      nokkel: `nullmelding-${f.nokkel}`,
      gruppe: 'Når forholdstallet ikke kan regnes ut',
      navn: beskrivForhold(f),
      verdi: f.nullmelding,
      tekst: true,
    })
  }
  const liste = (nokkel: string, gruppe: string, navn: string, tekster: string[]) =>
    tekster.forEach((verdi, i) =>
      felter.push({ nokkel: `${nokkel}-${i}`, gruppe, navn: tekster.length > 1 ? `${navn} ${i + 1}` : navn, verdi, tekst: true }),
    )

  const numre = scenarionumre(regelsett)
  const sortert = [...regelsett.scenarier].sort((a, b) => (numre.get(a.nokkel) ?? 0) - (numre.get(b.nokkel) ?? 0))
  for (const s of sortert) {
    const gruppe = `Scenario ${numre.get(s.nokkel)}`
    const ikke = regelsett.analytter.filter((k) => !s.pavist.includes(k))
    const vilkar = s.vilkar.map((v) => {
      const f = forhold.get(v.forhold)
      return `${f ? beskrivForhold(f) : v.forhold} ${OPERATORTEGN[v.operator]} ${grense.get(v.parameter)?.navn ?? v.parameter}`
    })
    felter.push({
      nokkel: `${s.nokkel}-vilkar`,
      gruppe,
      navn: 'Vilkår',
      verdi: [`Påvist: ${s.pavist.join(', ')}`, ikke.length > 0 && `Ikke påvist: ${ikke.join(', ')}`, ...vilkar]
        .filter(Boolean)
        .join('. '),
    })
    const u = s.utfall
    if (u.type === 'manuell') {
      felter.push({ nokkel: `${s.nokkel}-melding`, gruppe, navn: 'Manuell vurdering', verdi: u.melding, tekst: true })
      liste(`${s.nokkel}-veiledning`, gruppe, 'Veiledning', u.veiledning)
    } else {
      for (const p of u.plasseringer) {
        felter.push({ nokkel: `${s.nokkel}-${p.merke}`, gruppe, navn: p.merke, verdi: kommentar(p.kommentar), tekst: true })
      }
      liste(`${s.nokkel}-notis`, gruppe, 'Notis', u.notiser)
    }
  }
  return felter
}

/** Feltene i utkastet, med tekstene det har slått opp. */
export function utkastfelter(utkast: Scenarioutkast): Felt[] {
  return scenariofelter(utkast.regelsett, (id) => utkast.tekster.get(id) ?? '')
}

/* --- Meldingene ----------------------------------------------------------------- */

function escape(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * En feilmelding med scenariene og forholdstallene slik redigeringen viser
 * dem: «Scenario 3» i stedet for nøkkelen, «OXA / (DIAZ + DMI)» i stedet
 * for forholdets nøkkel og grensens navn i stedet for dens. `nummer` er scenarionummeret etter nøkkelen.
 */
export function lesbarFeil(melding: string, regelsett: Scenarioregelsett, nummer: ReadonlyMap<string, number>): string {
  let ut = melding
  for (const f of regelsett.forhold) {
    const nokkel = escape(f.nokkel)
    ut = ut
      .replace(new RegExp(`\\b${nokkel} =`, 'g'), `${beskrivForhold(f)} =`)
      .replace(new RegExp(`nevneren i ${nokkel}\\b`, 'g'), `nevneren i ${beskrivForhold(f)}`)
  }
  for (const p of regelsett.parametere) {
    ut = ut.replace(new RegExp(`Grensen ${escape(p.nokkel)}\\b`, 'g'), p.navn.trim() ? `Grensen «${p.navn.trim()}»` : 'En grense')
  }
  if (nummer.size === 0) return ut
  const scenario = (nokkel: string) => String(nummer.get(nokkel) ?? nokkel)
  const n = `(${[...nummer.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')})`
  return ut
    .replace(new RegExp(`Scenariene (${n}(?: og ${n})+)\\b`, 'g'), (_, liste: string) =>
      `Scenario ${liste.split(' og ').map(scenario).join(' og ')}`,
    )
    .replace(new RegExp(`Scenariet ${n}\\b`, 'g'), (_, a: string) => `Scenario ${scenario(a)}`)
    .replace(new RegExp(`\\bi ${n}\\b`, 'g'), (_, a: string) => `i scenario ${scenario(a)}`)
}
