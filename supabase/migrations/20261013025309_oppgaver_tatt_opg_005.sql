-- OPG-005 «Endre tablettikonet til preparater så man ser om de kan deles eller ikke»
-- håndteres av en agent. Oppgavene finnes bare i produksjon; i en ny database
-- gjør migrasjonen ingenting.
select public.ta_oppgaver(array[5]) where exists (select 1 from public.oppgaver);