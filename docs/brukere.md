# Brukersystemet i OUSFAR

Leses når noe som har med innlogging, brukere, roller eller profilbilder å
gjøre skal endres. Den kliniske delen av appen berøres ikke av noe her.

## Kort fortalt

OUSFAR er lukket. Det finnes ingen registrering, ingen «glemt passord»-lenke
og ingen e-post i det hele tatt. En administrator oppretter kontoen og gir
brukeren et midlertidig passord. Brukeren logger inn med **brukernavn og
passord**, velger sitt eget passord med én gang, og er inne.

## Delene det består av

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/` | Tabellene, radsikkerheten og lagringsreglene |
| `supabase/functions/` | Operasjonene som krever forhøyede rettigheter |
| `supabase/functions/_delt/` | Reglene appen og serveren deler |
| `src/auth/` | Økten, kallene mot Supabase og bildebehandlingen |
| `src/components/konto/` | Innlogging, førstegangsoppsett, konto og brukerliste |
| `src/domain/tilgang.ts` | Hva som vises: innlogging, oppsett eller appen |

## Brukernavn og den interne Auth-adressen

Supabase Auth krever en e-postadresse for passordinnlogging. OUSFAR samler
ikke inn e-post, så adressen utledes av brukernavnet på et domene som aldri
kan eksistere: `peohol` → `peohol@auth.ousfar.invalid`.

Adressen er en teknisk nøkkel. Den vises ikke noe sted, kan ikke endres, og
det sendes aldri e-post fra systemet.

Reglene for brukernavn står i `supabase/functions/_delt/brukernavn.ts` og er
speilet i databasen i `public.brukernavn_er_gyldig()`. **Endres de ett sted,
må de endres begge steder** — testen `src/__tests__/brukersystem.test.ts`
sier fra hvis de kommer i utakt.

## Hvorfor registrering er umulig

Prosjektinnstillingene har registrering slått av, men det er ikke der
sperren ligger. Triggeren `paa_ny_auth_bruker` på `auth.users` krever en
kortlivet rad i `public.kontoreservasjoner` for brukernavnet. Den tabellen
har ingen rettigheter for `anon` eller `authenticated`, så en reservasjon kan
bare legges inn av noe som har den hemmelige nøkkelen — altså adminveien vår.
Uten reservasjon blir kontoen aldri til, uansett hva som står i
innstillingene.

Supabase fyller ut `app_metadata` og bekrefter adressen *etter* at raden er
lagt inn, så en trigger kan ikke kjenne igjen adminveien på kontoen selv.
Det er grunnen til at reservasjonen finnes.

## Hva den innloggede kan gjøre selv

Radsikkerheten lar alle innloggede lese alle profiler, og skrive bare i sin
egen rad. Kolonnerettighetene smalner det ytterligere inn: nettleseren har
skriverett på `first_name`, `last_name` og `avatar_path`, og ingenting annet.
En trigger avviser i tillegg endringer i `username`, `role`,
`must_change_password` og `onboarding_completed` når det er `authenticated`
som skriver. Rollen kan altså ikke settes fra nettleseren i det hele tatt.

## Adminoperasjonene

Alle går gjennom en Edge-funksjon, og alle følger samme rekkefølge:
autentiser, les bruker-ID fra JWT-en, slå opp rollen server-side i
profiltabellen, valider det som er sendt inn — og først da bruk den
privilegerte klienten. Fellesdelen ligger i `functions/_edge/kontekst.ts`.

| Funksjon | Hva den gjør |
| --- | --- |
| `opprett-bruker` | Oppretter konto og returnerer et midlertidig passord |
| `nytt-passord` | Gir en bruker et nytt midlertidig passord |
| `sett-rolle` | Gir eller fjerner adminstatus hos en annen |
| `fullfor-oppsett` | Fullfører førstegangsoppsettet for den innloggede |

Det midlertidige passordet vises én gang, til administratoren som ba om det.
Det lagres ingen steder, logges ikke, og kan ikke hentes fram igjen. Mistes
det, lages et nytt.

## Førstegangsoppsettet

`must_change_password` eller `onboarding_completed` avgjør om brukeren sendes
dit; se `src/domain/tilgang.ts`. Passordet settes server-side, og Supabase
kaster da den gjeldende økten — derfor logger appen inn på nytt med det
passordet brukeren nettopp valgte. Uten det ville brukeren falt ut av appen
en time senere.

## Profilbilder

Privat bøtte `avatarer`, én fast sti per bruker: `<bruker-id>/avatar.webp`.
Alle innloggede kan se bildene gjennom signerte lenker; bare eieren kan
skrive i sin egen mappe. Bildet beskjæres, roteres og komprimeres i
nettleseren til 512 × 512 WebP før det lastes opp.

## Oppsett og drift

Migrasjoner og Edge-funksjoner ligger i repoet og rulles ut mot prosjektet
med Supabase CLI eller MCP. Filnavnene på migrasjonene følger versjonene i
prosjektets historikk, så de skal ikke endres i ettertid.

Appen trenger to innstillinger i Vercel, begge offentlige:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Hemmelige nøkler skal aldri ligge i `VITE_`-variabler — de blir med i bygget.

### Den første administratoren

`npm run bootstrap:admin` oppretter den, idempotent. Den leser
`BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, `SUPABASE_URL` og
`SUPABASE_SECRET_KEY` fra miljøet. Finnes brukeren fra før, blir passordet
stående urørt og skriptet sørger bare for at adminrollen er på plass.

### Om alle administratorene blir borte

Ingen kan gi seg selv adminstatus, så da må rollen settes utenfra: kjør
bootstrap-skriptet på nytt for en konto som finnes, eller sett
`role = 'admin'` i `public.profiles` med den hemmelige nøkkelen.
