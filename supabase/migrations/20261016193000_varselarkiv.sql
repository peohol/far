-- Arkivet for varslene: brukeren kan legge et varsel bort fra lista, og hente
-- det fram igjen. Et arkivert varsel er lest, og ryddes bort som de andre
-- leste når fristen har gått (`intern.varselfrist()`). En ny hendelse i samme
-- gruppe begynner på et nytt varsel, siden bare uleste samles.

alter table public.varsler add column arkivert_kl timestamptz;

alter table public.varsler add constraint varsler_arkivert_er_lest
  check (arkivert_kl is null or lest_kl is not null);

comment on column public.varsler.arkivert_kl is
  'Når mottakeren la varselet i arkivet. Et arkivert varsel er alltid lest.';

-- Varslene til den innloggede, som før, med når de ble arkivert.
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
          'diskusjon', (select jsonb_build_object('id', d.id, 'tittel', d.tittel, 'side', d.side, 'forfatter_id', d.forfatter_id)
                        from public.diskusjoner d where d.id = v.diskusjon_id),
          'hendelser', v.hendelser,
          'opprettet_kl', v.opprettet_kl,
          'oppdatert_kl', v.oppdatert_kl,
          'lest_kl', v.lest_kl,
          'arkivert_kl', v.arkivert_kl
        ) order by v.oppdatert_kl desc, v.id)
      from (
        select v.id, v.kategori, v.ide_id, v.diskusjon_id, v.opprettet_kl, v.oppdatert_kl, v.lest_kl, v.arkivert_kl,
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

-- Legger de oppgitte varslene i arkivet, og merker dem lest. Som
-- `merk_varsler_lest` gjelder det et ulest varsel slik det var da lista ble
-- lest (`til`): har det fått noe nytt siden, blir det stående.
create function public.arkiver_varsler(varsler uuid[], til timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := (select auth.uid());
begin
  if bruker is null then
    raise exception 'Bare innloggede har varsler.' using errcode = '42501';
  end if;
  update public.varsler v
  set arkivert_kl = now(),
      lest_kl = coalesce(v.lest_kl, now())
  where v.mottaker_id = bruker
    and v.arkivert_kl is null
    and v.id = any (arkiver_varsler.varsler)
    and (v.lest_kl is not null or v.oppdatert_kl <= least(arkiver_varsler.til, now()));
end;
$$;

comment on function public.arkiver_varsler(uuid[], timestamptz) is
  'Legger den innloggedes oppgitte varsler i arkivet og merker dem lest, slik de var på tidspunktet `til`.';

-- Henter de oppgitte varslene fram fra arkivet. De står som leste.
create function public.gjenopprett_varsler(varsler uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := (select auth.uid());
begin
  if bruker is null then
    raise exception 'Bare innloggede har varsler.' using errcode = '42501';
  end if;
  update public.varsler v
  set arkivert_kl = null
  where v.mottaker_id = bruker
    and v.arkivert_kl is not null
    and v.id = any (gjenopprett_varsler.varsler);
end;
$$;

comment on function public.gjenopprett_varsler(uuid[]) is
  'Henter den innloggedes oppgitte varsler fram fra arkivet.';

revoke all on function public.arkiver_varsler(uuid[], timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.gjenopprett_varsler(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.arkiver_varsler(uuid[], timestamptz) to authenticated;
grant execute on function public.gjenopprett_varsler(uuid[]) to authenticated;
