-- Varsler om endringer på favorittsidene (kategorien `favoritter`).
--
-- Når en redaktør publiserer endringene på en fagside, får alle som har
-- stoffet som favoritt (`stoffavoritter`) et varsel, unntatt redaktøren selv.
-- Publiseringen er når redigeringen er ferdig: det som lagres underveis, er
-- utkast og varsler ingen.
--
-- Hver hendelse sier hvilke deler av siden publiseringen endret: panelene
-- (`farmakokinetikk`, `dosering` …) og `navn` når sidens navn eller nøkkel er
-- endret. Uleste varsler om samme side slås sammen til ett, med alle
-- hendelsene i, så mange endringer før brukeren har lest gir ett varsel.
--
-- Hva som gir hendelser:
--
--   * et innholdselement: panelet det står i, og panelet det sto i før (et
--     kort som fjernes, flyttes til `fjernet`, som ikke er en del av siden).
--   * siden selv: `navn`, og panelene der referansene for hele panelet er endret.
--   * en referanse som er endret: panelene der de publiserte sidene siterer den.
--
-- Reglene sidene viser, varsles som endringer i fortolkningen, til alle.

-- De delene av de publiserte sidene en publisering endret, én rad per side og del.
create function intern.endrede_sidedeler(objekt uuid, typ public.objekttype, ny jsonb, gammel jsonb)
returns table (side uuid, del text)
language sql
stable
set search_path = ''
as $$
  select distinct d.side, d.del
  from (
    select e.infoside_id as side, p.del
    from public.innholdselementer e
    cross join unnest(array[ny ->> 'panel', gammel ->> 'panel']) p(del)
    where typ::text = 'innholdselement' and e.objekt_id = objekt and e.tilstand = 'publisert'

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

create function intern.varsle_favoritter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  typ public.objekttype := (select o.type from public.redigerbare_objekter o where o.id = new.objekt_id);
  endring record;
begin
  if typ::text not in ('infoside', 'innholdselement', 'referanse') then
    return null;
  end if;

  for endring in
    select d.side, jsonb_agg(d.del order by d.del) as deler
    from intern.endrede_sidedeler(
      new.objekt_id,
      typ,
      (select r.innhold from public.objektrevisjoner r where r.objekt_id = new.objekt_id and r.revisjon = new.revisjon),
      (select r.innhold from public.objektrevisjoner r where r.objekt_id = new.objekt_id and r.revisjon = new.forrige_revisjon)
    ) d
    group by d.side
  loop
    perform intern.varsle(
      array(
        select f.bruker_id
        from public.stoffavoritter f
        join public.infosider s on s.slug = f.stoff and s.tilstand = 'publisert'
        where s.objekt_id = endring.side and f.bruker_id <> new.utfort_av
      ),
      'favoritter', 'favoritter:' || endring.side, null,
      jsonb_build_object('kl', new.utfort_kl, 'av', new.utfort_av, 'side', endring.side, 'deler', endring.deler)
    );
  end loop;
  return null;
end;
$$;

create trigger objektpubliseringer_varsle_favoritter
after insert on public.objektpubliseringer
for each row execute function intern.varsle_favoritter();

-- Siden en hendelse gjelder, slik den er publisert nå: navnet og nøkkelen.
create function intern.varselside(side uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', s.objekt_id, 'navn', s.navn, 'stoff', s.slug)
  from public.infosider s
  where s.objekt_id = side and s.tilstand = 'publisert'
$$;

-- Hendelsene slik de vises: fortolkningsobjektene og sidene med navn, og bare
-- kommentarer som fortsatt står (en slettet kommentar er ikke noe å se).
create or replace function intern.varselhendelser(hendelser jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
      case
        when h ? 'objekt' then h || jsonb_build_object('objekt', intern.fortolkningsobjekt((h ->> 'objekt')::uuid))
        when h ? 'side' then h || jsonb_build_object('side', intern.varselside((h ->> 'side')::uuid))
        else h
      end
      order by nr
    ), '[]'::jsonb)
  from jsonb_array_elements(hendelser) with ordinality t(h, nr)
  where not h ? 'kommentar' or exists (
    select 1 from public.idekommentarer k where k.id = (h ->> 'kommentar')::uuid and not k.slettet
  )
$$;

-- Varslene til den innloggede: alle uleste, og de leste fra de siste 30
-- dagene. De uleste tas med først, så taket på 200 aldri skjuler et ulest
-- varsel (eller tallet på bjella, som telles herfra) bak leste.
create or replace function public.mine_varsler()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lest_kl', now(),
    'varsler', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', v.id,
          'kategori', v.kategori,
          'ide', (select jsonb_build_object('id', i.id, 'tittel', i.tittel, 'forfatter_id', i.forfatter_id)
                  from public.ideer i where i.id = v.ide_id),
          'hendelser', v.hendelser,
          'opprettet_kl', v.opprettet_kl,
          'oppdatert_kl', v.oppdatert_kl,
          'lest_kl', v.lest_kl
        ) order by v.oppdatert_kl desc, v.id)
      from (
        select v.id, v.kategori, v.ide_id, v.opprettet_kl, v.oppdatert_kl, v.lest_kl,
               intern.varselhendelser(v.hendelser) as hendelser
        from public.varsler v
        where v.mottaker_id = (select auth.uid())
          and (v.lest_kl is null or v.lest_kl > now() - intern.varselfrist())
        order by v.lest_kl is not null, v.oppdatert_kl desc, v.id
        limit 200
      ) v
      where jsonb_array_length(v.hendelser) > 0
    ), '[]'::jsonb)
  )
$$;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;