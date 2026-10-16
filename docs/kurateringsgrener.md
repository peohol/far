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
| `skriv` | kurator | `{gren, forventet_revisjon, endringer, melding?}` |
| `aktivitet` | kurator | `{gren, tekst, seksjon?, objekt?}` |
| `dokument` | kurator | `{gren, art, innhold}` |
| `les_dokument` | kurator (egen), kontrollør, admin | `{gren, art, versjon?}` |
| `avslutt_blindfase` | kurator | `{gren}` |
| `til_kontroll` / `trekk_fra_kontroll` | kurator | `{gren, revisjon}` / `{gren}` |
| `vurder` | kontrollør, admin | `{gren, revisjon, beslutning, begrunnelse}` |
| `oppdater_grunnlag` | kurator | `{gren}` |
| `publiser` | kurator (egen), admin | `{gren, revisjon}` |
| `stans` / `gjenoppta` | admin | `{gren, grunn?}` / `{gren}` |
| `forkast` | kurator (egen), admin | `{gren, grunn?}` |
| `agenter` / `ny_agentnokkel` | admin | `{}` / `{agent}` |

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
sideversjonen, og dokumentene finnes: `evidensjournal`, `dekningsmatrise` og
`selvtest`, og for en de novo-kuratering også `blindprotokoll`. En godkjenning
er bundet til revisjonen og fingeravtrykket; en ny lagring eller en ny
grunnversjon opphever den. Dokumentene kan ikke endres mens grenen er til
kontroll eller godkjent, så det som publiseres, er det kontrolløren vurderte.

## Publiseringen

`publiser` krever status `godkjent`, en godkjenning av siste revisjon fra
andre enn kuratoren, en bestått prøve og ingen sperrer, og skriver så hele
grenen inn i én transaksjon: nye referanser, siden, kortene som fjernes,
endres og legges til, og bivirkningene. Revisjonene føres på kuratoren og
publiseringene på den som publiserte; endringsloggen får én kuratering med
rapporten og grenen (`innholdsendringer.gren`), og siden får én ny
sideversjon. Stopper noe, er ingenting publisert: grenen blir `blokkert` med
grunnen.

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
blindprotokollen og evidensjournalen fra det egne kildesøket er lagret;
blindprotokollen kan ikke endres etterpå.

## Historikken

Revisjonene, vurderingene, hendelsene og dokumentene kan ikke endres eller
slettes, bare slettes sammen med siden når den slettes for godt.
