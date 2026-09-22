-- Lagringen av profilbilder.
--
-- Bøtta er privat: bildene skal være tilgjengelige for innloggede
-- OUSFAR-brukere, ikke for hvem som helst med en lenke. Appen henter dem med
-- signerte lenker som utløper av seg selv.
--
-- Bildene beskjæres og komprimeres i nettleseren før opplasting, og lagres
-- kvadratisk som WebP på en fast sti — `<bruker-id>/avatar.webp` — slik at et
-- nytt bilde erstatter det gamle i stedet for å legge igjen gamle filer.
-- Grensene her er en siste skanse dersom noen laster opp utenom appen.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatarer', 'avatarer', false, 1048576, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Mappa øverst i stien er bruker-ID-en, og det er den policyene måler mot:
-- alle innloggede kan se bildene, men bare eieren kan legge inn, bytte eller
-- fjerne sitt eget.

create policy "Innloggede kan se profilbilder"
on storage.objects for select to authenticated
using (bucket_id = 'avatarer');

create policy "Brukeren kan legge inn sitt eget profilbilde"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatarer'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Brukeren kan bytte sitt eget profilbilde"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatarer'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatarer'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Brukeren kan fjerne sitt eget profilbilde"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatarer'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
