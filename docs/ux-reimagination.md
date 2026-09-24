# OUSFAR – UX-reimagination og stoffmonografer

**Dato:** 24.09.2026  
**Status:** Implementeringsplan. Dette dokumentet er spesifikasjonen for design- og implementeringsarbeidet, ikke en beskrivelse av dagens UI. Fremdriften står i §16.

## 1. Mål

OUSFAR skal få et helhetlig visuelt og interaksjonsmessig ansiktsløft uten å endre den kliniske logikken eller den innarbeidede arbeidsflyten for fortolkning.

Målet er at appen skal:

- føles som ett sammenhengende produkt, ikke en samling separate kontrollflater;
- være rask å lese under tidspress;
- bruke progressiv detaljering slik at mye faginnhold ikke oppleves overveldende;
- bruke farge, illustrasjon og bevegelse som informasjonsbærere, men aldri som eneste informasjonskanal;
- være like gjennomarbeidet i lyst og mørkt tema og fra mobil til bred desktop;
- bygge på et lite, gjenbrukbart designsystem fremfor lokale CSS-unntak;
- bevare universell utforming, tastaturflyt og redusert-bevegelse-støtte.

Fortolkningsmekanikken skal ikke redesignes funksjonelt. Eksisterende søk i fortolkningsflyten, hurtigtaster, knapper, automatisk kopiering, terskler, regler og klinisk output skal bevares med mindre en separat oppgave eksplisitt sier noe annet.

## 2. Dagens arkitektur som skal utnyttes

Repoet har allerede flere gode byggesteiner:

- src/styles/tokens.css har skalaer for typografi, mellomrom, radius, farger og bevegelse. Disse skal utvikles videre til semantiske designtokens, ikke erstattes av tilfeldige nye verdier.
- src/components/Toolbar.tsx og src/components/Sidemeny.tsx utgjør i praksis dagens globale toppkontroller, men ligger separat til høyre og venstre.
- src/components/analyttside/Analyttside.tsx legger i tillegg inn en egen StepBar og Sidesok, som er årsaken til kollisjoner på smale flater.
- src/components/seksjoner/ har allerede animert, nestet progressiv detaljering, støtte for direktelenker, nettlesersøk via beforematch og prefers-reduced-motion.
- src/faginnhold/sok.ts har allerede den felles søkemodellen som var tenkt brukt både lokalt og globalt: indekserSide, feltvekter, rangering, utdrag og sted på siden.
- src/faginnhold/referanser.ts har allerede nummerering etter første forekomst, og Referansepille viser inline-referanser som superscript.
- FEST er isolert i src/legemiddeldata/. Visningsmodellen kan derfor endres uten å gjøre preparatdataene redaksjonelle.

Dette arbeidet skal i størst mulig grad bygge videre på disse grensene.

## 3. Designsporet: Claude Design før bred implementering

Dette er en full visuell reimagination, ikke et lag med kosmetisk CSS over dagens komponenter. Før de store visuelle PR-ene bygges skal Claude Design brukes til å etablere en godkjent designretning.

### 3.1 Referanseflater som skal designes

Claude Design skal ikke forsøke å redesigne hele appen i ett sprang. Lag i stedet et lite sett referanseflater som dekker nesten alle primitive mønstre:

1. OUSFARs hovedflate med ny global toppmeny og globalt fagsøk.
2. En komplett stoffmonograf for **kvetiapin**, desktop, lyst tema.
3. Samme monograf på smal mobil.
4. Samme monograf i mørkt tema.
5. Preparater: én åpnet legemiddelform, styrkerutenettet, én utvidet styrke og preparatmodal.
6. Global søkeresultatside.
7. Ett eksisterende fortolkningstrinn med nytt visuelt skall, men uendret mekanikk.

Disse blir designfasit for resten av appen.

### 3.2 Designleveranser

Claude Design skal levere:

- valgt visuell retning;
- semantiske farger for flater, tekst, nivåer, kliniske cues og interaksjon;
- typografisk hierarki;
- spacing-, radius-, border-, shadow- og motion-regler;
- toppmeny og responsiv oppførsel;
- kort, paneler, modaler, søkedropdown og søkeresultater;
- icon language for små UI-ikoner og større konseptikoner;
- lyst og mørkt tema;
- hover/focus/pressed/open/disabled/loading/error-tilstander;
- mobiloppførsel;
- regler for animasjon og redusert bevegelse.

Når designretningen er godkjent, brukes Claude Designs handoff til Claude Code som visuell fasit sammen med dette dokumentet.

## 4. Designsystem og ikoner

### 4.1 Tokens og gjenbruk

Utvid tokens.css slik at komponenter bruker semantiske tokens fremfor konkrete verdier. Behold rem/clamp-baserte skalaer. Nye verdier skal inn på riktig abstraksjonsnivå, for eksempel:

- typografi: display, side title, section title, body, secondary, caption;
- spacing: eksisterende rytme skal normaliseres og brukes konsekvent;
- form: card radius, control radius, pill radius;
- elevation/blur: appbar, modal, popover;
- semantic surfaces: neutral, informative, reference, toxic-warning, severe-danger, success/reference-range;
- motion: quick UI feedback, drawer motion, illustrative icon motion.

Unngå hardkodede pikselverdier i enkeltkomponenter når de representerer en gjentakende designregel.

For å redusere mergekonflikter i parallelle PR-er bør nye større komponentområder få egne stilfiler fremfor at alle legger store blokker i components.css.

### 4.2 SVG-ikoner

Ikoner skal være kildekontrollerte SVG/React-komponenter. Ikke bygg en kritisk avhengighet til en ekstern ikon-CDN.

Ikonsystemet skal støtte:

- små UI-ikoner i toppmeny og kontroller;
- middels seksjonsikoner;
- større, mer detaljerte konseptikoner i viktige data;
- 2–3 semantiske farger via CSS-variabler slik at samme ikon fungerer i lyst og mørkt tema;
- dekorativ eller semantisk tilgjengelighetsmodus;
- størrelsesvarianter;
- animasjon ved hover/fokus/aktivering og eventuelt første gang ikonet kommer inn i viewporten.

Animasjon skal være kort og meningsfull, ikke kontinuerlig pynt. prefers-reduced-motion skal deaktivere ikke-essensiell bevegelse. Farge skal alltid suppleres av tekst/form/ikon og aldri være eneste betydningsbærer.

## 5. Én global toppmeny

Dagens separate venstre menyknapp, høyre verktøylinje og monografens StepBar skal samles til ett fast appskall øverst.

### 5.1 Innhold

Toppmenyen skal kunne inneholde:

- sidemenyknapp;
- globalt fagsøk;
- kontekstavhengige handlinger for monograf: Lukk, Åpne fortolkning, Rediger/Avslutt redigering;
- lokalt søk i åpen monograf;
- konto/brukere;
- hurtigtastvisning;
- tema.

Alle handlinger skal ha ikon. Tekst kan beholdes der den forbedrer forståelsen; på trange flater kan sekundære handlinger bli ikonknapper med tydelig tooltip og accessible name.

### 5.2 Visuelt og responsivt

- Fast øverst i viewporten.
- Delvis transparent bakgrunn med backdrop-filter blur, med solid fallback.
- Én eksplisitt høyde/offset-token slik at innhold, scrollIntoView og ankerlenker aldri havner under toppmenyen.
- Tydelig, men diskret skille fra innholdet.
- Globalt fagsøk skal alltid ha en faktisk søkeinput i toppmenyen. På smale flater får den prioritet i bredden.
- Lokalt monografsøk kan være kompakt og ekspandere eller få overlay på mobil slik at to store søkefelt ikke konkurrerer om samme rad.
- Sekundære knapper skal krympe til ikonmodus før søkefeltet presses urimelig sammen.

## 6. To klart forskjellige søk

### 6.1 Globalt fagsøk

Dette søker i stoffmonografene, ikke i analyttvelgeren på startsiden.

- Alltid tilgjengelig i toppmenyen.
- Ctrl+K fokuserer feltet og overstyrer nettleserens standardhandling. Støtt også Cmd+K på macOS.
- Skal ikke kapre tastetrykket når et høyere prioritert lag eller redigeringsfelt uttrykkelig trenger kombinasjonen.
- Dropdown viser de mest relevante treffene med navn, eventuell kode, sti på siden og kort utdrag.
- Piltaster navigerer, Enter åpner, Escape lukker dropdown.
- Nederst: **Vis alle treff**.
- Egen rute for full søkeresultatside, med query i adressen slik at søk kan bokmerkes og deles.
- Treff skal dyp-lenke til riktig panel/kort der mulig. Eksisterende sted-ruting og seksjonsstyring skal brukes.

### 6.2 Søkemotor

Ikke lag en ny parallell søkelogikk. Utvid src/faginnhold/sok.ts.

Rangering skal være deterministisk og forståelig. Som utgangspunkt:

1. eksakt eller prefix i stoffnavn eller analyttkode;
2. alias eller komponent;
3. preparatnavn;
4. overskrifter;
5. strukturerte verdier eller tabeller;
6. fritekst;
7. referanser.

Eksisterende aksent- og æøå-folding og utdragslogikk beholdes. Unngå en ugjennomsiktig fuzzy-ranking i første versjon.

Det skal etableres én effektiv lesesti for alt publisert, søkbart faginnhold. Ikke gjør ett nettverkskall per side. Ikke dupliser TypeScript-rangeringen i SQL. Velg en kompakt publisert råmodell eller en indeks som produseres av samme TypeScript-logikk.

### 6.3 Lokalt monografsøk

Eksisterende Sidesok beholdes funksjonelt, men flyttes inn i toppmenyen eller monografkonteksten og gjøres mindre.

- Ctrl+B fokuserer søket; støtt også Cmd+B.
- Dagens slash-snarvei kan fjernes når den nye snarveien er på plass.
- Søket skal fortsatt finne tekst i lukkede seksjoner, åpne riktig sti og fremheve treff.
- Lokal og global søkestatus skal ikke blandes.

## 7. Trekkspill: én søskenskuff åpen per nivå

Fjern den synlige funksjonen **Åpne alle / Lukk alle**.

Ny invariant:

- På hvert nivå kan bare én søskenskuff være åpen.
- Når en skuff åpnes, lukkes alle søsknene på samme nivå.
- Åpne foreldre forblir åpne.
- Når en skuff åpnes av bruker, direktelenke, lokalt søk eller nettleserens beforematch, skal samme invariant gjelde.
- Når en skuff åpnes interaktivt, skal siden etter tegning rulle til toppen av skuffen. Toppmenyhøyden må tas hensyn til.
- Ved prefers-reduced-motion brukes umiddelbar åpning eller rulling der det er riktig.

Implementer regelen sentralt i Seksjonsstyring, ikke ad hoc i hvert panel. Nøklenes foreldresti kan brukes til å identifisere søsken.

Redigeringsmodus skal ikke være avhengig av den gamle åpne-alle-knappen. Hvis redigering trenger større oversikt, løs dette som en intern redigeringspresentasjon eller ved å åpne målseksjonen eksplisitt; ikke bryt lesemodusens invariant.

## 8. Stoffmonograf: ny rekkefølge og presentasjon

Rekkefølgen skal være:

1. Stoffnavn/identitet
2. Viktige data, uten synlig paneltittel og alltid åpent
3. Farmakodynamikk
4. Indikasjon
5. Preparater
6. Dosering
7. Farmakokinetikk
8. Interaksjoner
9. Serumkonsentrasjoner
10. Fortolkningsregler der de finnes
11. Referanser

Oppdater PANELER/PANELREKKEFOLGE slik at visning, søk og referansenummerering følger samme rekkefølge.

### 8.1 Viktige data

Dette er en ikke-kollapsbar hurtigoversikt. Fjern overskriften «Viktige data».

Lag to tydelige grupper:

**Konsentrasjoner**
- Referanseområde
- Toksisk område
- Alvorlig/dødelig intoksikasjon

**Kinetiske nøkkeltall**
- t₁/₂
- tₛₛ

De tre konsentrasjonskortene kan ha beslektet layout, mens kinetikkortene kan være litt bredere for å romme mini-plot.

Ikonretning:

- Referanseområde: vennlig/blunkende ansikt, grønn/rolig aksent.
- Toksisk område: surt/knipende ansikt, gul/amber aksent.
- Alvorlig/dødelig intoksikasjon: dødninghode, rød aksent.
- t₁/₂: stilisert førsteordens tid–konsentrasjonskurve med stiplede linjer ved halveringstid.
- tₛₛ: stilisert gjentatt dosering over 3–5 doser med stiplet steady-state-linje.

Bruk alltid eksplisitt tekstetikett i tillegg til fargen. «Referanseområde» skal ikke visuelt kommuniseres som en garanti om «trygt».

### 8.2 Seksjonsikoner

Designretning:

- Farmakodynamikk: to tannhjul som spinner kort ved aktivering eller hover.
- Indikasjon: medisinsk kors + checkmark.
- Preparater: liten komposisjon av f.eks. blister, sprøyte og flaske.
- Dosering: gradert pipette som slipper en dråpe.
- Farmakokinetikk: bloddråpe + stoppeklokke.
- Interaksjoner: to kuler i ulike semantiske farger som kolliderer med kort impact-animasjon.
- Serumkonsentrasjoner: blodfylt prøverør.

Farmakokinetikkens underkort skal få et ikonregister basert på semantiske kategorier som absorpsjon, distribusjon, metabolisme/CYP, eliminasjon og biotilgjengelighet, med en trygg generisk fallback når en redaksjonell overskrift ikke matcher en kjent kategori. Ikke hardkod et ikon mot tilfeldig fritekst uten fallback.

## 9. Preparater: form → styrke → preparat → modal

Dagens modell legemiddelform → preparat → styrker skal endres i presentasjonslaget til:

**Legemiddelform (overskrift) → styrker (kort) → preparatnavn (utvidet styrkekort) → preparatmodal (full detalj)**

### 9.1 Legemiddelform

- Preparater skal fortsatt grupperes etter FESTs LegemiddelformKort.
- Godkjenningsfritak skal **ikke** være en egen gruppe eller form.
- Legemiddelform vises som stor klikkbar overskrift, ikke som kort.
- Overskriften skal ha et ikon for legemiddelformen og en kort oppsummering.

### 9.2 Faktiske legemiddelformer og ikonregister

Ikonsettet skal ikke bygges fra en håndskrevet antakelse om mulige former.

Lag en liten maskinell kartlegging som fra gjeldende FEST-data finner alle distinkte LegemiddelformKort som faktisk forekommer blant preparater knyttet til OUSFARs publiserte stoffmonografer. Bruk stabil FEST-kode som nøkkel og tekst som etikett.

Resultatet skal kunne kontrolleres i test eller generert rapport. Et ikonregister mapper stabile formkoder til visuell kategori. Alle aktive former skal enten ha eksplisitt ikon eller en dokumentert generisk fallback. Legg en test som gjør nye, umappede former synlige ved en senere FEST-oppdatering.

### 9.3 Styrkerutenett

Når en legemiddelform åpnes:

- Vis ett kort per tilgjengelig styrke, uavhengig av antall preparatnavn.
- Alle lukkede styrkekort har konsistent høyde og aspect ratio.
- Lukket kort viser i hovedsak formikon + styrke, for eksempel 200 mg.
- Rutenettet er responsivt.

Styrkeidentitet skal bygges av strukturerte FEST-felt, ikke bare presentasjonsteksten. Kombinasjonspreparater, nevnerenheter som mg/ml og mg/5 ml, intervaller og saltinformasjon må ikke ved et uhell slås sammen fordi to visningstekster ser like ut.

### 9.4 Utvidet styrke

Når et styrkekort åpnes:

- søskensstyrker lukkes;
- kortet går over til å fylle tilgjengelig bredde;
- vis alfabetisk liste over alle preparatnavn som finnes i denne formen og styrken;
- preparater som krever godkjenningsfritak står i samme liste og får en tydelig badge;
- andre relevante preparattyper kan fortsatt badges når de ikke er ordinære;
- bruk eksisterende data for kombinasjon, salter osv. uten å miste informasjon.

### 9.5 Preparatmodal

Klikk på preparatnavn åpner en modal med alle detaljene for det valgte preparatet, slik at informasjonen som finnes i dagens preparatvisning ikke går tapt.

Modalen bør gruppere informasjonen bedre enn dagens tekstflate:

- preparatnavn og statusbadges;
- reseptgruppe og administrasjonsvei;
- én ryddig rad eller seksjon per styrke;
- knusing, deling og åpning som små statusmerker;
- pakninger med varenummer;
- produsent og andre metadata når tilgjengelig;
- Preparatomtale som tydelig ekstern lenke;
- kilder i referansefeltet.

Hvis modal åpnes fra f.eks. 200 mg kan den styrken markeres eller rulles fram, men modalens identitet er preparatet og kan vise øvrige styrker, i tråd med eksemplet med Quetiapine Accord.

Modalen skal ha korrekt fokusstyring, Escape, fokusretur, backdrop, scroll-lock og god mobilvisning.

## 10. Serumkonsentrasjoner

Tabellen skal visuelt bringes tilbake mot utformingen i originaldata/Psykofarmaka.pdf, som er kildeartefakten for denne tabelltypen, uten å gjøre den mindre tilgjengelig.

Ved implementering:

- sammenlign konkret med PDF-en før design avgjøres;
- behold semantisk HTML-tabell;
- bruk den opprinnelige informasjonsgrupperingen og hierarkiet som visuell referanse;
- på smal skjerm: horisontal scrolling fremfor å klemme data uleselig; vurder sticky header og eventuelt første relevante kolonne;
- ikke endre kliniske tall eller tekst som del av visuell restaurering.

## 11. Referanser: ett system også for FEST

### 11.1 Presentasjon

Alle synlige kilder skal inn i det nummererte referansesystemet.

- Inline-referanser: superscript-piller.
- Referanser som gjelder et helt kort eller panel: eget visuelt avgrenset **referansefelt nederst** i kortet eller panelet, ikke i overskriften og ikke blandet med brødteksten.
- UI skal ikke skrive ut en manuell kildehenvisning som løpende «Kilde: …» dersom den egentlig er en referanse. Den vises som nummerpille; full tekst finnes i popover og referanselisten.
- Referanselisten nederst er eneste permanente sted full bibliografisk tekst listes.

### 11.2 Autoimporterte FEST-referanser

FEST-kilder og FESTs egne interaksjonsreferanser skal inngå i samme nummerering som redaksjonelle referanser.

Modellen skal skille opprinnelse, for eksempel:

- redaksjonell: redigerbar og slettbar gjennom dagens arbeidsflyt;
- FEST: automatisk, read-only og ikke manuelt slettbar.

Foretrekk å syntetisere eller importere FEST-referansene fra den aktuelle synkroniserte FEST-lesemodellen med en stabil ekstern nøkkel fremfor å lage dem som vanlige redaksjonelle historikkobjekter. Da forsvinner en referanse naturlig ved neste FEST-synk når kilden ikke lenger finnes, uten manuell sletting og uten at redaktører kan endre eksterne data.

Sidereferanser skal motta én sammenslått referanse-univers-modell slik at manuell og automatisk kilde:

- får samme fortløpende nummerering;
- vises i samme popover;
- havner i samme referanseliste;
- kan brukes på panel-, element- og inline-nivå;
- likevel har korrekt redigerbarhet i editoren.

FESTs obligatoriske kildeangivelse og synkdato må fortsatt være sporbar. Hvis dette er provenance eller metadata og ikke en bibliografisk referanse, utform en særskilt, diskret provenance-rad som peker til en FEST-referansepille i stedet for å blande rå «Kilde: …»-tekst inn i faginnholdet.

## 12. Innholdsrydding

Designarbeidet skal også fjerne visuelt og språklig støy.

Skill mellom:

- **UI- og hjelpetekst**, som kan kortes, flyttes til tooltip eller fjernes;
- **klinisk meningsinnhold**, som ikke skal omskrives automatisk som del av et designløft.

Lag en konkret copy inventory under implementeringen. Fjern dupliserte forklaringer der hierarki, etikett eller ikon allerede forklarer funksjonen. Kliniske formuleringer, enheter, terskler og faglige påstander endres bare i eksplisitte faglige oppgaver.

## 13. Foreslått implementeringsrekkefølge

Arbeidet kjøres i bølger slik at Claude Code Projects kan parallellisere uten å lage mange PR-er som alle endrer de samme filene.

### Bølge 0 – designfasit

Ingen bred visuell implementering før Claude Design-handoff finnes. Tekniske grunnarbeider som ikke låser visuelt uttrykk kan starte.

### Bølge 1 – parallelle fundament-PR-er

**PR A – Designfundament og appskall**
- semantiske tokens;
- ikonprimitive og API;
- ny samlet fast toppmeny;
- responsiv topplinje og top-offset;
- integrer eksisterende sidemeny-, konto-, tema- og hurtigtastkontroller;
- ingen endring av fortolkningsmekanikk.

**PR B – Trekkspillmotor**
- søsken-eksklusiv åpning per nivå;
- fjern brukerfunksjonen Åpne/Lukk alle;
- scroll til skuffens topp ved åpning;
- direktelenke, lokalt søk og beforematch følger samme invariant;
- tester for to nivåer, scroll og redusert bevegelse.

**PR C – Global søkeplattform**
- effektiv lesesti for alle publiserte monografer;
- gjenbruk indekserSide og sok;
- resultatrute og deep links;
- ingen ny parallell rankingmotor.

**PR D – Referansemodell**
- sammenslått read model for redaksjonelle og FEST-importerte kilder;
- read-only automatisk opprinnelse;
- referansefooter-komponent;
- fjern rå kildetekst der det er referanser;
- tester for nummerering, livssyklus og editorbeskyttelse.

Disse fire PR-ene bør eie separate stil- og kodeområder så langt det lar seg gjøre.

### Bølge 2 – visuelle og domeneorienterte PR-er

Startes mot oppdatert main etter at relevante fundamenter er merget.

**PR E – Monografstruktur og viktige data**
- panelrekkefølge;
- alltid åpen viktige-data-flate uten paneltittel;
- grupperte konsentrasjons- og kinetikkort;
- t₁/₂ og tₛₛ;
- Claude Design-ikonene og responsiv layout.

**PR F1 – Preparatets nye view model**
- form → styrke → preparater;
- godkjenningsfritak som badge, ikke gruppe;
- robust strukturert styrkenøkkel;
- maskinell liste over faktisk brukte legemiddelformer;
- testet ikonregister og fallback.

**PR F2 – Preparat-UI**
- legemiddelform som overskrift;
- styrkerutenett;
- utvidet styrke;
- preparatmodal;
- integrer referansefelt fra PR D;
- full tastatur-, mobil- og modaltest.

**PR G – Globalt og lokalt søke-UI**
- global input i topplinjen, Ctrl/Cmd+K;
- rangert dropdown + Vis alle treff;
- søkeresultatside;
- kompakt monografsøk i topplinjen, Ctrl/Cmd+B;
- fokus- og snarveiskonflikter testet.

**PR H – Øvrige monografpaneler**
- seksjonsikoner og farmakokinetikk-underikoner;
- visuell oppgradering av Farmakodynamikk, Indikasjon, Dosering, Farmakokinetikk og Interaksjoner;
- serumtabell mot PDF-fasit;
- ingen faglig innholdsendring.

### Bølge 3 – helhetlig ferdigstilling

**PR I – Resten av appens visuelle språk**
- bruk samme designprimitiver på fortolkningsflatene;
- behold all mekanikk;
- rydd UI-copy;
- fjern gamle og dupliserte stylingmønstre som nå er erstattet.

**PR J – Integrasjon og kvalitet**
- helhetlig responsive pass;
- lyst og mørkt tema;
- tastatur og skjermleser;
- prefers-reduced-motion;
- kontrast;
- modal og fokus;
- mobil;
- visuell regresjonskontroll mot Claude Design-referanseflatene;
- dokumentasjon;
- npm test og npm run build.

Hvis en senere PR blir for stor, del den etter komponentgrense, ikke etter vilkårlige filbiter.

## 14. Akseptansekriterier

Arbeidet er ikke ferdig før:

- toppkontrollene aldri overlapper på støttede bredder;
- globalt fagsøk er tilgjengelig overalt og Ctrl/Cmd+K virker;
- lokalt monografsøk er kompakt og Ctrl/Cmd+B virker;
- åpning av en skuff lukker søsknene på samme nivå, men ikke forelderen;
- åpnet skuff legges synlig under den faste toppmenyen;
- Viktige data er alltid synlig og først etter stoffnavnet;
- Preparater følger form → styrke → preparat → modal;
- godkjenningsfritak er badge, ikke egen formgruppe;
- alle legemiddelformer som faktisk brukes har eksplisitt ikon eller testet fallback;
- alle referanser vises som nummererte piller i faginnholdet;
- FEST-referanser er nummererte, listet og read-only;
- ingen dynamisk FEST-kilde kan redigeres eller slettes som en manuell kilde;
- serumtabellen er visuelt kontrollert mot PDF-kilden;
- alle nye ikoner fungerer i lyst og mørkt tema og respekterer redusert bevegelse;
- farge er aldri eneste signal;
- klinisk output og fortolkningsmekanikk er uendret;
- appen består relevante tester, full npm test og npm run build.

## 15. Viktige designvalg som ikke skal overlates til tilfeldige PR-er

1. **Én designretning først.** Ikke la parallelle implementeringsøkter finne på hvert sitt visuelt språk.
2. **Globalt søk og analyttsøk er forskjellige produkter.** Det nye globale fagsøket må ikke erstatte analyttsøket som driver fortolkningsflyten.
3. **Styrke er strukturerte data.** Ikke grupper styrker etter bare ferdigformatert tekst.
4. **Automatiske referanser er ikke redaksjonelle objekter.** Read-only-opprinnelse skal være en systemregel.
5. **Klinisk innhold er ikke UX-copy.** Designrunden kan rydde chrome og hjelpetekst, ikke forbedre farmakologisk tekst automatisk.
6. **Animasjon skal gi feedback.** Ikke bruk konstant dekorativ bevegelse i en arbeidsflate som skal kunne brukes under konsentrasjon.
7. **Mobil er en referanseflate, ikke en etterkontroll.** Kvetiapin-monografen skal designes eksplisitt både bred og smal før komponentene generaliseres.

## 16. Fremdrift

Vedlikeholdes bare av koordinatorøkten, ved hver merge. Visuell fasit: Claude Design-handoff «OUSFAR Visual Directions», retning Atlas.

| PR | Innhold | Status |
| --- | --- | --- |
| A | Designsystem, ikoner og felles toppmeny | Merget (#56, 1.25.0) |
| B | Trekkspillmotor: én åpen skuff per nivå | Merget (#52, 1.23.0) |
| C | Søkedata for globalt søk | Under arbeid |
| D | Referansemodell med FEST | Merget (#54, 1.24.0) |
| F1 | Preparatmodell og legemiddelformregister | Merget (#53, 1.23.1) |
| E | Monografstruktur og Viktige data | Under arbeid |
| F2 | Preparater-UI | Merget (#57, 1.26.0) |
| G | Globalt og lokalt søk-UI | Venter på C |
| H | Øvrige monografpaneler og serumtabell | Under arbeid |
| I | Resten av appens visuelle språk | Venter på bølge 2 |
| J | Sluttintegrasjon og kvalitetskontroll | Venter på I |

Kjente mellomtilstander:

- Etter B og før E er Viktige data en vanlig søskenseksjon, så den lukkes når en annen seksjon åpnes. E tar den ut av trekkspillet.
- Rom-skalaen fulgte Atlas fra A (1.25.0): gamle `--rom-1…6` er nå `--rom-2, 3, 5, 7, 8, 9`. Ny CSS bruker den nye skalaen.
- Toppmenyens globale søkeplass og `Fagsokfelt` (Ctrl/Cmd+K) er bygget, men monteres først av G. Stoffsidens lokale søk står i siden til G flytter det.
