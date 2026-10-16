# Kurateringsgrener og versjonerte fagsider – visjon og gjennomføringsplan

> **Status:** Målarkitektur og gjennomføringsplan, ikke en beskrivelse av ferdig funksjonalitet. Opprettet 16.10.2026.
>
> **Hensikt:** Gjøre OUSFAR i stand til å forbedre hele stoffregisteret kontinuerlig uten at uferdig eller utilstrekkelig kontrollert KI-kuratering påvirker publisert klinisk informasjon.

## 1. Produktvisjon

Hver fagside har én publisert hovedversjon og høyst én aktiv **kurateringsgren i OUSFAR**. Claude Code arbeider på en isolert kopi av den publiserte siden. Kontrollører (ChatGPT og autoriserte mennesker) leser, kommenterer og godkjenner endringer direkte i appen. Først en fullstendig kontrollert, eksakt identifisert og teknisk validert sideversjon kan publiseres som ny hovedversjon. Tidligere publiserte sideversjoner og hele tilbakemeldingshistorikken bevares.

Dette er **applikasjonsgrener i Supabase**, ikke GitHub-grener eller separate databaser. GitHub fortsetter å brukes for programkode, databasemigrasjoner og teknisk CI, men **ikke som hovedarena for faglige kontrollsamtaler**.

Tilsvarende arbeidsflyter for stoffregister og fortolkningssider kan vurderes senere. Første leveranse gjelder redaksjonelle fagsider og kuratorstyrt strukturert innhold som inngår i monografien.

## 2. Ufravikelige prinsipper

1. **Publisert er beskyttet.** Arbeid, delvise lagringer, avbrudd og forkastede forslag endrer aldri det en vanlig leser ser.
2. **Én aktiv gren per stoff.** Sikres i databasen, ikke bare i UI. Global kø kan fortsatt begrense antall pågående agentjobber; grener til gjennomgang behøver ikke blokkere neste stoff.
3. **Ingen menneskelig manuell redigering av en aktiv kurateringsgren.** Autoriserte kontrollører kan kommentere og beslutte status. Agentens skriverett er separat, tids-/rolleavgrenset og kontrollerbar.
4. **Én eksakt revisjon godkjennes.** En ny faglig endring etter godkjenning opphever godkjenningen.
5. **Publisering er atomisk.** Enten blir hele den godkjente versjonen ny hovedversjon, med referanser og revisjonsføring, eller ingenting blir publisert.
6. **Ingen stille overskriving.** Hvis hovedversjonen eller andre berørte delte objekter er endret etter forgreningen, kreves eksplisitt avstemming og ny kontroll.
7. **Historikk er append-only.** Både publiserte sideversjoner, arbeidsrevisjoner, kommentarer, svar, beslutninger og gjenopprettinger bevares.
8. **Faglige standarder beholdes.** Kildeprioritering, dekningsmatriser, de novo-blindfase, påstandsnære referanser, norske referanseområder og kontroll av kvantitative data svekkes ikke for å øke gjennomstrømningen.
9. **Sikkerhet gjelder også KI.** Agentidentitet og rettigheter verifiseres på serversiden. Ingen data bak innlogging, hemmeligheter eller pasientopplysninger havner i offentlige GitHub-grener eller logger.
10. **Automatiske kildelag forblir autoritative i sine egne systemer.** Ingen duplisering av FEST, ClinPGx, CPIC, PubChem eller Farmakologiportalen som redaksjonell tekst.

## 3. Begreper og grenser

- **Hovedversjon:** Den nå publiserte komplette fagsiden, uavhengig av eventuelle vanlige upubliserte objektutkast.
- **Kurateringsgren:** En isolert arbeidsflate for én fagside, basert på et bestemt publisert sideøyeblikksbilde. Har egen identitet, status, endringsserie, kildeproveniens og kontrolltråder.
- **Arbeidsrevisjon:** Uforanderlig checkpoint som viser hvordan kurateringsgrenen så ut etter en konkret endring.
- **Kontrollrunde:** Gjennomgang av en låst arbeidsrevisjon med kommentarer og beslutning om retting/godkjenning.
- **Publisert sideversjon:** Uforanderlig manifest/øyeblikksbilde av hele den redaksjonelle siden etter publisering, inklusive hvilke innholdselement- og referanserevisjoner og hvilke kuratorstyrte strukturerte datasett (som SPC-importer) som var gjeldende. Opprettes også når en delt referanse publisert fra en annen side endrer det siden viser.
- **GitHub PR:** Fortsatt relevant for kode, skjema, migrasjoner og testinfrastruktur, men er ikke en kurateringsgren.

Eksisterende `objektrevisjoner`, `objekttilstander`, `objektpubliseringer`, `les_historikk` og sideendringslogg skal gjenbrukes der det er forsvarlig. **Eksisterende generelle `utkast` kan ikke alene brukes som kurateringsgren:** de er delt med annen vanlig redigering og gir ikke trygg isolasjon eller godkjenning av hele siden.

## 4. Livsløp og status

En kurateringsgren kan opprettes fra en publisert side. Den starter med det samme redaksjonelle innholdet, men med sin egen isolerte versjon og eksplisitt grunnversjon. Uavklarte menneskelige utkast utenfor grenen skal ikke slettes eller overtas i stillhet.

| Tilstand i UI | Betydning og tillatte handlinger |
| --- | --- |
| **Under arbeid** | Claude kuraterer. Løpende, skrivebeskyttede forhåndsvisninger og fremdrift er tilgjengelige. |
| **Klar til kontroll** | Agenten har låst en konkret revisjon; kontrollører kan opprette feltkommentarer og evaluere endringer. |
| **Tilbakemeldinger avgitt** | En kontrollør har sendt samlet tilbakemelding; Claude kan begynne retting. |
| **Under retting** | Claude arbeider mot den låste tilbakemeldingspakken; nye revisjoner bevares. |
| **Klar til ny kontroll** | Revidert forslag er låst og avventer ny gjennomgang, med tidligere kommentarer og svar synlige. |
| **Godkjent** | En autorisert kontrollør har godkjent **eksakt revisjon** og alle faglige/tekniske porter er kontrollert før publisering. |
| **Publiseres / Publisert** | Samlet transaksjon pågår / ny hovedversjon er bekreftet publisert. |
| **Stanset / Blokkert / Arkivert** | Tidsavbrudd, faglig hindring eller bevisst forkastelse; ingen påvirkning av hovedversjonen. |

Statusoverganger kontrolleres på serversiden. Agenten kan aldri selv godkjenne sitt eget faglige arbeid. Ved nye innholdsendringer, ny konflikt med hovedversjonen eller bortfall av nødvendig kontroll må godkjenningen bortfalle. Teknisk feil etter faglig godkjenning skal blokkere publisering med presis begrunnelse, ikke tolkes som vellykket publisering.

## 5. Brukeropplevelse

### Publisert fagside

For brukere som har innsyn i kurateringsgrenen, viser fagsiden et diskret, tydelig banner med status, siste aktivitet og lenke til **Forhåndsvis kuratering**. For øvrige brukere er den publiserte siden uforstyrret. Kurateringsinnhold merkes som *ikke faglig godkjent / arbeidsversjon*.

### Forhåndsvisning

Bruk eksisterende fagsidekomponenter og kildereferansevisning, men i en **skrivebeskyttet** tilstand. Forhåndsvisningen gjengir grenen, ikke en blanding av gren og publisert hovedversjon. Den bør vise:

- status, aktiv kontrollrunde, siste lagrede revisjon og aktuell fagseksjon;
- enkel sammenligning med publisert hovedversjon (nye, fjernede og endrede felt);
- agentens sist rapporterte arbeidssted, aktivitet og eventuelle avbrudd;
- når status tillater det: kommentarikon ved **alle redigerbare felt**, inkludert kildefelt og panel-/kortreferanser;
- ved lange tekster: mulighet til å kommentere en markert passasje;
- en liten seksjon for generelle kommentarer nederst, ikke som primær kanal.

### Følg agenten (tilvalg)

Under aktiv kuratering kan klienten oppdatere forhåndsvisningen etter hvert som agenten lagrer **verifiserte checkpoints**. Endrede felt kan markeres kort. Bryteren **Følg agenten** ruller til seksjonen agenten arbeider med; manuell rulling slår følging av. Ingen ufrivillig automatisk rulling som standard. Hendelsesstrømmen er et hjelpemiddel, ikke kilde til sannhet: ved brudd hentes faktisk lagret tilstand på nytt. Indikatoren skiller mellom *aktiv*, *venter*, *stanset* og *tilkobling brutt*; ikke vis evig aktivitet uten belegg.

Vurder Supabase Realtime/Broadcast med autoriserte private kanaler og lav meldingsmengde, alternativt målrettet polling. En Realtime-melding bør normalt bare inneholde gren-ID, revisjon og felt-/seksjonsnøkkel, ikke privat fagtekst. Siden henter autorisert innhold via ordinær leser.

### Arbeidsoversikt

Gi redaktører en oversikt over grener, status, siste aktivitet, ansvarlig agent, kontrollrunde, uavklarte kommentarer, tekniske blokkeringer og hvem som har neste handling. Gjenbruk kurateringskøens prioriteringer i stedet for å opprette en rivaliserende kø.

## 6. Kommentarer og kontroll

Dette er et eget **faglig kontrollsystem**, atskilt fra eksisterende generelle diskusjonstråder.

- Kommentarer forankres til stabil identitet for innholdselement + navngitt feltsti, valgfri tekstmarkering, og nøyaktig revisjon/innholdsfingeravtrykk.
- Kommentarer på panelnivå, kortnivå og kildefelt er likeverdige. Gjenbruk en felles visuell komponent.
- En tråd lagrer kontrollør, dato, innhold, svar fra Claude og tilstand (*åpen*, *besvart*, *løst*, *gjenåpnet*, *utdatert*). Bare autorisert kontrollør kan markere faglig løst; en agent kan foreslå det.
- Hvis et felt slettes/flyttes/omskrives, behold opprinnelig kommentar og vis at forankringen eventuelt er utgått; ikke flytt den lydløst til en annen påstand.
- Kontrolløren sender kommentarer samlet med **Tilbakemeldinger avgitt**. Claude får strukturert liste og retter på grenen, med sporbare svar/revisjoner.
- Ved ny kontroll vises først endringer siden sist vurderte revisjon og de uavklarte kommentarene. Kontrolløren kan alltid åpne hele monografien.
- Ved **Godkjent** journalføres kontrolløridentitet, tidspunkt, eksakt revisjon/hash, kontrollutfall og en kort faglig begrunnelse. Godkjenning krever en annen identitet enn innholdsproduserende agent, relevante fullstendighets-/kildeporter og avklaring av alvorlige åpne innvendinger.
- ChatGPT må kunne lese og kommentere via en sikker, autentisert app-/agenttilgang, ikke via offentlig GitHub-tekst eller en usikret skrive-SQL. Dersom en slik integrasjon ennå ikke virker, kan ikke ChatGPT-kontroll rapporteres som gjennomført.

## 7. Fullstendig versjonshistorikk og gjenoppretting

Ved **hver** publisering av en fagside – også vanlig manuell publisering – lagres ett uforanderlig, komplett sideversjonsmanifest med publiseringshendelse, innholdselementer, rekkefølge, paneltilknytning og de eksakte revisjonene av redaksjonelle referanser. Dokumenter kildeproveniens, agent/bruker, grunnversjon, kontrollrunde og publiseringstidspunkt. Unngå unødvendige datakopier når uforanderlige objektrevisjoner kan gjenbrukes.

Manifestet skal binde **alt redaksjonelt innhold siden viser**, ikke bare kortene:

- **Delte referanser.** En referanse som brukes av flere sider, kan publiseres fra én av dem. Enhver publisering som endrer det en side viser – også en delt referanse eller et annet delt objekt publisert fra en annen side – oppretter i **samme transaksjon** en ny sideversjon for hver berørt fagside. Slik er hver sideversjon et eksakt bilde av det som faktisk var live, og historisk sammenligning trenger ikke gjette.
- **Kuratorstyrte strukturerte datasett.** Strukturerte SPC-bivirkninger og andre kuratorstyrte importer bindes med eksakt import-/kildeversjon (for eksempel import-ID) i manifestet. En ny import av samme kilde gir en ny sideversjon, og en eldre sideversjon viser og gjenoppretter sin egen import, ikke den nyeste.

Historikken skal la en autorisert bruker:
1. åpne en eldre **hel** sideversjon slik den redaksjonelt så ut;
2. sammenligne to komplette versjoner eller utvalgte felt;
3. se hvilke kontrollkommentarer, svar og godkjenninger som førte til publisering;
4. **gjenopprette** den eldre versjonen ved å opprette **en ny** publiseringsversjon med det gamle redaksjonelle innholdet; aldri slette nyere historie.

Gjenoppretting krever samme konsistens-/tilgangskontroll som vanlig publisering og skal ikke endre andre fagsider via delte referanser. Beskyttede norske referanseområder og andre faglige bevaringskrav skal fortsatt kontrolleres.

**Historisk nøyaktighet:** Dagens automatisk synkroniserte FEST/ClinPGx/CPIC/PubChem/Farmakologiportalen-data er ikke nødvendigvis identiske med dem som gjaldt da en gammel side ble publisert. En historisk visning må merke hva som er et ekte arkivert redaksjonelt øyeblikksbilde, og hvilke eventuelle automatisk hentede data som vises med dagens verdi. Ta vare på tilgjengelig kildeversjon/tidspunkt uten å late som dynamiske data er historisk fryst.

Opprett en **basissnapshot av dagens publiserte sider** når systemet aktiveres. Historiske komplette sideversjoner før dette tidspunktet kan rekonstrueres bare der alle nødvendige data faktisk finnes; aldri fabrikkér fullstendige historiske versjoner.

## 8. Datamodell, isolasjon og sikkerhet

Velg konkret tabell-/API-utforming etter revisjon av live Supabase-skjema, men følgende egenskaper er bindende:

- En unik, serverhåndhevet aktiv kurateringsgren per stoff. Gren peker til nøyaktig publisert grunnversjon og har sikker fornying/gjenopptakelse ved avbrudd.
- Separat, versjonert **greninnhold**, ikke vanlig delt objektutkast. Nye og endrede kort, panelreferanser, redaksjonelle referanser og kuratorstyrte strukturerte SPC-bivirkninger må være isolerte og kunne inngå i samlet publisering. Delte referanseobjekter må aldri redigeres globalt under kuratering.
- Append-only grenrevisjoner, kommentarer/kontrollrunder, beslutninger, agentfremdrift og publiserte sideversjonsmanifest.
- Feltstier og tekstankre som tåler nye revisjoner, med eksplisitt foreldelse når nødvendig.
- Rollen for å lese gren, rollen for å skrive som kurator og rollen for å kommentere/godkjenne er forskjellige. Håndhev i database/API (RLS + begrensede privilegerte operasjoner), ikke bare ved å skjule knapper.
- Agentidentiteter skal være verifiserbare og loggbare; vanlige klienter skal ikke kunne opptre som Claude eller ChatGPT. Ingen service_role-nøkkel i nettleser.
- Logg fra agent og app skal ikke røpe data som bare er tilgjengelige bak innlogging. Repoet er offentlig.
- Automatisk kildevisning fra eksterne synker beholdes som eget lag. Kuratorstyrt **SPC-import** er annerledes: den er et versjonert faglig redaksjonsresultat og trenger eksplisitt dekning, preview og godkjenning.
- Vanlig menneskelig redigering av **hovedversjonen** kan fortsette uten å endre den aktive grenen; enhver slik endring utløser nødvendig konfliktvurdering før grenen kan publiseres.

### Publisering

Publiser med én serverstyrt, transaksjonssikker operasjon. Verifiser under lås at:
1. godkjenningen gjelder grenens siste eksakte revisjon;
2. ingen sperrende faglige kommentarer/porter står igjen;
3. siste tekniske tester og produksjonsnære lesekontroller gjelder korrekt revisjon;
4. hovedversjonen og andre berørte delte objekter samsvarer med forventet grunnversjon, eller avstemming er gjort og ny kontroll er utført;
5. beskyttede verdier, referanseintegritet, objekt-/kortnøkler og sidekoblinger valideres.

Publisering og versjonsmanifest/endringslogg må committe i **samme databasetransaksjon**, og vanlige lesere må aldri se en blanding av gammelt og nytt innhold. Ved feil: behold grenen og den tidligere hovedversjonen uendret, og rapporter tydelig blokkering.

Ikke baser publisering av nytt faginnhold på at en GitHub PR med SQL migrasjon skal gjennom samme ad hoc-faglige diskusjon. Migrasjoner for **kode og skjema** følger fortsatt repoets eksisterende CI-/deploy-regime. Overgang fra dagens innholdsmigrasjoner må gjennomføres kontrollert slik at eldre kurateringer, historikken og tekniske kvalitetsporter fortsatt fungerer.

## 9. Integrasjon med kurateringskø, Claude og ChatGPT

- Gjenbruk `docs/kurateringsko.md` og eksisterende prioritering, reservasjoner, avbrudd, gjenopptakelse og køstatus. Kartlegg dagens GitHub-gren/PR-tilstand over til nye appgrener og sikre migrering av kjøringer som allerede pågår. Ingen dobbeltbokføring eller to aktive jobber på samme stoff.
- Claude Code blir primær utførende kurator, men **ikke** faglig egenkontrollør. Portér/tilpass kuratorprotokollen til Claude i repoet fra én versjonsstyrt faglig kilde. Oppdater konfliktende instrukser i `docs/monografkuratering.md`, `docs/kurateringsko-instruks.md` og øvrige relevante dokumenter.
- Bevar de novo-blindfasen: selv om grenen teknisk kopieres fra publisert side, skal Claude ikke eksponeres for gammel fagtekst/evidensjournal før uavhengig kildesøk og adversarial kontroll er gjennomført. Teknisk panelmodell og identitet kan leses.
- Del kuratering i gjenopptakbare etapper (dekningsplan, kilder per fagområde, syntese, strukturerte tall/SPC, migrering til gren, selvtest, fagkontroll). Checkpoints skal lagres uten å dikte opp fullføring.
- ChatGPT og autoriserte mennesker gjennomfører uavhengig gjennomgang gjennom appens kommentarsystem. Resultatet må knyttes til eksakt grenrevisjon.
- Eksisterende kvalitetskrav fra kuratorskillen bevares: full dekningsmatrise, kildetro SPC/PDF-visuell vurdering, kvantitative tallkontroller, konservativ håndtering av usikkerhet, kildejournal, kontroll av automatiske lag via autentisert app-lesevei, revisjonsrapport og oppdaterte tidsgrenser.
- Hvis et nødvendig verktøy, en kilde eller en autentisert lesevei mangler, skal grenen være **blokkert eller ufullstendig**, ikke gis falsk ferdig-status.
- GitHub inneholder teknisk kode, tester og nødvendige ikke-sensitive spor. Faglige kommentartråder og de beskyttede sideutgavene ligger i OUSFAR.

## 10. Gjennomføring i selvstendige leveranser

**Fase A – Kartlegging og sikker modell.** Undersøk dagens reelle database, RLS, objektutkast, revisjoner, global referansedeling, SPC-import, publisering, kurateringskø, agentskripter og eksisterende UI. Dokumenter beslutninger og avgrensninger, test farlige overgangstilfeller. Unngå parallelle systemer.

**Fase B – Trygg grunnmur.** Innfør isolerte kurateringsgrener, publiserte hele-side-snapshots, append-only revisjoner, tilgangsstyring, sammenligningsgrunnlag, konfliktavvisning og atomisk publisering. Basissnapshot av eksisterende publiserte sider. Bevar gammel funksjonalitet bak kompatibilitet/funksjonsbryter til det nye er testet.

**Fase C – Redaksjonelt UI.** Banner, skrivebeskyttet forhåndsvisning, statusmaskin, helside-diff, versjonsliste og fullstendig gjenoppretting. Lag en oversikt for kurateringsarbeidet.

**Fase D – Faglig kontroll.** Felt- og kildekommentarer, tekstmarkeringer, tråder/svar, kontrollrunder, revisjonsbundne godkjenninger, sperrer for uløste funn og revisjonsspor.

**Fase E – Agenter og sanntid.** Sikker les/skriv/kommenter-integrasjon for Claude og ChatGPT, køtilpasning, kontrollert overføring av kuratorskill, gjenopptakbare etapper, framdrift og valgfri «Følg agenten». Bevar tekniske og faglige porter.

**Fase F – Pilot og utrulling.** Prøv minst tre ulike stoffer – citalopram, lurasidon og GHB – med ulike dokumentasjonsbehov. Kontroller kildekvalitet, SPC, dataintegritet, konflikter, gjenopptakelse, rollegrenser, godkjenning, publisering og gjenoppretting. Ingen uferdig eller utilstrekkelig kontrollert monografi publiseres. Etter pilot: aktiver køstyrt første de novo-runde for hele registeret, ett stoff om gangen, uten å svekke krav til faglig godkjenning.

Del gjerne fasene i flere oversiktlige GitHub PR-er i riktig avhengighetsrekkefølge. Bruk tekniske tester, bygg, databaseintegrasjonstester og målrettede produksjonsnære lesekontroller før utrulling. Dokumenter faktiske uavklarte avhengigheter, ikke stopp ved en generell implementasjonsplan.

## 11. Akseptansekriterier

Etter innføring skal systemet kunne demonstrere, med automatiserte tester og en praktisk ende-til-ende-pilot, at:

1. En gren kan åpnes uten å endre publisert side eller menneskelige utkast.
2. To samtidige forsøk på å åpne aktiv gren for samme stoff ikke lager to grener.
3. Agenten kan lagre delvise checkpoints og gjenoppta etter avbrudd uten å miste eller duplisere arbeid.
4. Vanlige lesere aldri ser ufaglig kontrollert greninnhold via vanlig side, globalt søk, RPC, API eller cache.
5. En menneskelig redigeringsforespørsel til en aktiv kurateringsgren blir avvist på serversiden.
6. Kontrollørkommentarer på tekst, datakort, mekanismekort og **kildereferanser** peker til riktig revisjon; flytting/omskriving ødelegger ikke historikken.
7. En godkjenning av én revisjon ikke kan gjenbrukes etter senere endringer.
8. Åpne vesentlige avvik eller manglende kontrollporter hindrer publisering.
9. Samtidige endringer i hovedversjonen eller delte referanser ikke overskrives i stillhet.
10. Publisering enten endrer **hele** siden konsekvent eller ikke endrer den i det hele tatt.
11. En tidligere publisert helside kan vises, sammenlignes og gjenopprettes som **ny** versjon, med komplett audit trail.
12. Automatisk hentede data ikke blir kopiert til redaksjonelt innhold, og historisk visning ikke gir feil inntrykk av gamle automatiske data.
13. Private Realtime-hendelser, agentidentitet, RLS og feil-/GitHub-logger ikke lekker beskyttet informasjon.
14. Kurateringskø, eldre migrasjoner og vanlige redigerings-/publiseringsflyter fortsatt fungerer eller har en eksplisitt, testet og reverserbar overgang.
15. De tre pilotmonografiene og den fullstendige evidensjournalen kan gjennomgås i appen uten at faglige diskusjoner må foregå i GitHub.

## 12. Eksisterende dokumentasjon som skal brukes aktivt

- `docs/faginnhold.md` – objektmodell, revisjoner, utkast, publisering, gjenoppretting og referanser.
- `docs/innholdsendringer.md` – endringslogg og agentidentitet.
- `docs/monografkuratering.md` – dagens fag-/teknikkdeling, revisjonspreflight og migrasjonsporter.
- `docs/kurateringsko.md` og `docs/kurateringsko-instruks.md` – kø, reservering, avbrudd og gjenopptakelse.
- `docs/kuratorjobber.md` – autentisert runtimekontroll og SPC-innhenting.
- `docs/bivirkninger.md` – strukturert SPC-import og kildefidelitet.
- `docs/diskusjoner.md` – eksisterende generelle tråder, **ikke** samme formål som kontrollkommentarer.
- `docs/migrasjoner.md`, `docs/endringslogg.md` og `CLAUDE.md` – teknisk migrering, versjonering og arbeidsregler.
- OUSFARs monografikuratorskill og alle faglige referansefiler – faglig protokoll som ikke må utvannes.

**Prioritert leveranseprinsipp:** trygg isolasjon og atomisk publisering før sanntidseffekter. Et attraktivt UI må aldri maskere manglende faglig eller teknisk kontroll.
