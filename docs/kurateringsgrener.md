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
| `til_kontroll` / `trekk_fra_kontroll` | kurator | `{gren, revisjon}` / `{gren}` |
| `vurder` | kontrollør, admin | `{gren, revisjon, beslutning, begrunnelse}`; begrunnelsen kreves også ved `godkjent` (hva som er kontrollert) |
| `oppdater_grunnlag` | kurator | `{gren}` |
| `publiser` | kurator (egen), admin | `{gren, revisjon}` |
| `stans` / `gjenoppta` | admin | `{gren, grunn?}` / `{gren}` |
| `forkast` | kurator (egen), admin | `{gren, grunn?}` |
| `agenter` / `ny_agentnokkel` | admin | `{}` / `{agent}` |
| `gjenopprett_versjon` | admin | `{stoff, nr, grunn?}` |
| `kommentarer` | kurator (egen), kontrollør, admin | `{gren, apne?}` |
| `kommenter` | kurator (egen), kontrollør, admin | `{gren, tekst, art?: "merknad" \| "sperrende", anker?}` eller `{gren, tekst, svar_pa}` |
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
  kommet på avveie.
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
| `tilbakemelding` | Kontrolløren har bedt om endringer | `skriv` → `retting` |
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
  sperrende tråd venter på svar fra kuratoren), og kontrolløren lukker trådene
  som er løst, eller åpner dem igjen, før den godkjenner den nye revisjonen.
  En tråd som åpnes igjen med et nytt funn, venter på kuratoren til den har
  svart etter gjenåpningen.
- `les` gir trådene med `traader`: status, om tråden venter på kuratoren, og
  kommentarene.

## Publiseringen

`publiser` krever status `godkjent`, en godkjenning av siste revisjon fra
andre enn kuratoren, en bestått prøve og ingen sperrer, og skriver så hele
grenen inn i én transaksjon: nye referanser, siden, kortene som fjernes,
endres og legges til, og bivirkningene. Revisjonene føres på kuratoren og
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
  stanse, gjenoppta, forkaste). En eldre revisjon kan velges og vises.
  Banneret viser hva agenten gjør (arbeider, venter, stanset, eller at
  tilkoblingen er brutt; «arbeider» bare når kuratoren har meldt aktivitet
  eller gjort noe i nettopp denne grenen de siste ti minuttene,
  `kurator_sist_kl` i `status`). Siden spør etter `status` hvert
  halve minutt, og hvert femte sekund med «Følg agenten» på; er noe nytt
  (`endring` er større enn da grenen ble lest, eller statusen er en annen),
  leses grenen på nytt og kortene som er endret, markeres en liten stund.
  Slik vises også et nytt svar eller en ny merknad i en tråd.
  «Følg agenten» ruller også til kortet eller seksjonen agenten melder at den
  arbeider med, og slås av når man ruller selv
  (`src/components/kuratering/Folgagenten.tsx`).
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
