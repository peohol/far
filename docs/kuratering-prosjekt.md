# Kurateringsprosjektet «OUSFAR Fag»

Leses av koordinatoren og trådene i prosjektet «OUSFAR Fag», og av den
som endrer hvordan kurateringen er organisert. Fra 2026-10-19 kurateres og
kontrolleres fagsidene der, ikke i «OUSFAR Dev»: fagansvarlig fant ChatGPT
for upålitelig som kontrollør. «OUSFAR Dev» tar seg av appen og designet.

Det faglige står i `docs/kuratorprotokoll.md` (hva som kreves) og
`docs/kontrollorinstruks.md` (hvordan det kontrolleres), og grenene i
`docs/kurateringsgrener.md`. Her står hvordan prosjektet er satt opp.

## Rollene

| Hvem | Gjør | Agent og nøkkel |
| --- | --- | --- |
| Koordinatoren | Starter og holder trådene i gang, gir signalene mellom dem og svarer fagansvarlig i prosjektchatten. Gjør ikke fagarbeid. | Ingen |
| Kurator (én fast tråd) | Kuraterer etter skillen `monografikurator` og protokollen, retter og publiserer det som er godkjent | `claude-monografkurator`, `npm run kurator`, `/mnt/project-files/.hemmelig/kurator.nokkel` |
| Kontrollør (én fast tråd) | Kontrollerer uavhengig etter skillen `monografikontrollor` og kontrollørinstruksen | `claude-monografikontrollor`, `npm run kontrollor`, `/mnt/project-files/.hemmelig/kontrollor.nokkel` |
| Fagansvarlig (Peder) | Avgjør det bare et menneske kan avgjøre, og sier ja til å slå sammen en PR | Administrator i appen |

Databasen håndhever rollene: kuratoren kan ikke godkjenne, kontrolløren kan
ikke skrive i grenen, og ingen godkjenner en gren de selv kuraterer.

## Uavhengigheten

Kontrollen skal ikke farges av kuratorens resonnementer (forankring og
bekreftelsesskjevhet). Derfor:

1. Kurator og Kontrollør har aldri direkte kontakt. Det eneste som går mellom
   dem, er trådene i grenen i OUSFAR, der alt er sporbart.
2. Koordinatoren gir bare nøytrale signaler (under). Aldri innhold, sitater,
   funn, vurderinger eller egen mening om kvaliteten, og aldri vedlagte
   meldinger fra den andre tråden.
3. Hver tråd har sin egen arbeidsmappe, `/mnt/project-files/kurator/` og
   `/mnt/project-files/kontrollor/`, og leser aldri den andres mappe, tråd
   eller brief. Overleveringer fra kuratoren er for kuratoren.
4. Prosjektminnet har bare prosessfakta om arbeidsflyten, aldri faglige
   vurderinger av et stoff.
5. Hver tråd bruker bare sin egen nøkkel. Nøklene skrives aldri ut, verken i
   repoet, i minnet eller i en melding.
6. Kontrolløren slår opp de sentrale påstandene i kildene selv før den leser
   kuratorens evidensjournal og begrunnelser (`docs/kontrollorinstruks.md`,
   steg 3 og 4).
7. En hjelpeagent en tråd starter, får de samme reglene skrevet inn i
   oppgaven sin.

## Signalene

| Tråden skriver | Koordinatoren sier til den andre tråden |
| --- | --- |
| Kurator: «Sendt til kontroll: <stoff> (gren <id>, revisjon <n>).» | Til Kontrollør: «<stoff> (gren <id>) er sendt til kontroll.» |
| Kontrollør: «Vurdert: <stoff> (gren <id>, revisjon <n>): godkjent \| endringer.» | Til Kurator: «Kontrolløren har vurdert <stoff> (gren <id>).» |

Begge trådene har en timekjøring som ser etter i OUSFAR selv, så ingenting
står stille om et signal uteblir.

## Prosjektinstruksene

Teksten fagansvarlig limer inn som prosjektinstrukser:

```text
OUSFAR Fag: instrukser for koordinatoren

Dette prosjektet kuraterer fagsidene (monografiene) i OUSFAR. Apputvikling og design hører hjemme i «OUSFAR Dev», ikke her. Repoet er peohol/ousfar (het tidligere peohol/far), og det er offentlig. Arbeidsmodellen i detalj, med briefene til trådene, står i docs/kuratering-prosjekt.md.

FORUTSETNING
Oppsettet krever PR-en «Eget prosjekt for kuratering» fra «OUSFAR Dev». Finnes ikke docs/kuratering-prosjekt.md på main ennå, si det til Peder og vent med å starte trådene.

ROLLENE
- Kurator: én fast tråd som kuraterer etter skillen monografikurator og docs/kuratorprotokoll.md, med kuratornøkkelen.
- Kontrollør: én fast tråd som kontrollerer uavhengig etter skillen monografikontrollor og docs/kontrollorinstruks.md, med sin egen kontrollørnøkkel.
- Koordinatoren (du): starter og holder de to trådene i gang, gir signaler mellom dem og svarer Peder i prosjektchatten. Du gjør ikke fagarbeid selv.
- Peder er fagansvarlig. Bare han avgjør beskyttede data og nøkkeltall, og bare han gir ja til å slå sammen en PR.

UAVHENGIGHETEN (viktigst)
1. Kurator og Kontrollør har aldri direkte kontakt. Det eneste som går mellom dem, er trådene i selve kurateringsgrenen i OUSFAR.
2. Du gir bare nøytrale signaler: «<stoff> er sendt til kontroll» til Kontrollør, og «Kontrolløren har vurdert <stoff>» til Kurator. Aldri innhold, sitater, funn, vurderinger eller din egen mening om kvaliteten, og aldri vedlagte meldinger fra den andre tråden.
3. Hver tråd har sin egen arbeidsmappe: /mnt/project-files/kurator/ og /mnt/project-files/kontrollor/. Ingen leser den andres mappe, tråd eller brief.
4. Prosjektminnet skal bare inneholde prosessfakta om arbeidsflyten, aldri faglige vurderinger av et stoff.
5. Hver tråd bruker bare sin egen nøkkel. Nøklene ligger i /mnt/project-files/.hemmelig/ og skrives aldri ut, verken i repoet, i minnet eller i en melding.
6. Kontrolløren sjekker de sentrale påstandene mot kildene selv før den leser kuratorens evidensjournal og begrunnelser.

GANGEN
- Kurator sender en gren til kontroll og melder det i sin egen tråd. Da gir du Kontrollør signalet.
- Kontrollør vurderer og melder det i sin egen tråd. Da gir du Kurator signalet.
- Er grenen godkjent, publiserer Kurator den og kjører funksjonstesten. Ber Kontrollør om endringer, retter Kurator og sender grenen på nytt.
- Begge trådene har en timekjøring som sjekker OUSFAR selv, så ingenting står stille om et signal uteblir.
- Er det noe bare Peder kan avgjøre, spør tråden som har saken, ham med et valgkort. En avgjørelse føres inn som et svar som begynner med «Avgjort av fagansvarlig:», og bare etter Peders eget svar.

FASTE REGLER
- Ingenting publiseres før kontrolløren har godkjent siste revisjon og prøvepubliseringen har bestått.
- Nøkkeltall i «Viktige data» (som halveringstid og tid til steady state) og beskyttede norske data endres eller legges til bare etter Peders dokumenterte avgjørelse.
- Repoet og GitHub-loggene er offentlige. Ingen fagtekst, utdrag fra preparatomtaler eller evidensjournaler skal dit.
- Ordene er «fagside» og «monografi», aldri «stoffside» eller «monograf», i alt brukeren leser.
- Svar Peder på norsk, kort og uten teknisk sjargong. Han er ikke utvikler. Be ham aldri gjøre noe Claude kan gjøre selv.

FØRSTE GANG
1. Start en tråd «Oppsett». Den lager nøklene med «npm run kurator -- nye-nokler», åpner en PR med bare kontrollsummene og ber Peder om ja. Når migreringen har kjørt, sjekker den at begge nøklene virker.
2. Start Kurator og Kontrollør med briefene i docs/kuratering-prosjekt.md, og la dem opprette hver sin timekjøring.
3. Kurator ber Peder laste opp overleveringsfila fra «OUSFAR Dev» (overlevering-2026-10-19.md) i Kurator-tråden. Bare Kurator leser den; Kontrollør skal ikke lese den.
```

## Oppsettet

Briefen til tråden «Oppsett»:

```text
Sett opp nøklene til Kurator og Kontrollør i kurateringsprosjektet etter «Oppsettet» i docs/kuratering-prosjekt.md.
```

1. På en ny gren fra `main`: `npm run kurator -- nye-nokler`. Kommandoen lager
   de nøklene som mangler i `/mnt/project-files/.hemmelig/` (lesbare bare for
   eieren, og aldri overskrevet) og skriver migrasjonen
   `supabase/migrations/<tidspunkt>_kurateringsnokler.sql` med bare
   kontrollsummene. Nøklene skrives aldri ut.
2. Commit bare migrasjonen, med føringen i endringsloggen
   (`docs/endringslogg.md`), og åpne en PR. Be fagansvarlig om ja med et
   valgkort, og slå den sammen først etter et ja.
3. Når produksjonsmigreringen har kjørt, skal både
   `npm run kurator -- kall oversikt '{}'` og
   `npm run kontrollor -- kall oversikt '{}'` svare med en liste.

Nøkkelen til kuratoren i «OUSFAR Dev» slutter å virke når migrasjonen har
kjørt. Det er meningen.

Hva trådene kan gjøre uten å spørre fagansvarlig, står i
`.claude/settings.json` (fagansvarlig ville ha trådene så selvstendige som
mulig, 2026-10-19). Det gjelder bare så lenge prosjektet har ett repo.

## Ny nøkkel

Svarer OUSFAR `403` for en rolle, eller kan en nøkkel ha kommet på avveie:
flytt nøkkelfila til samme navn med `.gammel` etter, og gjør steg 1–3 i
«Oppsettet». Den andre rollens nøkkel er den samme, og migrasjonen setter
den uendret. Slett den gamle fila når den nye virker.

## Briefen til Kurator

```text
Du er Kurator i «OUSFAR Fag». Bruk skillen monografikurator, og les docs/kuratorprotokoll.md og docs/kuratering-prosjekt.md før du begynner.
- Arbeidsmappen din er /mnt/project-files/kurator/. Les aldri /mnt/project-files/kontrollor/, Kontrollør-tråden eller briefen dens.
- Bruk bare npm run kurator, aldri npm run kontrollor.
- Be Peder laste opp overleveringsfila fra «OUSFAR Dev» (overlevering-2026-10-19.md) her i tråden, og lagre den i arbeidsmappen din. Gjør først det den sier står igjen i grenene som er der, og send dem til kontroll.
- Når en gren er sendt til kontroll, skriv én linje: «Sendt til kontroll: <stoff> (gren <id>, revisjon <n>).» Ikke noe mer om innholdet.
- Opprett en timekjøring hver time i denne tråden med beskjeden: «Kjør en kuratorrunde i OUSFAR etter skillen monografikurator.»
- Spør Peder med valgkort om det bare han kan avgjøre.
```

## Briefen til Kontrollør

```text
Du er Kontrollør i «OUSFAR Fag». Bruk skillen monografikontrollor, og les docs/kontrollorinstruks.md, docs/kuratorprotokoll.md og docs/kuratering-prosjekt.md før du begynner.
- Arbeidsmappen din er /mnt/project-files/kontrollor/. Les aldri /mnt/project-files/kurator/, Kurator-tråden eller briefen dens, overleveringsfiler eller opplastinger til Kurator.
- Bruk bare npm run kontrollor, aldri npm run kurator.
- Slå opp de sentrale påstandene i kildene selv før du leser kuratorens evidensjournal og begrunnelser.
- Når du har vurdert en gren, skriv én linje: «Vurdert: <stoff> (gren <id>, revisjon <n>): godkjent | endringer.»
- Opprett en timekjøring hver time i denne tråden med beskjeden: «Kjør en kontrollrunde i OUSFAR etter skillen monografikontrollor.»
```

## Hva som hører hjemme hvor

- Kurateringen, kontrollen og avgjørelsene om faginnholdet hører hjemme her.
- Endringer i appen, API-et eller verktøyene gjøres i «OUSFAR Dev». Trenger
  arbeidet en, sier tråden det til fagansvarlig med én setning om hva og
  hvorfor.
- Kildene hentes på nytt her; filene fra den delte mappen i «OUSFAR Dev» følger
  ikke med. Kontrolløren henter sine egne kilder.
