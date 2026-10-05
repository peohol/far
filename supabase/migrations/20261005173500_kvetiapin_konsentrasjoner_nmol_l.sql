-- Standardiserer synlige kvetiapinkonsentrasjoner til nmol/L.
-- Massebaserte serumverdier omregnes med kvetiapins molmasse 383,5 g/mol.
-- Postmortale mg/kg-data beholdes kvalitativt fordi mg/kg ikke kan konverteres
-- eksakt til nmol/L uten en matrisespesifikk tetthetsantakelse.
do $kuratering$
declare
  side uuid := intern.kuratering_start('kvetiapin');
  kilde constant text := 'Monografkuratering av kvetiapin 05.10.2026: konsentrasjoner standardisert til nmol/L';
  toksiske_konsentrasjoner uuid;
  tdm_grunnlag uuid;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  perform intern.kuratering_antall(side, 'toksisitet_forgiftning', 'kinetikkort', 6);
  toksiske_konsentrasjoner := intern.kuratering_element(
    side,
    'toksisitet_forgiftning',
    'kinetikkort',
    '{"tittel":"Toksiske konsentrasjoner"}'::jsonb,
    1,
    'Monografkuratering av kvetiapin 04.10.2026: fullforing av toksisitet, graviditet, indikasjon og interaksjoner'
  );

  perform intern.kuratering_antall(side, 'tdm', 'kinetikkort', 3);
  tdm_grunnlag := intern.kuratering_element(
    side,
    'tdm',
    'kinetikkort',
    '{"tittel":"Grunnlag for referanseområdet"}'::jsonb,
    2,
    'Monografkuratering av kvetiapin 05.10.2026: fersk full gjennomgang etter oppdatert kuratorprotokoll'
  );

  perform intern.kuratering_lagre(
    toksiske_konsentrasjoner,
    1,
    jsonb_build_object(
      'data',
      $json$
      {
        "tittel":"Toksiske konsentrasjoner",
        "dokument":{"type":"doc","content":[
          {"type":"paragraph","content":[
            {"type":"text","text":"Serumkonsentrasjonen kan støtte alvorlighetsvurderingen, men må tolkes sammen med tidspunkt etter inntak, formulering og klinikk. I serien med akutte forgiftninger var median maksimal konsentrasjon omtrent 10 400 nmol/L, og forfatterne foreslo over omtrent 5 200 nmol/L som et varselnivå for økt risiko for alvorlig forløp; dette er ikke en universell toksisitetsgrense."},
            {"type":"sitering","attrs":{"referanser":["b06bea10-ecbc-4554-ab46-fa2ec023aa7f","4cb30ebd-5b65-4c81-9faa-1db2739c10b9"]}}
          ]},
          {"type":"paragraph","content":[
            {"type":"text","text":"Postmortale blodkonsentrasjoner er matrise- og postmortemspesifikke og skal ikke brukes som serumgrenser hos levende pasienter. I en dansk postmortemserie var blodkonsentrasjonene klart høyere når kvetiapin ble vurdert som medvirkende til dødsfallet enn i ikke-medvirkende tilfeller. Originalstudien rapporterte disse dataene massebasert per kg blod; de gjengis derfor ikke som nmol/L uten en ubegrunnet tetthetsomregning."},
            {"type":"sitering","attrs":{"referanser":["b06bea10-ecbc-4554-ab46-fa2ec023aa7f","4cb30ebd-5b65-4c81-9faa-1db2739c10b9"]}}
          ]}
        ]}
      }
      $json$::jsonb
    ),
    kilde
  );

  perform intern.kuratering_lagre(
    tdm_grunnlag,
    2,
    jsonb_build_object(
      'data',
      $json$
      {
        "tittel":"Grunnlag for referanseområdet",
        "dokument":{"type":"doc","content":[
          {"type":"paragraph","content":[
            {"type":"text","text":"OUSFARs referanseområde 50–700 nmol/L bygger på serumkonsentrasjoner målt hos norske pasienter som brukte 50–1000 mg daglig: 10- og 90-persentilen, rundet av, i data fra Diakonhjemmet sykehus og St. Olavs hospital (2005–2007). Området beskriver konsentrasjoner som er vanlige ved anbefalte doser og er ikke et dokumentert terapeutisk område."}
          ]},
          {"type":"paragraph","content":[
            {"type":"text","text":"AGNPs oppdaterte TDM-konsensus fra 2026 oppgir et terapeutisk referanseområde på omtrent 260–1 300 nmol/L for voksne med schizofreni. Dette er et annet type område, utviklet for et annet klinisk formål og en avgrenset populasjon, og skal derfor ikke erstatte det norske OUSFAR-området. Det kan brukes som supplerende kontekst ved individuell TDM-tolkning."}
          ]}
        ]}
      }
      $json$::jsonb
    ),
    kilde
  );
end
$kuratering$;
