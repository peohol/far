-- Retter kildeplasseringen i de tre faste avhengighetskortene for kvetiapin.
-- Den tidligere utrullede migrasjonen er append-only; denne legger bare inline-siteringer til gjeldende kort.
do $kuratering$
declare
  side uuid := intern.kuratering_start('kvetiapin');
  kilde constant text := 'Monografkuratering av kvetiapin 05.10.2026: inline-kilder i avhengighetskort';
  toleranse uuid;
  abstinens uuid;
  addiksjon uuid;
  spc uuid;
  monahan uuid;
  vento uuid;
  jahnsen uuid;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 3);
  toleranse := intern.kuratering_element(
    side, 'avhengighet_toleranse', 'kinetikkort', '{"tittel":"Toleranseutvikling"}', 1,
    'Monografkuratering av kvetiapin 04.10.2026: oppsummering, virkninger og avhengighet');
  abstinens := intern.kuratering_element(
    side, 'avhengighet_toleranse', 'kinetikkort', '{"tittel":"Abstinens, seponeringssyndrom og rebound-effekter"}', 1,
    'Monografkuratering av kvetiapin 04.10.2026: oppsummering, virkninger og avhengighet');
  addiksjon := intern.kuratering_element(
    side, 'avhengighet_toleranse', 'kinetikkort', '{"tittel":"Addiksjon"}', 1,
    'Monografkuratering av kvetiapin 04.10.2026: oppsummering, virkninger og avhengighet');

  spc := intern.kuratering_referanse(
    '{"tittel":"Seroquel Depot – preparatomtale (SPC)","forfattere":"Direktoratet for medisinske produkter","aar":"2026","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5214.pdf"}',
    kilde);
  monahan := intern.kuratering_referanse(
    '{"tittel":"Quetiapine withdrawal: A systematic review","forfattere":"Monahan K, Cuzens-Sutton J, Siskind D, Kisely S","aar":"2021","lenke":"https://doi.org/10.1177/0004867420965693"}',
    kilde);
  vento := intern.kuratering_referanse(
    '{"tittel":"Quetiapine Abuse Fourteen Years Later: Where Are We Now? A Systematic Review","forfattere":"Vento AE, Kotzalidis GD, Cacciotti M, et al.","aar":"2020","lenke":"https://doi.org/10.1080/10826084.2019.1668013"}',
    kilde);
  jahnsen := intern.kuratering_referanse(
    '{"tittel":"Quetiapine, Misuse and Dependency: A Case-Series of Questions to a Norwegian Network of Drug Information Centers","forfattere":"Jahnsen JA, Widnes SF, Schjøtt J","aar":"2021","lenke":"https://doi.org/10.2147/DHPS.S296515"}',
    kilde);

  perform intern.kuratering_lagre(toleranse, 1, jsonb_build_object(
    'data', jsonb_build_object(
      'tittel','Toleranseutvikling',
      'dokument',jsonb_build_object('type','doc','content',jsonb_build_array(
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Det tydeligste kliniske tegnet på fysiologisk tilvenning gjelder den sedative effekten. Preparatomtalen angir at somnolens vanligvis oppstår i løpet av de to første behandlingsukene og vanligvis avtar eller forsvinner ved fortsatt behandling.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
        )),
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Dette forløpet beskriver tilvenning til søvnighet. Det bør ikke uten videre generaliseres til andre virkninger eller tolkes som et tegn på addiksjon.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
        ))
      ))
    ),
    'referanser',jsonb_build_array(spc)
  ), kilde);

  perform intern.kuratering_lagre(abstinens, 1, jsonb_build_object(
    'data', jsonb_build_object(
      'tittel','Abstinens, seponeringssyndrom og rebound-effekter',
      'dokument',jsonb_build_object('type','doc','content',jsonb_build_array(
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Brå seponering kan gi et seponeringssyndrom. Preparatomtalen beskriver særlig søvnløshet, kvalme, hodepine, diaré, oppkast, svimmelhet og irritabilitet; i placebokontrollerte studier falt hyppigheten signifikant én uke etter seponering. Gradvis seponering over minst én til to uker anbefales.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(spc)))
        )),
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','En systematisk oversikt fant 13 publikasjoner, alle enkeltkasuistikker og gjennomgående av begrenset kvalitet. Rask seponering var assosiert med blant annet kvalme, oppkast, uro, rastløshet, svetting, irritabilitet, angst, dysfori, søvnforstyrrelse, takykardi, hypertensjon og svimmelhet; enkelte rapporter beskrev også seponeringsdyskinesi.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(monahan)))
        )),
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Spesifikke rebound-fenomener er dårlig karakterisert. Tilbakekomst av psykotiske, maniske eller depressive symptomer etter avsluttet behandling skal derfor ikke i seg selv betegnes som rebound; det kan representere tilbakefall av grunnlidelsen.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(monahan)))
        ))
      ))
    ),
    'referanser',jsonb_build_array(spc,monahan)
  ), kilde);

  perform intern.kuratering_lagre(addiksjon, 1, jsonb_build_object(
    'data', jsonb_build_object(
      'tittel','Addiksjon',
      'dokument',jsonb_build_object('type','doc','content',jsonb_build_array(
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Ikke-medisinsk bruk, legemiddelsøkende atferd og avhengighetslignende bruk av kvetiapin er dokumentert. En systematisk oversikt fant at problematisk bruk særlig var rapportert hos personer med andre rusproblemer og i retts-/fengselspopulasjoner; sedative og angstdempende virkninger ble ofte omtalt som motiv for bruken.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(vento)))
        )),
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','En norsk RELIS-serie på 54 henvendelser illustrerer den samme seleksjonen: 29 (54 %) gjaldt personer med tidligere avhengighetsproblematikk og 14 (26 %) omtalte ikke-godkjent bruk mot søvnvansker. Bare tre saker stilte et spesifikt spørsmål om pasientavhengighet, alle knyttet til søvnbruk, og materialet kunne ikke fastslå kvetiapins generelle addiksjonspotensial.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(jahnsen)))
        )),
        jsonb_build_object('type','paragraph','content',jsonb_build_array(
          jsonb_build_object('type','text','text','Det er derfor rimelig med særlig oppmerksomhet ved tidligere rusproblemer og ikke-medisinsk eller ikke-avtalt bruk, men dagens evidens gir ikke grunnlag for å tallfeste addiksjonsrisikoen i en vanlig terapeutisk populasjon.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(vento,jahnsen)))
        ))
      ))
    ),
    'referanser',jsonb_build_array(vento,jahnsen)
  ), kilde);
end
$kuratering$;