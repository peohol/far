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
scenarioreglene for THC i serum og THC-syrereglene for urin med kommentarene
og simulator. Administratorer kan redigere og publisere de to regelsettene
uavhengig fra den samme siden. Den opprinnelige THC-syremodulen er bare igjen
som fasit i testene (se [Redigeringen](#redigeringen)).

## Delene

| Hvor | Hva |
| --- | --- |
| `src/domain/thcRegelsett.ts` | Reglene: formen, og den ene kontrollen av dem |
| `src/domain/thcTekster.ts` | Tekstene: de felles setningene og kommentaren for hver situasjon, når de brukes, sammensettingen og kontrollen av dem |
| `src/domain/thcKurver.ts` | Kurveregningen, og beviset for at kurvene står i rekkefølge |
| `src/domain/thcMotor.ts` | Motoren: fra inndata, regler og tekster til kommentar, konklusjon og tallgrunnlag |
| `src/domain/thcTall.ts` | Tall og datoer slik de tastes og skrives |
| `src/domain/thcPlot.ts` | Figuren med kurvene og de to prøvene |
| `src/domain/thcVisning.ts` | Det modulen og redigeringssiden skriver om reglene: nivåene, marginene og kurvene per bruksmønster |
| `src/domain/thc.ts` | Koden, analysemetoden og søkeoppføringen |
| `src/faginnhold/thcregler.ts` | Fra det databasen gir til en kontrollert modell, eller feilen modulen viser |
| `src/components/ThcStep.tsx`, `ThcSkjema.tsx`, `ThcUtfall.tsx` | Modulen: skjemaet, kommentaren og kurvene, delt med simulatoren |
| `src/components/regler/Thcregler.tsx`, `Thckommentarer.tsx`, `Thcsimulator.tsx` | Reglene, kommentarene og simulatoren på redigeringssiden for fortolkningen, som seksjon med detaljkort |
| `src/components/regler/Thcredigering.tsx`, `Thckommentarer.tsx` | Redigeringen av reglene og tekstene |
| `src/domain/__tests__/hjelp/thcOpprinnelig.ts` | Den opprinnelige modulen, med regnearkets konstanter i koden. Bare fasit i testene |
| `src/domain/__tests__/fasit/thc-regelsett-import.json`, `thc-tekster-import.json` | Reglene og tekstene slik de står i den opprinnelige modulen |
| `src/domain/__tests__/fasit/thc-regelsett.json`, `thc-tekster.json` | Reglene og tekstene slik de er publisert nå |
| `src/domain/__tests__/hjelp/thcKommentarfasit.ts` | Kommentarene slik eieren skrev dem 12.10.2026, skrevet ut uavhengig av tekstene og motoren |
| `src/domain/__tests__/fasit/thc-fasit.json` | Fasiten: konklusjonen fra den opprinnelige modulen og kommentaren fra kommentarfasiten for over 4000 inndata |
| `scripts/lag-thc-fasit.ts` | Lager fasiten på nytt, bare ved bevisst klinisk endring |
| `supabase/migrations/*_thc_regelsett*.sql`, `*_thc_tekster_som_kommentarer.sql`, `*_thc_laste_deler_og_samlet_lagring.sql`, `*_thc_nye_kommentarer.sql` | Lagringen: tabellene, kontrollen på serveren, importen, flyttingen av tekstene, de låste delene, `lagre_thc_regelsett` og de nye kommentarene |
| `src/__tests__/thcRegelsettlagring.test.ts` | Lagringen prøvd mot en ekte database bygd av migrasjonene |
| `src/__tests__/thcsteg.test.tsx`, `thcregler.test.tsx` | Modulen og redigeringssiden med reglene de får |
| `src/__tests__/thcredigering.test.tsx`, `thcredigeringslagring.test.ts` | Redigeringen, og lagringen og publiseringen av den mot en ekte database |
| `src/__tests__/thcseksjonsparitet.test.tsx` | Pariteten for seksjonen: samme modell og samme kliniske output som modulen og fasiten |

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
   «kan ikke fastslås», og rød «kan ikke fastslås» fra nytt inntak; uten
   kronisk bruk er det grønn og gul. I koden heter «kan ikke fastslås»
   fortsatt `vanskelig`.
6. **IRCAK 0 i forrige prøve** gir alltid nytt inntak, uten tallgrunnlag.
7. **Kommentaren** velges etter situasjonen og konsentrasjonsnivået i denne
   prøven (`velgKommentar`), og settes sammen av introsetningen, kommentaren
   og eventuelt spørsmålsetningen (`byggKommentar`). Se
   [Kommentarene](#kommentarene).

**Kort tid mellom prøvene.** Er prøvene tatt samme dag eller med færre døgn
imellom enn regelsettets grense (`kort_tid_dager`, 3), viser skjemaet en
melding med avkryssingen «Kort tid mellom prøvene», som ikke er huket av.
Hukes den av, vurderes ikke prøvene mot hverandre: det blir ingen
sammenligning, ingen margin og ingen tallgrunnlag, konklusjonen er som uten
forrige prøve, og kommentaren er «Kort tid mellom prøvene». Står
avkryssingen igjen etter at datoene er endret så det er lenger imellom,
gjelder den ikke.

**Samlet vurdering.** Med «Samlet vurdering med enda tidligere prøver» kan
brukeren legge inn flere prøver før forrige prøve (IRCAK eller UCAK og NKRE,
og dato). Gir sammenligningen med forrige prøve «kan ikke fastslås»,
sammenlignes denne prøven med hver av dem, fra den nærmeste og bakover, med
den samme fremgangsmåten. Den nærmeste som gir nytt inntak (eller har IRCAK
0), gir kommentaren «Samlet vurdering av flere tidligere prøver» med datoen
dens. Gir ingen nytt inntak, er kommentaren den vanlige. Konklusjonen og
tallgrunnlaget er alltid sammenligningen med forrige prøve. En tidligere
prøve må være tatt før forrige prøve.

## Regler og tekster er adskilt

Reglene avgjør konklusjonen. Tekstene er ordlyden kommentaren bygges av. De er
to adskilte ting, som prosjektets arkitekturregel om kommentar og regel krever:

- **Reglene** (`ThcRegelsett`) har ingen tekst som havner i kommentaren. De
  eneste ordene der er navnene på nivåene («lav», «middels høy», «høy»), som
  settes inn for plassholderen `{nivå}`, og navnene på kurvene i figuren.
- **Tekstene** (`ThcTekster`) er én tekst per nøkkel: de to felles setningene
  og kommentaren for hver situasjon (se [Kommentarene](#kommentarene)). De
  kan inneholde plassholderne `{nivå}`, `{forrige prøvedato}` og
  `{tidligere prøvedato}`, som fylles inn når kommentaren settes sammen.
  Hvilke plassholdere hver tekst må ha og kan ha, står i `THC_TEKSTBOLKER`.
- **Hvilke kommentarer som avsluttes med spørsmålsetningen** er en del av
  regelsettet (`med_sporsmalsetning`), ikke en plassholder, fordi
  plassholderne i en kommentar aldri kan endres.

Motoren tar imot begge, satt sammen og kontrollert, som en `ThcModell` fra
`lagThcModell`.

I databasen er hver tekst en kommentar (objekttypen `kommentar`, se
`docs/faginnhold.md`), og regelsettet sier hvilken kommentar hver tekst bruker
(`tekstbolker`). `thcTeksterFra` slår tekstene opp i kommentarene.

## Kommentarene

Ordlyden er Peders (12.10.2026). Hver kommentar er introsetningen, så
kommentaren for situasjonen, og spørsmålsetningen sist der det er huket av
for den, bundet sammen med ett mellomrom (`settSammen`).

| Nøkkel | Hva |
| --- | --- |
| `introsetning` | «THC-syre, et omdannelsesprodukt av cannabis, er påvist i {nivå} konsentrasjon.» Først i alle |
| `sporsmalsetning` | «Ved spørsmål kan rekvirenten kontakte vakthavende lege …» Sist i dem som skal ha den |
| `uten_forrige` | Ikke vurdert mot tidligere prøve |
| `ikke_nodvendigvis` | Ikke nødvendigvis nytt |
| `vanskelig` | Kan ikke fastslås (spørsmålsetning) |
| `nytt_inntak` | Nytt inntak |
| `samlet_vurdering` | Kan ikke fastslås, men en enda tidligere prøve gir nytt inntak (spørsmålsetning) |
| `under_cutoff_ikke_nodvendigvis` | Ikke nødvendigvis nytt når forrige prøve var under cut-off (spørsmålsetning) |
| `kort_tid` | Kort tid mellom prøvene (spørsmålsetning) |

De fire første situasjonene har to kommentarer: én for nivåene som tyder på
nylig inntak (`_nylig`, i dag «høy») og én for de øvrige. Hvilken som
brukes, avgjøres av flagget på nivået, ikke av navnet, så det holder også om
nivåene endres. «Kan ikke fastslås» og «Ikke nødvendigvis nytt» har i dag den
samme ordlyden for alle nivåer, men kan skilles. Forrige prøve under cut-off
gir egen kommentar bare for «ikke nødvendigvis nytt»; ellers er kommentaren
den samme som uten cut-off.

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
| Kort tid | Færre døgn mellom prøvene enn dette gir avkryssingen for kort tid | Helt tall ≥ 1 |
| Spørsmålsetningen | Kommentarene som avsluttes med den | Kjente kommentarer, hver én gang, i fast rekkefølge |

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
tekst.

Delene har egne tabeller med kontroller på hver kolonne: `thc_regelsett`
(enkeltverdiene), `thc_kurver`, `thc_sikkerhetsmarginer`,
`thc_konsentrasjonsnivaer`, `thc_bruksmonstre` og `thc_tekstbolker`, som
bare peker på kommentarer. Tallene er `float8`, som i motoren.

**Kontrollen på serveren.** `intern.skriv_thc_regelsett` er veien alt som
lagres og publiseres går gjennom, og avviser det `validerThcRegelsett`
avviser: z mot AS 241, skillepunktene, grensene per bruksmønster og kurvenes
rekkefølge — avgjort for hele domenet med den samme fremgangsmåten som
`thcKurver.ts`, og med de samme meldingene. En tekst må peke på en kommentar
med plassholderne teksten krever, og ingen den ikke kan bruke
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
   dem. Reglene og tekstene var lik `thc-regelsett-import.json` og
   `thc-tekster-import.json`.
4. `*_thc_nye_kommentarer.sql` (12.10.2026) la inn de 13 nye tekstene som
   publiserte kommentarer («THC-syre: Introsetning» osv.), med grensen for
   kort tid og spørsmålsetningen i regelsettet, og publiserte en ny revisjon
   som peker på dem. Reglene ellers er uendret. Har regelsettet et utkast
   som ikke er publisert, stopper migrasjonen uten å endre noe. De gamle
   kommentarene står igjen, med sin historikk, men brukes ikke.

Revisjonene fra før de nye kommentarene har tekstene i seg eller peker på de
gamle. Gjenopprettes en av dem, får regelsettet reglene derfra og beholder
kommentarene, grensen for kort tid og spørsmålsetningen det har nå; tekstene
har sin egen historikk.

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
`docs/fortolkningsregler.md`) har seksjonen med oversikten over reglene,
detaljkortet «Kommentarene» med de felles setningene og hver situasjon, når
den brukes og kommentaren ferdig satt sammen for hver gruppe av nivåer
(`Thckommentarer`), og detaljkortet `simulator`. Simulatoren bruker det
samme skjemaet, den samme kommentaren og de samme kurvene som modulen, og
viser hvilke tekster kommentaren ble satt sammen av. Det er utkastet som
vises.

Seksjonen er bygd som konsentrasjonsreglene og scenarioreglene
(arbeidspakke 13): «Rediger reglene» i hodet, og under reglene «Sist
redigert» med historikken, hva som ikke er publisert, og detaljkortet
«Historikken for hver kommentar» (`Regelhistorikk`). Historikken og
sammenligningene deler reglene i de samme feltene som redigeringen
(`thcfelter`: «Nivå 2: Fra og med (IRCAK)», «Den gule kurven: k1»,
«Felles setninger: Introsetning», «Kommentarene: Kort tid mellom prøvene:
avsluttes med spørsmålsetningen» …), med tallene helt ned til siste siffer, og
«Ikke publisert» nevner feltene som er endret.

Seksjonen viser og redigerer bare. Modellen den viser og simulerer med, er
den samme som modulen fortolker med, og `thcseksjonsparitet.test.tsx` holder
det slik (se [Fasiten](#fasiten)).

## Redigeringen

Seksjonen har «Rediger reglene». Hvert tall har sitt eget
felt, andelene som prosent, og et felt som ikke røres, beholder tallet helt
ned til siste siffer. Utskillelseskurvene (a1, k1, a2, k2 og navnet) og
konverteringsfaktoren er låst (Peder, 07.10.2026): skjemaet viser dem uten
felt, og lagringen tar dem alltid fra det som er lagret (`THC_LASTE_DELER`,
`medLasteDeler`). Databasen håndhever det også: `intern.skriv_thc_regelsett`,
som all lagring, gjenoppretting og publisering går gjennom, avviser kurver
og en konverteringsfaktor som er forskjellige fra det publiserte
regelsettet. En eldre revisjon eller et utkast med andre kurver kan derfor
verken gjenopprettes eller publiseres. Skal de endres, gjøres det i koden,
med en migrasjon og en ny fasit; migrasjonen slår av kontrollen for sin egen
transaksjon med `select set_config('far.endre_thc_laste_deler', 'ja', true)`.
Valideringen står i `intern.skriv_thc_regelsett_innhold`. Nivåer og marginer kan legges til og fjernes; z for en
ny margin regnes ut av marginen. Tekstene redigeres i to grupper
(`Thckommentarredigering`): «Felles setninger», og «Kommentarene» med én
boks per situasjon, der hver kommentar har tekstfeltet, avkryssingen
«Avslutt med spørsmålsetningen» og «Slik blir den:» — kommentaren ferdig
satt sammen med eksempeldatoer, oppdatert mens det skrives.

`thcUtkastfeil` samler feilene mens det skrives — `validerThcRegelsett`,
`validerThcTekst` og plassholderne kommentaren har fra før, som ikke kan
endres — og utkastet kan ikke lagres før de er rettet. Så lenge det er
gyldig, fortolker simulatoren under med utkastet slik det står.

`thcEndringer` avgjør hva som lagres: hver kommentar med endret tekst, og
regelsettet når reglene er endret. Tekstene peker på de samme kommentarene
som før. Alt lagres i én transaksjon med `lagre_thc_regelsett`, hvert
objekt mot revisjonen som ble åpnet, også regelsettet når bare en tekst er
endret. Har noen andre lagret i mellomtiden, blir det
en konflikt som i de andre regelredigeringene (`Lagringskonflikt`):
ingenting er skrevet over, brukeren kan sammenligne sitt med det de lagret,
felt for felt, og velge å forkaste sitt eller lagre over deres. Da lagres
det som er forskjellig fra deres, mot revisjonene deres
(`lagreThcUtkast`). Ved en konflikt er ingenting lagret, så «Forkast mine
endringer» forkaster hele redigeringen; siden sier også fra, med «Hent
nyeste utgave».
Publiseringsplanen tar de endrede kommentarene før
regelsettet, som databasen krever.

## Fasiten

Motoren er skrevet slik at regnestykkene skjer i nøyaktig samme rekkefølge som
i den opprinnelige modulen, og gir samme resultat helt ned til siste siffer.
Kommentarene fikk ny ordlyd 12.10.2026; fasiten ble da laget på nytt med
konklusjonene fra den opprinnelige modulen og kommentarene fra
`thcKommentarfasit.ts`, og kontrollert mot den gamle: alt annet enn
kommentarteksten er det samme, også summen over tallgrunnlaget. Testene som
holder det slik:

- `thcMotor.test.ts` kjører motoren med de publiserte reglene og tekstene over
  hele fasiten. Den krever samme kommentar tegn for tegn, samme konklusjon,
  samme varsel og samme mangler for hvert tilfelle, og samme SHA-256 over alt
  tallgrunnlaget og et utvalg figurer. Tilfellene ligger rett på, rett under
  og rett over hver kurvegrense (nabo-flyttallene) og skillepunktene mellom
  nivåene. De dekker også IRCAK 0, under cut-off, ingen tidligere prøve,
  varselgrensen og ugyldige felt. Beskrivelsen står i `hjelp/thcFasit.ts`.
- `thcParitet.test.ts` kjører den opprinnelige modulen og motoren side om
  side på 20 000 tilfeldige inndata, og sammenligner konklusjonen, og
  kommentaren mot kommentarfasiten, for hver kombinasjon av nivå, utfall og
  under cut-off. Samlet vurdering og kort tid er prøvd for seg i
  `thcMotor.test.ts`.
- `fortolkningUendret.test.ts` holder alle kommentarene motoren kan gi med de
  publiserte tekstene, og konklusjonen for et rutenett av endringer, fast med
  SHA-256.
- `thcRegelsettlagring.test.ts` leser regelsettet slik appen gjør, fra en
  database bygd av migrasjonene, og krever nøyaktig den modellen fasiten er
  laget med.
- `thcseksjonsparitet.test.tsx` holder at seksjonen og redigeringen bruker
  nøyaktig den samme modellen som modulen, at den gir fasiten i hvert
  tilfelle med de samme tallene og figurene, og at modulen, simulatoren i
  seksjonen og simulatoren i redigeringen viser den samme kommentaren,
  varselet og manglene som fasiten for ett tilfelle av hvert utfall.

Fasiten lages bare på nytt når den kliniske outputen endres med vilje, i samme
PR som endringen, og da med merket «Fag» i endringsloggen.
