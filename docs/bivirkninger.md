# Bivirkninger fra preparatomtalene

Leses når noe som har med de strukturerte bivirkningene å gjøre skal endres:
datamodellen, importen, kontrollen, eller visningen i seksjonen
«Bivirkninger» på fagsiden. Leses også av den som skal levere eller importere
bivirkninger fra en preparatomtale (SPC).

Bivirkningene i preparatomtalene står i en tabell etter **organsystem**
(MedDRA-organklassesystem, SOC) og **frekvenskategori**. OUSFAR lagrer dem
**én gang**, slik preparatomtalen har dem, og viser dem på to måter på
fagsiden: etter frekvens, med organsystemene under, eller etter organsystem,
med frekvensene under. Begge visningene lages av de samme radene hver gang
siden vises; de lagres aldri hver for seg.

Noen preparatomtaler har **flere bivirkningstabeller**: for ulike
indikasjoner eller doseringer, eller med ulikt frekvensgrunnlag (for eksempel
frekvens per pasient og per infusjon). Frekvensene i slike tabeller er ikke
sammenlignbare, så hver tabell lagres og vises for seg og blandes aldri med
de andre (se [Flere tabeller](#flere-tabeller-i-en-preparatomtale)).

## Faglig avgrensning

Systemet er bare infrastruktur. Det henter ingenting fra Felleskatalogen,
preparatomtaler eller andre kilder, klassifiserer ingenting, omskriver ingen
tekst, flytter ingen bivirkning mellom organsystemer og regner ikke ut noen
frekvens. Alt innhold kommer fra en importfil som er laget og faglig
kontrollert utenfor appen, og tas inn ordrett. Malen og testene bruker bare
syntetiske data, som sier selv at de er syntetiske.

## Datamodellen

| Del | Hvor | Hva |
| --- | --- | --- |
| Frekvensene | `FREKVENSER` i `src/bivirkninger/modell.ts`, `bivirkninger.frekvenser` | Den faste lista under, med rekkefølgen |
| Organsystemene | `ORGANSYSTEMER` i `src/bivirkninger/modell.ts`, `bivirkninger.organsystemer` | Den sentrale kartleggingen til MedDRA, under |
| Kildene | `bivirkninger.kilder` | Én rad per import av én preparatomtale til én fagside, med sporbarheten |
| Tabellene (kontekstene) | `bivirkninger.kontekster` | Bare når preparatomtalen har flere tabeller: én rad per tabell, med nøkkel, navn, frekvensgrunnlag, merknad og plassen i preparatomtalen |
| Bivirkningene | `bivirkninger.bivirkninger` | Én rad per bivirkning: kilden, tabellen (eller ingen), organsystemet, frekvensen, teksten, fotnoten og plassen i preparatomtalen |

Hver bivirkning er dermed knyttet til fagsiden (gjennom kilden), et
organsystem, en frekvens, teksten og kilden. Organsystemet og frekvensen er
fremmednøkler til de faste listene, så databasen tar aldri imot en kode den
ikke kjenner — heller ikke utenom importen. En rad kan bare peke på en tabell
i sin egen kilde, og to rader kan bare ha samme tekst i samme kombinasjon av
organsystem og frekvens når de står i ulike tabeller.

Fagsiden er objektet i `redigerbare_objekter`, ikke navnet: kilden følger
siden om den får nytt navn. Importen finner siden etter nøkkelen
(`infosider.slug`).

Skjemaet `bivirkninger` er lukket for API-rollene. Appen leser med
`public.les_bivirkninger(stoff)`, som bare innloggede kan kalle, og som gir
de gjeldende kildene med tabellene sine og radene fra dem i
preparatomtalenes rekkefølge (`src/bivirkninger/lesing.ts`). Hver rad har
nøkkelen til tabellen sin, eller `null` når kilden har én tabell.

### Sporbarheten

Hver kilde har:

| Felt | Påkrevd | Hva |
| --- | --- | --- |
| `nokkel` | ja | Fast nøkkel for preparatomtalen på denne fagsiden, f.eks. `preparat-10-mg-tabletter`. En ny import med samme nøkkel erstatter den forrige |
| `type` | ja | Hva slags kilde. Bare `spc` (preparatomtale) finnes |
| `tittel` | ja | Tittelen slik den skal stå i referanselista |
| `preparat` | nei | Preparatet eller produktet preparatomtalen gjelder |
| `innehaver` | nei | Innehaveren av markedsføringstillatelsen |
| `spc_versjon` | nei | Versjonen preparatomtalen oppgir |
| `revisjonsdato` | nei | Datoen for siste revisjon av preparatomtalen, `ÅÅÅÅ-MM-DD` |
| `lenke` | nei | Hvor preparatomtalen ligger, `https://…` |
| `kontrollert` | nei | Når importen ble faglig kontrollert mot preparatomtalen, `ÅÅÅÅ-MM-DD` |
| `kontrollert_av` | nei | Hvem som kontrollerte |
| `importert_av` | ja | Hvem eller hva som laget importen |
| `merknad` | nei | Merknader til hele kilden |

Databasen fører selv når importen ble lagt inn (`importert_kl`), og tar vare
på hele importfila (`importen`) og en kontrollsum av den (`innholdssum`).
Fotnoter til én bivirkning står ved bivirkningen (`fotnote`).

Kilden står som automatisk referanse i referansefeltet til «Bivirkninger»
(`src/bivirkninger/referanser.ts`), med versjonen, revisjonsdatoen, når den
ble importert og av hvem, når den ble kontrollert og av hvem, og merknaden.
Har siden bivirkninger fra flere preparatomtaler, står kilden også ved
navnet over hver tabell.

## Frekvensene

Den eneste tillatte lista. En preparatomtale trenger ikke ha alle; en
frekvens uten bivirkninger vises ikke. Ikonet er ordinalt: fem prikker for
den høyeste frekvensen, én for den laveste, og «?» for «Ikke kjent». Navnet
står alltid ved ikonet, og definisjonen ved navnet.

| Kode | Navn på siden | Definisjon | Ikon | Ikonnavn |
| --- | --- | --- | --- | --- |
| `svaert_vanlige` | Svært vanlige | ≥ 1/10 | ●●●●● | `frekvens5` |
| `vanlige` | Vanlige | ≥ 1/100 til < 1/10 | ●●●●○ | `frekvens4` |
| `mindre_vanlige` | Mindre vanlige | ≥ 1/1 000 til < 1/100 | ●●●○○ | `frekvens3` |
| `sjeldne` | Sjeldne | ≥ 1/10 000 til < 1/1 000 | ●●○○○ | `frekvens2` |
| `svaert_sjeldne` | Svært sjeldne | < 1/10 000 | ●○○○○ | `frekvens1` |
| `ikke_kjent` | Ikke kjent | kan ikke anslås ut ifra tilgjengelige data | ? | `frekvensUkjent` |

## Organsystemene

De 27 organklassesystemene i MedDRA, i den internasjonalt avtalte
rekkefølgen preparatomtalene bruker, med de norske navnene fra
preparatomtalene (QRD-malen). Importen bruker koden; navnet på siden kommer
herfra. Ikonene velges i `ORGANSYSTEMIKONER` i
`src/components/stoffside/panelvisning.ts`, fra det vanlige ikonregisteret
(`src/components/ikon/register.ts`), og frekvensikonene i `FREKVENSIKONER`
samme sted.

| Kode | Navn på siden (QRD) | MedDRA SOC | MedDRA-kode | Ikonnavn |
| --- | --- | --- | --- | --- |
| `infeksiose` | Infeksiøse og parasittære sykdommer | Infections and infestations | 10021881 | `orgInfeksjon` |
| `svulster` | Godartede, ondartede og uspesifiserte svulster (inkludert cyster og polypper) | Neoplasms benign, malignant and unspecified (incl cysts and polyps) | 10029104 | `orgSvulst` |
| `blod_lymfe` | Sykdommer i blod og lymfatiske organer | Blood and lymphatic system disorders | 10005329 | `orgBlod` |
| `immunsystemet` | Forstyrrelser i immunsystemet | Immune system disorders | 10021428 | `shield` |
| `endokrine` | Endokrine sykdommer | Endocrine disorders | 10014698 | `orgEndokrin` |
| `stoffskifte` | Stoffskifte- og ernæringsbetingede sykdommer | Metabolism and nutrition disorders | 10027433 | `orgStoffskifte` |
| `psykiatriske` | Psykiatriske lidelser | Psychiatric disorders | 10037175 | `orgPsykisk` |
| `nevrologiske` | Nevrologiske sykdommer | Nervous system disorders | 10029205 | `orgHjerne` |
| `oye` | Øyesykdommer | Eye disorders | 10015919 | `orgOye` |
| `ore_labyrint` | Sykdommer i øre og labyrint | Ear and labyrinth disorders | 10013993 | `orgOre` |
| `hjerte` | Hjertesykdommer | Cardiac disorders | 10007541 | `heart` |
| `kar` | Karsykdommer | Vascular disorders | 10047065 | `orgKar` |
| `respirasjon` | Sykdommer i respirasjonsorganer, thorax og mediastinum | Respiratory, thoracic and mediastinal disorders | 10038738 | `orgLunger` |
| `gastrointestinale` | Gastrointestinale sykdommer | Gastrointestinal disorders | 10017947 | `orgMage` |
| `lever_galle` | Sykdommer i lever og galleveier | Hepatobiliary disorders | 10019805 | `orgLever` |
| `hud` | Hud- og underhudssykdommer | Skin and subcutaneous tissue disorders | 10040785 | `orgHud` |
| `muskel_skjelett` | Sykdommer i muskler, bindevev og skjelett | Musculoskeletal and connective tissue disorders | 10028395 | `orgSkjelett` |
| `nyre_urinveier` | Sykdommer i nyre og urinveier | Renal and urinary disorders | 10038359 | `orgNyre` |
| `svangerskap` | Tilstander i forbindelse med svangerskap, puerperium og perinatalperioden | Pregnancy, puerperium and perinatal conditions | 10036585 | `orgSvangerskap` |
| `kjonnsorganer_bryst` | Lidelser i kjønnsorganer og brystsykdommer | Reproductive system and breast disorders | 10038604 | `orgKjonn` |
| `medfodte` | Medfødte, familiære og genetiske sykdommer | Congenital, familial and genetic disorders | 10010331 | `dna` |
| `generelle` | Generelle lidelser og reaksjoner på administrasjonsstedet | General disorders and administration site conditions | 10018065 | `orgGenerell` |
| `undersokelser` | Undersøkelser | Investigations | 10022891 | `serum` |
| `skader` | Skader, forgiftninger og komplikasjoner ved medisinske prosedyrer | Injury, poisoning and procedural complications | 10022117 | `orgSkade` |
| `prosedyrer` | Kirurgiske prosedyrer og medisinske prosedyrer | Surgical and medical procedures | 10042613 | `orgProsedyre` |
| `sosiale` | Sosiale omstendigheter | Social circumstances | 10041244 | `orgSosial` |
| `produktproblemer` | Problemer med produktet | Product issues | 10077536 | `pack` |

Lista, rekkefølgen og navnene står både i appen og i migrasjonen
`*_bivirkninger.sql`. Endres de, endres begge i samme omgang — testen
`bivirkninger.test.ts` kontrollerer at de er like, og at tabellene her er
like lista. Navnene bør kontrolleres mot gjeldende QRD-mal ved første ekte
import.

## Visningen på fagsiden

Seksjonen «Bivirkninger» (`Bivirkningspanel.tsx`) har øverst bryteren
**Frekvens | Organsystem** (`Trinnbryter`). Den bytter bare visning; dataene
er de samme. Valget overlever en oppdatering av appen (`useBevart`), og en
direktelenke til en gruppe i den andre visningen bytter visning.

- **Frekvens:** frekvensene fra den høyeste til «Ikke kjent» som
  overskriftskort (detaljkort tegnet som overskrift, som legemiddelformene i
  «Preparater»), og i hver et kort per organsystem med ikon, navn og
  punktliste.
- **Organsystem:** omvendt — organsystemene som overskriftskort, og i hvert
  et kort per frekvens.

Bare kombinasjoner med minst én bivirkning vises. Rekkefølgen innenfor en
kombinasjon er preparatomtalens.

Trekkspillet følger reglene i `docs/seksjoner.md`: gruppene er detaljkort i
styringen for siden, med én åpen om gangen. Kortene i en gruppe er
`Underkort` i et `Underkortrutenett` — en visning i detaljkortet som styrer
seg selv, også med én åpen om gangen, og ikke et tredje nivå i styringen.
Hvert kombinasjonskort kan alltid åpnes: lukket viser det bivirkningene som
oppsummering, åpent som punktliste med fotnotene. Har en gruppe bare én
kombinasjon, står den åpen fra start.

Søket på siden finner bivirkningene, fotnotene og navnene i visningen som
står (`bivirkningstekster`).

### Flere tabeller i en preparatomtale

Hver bivirkningstabell vises for seg (`tabeller` i `modell.ts`,
`byggBivirkningsvisning` i `stoffside.ts`): med to preparatomtaler, eller en
preparatomtale med flere tabeller, står tabellene etter hverandre under
bryteren, hver med sine egne grupper. Den samme bivirkningen kan da stå i
flere tabeller med ulik frekvens; den slås aldri sammen.

- Over hver tabell står navnet som skiller den fra de andre: preparatet (når
  preparatomtalene er flere) og tabellens navn, og under det
  frekvensgrunnlaget og merknaden i rolig tekst. Kilden står som
  referansepille ved navnet når preparatomtalene er flere.
- Med én tabell uten navn står ingenting ekstra; seksjonen ser ut som før.
- Med flere tabeller får kortene tabellen foran ID-en, så de er unike på
  siden: `tabell-<kildenøkkel>_<tabellnøkkel>--frekvens-vanlige` (bare
  `tabell-<kildenøkkel>--…` for en preparatomtale med én tabell). Søket og
  direktelenkene bruker disse ID-ene.
- Oppsummeringen av seksjonen sier hvor mange tabeller det er, når de er
  flere.

De redaksjonelle kortene i seksjonen står under bivirkningene som før.

## Importformatet

Én JSON-fil per preparatomtale per fagside, i
`supabase/import/bivirkninger/<fagsidenøkkel>--<kildenøkkel>.json`. Malen er
`supabase/maler/bivirkningsimport.json` (syntetisk):

```json
{
  "format": "ousfar-bivirkninger/1",
  "stoff": "<fagsidenøkkelen, som i adressen #/stoff/<nøkkel>>",
  "kilde": {
    "nokkel": "preparat-10-mg-tabletter",
    "type": "spc",
    "tittel": "Preparatomtale (SPC) for …",
    "preparat": "…",
    "innehaver": "…",
    "spc_versjon": "…",
    "revisjonsdato": "ÅÅÅÅ-MM-DD",
    "lenke": "https://…",
    "kontrollert": "ÅÅÅÅ-MM-DD",
    "kontrollert_av": "…",
    "importert_av": "…",
    "merknad": "…"
  },
  "organsystemer": [
    {
      "organsystem": "nevrologiske",
      "frekvenser": [
        { "frekvens": "svaert_vanlige", "bivirkninger": ["…", "…"] },
        { "frekvens": "mindre_vanlige", "bivirkninger": [{ "tekst": "…", "fotnote": "…" }] }
      ]
    }
  ]
}
```

Har preparatomtalen flere bivirkningstabeller, står de under `tabeller` i
stedet for `organsystemer`, hver med sin nøkkel, sitt navn, eventuelt
frekvensgrunnlaget og en merknad, og organsystemene sine i samme form som
over. Malen er `supabase/maler/bivirkningsimport-tabeller.json` (syntetisk):

```json
{
  "format": "ousfar-bivirkninger/1",
  "stoff": "…",
  "kilde": { "…": "som over" },
  "tabeller": [
    {
      "nokkel": "indikasjon-a-per-pasient",
      "navn": "<navnet på tabellen slik preparatomtalen har det>",
      "frekvensgrunnlag": "per pasient",
      "merknad": "…",
      "organsystemer": [{ "organsystem": "…", "frekvenser": [{ "frekvens": "…", "bivirkninger": ["…"] }] }]
    },
    {
      "nokkel": "indikasjon-a-per-infusjon",
      "navn": "…",
      "frekvensgrunnlag": "per infusjon",
      "organsystemer": ["…"]
    }
  ]
}
```

Reglene, som kontrolleres både av appen (`src/bivirkninger/import.ts`) og av
databasen (`bivirkninger.importfeil`), med de samme meldingene:

- Bare feltene over. Et ukjent felt — også en skrivefeil — er en feil.
- `organsystem` og `frekvens` er kodene i tabellene over, nøyaktig. Et
  ukjent organsystem eller en ukjent frekvens er en feil; det lages aldri en
  ny variant.
- Enten `organsystemer` (én tabell) eller `tabeller` (flere), aldri begge.
  En tabell har `nokkel` (små bokstaver a–z, tall og enkle bindestreker,
  unik i fila) og `navn` (påkrevd), og kan ha `frekvensgrunnlag` og
  `merknad`. Tabellene står i preparatomtalens rekkefølge.
- Hvert organsystem står én gang i en tabell, og hver frekvens én gang under
  det.
- En bivirkning er tekst, eller `{ "tekst", "fotnote" }`. Samme tekst kan
  ikke stå to ganger i samme kombinasjon (store og små bokstaver regnes
  likt).
- Tekstene tas inn ordrett, uten linjeskift og uten mellomrom i begynnelsen
  eller slutten. Et valgfritt felt utelates eller er `null`, aldri `""`.
- Rekkefølgen i lista er rekkefølgen på siden.
- Fagsiden må finnes; det vet bare databasen.

Feilmeldingene har stedet i fila foran, f.eks.
`organsystemer[1].frekvenser[0].frekvens: ukjent frekvenskategori «ofte».`

## Slik leverer ChatGPT en import

1. Lag én fil per preparatomtale per fagside etter malen, med bivirkningene
   slik de står i preparatomtalen: organsystemet og frekvensen preparatomtalen
   oppgir, teksten ordrett og fotnotene ved bivirkningen de gjelder. Har
   preparatomtalen flere bivirkningstabeller (indikasjoner, doseringer eller
   frekvensgrunnlag), legg hver under `tabeller` med navnet og
   frekvensgrunnlaget slik preparatomtalen oppgir dem; slå dem aldri sammen.
2. Fyll ut sporbarheten: tittelen, preparatet, innehaveren, versjonen,
   revisjonsdatoen og lenken fra preparatomtalen, og hvem som kontrollerte
   og når.
3. Gi kilden en nøkkel som sier hvilken preparatomtale det er
   (`preparat-10-mg-tabletter`). Den skal ikke endres senere.
4. Legg fila i `supabase/import/bivirkninger/` med navnet
   `<fagsidenøkkel>--<kildenøkkel>.json`.

## Slik legges en import inn

1. Kontroller fila: `npm run import:bivirkninger -- <fil>`. Alle feilene
   skrives ut med stedet i fila; ingenting lages før fila er i orden.
2. Lag migrasjonen: `npm run import:bivirkninger -- <fil> <migrasjon.sql>`.
   Den kaller `bivirkninger.importer`, som kontrollerer importen på nytt.
3. Rull den ut med `apply_migration` og gi fila versjonen prosjektet
   registrerte (`supabase/CLAUDE.md`). Migrasjonen sletter ingenting.

Testen `bivirkninger.test.ts` holder importfilene og migrasjonene i takt:
hver fil skal være lik den siste importen av samme kilde i migrasjonene, og
hver kilde migrasjonene har lagt inn og ikke trukket tilbake, skal ha en fil.

## Oppdatere en preparatomtale

Kommer en ny versjon av preparatomtalen, endres **den samme fila**, med samme
`stoff` og samme `kilde.nokkel`, og ny versjon og revisjonsdato. Så lages og
rulles ut en ny migrasjon som over.

- Samme fagside og samme kildenøkkel erstatter den forrige importen:
  den gamle kilden merkes som erstattet (`erstattet_av`) og vises ikke
  lenger, og de nye radene og tabellene legges inn under en ny kilde. Det blir ingen
  duplikater, og ingen rader blir stående uten kilde.
- Er innholdet det samme som sist (bortsett fra `importert_av`), gjør
  importen ingenting.
- Den gamle importen står igjen som historikk, med hele fila.

Skal en preparatomtale ikke lenger vises (preparatet er avregistrert, eller
den ble importert til feil side), trekkes den tilbake:
`npm run import:bivirkninger -- --trekk-tilbake <fagsidenøkkel> <kildenøkkel> "<begrunnelse>" <migrasjon.sql>`,
og importfila tas ut i samme endring. Radene står igjen som historikk.

En ny preparatomtale for den samme fagsiden (et annet preparat) får en ny
kildenøkkel og en egen fil; bivirkningene fra hver vises som egne tabeller,
etter hverandre, med preparatet og kilden over hver.

## Filene

| Fil | Hva |
| --- | --- |
| `src/bivirkninger/modell.ts` | Frekvensene, organsystemene, kildene, tabellene og grupperingen i de to visningene |
| `src/bivirkninger/import.ts` | Importformatet, kontrollen og migrasjonene |
| `src/bivirkninger/lesing.ts` | Lesingen appen gjør |
| `src/bivirkninger/referanser.ts` | Kildene som automatiske referanser |
| `src/bivirkninger/stoffside.ts` | Tabellene slik siden viser dem, oppsummeringene og tekstene søket finner |
| `src/components/stoffside/Bivirkningspanel.tsx`, `src/styles/bivirkninger.css` | Seksjonen på fagsiden |
| `supabase/migrations/*_bivirkninger.sql` | Skjemaet, de faste listene, kontrollen, importen og lesingen |
| `scripts/lag-bivirkningsimport.ts` | Kontrollen av en importfil og migrasjonen for den |
| `supabase/maler/bivirkningsimport.json`, `bivirkningsimport-tabeller.json` | Malene for én og for flere tabeller, syntetiske |
| `supabase/import/bivirkninger/` | Importfilene |
| `src/__tests__/bivirkninger.test.ts`, `stoffside.test.tsx` | Testene |
