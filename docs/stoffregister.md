# Stoffregisteret

Leses når noe ved stoffregisteret skal endres: inndelingen i kategorier,
helsiden (`#/stoffregister`), redigeringen, arkivet eller papirkurven.
Stoffene, aliasene og koblingene til laboratorieanalysene står i
`docs/faginnhold.md` og `docs/stoffsider-og-redigering.md`.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_stoffregister_redigering.sql` | Tabellene, radsikkerheten og inndelingen registeret fikk første gang |
| `supabase/migrations/*_stoffregister_lesing.sql` | Funksjonen appen leser registeret med, og de som lager, gir nytt navn til, flytter og arkiverer kategoriene |
| `supabase/migrations/*_stoffregister_funksjoner.sql` | Sletting av kategorier, plassering, arkiv, og å legge i og hente fra papirkurven |
| `supabase/migrations/*_stoffregister_papirkurv.sql` | Slettingen for godt fra papirkurven |
| `src/data/stoffregister.json` | Stoffene, aliasene og koblingene til analysene (ikke inndelingen) |
| `src/domain/stoffregister.ts` | Registeret slik appen viser det (`byggStoffregister`): datafilen, fagsidene og inndelingen fra databasen. Uten riktekst, så fortolkningen ikke drar faginnholdet med seg |
| `src/stoffregister/` | Svaret fra databasen og endringene i det (`modell.ts`), kallene (`api.ts`) og kilden sidemenyen, helsiden og fagsidene deler (`Stoffregisterkilde.tsx`) |
| `src/components/stoffregister/` | Helsiden, kortene, redigeringsbrettet med menyene, arkivet og papirkurven, og menyen og meldingen på fagsiden (`Fagsidestatus.tsx`) |
| `src/components/stoffregister/registerdra.ts` | Reglene for dra-og-slipp i redigeringen (se under) |
| `src/hooks/useSortering.ts`, `src/styles/stoffregister.css`, `src/styles/sortering.css` | Dra-og-slipp, felles med diskusjonene, og utseendet |

## Inndelingen

Kategoriene står i `public.stoffkategorier`, med to nivåer: kategorier og
underkategorier. Hver har en plass blant søsknene, et navn som er unikt blant
dem, et valgfritt ikon (et navn fra ikonregisteret) og kan være arkivert.
Hvilke stoffer som står hvor, står i `public.stoffplasseringer`, etter stoffets
nøkkel. Et stoff kan stå i flere kategorier, også i en kategori og en
underkategori i den. Stoffene står alltid alfabetisk; bare kategoriene har
rekkefølge.

Et stoff som ikke står noe sted, eller bare i en arkivert kategori, står i
«Andre stoffer», alltid sist. Det er ingen kategori i databasen og kan ikke
redigeres.

`les_stoffregister(sidetilstand)` gir alt i ett kall: kategoriene,
plasseringene, statusene og fagsidene (ID, nøkkel, navn, om siden har innhold,
og oppsummeringen). Sidemenyen og helsiden viser det samme registeret fra den
samme kilden, så de er alltid like. En endring vises med en gang, før
databasen har svart; kallene går ett og ett, og når de er ferdige, hentes det
databasen har. Registeret hentes på nytt når fanen blir synlig igjen.

## Helsiden

`#/stoffregister`, lenket fra bunnen av sidemenyen, er bygd som fagsidene: en
seksjon per kategori, underkategoriene som mellomtitler og et detaljkort per
stoff, i et rutenett med like brede kort (`.skuffrutenett`, som
farmakodynamikk-kortene). Lukket viser kortet navnet og begynnelsen på
oppsummeringen, aldri analysekodene. Åpnet viser det hele oppsummeringen,
analysene og veien til fagsiden og fortolkningen. Visningen er bare for å
lese: alt som endrer et stoff, gjøres i redigeringen. Siden har sine egne
diskusjoner (`register:stoffregister`, se `docs/diskusjoner.md`). `Escape`
lukker den.

**Oppsummeringen** er en kort riktekst i panelet «Identitet» på fagsiden
(elementet `oppsummering`), og skrives og redigeres der. Er den ikke skrevet,
står det i kortet.

**Redigeringen** («Rediger» i toppmenyen) gjøres bare her, aldri i
sidemenyen eller lesevisningen. Kategoriene og underkategoriene står som kort
som kan lukkes (hver for seg, eller «Lukk alle»/«Åpne alle»; det huskes over
en oppdatering av appen), med stoffene som små brikker i et rutenett. Hver
kategori, underkategori og hvert stoff har en meny til høyre (som i Huskis)
i stedet for en rad med knapper:

- Kategorier: «Gi nytt navn», «Ny underkategori», «Flytt opp»/«Flytt ned»,
  «Flytt til» (en annen kategori, eller ut som egen kategori), «Arkiver» og
  «Slett» (trykkes to ganger).
- Stoffer: «Åpne fagside», «Flytt til», «Legg også til i», «Ta ut av …»,
  «Arkiver» og «Slett» (kan angres).

En kategori dras inn i en annen og blir en underkategori, så lenge den ikke
har egne underkategorier. Administratorene kan lage en ny fagside her, i
kategorien de velger.

### Dra-og-slipp i redigeringen

Kategoriene dras i overskriften, stoffene hvor som helst på brikken; med
tastaturet løftes de med mellomrom og flyttes med piltastene. Reglene er
hentet fra Huskis (`docs/drag-and-drop.md` der) og står i `registerdra.ts`
og `useSortering`:

- **Alt annet folder seg sammen før det løftede måles** (`data-drar` på
  brettet). Drar man en kategori, står bare overskriftene igjen; drar man en
  underkategori, står kategoriene og underkategoriene igjen uten stoffene.
  Drar man et stoff, får en kategori uten egne stoffer en tom flate å slippe
  i.
- **Det løftede blir under pekeren** (`holdGrepet`): siden rulles like mye som
  det over foldet seg sammen, og lista holdes like høy mens man drar, så
  målet ikke smetter unna. Derfor kan også en lang kategori dras helt til
  topps.
- **En plassholder viser hvor det havner.** Stoffene står alltid alfabetisk,
  så plassholderen legges på den alfabetiske plassen i lista pekeren er over.
  Med tastaturet tar hvert piltrykk stoffet til den neste eller forrige lista.
- **En lukket kategori åpnes for en titt** når et stoff eller en underkategori
  holdes over den et øyeblikk, lukkes igjen når man drar videre, og blir
  stående åpen når man slipper i den.

## Arkiv og papirkurv

Statusen til en fagside står i `public.stoffstatus`: `arkivert`, `papirkurv`
eller `fjernet` (slettet for godt; nøkkelen huskes, så et stoff fra datafilen
ikke kommer tilbake). Uten rad er siden aktiv. Arkiverte sider og sider i
papirkurven står ikke i registeret eller i søket.

- Alle kan arkivere en fagside eller en kategori og hente den tilbake.
- Alle kan slette en fagside som bare har et navn. Bare administratorer kan
  slette en med innhold. Det gjøres fra siden («Mer for fagsiden»), fra
  registeret og fra arkivet.
- En fagside fortolkningen lenker til (stoffet er koblet til en analyse), og et
  stoff uten side i databasen, kan bare arkiveres. Databasen kjenner de
  koblede stoffene fra `public.analyttkoblede_stoffer`, som må følge
  `analyttkoblinger` i datafilen: en ny kobling føres inn med en migrasjon, og
  `stoffregisterdb.test.ts` feiler til det er gjort.
- Alle kan slette en tom kategori; bare administratorer en med stoffer.
  Stoffene havner i «Andre stoffer», eller blir stående der de ellers står.
- En slettet fagside havner i papirkurven, som bare administratorene ser.
  Derfra hentes den tilbake, slettes for godt, eller tømmes alt. Den som
  slettet, kan angre det selv om den ikke ser papirkurven.
- Det som har ligget i papirkurven i mer enn 30 dager, slettes for godt når
  noen åpner appen (`rydd_stoffpapirkurven`). Revisjonene, diskusjonene,
  favorittene og plasseringene går med, og `slettede_stoffsider` husker hva
  som ble slettet og av hvem. En side noe annet i historikken peker på, blir
  liggende i papirkurven.

Reglene håndheves i databasen. Appen har de samme (`kanSletteStoff`,
`kanSletteKategori`) for å vise bare valgene som virker.
