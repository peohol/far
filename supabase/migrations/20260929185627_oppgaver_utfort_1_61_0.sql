-- OPG-003 «Søk skal være sensitivt for stoff-alias og forkortelser» er utført i
-- versjon 1.61.0. Oppgavene finnes bare i produksjon; i en ny database gjør
-- migrasjonen ingenting.
select public.fullfor_oppgave(3, '1.61.0') where exists (select 1 from public.oppgaver);