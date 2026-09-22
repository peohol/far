# Redigerbart faginnhold i OUSFAR

Leses når noe som har med informasjonssider, laboratorieanalytter,
innholdselementer, revisjoner eller publisering å gjøre skal endres. Planen
og fremdriften står i `docs/analyttsider-og-redigering.md`; her står hvordan
fundamentet faktisk er bygget.

Fortolkningen bruker ikke noe av dette ennå. Kommentartekstene, grensene og
reglene ligger fortsatt i de statiske datasettene, og
`src/__tests__/fortolkningUendret.test.ts` holder det slik til byttet gjøres
med vilje.

## Delene

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_faginnhold_fundament.sql` | Tabellene, radsikkerheten og funksjonene |
| `src/faginnhold/modell.ts` | Formen på innholdet per objekttype, og typene appen bruker |
| `src/faginnhold/lagring.ts` | Kallene appen gjør, og konflikter gjort om til en egen feil |
| `src/__tests__/faginnhold.test.ts` | Reglene, prøvd mot en ekte database |
| `src/__tests__/hjelp/testdatabase.ts` | Postgres i minnet, bygd av migrasjonene |

## Domenet

Tre begreper holdes fra hverandre, som planen krever:

- **Informasjonsside** (`infoside`) — siden om et virkestoff, f.eks.
  Amitriptylin. Har foreløpig bare et navn; innholdet på siden er
  innholdselementer.
- **Laboratorieanalytt** — koden laboratoriet rapporterer, f.eks.
  `AMTNORSUM`. Har nøyaktig én hovedside og en ordnet liste med
  **komponenter**: informasjonssidene for stoffene analysen omfatter. For
  `AMTNORSUM` er hovedsiden Amitriptylin og komponentene amitriptylin og
  nortriptylin. Minst én komponent, ingen to like, og hver kode brukes av bare
  én analytt.
- **Innholdselement** — et kort, felt eller tekststykke på en
  informasjonsside. `panel` og `elementtype` er nøkler (små bokstaver, tall og
  understrek), `posisjon` gir rekkefølgen, og `data` er et JSON-objekt hvis
  form bestemmes av elementtypen. Panelene og elementtypene defineres når
  sidene bygges.

Fortolkningsmoduler, kommentarer, regelsett og referanser er ikke modellert
ennå. De kommer som nye objekttyper, på samme maskineri.

## Objekter, revisjoner og tilstander

Alt som kan redigeres, er et **objekt** med stabil ID i
`redigerbare_objekter`. Typen avgjør hvilken tabell innholdet ligger i.

- **Revisjoner** (`objektrevisjoner`): hver endring av innholdet blir en ny
  rad, nummerert fortløpende per objekt fra 1. Raden har et komplett
  øyeblikksbilde av objektet (`innhold`, samme form som det appen sender),
  handlingen (`opprettet`, `endret` eller `gjenopprettet`), bruker-ID-en og
  fornavn og etternavn slik de sto i profilen da. Bruker-ID-en har bevisst
  ingen fremmednøkkel, så historikken står også om kontoen fjernes.
- **Tilstander** (`objekttilstander`): hvilken revisjon som er **utkastet**
  (arbeidsversjonen) og hvilken som er **publisert**. Innholdet i begge ligger
  som vanlige rader i tabellen for typen, med kolonnen `tilstand` — de samme
  kontrollene gjelder for begge, og det publiserte kan leses som vanlige
  tabeller.
- **Publiseringer** (`objektpubliseringer`): hver publisering, med
  revisjonen som ble publisert, den den erstattet, og hvem.

Revisjoner, publiseringer og objekter kan ikke endres eller slettes av noen —
triggere stopper det også for server-side klienter og migrasjoner.

`objektstatus` viser gjeldende og publisert revisjon per objekt;
`objekthistorikk` viser alle handlingene samlet, publiseringene medregnet.
Historikken sorteres på revisjon, med publiseringen etter revisjonen den
gjelder.

## Operasjonene

Alt som endrer noe, går gjennom fire databasefunksjoner. Hver av dem krever
administrator før noe annet skjer, gjør hele endringen i én transaksjon og
gir tilbake objektets nye status.

| Funksjon | Hva den gjør |
| --- | --- |
| `opprett_utkast(objekttype, innhold)` | Nytt objekt; utkastet blir revisjon 1 |
| `lagre_utkast(objekt, forventet_revisjon, innhold)` | Ny revisjon av utkastet. Uendret innhold gir ingen ny revisjon |
| `gjenopprett_revisjon(objekt, forventet_revisjon, fra_revisjon)` | Ny revisjon med innholdet fra en tidligere. Alt senere blir stående |
| `publiser_utkast(objekt, forventet_revisjon)` | Publiserer utkastet slik det står. Lager ingen ny revisjon |

**Samtidighet.** `forventet_revisjon` er revisjonen brukeren åpnet. Funksjonen
låser utkastet og sammenligner; er det kommet en nyere revisjon i mellomtiden,
avvises kallet med SQLSTATE `PT409`, som data-API-et svarer på med HTTP 409.
Detaljene sier hvilken revisjon som er gjeldende. En annen lagring som kommer
samtidig, venter på låsen og avvises på samme måte. `lagring.ts` gjør dette om
til `Samtidighetskonflikt`.

**Andre feil.** `42501` er manglende rettighet, `22023` ugyldig innhold, og
`PT404` et objekt som ikke finnes; meldingene er skrevet for å vises. `23505`
og `23514` er brudd på en regel i tabellen, med teknisk melding.

**Øyeblikksbildet** som lagres, er alltid det som faktisk havnet i tabellene,
lest tilbake etter skrivingen. Publisering og gjenoppretting skriver
tabellene på nytt fra et øyeblikksbilde, gjennom den samme veien.

## Tilgang

- Alle innloggede leser det publiserte: publiserte rader, revisjoner som har
  vært publisert, og publiseringene.
- Administratorer leser i tillegg utkastene og hele historikken.
- Ingen har skriverett på tabellene — heller ikke administratorer eller den
  hemmelige nøkkelen. Endringer går bare gjennom funksjonene over, som slår
  opp rollen i profiltabellen med `public.er_admin()`/`intern.krev_admin()`.
- Hjelpefunksjonene ligger i skjemaet `intern`, som ingen av API-rollene har
  tilgang til.
- `anon` har ingen tilgang i det hele tatt.

Sikkerhetsrådgiveren i Supabase vil peke på at de fire funksjonene og
`er_admin()` kjører med eierens rettigheter og kan kalles av innloggede. Det
er bevisst: det er slik skriveretten holdes borte fra tabellene, og hver av
dem krever administrator før noe annet skjer. Å stenge dem for `authenticated`
ville stengt redigeringen.

## Når noe skal endres

**Ny objekttype.** I en ny migrasjon: en ny verdi i `objekttype`, en tabell
med `(objekt_id, tilstand)` som peker på `objekttilstander`, triggeren
`intern.krev_objekttype` for typen og for koblinger, funksjonsparet
`intern.skriv_<type>` og `intern.les_<type>`, radsikkerhet og rettigheter som
for de andre. Resten av maskineriet finner funksjonene på navnet. Legg typen
og formen inn i `src/faginnhold/modell.ts`, og prøv den i testene.

**Nytt felt på en type.** Revisjonene endres aldri, så eldre øyeblikksbilder
mangler feltet. `skriv_<type>` må tåle det — med en standardverdi — ellers kan
de eldre revisjonene ikke gjenopprettes. Det feiler i så fall høylytt, ikke i
stillhet.

**Testene** kjører alle migrasjonene i en Postgres i minnet (PGlite), med det
Supabase har på plass fra før gjenskapt i `testdatabase.ts`: API-rollene,
standardrettighetene deres i `public`, `auth.uid()` og tabellene migrasjonene
bygger på. Bruker en ny migrasjon noe mer fra Supabase, utvides grunnlaget
der.
