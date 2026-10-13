-- OPG-005 «Endre tablettikonet til preparater så man ser om de kan deles eller ikke»
-- er utført i versjon 1.90.0. Oppgavene finnes bare i produksjon; i en ny
-- database gjør migrasjonen ingenting.
select public.fullfor_oppgave(5, '1.90.0') where exists (select 1 from public.oppgaver);