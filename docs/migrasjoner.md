# Migrasjoner og utrullingen til produksjonen

Leses når en migrasjon skal lages, rulles ut eller en utrulling har stoppet.
Reglene for hva en migrasjon kan inneholde, står i `supabase/CLAUDE.md`.

## Normalflyten

1. **Migrasjonen lages i PR-en**, som
   `supabase/migrations/<versjon>_<navn>.sql`. Versjonen er tidspunktet i UTC
   med 14 sifre, og skal være nyere enn alle migrasjonene på `main`.
2. **CI kontrollerer PR-en** (`.github/workflows/ci.yml`), uten noen tilgang
   til produksjonen:
   - `npm run kontroller:migrasjoner -- --mot …`: filnavnene, at ingen
     migrasjon som er kjørt i produksjonen er endret, fjernet eller omdøpt, at
     nye migrasjoner er nyere enn dem på `main`, og at ingen ny migrasjon har
     destruktive setninger uten godkjenning (under);
   - `npm test`, som kjører alle migrasjonene i en database i minnet;
   - `npm run build`.
3. **PR-en slås sammen.** For en ordinær, testet migrasjon er sammenslåingen
   godkjenningen; den trenger ikke noe eget ja.
4. **GitHub Actions ruller den ut** (`.github/workflows/produksjonsmigrering.yml`),
   når en sammenslåing til `main` endrer `supabase/migrations/`:
   - *forkontroll*: historikken i produksjonen stemmer med filene, produksjonen
     har ingen migrasjon uten fil, ingen ventende migrasjon er destruktiv uten
     godkjenning, og en tørrkjøring av `supabase db push` planlegger nøyaktig de
     migrasjonene produksjonen mangler;
   - *utrullingen*: `supabase db push` kjører bare de som mangler, hver i én
     transaksjon sammen med raden i historikken;
   - *etterkontroll*: historikken stemmer nøyaktig med alle filene.
5. **Feiler et steg, stopper kjøringen** med feilen i loggen og sammendraget,
   og ingenting mer rulles ut. En migrasjon som feiler, er rullet tilbake.

Kjøringene står under *Actions → Produksjonsmigrering* i GitHub. Der kan den
også startes på nytt med *Run workflow* (bare på `main`).

`npm run produksjonsmigrering -- forkontroll | utrull | etterkontroll` er
stegene (`scripts/produksjonsmigrering.ts`). Med `SUPABASE_DB_URL` gjelder de
en annen database, for å prøve dem lokalt.

## Sikkerheten

- **Bare `main`.** Utrullingen starter bare ved en sammenslåing til `main` (eller
  manuelt på `main`), og jobben sjekker grenen selv. Hemmelighetene ligger i
  GitHub-miljøet `produksjon`, som bare `main` får bruke, så en arbeidsflyt på
  en annen gren når dem ikke. CI-arbeidsflyten på PR-ene har ingen hemmeligheter.
- **Én om gangen.** `concurrency: supabase-produksjon` gjør at en ny kjøring
  venter til den forrige er ferdig, så to utrullinger aldri går samtidig.
- **Hemmelighetene** settes bare i stegene som bruker CLI-en, etter at
  avhengighetene er installert uten installasjonsskript. GitHub skjuler dem i
  loggene, og skriptet skriver aldri ut argumentene det gir CLI-en.
- **Destruktive migrasjoner** må godkjennes eksplisitt, etter den risikobaserte
  regelen i `CLAUDE.md`. De setningene som kan skilles ut sikkert, stoppes
  automatisk: `drop table`, `drop schema`, `drop database`, `drop column`,
  `truncate` og `disable row level security`. En migrasjon med noen av dem
  stoppes både i CI og før utrullingen, til den har en kommentarlinje med
  hvem som godkjente, når og hva:

  ```sql
  -- destruktiv-godkjent: Peder 2026-10-05, fjerner den tomme tabellen x
  ```

  Merket skrives først når den som eier prosjektet har godkjent akkurat den
  migrasjonen. Andre risikoer i regelen (bred sletting, endringer i
  RLS/grants, lange låser) lar seg ikke skille ut sikkert maskinelt, og vurderes
  før PR-en slås sammen.

## Oppsettet i GitHub

Utrullingen trenger miljøet `produksjon` (*Settings → Environments*) med
*Deployment branches* begrenset til `main`, og hemmelighetene der:

| Hemmelighet | |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Påkrevd. Et personlig tilgangstoken fra en Supabase-konto med tilgang til prosjektet (*Account → Access Tokens*). |
| `SUPABASE_DB_PASSWORD` | Ikke nødvendig. Uten passordet lager CLI-en en midlertidig innloggingsrolle med tokenet. |

Prosjekt-ref-en (`jfzqowsmjtthpbipnxnf`) står i arbeidsflyten; den er ikke
hemmelig. `project_id = "ousfar"` i `supabase/config.toml` er bare navnet på
det lokale oppsettet, ikke produksjonsprosjektet.

## Reserveveien: `apply_migration`

Supabase-MCP-ens `apply_migration` brukes bare når automatikken ikke kan:
for å rette opp etter en utrulling som har stoppet, eller for en
statusendring som må gjelde før PR-en er slått sammen (som `oppgaver_tatt` i
skillen `utfor-oppgaver`). Da:

- gis fila nøyaktig versjonen og navnet prosjektet registrerte;
- må fila inn på `main` så raskt som mulig: frem til den er der, stopper
  hver automatiske utrulling, fordi produksjonen har en migrasjon repoet ikke
  har;
- kjøres kontrollen av historikken (under), og den skal ikke gi noen rader.

## Kontrollen av historikken

`npm run kontroller:migrasjoner` kontrollerer filnavnene (14 sifre, understrek,
navn; én fil per versjon) og skriver en lesespørring som sammenligner
versjonen, navnet og innholdet i hver fil med det databasen har registrert.
Den kan kjøres med `execute_sql` eller i SQL-editoren. Ingen rader betyr at
alt stemmer; ellers sier hver rad hva som avviker, også når en fil har en
annen versjon enn den som ble registrert. Utrullingen kjører den samme
sammenligningen før og etter.

Teksten er lagret på to måter. CLI-en deler fila i setninger og lagrer dem hver
for seg, uten blanke tegn og semikolon i endene, og fører ikke `created_by`;
`apply_migration` og SQL-editoren lagrer hele teksten som én. For radene fra
CLI-en sammenlignes derfor teksten uten blanke tegn og semikolon, så en
forskjell bare i mellomrom ses ikke der.

Avvik som er avklart, står i `KJENTE_AVVIK` i
`src/faginnhold/migrasjonshistorikk.ts`, med md5 av fila og av teksten som ble
kjørt, og hvorfor. De vises igjen om fila eller teksten endres.

## Når utrullingen stopper

| Melding | Hva den betyr |
| --- | --- |
| *registrert i produksjonen, men har ingen fil i repoet* | En migrasjon er rullet ut utenom (reserveveien) og ikke lagt på `main`. Legg fila inn med versjonen som ble registrert. |
| *annet innhold enn det som ble kjørt* | Fila er endret etter at den ble kjørt. Sett den tilbake; en retting er en ny migrasjon. |
| *registrert med en annen versjon* | Den samme migrasjonen er kjørt under en annen versjon. Gi fila den versjonen. |
| *inneholder drop table …* | Destruktiv uten godkjenningsmerket (over). |
| *Tørrkjøringen planlegger andre migrasjoner …* | CLI-en og kontrollen er uenige om hva som mangler. Ingenting er endret; finn årsaken før noe rulles ut. |
| En SQL-feil under utrullingen | Migrasjonen er rullet tilbake og ikke registrert, og de etter den er ikke kjørt. Siden den ikke er kjørt, kan den rettes i en ny PR. |
