import type { Endring } from '../domain/versjon'

/**
 * Endringsloggen appen viser, nyest først.
 *
 * Dette er den ene filen som redigeres når noe er endret, og den øverste
 * føringen er versjonen appen kjører. Tekstene er skrevet for dem som bruker
 * appen — filnavn, funksjonsnavn og annen utviklersjargong hører ikke hjemme
 * her.
 *
 * Rutinen for å legge inn en føring står i `docs/endringslogg.md`.
 */
export const ENDRINGSLOGG: Endring[] = [
  {
    versjon: '1.3.0',
    dato: '2026-08-27',
    sammendrag: 'Ny kategori: antihypertensiver',
    typer: ['Fag', 'Funksjonalitet'],
    omfang: 'Betydelig omfang',
    punkter: [
      '25 antihypertensiver kan nå kommenteres: enalaprilat, lisinopril, ramiprilat, eplerenon, kanrenon, karvedilol, labetalol, doksazosin, irbesartan, kandesartan, losartansyre, telmisartan, valsartan, atenolol, bisoprolol, metoprolol, bendroflumetiazid, bumetanid, furosemid, hydroklortiazid, amlodipin, diltiazem, lerkanidipin, nifedipin og verapamil.',
      'De går de samme tre stegene som psykofarmaka: søk opp analytten, velg konsentrasjonsbånd med musen eller tastene 1, 2 og 3, og kommentaren kopieres med det samme. Knappen du brukte følger med til «Lim inn kommentaren på», så du ser hvilken kommentar som ligger på utklippstavlen.',
      'Hver analytt har tre knapper. Kilden har fem intervaller, og de er slått sammen slik kommentarene tilsier: «under måleområdet» og «L» er én knapp, terapiområdet og «H» én, og toksisk konsentrasjon én. Kommentarene er kildens egne og er ikke endret av sammenslåingen.',
      'Bumetanid og furosemid har ikke noe definert terapiområde. De har de samme tre knappene, men ingen terapiområdepille.',
      'Over knappene står påvisningsgrensen, terapiområdet og grensen for toksisk konsentrasjon. Antihypertensiver har ingen ringegrense, så den pillen og påminnelsen om å ringe finnes ikke her.',
      'Kanrenon finnes også på «spironolakton», siden det er moderstoffet som står på rekvisisjonen. Enalaprilat, ramiprilat og losartansyre finnes på moderstoffnavnet fra før, fordi søket treffer på begynnelsen av navnet.',
      'Kommentartekstene er vasket for skrivefeil fra kilden: punktum er byttet til komma som desimaltegn i doser (for eksempel 12,5 mg), doble og harde mellomrom er fjernet, og «basert på bruk 5–40 mg daglig» er rettet til «basert på bruk av 5–40 mg daglig» slik de øvrige radene har det. Ingen tall eller faglig innhold er endret.',
    ],
  },
  {
    versjon: '1.2.0',
    dato: '2026-08-21',
    sammendrag: 'Ny modul: EtG og EtS i urin',
    typer: ['Fag', 'Funksjonalitet'],
    omfang: 'Betydelig omfang',
    punkter: [
      'EtG (etylglukuronid, UETGS) og EtS (etylsulfat, UETS) kan nå kommenteres. De to deler én fortolkning, så det spiller ingen rolle om du søker på forkortelsen, hele navnet, koden eller på «etanol» eller «alkohol».',
      'Du velger ett av tre tilfeller: begge påvist, bare EtG påvist eller bare EtS påvist. Knappene virker som båndknappene ellers i appen: et klikk eller tasten 1, 2 eller 3 kopierer kommentaren med det samme og tar deg videre til «Lim inn kommentaren på». Knappen du brukte følger med og blir stående over kortet, så du ser hva som ligger på utklippstavlen.',
      'Er bare den ene påvist, får den påviste analytten kommentaren om at funnet kan være forenlig med inntak, og den andre ingen kommentar. Enter eller mellomrom avslutter.',
      'Er begge påvist, står begge kommentarene i limsteget med hver sin kode: kommentaren om at etanol er inntatt på UETS, og henvisningen dit på UETGS. Enter eller mellomrom kopierer henvisningen, og én gang til avslutter.',
      'Esc går tilbake til valget hvis du kom til å velge feil.',
      'Tallene på de tre knappene står alltid, også når hurtigtastmerkene ellers er slått av.',
    ],
  },
  {
    versjon: '1.1.0',
    dato: '2026-08-21',
    sammendrag: 'THC-modulen kan tolke en forrige prøve som var «ikke påvist»',
    typer: ['Fag', 'Funksjonalitet'],
    omfang: 'Moderat omfang',
    punkter: [
      'Er IRCAK 0 i forrige prøve, konkluderer kommentaren nå med at cannabis har vært inntatt etter den prøven, uansett hvor lav konsentrasjonen er i denne prøven. Før stoppet verktøyet og ba deg krysse av for at ingen tidligere prøve fantes.',
      'Er det mer enn 60 dager mellom prøvene, gjelder den gamle regelen som før: forrige prøve settes til side, og kommentaren fortolker bare denne prøven.',
      'Ny avmerkingsboks «Under cut-off» øverst i «Forrige prøve». Den er for tilfellet der urinen var så fortynnet at THC-syre havnet under påvisningsgrensen og ble rapportert som «ikke påvist», selv om labsystemet internt har et tall.',
      'Krysser du av, byttes IRCAK-feltet ut med UCAK (THC-syre) og NKRE (kreatinin). Appen regner ut IRCAK som UCAK delt på NKRE, viser resultatet rett under feltene og fortolker med det.',
      'Fordi en slik fortolkning bygger på et tall under påvisningsgrensen, legges 50 % større måleusikkerhet til grunn. Det gjør konklusjonen mer forsiktig, og et banner over sikkerhetsmarginen sier fra om det.',
      'Kommentaren får da sin egen ordlyd i de to tilfellene der inntaket ikke er sikkert nytt: den forklarer at nivået kan svinge over og under påvisningsgrensen uten at noe nytt er inntatt, eller at inntakstidspunktet ikke kan avgjøres. Er inntaket sikkert nytt, er kommentaren den samme som før.',
    ],
  },
  {
    versjon: '1.0.0',
    dato: '2026-08-17',
    sammendrag: 'Appen har fått versjonsnummer og endringslogg',
    typer: ['Funksjonalitet', 'Design / layout'],
    omfang: 'Moderat omfang',
    punkter: [
      'Versjonsnummeret står nederst til høyre på skjermen.',
      'Et klikk på det åpner denne loggen. Hver endring har sin egen skuff med dato, versjonsnummer og en kort beskrivelse, og skuffen kan åpnes for å se hva som konkret ble gjort.',
      'Alle tidligere endringer er ført inn med tilbakevirkende kraft. Denne utgaven er den første som er merket med et versjonsnummer, og starter derfor på 1.0.0.',
    ],
  },
  {
    versjon: '0.10.0',
    dato: '2026-08-14',
    sammendrag: 'Konsentrasjonsfeltene tar bare tall, og mellomrom bekrefter overalt',
    typer: ['Funksjonalitet'],
    omfang: 'Moderat omfang',
    punkter: [
      'Felt som tar en konsentrasjon godtar tall og bare tall. Bokstaver, mellomrom og fortegn slipper ikke inn, verken tastet eller limt inn. Både komma og punktum virker som desimaltegn.',
      'Mellomrom gjør nå det samme som Enter overalt i appen, men bare der tasten ikke alt har en jobb: i søkefeltet skrives mellomrommet fortsatt inn, og står du på en knapp, trykkes knappen.',
      'Etter en kopiering hentes knappene fram i bildet, så du ser kvitteringen på den du brukte og at den neste står klar.',
    ],
  },
  {
    versjon: '0.9.0',
    dato: '2026-08-14',
    sammendrag: 'Ny kategori: stoffer med ruspotensial i serum',
    typer: ['Fag', 'Funksjonalitet'],
    omfang: 'Betydelig omfang',
    punkter: [
      'Benzodiazepiner og Z-hypnotika, cannabis, opioider og sentralstimulerende stoffer har fått egne fortolkningsmoduler. Søker du opp ett av stoffene, går appen dit i stedet for til konsentrasjonsbånd.',
      'For disse stoffene varierer ikke kommentaren med konsentrasjonen. Det finnes én kommentar per stoff, og derfor ingen bånd å velge mellom.',
      'Modulen sier hvilken analyttkode kommentaren skal ligge på. Tolkes flere stoffer samlet, legges hovedkommentaren på én kode, og de andre får en tilleggskommentar som henviser dit.',
      'Stoffer som tolkes sammen deler én modul. Diazepam, N-desmetyldiazepam og oksazepam fører alle tre til den samme, enten du søker på navnet eller på koden.',
    ],
  },
  {
    versjon: '0.8.0',
    dato: '2026-08-13',
    sammendrag: 'Båndknappen følger med videre som bevis på hva som ble kopiert',
    typer: ['Design / layout', 'Funksjonalitet'],
    omfang: 'Mindre omfang',
    punkter: [
      'Kvitteringen sa at noe var kopiert, men på neste bilde gikk det ikke fram hva. Nå flyter selve båndknappen opp og blir stående over lim-inn-kortet, i samme farge og med samme ikon.',
      'Kommentarteksten henger fortsatt på den, så hele teksten kan leses en siste gang før den limes inn.',
      'Hurtigtastmerket blir igjen i båndsteget. Tasten har gjort jobben sin når kommentaren først er kopiert.',
    ],
  },
  {
    versjon: '0.7.0',
    dato: '2026-08-12',
    sammendrag: 'Ett felles system for forklaringsbobler i hele appen',
    typer: ['Design / layout', 'Funksjonalitet'],
    omfang: 'Moderat omfang',
    punkter: [
      'Appen hadde flere ulike måter å vise forklaringer på. Nå er det én, og den virker likt overalt.',
      'Boblen ligger fast til vinduet og klippes ikke lenger av kanten på kortet teksten står i. Kommentaren i båndsteget peker derfor nå på den knappen den faktisk gjelder, i stedet for å spenne over hele raden.',
      'Boblen finner selv plass: over teksten når det er rom, ellers under, og skjøvet innover når den ellers ville stukket utenfor vinduet.',
      'Tekst som bærer en forklaring er merket med prikkestrek, og forklaringen kommer fram både ved peker og ved tastaturfokus.',
    ],
  },
  {
    versjon: '0.6.0',
    dato: '2026-08-12',
    sammendrag: 'Sikkerhetsmarginen i THC-modulen kan velges',
    typer: ['Fag', 'Funksjonalitet'],
    omfang: 'Moderat omfang',
    punkter: [
      'Marginen var låst til verdien fra regnearket. Nå kan du velge mellom «Ingen», «90 %» og «99 %». 90 % er regnearkets egen og står som standard.',
      'Valget slår gjennom på konklusjonen, på kommentaren, på punktet i figuren og på ordlyden i forklaringen. De samme prøvene kan lande på ulik konklusjon avhengig av hvilket stopp skalaen står på.',
      'En linje under figuren sier hvilken margin punktet står med, så det ikke ser ut som en måling.',
    ],
  },
  {
    versjon: '0.5.4',
    dato: '2026-08-12',
    sammendrag: 'Forrige prøve står til venstre, og bildet hopper ikke lenger av seg selv',
    typer: ['Design / layout', 'Funksjonalitet'],
    omfang: 'Minimalt omfang',
    punkter: [
      '«Forrige prøve» står nå til venstre og «Denne prøven» til høyre, i den rekkefølgen de leses.',
      'Bildet hopper ikke lenger ned til kommentaren av seg selv i det den lar seg regne ut. Det ruller når du selv navigerer, eller etter en kopiering.',
    ],
  },
  {
    versjon: '0.5.3',
    dato: '2026-08-11',
    sammendrag: 'Forklaringen i THC-modulen er delt i bolker med overskrifter',
    typer: ['Design / layout'],
    omfang: 'Mindre omfang',
    punkter: [
      'De fem avsnittene under figuren er delt i tre bolker med hver sin overskrift, så leddene i resonnementet kan finnes igjen uten å lese alt.',
      'Forholdstallet mellom målingene vises nå med regnestykket bak seg, og dagene mellom prøvene står i den bolken der de brukes.',
      'Bare forklaringsteksten er endret. Selve kommentaren er urørt.',
    ],
  },
  {
    versjon: '0.5.2',
    dato: '2026-08-11',
    sammendrag: 'Figuren i THC-modulen viser kurven konklusjonen bygger på',
    typer: ['Fag'],
    omfang: 'Mindre omfang',
    punkter: [
      'Regnearket appen bygger på tegnet én kurve i figuren, men avgjorde konklusjonen ut fra en annen. Appen hadde arvet det.',
      'Figuren viser nå de tre kurvene svaret faktisk sammenlignes med, så et punkt over eller under en kurve svarer til den vurderingen som velger kommentar.',
      'Kommentarene, grensene og selve beregningen er uendret.',
    ],
  },
  {
    versjon: '0.5.1',
    dato: '2026-08-11',
    sammendrag: 'Enter gjør det samme uansett hvor markøren står i THC-modulen',
    typer: ['Funksjonalitet'],
    omfang: 'Mindre omfang',
    punkter: [
      'Enter kopierer kommentaren uansett hvilket felt du står i. Før kunne tasten åpne kalenderen i datofeltet i stedet, avhengig av hvor markøren tilfeldigvis sto.',
      'Feltene slipper fokus i det kommentaren er klar, så et felt utenfor bildet ikke stjeler tastetrykk.',
      'Rett etter en kopiering tar Enter i stedet imot tilbudet om å nullstille.',
    ],
  },
  {
    versjon: '0.5.0',
    dato: '2026-08-10',
    sammendrag: 'Ny modul: fortolkning av THC-syre i urin (IRCAK)',
    typer: ['Fag', 'Funksjonalitet'],
    omfang: 'Betydelig omfang',
    punkter: [
      'Søk på «THC-syre» eller «IRCAK» åpner en egen fortolkningsmodul i stedet for konsentrasjonsbånd.',
      'Modulen er en nettutgave av regnearket som har vært brukt til dette, med de samme kurvene, grensene og kommentartekstene.',
      'Du fyller inn kreatininkorrigert THC-syrekonsentrasjon og prøvedato for denne og forrige prøve, og krysser av for kronisk bruk. Kommentaren regnes ut fortløpende mens du fyller ut — det finnes ingen «Beregn»-knapp.',
      'Mangler noe, viser et eget kort hva som gjenstår, og kopier-knappen kommer først når det finnes en kommentar å kopiere.',
      'En figur viser hvor prøven ligger i forhold til utskillelseskurvene, og en forklaring under den gjør resonnementet etterprøvbart.',
    ],
  },
  {
    versjon: '0.4.0',
    dato: '2026-08-10',
    sammendrag: 'Ett gjenstående søketreff velger seg selv',
    typer: ['Funksjonalitet'],
    omfang: 'Mindre omfang',
    punkter: [
      'Smalner søket inn til én eneste analytt, går appen videre til den med én gang, uten et tastetrykk til.',
      'Automatikken slår bare til i selve overgangen til ett treff. Veien tilbake med Esc eller «Bytt analytt» sender deg derfor ikke rett inn i den samme analytten igjen.',
      'Det ene alternativet kan fortsatt velges for hånd, med Enter, mellomrom, talltast eller klikk.',
    ],
  },
  {
    versjon: '0.3.0',
    dato: '2026-08-10',
    sammendrag: 'Talltastene avslutter også på siste bilde',
    typer: ['Funksjonalitet'],
    omfang: 'Minimalt omfang',
    punkter: [
      'På bildet der kommentaren skal limes inn avslutter nå en hvilken som helst talltast, i tillegg til Enter og mellomrom som virket fra før.',
      'Da kan den samme tasten som nettopp valgte båndet også avslutte, uten at hånden må flytte seg.',
    ],
  },
  {
    versjon: '0.2.2',
    dato: '2026-08-07',
    sammendrag: 'Kodemerket løftes fra navnet, og «Sum: » gir ikke lenger søketreff',
    typer: ['Design / layout', 'Funksjonalitet'],
    omfang: 'Mindre omfang',
    punkter: [
      'Analyttkoden har fått luft ned til navnet, så den leses som merkelappen den er og ikke som første linje i navnet.',
      'Søk på «s», «su» eller «sum» gir ikke lenger treff på hver eneste sumanalyse. Søket går på koder, analyttnavn, metabolitter og aliaser.',
      '«sum amitriptylin» finner altså ikke lenger sumanalysen, mens «amitriptylin nortriptylin» fortsatt gjør det.',
    ],
  },
  {
    versjon: '0.2.1',
    dato: '2026-08-07',
    sammendrag: 'Analyttnavnet står størst i søkealternativene',
    typer: ['Design / layout'],
    omfang: 'Mindre omfang',
    punkter: [
      'Koden sto størst, selv om navnet er det de fleste kjenner igjen. Nå står moderstoffets navn størst og tydeligst, og koden er krympet til en liten merkelapp.',
      'Sumanalyser lister metabolittene under moderstoffet, én per linje.',
      '«Sum: » er tatt bort fra navnet i båndsteget. At noe er en sum går fram av navnet selv.',
    ],
  },
  {
    versjon: '0.2.0',
    dato: '2026-08-07',
    sammendrag: 'Båndknappene på én linje, kommentaren kan leses, og kopieringen kvitteres',
    typer: ['Design / layout', 'Funksjonalitet'],
    omfang: 'Moderat omfang',
    punkter: [
      'Knappene for konsentrasjonsbånd deler bredden likt og brytes ikke over flere linjer, så et konsentrasjonsintervall aldri blir klippet i to.',
      'Kommentaren som hører til et bånd vises i en boble over knappene, både ved peker og ved tastaturfokus, så den kan leses før båndet velges.',
      'Et blink ved knappen kvitterer for at kommentaren er kopiert, også når båndet ble valgt med en talltast.',
    ],
  },
  {
    versjon: '0.1.0',
    dato: '2026-08-06',
    sammendrag: 'Første utgave: søk opp analytten, velg bånd, få kommentaren kopiert',
    typer: ['Fag', 'Funksjonalitet'],
    omfang: 'Betydelig omfang',
    punkter: [
      '35 analytter med referanseområde, måleområde og ringegrense er hentet fra kommentarsamlingen og lagt inn i appen.',
      'Arbeidsflyten er tre steg: søk opp analytten, velg hvilket konsentrasjonsbånd svaret ligger i, og lim inn kommentaren som da er kopiert.',
      'Alt kan gjøres med tastaturet alene. Tallene velger alternativ, Enter og mellomrom bekrefter, og Esc går tilbake.',
      'Skrivefeil og feil bindestreker i kildeteksten er rettet, og hver rettelse er notert med kilde og begrunnelse.',
      'Der kilden er selvmotsigende — overlappende eller manglende grenser — er forholdet dokumentert i stedet for at appen gjetter.',
    ],
  },
]
