-- Versjonen for sidene i sokedata_versjoner() er sekvensens last_value. En ny
-- sekvens har last_value = startverdien med is_called = false, og det første
-- nextval() gir nettopp startverdien: last_value står stille, bare is_called
-- slår om. Den første publiserte endringen ville dermed ikke endret versjonen,
-- og appen ville fortsatt vist sidene den hadde lagret.
--
-- Ett nextval() her tar sekvensen i bruk, slik at hvert senere nextval() øker
-- last_value. Det er trygt i begge tilstander sekvensen kan ha:
--   * ennå ikke brukt (1, is_called = false): last_value blir stående på 1, så
--     versjonen appene har lagret, gjelder fortsatt — ingenting er publisert.
--   * allerede brukt (n, is_called = true): versjonen øker til n + 1, og appene
--     henter sidene på nytt én gang. Det fanger også en første publisering som
--     ikke endret versjonen før denne rettingen.
do $$
begin
  perform nextval('intern.publisert_innhold_versjon');
end
$$;
