-- Varsler om nye idéer (kategorien `nye_ideer`).
--
-- Når noen skriver en ny idé, får alle andre et varsel om den. Den som skrev
-- idéen, varsles ikke. Hver idé er ett varsel (gruppen er idéen), så varselet
-- leder til idéen og er lest når idéen åpnes (`idebesok_les_varsler`).
--
-- Kategorien er valgfri og av som standard; det er appen som viser varslene
-- brukeren har valgt.

alter type public.varselkategori add value 'nye_ideer';

-- plpgsql, så den nye verdien først brukes når utløseren kjører, etter at
-- migrasjonen er ferdig.
create function intern.varsle_ny_ide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.varsle(
    array(select p.id from public.profiles p where p.id <> new.forfatter_id),
    'nye_ideer', 'nye_ideer:' || new.id, new.id,
    jsonb_build_object('kl', new.opprettet_kl, 'av', new.forfatter_id)
  );
  return null;
end;
$$;

create trigger ideer_varsle
after insert on public.ideer
for each row execute function intern.varsle_ny_ide();

revoke all on function intern.varsle_ny_ide() from public, anon, authenticated, service_role;