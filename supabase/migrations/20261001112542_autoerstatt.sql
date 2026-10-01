-- Autoerstatt i teksteditorene.
--
-- Når det som står foran markøren blir `finn`, byttes det med `erstatt` mens
-- det skrives — i rikteksteditoren og i tekstfeltene. Reglene er nøyaktige,
-- også på mellomrom: « - » blir « – », men «-» alene står.
--
-- Alle innloggede leser reglene, for det er de som skriver. Bare en
-- administrator oppretter, endrer og sletter dem (radsikkerheten under).

create table public.autoerstatt_regler (
  id uuid primary key default gen_random_uuid(),
  finn text not null unique,
  erstatt text not null,
  opprettet_kl timestamptz not null default now(),
  constraint autoerstatt_finn_lengde check (char_length(finn) between 1 and 20),
  constraint autoerstatt_erstatt_lengde check (char_length(erstatt) between 1 and 20),
  constraint autoerstatt_en_linje check (finn !~ '[\r\n]' and erstatt !~ '[\r\n]'),
  constraint autoerstatt_endrer_noe check (finn <> erstatt)
);

comment on table public.autoerstatt_regler is
  'Autoerstatt-reglene i teksteditorene: finn byttes med erstatt mens det skrives. Bare administratorer endrer dem.';

alter table public.autoerstatt_regler enable row level security;

create policy "Innloggede leser reglene" on public.autoerstatt_regler
for select to authenticated using (true);

create policy "Administratorer oppretter regler" on public.autoerstatt_regler
for insert to authenticated with check ((select public.er_admin()));

create policy "Administratorer endrer regler" on public.autoerstatt_regler
for update to authenticated using ((select public.er_admin())) with check ((select public.er_admin()));

create policy "Administratorer sletter regler" on public.autoerstatt_regler
for delete to authenticated using ((select public.er_admin()));

revoke all on public.autoerstatt_regler from anon, authenticated;
grant select, insert, delete on public.autoerstatt_regler to authenticated;
grant update (finn, erstatt) on public.autoerstatt_regler to authenticated;

-- De første reglene (Peder 2026-10-01).
insert into public.autoerstatt_regler (finn, erstatt) values
  (' - ', ' – '),
  ('--', '–'),
  (' * ', ' · ');
