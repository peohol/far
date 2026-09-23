# Redigerbart faginnhold i OUSFAR

Leses når noe som har med informasjonssider, laboratorieanalytter,
innholdselementer, referanser, revisjoner eller publisering å gjøre skal
endres. Planen
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
| `supabase/migrations/*_referanse_objekttype.sql`, `*_referansesystem.sql` | Referansene og koblingene til dem |
| `src/faginnhold/modell.ts` | Formen på innholdet per objekttype, og typene appen bruker |
| `src/faginnhold/lagring.ts` | Kallene appen gjør, og konflikter gjort om til en egen feil |
| `src/faginnhold/referanser.ts` | Siteringer, nummerering, piller og referanseliste — rene funksjoner |
| `src/components/referanser/` | Referansepillen med boblen, og referanselisten |
| `src/__tests__/faginnhold.test.ts`, `referanser.test.ts` | Reglene, prøvd mot en ekte database |
| `src/__tests__/referansenummerering.test.ts`, `referansepille.test.tsx` | Nummereringen, og pillen med mus, berøring og tastatur |
| `src/__tests__/hjelp/testdatabase.ts` | Postgres i minnet, bygd av migrasjonene, og kallene testene gjør |

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
  understrek), og `data` er et JSON-objekt hvis form bestemmes av
  elementtypen. Panelene og elementtypene defineres når sidene bygges.
  Rekkefølgen i et panel er `posisjon`, deretter objekt-ID-en. Posisjonen er
  bevisst ikke unik, siden hvert element lagres for seg og et kort som
  flyttes, ellers ville støtt på plassen det skal til.

- **Referanse** — én kilde i den globale referansebasen. Se
  [Referanser](#referanser).

Fortolkningsmoduler, kommentarer og regelsett er ikke modellert ennå. De
kommer som nye objekttyper, på samme maskineri.

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
triggere stopper det også for server-side klienter og migrasjoner. Eneste
unntak er en referanse som aldri har vært publisert eller brukt (se
[Referanser](#referanser)).

`objektstatus` viser gjeldende og publisert revisjon per objekt;
`objekthistorikk` viser alle handlingene samlet, publiseringene medregnet.
Historikken sorteres på revisjon, med publiseringen etter revisjonen den
gjelder.

## Operasjonene

Alt som endrer noe, går gjennom fire databasefunksjoner, og for referansene
en femte, `slett_referanse` (se [Referanser](#referanser)). Hver av dem krever
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
lest tilbake etter skrivingen. Gjenoppretting skriver utkastet på nytt fra et
eldre øyeblikksbilde, og publisering skriver det publiserte av utkastet — begge
gjennom den samme veien som vanlig lagring. Publiseringen avbrytes om det
publiserte ikke blir nøyaktig likt utkastet.

**Rekkefølgen ved publisering.** Det publiserte kan bare peke på det som også
er publisert. En laboratorieanalytt publiseres derfor etter hovedsiden og
komponentene, og et innholdselement etter siden det står på. Ellers avvises
publiseringen, og ingenting blir halvveis publisert.

**Kjente begrensninger.**

- Hver publisering gjelder ett objekt. To analytter kan derfor ikke bytte kode
  med hverandre, og to sider ikke bytte navn, uten et mellomsteg med en
  midlertidig kode eller et midlertidig navn som også må publiseres. Et samlet
  kall som publiserer flere objekter på én gang, hører hjemme der
  publiseringen får et grensesnitt.
- En vanlig bruker ser ikke innholdet i revisjoner som aldri er publisert,
  men kan se at de finnes: numrene på de publiserte revisjonene har hull, og
  en gjenopprettet revisjon viser hvilken revisjon den kom fra.

## Referanser

En referanse er en objekttype som alle andre, med stabil ID, utkast,
publisering, revisjoner og gjenoppretting. Feltene er de samme som i Slaids —
`tittel`, `forfattere`, `aar` og `lenke`, alle tekst — og den vises som
**Tittel · Forfatter(e) · År · Lenke**, uten tomme ledd. Minst ett av tittel,
forfattere og lenke må være fylt ut, og lenken må begynne med `http://` eller
`https://`. DOI, PMID og lignende er ikke egne felt ennå; de kan legges til
senere uten å endre visningen. `arkivert` er et felt i innholdet, så
arkivering er en vanlig revisjon som kan gjøres om.

**Siteringer.** Innholdet viser til referansene med ID-ene, aldri med numre,
på tre nivåer:

| Nivå | Hvor ID-ene står |
| --- | --- |
| `panel` | Informasjonssidens `panelreferanser`: panelnøkkel → ordnet liste |
| `element` | Innholdselementets `referanser`: kortets kilder, ordnet |
| `inline` | Siteringsnoder hvor som helst i elementets `data`: `{"type": "sitering", "attrs": {"referanser": [...]}}` — samme node som i Slaids, med norske navn |

Et panel eller kort viser til hver referanse bare én gang; inline kan samme
referanse stå så mange ganger som teksten trenger. `type: "sitering"` er
dermed reservert i `data`. ID-ene i en siteringsnode skal stå med små
bokstaver, siden appen kjenner igjen referansene på teksten.

Feltene `panelreferanser` og `referanser` kom til etter at typene ble laget.
Eldre revisjoner mangler dem, og da regnes de som tomme.

**Koblingene.** Hver sitering blir en rad i `referansekoblinger`, skrevet av
de samme funksjonene som skriver innholdet og for samme tilstand. Panel- og
kortreferansene lagres der, ikke som JSON; inline-siteringene leses ut av
dataene. Det er koblingene databasen håndhever reglene med:

- En kobling må peke på en referanse. I det publiserte må referansen også
  være publisert — referansen publiseres før det som siterer den.
- En arkivert referanse kan ikke siteres, og en referanse som er sitert, kan
  ikke arkiveres. Det gjelder hver tilstand for seg: skal en publisert
  referanse arkiveres, må innholdet der den er fjernet, publiseres først.
- `referansebruk` viser hvilke sider hver referanse brukes på, og hvor mange
  ganger, i utkastet og i det publiserte.

**Sletting.** `slett_referanse(objekt, forventet_revisjon)` sletter en
referanse for godt — med revisjonene sine — bare når den aldri har vært
publisert og ikke står i noen revisjon av noe annet objekt, heller ikke en
eldre. Alt annet må arkiveres, så historikken aldri peker på noe som er borte.
Slettingen føres i `slettede_referanser` med siste utkast og hvem som slettet.
Det er det eneste unntaket fra at historikken er uforanderlig, og triggeren
slipper det bare gjennom for den ene referansen, i transaksjonen som sletter
den.

**Nummereringen** regnes ut i `src/faginnhold/referanser.ts` når siden vises,
etter første forekomst i leserekkefølgen på akkurat den siden: panelene i den
rekkefølgen siden viser dem (ukjente paneler etter, alfabetisk), kortene etter
posisjon og ID, og teksten i dokumentrekkefølge. Det en beholder siterer —
panelet, kortet — kommer før det som står i den. Samme referanse beholder
nummeret fra første gang, og kan ha ulike numre på ulike sider. Pillene
komprimerer serier på minst tre (`1–3, 5, 9–11`), og referanselisten nederst
er alltid det nummereringen gir.

**Pillen og boblen** (`Referansepille`) åpnes ved peker over, og ved klikk,
trykk, Enter eller mellomrom; et klikk fester den. Escape, et nytt klikk, et
trykk utenfor eller fokus som går videre, lukker den. Boblen står rett etter
knappen i dokumentet, så Tab når lenkene i den, og plasseres som tipsboblene
(`useBobleplassering` i `Tips.tsx`). Pillene og listen henter numrene og
referansene fra `Sidereferanser` rundt siden.

Appen bruker ikke referansene ennå; det gjør analyttsidene i arbeidspakke 3.

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

Sikkerhetsrådgiveren i Supabase vil peke på at de fem funksjonene og
`er_admin()` kjører med eierens rettigheter og kan kalles av innloggede. Det
er bevisst: det er slik skriveretten holdes borte fra tabellene, og hver av
dem krever administrator før noe annet skjer. Å stenge dem for `authenticated`
ville stengt redigeringen.

## Når noe skal endres

**Ny objekttype.** Den nye verdien i `objekttype` legges til i en migrasjon
for seg, siden en ny enum-verdi ikke kan brukes i samme transaksjon. I neste
migrasjon: en tabell med `(objekt_id, tilstand)` som peker på
`objekttilstander`, triggeren
`intern.krev_objekttype` for typen og for koblinger (`objekt_id` er raden
selv, andre kolonner er koblinger til andre objekter), funksjonsparet
`intern.skriv_<type>` og `intern.les_<type>`, radsikkerhet og rettigheter som
for de andre. Resten av maskineriet finner funksjonene på navnet. Legg typen
og formen inn i `src/faginnhold/modell.ts`, og prøv den i testene.

**Nytt felt på en type.** Revisjonene endres aldri, så eldre øyeblikksbilder
mangler feltet. `skriv_<type>` må tåle det — med en standardverdi, f.eks.
gjennom `intern.med_standard` — ellers kan de eldre revisjonene ikke
gjenopprettes. Det feiler i så fall høylytt, ikke i stillhet.

**Testene** kjører alle migrasjonene i en Postgres i minnet (PGlite), med det
Supabase har på plass fra før gjenskapt i `testdatabase.ts`: API-rollene,
standardrettighetene deres i `public`, `auth.uid()` og tabellene migrasjonene
bygger på. Bruker en ny migrasjon noe mer fra Supabase, utvides grunnlaget
der.
