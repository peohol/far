-- OPG-002 «Oppdatering av siden når en ny versjon er tilgjengelig» er utført i
-- versjon 1.60.0. Oppgavene finnes bare i produksjon; i en ny database gjør
-- migrasjonen ingenting.
select public.fullfor_oppgave(2, '1.60.0') where exists (select 1 from public.oppgaver);