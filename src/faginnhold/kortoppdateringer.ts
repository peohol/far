/**
 * Oppdateringer av kort på sidene når en nyere kilde gir andre verdier eller
 * ny kunnskap enn den innholdet ble importert fra.
 *
 * Importen endrer aldri et kort som står fra før (se `FinnesFraFor` i
 * `import.ts`), så en nyere kilde føres inn med en oppdateringsfil
 * (`supabase/import/oppdateringer/*.json`): kilden, referansene den bruker, og
 * per oppdatering siden (analyttkoden eller navnet på stoffsiden), kortet,
 * innholdet slik det står nå, det nye innholdet (eller `null` for å ta kortet
 * bort), kildene som legges til og tas bort, og hvorfor.
 *
 * Kortet er et datakort i «Viktige data» (typen, som `referanseomrade`) eller
 * et kort med overskrift i et kortpanel (overskriften, som «Referansegrense»).
 * Bare et kort som står nøyaktig som oppgitt, og som ikke har et upublisert
 * utkast, oppdateres; ellers gjøres ingenting med det, og databasen melder
 * fra. Hver oppdatering blir en ny, publisert revisjon med «Oppdatert etter
 * <kilde>: <hvorfor>» i historikken. Uten administratoren gjør migrasjonen
 * ingenting, som importene.
 *
 * Modulen brukes av skriptet og testene, ikke av appen.
 */
import type { Analyttkatalog } from '../domain/analyttkatalog'
import { finnReferanse, Importfeil, innlogging, lit, tilDokument, type Tekstblokk } from './import'
import type { Referanseinnhold } from './modell'
import { datakortFor, ELEMENTTYPER, FJERNET, kontrollerIntervall, lesIntervallverdi, panelFor } from './paneler'
import { rensDokument } from './riktekst'

/** Innholdet i et kort, slik filen skriver det: tallene på et datakort, eller overskriften og teksten. */
export interface Kortinnhold {
  nedre?: number | null
  ovre?: number | null
  enhet?: string
  tittel?: string
  tekst?: Tekstblokk[]
}

export interface Kortoppdatering {
  /** Analyttkoden siden hører til. Nøyaktig én av `kode` og `side` står. */
  kode?: string
  /** Navnet på en stoffside uten analyttkode. */
  side?: string
  panel: string
  /** Typen til et datakort, eller overskriften til et kort i et kortpanel. */
  kort: string
  /** Kortet slik det står nå: feltene som oppgis, må være nøyaktig like. */
  fra: Kortinnhold
  /** Feltene som endres, eller `null` når kortet skal tas bort fra siden. */
  til: Kortinnhold | null
  /** Nøklene til kildene som legges til (først, i rekkefølge) og tas bort. */
  kilder?: { inn?: string[]; ut?: string[] }
  hvorfor: string
}

export interface Oppdateringsfil {
  /** Kilden oppdateringen bygger på, slik den leses etter «Oppdatert etter». */
  kilde: string
  /** Referansene oppdateringene bruker. En som ikke finnes, legges inn. */
  referanser: Record<string, Referanseinnhold>
  oppdateringer: Kortoppdatering[]
}

const erObjekt = (verdi: unknown): verdi is Record<string, unknown> =>
  typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)

const erTekst = (verdi: unknown): verdi is string => typeof verdi === 'string' && verdi.trim() !== ''

const DATAKORTFELT = ['nedre', 'ovre', 'enhet'] as const
const KORTFELT = ['tittel', 'tekst'] as const

/** Er panelet et datakortpanel (`datakort`), et kortpanel med overskrifter (`kort`), eller ingen av delene? */
function panelform(panel: string): 'datakort' | 'kort' | null {
  const form = panelFor(panel)?.form
  return form === 'datakort' || form === 'kort' ? form : null
}

function erTekstblokker(verdi: unknown): verdi is Tekstblokk[] {
  return (
    Array.isArray(verdi) &&
    verdi.length > 0 &&
    verdi.every((b) =>
      typeof b === 'string'
        ? b.trim() !== ''
        : erObjekt(b) && Array.isArray(b.punkter) && b.punkter.length > 0 && b.punkter.every(erTekst),
    )
  )
}

/** Feilene i innholdet til et kort: bare feltene kortet har, med riktig form. */
function innholdsfeil(innhold: unknown, form: 'datakort' | 'kort', hvor: string): string[] {
  const tillatte: readonly string[] = form === 'datakort' ? DATAKORTFELT : KORTFELT
  if (!erObjekt(innhold) || Object.keys(innhold).length === 0) return [`${hvor}: må ha minst ett av feltene ${tillatte.join(', ')}`]
  return Object.entries(innhold).flatMap(([felt, verdi]) => {
    if (!tillatte.includes(felt)) return [`${hvor}: ukjent felt «${felt}»`]
    if (felt === 'enhet' || felt === 'tittel') return erTekst(verdi) ? [] : [`${hvor}: «${felt}» må være en tekst`]
    if (felt === 'tekst') {
      if (!erTekstblokker(verdi)) return [`${hvor}: «tekst» må være en liste med avsnitt eller punktlister`]
      const dokument = tilDokument(verdi)
      return JSON.stringify(rensDokument(dokument)) === JSON.stringify(dokument) ? [] : [`${hvor}: teksten har formatering appen ikke viser`]
    }
    return verdi === null || (typeof verdi === 'number' && Number.isFinite(verdi)) ? [] : [`${hvor}: «${felt}» må være et tall eller null`]
  })
}

/** Kontrollerer oppdateringsfilen og lister alle feilene samtidig. */
export function kontrollerOppdateringer(fil: unknown, katalog: Analyttkatalog): Oppdateringsfil {
  if (!erObjekt(fil)) throw new Importfeil(['Oppdateringsfilen må være et objekt med «kilde», «referanser» og «oppdateringer»'])
  const feil: string[] = []
  if (!erTekst(fil.kilde)) feil.push('«kilde» må være en tekst')
  const referanser = erObjekt(fil.referanser) ? fil.referanser : {}
  if (!erObjekt(fil.referanser)) feil.push('«referanser» må være et objekt')
  for (const [nokkel, ref] of Object.entries(referanser)) {
    if (!erObjekt(ref) || !['tittel', 'forfattere', 'aar', 'lenke'].every((f) => typeof ref[f] === 'string')) {
      feil.push(`Referansen «${nokkel}» må ha tittel, forfattere, aar og lenke`)
    } else if (!erTekst(ref.tittel) || !/^https?:\/\/\S+$/i.test(ref.lenke as string)) {
      feil.push(`Referansen «${nokkel}» må ha en tittel og en lenke som er en nettadresse`)
    }
  }
  const oppdateringer: unknown[] = Array.isArray(fil.oppdateringer) ? fil.oppdateringer : []
  if (oppdateringer.length === 0) feil.push('«oppdateringer» må være en liste med minst én oppdatering')

  oppdateringer.forEach((o, i) => {
    const hvor = `Oppdatering ${i + 1}`
    if (!erObjekt(o)) return void feil.push(`${hvor} må være et objekt`)
    if ((o.kode === undefined) === (o.side === undefined)) feil.push(`${hvor}: oppgi enten «kode» eller «side»`)
    if (o.kode !== undefined && (!erTekst(o.kode) || katalog.finn(o.kode)?.kode !== o.kode)) {
      feil.push(`${hvor}: ukjent analyttkode «${String(o.kode)}»`)
    }
    if (o.side !== undefined && !erTekst(o.side)) feil.push(`${hvor}: «side» må være navnet på siden`)
    const form = panelform(String(o.panel))
    if (!form) return void feil.push(`${hvor}: ukjent panel «${String(o.panel)}», eller et panel uten kort`)
    if (!erTekst(o.kort)) feil.push(`${hvor}: «kort» må være en tekst`)
    else if (form === 'datakort' && datakortFor(o.kort)?.verdi !== 'intervall') feil.push(`${hvor}: ukjent datakort «${o.kort}»`)
    if (!erTekst(o.hvorfor)) feil.push(`${hvor}: «hvorfor» må være en tekst`)
    feil.push(...innholdsfeil(o.fra, form, `${hvor}, «fra»`))
    if (o.til !== null) {
      const tilfeil = innholdsfeil(o.til, form, `${hvor}, «til»`)
      feil.push(...tilfeil)
      if (form === 'datakort' && tilfeil.length === 0 && erObjekt(o.fra)) {
        const problem = kontrollerIntervall(lesIntervallverdi({ ...o.fra, ...(o.til as object) }))
        if (problem) feil.push(`${hvor}: ${problem}`)
      }
    }
    const kilder = o.kilder ?? {}
    if (!erObjekt(kilder)) return void feil.push(`${hvor}: «kilder» må være et objekt med «inn» og «ut»`)
    for (const retning of ['inn', 'ut'] as const) {
      const nokler = kilder[retning] ?? []
      if (!Array.isArray(nokler) || !nokler.every(erTekst)) {
        feil.push(`${hvor}: «kilder.${retning}» må være en liste med nøkler`)
        continue
      }
      for (const n of nokler) if (!(n in referanser)) feil.push(`${hvor}: referansen «${n}» er ikke definert`)
    }
  })
  if (feil.length) throw new Importfeil(feil)
  return fil as unknown as Oppdateringsfil
}

/** Kilden revisjonen fra en oppdatering får i historikken. */
export function oppdateringskilde(kilde: string, hvorfor: string): string {
  return `Oppdatert etter ${kilde.trim()}: ${hvorfor.trim()}`
}

/** Innholdet som feltene i `data` på kortet: teksten blir et riktekstdokument. */
export function kortdata({ tekst, ...felt }: Kortinnhold): Record<string, unknown> {
  return { ...felt, ...(tekst && { dokument: tilDokument(tekst) }) }
}

/** SQL-en som gjør oppdateringene, som én migrasjon. */
export function oppdateringSql(fil: Oppdateringsfil, admin: string): string {
  const nokler = Object.keys(fil.referanser)
  // Bare en referanse som skal legges til, legges inn når den mangler; en som bare tas bort, slås opp.
  const leggesInn = new Set(fil.oppdateringer.flatMap((o) => o.kilder?.inn ?? []))
  const oppdateringer = fil.oppdateringer.map((o) => {
    const form = panelform(o.panel)
    return {
      kode: o.kode ?? null,
      side: o.side ?? null,
      panel: o.panel,
      elementtype: form === 'datakort' ? o.kort : ELEMENTTYPER.kinetikk,
      tittel: form === 'datakort' ? null : o.kort,
      fra: kortdata(o.fra),
      til: o.til && kortdata(o.til),
      inn: o.kilder?.inn ?? [],
      ut: o.kilder?.ut ?? [],
      kilde: oppdateringskilde(fil.kilde, o.hvorfor),
    }
  })
  const referanser = nokler.flatMap((nokkel, i) => [
    `  -- ${nokkel}`,
    `  referanse := ${finnReferanse(fil.referanser[nokkel]!)};`,
    ...(leggesInn.has(nokkel)
      ? [
          `  if referanse is null then`,
          `    perform set_config('far.revisjonskilde', ${lit(`Lagt inn etter ${fil.kilde.trim()}`)}, true);`,
          `    referanse := (public.opprett_utkast('referanse', ${lit(JSON.stringify(fil.referanser[nokkel]))}::jsonb)).id;`,
          `    perform public.publiser_utkast(referanse, 1);`,
          `  end if;`,
        ]
      : []),
    `  kildenokler := kildenokler || jsonb_strip_nulls(jsonb_build_object(${lit(nokkel)}, referanse::text));`,
    ...(i < nokler.length - 1 ? [''] : []),
  ])

  return `-- Oppdateringer av kort etter ${fil.kilde.trim()}
do $oppdatering$
declare
  administrator uuid;
  referanse uuid;
  kildenokler jsonb := '{}';
  oppdatering jsonb;
  e record;
  kilder jsonb;
  ny jsonb;
begin
${innlogging(admin, 'hopp over')}

  -- Referansene: de som skal legges til og mangler, legges inn og publiseres.
${referanser.join('\n')}

  for oppdatering in select * from jsonb_array_elements(${lit(JSON.stringify(oppdateringer))}::jsonb) loop
    -- Kortet på siden, der feltene står nøyaktig som oppgitt, uten upublisert utkast.
    select u.objekt_id, u.revisjon, r.innhold into e
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where t.tilstand = 'publisert'
      and t.infoside_id = coalesce(
        (select a.hovedside_id from public.laboratorieanalytter a where a.tilstand = 'publisert' and a.kode = oppdatering->>'kode'),
        (select s.objekt_id from public.infosider s where s.tilstand = 'publisert' and lower(s.navn) = lower(oppdatering->>'side')))
      and t.panel = oppdatering->>'panel' and t.elementtype = oppdatering->>'elementtype'
      and (t.data->>'tittel') is not distinct from (oppdatering->>'tittel')
      and not exists (
        select 1 from jsonb_each(oppdatering->'fra') f where r.innhold->'data'->f.key is distinct from f.value)
    order by t.posisjon, t.objekt_id
    limit 1;
    if not found then
      raise notice 'Oppdaterer ikke % på %: fant ikke kortet slik det var, eller det har et upublisert utkast.',
        coalesce(oppdatering->>'tittel', oppdatering->>'elementtype'), coalesce(oppdatering->>'kode', oppdatering->>'side');
      continue;
    end if;

    -- De nye kildene først, så de som sto fra før og ikke tas bort.
    select coalesce(jsonb_agg(k order by rekke, i), '[]'::jsonb) into kilder
    from (
      select to_jsonb(kildenokler->>n) as k, 0 as rekke, i
        from jsonb_array_elements_text(oppdatering->'inn') with ordinality as inn(n, i)
      union all
      select x, 1, i
        from jsonb_array_elements(coalesce(e.innhold->'referanser', '[]')) with ordinality as fra(x, i)
        where not exists (select 1 from jsonb_array_elements_text(oppdatering->'inn') n where to_jsonb(kildenokler->>n) = x)
          and not exists (select 1 from jsonb_array_elements_text(oppdatering->'ut') n where to_jsonb(kildenokler->>n) = x)
    ) alle;

    ny := case when jsonb_typeof(oppdatering->'til') = 'null'
      then jsonb_set(e.innhold, '{panel}', to_jsonb(${lit(FJERNET)}::text))
      else e.innhold || jsonb_build_object('data', (e.innhold->'data') || (oppdatering->'til'), 'referanser', kilder)
    end;
    -- Står kortet alt slik oppdateringen gir det, lages ingen ny revisjon.
    continue when ny = e.innhold;

    perform set_config('far.revisjonskilde', oppdatering->>'kilde', true);
    perform public.lagre_utkast(e.objekt_id, e.revisjon, ny);
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;
end
$oppdatering$;`
}
