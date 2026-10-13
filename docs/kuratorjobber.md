# Kuratorjobber

Leses av ChatGPT-monografkuratoren, og av den som endrer jobbene. Jobbene er
den tekniske hjelpen kuratoren får fra GitHub Actions under en kuratering
(`docs/monografkuratering.md`):

- **Funksjonstesten** leser en fagside med de samme kallene og den samme koden
  appen bruker, som en vanlig innlogget bruker, og kontrollerer at hver del
  virker: `les_stoff`, legemiddeldataene fra FEST, bivirkningene fra
  preparatomtalene, ClinPGx og CPIC. Kuratorens Supabase-tilkobling leser
  databasen direkte og kan ikke gjøre dette.
- **SPC-hentingen** henter de originale preparatomtalene (PDF) fra DMP,
  kontrollerer at filene kom hele, tar vare på hvor og når de ble hentet, og
  lager tekstuttrekk og sidebilder. Kuratoren kontrollerer tabellene visuelt
  mot sidebildene; tekstuttrekket erstatter ikke det.

Jobbene gjør ikke noe faglig arbeid og endrer ingenting i databasen eller på
fagsidene. De leser og henter, og legger resultatet fram.

**Repoet er offentlig, og det er jobbgrenene også.** Resultatet har derfor
bare det som allerede er offentlig: utfall, tall og tekniske meldinger fra
funksjonstesten, og preparatomtalene fra DMP med FESTs preparatdata. Innholdet
appen leser bak innloggingen (fagsidene, redaktørene, bivirkningene,
farmakogenetikken) skrives aldri på grenen eller i loggen. Kuratoren leser det
selv med Supabase-tilkoblingen sin.

## Kort fortalt for kuratoren

1. Lag en gren fra `main` som heter `kuratorjobb/<stoff>-<ÅÅÅÅMMDD>` (eller noe
   annet etter `kuratorjobb/`).
2. Skriv `kuratorjobb/foresporsel.json` på grenen og commit:

   ```json
   { "versjon": 1, "stoffer": ["citalopram"], "oppgaver": ["funksjonstest", "spc"] }
   ```

3. Vent til `kuratorjobb/resultat/status.json` på grenen har en `status` som
   ikke er `kjorer`, og der `jobb.foresporsel_commit` er commiten du laget i
   steg 2. Det tar vanligvis 1–4 minutter.
4. Les resten av resultatet i `kuratorjobb/resultat/` på samme gren.

Grenen er bare for jobben: **lag aldri en PR fra den**, og legg aldri en
kurateringsmigrasjon på den. Kurateringen lages på en egen gren fra `main`,
som før. En ny commit av forespørselen på samme gren kjører jobben på nytt og
erstatter resultatet; historikken på grenen har de tidligere. Når kurateringen
er ferdig, kan grenen slettes.

## Starte en jobb

Jobben starter på tre måter. Alle kjører den samme jobben, fra `main`.

| Hvordan | Hva som trengs | Når |
| --- | --- | --- |
| Skriv forespørselen på en jobbgren | Å kunne lage en gren og committe en fil | Hovedveien for kuratoren; alt som kan lage en PR, kan dette |
| Start arbeidsflyten «Kuratorjobb» på `main` med feltet `gren` | Et verktøy som kan starte arbeidsflyter (`workflow_dispatch`) | Kjører en jobbgren på nytt uten ny commit |
| Start «Kuratorjobb» på `main` med `stoffer` (og `oppgaver`) | Det samme, eller GitHub i nettleseren (Actions → Kuratorjobb → Run workflow) | For hånd; jobben lager selv grenen `kuratorjobb/manuell-<kjøring>` |

Slik henger det sammen: en commit som endrer `kuratorjobb/foresporsel.json` på
en gren under `kuratorjobb/`, starter den lille jobben «videresend». Den har
ingen hemmeligheter og gjør bare én ting: starter arbeidsflyten på `main` med
grenens navn. Selve jobben bruker alltid koden og arbeidsflyten slik de står
på `main`, aldri det som står på jobbgrenen. Fra grenen leses bare
forespørselen, som data.

## Forespørselen

`kuratorjobb/foresporsel.json`:

| Felt | Påkrevd | Hva |
| --- | --- | --- |
| `versjon` | ja | `1` |
| `stoffer` | ja | Stoffene, etter nøkkelen eller navnet i stoffregisteret (`citalopram`, «Citalopram»), høyst 25. Eller `"alle"`: alle publiserte fagsider, bare for funksjonstesten |
| `oppgaver` | nei | `["funksjonstest", "spc"]` (standard), eller én av dem |
| `spc.adresser` | nei | Bestemte preparatomtaler i stedet for alle FEST oppgir for stoffet. Må være DMPs adresser: `https://produktinformasjon.legemiddelsok.no/preparatomtaler/<nr>.pdf` |
| `spc.maks` | nei | Høyst så mange preparatomtaler per stoff (1–50, standard 20) |
| `spc.dpi` | nei | Oppløsningen på sidebildene (72–300, standard 150) |
| `referanse` | nei | Fritt felt, f.eks. en ID i en arbeidskø. Kommer uendret tilbake i `status.json` |

Ukjente felt, adresser som ikke er DMPs og stoffer registeret ikke kjenner,
stopper jobben før noe kjøres; grunnen står i `feil` i `status.json`.

## Resultatet

Alt står på jobbgrenen, i `kuratorjobb/resultat/`. Stiene i filene er fra
roten av grenen, så de kan hentes direkte.

```
kuratorjobb/resultat/
  status.json                         oversikten: les den først
  <stoff>/funksjonstest.json          kontrollene: utfall og tall
  <stoff>/spc.json                    preparatomtalene: proveniens og kontroller
  <stoff>/spc/<sha256-16>/original.pdf
  <stoff>/spc/<sha256-16>/tekst.txt   hele teksten, sidene skilt med sideskift
  <stoff>/spc/<sha256-16>/tekst/side-001.txt …
  <stoff>/spc/<sha256-16>/sider/side-001.png …
```

### Utfallene

Hver kontroll, oppgave og jobb har ett av disse; en oppgave eller jobb har det
verste blant delene sine.

| Utfall | Betyr |
| --- | --- |
| `ok` | Kontrollert og i orden |
| `advarsel` | Virker, men noe bør ses på, f.eks. data som ikke er hentet på lenge |
| `feil` | Virker ikke, eller ga et svar appen ikke kan bruke |
| `ikke_aktuelt` | Gjelder ikke stoffet, f.eks. en side uten kobling til ClinPGx |

En kontroll har `id`, `status`, `melding` (på norsk), og eventuelt `rpc`,
`ms` og `antall`.

### `status.json`

| Felt | Hva |
| --- | --- |
| `versjon` | Formen på resultatet, `1` |
| `status` | `kjorer` mens jobben går, ellers det samlede utfallet |
| `jobb.gren`, `jobb.foresporsel_commit`, `jobb.foresporsel_sha256` | Hvilken forespørsel resultatet gjelder |
| `jobb.kode_commit`, `jobb.kjoring` | Koden på `main` som kjørte, og lenken til kjøringen i Actions |
| `jobb.startet_kl`, `jobb.ferdig_kl` | Tidspunktene |
| `foresporsel`, `referanse` | Forespørselen slik den ble lest, med standardverdiene fylt inn |
| `feil` | Det som stoppet jobben før stoffene, f.eks. en ugyldig forespørsel |
| `bruker` | Kontrollene av testbrukeren: innloggingen, og at den ikke er administrator |
| `stoffer.<stoff>` | Utfallet per stoff, og per oppgave med fila detaljene står i |

### Funksjonstesten

| Kontroll | Hva |
| --- | --- |
| `les_stoff` | Den publiserte siden finnes, med riktig nøkkel |
| `sidemodell` | Siden kan settes sammen slik appen viser den |
| `referanser` | Alle referansene siden siterer, kom med i svaret |
| `utkast_skjult` | En vanlig bruker ser ikke utkastet |
| `stoffliste` | Siden står i lista over fagsider |
| `fest`, `preparatvisning` | `les_legemidler` for virkestoffene siden er koblet til, og preparatseksjonen. Advarsel når FEST-kopien er eldre enn tre døgn |
| `interaksjoner`, `interaksjonsvisning` | `les_interaksjoner` og interaksjonsseksjonen |
| `bivirkninger`, `bivirkningsvisning` | `les_bivirkninger`, og at appen viser alle radene den får (`antall.rader` mot `antall.rader_appen_viser`) |
| `clinpgx`, `farmakogenetikkvisning` | `les_farmakogenetikk` for kjemikaliene siden er koblet til. Advarsel for et kjemikalie som ikke er hentet, har feil, eller når ClinPGx er eldre enn ti døgn |
| `cpic`, `cpicvisning` | `les_cpic` for de samme kjemikaliene |

Funksjonstesten tar ikke med det appen fikk fra kallene, bare om det virket
og hvor mye som kom (`antall`). Meldingene nevner ikke innhold, navn eller
ID-er fra fagsiden. En feil fra databasen eller appen står bare med typen og
koden, f.eks. «les_stoff feilet (kode 22P02, HTTP 400; teksten publiseres
ikke)», aldri med teksten, som kan ha med data bak innloggingen
(`offentligFeil` i `src/kuratorjobb/modell.ts`). Gjør det samme kallet selv
for å se hele feilen. Det samme gjelder `feil` i `status.json`.

### Preparatomtalene

Uten `spc.adresser` hentes preparatomtalene FEST oppgir for preparatene med
virkestoffene siden er koblet til, slik appen leser dem (`les_legemidler`).
Adressene i FEST kommer fra DMP.

At ingen fil fra DMP ble funnet, betyr aldri at SPC-behovet er dekket.
Kontrollen `dekning` er `ok` bare når hvert preparat FEST oppgir for stoffet,
har en preparatomtale som ble hentet og godkjent. Ellers er den en advarsel,
også når ingen fil ble hentet, og hvert preparat uten en hentet omtale står i
`dekning.mangler` med varenavn, produsent, ATC, form og `grunn`:

| `grunn` | Betyr |
| --- | --- |
| `uten_omtale` | FEST oppgir ingen preparatomtale, f.eks. for et sentralt godkjent legemiddel med omtalen hos EMA |
| `ikke_dmp` | FEST oppgir en adresse som ikke er DMPs (står i `adresse`); den hentes ikke |
| `ikke_hentet` | Fila kunne ikke hentes eller besto ikke kontrollen |
| `utelatt` | Over `spc.maks` |
| `ikke_valgt` | Forespørselen oppga andre adresser i `spc.adresser`. Bare dette gir `ikke_aktuelt` i stedet for en advarsel; `dekket` er likevel `false` |

`dekning.mangler` er lista over preparatomtaler som må skaffes et annet sted,
som hos EMA.

`spc.json` har:

- `adresser`: én rad per adresse som ble hentet: `adresse`,
  `endelig_adresse`, `hentet_kl`, hodene DMP sendte (`content-length`,
  `content-md5`, `last-modified`, `etag` …), `preparater` (merkevarene i FEST
  som viser til den), kontrollene, og `dokument`, SHA-256 av fila.
- `dokumenter`: én per ulik fil (flere styrker deler ofte samme omtale):
  `sha256`, `bytes`, `pdf` (antall sider, PDF-ens egne datoer og tittel),
  `filer` (originalen, tekstuttrekket per side og sidebildene), og
  `avsnitt_4_8`: sidene «4.8 Bivirkninger» står på, funnet etter overskriftene
  i teksten — et hjelpemiddel for å finne fram, ikke en tolkning.
- `utelatt`: adresser over `spc.maks`.
- `dekning`: `dekket`, `preparater` og `hentet` (preparatene i FEST, og hvor
  mange av dem som har en hentet omtale), `dokumenter`, og `mangler` (over).

Kontrollene av hver fil: at hver adresse på veien var DMPs (`adresse`), at DMP
svarte 200 (`http`), at lengden og MD5-summen er de DMP oppga (`lengde`,
`kontrollsum`), at fila er en hel PDF etter innholdet (`pdf`: begynner med
`%PDF-` og har `%%EOF`), hvilken innholdstype DMP oppga (`innholdstype`:
advarsel når det ikke er `application/pdf`, f.eks. `application/octet-stream`,
men fila er en PDF; feil når den heller ikke er det), at den kan leses og hvor mange sider den har (`pdfinfo`), at teksten
kunne trekkes ut (`tekst`; advarsel ved lite tekst, som i en skannet PDF), og
at det ble ett bilde per side (`sidebilder`). Sidebildene er PNG i gråtoner,
150 dpi som standard: rundt 300 kB per side.

## Begrensninger

- **Binærfilene.** PDF-ene og sidebildene er vanlige filer på grenen. Om de kan
  hentes, avhenger av GitHub-verktøyet kuratoren har: noen gir filinnholdet
  direkte, andre som base64, og noen bare tekstfiler. Tekstfilene og JSON-en
  kan alle hente. Prøv `sider/side-001.png` i første pilot; går det ikke,
  står tekstuttrekket og `avsnitt_4_8` uansett.
- **Tiden.** En jobb starter som regel innen et minutt etter commiten, men
  GitHub kan bruke lenger tid. Funksjonstesten tar sekunder per stoff;
  preparatomtalene rundt ti sekunder per fil. `status.json` med `kjorer` og
  lenken i `jobb.kjoring` viser at jobben er i gang.
- **Én jobb per gren om gangen.** Kommer en ny forespørsel mens en jobb går,
  venter den nye. Bruk en egen gren per stoff eller kuratering.
- **Grenene vokser.** Hver kjøring med preparatomtaler legger til noen
  megabyte. Slett jobbgrenen når kurateringen er ferdig.
- **Testbrukeren** er en vanlig bruker og ser bare det publiserte. Utkast,
  historikken til upubliserte endringer og administratorfunksjoner testes
  ikke.
- **EMA.** Preparatomtaler for sentralt godkjente legemidler ligger hos EMA og
  har ingen adresse i FEST; de hentes ikke, men står i `dekning.mangler`.

## Sikkerheten

- Testbrukeren er en egen, vanlig bruker i OUSFAR. Brukernavnet og passordet
  ligger som hemmeligheter i GitHub-miljøet `kuratortest`, som bare `main` får
  bruke. Jobben som videresender fra jobbgrenene, har ingen hemmeligheter, og
  en endret arbeidsflyt på en jobbgren får ikke tak i dem.
- Skriptet skriver aldri ut passordet eller feilmeldingen fra innloggingen.
- Repoet, jobbgrenene og loggene i Actions er offentlige. Resultatet har bare
  utfall, tall og offentlige data (over); testen sjekker at innholdet bak
  innloggingen ikke kommer med i funksjonstesten.
- Den skrivebeskyttede brukeren kuratoren bruker i Supabase, er ikke endret.
- Jobben skriver bare på grener under `kuratorjobb/` (`JOBBGREN` i
  `src/kuratorjobb/modell.ts`), og bare i `kuratorjobb/resultat/`.
- Testene sjekker at jobben bare kjører fra `main` i miljøet `kuratortest`, at
  ingen felt fra forespørselen settes inn i et skript, og at `kuratorjobb/`
  aldri havner på `main` (`src/__tests__/kuratorjobb.test.ts`).

## Oppsettet (én gang)

Testbrukeren og hemmelighetene settes opp av en administrator:

1. Lag en vanlig bruker i OUSFAR (Adminmeny → Brukere → Opprett bruker), f.eks. `kuratortest`,
   og fullfør førstegangsoppsettet med den: logg inn med det midlertidige
   passordet, velg et nytt passord og navnet «Kurator Test». Gi den aldri
   adminrollen.
2. I GitHub: repoet → Settings → Environments → New environment →
   `kuratortest`. Under «Deployment branches and tags» velges «Selected
   branches and tags», og `main` legges til.
3. I samme miljø, «Environment secrets» → Add secret: `OUSFAR_TESTBRUKER`
   (brukernavnet) og `OUSFAR_TESTPASSORD` (passordet).

Uten testbrukeren stopper funksjonstesten med en feil som sier det. SPC-
hentingen med `spc.adresser` virker uten, men da uten preparatene fra FEST.

## Videre: arbeidskøen

Jobbene er laget for å kunne startes av en arbeidskø senere, uten endringer:
køen lager en jobbgren og en forespørsel per stoff, med køens ID i
`referanse`, og leser `status.json`. `versjon` sier om formen er endret.
`"stoffer": "alle"` med bare funksjonstesten kontrollerer alle fagsidene i én
jobb, f.eks. før og etter en runde.

## Koden

| Hvor | Hva |
| --- | --- |
| `.github/workflows/kuratorjobb.yml` | Arbeidsflyten: videresendingen og jobben |
| `scripts/kuratorjobb.ts` | Jobben: innloggingen, oppgavene, hentingen og PDF-verktøyene (`pdfinfo`, `pdftotext`, `pdftoppm`) |
| `src/kuratorjobb/modell.ts` | Formen på forespørselen og resultatet, grenene og stiene |
| `src/kuratorjobb/foresporsel.ts` | Lesingen og kontrollen av forespørselen |
| `src/kuratorjobb/funksjonstest.ts` | Funksjonstesten, med appens egne lesere |
| `src/kuratorjobb/spc.ts` | DMPs adresser, preparatomtalene i FEST, og kontrollen av filene |
| `src/__tests__/kuratorjobb.test.ts` | Testene, med funksjonstesten mot en ekte database |
