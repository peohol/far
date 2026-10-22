# Kuratorprotokollen

Leses av monografikuratoren (Claude Code) ved hver kuratering av en fagside,
og av kontrolløren (Claude-monografikontrolløren eller en administrator) for å
vite hva som skal kontrolleres. Dette er den ene, versjonsstyrte faglige
kilden for hvordan en fagside kurateres. Kuratorskillen
(`.claude/skills/monografikurator/SKILL.md`), kontrollørskillen
(`.claude/skills/monografikontrollor/SKILL.md`), instruksen for køen
(`docs/kurateringsko-instruks.md`) og kontrollørinstruksen
(`docs/kontrollorinstruks.md`) viser hit og gjentar den ikke. Hvordan kurator
og kontrollør holdes atskilt, står i `docs/kuratering-prosjekt.md`. Protokollen
endres bare i en PR, og et krav svekkes aldri uten at det står i loggen
nederst hvorfor.

Hvordan grenene virker teknisk, står i `docs/kurateringsgrener.md`; formen på
sidene og kortene i `docs/faginnhold.md` og `docs/seksjoner.md`; SPC-
bivirkningene i `docs/bivirkninger.md`; kuratorjobbene i `docs/kuratorjobber.md`.

## Rollene

| Rolle | Hvem | Gjør | Gjør aldri |
| --- | --- | --- | --- |
| Kurator | `claude-monografkurator` | Kildesøket, kildevurderingen, teksten, strukturen, dokumentene, svarene på kommentarene, og publiseringen etter godkjenning | Godkjenner eget arbeid, lukker en sperrende tråd, eller publiserer uten godkjenning |
| Kontrollør | `claude-monografikontrollor`, eller en administrator (`chatgpt-monografkurator` er slått av fra 2026-10-19) | En uavhengig, adversarial kontroll av nøyaktig én revisjon, med egne oppslag i kildene | Skriver i grenen eller godkjenner en revisjon med åpne sperrende tråder |
| Administrator | Folk med rollen admin | Stanser, gjenopptar og forkaster; kan kontrollere, godkjenne og publisere | |

Databasen håndhever rollene: en agent kan ikke godkjenne en gren den selv
kuraterer, en sperrende tråd lukkes bare av den som åpnet den (eller en
administrator), og en godkjenning gjelder nøyaktig én revisjon og
fingeravtrykket av den.

## De ufravikelige kravene

Hvert krav kontrolleres i selvtesten og av kontrolløren.

1. **Kildetroskap mot preparatomtalen.** Gjeldende norske preparatomtaler
   (de originale PDF-ene fra DMP, hentet med kuratorjobben) er primærkilden
   for indikasjon, dosering, farmakokinetikk, sikkerhet og bivirkningstabellen
   i punkt 4.8. Tabellene leses i original layout (sidebildene), ikke bare i
   tekstuttrekket.
2. **Bivirkningene fra preparatomtalene importeres kildetro.** Hver
   preparatomtale importeres for seg med sin egen kildenøkkel, og slås aldri
   sammen til én kunstig frekvenskatalog. Ingen frekvens anslås eller kodes
   om, og originalteksten normaliseres ikke språklig. En sannsynlig feil i en
   kilde rettes ikke i importen; den forklares i et redaksjonelt kort med
   begge kildene som referanser.
3. **Beskyttede norske data står.** De norske referanseområdene, toksiske
   grensene og grensene for alvorlig forgiftning, og de norske dose–serum-
   tabellene med originalkildene, beholdes. De erstattes aldri av
   internasjonale områder (som AGNP), som har en annen populasjon, et annet
   formål og en annen metode. Tyder en kilde på at en slik verdi er feil,
   stopper kuratoren og blokkerer stoffet i køen (`blokkert`) med en kort,
   teknisk grunn; detaljene står i en tråd i grenen. Et menneske avgjør, og
   avgjørelsen føres inn i tråden (fase 9).
4. **Påstand og kilde henger sammen på det smaleste nivået som gjør det
   entydig.** En lengre eller kildeheterogen tekst får inline-siteringer ved
   hver påstand; en regulatorisk påstand og en klinisk påstand som bygger på
   ulike kilder, får hver sin. Et kort, kildehomogent kort kan ha kildene på
   kortet. Panelets kilder er aldri et oppsamlingssted for en lengre tekst.
5. **Ingenting finnes på.** Ingen verdi, frekvens eller anbefaling uten en
   kilde som sier det. Et område uten relevant dokumentasjon står tomt, og
   dekningsmatrisen sier hva det ble søkt etter (`tomt_begrunnet`). Ingen
   standardtekst for å fylle en seksjon.
6. **Konflikter synliggjøres og glattes aldri over.** Sier to kilder noe
   ulikt (to preparatomtaler, en regulatorisk og en klinisk kilde, en eldre og
   en nyere retningslinje), står det i teksten hvem som sier hva, og i
   evidensjournalen hvorfor teksten bygger på den den bygger på.
7. **Evidensstyrken står.** Hver sentral påstand har grunnlaget og en
   vurdering av evidensstyrken i evidensjournalen; teksten overdriver ikke det
   kildene bærer (effektstørrelser, absolutte risikoer og begrensninger står
   der de trengs).
8. **De automatiske lagene dupliseres ikke.** FEST (preparatene og
   interaksjonene), ClinPGx og CPIC, PubChem, Farmakologiportalen og de
   strukturerte bivirkningene vises av appen selv. De kopieres ikke inn i
   teksten, men kontrolleres produksjonsnært med funksjonstesten. En kontroll
   funksjonstesten ikke dekker, står som gjenstående i evidensjournalen og
   kvitteres aldri ut som bestått.
9. **Seksjonene med faste kort følger reglene** i `docs/monografkuratering.md`
   («Seksjonene med faste kort»): et kort bare når det er relevant
   dokumentasjon, «Fenomenologi» bare for psykoaktive stoffer, behandlingen
   ved forgiftning er stoffspesifikk, og tallene i viktige data flyttes eller
   dupliseres ikke.
10. **Kunnskapsgrensen er en dato.** Kildesøket gjelder til en bestemt dato,
    som står i evidensjournalen og meldes til køen. Nye kilder etter den
    inngår ikke.
11. **Repoet er offentlig.** Fagtekst, utdrag, evidensjournal og annet bak
    innloggingen står bare i grenen i OUSFAR (dokumentene og trådene). Det som
    skrives i repoet, i køen (`fase`, `grunn`) eller i loggene i GitHub
    Actions, er korte, tekniske beskrivelser.

## Arbeidsflyten

Kommandoene står i kuratorskillen. Hver fase avsluttes med en lagring i
grenen, så en avbrutt kuratering kan fortsettes av en ny økt der den slapp
(køen gir den samme grenen tilbake, se `docs/kurateringsko-instruks.md`).
Kuratoren melder hva den gjør med `aktivitet` (med seksjonen og kortet), så
«Følg agenten» viser det.

1. **Modellkartleggingen.** Kontrollpunktene utledes av appens levende
   innholdsmodell (`npm run kurator -- tom-dekning <modus>`): hvert panel,
   hvert datakort i viktige data og hvert faste kort. Det er dekningsmatrisen
   som skal fylles. En kildeplan (`kildeplan`) sier hvilke domener og kilder
   som skal søkes for stoffet.
2. **Det blinde kildesøket** (de novo). Grenen er i blindfasen og viser bare
   oppbygningen av siden, ikke fagteksten. Kuratoren søker selvstendig i hvert
   domene under, vurderer kildene og skriver hovedkonklusjonene i
   blindprotokollen (`blindprotokoll`) før noe av det eksisterende innholdet
   åpnes.
   Domenene: regulatorisk (preparatomtalene), effekt per indikasjon,
   farmakodynamikk, farmakokinetikk, farmakogenetikk, TDM og
   konsentrasjon–utfall, toksisitet og forgiftning, graviditet, amming og
   fertilitet, avhengighet, toleranse og seponering, og kontroll av de
   automatiske lagene.
3. **Den adversariale kontrollen.** Hovedkonklusjonene prøves mot de
   kildene som kan tale imot: observasjonsdata mot metaanalyser, en
   regulatorisk forsiktighetsformulering mot en klinisk vurdering, eldre mot
   nyere retningslinjer, internasjonale mot norske områder. Resultatet står i
   blindprotokollen. Så avsluttes blindfasen (`avslutt_blindfase`), og
   blindprotokollen kan ikke endres etterpå.
4. **Avstemmingen.** Det eksisterende innholdet leses og sammenlignes påstand
   for påstand med blindprotokollen. Hvert kort blir bekreftet, forbedret,
   beholdt etter ny vurdering, eller tatt ut av visningen (`fjern`; historikken
   står). Det som er beholdt etter ny vurdering, sier evidensjournalen hvorfor.
5. **Preparatomtalene og funksjonstesten.** Kuratorjobbene på `jobbgren` gir
   de originale preparatomtalene og funksjonstesten av siden slik en vanlig
   bruker ser den. Tabellene i punkt 4.8 leses i sidebildene, og
   bivirkningsimportene lages etter `docs/bivirkninger.md`.
6. **Skrivingen.** Endringene lagres i grenen med `skriv`, med rapporten til
   endringsloggen (`docs/innholdsendringer.md`). Prøvepubliseringen må bestå,
   og rapporten stemme med endringene, før grenen kan sendes til kontroll.
   Forhåndsvisningen er siden nøyaktig slik den blir publisert.
7. **Dokumentene.** `evidensjournal`, `dekningsmatrise` og `selvtest` (og
   `blindprotokoll` for de novo) lagres i grenen med `dokument`. Dekningen
   kontrolleres med `npm run kurator -- dekning-gren <gren>`.
8. **Til kontroll.** `til_kontroll` for den siste revisjonen, så `fullfort` i
   køen med grenen.
9. **Kontrollrundene.** Ber kontrolløren om endringer, svarer kuratoren i hver
   tråd (`kommenter` med `svar_pa`): hva som er gjort, og i hvilken revisjon,
   eller hvorfor ikke, med kilden. Rettingene lagres som en ny revisjon,
   dokumentene oppdateres, og grenen sendes til kontroll igjen. Er det ikke
   noe å rette (kontrolløren var ikke ferdig, eller kildene viser at
   innvendingen ikke holder), lages ingen ny revisjon: kuratoren svarer i
   trådene eller i en merknad og sender den samme revisjonen til en ny
   kontrollrunde (`til_kontroll`). Kuratoren kan foreslå at en tråd er løst,
   men lukker aldri en sperrende tråd selv. En avgjørelse fra fagansvarlig
   (krav 3, eller noe annet bare et menneske kan avgjøre) føres inn i tråden
   saken står i, eller i en ny merknad, med en kommentar som begynner med
   «Avgjort av fagansvarlig:», hva som er avgjort, og revisjonen grenen
   følger den i. Kontrolløren holder seg til en slik avgjørelse
   (`docs/kontrollorinstruks.md`). Merkingen brukes bare for en avgjørelse et
   menneske faktisk har gitt.
   En merknad som begynner med «Kontrollørens funn, gitt videre av
   fagansvarlig:», er funn fra ChatGPT-kontrolløren som kuratoren førte inn i
   det tidligere oppsettet. Den besvares som en tråd fra kontrolløren, og
   publiserer ingenting.
10. **Publiseringen.** Når den siste revisjonen er godkjent og ingenting
    hindrer det, publiserer kuratoren (`publiser`). Etterpå kjøres
    funksjonstesten mot den publiserte siden, og det som gjensto, står i
    evidensjournalen.

## Dokumentene

Dokumentene er JSON i grenen, bak innloggingen. Formen under er det
kontrolløren forventer; felt kan legges til.

**`evidensjournal`**

```json
{
  "modus": "de_novo",
  "kunnskapsgrense": "ÅÅÅÅ-MM-DD",
  "kuratorjobber": ["kuratorjobb/<oppgave>"],
  "hovedkilder": [{ "omrade": "…", "kilde": "…, DOI/PMID/URL", "kontrollert": "ÅÅÅÅ-MM-DD", "merknad": "…" }],
  "sok": [{ "domene": "…", "hva": "søkene og databasene", "funn": "…" }],
  "pastander": [{ "pastand": "…", "grunnlag": "…", "evidensstyrke": "høy | moderat | lav" }],
  "avstemming": { "bekreftet": ["…"], "forbedret": ["…"], "beholdt_etter_vurdering": ["…"], "tatt_ut": ["…"] },
  "konflikter": ["Hvem sier hva, og hva teksten bygger på"],
  "hull": ["Det som mangler dokumentasjon"],
  "kvalitetsporter": [{ "port": "…", "status": "bestatt | ikke_bestatt | gjenstar", "bevis": "…" }],
  "gjenstaende_kontroller": ["Det som ikke er kontrollert, og hvorfor"],
  "neste_overvaking": ["Hva som bør utløse en ny kontroll"]
}
```

`kuratorjobber` er grenene i repoet med kuratorjobbene preparatomtalene og
funksjonstesten kommer fra (`docs/kuratorjobber.md`), så kontrolløren finner
de samme filene.

**`dekningsmatrise`**: `{modus, modell_sha256, omrader}`, ett område per
kontrollpunkt, med `nokkel`, `status`, `begrunnelse`, `kilder`, `sok`,
`artefakt` og `bevis` (`src/kuratorprotokoll/dekning.ts`). Statusene:

| Status | Når | Krever |
| --- | --- | --- |
| `nytt_eller_oppdatert` | Kuratoren har skrevet eller endret det | Kilder og bevis |
| `beholdt_etter_kontroll` | Det står som før etter en selvstendig kontroll | Kilder og bevis |
| `automatisk_verifisert` | Et automatisk lag, kontrollert produksjonsnært | Begrunnelse |
| `tomt_begrunnet` | Ingen relevant dokumentasjon finnes | Hva det ble søkt etter |

`modell_sha256` er fingeravtrykket av kontrollpunktene; endres modellen, må
matrisen lages på nytt. Kontrollen bekrefter dekningen, ikke faglig sannhet:
tallene og påstandene leses mot kildene uansett.

**`blindprotokoll`** (de novo): kontrollpunktene, kildene per domene og
hovedkonklusjonene før avstemmingen, og den adversariale kontrollen.

```json
{
  "kontrollpunkter": ["…"],
  "kilder": [{ "domene": "…", "kilde": "…, DOI/PMID/URL" }],
  "konklusjoner": ["…"],
  "adversarial": "Hva som ble prøvd mot konklusjonene, og hva det ga"
}
```

**`selvtest`**: hvert av de ufravikelige kravene og hver av de tekniske
portene nøyaktig én gang, med den faste nøkkelen, status og beviset. Malen
lages med `npm run kurator -- tom-selvtest` (`src/kuratorprotokoll/selvtest.ts`).
Kravene er, i rekkefølgen over: `kildetroskap_preparatomtale`,
`bivirkninger_kildetro`, `beskyttede_norske_data`, `pastand_og_kilde`,
`ingenting_finnes_pa`, `konflikter_synliggjort`, `evidensstyrke`,
`automatiske_lag`, `faste_kort`, `kunnskapsgrense` og `offentlig_repo`. Portene
er `provepublisering`, `rapport`, `dekning` og `funksjonstest`. Alt må være
`bestatt`; bare de to kravene om preparatomtalene kan være `ikke_relevant`, for
et stoff uten norsk preparatomtale, og beviset sier da hvorfor. Kuratoren
sender ikke grenen til kontroll med et krav eller en port som ikke er bestått
eller gjenstår: det rettes først, eller stoffet blokkeres for et menneske.

```json
{
  "krav": [{ "krav": "kildetroskap_preparatomtale", "status": "bestatt | ikke_relevant", "bevis": "…" }],
  "porter": [{ "port": "provepublisering", "status": "bestatt", "bevis": "…" }]
}
```

Databasen stopper `avslutt_blindfase` og `til_kontroll` når et av dokumentene
mangler disse feltene, har tomme oppføringer, eller ikke dekker hvert
kontrollpunkt (dekningsmatrisen) eller hvert krav og hver port (selvtesten)
nøyaktig én gang med belegg; i selvtesten stopper også alt som ikke er bestått
(`kuratering.dokumentfeil`). Fingeravtrykket `modell_sha256` kontrolleres av
`npm run kurator -- dekning-gren`. Kontrollen hindrer at portene omgås med
plassholdere; den erstatter ikke fagkontrollen.

## Erfaringer fra kontrollen

Funn kontrolløren har gjort som kan gå igjen i andre stoffer. Kuratoren unngår
dem i nye kurateringer. Finner kontrolløren et nytt slikt funn, ser kuratoren
etter det samme i grenene som venter på kontroll, og retter det der før
kontrolløren kommer dit. Reglene presiserer kravene over; de erstatter dem ikke.

- **Retningslinjer med flere utgaver** (krav 6): hvert tall, område,
  varslingsnivå og anbefalingsnivå får årstallet for utgaven det kommer fra, og
  der den nyeste utgaven sier noe annet, vises begge. AGNP-konsensusen for TDM
  finnes i 2017-utgaven (publisert 2018) og 2026-utgaven; i 2026-utgaven står de
  farmakokinetiske parameterne i en tilleggstabell på nett, ikke i
  hovedtabellene.
- **Behandling ved forgiftning** (krav 6 og 9): Giftinformasjonens
  behandlingsanbefaling på helsebiblioteket.no, også gruppesiden når den nevner
  stoffet, er den norske kliniske kilden for dose, observasjonstid og
  behandling, med året den sist er vurdert. Et råd i preparatomtalen (pkt. 4.9)
  som avviker, tilskrives preparatomtalen og står ved siden av, med konflikten i
  evidensjournalen. Finnes ingen side, står adressen som ble prøvd i
  evidensjournalen.
- **Aldersgrenser:** norske preparatomtaler skriver ofte «over 13 år» der den
  engelske teksten har «13 years and above». Teksten sier «fra 13 år» og viser
  den norske ordlyden, og grensen rettes i alle kortene der den står.
- **Påstander om at noe mangler** (krav 5) gjelder det som er søkt, og det står
  hvilke kilder som er søkt (også LactMed og Giftinformasjonen).
  Ammingskortet skiller «ingen mistenkte bivirkninger» fra plager som er
  rapportert hos barnet.
- **Nøkkeltallene i viktige data** (også tid til steady state og
  halveringstiden) endres ikke uten en avgjørelse fra fagansvarlig, selv om
  preparatomtalen sier noe annet. Et nytt nøkkeltallskort der grunnversjonen
  ikke har noe, legges heller ikke inn uten en slik avgjørelse; tallene står
  med kilde i farmakokinetikkortene (t½, tₛₛ). Et nytt referanseområde eller en ny grense
  fra et forslag eller en enkelt studie legges ikke inn før et menneske har
  avgjort det. Kortet viser hvem som sier hva, og saken går som etter krav 3.
- **AGNPs varslingsgrense** er laboratoriets alarmgrense, ikke en dokumentert
  toksisk terskel, og omtales slik.
- **En referanse fjernes** fra kortet eller panelet når innholdet den støttet,
  er tatt ut (krav 4).
- **Dokumentene følger avgjørelsene:** en avgjørelse fra fagansvarlig føres inn
  i evidensjournalen, dekningsmatrisen, selvtesten og rapporten, og alt som sier
  at saken venter, fjernes. Selvtesten kvitterer aldri ut det evidensjournalen
  sier er ukontrollert (krav 8).

## Kontrollen

Kontrolløren følger `docs/kontrollorinstruks.md`: uavhengig av kuratoren slår
den først opp de sentrale påstandene i kildene selv, og leser kuratorens
begrunnelser etterpå. Den kontrollerer de ufravikelige kravene med egne
oppslag (særlig tallene, preparatomtalene og de beskyttede norske dataene), åpner en sperrende tråd festet til kortet og
feltet for hver endring som må gjøres og en merknad for et forslag, og
godkjenner bare når ingen sperrende tråd står åpen og kravene er oppfylt.
Godkjenningen sier hva som er kontrollert.

## Bakgrunnen og loggen

Protokollen er overført fra ChatGPT-monografikuratorens arbeid (de novo-
piloten for citalopram 2026-10-13 og evidensjournalene i
`docs/kurateringsjournal/`), `docs/monografkuratering.md` og
`docs/bivirkninger.md`, og tilpasset kurateringsgrenene. Kontrollpunktene
var de 37 piloten dekket; siden har modellen fått «Fenomenologi» i
«Virkninger» (2026-10-22), så de er 38 (testen `kuratorprotokoll.test.ts`
holder dem i takt med modellen og piloten).

- 2026-10-16: første versjon (fase E2 i `docs/kurateringsgrener-fremdrift.md`).
  Den opprinnelige teksten i ChatGPT-kuratorskillen står ikke i repoet; når
  den finnes, sammenlignes den med protokollen, og det strengeste kravet
  gjelder.
- 2026-10-17: «Erfaringer fra kontrollen», fra kontrollørens funn i piloten og
  de novo-runde 2. Ingen krav er svekket. Nøkkeltallene i viktige data
  behandles som beskyttede, slik kontrolløren og fagansvarlig allerede har gjort
  i flere grener.
- 2026-10-19: kontrolløren er en egen Claude-agent i et eget prosjekt
  (`docs/kuratering-prosjekt.md`), og ChatGPT-kontrolløren er slått av.
  Kontrolløren slår opp de sentrale påstandene selv før den leser kuratorens
  begrunnelser. Ordningen der fagansvarlig ga videre en melding fra
  kontrolløren, gjelder ikke lenger, siden kontrolløren skriver i grenen selv.
  Ingen krav er svekket.
