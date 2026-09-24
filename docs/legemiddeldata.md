# Legemiddeldata fra offentlige kilder

Leses når noe som har med preparater, virkestoff, pakninger eller andre
legemiddelgrunndata på stoffsidene å gjøre skal endres. Planen står i
`docs/analyttsider-og-redigering.md`; her står hvilke kilder som finnes, hva de
faktisk inneholder, og hvilke valg OUSFAR har gjort.

Kartleggingen bygger på faktiske svar og filer hentet 23.09.2026, ikke på
dokumentasjonen alene. Tallene under er fra FEST-filen publisert 11.09.2026
(`HentetDato` 2026-09-08).

## Kildene

| Kilde | Hvem | Tilgang | Grunnlag | Brukes |
| --- | --- | --- | --- | --- |
| **FEST**, nedlastbar fil | DMP | Åpen, uten nøkkel | Primærkilden | **Ja, som eneste kilde nå** |
| FEST, webtjeneste (WCF/SOAP) | DMP / NHN | Åpen på internett | Samme data som filen, også inkrementelt | Nei |
| **HAPI** `api.helsedirektoratet.no/legemidler` | Helsedirektoratet | Abonnementsnøkkel (`Ocp-Apim-Subscription-Key`), egen registrering | «I all hovedsak hentet fra FEST» | Nei |
| **DMP FHIR-tjenesten** `api.legemiddelverket.no/fhir-r4` | DMP | Nøkkel etter skriftlig søknad til fest@dmp.no (org.nr., formål, miljø) | Samme grunndata som FEST, i FHIR R4 / ISO IDMP | Nei, mulig senere |

Kontrollert 23.09.2026:

- `fest251.zip` lastes ned uten innlogging fra
  `https://www.dmp.no/globalassets/documents/om-oss/distribusjon-av-legemiddeldata/fest/festfiler/fest251.zip`
  (14 MB, én XML-fil på 118 MB). Serveren gir `ETag` og `Last-Modified`.
- HAPI svarer `401 Access denied due to missing subscription key` på
  `/legemidler/...`. API-katalogen i utviklerportalen er bare synlig etter
  innlogging.
- FHIR-tjenesten svarer `401` av samme grunn. Tilgang gis av DMP etter
  søknad.

**Valget.** FEST-filen dekker alt OUSFAR trenger nå, er åpen, er den kilden
de to andre bygger på, og DMP krever uansett at systemer kan laste inn et helt
uttrekk på nytt. HAPI gir ingen legemiddeldata utover FEST og ville bare lagt
til en nøkkel og et mellomledd. FHIR-tjenesten har noe FEST ikke har, se
[Hull og begrensninger](#hull-og-begrensninger), men ingenting OUSFAR trenger
nå. Den kan tas inn senere som et tillegg uten å endre koblingene, siden den
har kryssreferanser til FEST-ID-ene.

Vi bruker **rekvirentuttrekket** (`fest251.zip`): legemidler til mennesker,
pluss næringsmidler og forbruksmateriell som vi ikke tar inn.
Institusjonsuttrekket (`fest251_inst.zip`) har i tillegg varer til
internforordning på sykehus. Det kan byttes inn senere hvis det viser seg
nyttig.

## Lisens og kildeangivelse

FEST er lagt ut under **Norsk lisens for offentlige data (NLOD)**. Dataene kan
brukes fritt, men kilden skal oppgis. Stoffsidene har derfor FEST som en
nummerert referanse («FEST – Forskrivnings- og ekspedisjonsstøtte ·
Direktoratet for medisinske produkter») i referansefeltet ved alt som kommer
derfra, med datoen for uttrekket og siste vellykkede kontroll ved siden av.
Referansen er automatisk og kan ikke redigeres (se «Automatiske referanser» i
`docs/faginnhold.md`).

DMP tar ikke ansvar for integrasjoner av FEST. Brukeren av dataene skal:

- alltid bruke siste versjon;
- kunne laste inn et fullt uttrekk på nytt;
- følge med på driftsmeldingene.

## Oppdatering

- FEST publiseres før den 1. og 15. i hver måned, og av og til ekstraordinært.
  Filen er tilgjengelig dagen etter publisering. Hver oppføring har et
  `Tidspunkt` for når den sist ble endret.
- Filen er et **fullt uttrekk**. Alle oppføringene har status `A` (aktiv). En
  oppføring som er borte fra en ny fil, er utgått.
- OUSFAR ser etter ny fil hver natt. Er filen uendret (samme `ETag`), gjøres
  ingenting mer.

### Slik synkroniseringen går

- Vercel kaller `/api/legemiddeldata-synk` hver natt (`vercel.json`). Jobben
  står i `src/legemiddeldata/`: `fest.ts` leser filen, `zip.ts` pakker den ut,
  `synk.ts` styrer kjøringen, `lager.ts` snakker med databasen og
  `endepunkt.ts` er inngangen fra Vercel.
- Dataene ligger i skjemaet `legemiddeldata`, som ingen API-rolle når direkte.
  Skriving går gjennom funksjonene `legemiddeldata_*`, som bare den hemmelige
  nøkkelen kan kalle. Stoffsidene leser med `les_legemidler`, og
  `legemiddeldata_status` viser de siste kjøringene.
- Et uttrekk lastes først inn i et mellomlager og byttes så inn i én
  transaksjon. Nye rader legges til, endrede oppdateres, og rader som er borte,
  merkes som utgått, men slettes ikke. Et uttrekk som har under 80 % av radene
  for en type, avvises, og da endres ingenting. Det samme gjelder en avkuttet
  nedlasting eller en fil som ikke kan leses. Da viser sidene det som var der
  fra før.
- Endres måten filen leses på, økes `PARSERVERSJON` i `fest.ts`. Neste kjøring
  leser da filen på nytt selv om den er uendret.
- Vercel trenger to hemmelige innstillinger i produksjon: `SUPABASE_SECRET_KEY`
  og `CRON_SECRET`. Vercel sender `CRON_SECRET` med kallet, og alle andre kall
  avvises. Adressen til Supabase hentes fra `VITE_SUPABASE_URL`.
- API-et avbryter spørringer etter 8 sekunder, og å bytte inn et helt uttrekk
  tar lenger. Serverrollen har derfor fått en grense på 2 minutter, satt i
  migrasjonen. Den første fulle kjøringen tok om lag 24 sekunder.

## Hva FEST inneholder

Én XML-fil med én katalog per type. Antallet er fra filen 11.09.2026.

| Katalog | Antall | Hva det er | Tas inn |
| --- | --- | --- | --- |
| `KatVirkestoff` / `Virkestoff` | 8 639 | Substansene, med norsk og engelsk navn | Ja |
| `KatVirkestoff` / `VirkestoffMedStyrke` | 7 721 | En styrke av et virkestoff | Ja |
| `KatLegemiddelMerkevare` | 8 962 | Ett preparat i én form og styrke, f.eks. «Sarotex tab 25 mg» | Ja |
| `KatLegemiddelpakning` | 10 828 | Pakningene, med varenummer | Ja |
| `KatByttegruppe` | 1 721 | Gruppene av byttbare pakninger | Ja |
| `KatInteraksjon` | 11 454 | DMPs interaksjonsvurderinger: 11 000 `Interaksjon` og 454 `InteraksjonIkkeVurdert` | Ja, se [Slik interaksjonene vises](#slik-interaksjonene-vises) |
| `KatLegemiddelVirkestoff` | 2 196 | Virkestoffrekvirering, samling av likeverdige preparater | Nei |
| `KatLegemiddeldose` | 9 467 | Enkeltdoser til multidose | Nei |
| `KatRefusjon`, `KatVilkar` | 1 158 / 205 | Refusjon og vilkår | Nei |
| `KatHandelsvare` | 6 309 | Forbruksmateriell og næringsmidler | Nei |
| `KatStrDosering`, `KatVarselSlv`, `KatKodeverk` | små | Standarddoseringer, varsler og kodeverk | Nei |

Kodene (legemiddelform, administrasjonsvei o.l.) kommer med tekst direkte i
hver oppføring (`V` er koden, `DN` teksten, `S` kodeverket), så kodeverket
trengs ikke for seg.

### Feltene OUSFAR bruker

| Datatype | Hvor i FEST | Merknad |
| --- | --- | --- |
| Preparatnavn | `LegemiddelMerkevare/Varenavn` | Ett varenavn har én merkevare per form og styrke |
| Navn med form og styrke | `…/NavnFormStyrke` | «Amitriptylin Abcur tab 50 mg» |
| Virkestoff og styrke | `…/SortertVirkestoffMedStyrke` → `VirkestoffMedStyrke` (`Styrke`, `StyrkeNevner`, `RefVirkestoff`) | Ordnet; flere betyr kombinasjonspreparat |
| Virkestoff uten styrke | `…/SortertVirkestoffUtenStyrke` | Brukes av noen få preparater |
| Legemiddelform | `…/LegemiddelformKort` (kode og tekst), `LegemiddelformLang` | Kort form grupperer, lang form vises |
| Administrasjonsvei | `…/AdministreringLegemiddel/Administrasjonsvei` | Kan være flere |
| Deling | `…/AdministreringLegemiddel/Deling` | 0 ikke spesifisert, 1 ikke delbar, 2 delbar i 2, 4 delbar i 4 |
| Knusing | `…/AdministreringLegemiddel/KanKnuses` | 1 ja, 2 nei, 9 ukjent |
| Åpning av kapsel | `…/AdministreringLegemiddel/KanApnes` | 1 ja, 2 nei, 9 ukjent |
| ATC | `…/Atc` | Mangler på noen få |
| Reseptgruppe | `…/Reseptgruppe` | A, B, C, CF, F, og K («Kosttilskudd»); teksten vises som FEST skriver den |
| Preparattype | `…/Preparattype` | Bl.a. «Legemiddel», «Krever godkj. fritak» (uregistrert), «Sykehuspreparat», «Magistrell» |
| Særlig overvåkning | `…/SvartTrekant` | Svart trekant |
| Preparatomtale | `…/Preparatomtaleavsnitt/Lenke/Www` | Lenke til `produktinformasjon.legemiddelsok.no`; finnes for 3 650 |
| Produsent | `…/ProduktInfo/Produsent` | |
| Pakning | `Legemiddelpakning/Varenr`, `Pakningsinfo` (`Pakningsstr`, `EnhetPakning`, `Pakningstype`, `RefLegemiddelMerkevare`) | |
| Markedsføring | `Legemiddelpakning/Markedsforingsinfo` | `Markedsforingsdato`, `MidlUtgattDato` (midlertidig utgått), `AvregDato` (avregistrert) |
| Byttbarhet | `Legemiddelpakning/PakningByttegruppe/RefByttegruppe` → `Byttegruppe` | Pakninger i samme gruppe er byttbare i apotek |

## Stabile ID-er og relasjoner

Alle objekter har en ID på formen `ID_<GUID>`. Oppføringen har også en egen
ID; det er den indre ID-en (i `Virkestoff`, `LegemiddelMerkevare` osv.) de
andre peker på, og som OUSFAR lagrer. ID-ene endres ikke når innholdet endres.

```
Virkestoff (moderstoff) ──RefVirkestoff──▶ Virkestoff (salter/estere)
      ▲
      │ RefVirkestoff
VirkestoffMedStyrke ◀── SortertVirkestoffMedStyrke ── LegemiddelMerkevare
                                                           ▲
                                  Pakningsinfo/RefLegemiddelMerkevare
                                                           │
                          Byttegruppe ◀── PakningByttegruppe ── Legemiddelpakning
```

- **Salter.** Et moderstoff peker på saltene sine, f.eks. Amitriptylin →
  Amitriptylinhydroklorid, Metoprolol → Metoprololsuksinat og -tartrat. Et
  salt hører til bare ett moderstoff (kontrollert i hele filen). Styrken er i
  dag nesten alltid oppgitt på moderstoffet («terapeutisk del»).
- **Planlagt endring hos DMP.** DMP vil på sikt oppgi styrken på den
  styrkebestemmende substansen (ofte saltet) i stedet. Endringen er utsatt på
  ubestemt tid. Selve virkestoff-oppføringene og ID-ene endres ikke; det er
  hvilket virkestoff preparatet peker på som kan flytte seg fra moderstoff til
  salt. OUSFAR kobler derfor til moderstoffet og regner saltene med gjennom
  relasjonen over, slik at koblingene tåler endringen.
- **Kombinasjonspreparater** har flere `SortertVirkestoffMedStyrke`, f.eks.
  kodein med paracetamol. De tas med på siden for hvert virkestoff de
  inneholder, merket som kombinasjon.
- **Metabolitter** uten egne preparater (f.eks. N-desmetyldiazepam,
  O-desmetyltramadol, benzoylekgonin) finnes ikke i FEST. Noen metabolitter er
  egne legemidler (paliperidon, oksazepam); andre finnes som virkestoff med få
  eller ingen preparater (ramiprilat, kanrenon, enalaprilat).

## Koblingen mellom stoffsider og FEST

En stoffside kobles til ett eller flere virkestoff i FEST med ID-ene deres,
aldri med navnet. Koblingen er redaksjonelt innhold: elementet
`legemiddelkobling` i seksjonen «Preparater», med `{ virkestoff: [{ fest_id,
navn }] }`. Den lagres som utkast, publiseres og har historikk som annet
faginnhold på siden. Navnet lagres bare så koblingen kan leses også om stoffet
skulle forsvinne fra FEST.

Ingen kobling gjøres automatisk. I redigeringsmodus velger administratoren
virkestoff med søket (`sok_virkestoff`). Søket står ferdig utfylt med sidens
navn, uten det som står i parentes, og et virkestoff med nøyaktig samme navn
merkes som **forslag**. Det gjelder først når det er valgt, lagret og
publisert. Salter og estere tas med av seg selv når moderstoffet velges, og
søket sier fra når et treff er et salt.

Slik så navnelikheten ut ved første gjennomgang:

- **Forslag med samme navn:** sidenavnet, eller navnet foran en parentes, er
  nøyaktig likt navnet på ett moderstoff i FEST. Det gjelder 74 av de 85
  sidene, blant dem «Paliperidon (hydroksyrisperidon)» → Paliperidon.
- Navnelikhet er ikke nok alene. «Litium» finnes i FEST, men har ingen
  preparater; de står på «Litiumion», som saltene (litiumkarbonat,
  litiumsitrat osv.) hører til. Søket viser derfor antallet preparater ved
  hvert treff, så forslaget kan vurderes før det velges.
- **Ingen forslag:** Benzoylekgonin, EtG, EtS, Hydroksybupropion, Losartansyre,
  MDMA, N-desmetyldiazepam, O-desmetyltramadol, THC og THC-syre. De får ingen
  kobling før noen velger den.
- Kanrenon og Ramiprilat har samme navn i FEST, men ingen preparater, og
  Enalaprilat har bare ett. Om slike sider også skal vise preparatene med
  moderstoffet (spironolakton, ramipril, enalapril), er et faglig valg som
  gjøres ved å legge moderstoffet til i koblingen.

## Slik preparatene vises

Seksjonen «Preparater» står rett under identiteten, lukket med en
oppsummering som «3 preparater · 1 legemiddelform · 3 styrker · 4 med
godkjenningsfritak». Grupperingen står i `src/legemiddeldata/preparater.ts`:

- Hver **legemiddelform** (FESTs korte form, f.eks. «Tablett») er et
  detaljkort, med antallet preparater og spennet i styrkene i oppsummeringen.
- Et **preparat** er et varenavn i én form. Under det står styrkene, og ved
  hver styrke pakningene med størrelse, pakningstype og varenummer.
- Preparater som **krever godkjenningsfritak**, står i et eget detaljkort og
  telles for seg.
- **Kombinasjonspreparater** er merket med de andre virkestoffene, og styrken
  viser alle, f.eks. «kodein 9,6 mg + acetylsalisylsyre 500 mg + magnesiumoksid
  150 mg».
- Er styrken oppgitt for et **salt**, står saltet på preparatet.
- Andre preparattyper enn vanlige legemidler, f.eks. «Sykehuspreparat», er
  merket med typen.
- **Reseptgruppe, administrasjonsvei og preparatomtale** står under
  preparatnavnet når de er like for alle styrkene, ellers ved hver styrke.
  Preparatomtalen er ofte én for hver styrke. Bare `https`-lenker vises.
- **Deling, knusing og åpning** står ved styrken, bare når FEST sier ja eller
  nei; «ikke spesifisert» og «ukjent» vises ikke. Delingen står med FESTs ord
  («Delbar i 2»).
- Nederst står FEST som referanse i seksjonens referansefelt, med datoen for
  uttrekket og når kopien sist ble kontrollert mot FEST.

Preparatnavnene er med i søket på siden, også i lukkede detaljkort. Det
globale søket tar dem med når det kommer.

## Slik interaksjonene vises

Seksjonen «Interaksjoner» står etter «Farmakokinetikk» og viser DMPs
interaksjoner i FEST for virkestoffene siden er koblet til. Den har ingenting
å redigere; den følger koblingen i «Preparater». Visningen følger kapittel 8 i
[FESTs implementeringsveiledning](https://www.dmp.no/contentassets/3cb9b85e742745d4b1db7d899eb987b7/202511_implementeringsveiledning-fest-v3.6.pdf),
og logikken står i `src/legemiddeldata/interaksjoner.ts`.

- **Oppslaget.** En interaksjon er et par av to substansgrupper. Stoffene i
  dem har ATC-kode, på 5. nivå eller et overordnet nivå som gjelder alle
  kodene under (f.eks. N06AA, trisykliske antidepressiva), eller virkestoffets
  ID når de ikke har ATC-kode (f.eks. perikum). FEST har ingen kobling mellom
  virkestoff og ATC-kode, så siden slår opp på ATC-kodene til preparatene som
  bare har sidens virkestoff (med saltene). Kombinasjonspreparatenes koder tas
  ikke med; de ville gitt interaksjonene til de andre virkestoffene. Kodene
  som ble brukt, står i merknaden nederst i seksjonen. Oppslaget gjøres av `les_interaksjoner` i
  databasen.
- **Hva som vises.** Bare «Bør unngås» (rød) og «Forholdsregler bør tas»
  (gul), de alvorligste først og ellers alfabetisk. «Ingen tiltak nødvendig»
  skal etter veiledningen ikke gi interaksjonsmelding og vises ikke.
  Visningsregelen (allmennlege, spesialist, sykehus, apotek) brukes ikke: alle
  interaksjoner med en av de to relevansene gjelder også sykehus.
- **Hver interaksjon** er et detaljkort med stoffet eller gruppen den gjelder
  («Terbinafin», «Johannesurt»), relevansen og begynnelsen av den kliniske
  konsekvensen. Åpnet står situasjonskriteriet tydelig først, så klinisk
  konsekvens, mekanisme, håndteringen i avsnitt med overskrift
  (Dosetilpasning, Justering av administrering, Monitorering,
  Legemiddelalternativer) og kildegrunnlaget. DMPs referanser står i
  referansefeltet nederst i kortet, nummerert sammen med sidens andre
  referanser og listet nederst på siden.
- **Gruppenavnet** er FESTs eget når gruppen har et. Ellers er det navnet på
  stoffet med den overordnede ATC-koden (f.eks. «Ikke-selektive
  monoaminreopptakshemmere»), og ellers stoffet selv. Det dekker alle
  gruppene i filen.
- **Ikke vurdert.** Står en av sidens ATC-koder blant dem DMP ikke har
  vurdert, sier seksjonen fra, så en tom liste ikke leses som at det ikke
  finnes interaksjoner.
- Stoffnavnene er med i søket på siden.

Eksempler fra filen 08.09.2026: amitriptylin 21 bør unngås og 36 forholdsregler,
kvetiapin 38 og 12, karbamazepin 180 og 169.

## Hull og begrensninger

- **Klinisk innhold** (dosering, referanseområder, farmakokinetikk,
  indikasjoner) finnes ikke i FEST som strukturerte data, bare som lenke til
  preparatomtalen. Det forblir OUSFAR-redigert.
- **Indikasjoner** står bare i preparatomtalene (PDF). `BruksomradeEtikett`
  («MOT DEPRESJON») er etikettekst til pasienten, ikke godkjent indikasjon, og
  brukes ikke.
- **Preparatomtalelenken** mangler for om lag 60 % av merkevarene, blant annet
  mange uregistrerte preparater.
- **Deling og knusing** er ofte «ikke spesifisert» eller «ukjent». Bare
  eksplisitte ja/nei vises.
- **Uregistrerte preparater** («Krever godkj. fritak», 2 670 merkevarer) utgjør
  en stor del av mange stoffers treff. De skilles fra de registrerte i visningen.
- **Produktkoder (GTIN).** FEST har `Ean`, men DMP sier selv at produktkodene i
  FEST gradvis blir utdatert; FHIR-tjenesten har de oppdaterte. OUSFAR trenger
  dem ikke.
- **Substans-ID-er etter IDMP** (SMS-ID, UNII), pakningsnivåer og kobling
  substans–ATC finnes bare i FHIR-tjenesten. Den kan tas inn senere om det blir
  behov, etter søknad til DMP.
- **Navnebytte.** Når et preparat skifter navn, gir FEST bare det nye navnet,
  mens FHIR-tjenesten gir begge en periode.

## Senere felter

Tas inn når preparatvisningen er på plass, i egne endringer:

- **Byttbarhet** i klartekst og **særlig overvåkning** i detaljkortene.
