-- OPG-003 «Søk skal være sensitivt for stoff-alias og forkortelser» håndteres
-- av en agent. Oppgavene finnes bare i produksjon; i en ny database gjør
-- migrasjonen ingenting.
select public.ta_oppgaver(array[3]) where exists (select 1 from public.oppgaver);