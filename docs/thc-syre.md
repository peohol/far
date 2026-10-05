# THC-syre i urin

Leses når noe ved fortolkningen av THC-syre (IRCAK) skal endres: motoren,
reglene, tekstene eller fasiten. Planen står i
`docs/stoffsider-og-redigering.md` (arbeidspakke 7).

THC-syre er en egen regelmotor, ikke en variant av konsentrasjonsbåndene eller
scenarioene for analyttgruppene. Kurvene, måleusikkerheten og den dynamisk
sammensatte kommentaren passer ikke i de generelle modellene uten å bli
uleselige.

## Status

Reglene og tekstene er lagret og publisert i Supabase, med historikk og
kontroll på serveren (se [Lagringen](#lagringen)). Fortolkningsmodulen
fortolker med motoren og det som er publisert (se [I appen](#i-appen)).
THC-syre (IRCAK) er koblet til stoffet THC (`#/stoff/thc`), sammen med THC i
serum. Siden viser to separate fortolkningsseksjoner:
scenarioreglene for THC i serum og THC-syrereglene for urin med tekstbolker
og simulator. Administratorer kan redigere og publisere de to regelsettene
uavhengig fra den samme siden. Den opprinnelige THC-syremodulen er bare igjen
som fasit i testene (se [Redigeringen](#redigeringen)).

## Delene

| Hvor | Hva |
| --- | --- |
| `src/domain/thcRegelsett.ts` | Reglene: formen, og den ene kontrollen av dem |
| `src/domain/thcTekster.ts` | Tekstbolkene: hva hver er, når den brukes, og kontrollen av dem |
| `src/domain/thcKurver.ts` | Kurveregningen, og beviset for at kurvene står i rekkefølge |
| `src/domain/thcMotor.ts` | Motoren: fra inndata, regler og tekster til kommentar, konklusjon og tallgrunnlag |
| `src/domain/thcTall.ts` | Tall og datoer slik de tastes og skrives |
| `src/domain/thcPlot.ts` | Figuren med kurvene og de to prøvene |
| `src/domain/thcVisning.ts` | Det modulen og redigeringssiden skriver om reglene: nivåene, marginene og kurvene per bruksmønster |
| `src/domain/thc.ts` | Koden, analysemetoden og søkeoppføringen |
| `src/faginnhold/thcregler.ts` | Fra det databasen gir til en kontrollert modell, eller feilen modulen viser |
| `src/components/ThcStep.tsx`, `ThcSkjema.tsx`, `ThcUtfall.tsx` | Modulen: skjemaet, kommentaren og kurvene, delt med simulatoren |
| `src/components/regler/Thcregler.tsx`, `Thcsimulator.tsx` | Reglene, tekstbolkene og simulatoren på redigeringssiden for fortolkningen |
| `src/components/regler/Thcredigering.tsx` | Redigeringen av reglene og tekstene |
| `src/domain/__tests__/hjelp/thcOpprinnelig.ts` | Den opprinnelige modulen, med regnearkets konstanter i koden. Bare fasit i testene |
| `src/domain/__tests__/fasit/thc-regelsett-import.json`, `thc-tekster-import.json` | Reglene og tekstene slik de står i den opprinnelige modulen |
| `src/domain/__tests__/fasit/thc-fasit.json` | Fasiten: utfallet av den opprinnelige modulen for over 4000 inndata |
| `scripts/lag-thc-fasit.ts` | Lager fasiten på nytt, bare ved bevisst klinisk endring |
| `supabase/migrations/*_thc_regelsett*.sql`, `*_thc_tekster_som_kommentarer.sql` | Lagringen: tabellene, kontrollen på serveren, importen og flyttingen av tekstene |
| `src/__tests__/thcRegelsettlagring.test.ts` | Lagringen prøvd mot en ekte database bygd av migrasjonene |
| `src/__tests__/thcsteg.test.tsx`, `thcregler.test.tsx` | Modulen og redigeringssiden med reglene de får |
| `src/__tests__/thcredigering.test.tsx`, `thcredigeringslagring.test.ts` | Redigeringen, og lagringen og publiseringen av den mot en ekte database |

## Fremgangsmåten

Kilden er regnearket `originaldata/THC-COOH.xlsm`, med eierens senere tillegg.

1. **Forrige prøve.** IRCAK tastes, eller — når forrige prøve lå under
   cut-off — UCAK og NKRE, og IRCAK regnes som UCAK/NKRE.
2. **Målt endring** er aktuell/forrige − 1.
3. **Korrigert endring** er aktuell/forrige · exp(z · logSD · u) − 1, der
   logSD = √(2 · (CV_THC² + CV_kreatinin²)), z er kvantilet for den valgte
   sikkerhetsmarginen, og u er faktoren for måleusikkerhet under cut-off
   (ellers 1). En margin regelsettet ikke har, er ugyldig inndata: den gir
   en mangel og aldri en konklusjon, siden skjemaet kan leve lenger enn
   regelsettet det ble fylt ut mot.
4. **Forventet endring** per kurve: kurven leses av der forrige prøve ligger,
   og like mange døgn senere.
5. **Konklusjonen** avgjøres av hvor mange kurver, fra grønn og utover, den
   korrigerte endringen ligger over (strengt større enn), og av grensene for
   bruksmønsteret: ved kronisk bruk skiller gul «ikke nødvendigvis» fra
   «vanskelig å avgjøre», og rød «vanskelig» fra nytt inntak; uten kronisk
   bruk er det grønn og gul.
6. **IRCAK 0 i forrige prøve** gir alltid nytt inntak, uten tallgrunnlag.
7. **Kommentaren** settes sammen av tekstbolker etter konsentrasjonsnivået i
   denne prøven og konklusjonen. Hvilke bolker hver konklusjon gir, er en
   regel i motoren (`velgTekstbolker`); ordlyden står i tekstene.

## Regler og tekster er adskilt

Reglene avgjør konklusjonen. Tekstene er ordlyden kommentaren bygges av. De er
to adskilte ting, som prosjektets arkitekturregel om kommentar og regel krever:

- **Reglene** (`ThcRegelsett`) har ingen tekst som havner i kommentaren. De
  eneste ordene der er navnene på nivåene («lav», «middels høy», «høy»), som
  settes inn for plassholderen `{nivå}`, og navnene på kurvene i figuren.
- **Tekstene** (`ThcTekster`) er én tekst per bolk. Hver bolk har en fast
  rolle — nøkkelen, f.eks. `vanskelig` — og kan inneholde plassholderne
  `{nivå}` og `{forrige prøvedato}`, som fylles inn når kommentaren settes
  sammen. Hvilke plassholdere hver bolk må ha og kan ha, står i
  `THC_TEKSTBOLKER`.

Motoren tar imot begge, satt sammen og kontrollert, som en `ThcModell` fra
`lagThcModell`.

I databasen er hver tekst en kommentar (objekttypen `kommentar`, se
`docs/faginnhold.md`), og regelsettet sier hvilken kommentar hver bolk bruker
(`tekstbolker`). `thcTeksterFra` slår tekstene opp i kommentarene.

## Reglene

| Del | Innhold | Invarianter |
| --- | --- | --- |
| Konverteringsfaktor | Fra kildedataenes enheter til IRCAK | > 0 |
| Kurver | Grønn, gul og rød: navn, a1, k1, a2, k2 (amplitudene i kildeenheter) | Alle > 0; grønn gir minst like rask utskillelse som gul, og gul som rød, for enhver forrige prøve og ethvert tidsrom |
| Måleusikkerhet | CV for THC-syre og kreatinin, faktor under cut-off | 0 < CV < 1; faktor ≥ 1 |
| Sikkerhetsmarginer | Margin og z, og hvilken som er standard | 0,5 ≤ margin < 1, stigende; z = Φ⁻¹(1 − margin) innenfor 1e-9; standarden finnes |
| Konsentrasjonsnivåer | Navn, nedre grense, om nivået tyder på nylig inntak | Det laveste uten grense, resten stigende; ulike navn |
| Bruksmønstre | Kurven hver konklusjon ligger over, for kronisk og ikke-kronisk bruk | Nytt inntak er en tregere kurve enn «vanskelig» |
| Varsel | Døgn mellom prøvene før varselet | Helt tall ≥ 1 |

Grensene er matematisk entydige: et nivå gjelder fra og med sin nedre grense
og opp til, men ikke med, neste nivås. Det er skillepunktet som lagres, én
gang, ikke to grenser som må holdes like.

z lagres ved siden av marginen fordi 1 − margin ikke kan regnes eksakt i
flyttall (1 − 0,99 er ikke 0,01). z-en regnearket bruker, er kontrollert mot
AS 241 (`normalkvantil`).

Den lilla kurven i regnearket («Kronisk, typisk») er ikke med: verken
konklusjonen eller figuren bruker den.

## Kontrollen

`validerThcRegelsett` er den ene kontrollen av reglene: alt over, også
kurvenes rekkefølge, står der, og en tom liste betyr at reglene kan brukes.
`validerThcTekster` gjør det samme for tekstene. Motoren tar bare imot en
`ThcModell`, og den fås bare fra `lagThcModell`, som kjører begge. Typene
(`GodkjentThcRegelsett`, `GodkjenteThcTekster`) gjør det umulig å gi motoren
noe som ikke er kontrollert.

**Kurvenes rekkefølge** er bevist for hele domenet motoren godtar — enhver
forrige prøve over 0 og ethvert tidsrom — ikke prøvd på utvalgte punkter.
Beviset står øverst i `thcKurver.ts`. Kort fortalt: kurve A forventer minst
like stor nedgang som kurve B fra enhver forrige prøve over ethvert tidsrom
hvis og bare hvis utskillelsesraten til A er minst like stor som B sin ved
hver konsentrasjon. Raten ved en konsentrasjon har en lukket form for
bi-eksponentielle kurver. Med samme rater avgjøres ulikheten direkte. Ellers
avgjøres den i endene av grenseverdiene, og i midten av en oppdeling som er et
bevis, fordi begge ratene stiger med konsentrasjonen. Et avvik oppgis med
hvor det er: ved lave eller høye konsentrasjoner, eller rundt en bestemt IRCAK.

For at motoren skal regne den samme modellen som beviset gjelder for, utvides
søket etter tidspunktet på kurven når forrige prøve ligger lenger ut enn
±1000 døgn. Det skjer bare for IRCAK langt under det laboratoriet kan måle.
Innenfor gir søket de samme tallene som før, bit for bit.

## Lagringen

Regelsettet er objekttypen `thc_regelsett` i faginnholdet
(`docs/faginnhold.md`), med utkast, publisering, revisjoner, gjenoppretting
og samtidighetskontroll derfra. Det finnes bare ett. Formen er
`ThcRegelsettinnhold`: reglene, og `tekstbolker` med kommentar-ID-en for hver
bolk.

Delene har egne tabeller med kontroller på hver kolonne: `thc_regelsett`
(enkeltverdiene), `thc_kurver`, `thc_sikkerhetsmarginer`,
`thc_konsentrasjonsnivaer`, `thc_bruksmonstre` og `thc_tekstbolker`, som
bare peker på kommentarer. Tallene er `float8`, som i motoren.

**Kontrollen på serveren.** `intern.skriv_thc_regelsett` er veien alt som
lagres og publiseres går gjennom, og avviser det `validerThcRegelsett`
avviser: z mot AS 241, skillepunktene, grensene per bruksmønster og kurvenes
rekkefølge — avgjort for hele domenet med den samme fremgangsmåten som
`thcKurver.ts`, og med de samme meldingene. En bolk må peke på en kommentar
med plassholderne bolken krever, og ingen den ikke kan bruke
(`validerThcTekstbolk`). Plassholderne i en kommentar kan aldri endres, så
det holder også når teksten senere rettes. Et regelsett kan ikke publiseres
før kommentarene det peker på er publisert. Testene sender de samme ugyldige
regelsettene og tilfeldige kurvepar til appen og databasen og krever samme
svar.

**Lesingen.** `les_thc_regelsett('publisert' | 'utkast')` gir regelsettet
med revisjon og hvem som sist endret det, og `les_kommentarer` tekstene;
utkastene bare til administratorer. Tabellene kan ikke skrives direkte.
Øyeblikksbildet gir nøyaktig de samme flyttallene tilbake, fordi
`les_thc_regelsett` setter `extra_float_digits` selv.

**Historikken i prosjektet.**
1. Importen (`*_thc_regelsett_import.sql`) la inn reglene og tekstene fra den
   opprinnelige modulen, som Peder. Revisjon 1 fikk bare 15 sifre i tallene.
2. Revisjon 2 (`*_thc_regelsett_flyttall.sql`) har alle sifrene.
3. `*_thc_tekster_som_kommentarer.sql` flyttet de ti tekstene ut som
   publiserte kommentarer («THC-syre: Åpning» osv.), og revisjon 3 peker på
   dem. Den er publisert, og reglene og tekstene er lik
   `thc-regelsett-import.json` og `thc-tekster-import.json`.

Revisjon 1 og 2 har tekstene i seg. Gjenopprettes en av dem, får regelsettet
reglene derfra og beholder kommentarene det peker på nå; tekstene har sin egen
historikk.

## I appen

Appen henter det publiserte regelsettet og tekstene når den åpnes
(`Faginnholdsleser.lesThcRegelsett`), og på nytt når en administrator har
publisert på redigeringssiden for fortolkningen. `thcReglerFra` kontrollerer dem og
setter dem sammen til modellen motoren bruker. Modulen gir ingen kommentar før
de er hentet, og sier fra i stedet om de ikke kunne hentes, ikke finnes eller
ikke består kontrollen. Mens de hentes på nytt, står de gamle.

Alt modulen viser om reglene kommer fra regelsettet: varselgrensen, nivåene,
grensene per bruksmønster og faktoren under cut-off i forklaringen, og valgene
på bryteren for sikkerhetsmarginen (`Trinnbryter`, med «Ingen (50 %)» for
ingen margin). Under bryteren forklarer «Hva er sikkerhetsmarginen?»
(`ThcMarginforklaring`) hva marginene gjør, med et eksempel som fortolkes med
hver margin av `sammenlignMedForrige`, det samme steget fortolkningen bruker.
Står skjemaet på en margin et nytt regelsett ikke har, gir motoren en mangel
og ingen kommentar.

Redigeringssiden for IRCAK (`#/fortolkning/ircak/rediger`, se
`docs/fortolkningsregler.md`) har seksjonen med oversikten over reglene, detaljkortet `tekster` med hver tekstbolk og når den brukes, og
detaljkortet `simulator`. Simulatoren bruker det samme skjemaet, den samme
kommentaren og de samme kurvene som modulen, og viser hvilke tekstbolker
kommentaren ble satt sammen av. Det er utkastet som vises.

## Redigeringen

Seksjonen har «Rediger reglene». Hvert tall har sitt eget
felt, andelene som prosent, og et felt som ikke røres, beholder tallet helt
ned til siste siffer. Nivåer og marginer kan legges til og fjernes; z for en
ny margin regnes ut av marginen. Tekstene redigeres der bolken er beskrevet,
med plassholderne den må ha.

`thcUtkastfeil` samler feilene mens det skrives — `validerThcRegelsett`,
`validerThcTekst` og plassholderne kommentaren har fra før, som ikke kan
endres — og utkastet kan ikke lagres før de er rettet. Så lenge det er
gyldig, fortolker simulatoren under med utkastet slik det står.

`thcEndringer` avgjør hva som lagres: hver kommentar med endret tekst, og
regelsettet bare når reglene er endret. Bolkene peker på de samme
kommentarene som før, så lagringene er uavhengige av hverandre og går hver
mot revisjonen som ble åpnet. Har noen andre lagret i mellomtiden, blir det
en konflikt og siden leses på nytt. Publiseringsplanen tar de endrede
kommentarene før regelsettet, som databasen krever.

## Fasiten

Motoren er skrevet slik at regnestykkene skjer i nøyaktig samme rekkefølge som
i den opprinnelige modulen, og gir samme resultat helt ned til siste siffer.
To sett tester holder det slik:

- `thcMotor.test.ts` kjører motoren med de importerte reglene og tekstene over
  hele fasiten. Den krever samme kommentar tegn for tegn, samme konklusjon,
  samme varsel og samme mangler for hvert tilfelle, og samme SHA-256 over alt
  tallgrunnlaget og et utvalg figurer. Tilfellene ligger rett på, rett under
  og rett over hver kurvegrense (nabo-flyttallene) og skillepunktene mellom
  nivåene. De dekker også IRCAK 0, under cut-off, ingen tidligere prøve,
  varselgrensen og ugyldige felt. Beskrivelsen står i `hjelp/thcFasit.ts`.
- `thcParitet.test.ts` kjører den opprinnelige modulen og motoren side om
  side på 20 000 tilfeldige inndata, og sammenligner tekstbolkene og
  konklusjonen for hver kombinasjon av nivå, utfall og under cut-off.
- `fortolkningUendret.test.ts` holder alle kommentarene motoren kan gi med de
  publiserte tekstene, og konklusjonen for et rutenett av endringer, fast med
  SHA-256.
- `thcRegelsettlagring.test.ts` leser regelsettet slik appen gjør, fra en
  database bygd av migrasjonene, og krever nøyaktig den modellen fasiten er
  laget med.

Fasiten lages bare på nytt når den kliniske outputen endres med vilje, i samme
PR som endringen, og da med merket «Fag» i endringsloggen.
