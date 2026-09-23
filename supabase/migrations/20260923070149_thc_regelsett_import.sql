-- Importen av THC-syreregelsettet: verdiene den opprinnelige THC-syremodulen
-- hadde i koden, lagt inn og publisert som administratoren som bestilte
-- arbeidet. Laget med thcImportSql('peohol') i scripts/thc-import.ts; testene
-- kontrollerer at fila er lik det den gir. I en database uten den
-- administratoren gjør den ingenting.
do $import$
declare
  admin uuid;
  status public.objektstatus;
begin
  select id into admin from public.profiles where username = 'peohol' and role = 'admin';
  if admin is null then
    raise notice 'THC-syreregelsettet er ikke importert: administratoren peohol finnes ikke her.';
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform set_config('far.revisjonskilde', 'Importert fra den opprinnelige THC-syremodulen (regnearket THC-COOH.xlsm med eierens senere tillegg)', true);
  status := public.opprett_utkast('thc_regelsett', $json${"konverteringsfaktor":0.344451,"kurver":{"gronn":{"navn":"Normal utskillelse","a1":75.10642536264817,"k1":2.344866277008879,"a2":52.89994063494364,"k2":0.13388138992902396},"gul":{"navn":"Moderat utskillelse","a1":150.21285072529633,"k1":2.344866277008879,"a2":105.79988126988728,"k2":0.13388138992902396},"rod":{"navn":"Treg utskillelse","a1":261.5116678191702,"k1":0.10152954824642728,"a2":52.78117322451692,"k2":0.022237916803065798}},"maleusikkerhet":{"cv_thc":0.2,"cv_kreatinin":0.05,"faktor_under_cutoff":1.5},"sikkerhetsmarginer":[{"margin":0.5,"z":0},{"margin":0.9,"z":-1.2815515655446008},{"margin":0.99,"z":-2.3263478740408408}],"standard_sikkerhetsmargin":0.9,"konsentrasjonsnivaer":[{"navn":"lav","nedre":null,"nylig_inntak":false},{"navn":"middels høy","nedre":20,"nylig_inntak":false},{"navn":"høy","nedre":40,"nylig_inntak":true}],"bruksmonstre":{"kronisk":{"vanskelig_over":"gul","nytt_inntak_over":"rod"},"ikke_kronisk":{"vanskelig_over":"gronn","nytt_inntak_over":"gul"}},"varsel_dager_mellom":30,"tekster":{"apning":"THC-syre, et omdannelsesprodukt av cannabis, er påvist i {nivå} konsentrasjon.","nylig_inntak":"Slike konsentrasjoner ses gjerne ved prøvetaking kort tid etter inntak av cannabis.","nytt_inntak":"Analyseresultatet tilsier at cannabis har vært inntatt etter prøve tatt {forrige prøvedato}.","inntak_har_skjedd":"Analyseresultatet viser at cannabis har vært inntatt.","pavisningstid":"Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis opptil en måned etter avsluttet inntak.","vanskelig":"Basert på analyseresultatet alene er det vanskelig å avgjøre hvorvidt cannabis har vært inntatt etter prøve tatt {forrige prøvedato}. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no).","ikke_nodvendigvis":"Analyseresultatet tilsier at cannabis ikke nødvendigvis har vært inntatt etter prøve tatt {forrige prøvedato}. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no).","under_cutoff_vanskelig":"Ved lave THC-syrekonsentrasjoner og varierende kreatininresultater kan nivået svinge over og under påvisningsgrensen. Vurdering i forhold til andre prøver kan derfor være vanskelig, og inntakstidspunktet kan ikke avgjøres. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no).","under_cutoff_ikke_nodvendigvis":"Analyseresultatet tilsier at cannabis ikke nødvendigvis har vært inntatt etter prøve tatt {forrige prøvedato}, selv om prøven tatt {forrige prøvedato} ble rapportert som «ikke påvist». Ved lave THC-syrekonsentrasjoner og varierende kreatininresultater kan nivået svinge over og under påvisningsgrensen, uten at nytt inntak nødvendigvis har funnet sted. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no).","uten_forrige":"Oppfølging med flere prøver anbefales."}}$json$::jsonb);
  perform public.publiser_utkast(status.id, status.revisjon);
end
$import$;
