# Supabase-laget

Tillegg til reglene i rotens `CLAUDE.md`. Gjelder alt under `supabase/`.

- Bakgrunnen for brukersystemet står i `docs/brukere.md`. Les den før noe her
  endres.
- Migrasjoner er append-only. Filnavnene svarer til versjonene i prosjektets
  migrasjonshistorikk; endres et filnavn, kommer repoet ut av takt med
  prosjektet.
- `functions/_delt/` leses også av appen, gjennom `@delt/...`. Den skal være
  ren TypeScript uten Deno-API-er og uten avhengigheter. Alt som bare hører
  til serveren, ligger i `functions/_edge/`.
- Reglene for brukernavn finnes både her og i SQL. Endres de, skal begge
  stedene endres i samme omgang — testen `src/__tests__/brukersystem.test.ts`
  kontrollerer at de stemmer overens.
- En privilegert klient skal aldri tas i bruk før den innloggede er
  autentisert, bruker-ID-en er lest fra JWT-en, rollen er slått opp
  server-side og inndataene er validert. `functions/_edge/kontekst.ts` gjør
  det i riktig rekkefølge; nye endepunkter skal bygges på den.
- Hemmelige nøkler hører hjemme i miljøet, aldri i repoet eller i noe som
  bygges inn i klienten.
