# Kurateringsgrener

Leses av den som arbeider i, kontrollerer eller bygger videre på
kurateringsgrenene. Bakgrunnen står i `docs/kurateringsgrener-visjon.md`, og
valgene og fremdriften i `docs/kurateringsgrener-fremdrift.md`.

En kurateringsgren er en isolert arbeidsversjon av én fagside. Den bygger på
en hel sideversjon (`public.sideversjoner`, se `docs/faginnhold.md`), og
ingenting i den er synlig på den publiserte siden eller i noens utkast før hele
grenen publiseres samlet, etter en uavhengig faglig godkjenning av nøyaktig den
revisjonen og en bestått prøvepublisering. Høyst én gren er aktiv per side.

## Hvem som gjør hva

| Hvem | Kan |
| --- | --- |
| Kuratoren (agent med rollen `kurator`, i dag Claude) | åpne en gren, skrive i sin egen gren, lagre arbeidsdokumenter, melde aktivitet, sende til kontroll, oppdatere til ny grunnversjon, publisere etter godkjenning, forkaste sin egen gren |
| Kontrolløren (agent med rollen `kontrollor`, i dag ChatGPT) | lese alle grener, vurdere en revisjon: `godkjent` eller `endringer` |
| Administratorene | lese, vurdere, publisere, stanse, gjenoppta og forkaste; gi agentene nøkler |
| Andre brukere | ingenting; grenene er usynlige for dem |

En agent vurderer aldri en gren den selv kuraterer, og ingen mennesker skriver
i en aktiv gren. Agentene er i `kuratering.agenter`; nøkkelen lagres bare som
SHA-256 og vises én gang når en administrator lager den (`ny_agentnokkel`).

## Inngangene

Alt går gjennom to funksjoner. Skjemaet `kuratering` er stengt for API-rollene.

- `public.kuratering_agent(nokkel, handling, data)` — agentene, bare gjennom
  serveren (tjenesterollen), med agentens nøkkel.
- `public.kuratering_admin(handling, data)` — administratorene, fra appen.

`data` er et JSON-objekt. Svaret er JSON. Feilene har SQLSTATE: `42501`
(rolle eller nøkkel), `22023` (ugyldig eller ikke tillatt nå), `PT404`
(finnes ikke), `PT409` (konflikt: feil revisjon, eller siden er publisert på
nytt).

| Handling | Hvem | `data` |
| --- | --- | --- |
| `oversikt` | alle | `{stoff?, alle?}` |
| `apne` | kurator | `{stoff, formaal, art?: "kuratering" \| "de_novo"}` |
| `les` | kurator (egen), kontrollør, admin | `{gren, revisjon?}` |
| `status` | kurator (egen), kontrollør, admin | `{gren}`: status, revisjon, runde, aktiviteten, når kuratoren sist kalte inn, antallet åpne sperrende tråder og `endring` (den siste hendelsen utenom aktiviteten); ingen fagtekst |
| `skriv` | kurator | `{gren, forventet_revisjon, endringer, melding?}` |
| `aktivitet` | kurator | `{gren, tekst, seksjon?, objekt?}` |
| `dokument` | kurator | `{gren, art, innhold}` |
| `les_dokument` | kurator (egen), kontrollør, admin | `{gren, art, versjon?}` |
| `avslutt_blindfase` | kurator | `{gren}` |
| `til_kontroll` / `trekk_fra_kontroll` | kurator | `{gren, revisjon}` (den siste; fra `tilbakemelding` også uten en ny revisjon, se [Statusene](#statusene)) / `{gren}` |
| `vurder` | kontrollør, admin | `{gren, revisjon, beslutning, begrunnelse}`; begrunnelsen kreves også ved `godkjent` (hva som er kontrollert) |
| `oppdater_grunnlag` | kurator | `{gren}` |
| `publiser` | kurator (egen), admin | `{gren, revisjon}` |
| `stans` / `gjenoppta` | admin | `{gren, grunn?}` / `{gren}` |
| `forkast` | kurator (egen), admin | `{gren, grunn?}` |
| `agenter` / `ny_agentnokkel` | admin | `{}` / `{agent}` |
| `gjenopprett_versjon` | admin | `{stoff, nr, grunn?}` |
| `kommentarer` | kurator (egen), kontrollør, admin | `{gren, apne?}` |
| `kommenter` | kurator (egen), kontrollør, admin | `{gren, tekst, art?: "merknad" \| "sperrende", anker?, klient_id?}` eller `{gren, tekst, svar_pa, klient_id?}`; svarer `{id, traad, kl, lagret: true}` (se [Kommentarene](#kommentarene)) |
| `lukk_kommentar` | se [Kommentarene](#kommentarene) | `{gren, kommentar, tekst?}` |
| `gjenapne_kommentar` | kontrollør, admin | `{gren, kommentar, tekst}` |

Handlingene og hvem som har dem, står i `kuratering.handlingsliste`; en ny
handling er en funksjon `kuratering.h_<navn>` og en rad der, og for agentene
et verktøy i `src/kuratering/handlinger.ts` (en test holder dem i takt).

Agentene kaller serveren, som kaller `kuratering_agent` med den hemmelige
nøkkelen (`src/kuratering/endepunkt.ts`); nøkkelen kontrolleres i databasen:

- `POST /api/kuratering` med `Authorization: Bearer <agentnøkkel>` og
  `{"handling": "...", "data": {...}}`. Svarer med JSON, og med
  403/404/409/400 for feilkodene over.
- `POST /api/kuratering-mcp`: de samme handlingene som MCP-verktøy
  (`src/kuratering/handlinger.ts`), for ChatGPT og andre MCP-klienter.
  Nøkkelen i `Authorization: Bearer`, eller i adressen (`?nokkel=`) for en
  klient som ikke kan sende overskrifter. En nøkkel i adressen kan havne i
  Vercels forespørselslogg; lag en ny med `ny_agentnokkel` hvis den kan ha
  kommet på avveie. I tillegg har koblingen verktøyet `instruks`, som gir
  kontrollørinstruksen (`docs/kontrollorinstruks.md`) med kuratorprotokollen
  (`docs/kuratorprotokoll.md`) etter, slik de står i den utlagte versjonen; `initialize` og beskrivelsen av `oversikt` sier at den
  leses først. ChatGPT husker verktøylisten og `initialize` fra da koblingen
  ble lagt til (til noen trykker «Oppdater» på den), men henter hvert svar på
  nytt, så svaret på `oversikt` gjennom MCP har instruksen som første
  tekstelement, foran svaret fra databasen (`structuredContent` er det samme
  som før). Filene er den eneste kilden: de tas med i funksjonen med
  `includeFiles` i `vercel.json` og leses derfra, uten databasen. Mangler
  protokollen, gis instruksen med beskjed om hvor protokollen står. `instruks`
  tar ingen argumenter og gir ikke noe annet, og er ingen handling i
  databasen eller i `/api/kuratering`. Flyttes en av filene, følger
  `INSTRUKSFILER` i `endepunkt.ts` og `vercel.json` med (en test holder dem i
  takt).
- `POST /api/kuratering-ko`: grenene uten fagtekst (`public.kuratering_kostatus`),
  bare for kurateringskøen, med GitHubs OIDC-token for arbeidsflyten på `main`
  (`docs/kurateringsko.md`), og for administratorene.

Kuratoren (Claude Code) kaller med `npm run kurator -- kall <handling>`
(`scripts/kurator.ts`, `docs/kuratorprotokoll.md`); kontrolløren (ChatGPT)
gjennom MCP (`docs/kontrollorinstruks.md`).

## Endringene

`skriv` tar en liste med endringer, i rekkefølge, og gir en ny revisjon av
grenen. Innholdet har samme form som revisjonene (`docs/faginnhold.md`).

| Endring | Virkning |
| --- | --- |
| `{"sett": id, "innhold": {...}}` | Endrer siden (navnet og nøkkelen står fast), et kort på siden, eller noe nytt i grenen |
| `{"ny": "innholdselement" \| "referanse", "id"?: uuid, "innhold": {...}}` | Et nytt kort på siden eller en ny referanse (med lenke som ikke finnes fra før) |
| `{"fjern": id}` | Fjerner et kort (panelet blir `fjernet`), eller noe nytt i grenen |
| `{"tilbakestill": id}` | Objektet står som i grunnversjonen |
| `{"bivirkninger": {"importer": [...], "trekk": [{"nokkel", "begrunnelse"}]}}` | Bivirkningsimportene (`supabase/maler/bivirkningsimport.json`) og tilbaketrekkingene som legges inn ved publiseringen |
| `{"rapport": {...}}` | Rapporten til endringsloggen, i samme form som `intern.kuratering_rapport` (`docs/innholdsendringer.md`) |

En referanse som finnes, deles med andre sider og endres aldri i en gren; lag
en ny. Et kort på en annen side kan ikke endres eller flyttes hit.

## Prøvepubliseringen

Hver lagring prøvepubliseres: hele grenen publiseres med alle databasens
kontroller mot produksjonen slik den er, og rulles tilbake. Revisjonen får
resultatet (`teknisk`: `ok`, `feil`, seksjonene som endres, `rapport_ok`) og
forhåndsvisningen: fagsiden og bivirkningene nøyaktig slik de ville blitt
publisert, lest med `les_stoff` og `les_bivirkninger`. En feil stopper ikke
lagringen, men grenen kan ikke sendes til kontroll før prøven og rapporten er
i orden.

## Agentene

| Agent | Rolle | Nøkkelen |
| --- | --- | --- |
| `claude-monografkurator` | kurator | Lagt inn som SHA-256 i migrasjonen `kurateringsagenter`; selve nøkkelen har Claude-øktene i prosjektet, utenfor repoet |
| `chatgpt-monografkurator` | kontrollør | Lages av en administrator i appen |

En administrator ser agentene under «Kurateringer» i administrasjonsmenyen:
rollen, når nøkkelen ble laget og når agenten sist kalte inn. «Lag ny nøkkel»
gir en ny nøkkel og gjør den gamle ugyldig med en gang. Nøkkelen vises bare
den ene gangen, med adressen ChatGPT kobles til (MCP, med nøkkelen i
adressen) og adressen for HTTP, og glemmes når laget lukkes.

## Statusene

| Status | Betyr | Videre |
| --- | --- | --- |
| `arbeid` | Kuratoren arbeider | `til_kontroll` → `klar` |
| `klar` | Revisjonen er låst for kontroll | `vurder` → `godkjent` eller `tilbakemelding`; `trekk_fra_kontroll` |
| `tilbakemelding` | Kontrolløren har bedt om endringer | `skriv` → `retting`; `til_kontroll` → `klar` (ny runde med samme revisjon, når kuratoren har svart på vurderingen) |
| `retting` | Kuratoren retter | `til_kontroll` → `klar` (ny runde) |
| `godkjent` | Nøyaktig denne revisjonen er godkjent | `publiser` → `publisert`; `skriv` → `retting` |
| `blokkert` | Publiseringen stoppet (konflikt eller teknisk feil, grunnen står) | `oppdater_grunnlag` eller `skriv` |
| `stanset` | En administrator har stanset grenen | `gjenoppta` |
| `publisert` / `arkivert` | Avsluttet | |

Før `til_kontroll` må prøven og rapporten bestå, grenen bygge på den siste
sideversjonen, og dokumentene være fylt ut: `evidensjournal`, `dekningsmatrise`
og `selvtest`, og for en de novo-kuratering også `blindprotokoll`.
`kuratering.dokumentfeil` kontrollerer den siste versjonen av hvert mot formen
i `docs/kuratorprotokoll.md` («Dokumentene»): evidensjournalen må ha
kunnskapsgrense, hovedkilder, søk og påstander; dekningsmatrisen hvert
kontrollpunkt nøyaktig én gang (`kuratering.kontrollpunkter()`, de samme som
`src/kuratorprotokoll/dekning.ts`) med status, begrunnelse og belegg; selvtesten
hvert av de ufravikelige kravene (`kuratering.selvtestkrav()`) og hver av de
tekniske portene (`kuratering.selvtestporter()`: prøvepubliseringen, rapporten,
dekningen og funksjonstesten) nøyaktig én gang, med bevis og bestått. Et punkt
som mangler, står flere ganger, er ukjent, `ikke_bestatt` eller `gjenstar`,
stopper grenen; bare kravene om preparatomtalene kan være `ikke_relevant` (et
stoff uten norsk preparatomtale). Tomme plassholdere avvises,
og feilen sier hva som mangler. Kontrollen hindrer at portene omgås, men
erstatter ikke fagkontrollen. En godkjenning
er bundet til revisjonen og fingeravtrykket; en ny lagring eller en ny
grunnversjon opphever den. Dokumentene kan ikke endres mens grenen er til
kontroll eller godkjent, så det som publiseres, er det kontrolløren vurderte.

Har kuratoren ikke noe å rette etter `endringer` (kontrolløren var ikke
ferdig, eller kildene viser at innvendingen ikke holder), sendes den samme
revisjonen fra `tilbakemelding` til en ny runde uten en ny revisjon. Kravene
over gjelder som ellers, og i tillegg må kuratoren ha svart på vurderingen:
minst én kommentar i grenen (et svar i en tråd eller en ny merknad, ikke en
lukking) etter den. Runden økes, og hendelsen `til_kontroll` får
`uten_endringer: true` når revisjonen er vurdert før. En revisjon kan altså
ha flere vurderinger; den siste er den som gjelder, for publiseringen og for
`gjelder_denne` i `les`. En godkjenning etter en ny runde kan publiseres, og
en godkjenning fra før en senere `endringer` gjelder ikke.

## Kommentarene

Den faglige kontrollen skjer i kommentartråder i grenen
(`kuratering.kommentarer`, uforanderlige rader). En tråd er festet til hele
grenen eller et `anker`: `objekt` (et kort eller siden, som må stå på siden
eller i grenen), `felt` (navnet på feltet i objektet, som i
sammenligningen; krever `objekt`), `seksjon` (en av fagsidens seksjoner,
`kuratering.seksjoner()`, de samme som `PANELER`), `referanse` (en referanse
på siden eller i grenen), `kilde` (nøkkelen til en preparatomtale på siden
eller i grenen) eller `dokument` (et av grenens dokumenter). Et anker som
ikke peker på noe som finnes, avvises. Hver kommentar husker revisjonen den
ble skrevet på, og hvem som skrev den. Når grenen er publisert eller
arkivert, står trådene som de var: de kan ikke kommenteres, lukkes eller
åpnes igjen.

- En tråd er en `merknad` eller `sperrende`. Bare kontrolløren (ikke den som
  kuraterer grenen) og administratorene åpner en sperrende tråd.
- En åpen sperrende tråd stopper godkjenningen og publiseringen
  (`kuratering.sperrer`). Den lukkes av den som åpnet den, eller av en
  administrator; en merknad lukkes av alle som kan lese grenen.
- Kontrollrundene: kontrolløren åpner sperrende tråder og ber om endringer,
  kuratoren retter og svarer i hver tråd (`til_kontroll` stopper mens en
  sperrende tråd venter på svar fra kuratoren), eller svarer uten å rette og
  sender den samme revisjonen, og kontrolløren lukker trådene som er løst,
  eller åpner dem igjen, før den godkjenner revisjonen.
  En tråd som åpnes igjen med et nytt funn, venter på kuratoren til den har
  svart etter gjenåpningen.
- `les` gir trådene med `traader`: status, om tråden venter på kuratoren, og
  kommentarene.
- En kommentar er lagret når `kommenter` svarer med `lagret: true` og `id`;
  alt annet betyr at ingenting er lagret. Med `klient_id` (8–100 tegn:
  bokstaver, sifre og `. _ : -`), som agenten velger før det første forsøket,
  lagres den nøyaktig én gang: et nytt forsøk med den samme ID-en og den
  samme teksten i den samme tråden (for en ny tråd også den samme arten og
  det samme ankeret) lagrer ingenting nytt og svarer med kommentaren som står
  der (`alt_lagret: true`), også om grenen er avsluttet siden. Den samme
  ID-en for noe annet avvises (`PT409`).
  ID-en gjelder per agent og gren, og står på kommentaren i trådene.

### Når et kall ikke blir lagret

MCP-endepunktet skriver én linje i serverloggen (Vercel) per verktøykall:
`{"kuratering_mcp": <verktøy>, "utfall": "ok" | <feilkode>, "ms", "klient_id"?}`,
uten nøkkel, argumenter eller fagtekst (`loggKall` i `endepunkt.ts`). Et kall
som nådde OUSFAR, står der, og OUSFAR svarte kontrolløren med en feil med
`feil` og `kode`. Et kall ChatGPT stoppet før det ble sendt, står ikke der, og
ingenting er lagret; svaret kontrolløren får, er da ChatGPTs egen melding,
som «This tool call was blocked by OpenAI's safety checks». Hva kontrolløren
gjør da, står i `docs/kontrollorinstruks.md` («Når et kall ikke blir
lagret»).

Natten 17.–18. oktober 2026 ble kontrollørens skrivekall (`kommenter`) i de
planlagte kjøringene i ChatGPT stoppet med den meldingen. Ingen av dem nådde
OUSFAR: kontrollørens siste kommentar er fra 17.10 kl. 09:12 og siste
vurdering fra 18:55 (UTC), det står ingenting fra kontrolløren etter det, og
serveren var ikke endret mellom kjøringene som virket og de som ble stoppet. Det samme er
meldt av mange i OpenAIs utviklerforum siden slutten av september 2026: skriv
fra planlagte oppgaver (Tasks) stoppes av en sikkerhetskontroll før kallet
sendes, mens de samme kallene virker i en vanlig samtale; OpenAIs kundestøtte
har bekreftet at det ble undersøkt (13. og 16.10), uten en rettelse. Dette
ligger utenfor OUSFAR og må tas opp med OpenAI. Til det er rettet, er det
kjøringer startet for hånd i en samtale som kan skrive.

## Publiseringen

`publiser` krever status `godkjent`, en godkjenning av siste revisjon fra
andre enn kuratoren (den siste vurderingen av den), en bestått prøve og ingen
sperrer, og skriver så hele grenen inn i én transaksjon: nye referanser,
siden, kortene som fjernes, endres og legges til, og bivirkningene. Revisjonene føres på kuratoren og
publiseringene på den som publiserte; endringsloggen får én kuratering med
rapporten og grenen (`innholdsendringer.gren`), og siden får én ny
sideversjon. Stopper noe, er ingenting publisert: grenen blir `blokkert` med
grunnen.

En ny referanse som en annen gren har publisert i mellomtiden (samme kilde på
to sider til kontroll samtidig), lages ikke på nytt, verken ved publiseringen
eller prøvepubliseringen: med samme ID og lenke brukes den publiserte, og med
samme lenke og en annen ID siterer grenens objekter den publiserte i stedet
(ID-en byttes før grenen skrives inn). Den publiserte referansen står som den
er. Lenken slås opp som i `intern.kuratering_referanse`, og låses på tvers av
sidene mens grenen publiseres, så to grener ikke lager den samme samtidig. Det
er en konflikt (`PT409`) når lenken står på flere referanser, når referansen
med lenken har et upublisert utkast med en annen lenke eller en arkivering, og
når ID-en er tatt av noe annet.

Publiseringen stopper (konflikt, `PT409`) når siden er publisert på nytt etter
grunnversjonen, også gjennom en delt referanse, og når noe grenen endrer har et
upublisert utkast fra vanlig redigering. Det utkastet overtas ikke; det må
publiseres eller tilbakestilles i appen, og grenen oppdateres
(`oppdater_grunnlag`), som også sier hvilke objekter som er endret i
hovedversjonen.

## Blindfasen

En de novo-gren (`art: "de_novo"`) starter i blindfasen: kuratoren ser bare
oppbygningen av siden (panelene og kortenes plass og type), ikke fagteksten
eller forhåndsvisningen. Den avsluttes med `avslutt_blindfase` når
blindprotokollen og evidensjournalen fra det egne kildesøket er lagret og fylt
ut (blindprotokollen med `kontrollpunkter`, `kilder` med domene og kilde,
`konklusjoner` og `adversarial`); blindprotokollen kan ikke endres etterpå.

## Gjenopprettingen

En administrator tar en eldre versjon av siden tilbake med
`gjenopprett_versjon`. Det blir en gren (`art: "gjenoppretting"`, uten
kurator) med én revisjon: forskjellen mellom versjonen og siden slik den står,
som endringer. Kortene får innholdet de hadde i versjonen, kortene som er
kommet til, fjernes, og bivirkningsimportene fra versjonen legges inn på nytt
mens de som er kommet til, trekkes tilbake. Navnet og nøkkelen til siden og
referansene (de deles med andre sider) står som nå, og det som ikke kan tas
tilbake, står i merknadene. Grenen prøvepubliseres og forhåndsvises som andre,
og publiseres av en administrator fra `arbeid` uten en ny faglig vurdering,
siden alt i den har vært publisert før. Sideversjonen den gir, har opphavet
`gjenoppretting`.

## I appen

- `#/kuratering/<gren>`: grenen for administratorene, med fagsiden slik den
  blir publisert (forhåndsvisningen), sammenligningen med versjonen den bygger
  på, kontrollrundene og hindringene, og handlingene (vurdere, publisere,
  stanse, gjenoppta, forkaste). En kontrollrunde med samme revisjon som den
  forrige står som «kontrollrunde N, uten nye endringer». En eldre revisjon
  kan velges og vises.
  Banneret viser hva agenten gjør (arbeider, venter, stanset, eller at
  tilkoblingen er brutt; «arbeider» bare når kuratoren har meldt aktivitet
  eller gjort noe i nettopp denne grenen de siste ti minuttene,
  `kurator_sist_kl` i `status`). Siden spør etter `status` hvert
  halve minutt, og hvert femte sekund med «Følg agenten» på; er noe nytt
  (`endring` er større enn da grenen ble lest, eller statusen er en annen),
  leses grenen på nytt og kortene som er endret, lyser opp en liten stund.
  Siden står mens revisjonene skifter, med de samme skuffene åpne; bare
  innholdet byttes. Slik vises også et nytt svar eller en ny merknad i en tråd.
  «Følg agenten» åpner seksjonen og detaljkortet agenten melder at den
  arbeider med — eller det som er endret, når en ny revisjon kommer — ruller
  dit og rammer inn stedet, med merket «Agenten arbeider her» mens agenten
  arbeider (som indikatoren). Et kort som er flyttet, åpnes i den nye seksjonen. Den
  slås av når man ruller selv (`src/components/kuratering/Folgagenten.tsx`).
  «Kommentarer» viser trådene festet til kort og felt, og lar
  administratoren åpne nye (også sperrende), svare, lukke og åpne igjen
  (`src/components/kuratering/Kommentartrader.tsx`, ankrene i
  `src/kuratering/anker.ts`).
- `#/versjon/<stoff>/<nr>`: en versjon av fagsiden for alle innloggede, med
  sammenligningen med den gjeldende og, for administratorene, «Ta tilbake
  denne versjonen».
- «Versjoner» i menyen på fagsiden, «Kurateringer» i administrasjonsmenyen, og
  en melding øverst på fagsiden for administratorene når en gren er aktiv.
- Sammenligningen av to hele utgaver av siden står i
  `src/faginnhold/sidesammenligning.ts`, og bruker de samme feltene som
  historikken for ett objekt.

## Historikken

Revisjonene, vurderingene, hendelsene og dokumentene kan ikke endres eller
slettes, bare slettes sammen med siden når den slettes for godt.
