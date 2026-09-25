/**
 * Rettinger av rader i tabellene over serumkonsentrasjoner, når en kilde viser
 * at det som ble importert, er feil.
 *
 * En rettingsfil (`supabase/import/rettinger/*.json`) oppgir kilden og, per
 * retting, analyttkoden, raden slik den står nå, feltene som skal endres (eller
 * `null` for å ta bort raden) og hvorfor. Rettingen gjøres som nye, publiserte
 * revisjoner, så det som sto før, kan hentes fram i historikken, og kilden i
 * historikken sier hva som ble rettet og hvorfor.
 *
 * Bare en rad som står nøyaktig som oppgitt, rettes. Har noen endret raden,
 * eller har tabellen et utkast som ikke er publisert, gjøres ingenting med den
 * og databasen melder fra. Blir tabellen tom, tas den bort fra siden (panelet
 * `fjernet`). Uten administratoren gjør migrasjonen ingenting, som importene.
 *
 * Modulen brukes av skriptet og testene, ikke av appen.
 */
import type { Analyttkatalog } from '../domain/analyttkatalog'
import { innlogging, Importfeil, lit } from './import'
import { DOSEKOLONNER, ELEMENTTYPER, FJERNET, type Doserad } from './paneler'

export interface Radretting {
  kode: string
  /** Raden slik den står nå: feltene som oppgis, må være nøyaktig like, og treffe én rad. */
  rad: Partial<Doserad>
  /** Feltene som endres, eller `null` når raden skal tas bort. */
  til: Partial<Doserad> | null
  hvorfor: string
}

export interface Rettingsfil {
  /** Kilden rettingen bygger på, slik den leses etter «Rettet etter». */
  kilde: string
  rettinger: Radretting[]
}

const FELT: readonly string[] = DOSEKOLONNER.map(({ felt }) => felt)

const erObjekt = (verdi: unknown): verdi is Record<string, unknown> =>
  typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)

const erTekst = (verdi: unknown): verdi is string => typeof verdi === 'string' && verdi.trim() !== ''

/** Feilene i feltene til en rad: bare kolonnene i tabellen, alle som tekst, minst ett. */
function radfeil(rad: unknown, hvor: string): string[] {
  if (!erObjekt(rad) || Object.keys(rad).length === 0) return [`${hvor}: må ha minst ett av feltene ${FELT.join(', ')}`]
  return Object.entries(rad).flatMap(([felt, verdi]) => {
    if (!FELT.includes(felt)) return [`${hvor}: ukjent felt «${felt}»`]
    return typeof verdi === 'string' ? [] : [`${hvor}: «${felt}» må være en tekst`]
  })
}

/** Kontrollerer rettingsfilen og lister alle feilene samtidig. */
export function kontrollerRettinger(fil: unknown, katalog: Analyttkatalog): Rettingsfil {
  const feil: string[] = []
  if (!erObjekt(fil)) throw new Importfeil(['Rettingsfilen må være et objekt med «kilde» og «rettinger»'])
  if (!erTekst(fil.kilde)) feil.push('«kilde» må være en tekst')
  if (!Array.isArray(fil.rettinger) || fil.rettinger.length === 0) feil.push('«rettinger» må være en liste med minst én retting')
  const rettinger: unknown[] = Array.isArray(fil.rettinger) ? fil.rettinger : []
  rettinger.forEach((retting, i) => {
    const hvor = `Retting ${i + 1}`
    if (!erObjekt(retting)) return void feil.push(`${hvor} må være et objekt`)
    if (!erTekst(retting.kode) || !katalog.finn(retting.kode)) feil.push(`${hvor}: ukjent analyttkode «${String(retting.kode)}»`)
    if (!erTekst(retting.hvorfor)) feil.push(`${hvor}: «hvorfor» må være en tekst`)
    feil.push(...radfeil(retting.rad, `${hvor}, «rad»`))
    if (retting.til !== null) feil.push(...radfeil(retting.til, `${hvor}, «til»`))
  })
  if (feil.length) throw new Importfeil(feil)
  return fil as unknown as Rettingsfil
}

/** Kilden revisjonen fra en retting får i historikken. */
export function rettingskilde(kilde: string, hvorfor: string): string {
  return `Rettet etter ${kilde.trim()}: ${hvorfor.trim()}`
}

/** SQL-en som gjør rettingene, som én migrasjon. */
export function rettingSql(fil: Rettingsfil, admin: string): string {
  const rettinger = fil.rettinger.map(({ kode, rad, til, hvorfor }) => ({
    kode,
    rad,
    til,
    kilde: rettingskilde(fil.kilde, hvorfor),
  }))
  return `-- Rettinger i tabellene over serumkonsentrasjoner, etter ${fil.kilde.trim()}
do $retting$
declare
  administrator uuid;
  retting jsonb;
  e record;
  rader jsonb;
begin
${innlogging(admin, 'hopp over')}

  for retting in select * from jsonb_array_elements(${lit(JSON.stringify(rettinger))}::jsonb) loop
    -- Tabellen på siden der raden står nøyaktig som oppgitt, én gang, uten upublisert utkast.
    select u.objekt_id, u.revisjon, r.innhold into e
    from public.laboratorieanalytter a
    join public.innholdselementer t on t.infoside_id = a.hovedside_id and t.tilstand = a.tilstand
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where a.tilstand = 'publisert' and a.kode = retting->>'kode'
      and t.tilstand = 'publisert' and t.panel = 'serumkonsentrasjoner' and t.elementtype = ${lit(ELEMENTTYPER.dosetabell)}
      and (select count(*) from jsonb_array_elements(r.innhold->'data'->'rader') x where x @> (retting->'rad')) = 1
    order by t.objekt_id
    limit 1;
    if not found then
      raise notice 'Retter ikke %: fant ikke raden slik den var, eller tabellen har et upublisert utkast.', retting->>'kode';
      continue;
    end if;

    select coalesce(jsonb_agg(case when x @> (retting->'rad') then x || (retting->'til') else x end order by i), '[]'::jsonb)
    into rader
    from jsonb_array_elements(e.innhold->'data'->'rader') with ordinality as rad(x, i)
    where not (x @> (retting->'rad') and jsonb_typeof(retting->'til') = 'null');

    perform set_config('far.revisjonskilde', retting->>'kilde', true);
    perform public.lagre_utkast(
      e.objekt_id,
      e.revisjon,
      case when jsonb_array_length(rader) = 0
        then jsonb_set(e.innhold, '{panel}', to_jsonb(${lit(FJERNET)}::text))
        else jsonb_set(e.innhold, '{data,rader}', rader)
      end
    );
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;
end
$retting$;`
}
