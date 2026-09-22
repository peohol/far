-- Låser profilbildet til én fast fil per bruker.
--
-- Reglene fra migrasjonen for profilbilder målte bare det øverste mappeleddet.
-- To ting fulgte av det, og begge lot seg gjøre fra nettleseren:
--
--   * En bruker kunne legge inn så mange filer hen ville under sin egen mappe,
--     også i undermapper. Bare den ene faste fila skal finnes.
--   * `avatar_path` kunne peke hvor som helst i bøtta — også på en annen
--     brukers bilde. Da ville profilen vist en kollegas ansikt som sitt eget.
--     Avataren står ved siden av navnet rundt i appen og skal aldri kunne
--     vise feil person.
--
-- Invarianten er at en profil enten ikke har et bilde, eller peker på sin
-- egen faste sti. Den håndheves nå av databasen, og gjelder dermed uansett
-- hvem som skriver — også Edge-funksjonene.
-- Stien bygges på samme form som avatarSti() i functions/_delt/profil.ts.

alter table public.profiles
  add constraint profiles_avatar_path_egen
  check (avatar_path is null or avatar_path = id::text || '/avatar.webp');

-- Skrivereglene i lagringen måler nå hele filnavnet, ikke bare mappa.
drop policy if exists "Brukeren kan legge inn sitt eget profilbilde" on storage.objects;
drop policy if exists "Brukeren kan bytte sitt eget profilbilde" on storage.objects;
drop policy if exists "Brukeren kan fjerne sitt eget profilbilde" on storage.objects;

create policy "Brukeren kan legge inn sitt eget profilbilde"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatarer'
  and name = (select auth.uid())::text || '/avatar.webp'
);

create policy "Brukeren kan bytte sitt eget profilbilde"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatarer'
  and name = (select auth.uid())::text || '/avatar.webp'
)
with check (
  bucket_id = 'avatarer'
  and name = (select auth.uid())::text || '/avatar.webp'
);

create policy "Brukeren kan fjerne sitt eget profilbilde"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatarer'
  and name = (select auth.uid())::text || '/avatar.webp'
);
