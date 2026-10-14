# Endringsloggen for innholdssidene

Leses når noe skal endre faginnholdet — fra appen, fra en migrasjon eller fra
en agent — eller når loggen selv skal endres. Den er ikke appens egen
endringslogg over versjonene (`docs/endringslogg.md`).

Hver side med innhold som kan redigeres, har en diskret «Endringslogg»-knapp i
toppmenyen: fagsidene, stoffregisteret og fortolkningssidene (med reglene,
kommentarene og regelsettene). Loggen viser endringene nyeste først, med
tidspunkt, hvem som gjorde dem — en person, en navngitt KI-agent eller
systemet — og et kort sammendrag. Hver endring kan foldes ut med delene den
besto av, rapporten fra en kuratering, migrasjonen og lenkene, og
sammenligningen med versjonen før i den vanlige historikken.

Andre enn administratorer ser bare det som er publisert. Administratorer ser
også utkastene (bryteren «Vis utkast»). Rutinene — ryddingen av papirkurven og
tjenestene — er skjult til man slår på «Vis rutineendringer».

## Delene

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_innholdsendringer.sql` | Tabellene, føringen av endringene, rapportkontrollen, hendelsene i stoffregisteret og bivirkningene, og lesingen (`les_endringslogg`) |
| `supabase/migrations/*_endringslogg_tilknytning.sql` | Hva som hører til en side (`intern.sidens_utgaver`) |
| `supabase/migrations/*_endringslogg_profiler.sql` | Profilene agentene vises med (`agentprofiler`), og lesingen slik den er nå |
| `src/endringslogg/` | Modellen og lesingen (`modell.ts`, `api.ts`), handlingen appen sender med kallene (`operasjon.ts`), sammendragene (`oppsummering.ts`) og siden loggen gjelder (`sider.ts`) |
| `src/components/endringslogg/` | Knappen og loggvinduet (`Innholdslogg.tsx`) og det valgfrie oppsummeringsfeltet ved lagring (`Oppsummeringsfelt.tsx`) |
| `src/faginnhold/endringserklaering.ts` | Kontrollen i CI og før utrullingen av at en migrasjon som endrer innhold, oppgir agenten |
| `scripts/agentvalg.ts` | `--agent` og `--lenke` i skriptene som lager migrasjoner med innhold |
| `src/__tests__/innholdsendringer.test.ts` | Databasen: føringen, synligheten, rapporten, uforanderligheten |
| `src/__tests__/innholdslogg.test.tsx`, `innholdsendringsbeskrivelser.test.ts`, `endringserklaering.test.ts` | Vinduet, sammendragene og kontrollen |

## Modellen

Loggen bygger på revisjonene og publiseringene som finnes (`docs/faginnhold.md`);
den er ikke et system ved siden av.

- **`innholdsendringer`** — én rad per endring: én lagring, én publisering, én
  handling i stoffregisteret eller én kuratering. Den har hvem (`aktor`:
  `bruker`, `agent` eller `system`, med personen eller agenten), oppsummeringen,
  rapporten, migrasjonen og lenkene.
- **`endring_id`** på `objektrevisjoner` og `objektpubliseringer` knytter hver
  revisjon og publisering til endringen sin. Den settes av en trigger i samme
  transaksjon som revisjonen, så endringen lagres atomisk med det den gjelder.
  Ingenting endret, ingen endring.
- **`innholdshendelser`** — det som ikke har revisjoner: kategoriene og
  plasseringene i stoffregisteret, arkivering, papirkurv, sletting og
  gjenoppretting av fagsider, og bivirkningsimportene. Hver hendelse har
  siden den gjelder og navnene slik de var da.
- **`endringsagenter`** — agentene som kan stå for en endring, med nøkkel,
  navn, art (`ki-agent` eller `system`) og om de er en rutine. En ny agent
  legges inn med en migrasjon.
- **`agentprofiler`** — brukernavnet til profilen en agent vises med: loggen
  viser agentens navn med profilbildet derfra. Kuratorboten (ChatGPT
  monografkurator) har profilen `kuratortest`. En kobling legges inn med en
  migrasjon, og gjelder også når profilen opprettes senere; uten profil vises
  agenten med forbokstavene.

Loggen viser hvem som gjorde hver endring først, med profilbildet: personens
egen profil, agentens profil, eller et tannhjul for systemet.

Tabellene kan ikke endres eller slettes gjennom API-et, og radene kan aldri
slettes. En endring kan bare fylles ut i transaksjonen den ble laget i, og en
rapport kan ikke endres etterpå.

### Hva som hører til en side

Hva som hører til en side, avgjøres når loggen leses, ut fra objektene selv
(`intern.sidens_utgaver`). Siden får bare det som angikk den da det skjedde:

- **Siden selv** (fagsiden, eller regelsettene og analyttene i en fortolkning):
  hele historikken.
- **Et kort**: revisjonene der det sto på siden, og den der det ble flyttet dit
  eller bort derfra. Det kortet var på en annen fagside før det, hører til den
  andre siden.
- **En referanse eller kommentar** (som flere sider kan dele): bare det som
  skjedde mens siden pekte på den. At den knyttes til eller fjernes fra siden,
  står som en endring av kortet eller siden som fikk eller mistet den. Det den
  var før det, hører ikke til siden, og fjernes den og legges inn igjen, teller
  den bare mens den var knyttet til siden. Ble den også brukt andre steder da
  den ble endret, er endringen **delt**: den vises på alle sidene som brukte
  den, merket «Delt» (ikke i ettertid, når en annen side tar den i bruk), og en
  endring som bare gjaldt delte objekter, vises uten sammendraget og rapporten
  fra det den ellers gjaldt (som kurateringen av en annen fagside).

Uten utkastene — alltid for andre enn administratorer — avgjøres alt dette av
de publiserte utgavene, så et kort som bare i et utkast er flyttet til siden,
eller en referanse som bare er sitert i et utkast, ikke røper koblingen før
den er publisert. Et nytt navn, en arkivering og en gjenoppretting endrer ikke
hvilken historikk siden har. Historikken selv endres aldri; bare hvordan den
knyttes til hver side.

## Én handling, én endring

Appen sender handlingens ID (`x-far-endring`) og oppsummeringen
(`x-far-oppsummering`, base64 av UTF-8) med kallene. Kallene i samme handling
fra samme bruker føres som én endring, også når de er flere transaksjoner: å
lagre et kort, legge det inn på siden, eller publisere hele siden. Lagringer,
flyttinger, fjerninger, gjenopprettinger og publiseringer på fagsidene og
fortolkningssidene går alle gjennom én handling hver (`lagerFor`,
`nyEndring` i `src/faginnhold/lagring.ts` og `src/endringslogg/operasjon.ts`).
Handlingene i stoffregisteret er ett kall hver, gjennom `Registerlager.medEndring`
på samme måte; en ny fagside og plasseringen av den er én handling. En flytting
opp eller ned blant søsknene føres som én hendelse med plassen før og etter
(`kategori_omordnet`), ikke som omnummereringen av alle søsknene.

Lagring og publisering har et valgfritt felt for en kort oppsummering, og det
har også skjemaene i stoffregisteret (ny kategori, nytt navn, ny fagside) og
den nye referansen. Står
det tomt — som det alltid gjør for handlinger uten lagreknapp, som en
flytting — beskriver loggen endringen selv ut fra delene: «Dosering
oppdatert», «Farmakodynamikk: to mekanismekort endret», «Sertralin flyttet
fra kategorien «SSRI» til «Antidepressiver»».

## Agentene

En migrasjon som endrer innhold, skal oppgi hvem som står for den. Det er det
eneste stedet en agent kan oppgis: skjemaet `intern` nås ikke fra API-et, så
ingen kan utgi seg for en agent fra appen.

```sql
select intern.endring_start('claude-code', '<migrasjonens eget filnavn>',
  'Kort, forståelig hensikt', array['https://github.com/peohol/far/pull/<nr>']);
-- … endringene …
```

Alt migrasjonen endrer etterpå, føres som én endring fra agenten. En
kuratering avsluttes i stedet med `intern.kuratering_rapport` (rapporten er
påkrevd; `docs/monografkuratering.md`), og en annen agent som vil levere en
rapport på samme form, bruker `intern.endring_rapport`.

Loggen viser migrasjonen med lenke til fila og historikken i GitHub, og
«bekreftet kjørt i databasen» når den står i databasens migrasjonshistorikk —
det er det som gjør agenten etterprøvbar, ikke navnet alene.

Kontrollene:

- **I CI og før utrullingen** stopper en ny migrasjon som endrer innhold uten
  erklæring, en kuratering uten rapport og en erklæring med et annet filnavn
  enn migrasjonens eget (`src/faginnhold/endringserklaering.ts`).
- **I databasen** stopper en kuratering uten rapport, en rapport som ikke
  stemmer med det som er endret, en ukjent agent og en endring etter rapporten.
- En migrasjon uten erklæring føres som systemets (`databasemigrasjon`); det
  gjelder de eldre.

Skriptene som lager migrasjoner med innhold, tar `--agent <nøkkel>` og
`--lenke <url>` og legger erklæringen inn selv, med filnavnet migrasjonen
skrives til (`scripts/agentvalg.ts`).

## Rutinene og de eksterne synkroniseringene

Synkroniseringene av FEST, ClinPGx, CPIC, Farmakologiportalen og PubChem
skriver i egne tabeller, ikke i faginnholdet, og står derfor ikke i loggen.
Det som endrer innhold uten en person bak — ryddingen av papirkurven og
tjenester som kaller API-et uten innlogget bruker — føres på systemagentene
`papirkurvrydding` og `tjeneste`, som er rutiner.

## Endringene fra før loggen fantes

Revisjonene og publiseringene uten `endring_id` settes sammen etter tidspunkt
og person når loggen leses. Har revisjonen en `kilde` (en import eller en
eldre kuratering), vises den som systemets, med kilden som sammendrag.
