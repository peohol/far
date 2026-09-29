-- Favoritter: fagsidene hver bruker har merket med stjernen.
--
-- En favoritt er et stoff, etter stoffets nøkkel (#/stoff/<nøkkel>), ikke
-- etter fagsidens ID: også stoffene i stoffregisteret som ennå ikke har noen
-- side i databasen, kan merkes. Hver bruker ser, legger til og fjerner bare
-- sine egne favoritter.
--
-- Får en publisert fagside ny nøkkel, flytter favorittene med, så de fortsatt
-- peker på det samme stoffet.
--
-- Varslene om endringer på favorittsidene hører til varslingssystemet. Det
-- finner mottakerne her, etter nøkkelen (se indeksen).

create table public.stoffavoritter (
  bruker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  stoff text not null,
  lagt_til_kl timestamptz not null default now(),
  primary key (bruker_id, stoff),
  constraint stoffavoritter_stoff check (char_length(stoff) <= 200 and stoff ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.stoffavoritter is
  'Fagsidene hver bruker har som favoritter, etter stoffets nøkkel (infosider.slug). Hver bruker ser og endrer bare sine egne.';
comment on column public.stoffavoritter.stoff is
  'Stoffets nøkkel, som i adressen #/stoff/<nøkkel>. Følger fagsiden når den publiseres med ny nøkkel.';

-- Hvem som har et stoff som favoritt, til varslene om endringer på siden.
create index stoffavoritter_stoff_idx on public.stoffavoritter (stoff);

-- --- Nøkkelen følger siden -------------------------------------------------

-- Når den publiserte siden får ny nøkkel, flyttes favorittene til den. Har en
-- bruker alt den nye nøkkelen, beholdes den eldste av de to.
create function intern.stoffavoritter_folg_nokkel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stoffavoritter (bruker_id, stoff, lagt_til_kl)
  select f.bruker_id, new.slug, f.lagt_til_kl
  from public.stoffavoritter f
  where f.stoff = old.slug
  on conflict (bruker_id, stoff) do update
    set lagt_til_kl = least(public.stoffavoritter.lagt_til_kl, excluded.lagt_til_kl);

  delete from public.stoffavoritter f where f.stoff = old.slug;
  return null;
end
$$;

create trigger infosider_favoritter_folger_nokkel
after update of slug on public.infosider
for each row
when (new.tilstand = 'publisert' and old.slug is distinct from new.slug)
execute function intern.stoffavoritter_folg_nokkel();

-- --- Det appen kaller ------------------------------------------------------

-- Nøklene til brukerens favoritter, de eldste først.
create function public.les_stoffavoritter()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(f.stoff order by f.lagt_til_kl, f.stoff), '[]'::jsonb)
  from public.stoffavoritter f
  where f.bruker_id = (select auth.uid())
$$;

comment on function public.les_stoffavoritter() is
  'Nøklene til stoffene den innloggede brukeren har som favoritter, de eldste først.';

-- Gjør stoffet til favoritt eller ikke. Samme svar uansett hvor mange ganger
-- det kalles, så to trykk rett etter hverandre ikke kan gi feil.
create function public.sett_stoffavoritt(stoff text, favoritt boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if favoritt then
    insert into public.stoffavoritter (stoff) values (sett_stoffavoritt.stoff)
    on conflict on constraint stoffavoritter_pkey do nothing;
  else
    delete from public.stoffavoritter f
    where f.bruker_id = (select auth.uid()) and f.stoff = sett_stoffavoritt.stoff;
  end if;
end
$$;

comment on function public.sett_stoffavoritt(text, boolean) is
  'Legger stoffet til i eller fjerner det fra den innloggede brukerens favoritter.';

-- --- Radsikkerhet og rettigheter -------------------------------------------

alter table public.stoffavoritter enable row level security;

create policy "Brukeren leser egne favoritter" on public.stoffavoritter
for select to authenticated using (bruker_id = (select auth.uid()));
create policy "Brukeren legger til egne favoritter" on public.stoffavoritter
for insert to authenticated with check (bruker_id = (select auth.uid()));
create policy "Brukeren fjerner egne favoritter" on public.stoffavoritter
for delete to authenticated using (bruker_id = (select auth.uid()));

-- Brukeren og tidspunktet settes av databasen.
revoke all on public.stoffavoritter from anon, authenticated;
grant select, delete on public.stoffavoritter to authenticated;
grant insert (stoff) on public.stoffavoritter to authenticated;

revoke all on function public.les_stoffavoritter(), public.sett_stoffavoritt(text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.les_stoffavoritter(), public.sett_stoffavoritt(text, boolean) to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;