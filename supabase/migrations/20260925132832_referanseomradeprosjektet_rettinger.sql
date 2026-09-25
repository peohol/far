-- Rettinger i tabellene over serumkonsentrasjoner, etter sluttrapporten fra referanseområdeprosjektet (2008)
do $retting$
declare
  administrator uuid;
  retting jsonb;
  e record;
  rader jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  for retting in select * from jsonb_array_elements('[{"kode":"ESCIT","rad":{"dose":"20–60 mg","konsentrasjon":"10.–90. persentil: 19–109 nmol/L"},"til":{"dose":"10–30 mg"},"kilde":"Rettet etter sluttrapporten fra referanseområdeprosjektet (2008): doseringsintervallet for escitalopram er 10–30 mg, ikke 20–60 mg"},{"kode":"FLUOSUM","rad":{"dose":"25–60 mg","konsentrasjon":"10.–90. persentil: 410–2 406 nmol/L"},"til":{"dose":"20–60 mg"},"kilde":"Rette'
    't etter sluttrapporten fra referanseområdeprosjektet (2008): doseringsintervallet for fluoksetin er 20–60 mg, ikke 25–60 mg"},{"kode":"KLORP","rad":{"dose":"…?","konsentrasjon":"10.–90. persentil: 5–103 nmol/L"},"til":{"dose":"15–300 mg","konsentrasjon":"10.–90. persentil: 5–64 nmol/L"},"kilde":"Rettet etter sluttrapporten fra referanseområdeprosjektet (2008): doseringsintervallet er 15–300 mg, og'
    ' 90-persentilen er 64 nmol/L (103 er 95-persentilen)"},{"kode":"LMP","rad":{"dose":"…?","konsentrasjon":"10.–90. persentil: 14–158 nmol/L"},"til":{"dose":"25–400 mg"},"kilde":"Rettet etter sluttrapporten fra referanseområdeprosjektet (2008): doseringsintervallet for levomepromazin er 25–400 mg"},{"kode":"LURA","rad":{"dose":"…?","konsentrasjon":"10.–90. persentil: 14–158 nmol/L"},"til":null,"kilde'
    '":"Rettet etter sluttrapporten fra referanseområdeprosjektet (2008): lurasidon er ikke med i rapporten, og raden var tallene for levomepromazin"},{"kode":"SERT","rad":{"dose":"50–200 mg","konsentrasjon":"10.–90. persentil: 26–291 nmol/L"},"til":{"konsentrasjon":"10.–90. persentil: 26–219 nmol/L"},"kilde":"Rettet etter sluttrapporten fra referanseområdeprosjektet (2008): 90-persentilen er 219 nmol/'
    'L (291 er 95-persentilen)"}]'::jsonb) loop
    -- Tabellen på siden der raden står nøyaktig som oppgitt, én gang, uten upublisert utkast.
    select u.objekt_id, u.revisjon, r.innhold into e
    from public.laboratorieanalytter a
    join public.innholdselementer t on t.infoside_id = a.hovedside_id and t.tilstand = a.tilstand
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where a.tilstand = 'publisert' and a.kode = retting->>'kode'
      and t.tilstand = 'publisert' and t.panel = 'serumkonsentrasjoner' and t.elementtype = 'dosetabell'
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
        then jsonb_set(e.innhold, '{panel}', to_jsonb('fjernet'::text))
        else jsonb_set(e.innhold, '{data,rader}', rader)
      end
    );
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;
end
$retting$;