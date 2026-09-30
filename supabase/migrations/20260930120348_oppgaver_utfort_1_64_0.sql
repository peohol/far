-- OPG-004 «Diskusjonstråder på alle sider» er utført i versjon 1.64.0.
-- Oppgavene finnes bare i produksjon; i en ny database gjør migrasjonen
-- ingenting.
select public.fullfor_oppgave(4, '1.64.0') where exists (select 1 from public.oppgaver);