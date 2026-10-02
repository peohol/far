# Stoffregisteret

Leses når noe ved stoffregisteret skal endres: inndelingen i kategorier,
helsiden (`#/stoffregister`), redigeringen, arkivet eller papirkurven.
Stoffene, aliasene og koblingene til laboratorieanalysene står i
`docs/faginnhold.md` og `docs/stoffsider-og-redigering.md`.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_stoffregister_redigering.sql` | Tabellene, radsikkerheten, reglene og funksjonene appen kaller, og inndelingen registeret fikk første gang |
| `src/data/stoffregister.json` | Stoffene, aliasene og koblingene til analysene (ikke inndelingen) |
| `src/domain/stoffregister.ts` | Registeret slik appen viser det (`byggStoffregister`): datafilen, fagsidene og inndelingen fra databasen. Uten riktekst, så fortolkningen ikke drar faginnholdet med seg |
| `src/stoffregister/` | Svaret fra databasen og endringene i det (`modell.ts`), kallene (`api.ts`) og kilden sidemenyen, helsiden og fagsidene deler (`Stoffregisterkilde.tsx`) |
| `src/components/stoffregister/` | Helsiden, kortene, redigeringsbrettet, arkivet og papirkurven, og menyen og meldingen på fagsiden (`Fagsidestatus.tsx`) |
| `src/styles/stoffregister.css`, `src/styles/sortering.css` | Utseendet; dra-og-slipp deles med diskusjonene |

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
stoff. Kortet viser oppsummeringen, veien til fagsiden og fortolkningen, hvor
stoffet står (med valg som legger det til i eller tar det ut av en kategori),
og knappene som arkiverer og sletter det. Det som endrer stoffet, tegnes først
når kortet åpnes. Siden har sine egne diskusjoner (`register:stoffregister`,
se `docs/diskusjoner.md`). `Escape` lukker den.

**Oppsummeringen** er en kort riktekst i panelet «Identitet» på fagsiden
(elementet `oppsummering`), og skrives og redigeres der. Er den ikke skrevet,
står det i kortet.

**Redigeringen** («Rediger» i toppmenyen) gjøres bare her, aldri i
sidemenyen. Kategoriene og underkategoriene lages, gis nytt navn, flyttes
(med dra-og-slipp eller «Flytt opp»/«Flytt ned»), arkiveres og slettes.
Stoffene dras mellom kategoriene. En kategori dras inn i en annen og blir en
underkategori, så lenge den ikke har egne underkategorier. Administratorene kan
lage en ny fagside her, i kategorien de velger.

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
`kanSletteKategori`) for å vise bare knappene som virker.
