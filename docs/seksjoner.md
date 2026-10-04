# Seksjoner og detaljkort

Fagsidene viser ikke alt på én gang. De er bygd av **seksjoner** som åpnes og
lukkes som skuffer, og **detaljkort** inne i seksjonene som kan åpnes for seg.
Det er to nivåer, og ikke flere: `seksjon → detaljkort`. Byggeklossene står i
`src/components/seksjoner/` og brukes av alt innhold på siden — OUSFARs eget
faginnhold, fortolkningsreglene og simulatorene, og legemiddeldataene fra
offentlige kilder.

## Slik ser det ut

- **Lukket** viser en seksjon overskriften og en kort oppsummering av hva som
  står i den, f.eks. «Absorpsjon · Distribusjon · Metabolisme» eller
  «12 preparater · 3 legemiddelformer · 6 styrker».
- **Åpnet** viser den innholdet. Oppsummeringen forsvinner, siden innholdet nå
  står der.
- **Detaljkort** i en åpen seksjon er mindre skuffer med sin egen
  oppsummering.
- **Et kort kan åpnes bare når det har mer å vise** enn det som står i det
  lukket. Har det ikke det — en halveringstid på «7 timer», eller et
  mekanismekort uten utdypende tekst — er det et **fast kort**:
  tittelen med hele innholdet rett under, uten pil og uten noe å trykke på.
  I redigeringsmodus kan alle kort åpnes, så redaktøren kommer til knappene.
- **Bare én skuff per nivå står åpen.** Åpnes en seksjon, lukkes den som sto
  åpen; åpnes et detaljkort, lukkes de andre kortene i samme seksjon, mens
  seksjonen står åpen. Det gjelder uansett hva som åpner skuffen: et trykk,
  en direktelenke, søket på siden eller nettleserens eget søk. Et detaljkort
  husker at det sto åpent når seksjonen lukkes og åpnes igjen.
- Når brukeren åpner en skuff, ruller siden den fram i det synlige feltet
  mellom den faste toppmenyen og bunnen av vinduet (over dokken på smale
  flater):
  - får den åpne skuffen plass i feltet, midtstilles den;
  - er den høyere enn feltet, legges toppen rett under toppmenyen.

  Siden begynner å rulle straks, etter høyden skuffen er ventet å få, og
  justeres til den virkelige når skuffen har glidd ferdig — med mindre
  brukeren alt har begynt å rulle selv. Søsknene som lukkes, lukkes straks,
  så skuffen står stille mens siden ruller. Nederst på siden kan den ikke
  alltid midtstilles, for siden kan ikke rulles forbi slutten.
  Direktelenker legger fortsatt toppen øverst, og søket midtstiller treffet.
- Identiteten og viktige data øverst på siden, og kritiske varsler, er ikke
  skuffer. De står alltid fram, og å åpne en seksjon lukker dem ikke.
- En seksjon står som en rad med hårlinje over, med seksjonsikonet i en sirkel
  foran overskriften. Detaljkortene står som kort i et rutenett med to eller
  tre kolonner (`skuffrutenett`), og et åpnet kort går over hele bredden.
- Pilen til høyre i hodet viser om skuffen er åpen. Hele hodet kan trykkes
  på; knappene i det gjør sin egen jobb. Handlingene i hodet (som «Kilder for
  panelet») virker på innholdet, så de åpner også skuffen; knappene i
  overskriften (referansepillene) gjør det ikke.
- Åpning glir raskt. Den som har bedt om mindre bevegelse i systemet, får
  skuffen åpnet og lukket, og siden rullet, uten glidning.
- **Designregel:** kort i et rutenett åpnes, lukkes og flyttes animert. Når
  brukeren åpner eller lukker et kort, vokser eller krymper det dit det skal
  stå, og naboene glir til sine nye plasser, så øyet kan følge hva som gikk
  hvor. Søket og direktelenker åpner straks. Detaljkort i et rutenett står i
  `Skuffrutenett`, som gjør dette selv; en visning med egne kort, som
  styrkene i «Preparater», bruker `useFlytting` direkte.
- Det finnes ingen «Åpne alle». Heller ikke redigeringsmodus åpner alt:
  redaktøren åpner seksjonen som skal redigeres, og en handling i hodet åpner
  seksjonen skjemaet står i. Selve skjemaet åpnes i et redigeringsvindu over
  siden (`Modallag`), så det får plass også når kortet er smalt.
- Ved utskrift står alt åpent.

## Hvordan det brukes i koden

```tsx
import { Detaljkort, Seksjon } from '../seksjoner/Seksjon'

<Seksjon
  id="preparater"                              // fast nøkkel, se under
  tittel={<Uthev tekst="Preparater" />}
  oppsummering="12 preparater · 3 legemiddelformer · 6 styrker"
  tittelTillegg={<Referansepille ider={…} niva="panel" />}   // valgfritt
  handlinger={redigerer && <Button …>Rediger</Button>}       // valgfritt
  ikon="prep"                                  // valgfritt, fra ikonregisteret
  apenFraStart={false}                         // lukket er standard
>
  <Detaljkort id="tablett" tittel="Tablett" oppsummering="4 preparater · 10–75 mg">
    …
  </Detaljkort>
</Seksjon>
```

- `id` er en **fast nøkkel**. Den står i direktelenker og i ankeret på siden
  (`panel-<id>`, detaljkort `panel-<seksjon>--<kort>`), og skal ikke endres
  når innholdet endres. Bruk en stabil ID fra kilden, som panelnøkkelen, en
  objekt-ID eller en kode fra legemiddelregisteret — ikke en tekst som kan
  skrives om.
- `tittel` og innholdet går gjennom `Uthev` der tekst skal kunne fremheves av
  søket.
- `oppsummering` sier hva som står i skuffen med innholdets egne ord. Den
  legger ingenting til og tolker ingenting (se `src/faginnhold/oppsummering.ts`
  for `ramsOpp`, `forhandsvisning` og `antall`). Søket fremhever ikke i den.
- `tittelTillegg` er det som står i overskriften etter tittelen og selv kan
  trykkes på. `handlinger` er knappene i hodet. Begge står utenfor knappen
  som åpner og lukker.
- `ikon` er et navn fra ikonregisteret (`src/components/ikon/register.ts`).
  Det er pynt ved siden av tittelen og skjult for skjermlesere. Fagsidens
  seksjonsikoner, og ikonene for kortene i farmakokinetikken og TDM, velges i
  `src/components/stoffside/panelvisning.ts`: kortene får ikon etter
  hva overskriften handler om (absorpsjon, halveringstid, CYP, prøvetaking,
  de faste kortene i «Toksisitet og forgiftning», «Graviditet, amming og
  reproduksjon» og «Avhengighet, toleranse og tilbakeslagseffekter» …), og et
  generisk ikon når ingen kategori passer, så en ny overskrift aldri feiler.
  Mekanismekortene i farmakodynamikken får ikon etter mekanismetypen
  (`mekanismeikon`), og et kort uten effekt har ikke noe ikon. Hvordan de
  tegnes og farges, står i `docs/farmakodynamikk-ikoner.md`.
- `kanApnes={false}` gjør et detaljkort fast (`Fastkort` i `Seksjon.tsx`):
  `children` står synlig under tittelen i oppsummeringens skrift, og
  `oppsummering`, `handlinger` og `apenFraStart` brukes ikke. Kortet er ikke
  en skuff i styringen, men et fast sted: en direktelenke dit åpner
  seksjonen og ruller dit, og søket åpner seksjonen rundt et treff i det. Det
  er den som eier kortene, som vet om de har mer å vise. Kortseriene i
  `Paneler.tsx` (farmakokinetikken, farmakodynamikken og de redaksjonelle
  kortene i farmakogenetikken) avgjør det med `harMer` i `Korttype`:
  - et kinetikkort har mer når teksten er for lang til å stå hel i
    oppsummeringen (`kuttes`, samme grense som `forhandsvisning`);
  - et mekanismekort har mer når det har en utdypende tekst. Ellers står
    effektpillen fast under målet.

  Kildene til kortet står nederst i det faste kortet, som i det åpnede.
- En seksjon i en seksjon, eller et detaljkort utenfor en seksjon eller i et
  annet detaljkort, stopper tegningen med en feil. Trenger innholdet et
  tredje nivå, skal det heller deles opp.
- Innholdet i et detaljkort kan likevel ha en egen liten visning som åpner og
  lukker, når designet ber om det: styrkekortene i «Preparater»
  (`src/components/preparater/`). Den styrer seg selv og er ikke en skuff.
  Skjuler den noe, gjøres det med `hidden="until-found"`, og den åpner seg
  når nettleserens søk finner noe der (`beforematch`) og når `apneTil` sender
  `VIS_HENDELSE` fra elementet som skal vises (`useSkjultTilFunnet`).
- Er visningen kort som ser ut og oppfører seg som detaljkort, brukes
  `Underkortrutenett` med `Underkort` fra `Seksjon.tsx`, som i
  «Bivirkninger» (`docs/bivirkninger.md`). Kortene har samme hode, pil, kant
  og flytting som detaljkortene (`Skufframme` og `Fastramme` tegner begge),
  overskrift på nivå 4, ett åpent om gangen, og `kanApnes={false}` for et
  kort uten mer å vise. Rutenettet styrer seg selv og står ikke i styringen
  for siden eller i adressen; det åpner kortet rundt et treff selv
  (`beforematch` og `VIS_HENDELSE`).
- Et detaljkort som skal se ut som en overskrift i stedet for et kort — når
  innholdet i det selv er kort, som legemiddelformene i «Preparater» og
  frekvensene og organsystemene i «Bivirkninger» — får klassen
  `overskriftskort` (og står i `.overskriftskortene`). Med lange titler gir
  `overskriftskort--lang` overskriften seksjonens størrelse.
- Glidningen er felles: `useSkjuling` (`src/hooks/`) skjuler og viser
  innholdet rundt en kropp som glir mellom `grid-template-rows: 0fr` og `1fr`,
  og brukes av skuffene og styrkene i preparatvinduet. Klipp innholdet ved
  kroppens kant, ikke radens; mens raden glir, er kroppen høyere enn den.
- Kortene i et rutenett som åpnes over hele bredden, flytter seg med
  `useFlytting` (FLIP): kortet vokser dit det skal, og naboene glir til sin
  nye plass. Detaljkort legges i `Skuffrutenett`
  (`src/components/seksjoner/Skuffrutenett.tsx`) i stedet for en `<ul>`:
  kortene i det tar et opptak før de åpnes eller lukkes, og glir ikke opp
  selv (`data-flyttes`), for det er rutenettet som flytter dem.

  ```tsx
  <Skuffrutenett className="infokort">
    {kort.map((k) => (
      <li key={k.id}>
        <Detaljkort id={k.id} tittel={k.tittel}>…</Detaljkort>
      </li>
    ))}
  </Skuffrutenett>
  ```

Fagsidens paneler (`src/components/stoffside/Paneler.tsx`) er seksjoner med
panelnøkkelen som `id`; om et panel står åpent fra start, står i `apen` i
`src/faginnhold/paneler.ts`.

## Søk og direktelenker

Innholdet i en lukket skuff står i dokumentet, skjult med
`hidden="until-found"`. Derfor:

- **Søket på siden** fremhever og teller treffene også i lukkede skuffer. En
  lukket skuff med treff sier «2 treff» i hodet. Når brukeren går til et treff
  (Enter, Shift + Enter, eller et av stedene under søkefeltet), åpnes
  seksjonen og detaljkortet treffet står i, og treffet rulles fram og
  markeres. Et sted i et detaljkort gjelder hele kortet, så stedet går også
  til et treff i korttittelen.
- **Nettleserens eget søk** (Ctrl/Cmd + F) finner også teksten, og åpner
  skuffen den står i (hendelsen `beforematch`, i nettlesere som støtter det).
- Skjult innhold er ellers utenfor tabulatorrekkefølgen og skjermleseren.

En **direktelenke** peker på en seksjon eller et detaljkort:

```
#/stoff/amitriptylin/farmakokinetikk
#/stoff/amitriptylin/farmakokinetikk/<kort-ID>
```

Siden åpner da stedet og ruller dit — også når innholdet først kommer etter at
siden er hentet. En lenke til noe som alltid står fram (`#/stoff/<nøkkel>/viktige_data`)
ruller bare dit, uten å åpne eller lukke noe. Adressene lages med
`stoffadresse(nøkkel, sted)` i `src/domain/rute.ts`, for alle stoffer, med og
uten analyttkode. Å åpne og lukke skuffer endrer ikke adressen.

## Styringen for siden

`SeksjonsstyringKilde` (`Seksjonsstyring.tsx`) ligger rundt hele fagsiden og
holder rede på hvilken skuff som er åpen i hver søskenflokk — skuffene med
samme forelder. Nøkkelen er seksjonens ID, og kortets med `/` imellom.
Tilstanden er *hvilken* skuff som er åpen, ikke om hver enkelt er det, så
regelen om én åpen per nivå kan ikke brytes. `useSeksjonsstyring()` gir:

| | |
| --- | --- |
| `apne(['seksjon', 'kort'])` | Åpner stedet uten å gli, lukker søsknene, og ruller dit |
| `apneTil(element)` | Åpner skuffene elementet står i på samme måte, og ruller det fram |
| `sett(sti, apen)` | Det et trykk gjør: åpner (og ruller den fram, se over) eller lukker |
| `fastSted(sti, element)` | Melder inn et sted som alltid står fram, så `apne` ruller dit uten å røre andre skuffer enn seksjonen stedet står i. Brukes gjennom `useFastSted(id, ref)` og av faste detaljkort |

Står flere søsken åpne fra start (`apenFraStart`), er det den første som
gjelder. En seksjon uten styringen rundt seg lager sin egen, så detaljkortene
i den følger den samme regelen også andre steder.

Hvor langt ned på siden en skuff legges når siden ruller dit, står i
`seksjoner.css` som `scroll-margin-block: var(--toppmeny-offset) …`, der
`--toppmeny-offset` er høyden til den faste toppmenyen med luft under. Margen
over og under er også grensene for feltet en åpnet skuff midtstilles i; på
smale flater er margen under `--dokk-offset`. Høyden skuffen får, måles på
innholdet, som bærer `data-skuffinnhold`.

## Tilgjengelighet

- Overskriften er en knapp i en overskrift (`h2` for seksjoner, `h3` for
  detaljkort) med `aria-expanded` og `aria-controls`. Oppsummeringen og antall
  treff er knyttet til knappen med `aria-describedby`. Et fast kort har
  overskriften uten knapp, siden det ikke er noe å åpne.
- Knappen åpnes og lukkes med Enter og mellomrom, og har god trykkflate på
  mobil.
- Seksjonen er et område (`section`) med overskriften som navn; et detaljkort
  er en gruppe.
