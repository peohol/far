/**
 * Farmakodynamikken som mekanismekort: datasettet som gjør den gamle
 * friteksten om til kort, og migrasjonen som gjør det i databasen.
 *
 * Fasiten er `docs/farmakodynamikk-kort-kartlegging.md`. Datasettet
 * (`supabase/import/farmakodynamikk/<stoff>.json`) har én fil per stoff med
 * farmakodynamikktekst: filen teksten ble importert fra (`kilde`), kortene i
 * kartleggingens rekkefølge, og setningene i teksten som kortfeltene alene
 * gjengir fullt ut (`dekket`). Den utdypende teksten på kortene er setningene
 * fra kilden, ordrett. Kontrollen sikrer begge veier at ingenting går tapt og
 * ingenting kommer til: hver setning i kilden står på et kort eller i
 * `dekket`, og hver setning på et kort står i kilden. Stoffer uten tekst har
 * ingen fil og får ingen kort.
 *
 * Migrasjonen gjør om bare en tekst som står nøyaktig som den ble importert,
 * uten upublisert utkast. Kortene arver kildene til teksten, og teksten flyttes
 * til «fjernet», så den finnes i historikken, men ikke vises ved siden av
 * kortene. Uten administratoren gjør den ingenting, som importene.
 *
 * Modulen brukes av skriptet og testene, ikke av appen.
 */
import { Importfeil, innlogging, lit, tilDokument, type Importfil, type Tekstblokk } from './import'
import { erMekanisme, erRetning } from './mekanismer'
import { ELEMENTTYPER, FJERNET, kontrollerMekanismekort, lesMekanismekort, mekanismekortTilData } from './paneler'
import { rensDokument, type Riktekstdokument } from './riktekst'

/** Panelet kortene står i. */
export const FARMAKODYNAMIKK = 'farmakodynamikk'

/** Et kort slik datasettet skriver det: feltene på kortet, og den utdypende teksten som avsnitt. */
export interface Kildekort {
  maal: string
  effekt: string
  mekanisme: string
  retning: string
  kvalifikasjon?: string
  merknad?: string
  utdyping?: Tekstblokk[]
}

export interface Kartleggingsfil {
  /** Nøkkelen til stoffet i stoffregisteret, som også er nøkkelen til fagsiden. */
  stoff: string
  /** Importfilen teksten kom fra, relativt til `supabase/import/`. */
  kilde: string
  kort: Kildekort[]
  /** Setningene i kilden som bare gjengis av feltene på kortene, ikke som utdypende tekst. */
  dekket?: string[]
}

/** En side som skal gjøres om: teksten slik den står, og kortene den blir til. */
export interface Konvertering {
  stoff: string
  fra: Riktekstdokument
  kort: Record<string, unknown>[]
}

/** Kilden revisjonene får i historikken. */
const KARTLEGGING = 'kartleggingen i docs/farmakodynamikk-kort-kartlegging.md'
export const KORTKILDE = `Farmakodynamikken strukturert som mekanismekort etter ${KARTLEGGING}`
export const TEKSTKILDE = `Farmakodynamikkteksten erstattet av mekanismekort etter ${KARTLEGGING}`

const DATASETT = 'farmakodynamikk/'

/**
 * Filene under `supabase/import/`, lest med `import.meta.glob`: datasettet og
 * importfilene tekstene kom fra. Nøkkelen er stien fra `supabase/import/`.
 */
export function farmakodynamikkfiler(): Record<string, unknown> {
  const filer = import.meta.glob<unknown>(
    ['../../supabase/import/farmakodynamikk/*.json', '../../supabase/import/psykofarmaka/*.json', '../../supabase/import/antihypertensiver/*.json'],
    { eager: true, import: 'default' },
  )
  return Object.fromEntries(Object.entries(filer).map(([sti, fil]) => [sti.slice(sti.indexOf('supabase/import/') + 'supabase/import/'.length), fil]))
}

/* --- Setningene ------------------------------------------------------------ */

/** Setningsskillet i kildene: punktum, utrop eller spørsmål, så stor forbokstav. */
const SETNINGSSKILLE = /(?<=[.!?])\s+(?=[A-ZÆØÅ])/

/** Setningene i teksten: avsnittene delt i setninger, og hvert listepunkt for seg. */
export function setninger(blokker: readonly Tekstblokk[]): string[] {
  return blokker.flatMap((b) => (typeof b === 'string' ? b.split(SETNINGSSKILLE) : b.punkter)).map((s) => s.trim())
}

/* --- Kontrollen ------------------------------------------------------------ */

const erObjekt = (verdi: unknown): verdi is Record<string, unknown> =>
  typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)

const erTekst = (verdi: unknown): verdi is string => typeof verdi === 'string' && verdi.trim() !== ''

function erTekstblokker(verdi: unknown): verdi is Tekstblokk[] {
  return (
    Array.isArray(verdi) &&
    verdi.every((b) => erTekst(b) || (erObjekt(b) && Array.isArray(b.punkter) && b.punkter.length > 0 && b.punkter.every(erTekst)))
  )
}

/** Feltene på kortet som `data`, med den utdypende teksten som riktekst. */
export function mekanismekortdata(kort: Kildekort): Record<string, unknown> {
  return mekanismekortTilData(
    lesMekanismekort({ ...kort, dokument: tilDokument(kort.utdyping ?? []) }),
  )
}

/** Teksten i importfilen, eller ingenting når filen ikke har farmakodynamikk. */
function kildetekst(fil: unknown): Tekstblokk[] | undefined {
  const tekst = erObjekt(fil) ? (fil as Importfil).farmakodynamikk?.tekst : undefined
  return erTekstblokker(tekst) && tekst.length > 0 ? tekst : undefined
}

/** Feilene i ett kort. */
function kortfeil(kort: unknown, hvor: string): string[] {
  if (!erObjekt(kort)) return [`${hvor} må være et objekt`]
  const feil: string[] = []
  for (const felt of Object.keys(kort)) {
    if (!['maal', 'effekt', 'mekanisme', 'retning', 'kvalifikasjon', 'merknad', 'utdyping'].includes(felt)) feil.push(`${hvor}: ukjent felt «${felt}»`)
  }
  if (!erMekanisme(kort.mekanisme)) feil.push(`${hvor}: ukjent mekanisme «${String(kort.mekanisme)}»`)
  if (!erRetning(kort.retning)) feil.push(`${hvor}: ukjent retning «${String(kort.retning)}»`)
  for (const felt of ['kvalifikasjon', 'merknad'] as const) {
    if (kort[felt] !== undefined && !erTekst(kort[felt])) feil.push(`${hvor}: «${felt}» må være en tekst`)
  }
  if (kort.utdyping !== undefined && !erTekstblokker(kort.utdyping)) feil.push(`${hvor}: «utdyping» må være en liste med avsnitt eller punktlister`)
  if (feil.length) return feil
  const data = mekanismekortdata(kort as unknown as Kildekort)
  const problem = kontrollerMekanismekort(lesMekanismekort(data))
  if (problem) feil.push(`${hvor}: ${problem}`)
  if (data.dokument && JSON.stringify(rensDokument(data.dokument)) !== JSON.stringify(data.dokument)) {
    feil.push(`${hvor}: den utdypende teksten har formatering appen ikke viser`)
  }
  return feil
}

/**
 * Kontrollerer datasettet mot importfilene og lister alle feilene samtidig:
 * hvert kort, og at setningene i kilden og på kortene er de samme.
 */
export function kontrollerKartlegging(filer: Readonly<Record<string, unknown>>): Kartleggingsfil[] {
  const feil: string[] = []
  const stoffer = new Set<string>()
  const kartlegging = Object.entries(filer)
    .filter(([sti]) => sti.startsWith(DATASETT))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sti, fil]) => {
      if (!erObjekt(fil)) return void feil.push(`${sti} må være et objekt`)
      if (!erTekst(fil.stoff) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fil.stoff)) return void feil.push(`${sti}: «stoff» må være nøkkelen til stoffet`)
      const hvor = fil.stoff
      if (stoffer.has(hvor)) feil.push(`${hvor}: står i mer enn én fil`)
      stoffer.add(hvor)
      const tekst = erTekst(fil.kilde) ? kildetekst(filer[fil.kilde]) : undefined
      if (!tekst) feil.push(`${hvor}: kilden «${String(fil.kilde)}» finnes ikke eller har ingen farmakodynamikktekst`)
      const kort: unknown[] = Array.isArray(fil.kort) ? fil.kort : []
      if (kort.length === 0) feil.push(`${hvor}: «kort» må være en liste med minst ett kort`)
      const korterfeil = kort.flatMap((k, i) => kortfeil(k, `${hvor}, kort ${i + 1}`))
      feil.push(...korterfeil)
      const dekket = fil.dekket ?? []
      if (!Array.isArray(dekket) || !dekket.every(erTekst)) feil.push(`${hvor}: «dekket» må være en liste med setninger`)
      if (!tekst || korterfeil.length || !Array.isArray(dekket)) return undefined

      const iKilden = setninger(tekst)
      const paaKortene = setninger((kort as Kildekort[]).flatMap((k) => k.utdyping ?? []))
      const gjengitt = new Set([...paaKortene, ...(dekket as string[])])
      for (const s of iKilden) if (!gjengitt.has(s)) feil.push(`${hvor}: setningen «${s}» står ikke på noe kort`)
      const kilde = new Set(iKilden)
      for (const s of [...paaKortene, ...(dekket as string[])]) if (!kilde.has(s)) feil.push(`${hvor}: «${s}» står ikke i kilden`)
      return fil as unknown as Kartleggingsfil
    })
  if (feil.length) throw new Importfeil(feil)
  return kartlegging as Kartleggingsfil[]
}

/* --- Planen og migrasjonen -------------------------------------------------- */

/** Sidene som gjøres om, i stoffenes rekkefølge. */
export function farmakodynamikkplan(filer: Readonly<Record<string, unknown>> = farmakodynamikkfiler()): Konvertering[] {
  return kontrollerKartlegging(filer).map((fil) => ({
    stoff: fil.stoff,
    fra: tilDokument(kildetekst(filer[fil.kilde])!),
    kort: fil.kort.map(mekanismekortdata),
  }))
}

/**
 * SQL-en som gjør tekstene om til kort, som én migrasjon. For hver side:
 * teksten i farmakodynamikken, slik den ble importert og uten upublisert
 * utkast; ellers gjøres ingenting med siden, og databasen melder fra. Kortene
 * legges inn i rekkefølge med kildene til teksten og publiseres, og teksten
 * flyttes til «fjernet». En side som alt er gjort om, har ingen tekst igjen,
 * så migrasjonen kan kjøres flere ganger.
 */
export function farmakodynamikkSql(plan: readonly Konvertering[], admin: string): string {
  return `-- Farmakodynamikken som mekanismekort (docs/farmakodynamikk-kort-kartlegging.md)
do $farmakodynamikk$
declare
  administrator uuid;
  konvertering jsonb;
  side uuid;
  e record;
  kort jsonb;
  posisjon bigint;
  objekt uuid;
begin
${innlogging(admin, 'hopp over')}

  for konvertering in select * from jsonb_array_elements(${lit(JSON.stringify(plan))}::jsonb) loop
    select s.objekt_id into side from public.infosider s where s.tilstand = 'publisert' and s.slug = konvertering->>'stoff';

    -- Teksten slik den ble importert, uten upublisert utkast.
    select u.objekt_id, u.revisjon, r.innhold into e
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where t.tilstand = 'publisert' and t.infoside_id = side
      and t.panel = ${lit(FARMAKODYNAMIKK)} and t.elementtype = ${lit(ELEMENTTYPER.riktekst)}
      and r.innhold->'data'->'dokument' = konvertering->'fra'
    order by t.posisjon, t.objekt_id
    limit 1;
    if not found then
      raise notice 'Gjør ikke om farmakodynamikken på %: fant ikke teksten slik den ble importert, eller den har et upublisert utkast.',
        konvertering->>'stoff';
      continue;
    end if;

    -- Kortene, i rekkefølge, med kildene til teksten.
    perform set_config('far.revisjonskilde', ${lit(KORTKILDE)}, true);
    for kort, posisjon in select k, i - 1 from jsonb_array_elements(konvertering->'kort') with ordinality as a(k, i) loop
      objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
        'infoside', side,
        'panel', ${lit(FARMAKODYNAMIKK)},
        'posisjon', posisjon,
        'elementtype', ${lit(ELEMENTTYPER.mekanisme)},
        'data', kort
      ) || jsonb_strip_nulls(jsonb_build_object('referanser', e.innhold->'referanser')))).id;
      perform public.publiser_utkast(objekt, 1);
    end loop;

    -- Teksten tas bort fra siden, men står i historikken.
    perform set_config('far.revisjonskilde', ${lit(TEKSTKILDE)}, true);
    perform public.lagre_utkast(e.objekt_id, e.revisjon, jsonb_set(e.innhold, '{panel}', to_jsonb(${lit(FJERNET)}::text)));
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;
end
$farmakodynamikk$;`
}

/**
 * Omgjøringen som migrasjoner på høyst `maksTegn` tegn hver, med stoffene i
 * rekkefølge (et stoff som alene er større, får en migrasjon for seg).
 */
export function farmakodynamikkmigrasjoner(plan: readonly Konvertering[], admin: string, maksTegn = 50_000): string[] {
  const grupper: Konvertering[][] = []
  for (const konvertering of plan) {
    const siste = grupper.at(-1)
    if (siste && farmakodynamikkSql([...siste, konvertering], admin).length <= maksTegn) siste.push(konvertering)
    else grupper.push([konvertering])
  }
  return grupper.map((gruppe) => farmakodynamikkSql(gruppe, admin))
}
