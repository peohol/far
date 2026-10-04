# FAR – felles arbeidsregler for Claude Code

FAR er et verktøy for fortolkning og kommentering av farmakologiske analyser. Bidragsyterne er klinikere, ikke utviklere, og arbeider via Claude Code i nettleseren. Denne filen skal bare inneholde korte, varige regler som gjelder på tvers av repoet.

## Samarbeid med bidragsyterne

- Behandle beskrivelser i vanlig språk som ønsket atferd, ikke som tekniske spesifikasjoner. Undersøk relevant kode, data, tester og historikk og velg selv en god teknisk løsning.
- Løs vanlig tvetydighet med beste skjønn. Still bare spørsmål når undersøkelse av repoet ikke avklarer saken, og ulike plausible valg kan gi vesentlig ulik klinisk betydning, sikkerhet/personvern, destruktive endringer eller andre vanskelig reversible konsekvenser. Finnes det et trygt og reversibelt standardvalg, bruk det og opplys kort om antakelsen.
- Be aldri bidragsyteren redigere filer, kjøre kommandoer, installere programvare, hente logger, kopiere terminalutskrift eller utføre annet teknisk arbeid som Claude kan gjøre selv. Utfør slike steg selv.
- Forutsett at bidragsyterne ikke har eller bruker et lokalt utviklingsmiljø. Ikke gi lokale oppsettsinstruksjoner med mindre det uttrykkelig etterspørres.
- Svar på norsk som standard. Forklar resultat og konsekvenser i vanlig språk, og unngå unødvendig utviklersjargong. Forklar tekniske begreper kort når de faktisk trengs.
- Produksjonsmigrasjoner følger en risikobasert regel: rull ordinære, testede migrasjoner ut som del av oppgaven uten å be om et eget ja. Be bare om eksplisitt bekreftelse når migrasjonen kan gi vesentlig datatap, svekket sikkerhet/personvern, betydelig produksjonsnedetid eller andre klart destruktive eller vanskelig reversible konsekvenser. At en migrasjon kan rulles tilbake er ikke nok hvis skade kan oppstå før tilbakeføring. Kan samme mål nås tryggere, velg den løsningen i stedet for å stoppe for godkjenning.
- Når en slik eksplisitt bekreftelse faktisk kreves og må ha en nøyaktig formulering, skal du alltid gi denne formuleringen i en egen kodeblokk slik at bidragsyteren kan kopiere den direkte.
- Ved avslutning: oppsummer hva som ble endret, hva brukeren vil merke, hvilke kontroller som er kjørt, og eventuelle reelle uavklarte forhold. Ikke dump interne implementasjonsdetaljer uten grunn.

## Arbeidsmåte

- Les relevante filer før du endrer dem. Gjør små, tydelige endringer direkte; undersøk og lag en kort plan først når endringen er bred, risikofylt eller berører flere systemdeler.
- Følg eksisterende arkitektur og mønstre. Gjør den minste helhetlige endringen som løser problemet, og rett årsaken fremfor å legge på en omvei. Ikke refaktorer uvedkommende kode.
- Fullfør oppgaven ende-til-ende: implementer, oppdater eller legg til tester, kjør relevante kontroller, rett feil og kontroller diffen. Ikke stopp ved å fortelle bidragsyteren hva vedkommende må gjøre videre dersom Claude kan gjøre det.
- Bruk fokuserte tester underveis. Før en kodeendring ferdigstilles, kjør normalt `npm test` og `npm run build`. Hvis en av dem åpenbart ikke er relevant eller ikke kan kjøres, si kort hvorfor.
- Bruk `npm run data` bare når kildedataene som bygger det genererte datasettet faktisk skal endres.
- Ikke svekk eller slett tester bare for å få grønt resultat. Når tilsiktet atferd endres, oppdater testene slik at den nye atferden blir eksplisitt verifisert.
- FAR er laget for rask tastaturbruk. Bevar eksisterende tastaturflyt, tilgjengelighet og fungerende peker-/berøringsbruk med mindre oppgaven uttrykkelig endrer dette.
- Nye vinduer, skjemaer og valg brukeren ville savnet etter en oppdatering av appen, bruker `useBevart` i stedet for `useState` (se `docs/oppdatering.md`).

## Klinisk innhold og data

- Behandle analyttenavn, enheter, terskler, formler, fortolkningsregler og kommentartekster som klinisk meningsinnhold, ikke som vanlig UI-tekst.
- Når en endring kan påvirke klinisk output, finn prosjektets kildegrunnlag og bevar sporbarheten. Eksplisitte klinikerinstruksjoner og utpekte kildeartefakter er premisser; kode og tester skal implementere og kontrollere dem.
- Ikke finn på, normaliser, «forbedre» eller hent eksterne medisinske verdier for å fylle hull. Hvis kilder, tester, eksisterende kode eller brukerens instruksjon motsier hverandre på en måte som kan endre klinisk betydning, gjør konflikten tydelig i stedet for å velge lydløst.
- Test kliniske regler ved relevante grenseverdier og andre tilfeller der små endringer kan endre fortolkningen.
- Endre kilden eller byggeprosessen fremfor et generert datasett når det er kilden som egentlig skal endres. Unngå manuelle rettelser i genererte filer som vil bli overskrevet ved neste bygg.
- Ikke legg reelle pasientopplysninger i kode, tester, logger eller dokumentasjon. Bruk syntetiske eksempler.

## Versjon og endringslogg

- Appen har et versjonsnummer etter SemVer, og hver PR skal ha nøyaktig én føring i endringsloggen — unntatt en stille designjustering, som ikke skal ha noen føring, ny versjon, varsel eller melding om å oppdatere siden.
- Som siste steg før en PR er klar til å slås sammen: følg `docs/endringslogg.md`, som også avgjør hva som er stille. Les den filen bare da; den trengs ikke ellers i arbeidet.

## Dokumentasjon og selvvedlikehold

- Hold denne rotfilen kort. Den skal bare inneholde varige regler som er nyttige i de fleste arbeidsøkter.
- Ikke legg funksjonsspesifikasjoner, fil-for-fil-beskrivelser, midlertidige planer, feilhistorikk, endringslogg, detaljert domenekunnskap eller lange begrunnelser her.
- Legg detaljert kunnskap som bare trengs av og til i passende `docs/*.md`-filer, og les dem bare når oppgaven berører temaet.
- Når en regel gjelder en bestemt mappe eller del av appen, legg en kort `CLAUDE.md` i den nærmeste relevante mappen. En underordnet `CLAUDE.md` skal bare inneholde tillegg eller avvik fra reglene over den.
- Ikke bruk `@`-import fra rotens `CLAUDE.md` til store eller spesialiserte dokumenter; det gjør dem til fast kontekst i hver økt.
- Når ny kunnskap må dokumenteres, rediger og konsolider eksisterende dokumentasjon fremfor å bare legge til mer. Fjern foreldede og dupliserte instrukser.
- Før en regel legges til her, spør: «Vil fraværet av denne regelen sannsynligvis gi gjentatte feil også i ellers urelaterte oppgaver?» Hvis nei, hører den et annet sted eller kan utelates.
- Hvis denne filen begynner å vokse, prioriter beskjæring fremfor utvidelse. Historikk skal aldri bevares her.
- Oppdater relevant dokumentasjon i samme endring når kode eller atferd ellers ville gjort dokumentasjonen misvisende.
