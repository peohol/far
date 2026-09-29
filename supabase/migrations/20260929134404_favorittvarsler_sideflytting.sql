-- Et innholdselement som flyttes til en annen side, er en endring på begge
-- sidene: panelet det sto i på den gamle, og panelet det står i på den nye.
-- Sidene leses av øyeblikksbildene før og etter publiseringen, ikke av raden
-- som alt er skrevet om (se `*_favorittvarsler.sql`).
create or replace function intern.endrede_sidedeler(objekt uuid, typ public.objekttype, ny jsonb, gammel jsonb)
returns table (side uuid, del text)
language sql
stable
set search_path = ''
as $$
  select distinct d.side, d.del
  from (
    select (u.innhold ->> 'infoside')::uuid as side, u.innhold ->> 'panel' as del
    from unnest(array[ny, gammel]) u(innhold)
    where typ::text = 'innholdselement' and u.innhold is not null

    union all
    select objekt, 'navn'
    where typ::text = 'infoside'
      and gammel is not null
      and (ny ->> 'navn' is distinct from gammel ->> 'navn' or ny -> 'slug' is distinct from gammel -> 'slug')

    union all
    select objekt, k.panel
    from jsonb_object_keys(coalesce(ny -> 'panelreferanser', '{}') || coalesce(gammel -> 'panelreferanser', '{}')) k(panel)
    where typ::text = 'infoside'
      and ny -> 'panelreferanser' -> k.panel is distinct from gammel -> 'panelreferanser' -> k.panel

    union all
    select coalesce(e.infoside_id, k.objekt_id), coalesce(k.panel, e.panel)
    from public.referansekoblinger k
    left join public.innholdselementer e on e.objekt_id = k.objekt_id and e.tilstand = k.tilstand
    where typ::text = 'referanse' and gammel is not null and k.tilstand = 'publisert' and k.referanse_id = objekt
  ) d
  join public.infosider s on s.objekt_id = d.side and s.tilstand = 'publisert'
  where d.del is not null and d.del <> 'fjernet'
$$;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;