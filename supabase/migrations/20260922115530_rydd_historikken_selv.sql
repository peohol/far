-- Rydder bort bokføringen etter det første utkastet av brukersystemet.
--
-- Under oppsettet ble skjemaet lagt på, revet og lagt på igjen mens formen
-- satte seg. Det etterlot rader i migrasjonshistorikken som ikke svarer til
-- noen fil her, og historikken skal speile mappa.
--
-- Fila finnes fordi raden finnes: en migrasjon kan ikke slette sin egen rad,
-- siden raden føres inn etter at SQL-en har kjørt. Forsøket på det er nettopp
-- det som etterlot denne. Mot et nytt prosjekt gjør den ingenting — radene
-- den peker på, har aldri eksistert der.
--
-- Se regelen om dette i supabase/CLAUDE.md.

delete from supabase_migrations.schema_migrations
where name in ('rydd_migrasjonshistorikk', 'rydd_historikken_selv');
