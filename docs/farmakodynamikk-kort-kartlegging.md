# Kartlegging av farmakodynamiske mekanismer for stoffregisteret

## Formål

Denne filen kartlegger farmakodynamikken som allerede er beskrevet i OUSFAR, slik at dagens fritekst kan erstattes av strukturerte mekanismekort uten å tilføre ny farmakologisk informasjon.

Grunnlaget er:

- de publiserte psykofarmaka-importfilene i `supabase/import/psykofarmaka/`;
- antihypertensivene som er strukturert fra `originaldata/antihypertensiver.docx` i PR #145 (`supabase/import/antihypertensiver/`);
- den autoritative stofflisten i `src/data/stoffregister.json`.

Kartleggingen omfatter alle 99 stoffene i stoffregisteret. 60 har farmakodynamikktekst i disse datasettene; 39 har foreløpig ingen farmakodynamikktekst som kan konverteres.

## Viktig klassifiseringsregel

Taksonomien skal ikke brukes til å gjøre eksisterende tekst mer presis enn den er.

Hvis teksten bare sier «antagonist», skal kortet derfor være **antagonisme, subtype ikke angitt** — ikke automatisk «kompetitiv antagonisme». Tilsvarende skal ACE-hemming være **enzymhemming, subtype ikke angitt**, siden dagens tekst ikke sier om hemmingen er kompetitiv, ikke-kompetitiv eller allosterisk.

Det samme gjelder affinitet: «lav affinitet», «moderat affinitet» eller «binder» er ikke i seg selv nok til å kalle noe agonisme eller antagonisme.

Dette betyr at implementasjonen trenger noen nøytrale fallback-varianter i tillegg til de spesifikke mekanismetypene i ønsket taksonomi:

- reseptoragonisme, grad ikke angitt;
- reseptorantagonisme, subtype ikke angitt;
- reseptorbinding/affinitet uten angitt funksjonell effekt;
- enzymhemming, subtype ikke angitt;
- ionekanalpåvirkning uten angitt retning;
- annen fysiologisk konsekvens uten angitt målprotein.

Disse fallback-variantene skal ikke tolkes som nye farmakologiske påstander. De finnes bare for å representere dagens tekst uten å gjette.

## Mekanismetyper fra ønsket liste som faktisk brukes

Følgende spesifikke mekanismer fra den foreslåtte listen er dokumentert i dagens innhold og bør få egne mekanismeikoner:

- **Partiell agonisme**
- **Kompetitiv antagonisme**
- **Kanalblokkering**
- **Bruks-/frekvensavhengig blokkering**
- **Transporterhemming**
- **Reopptakshemming**
- **Hemming/modulering av kotransportører**
- **Ingen effekt** — vises uten mekanismeikon, i tråd med ønsket

I tillegg forekommer mye **reseptorantagonisme uten angitt subtype**, **agonisme uten angitt grad** og **enzymhemming uten angitt subtype**. Disse bør ha nøytrale generiske ikoner, ikke ikoner som later som teksten sier «kompetitiv», «full agonist» eller en bestemt enzymkinetikk.

Følgende spesifikke typer er ikke dokumentert i dagens farmakodynamikktekst og trenger derfor ikke egne ikoner nå:

- full agonisme som uttrykkelig grad;
- invers agonisme;
- ikke-kompetitiv antagonisme;
- positiv eller negativ allosterisk reseptormodulering;
- kanalåpning;
- positiv eller negativ allosterisk kanalmodulering;
- tilstandsavhengig blokkering som uttrykkelig mekanisme;
- transportreversering/frigjøring;
- pumpehemming eller pumpeaktivering;
- ionebytterhemming/-modulering;
- kompetitiv, ikke-kompetitiv eller allosterisk enzymhemming som uttrykkelig subtype;
- allosterisk enzymaktivering;
- kofaktor-/koenzymmodulering.

## Retning og farge

Kolonnen **Retning** gjelder den direkte prosessen som står på kortet, ikke hele den kliniske nettovirkningen:

- `↓`: den navngitte reseptoraktiviteten, transporten, kanalstrømmen eller enzymaktiviteten reduseres → rød markering;
- `↑`: den navngitte reseptoraktiviteten økes → grønn markering;
- `0`: ingen/ubetydelig effekt → nøytral/grå;
- `?`: dagens tekst sier ikke nok til å avgjøre retningen → nøytral/grå.

Dette unngår for eksempel at en α2-antagonist får grønn farge bare fordi den nedstrøms øker noradrenerg transmisjon: selve α2-reseptoraktiviteten reduseres, og kortets direkte retning er derfor `↓`.

## Stoffer med kartlagt farmakodynamikk

### Amisulprid

_Kildegrunnlag: main: supabase/import/psykofarmaka/AMIS.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| D3-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| D1-reseptor | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| D4-reseptor | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| D5-reseptor | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| 5-HT-reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet; subtype ikke oppgitt |
| α-adrenerge reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet; subtype ikke oppgitt |
| H1-reseptor | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Kolinerge reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet; subtype ikke oppgitt |

### Amitriptylin

_Kildegrunnlag: main: supabase/import/psykofarmaka/AMTNORSUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Noradrenalinreopptak / NET | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Natriumkanaler | Påvirker | Ionekanalmodulering → retning ikke angitt i teksten | ? | Teksten sier bare «virkning på» |
| Kaliumkanaler | Påvirker | Ionekanalmodulering → retning ikke angitt i teksten | ? | Teksten sier bare «virkning på» |
| NMDA-reseptor/kanal | Påvirker | Ionekanalmodulering → retning ikke angitt i teksten | ? | Teksten sier bare «virkning på NMDA-kanaler» |
| Muskarinreseptorer | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| Histamin H1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |

### Amlodipin

_Kildegrunnlag: main: supabase/import/antihypertensiver/Amlodipin.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Spenningsstyrte L-type Ca2+-kanaler | Hemmer kalsiuminnstrømming / blokkerer kanalaktivitet | Ionekanalmodulering → kanalblokkering | ↓ | Primært vaskulær glatt muskulatur; ved svært høye konsentrasjoner også hjertemuskel |

### Aripiprazol

_Kildegrunnlag: main: supabase/import/psykofarmaka/ARISUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D2-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ | Høy affinitet |
| 5-HT1A-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ |  |
| 5-HT2A-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |

### Atenolol

_Kildegrunnlag: main: supabase/import/antihypertensiver/Atenolol.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| β1-adrenerg reseptor | Konkurrerende antagonist | Reseptormodulering → kompetitiv antagonisme | ↓ | Selektiv |
| β2-adrenerge reseptorer | Liten/ingen relevant blokkade | Ingen effekt | 0 | Påvirkes lite; β2-mediert bronkodilatasjon og adrenalins vasodilaterende effekt blokkeres ikke |

### Bendroflumetiazid

_Kildegrunnlag: main: supabase/import/antihypertensiver/Bendroflumetiazid.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Na+/Cl−-kotransportør i distale tubuli | Hemmer | Transportører, pumper og exchangere → hemming/modulering av kotransportører | ↓ | Øker diurese; reduserer kalsiumutskillelse i urin og nyrenes evne til å fortynne urin |

### Bisoprolol

_Kildegrunnlag: main: supabase/import/antihypertensiver/Bisoprolol.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| β1-adrenerg reseptor | Antagonist / blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Meget selektiv; ingen egenstimulerende aktivitet |
| β2-adrenerge reseptorer | Lav affinitet / forventet liten effekt | Ingen effekt | 0 | Generelt ikke forventet å påvirke luftveismotstand eller β2-medierte metabolske effekter |

### Brekspiprazol

_Kildegrunnlag: main: supabase/import/psykofarmaka/BREK.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D2-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ | Høy affinitet |
| 5-HT1A-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ |  |
| 5-HT2A-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| Noradrenerge reseptorer | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Subtype ikke oppgitt |

### Bumetanid

_Kildegrunnlag: main: supabase/import/antihypertensiver/Bumetanid.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Na+/K+/2Cl−-kotransportør i oppadgående Henles sløyfe | Hemmer | Transportører, pumper og exchangere → hemming/modulering av kotransportører | ↓ | Slyngediuretikum |

### Bupropion

_Kildegrunnlag: main: supabase/import/psykofarmaka/HBUP.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Noradrenalinreopptak / NET | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Selektiv NDRI |
| Dopaminreopptak / DAT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Selektiv NDRI |
| Serotoninreopptak / SERT | Minimal effekt | Transportører, pumper og exchangere → påvirkning for liten til å spesifisere sikkert | ? | Minimal effekt på reopptak |

### Citalopram

_Kildegrunnlag: main: supabase/import/psykofarmaka/CITAL.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Kraftig og selektiv |
| Noradrenalinreopptak / NET | Ingen effekt | Ingen effekt | 0 |  |
| Dopaminreopptak / DAT | Ingen effekt | Ingen effekt | 0 |  |
| GABA-reopptak | Ingen effekt | Ingen effekt | 0 |  |
| Muskarinreseptorer | Ingen effekt | Ingen effekt | 0 |  |
| Histaminreseptorer | Ingen effekt | Ingen effekt | 0 |  |
| Adrenerge reseptorer | Ingen effekt | Ingen effekt | 0 |  |

### Diltiazem

_Kildegrunnlag: main: supabase/import/antihypertensiver/Diltiazem.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Spenningsstyrte L-type Ca2+-kanaler | Hemmer / blokkerer | Ionekanalmodulering → kanalblokkering | ↓ | Gjelder både hjertemuskelceller og glatt muskulatur; gir vasodilatasjon og påvirker AV- og sinusknute |

### Doksazosin

_Kildegrunnlag: main: supabase/import/antihypertensiver/Doksazosin.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Postsynaptisk α1-adrenerg reseptor | Konkurrerende antagonist | Reseptormodulering → kompetitiv antagonisme | ↓ | Selektiv |

### Doksepin

_Kildegrunnlag: main: supabase/import/psykofarmaka/DOKSUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Noradrenalinreopptak / NET | Hemmer trolig reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Mekanismen beskrives som dårlig kjent |

### Duloksetin

_Kildegrunnlag: main: supabase/import/psykofarmaka/DULO.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Noradrenalinreopptak / NET | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Dopaminreopptak / DAT | Hemmer reopptak svakt | Transportører, pumper og exchangere → reopptakshemming | ↓ | Svak effekt |
| Histaminreseptorer | Ingen signifikant effekt | Ingen effekt | 0 | Ikke signifikant affinitet |
| Dopaminreseptorer | Ingen signifikant effekt | Ingen effekt | 0 | Ikke signifikant affinitet |
| Kolinerge reseptorer | Ingen signifikant effekt | Ingen effekt | 0 | Ikke signifikant affinitet |
| Adrenerge reseptorer | Ingen signifikant effekt | Ingen effekt | 0 | Ikke signifikant affinitet |

**Merknad:** Teksten sier i tillegg at den smertehemmende effekten antas å skyldes potensering av nedadgående smertehemmende baner i CNS. Dette er en fysiologisk konsekvens uten angitt målprotein og bør ligge som utdypende tekst, ikke tvinges inn i en mer spesifikk mekanismetype.

### Enalapril

_Kildegrunnlag: main: supabase/import/antihypertensiver/Enalapril.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| ACE (angiotensinkonverterende enzym) | Hemmer | Enzymmodulering → enzymhemming (subtype ikke angitt) | ↓ | Reduserer angiotensin II og aldosteron; reduserer også nedbrytning av bradykinin |

### Eplerenon

_Kildegrunnlag: main: supabase/import/antihypertensiver/Eplerenon.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Aldosteron-/mineralokortikoidreseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Mindre Na+/væskereabsorpsjon og mindre K+-utskillelse; beskyttende effekt mot remodellering i hjertet |

### Escitalopram

_Kildegrunnlag: main: supabase/import/psykofarmaka/ESCIT.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Kraftig og selektiv |
| Noradrenalinreopptak / NET | Ingen effekt | Ingen effekt | 0 |  |
| Dopaminreopptak / DAT | Ingen effekt | Ingen effekt | 0 |  |
| GABA-reopptak | Ingen effekt | Ingen effekt | 0 |  |
| Muskarinreseptorer | Ingen effekt | Ingen effekt | 0 |  |
| Histaminreseptorer | Ingen effekt | Ingen effekt | 0 |  |
| Adrenerge reseptorer | Ingen effekt | Ingen effekt | 0 |  |

### Fluoksetin

_Kildegrunnlag: main: supabase/import/psykofarmaka/FLUOSUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Selektiv |
| Adrenerge reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Serotonerge reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Dopaminerge reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Histaminerge reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Muskarine reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| GABA-reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |

### Flupentiksol

_Kildegrunnlag: main: supabase/import/psykofarmaka/FLUP.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| α1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| 5-HT2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| Kolinerge reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Histaminreseptorer | Svak antihistaminerg effekt | Reseptormodulering → effektretning ikke eksplisitt angitt | ? |  |
| α2-reseptor | Ingen effekt | Ingen effekt | 0 | Ingen α2-reseptorantagonisme |

### Fluvoksamin

_Kildegrunnlag: main: supabase/import/psykofarmaka/FLUV.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Selektiv |
| Adrenerge reseptorer | Ubetydelig effekt | Ingen effekt | 0 | Ubetydelig affinitet |
| Histaminerge reseptorer | Ubetydelig effekt | Ingen effekt | 0 | Ubetydelig affinitet |
| Muskarine reseptorer | Ubetydelig effekt | Ingen effekt | 0 | Ubetydelig affinitet |
| Dopaminerge reseptorer | Ubetydelig effekt | Ingen effekt | 0 | Ubetydelig affinitet |
| Serotonerge reseptorer | Ubetydelig effekt | Ingen effekt | 0 | Ubetydelig affinitet |

**Merknad:** Teksten sier også «minimal effekt på noradrenerge prosesser». Det er ikke presist nok til å identifisere et målprotein eller en egen mekanismetype.

### Furosemid

_Kildegrunnlag: main: supabase/import/antihypertensiver/Furosemid.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Na+/K+/2Cl−-kotransportør i oppadgående Henles sløyfe | Hemmer | Transportører, pumper og exchangere → hemming/modulering av kotransportører | ↓ | Slyngediuretikum; økt diurese og redusert evne til å konsentrere urin |

### Haloperidol

_Kildegrunnlag: main: supabase/import/psykofarmaka/HALO.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Potent |

### Hydroklortiazid

_Kildegrunnlag: main: supabase/import/antihypertensiver/Hydroklortiazid.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Na+/Cl−-kotransportør i distale tubuli | Hemmer | Transportører, pumper og exchangere → hemming/modulering av kotransportører | ↓ | Øker diurese; sekundær utskillelse av K+ og bikarbonat |

### Irbesartan

_Kildegrunnlag: main: supabase/import/antihypertensiver/Irbesartan.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Angiotensin II AT1-reseptor | Blokkerer / antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Gir vasodilatasjon; reduserer aldosteron, ADH-frigjøring og renal reabsorpsjon av Na+/vann som nedstrøms effekter |

### Kandesartan

_Kildegrunnlag: main: supabase/import/antihypertensiver/Kandesartan.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Angiotensin II AT1-reseptor | Blokkerer / antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Reduserer aldosteron, ADH-frigjøring og renal reabsorpsjon av Na+/vann som nedstrøms effekter |

### Kariprazin

_Kildegrunnlag: main: supabase/import/psykofarmaka/KARSUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D2-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ |  |
| D3-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ |  |
| 5-HT1A-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ |  |
| 5-HT2B-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| 5-HT2A-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| H1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |

### Karvedilol

_Kildegrunnlag: main: supabase/import/antihypertensiver/Karvedilol.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| α1-adrenerg reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Selektiv α1-blokkade |
| β1-adrenerg reseptor | Antagonist / blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Ikke-selektiv betablokkade |
| β2-adrenerg reseptor | Antagonist / blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Ikke-selektiv betablokkade |

### Klomipramin

_Kildegrunnlag: main: supabase/import/psykofarmaka/KLOSUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Noradrenalinreopptak / NET | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| α1-adrenerg reseptor | α1-adrenerg effekt | Reseptormodulering → funksjonell retning ikke angitt | ? |  |
| Kolinerge reseptorer | Antikolinerg effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Kilden bruker effektnavn, ikke eksplisitt «antagonist» |
| Histaminreseptorer | Antihistaminerg effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Kilden bruker effektnavn, ikke eksplisitt «antagonist» |

### Klorprotiksen

_Kildegrunnlag: main: supabase/import/psykofarmaka/KLORP.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| 5-HT2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| α1-adrenerg reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| Kolinerge reseptorer | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| Histaminreseptorer | Antihistaminerg effekt | Reseptormodulering → effektretning ikke eksplisitt angitt | ? | Subtype ikke oppgitt |

### Klozapin

_Kildegrunnlag: main: supabase/import/psykofarmaka/KLOZ.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| 5-HT2A-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| α-adrenerge reseptorer | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Subtype ikke oppgitt |
| Kolinerge reseptorer | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| Histaminerge reseptorer | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| D1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Lav affinitet |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Lav affinitet |
| D3-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Lav affinitet |
| D4-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| D5-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Lav affinitet |

### Kvetiapin

_Kildegrunnlag: main: supabase/import/psykofarmaka/KVE.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| 5-HT2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høyere affinitet enn til D2 |
| D1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| H1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| α1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| α2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| Muskarinreseptorer (norkvetiapin) | Binder / har affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? | Aktiv metabolitt norkvetiapin |
| Noradrenalintransportør / NET (norkvetiapin) | Hemmer transportøren | Transportører, pumper og exchangere → transporterhemming | ↓ | Aktiv metabolitt norkvetiapin |
| 5-HT1A-reseptor (norkvetiapin) | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ | Aktiv metabolitt norkvetiapin |

### Labetalol

_Kildegrunnlag: main: supabase/import/antihypertensiver/Labetalol.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| α1-adrenerg reseptor | Antagonist / blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Selektiv α1-blokkade |
| β1-adrenerg reseptor | Antagonist / blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Ikke-selektiv betablokkade |
| β2-adrenerg reseptor | Antagonist / blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Ikke-selektiv betablokkade |

### Lamotrigin

_Kildegrunnlag: main: supabase/import/psykofarmaka/LAM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Spenningsstyrte natriumkanaler | Hemmer / blokkerer | Ionekanalmodulering → bruks-/frekvensavhengig blokkering | ↓ | Bruks- og spenningsavhengig |

**Merknad:** Teksten sier også at lamotrigin hemmer frigjøring av glutamat. Dette er en mekanistisk konsekvens uten angitt målprotein og bør ligge som utdypende tekst til natriumkanalkortet fremfor å gis en oppdiktet målproteinkategori.

### Lerkanidipin

_Kildegrunnlag: main: supabase/import/antihypertensiver/Lerkanidipin.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Spenningsstyrte L-type Ca2+-kanaler | Hemmer kalsiuminnstrømming / blokkerer kanalaktivitet | Ionekanalmodulering → kanalblokkering | ↓ | Primært glatte muskelceller i perifere motstandskar; ved svært høye konsentrasjoner også hjertemuskel |

### Levomepromazin

_Kildegrunnlag: main: supabase/import/psykofarmaka/LMP.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Dopaminerg transmisjon | Blokade | Reseptormodulering → målprotein og subtype ikke spesifisert | ↓ |  |
| Adrenerg transmisjon | Blokade | Reseptormodulering → målprotein og subtype ikke spesifisert | ↓ |  |
| Noradrenerg transmisjon | Blokade | Reseptormodulering → målprotein og subtype ikke spesifisert | ↓ |  |

### Lisinopril

_Kildegrunnlag: main: supabase/import/antihypertensiver/Lisinopril.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| ACE (angiotensinkonverterende enzym) | Hemmer | Enzymmodulering → enzymhemming (subtype ikke angitt) | ↓ | Reduserer angiotensin II og aldosteron; reduserer nedbrytning av bradykinin |

### Losartan

_Kildegrunnlag: main: supabase/import/antihypertensiver/Losartan.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Angiotensin II AT1-reseptor | Blokkerer / antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Gir vasodilatasjon; reduserer ADH, aldosteron og renal reabsorpsjon av Na+/vann som nedstrøms effekter |

### Lurasidon

_Kildegrunnlag: main: supabase/import/psykofarmaka/LURA.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D2-reseptor | Blokkerende/antagonistisk effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| 5-HT2A-reseptor | Blokkerende/antagonistisk effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet; kilden uttrykker blokade samlet som monoaminerg blokade |
| 5-HT7-reseptor | Blokkerende/antagonistisk effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet; kilden uttrykker blokade samlet som monoaminerg blokade |
| 5-HT1A-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ |  |
| Histaminreseptorer | Ingen effekt | Ingen effekt | 0 | Bindes ikke |
| Muskarinreseptorer | Ingen effekt | Ingen effekt | 0 | Bindes ikke |

### Metoprolol

_Kildegrunnlag: main: supabase/import/antihypertensiver/Metoprolol.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| β1-adrenerg reseptor | Antagonist / hemmer katekolamineffekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Selektiv |

### Mianserin

_Kildegrunnlag: main: supabase/import/psykofarmaka/MIASUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Presynaptisk α2-autoreseptor | Blokade / antagonistisk effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Øker noradrenerg effekt som nedstrøms konsekvens |
| Noradrenalinreopptak / NET | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| H1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| α1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| Kolinerge/muskarine reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen antikolinerg effekt |

### Mirtazapin

_Kildegrunnlag: main: supabase/import/psykofarmaka/MTZ.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Presynaptisk α2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Øker noradrenerg effekt som nedstrøms konsekvens |
| 5-HT2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| 5-HT3-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| 5-HT1-reseptorer | Serotonerg effekt medieres via reseptoren | Reseptormodulering → funksjonell retning ikke angitt | ? | Kilden sier ikke agonist/antagonist |
| Histaminreseptorer | Antihistaminerg effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Subtype ikke oppgitt |
| Kolinerge/muskarine reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen antikolinerg aktivitet |

### Nifedipin

_Kildegrunnlag: main: supabase/import/antihypertensiver/Nifedipin.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Spenningsstyrte L-type Ca2+-kanaler | Hemmer kalsiuminnstrømming / blokkerer kanalaktivitet | Ionekanalmodulering → kanalblokkering | ↓ | Primært glatte muskelceller i perifere motstandskar; ved svært høye konsentrasjoner også hjertemuskel |

### Nortriptylin

_Kildegrunnlag: main: supabase/import/psykofarmaka/NOR.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Noradrenalinreopptak / NET | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Potent |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Histaminreseptorer | Antihistaminerg effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Betydelig |
| Muskarinreseptorer | Antikolinerg effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Mindre antikolinergt enn amitriptylin |

### Olanzapin

_Kildegrunnlag: main: supabase/import/psykofarmaka/OLAN.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| 5-HT2A-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| 5-HT2C-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| D1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Lavere affinitet enn til 5-HT2 |
| D3-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| D4-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| α1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| H1-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| Kolinerge reseptorer | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |

### Paliperidon

_Kildegrunnlag: main: supabase/import/psykofarmaka/PALI.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Potent; sterk binding |
| 5-HT2-reseptor | Antagonistisk/blokkerende effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Sterk binding; funksjonen fremgår av samlet blokkeringsbeskrivelse |
| α1-reseptor | Blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| H1-reseptor | Blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | I litt mindre grad |
| α2-reseptor | Blokkerer | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | I litt mindre grad |
| Kolinerge reseptorer | Ingen effekt | Ingen effekt | 0 | Binder ikke |

### Paroksetin

_Kildegrunnlag: main: supabase/import/psykofarmaka/PARO.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| α1-adrenerg reseptor | Lav affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| α2-adrenerg reseptor | Lav affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| β-adrenerge reseptorer | Lav affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| D2-reseptor | Lav affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| 5-HT1-lignende reseptorer | Lav affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| 5-HT2-reseptor | Lav affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| H1-reseptor | Lav affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| Muskarinkolinerge reseptorer | Lav affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |

### Perfenazin

_Kildegrunnlag: main: supabase/import/psykofarmaka/PERF.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Dopaminreseptorer (subtype ikke oppgitt) | Reseptorblokade | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Særlig dopamin; kilden omtaler også bredere katekolaminreseptorblokade |

### Ramipril

_Kildegrunnlag: main: supabase/import/antihypertensiver/Ramipril.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| ACE (angiotensinkonverterende enzym) | Hemmer | Enzymmodulering → enzymhemming (subtype ikke angitt) | ↓ | Reduserer angiotensin II og aldosteron; øker bradykinin ved redusert nedbrytning |

### Risperidon

_Kildegrunnlag: main: supabase/import/psykofarmaka/RISPSUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Potent |

### Sertralin

_Kildegrunnlag: main: supabase/import/psykofarmaka/SERT.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ | Potent |
| Noradrenalinreopptak / NET | Svak reopptakshemming | Transportører, pumper og exchangere → reopptakshemming | ↓ | Svak effekt |
| Dopaminreopptak / DAT | Svak reopptakshemming | Transportører, pumper og exchangere → reopptakshemming | ↓ | Svak effekt |
| Muskarinreseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Serotoninreseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Dopaminreseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Adrenerge reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| Histaminreseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |
| GABA-reseptorer | Ingen effekt | Ingen effekt | 0 | Ingen affinitet |

**Merknad:** Teksten sier også at sertralin ikke øker katekolaminerg aktivitet. Dette kan stå som utdypende negativt funn, men har ikke et angitt målprotein.

### Spironolakton

_Kildegrunnlag: main: supabase/import/antihypertensiver/Spironolakton.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Aldosteron-/mineralokortikoidreseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Mindre Na+/væskereabsorpsjon og mindre K+-utskillelse; beskyttende effekt mot remodellering i hjertet |
| Kjønnshormonreseptorer | Påvirker | Reseptormodulering → funksjonell retning ikke angitt | ? | Mindre selektiv enn eplerenon; teksten sier bare at dette kan gi en viss effekt |

### Telmisartan

_Kildegrunnlag: main: supabase/import/antihypertensiver/Telmisartan.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Angiotensin II AT1-reseptor | Blokkerer / antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Gir vasodilatasjon; reduserer ADH, aldosteron og renal reabsorpsjon av Na+/vann som nedstrøms effekter |

### Trimipramin

_Kildegrunnlag: main: supabase/import/psykofarmaka/TRIM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Noradrenalinreopptak / NET | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Histaminreseptorer | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Kraftig histaminantagonist |

**Merknad:** Teksten beskriver også omtrent 50 % hemming av hvilesekresjon i ventrikkelen. Målproteinet er ikke oppgitt; behold dette som utdypende tekst fremfor å dikte en molekylær mekanisme.

### Valsartan

_Kildegrunnlag: main: supabase/import/antihypertensiver/Valsartan.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Angiotensin II AT1-reseptor | Blokkerer / antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Gir vasodilatasjon; reduserer ADH, aldosteron og renal reabsorpsjon av Na+/vann som nedstrøms effekter |

### Venlafaksin

_Kildegrunnlag: main: supabase/import/psykofarmaka/VENSUM.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Noradrenalinreopptak / NET | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Serotoninreopptak / SERT | Hemmer reopptak | Transportører, pumper og exchangere → reopptakshemming | ↓ |  |
| Dopaminreopptak / DAT | Hemmer reopptak svakt | Transportører, pumper og exchangere → reopptakshemming | ↓ | Svak effekt |
| β-adrenerg responsivitet | Reduserer responsivitet | Reseptormodulering → mekanisme ikke spesifisert | ↓ | Gjelder både moderstoff og O-desmetylvenlafaksin ved kort- og langtidsbehandling |

### Verapamil

_Kildegrunnlag: main: supabase/import/antihypertensiver/Verapamil.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Spenningsstyrte L-type Ca2+-kanaler | Hemmer / blokkerer | Ionekanalmodulering → kanalblokkering | ↓ | Gjelder både hjertemuskelceller og glatt muskulatur; gir vasodilatasjon og påvirker AV- og sinusknute |

### Vortioksetin

_Kildegrunnlag: main: supabase/import/psykofarmaka/VOR.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| Serotonintransportør / SERT | Hemmer transportøren | Transportører, pumper og exchangere → transporterhemming | ↓ |  |
| 5-HT3-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| 5-HT7-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| 5-HT1D-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ |  |
| 5-HT1B-reseptor | Partiell agonist | Reseptormodulering → partiell agonisme | ↑ |  |
| 5-HT1A-reseptor | Agonist | Reseptormodulering → agonisme (grad/full agonisme ikke angitt) | ↑ | Ikke klassifiser som full agonist uten mer dokumentasjon |

**Merknad:** Teksten nevner også sannsynlig multimodal påvirkning av noradrenalin, dopamin, histamin, acetylkolin, GABA og glutamat. Det er ikke presist nok til egne målproteinkort og bør beholdes som utdypende tekst.

### Ziprasidon

_Kildegrunnlag: main: supabase/import/psykofarmaka/ZIPRA.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| 5-HT2A-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Svært høy affinitet |
| D2-reseptor | Antagonist | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| 5-HT2C-reseptor | Binder / interagerer | Reseptormodulering → funksjonell effekt ikke angitt | ? | Affinitet lik eller større enn for D2 |
| 5-HT1D-reseptor | Binder / interagerer | Reseptormodulering → funksjonell effekt ikke angitt | ? | Affinitet lik eller større enn for D2 |
| 5-HT1A-reseptor | Binder / interagerer | Reseptormodulering → funksjonell effekt ikke angitt | ? | Affinitet lik eller større enn for D2 |
| Serotonintransportør / SERT | Moderat affinitet | Transportører, pumper og exchangere → funksjonell effekt ikke angitt | ? | Ikke kall dette transporterhemming ut fra dagens tekst alene |
| Noradrenalintransportør / NET | Moderat affinitet | Transportører, pumper og exchangere → funksjonell effekt ikke angitt | ? | Ikke kall dette transporterhemming ut fra dagens tekst alene |
| H1-reseptor | Moderat affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| α1-reseptor | Moderat affinitet | Reseptormodulering → funksjonell effekt ikke angitt | ? |  |
| M1-reseptor | Ubetydelig effekt | Ingen effekt | 0 | Ubetydelig affinitet |

### Zuklopentiksol

_Kildegrunnlag: main: supabase/import/psykofarmaka/ZUKLO.json_

| Målprotein/prosess | Effekt | Kategori | Retning | Utdypende tekst / forbehold |
| --- | --- | --- | :---: | --- |
| D1-reseptor | Blokade / antagonistisk effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| D2-reseptor | Blokade / antagonistisk effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| α1-reseptor | Blokade / antagonistisk effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| 5-HT2-reseptor | Blokade / antagonistisk effekt | Reseptormodulering → antagonisme (subtype ikke angitt) | ↓ | Høy affinitet |
| Histaminreseptorer | Svak antihistaminerg effekt | Reseptormodulering → effektretning ikke eksplisitt angitt | ? |  |

## Stoffer uten farmakodynamikktekst i dagens datasett

Disse stoffene skal fortsatt være med i stoffregisteret, men det finnes per nå ingen farmakodynamikkfritekst i de kartlagte importdatasettene som kan konverteres til kort. Implementasjonen skal **ikke** fylle dem med mekanismer fra ekstern kunnskap i denne arbeidspakken.

### Alprazolam

Ingen eksisterende farmakodynamikktekst å konvertere.

### Amfetamin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Atomoksetin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Buprenorfin

Ingen eksisterende farmakodynamikktekst å konvertere.

### CBD

Ingen eksisterende farmakodynamikktekst å konvertere.

### Diazepam

Ingen eksisterende farmakodynamikktekst å konvertere.

### Etanol

Ingen eksisterende farmakodynamikktekst å konvertere.

### Fenobarbital

Ingen eksisterende farmakodynamikktekst å konvertere.

### Fentanyl

Ingen eksisterende farmakodynamikktekst å konvertere.

### Fenytoin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Flunitrazepam

Ingen eksisterende farmakodynamikktekst å konvertere.

### Gabapentin

Ingen eksisterende farmakodynamikktekst å konvertere.

### GHB

Ingen eksisterende farmakodynamikktekst å konvertere.

### Karbamazepin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Ketamin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Ketobemidon

Ingen eksisterende farmakodynamikktekst å konvertere.

### Klonazepam

Ingen eksisterende farmakodynamikktekst å konvertere.

### Kodein

Ingen eksisterende farmakodynamikktekst å konvertere.

### Kokain

Ingen eksisterende farmakodynamikktekst å konvertere.

### Levetiracetam

Ingen eksisterende farmakodynamikktekst å konvertere.

### Litium

Ingen eksisterende farmakodynamikktekst å konvertere.

### MDMA

Ingen eksisterende farmakodynamikktekst å konvertere.

### Metadon

Ingen eksisterende farmakodynamikktekst å konvertere.

### Metamfetamin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Metylfenidat

Ingen eksisterende farmakodynamikktekst å konvertere.

### Morfin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Nitrazepam

Ingen eksisterende farmakodynamikktekst å konvertere.

### Oksazepam

Ingen eksisterende farmakodynamikktekst å konvertere.

### Okskarbazepin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Oksykodon

Ingen eksisterende farmakodynamikktekst å konvertere.

### Petidin

Ingen eksisterende farmakodynamikktekst å konvertere.

### Sertindol

Ingen eksisterende farmakodynamikktekst å konvertere.

### Tapentadol

Ingen eksisterende farmakodynamikktekst å konvertere.

### THC

Ingen eksisterende farmakodynamikktekst å konvertere.

### Topiramat

Ingen eksisterende farmakodynamikktekst å konvertere.

### Tramadol

Ingen eksisterende farmakodynamikktekst å konvertere.

### Valproat

Ingen eksisterende farmakodynamikktekst å konvertere.

### Zolpidem

Ingen eksisterende farmakodynamikktekst å konvertere.

### Zopiklon

Ingen eksisterende farmakodynamikktekst å konvertere.

## Praktisk konsekvens for kortmodellen

Hvert kort bør minst kunne lagre:

- målprotein eller prosess;
- effekt;
- mekanismekategori/type;
- direkte retning (`opp`, `ned`, `ingen` eller `ukjent`);
- kort utdypende tekst;
- referanser/kilder.

Et kort må kunne representere at målproteinet eller funksjonell subtype er **ukjent/ikke spesifisert i kilden**. Dette er viktigere enn å tvinge alle rader inn i en mer presis taksonomi.

Negative funn («ingen affinitet», «binder ikke», «ingen effekt») skal være egne kort når dagens tekst oppgir et konkret mål. De skal være visuelt nøytrale og uten mekanismeikon.

Fysiologiske konsekvenser uten eksplisitt målprotein, som «hemmer glutamatfrigjøring» eller «potenserer nedadgående smertehemmende baner», bør normalt beholdes som utdypende tekst til nærmeste mekanismekort i denne første migreringen. Målet nå er strukturering av dagens innhold, ikke en ny farmakologisk kunnskapsmodell.
