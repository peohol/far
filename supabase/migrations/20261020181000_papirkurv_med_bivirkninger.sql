-- En fagside med importerte bivirkninger kunne ikke slettes for godt fra
-- papirkurven: bivirkningskildene peker på siden, og databasen avviste
-- slettingen med en teknisk feil, som appen viste som «Noe gikk galt». Det
-- samme stoppet tømmingen og den daglige ryddingen av papirkurven for alle
-- sidene, siden den feilen ikke var en av dem ryddingen hopper over.
--
-- Nå går bivirkningene (kildene, kontekstene og radene) med siden, som resten
-- av den. Peker noe annet likevel på siden, sies det med en melding som kan
-- vises, og ryddingen lar siden ligge (`22023`, som `intern.tom_papirkurv`
-- hopper over).

create or replace function intern.fjern_stoff(stoff text, bruker uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  side uuid;
  sidenavn text;
  objekter uuid[];
  tekster text[];
begin
  select s.objekt_id, s.navn into side, sidenavn
  from public.infosider s
  where s.slug = fjern_stoff.stoff
  order by (s.tilstand = 'publisert') desc
  limit 1;

  if side is not null then
    perform 1 from public.redigerbare_objekter o where o.id = side for update;
    objekter := array[side] || coalesce(
      (select array_agg(distinct e.objekt_id) from public.innholdselementer e where e.infoside_id = side),
      '{}'
    );
    tekster := (select array_agg(o::text) from unnest(objekter) o);

    -- Det som skal kunne gjenopprettes, må finnes: står noen av objektene i
    -- historikken til noe annet, blir siden liggende.
    if exists (
      select 1
      from public.objektrevisjoner r
      cross join unnest(tekster) t(id)
      where r.objekt_id <> all (objekter)
        and strpos(r.innhold::text, t.id) > 0
    ) then
      raise exception 'Fagsiden kan ikke slettes for godt, fordi noe annet i historikken peker på den. Den blir liggende i papirkurven.'
        using errcode = '22023';
    end if;

    begin
      insert into public.slettede_stoffsider (stoff, navn, objekt_id, objekter, slettet_av)
      values (fjern_stoff.stoff, sidenavn, side, cardinality(objekter), bruker);

      delete from public.varsler v where v.gruppe = 'favoritter:' || side::text;

      delete from bivirkninger.bivirkninger b
      using bivirkninger.kilder k
      where b.kilde = k.id and k.infoside = side;
      delete from bivirkninger.kontekster x
      using bivirkninger.kilder k
      where x.kilde = k.id and k.infoside = side;
      delete from bivirkninger.kilder k where k.infoside = side;

      perform set_config('intern.sletter_stoffside', array_to_string(tekster, ','), true);
      delete from public.objektpubliseringer p where p.objekt_id = any (objekter);
      delete from public.objekttilstander t where t.objekt_id = any (objekter);
      delete from public.objektrevisjoner r where r.objekt_id = any (objekter);
      delete from public.redigerbare_objekter o where o.id = any (objekter);
      perform set_config('intern.sletter_stoffside', '', true);
    exception when foreign_key_violation then
      raise exception 'Fagsiden kan ikke slettes for godt, fordi noe annet peker på den. Den blir liggende i papirkurven.'
        using errcode = '22023';
    end;
  end if;

  delete from public.diskusjoner d where d.side = 'stoff:' || fjern_stoff.stoff;
  delete from public.diskusjonskategorier k where k.side = 'stoff:' || fjern_stoff.stoff;
  delete from public.stoffavoritter f where f.stoff = fjern_stoff.stoff;
  delete from public.stoffplasseringer p where p.stoff = fjern_stoff.stoff;
  insert into public.stoffstatus (stoff, status, endret_av)
  values (fjern_stoff.stoff, 'fjernet', bruker)
  on conflict on constraint stoffstatus_pkey do update set status = 'fjernet', endret_av = excluded.endret_av, endret_kl = now();

  return coalesce(cardinality(objekter), 0);
end;
$$;

comment on function intern.fjern_stoff(text, uuid) is
  'Sletter stoffet for godt: fagsiden med kortene, revisjonene, publiseringene, sideversjonene, kurateringsgrenene og bivirkningene, diskusjonene, favorittene, varslene og plasseringene. Statusen blir fjernet. Avviser med 22023 når noe annet peker på siden.';

revoke all on function intern.fjern_stoff(text, uuid) from public, anon, authenticated, service_role;
