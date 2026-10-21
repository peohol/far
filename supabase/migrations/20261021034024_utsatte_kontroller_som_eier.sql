-- Endringskontrollen kjøres som eieren, ikke som den innloggede.
--
-- `innholdsendringer_kontroll` er utsatt til slutten av transaksjonen. I
-- Postgres 17, som produksjonen kjører, kjøres en utsatt utløser som rollen
-- som gjelder da, altså den innloggede (`authenticated`), selv om endringen ble
-- gjort inne i en `security definer`-funksjon. Kontrollen bruker
-- `intern.antall_deler`, og den innloggede har ingen tilgang til skjemaet
-- `intern`. Derfor stoppet hver endring fra en bruker som føres i
-- endringsloggen (ny fagside, fagside til papirkurven, lagring og publisering)
-- med «permission denied for schema intern». Testdatabasen kjører Postgres 18,
-- der utsatte utløsere kjøres som rollen som la dem i kø, så feilen viste seg
-- ikke der. De to andre utsatte utløserne er alt `security definer`.
--
-- Funksjonen kan ikke kalles direkte (den returnerer `trigger`, og ingen
-- API-rolle har EXECUTE), så dette gir ingen ny tilgang.

alter function intern.kontroller_innholdsendring() security definer;

revoke all on function intern.kontroller_innholdsendring() from public, anon, authenticated, service_role;
