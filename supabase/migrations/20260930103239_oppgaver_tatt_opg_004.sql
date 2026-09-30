-- OPG-004 «🧐 Diskusjonstråder på alle sider» håndteres av en agent. Oppgavene
-- finnes bare i produksjon; i en ny database gjør migrasjonen ingenting.
select public.ta_oppgaver(array[4]) where exists (select 1 from public.oppgaver);