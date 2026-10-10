-- THC: kompletter alle faglig dokumenterbare obligatoriske monografiomraader.
-- Ny append-only migrasjon; endrer aldri tidligere migrasjoner eller norske grunnverdier.
-- Fire kilder er selvstendig kontrollert: norsk Sativex-SPC 28.05.2026,
-- Hunault et al. 2008 (originalartikkel, serum), Livingston et al. 2023,
-- Dyar et al. 2025 (motiver for cannabisbruk, ikke isolert THC).
-- Noen viktige data (terapeutisk/toxisk grense, t_ss) staar bevisst tomme;
-- begrunnelsene staar i docs/kurateringsjournal/thc.md.
do $thc_fullforing$
declare
  side uuid := intern.kuratering_start('thc');
  kilde constant text := 'THC monografkuratering 10.10.2026: komplettering av dekningsmatrise og strukturerte data';
  r_spc uuid;
  r_serum uuid;
  r_coping uuid;
  r_motiver uuid;
  k record;
  refs jsonb;
  dokument jsonb;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'THC-fullforingen er allerede gjennomfort.';
    return;
  end if;

  -- Bevar nyere endringer/utkast: hvis noe har endret seg siden
  -- produksjons-preflight og den foerste THC-migrasjonen, stopp atomisk.
  perform intern.kuratering_antall(side, 'viktige_data', 'halveringstid', 0);
  perform intern.kuratering_antall(side, 'serumkonsentrasjoner', 'dosetabell', 0);
  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 3);
  perform intern.kuratering_antall(side, 'farmakokinetikk', 'kinetikkort', 4);
  perform intern.kuratering_antall(side, 'tdm', 'kinetikkort', 1);

  r_spc := intern.kuratering_referanse(
    jsonb_build_object(
      'tittel','Sativex munnspray – norsk preparatomtale, oppdatert 28.05.2026',
      'forfattere','Direktoratet for medisinske produkter',
      'aar','2026',
      'lenke','https://produktinformasjon.legemiddelsok.no/preparatomtaler/11-8809.pdf'
    ), kilde);
  r_serum := intern.kuratering_referanse(
    jsonb_build_object(
      'tittel','THC serum concentrations and pharmacological effects after smoking cannabis containing up to 69 mg THC',
      'forfattere','Hunault CC, Mensinga TT, de Vries I, et al.',
      'aar','2008',
      'lenke','https://doi.org/10.1007/s00213-008-1260-2'
    ), kilde);
  r_coping := intern.kuratering_referanse(
    jsonb_build_object(
      'tittel','Negative Affect Regulation and Marijuana Use: Coping and Sleep Motives',
      'forfattere','Livingston NR et al.',
      'aar','2023',
      'lenke','https://doi.org/10.1080/02791072.2022.2054747'
    ), kilde);
  r_motiver := intern.kuratering_referanse(
    jsonb_build_object(
      'tittel','Multiple motives for cannabis use: common motive combinations and consequences',
      'forfattere','Dyar C, Curtis J, Lee CM',
      'aar','2025',
      'lenke','https://doi.org/10.1186/s42238-025-00362-z'
    ), kilde);

  -- T1/2 er kontekstspesifikk: plasma etter enkeltdoser Sativex.
  -- Ikke generelle THC-halveringstider, og ikke T_ss-estimater.
  perform intern.kuratering_nytt(side,
    jsonb_build_object(
      'panel','viktige_data','posisjon',3,'elementtype','halveringstid',
      'data',jsonb_build_object('former',jsonb_build_array(
        jsonb_build_object('form','Sativex, 2 sprayer – THC i plasma','typisk',1.94,'min',null,'maks',null,'enhet','timer'),
        jsonb_build_object('form','Sativex, 4 sprayer – THC i plasma','typisk',3.72,'min',null,'maks',null,'enhet','timer'),
        jsonb_build_object('form','Sativex, 8 sprayer – THC i plasma','typisk',5.25,'min',null,'maks',null,'enhet','timer')
      )),
      'referanser',jsonb_build_array(r_spc)
    ), '{}'::jsonb, kilde);

  -- Her er analyt faktisk THC i SERUM (ikke plasma/fullblod),
  -- og dosemengden er THC i sigaretten, ikke systemisk absorbert dose.
  -- Originaltabell 2 i Hunault et al. 2008; molmasse 314,46 g/mol.
  -- 135,1 / 202,9 / 231,0 ug/L -> 430 / 645 / 735 nmol/L.
  -- SD: 68,5 / 112,4 / 108,5 ug/L -> 218 / 357 / 345 nmol/L.
  perform intern.kuratering_nytt(side,
    jsonb_build_object(
      'panel','serumkonsentrasjoner','posisjon',0,'elementtype','dosetabell',
      'data',jsonb_build_object('rader',jsonb_build_array(
        jsonb_build_object(
          'dose','29,3 mg THC i sigaretten','regime','Røyket cannabis blandet med tobakk; enkeltdose',
          'konsentrasjon','Cmax (middel ± SD): 430 ± 218 nmol/L',
          'merknad','THC i serum; n=18 menn med ikke-daglig cannabisbruk. Tmax 9,8 min fra røykestart. Stoffmengden er innhold i sigaretten, ikke absorbert dose. Hunault et al. (2008), tabell 2.'),
        jsonb_build_object(
          'dose','49,1 mg THC i sigaretten','regime','Røyket cannabis blandet med tobakk; enkeltdose',
          'konsentrasjon','Cmax (middel ± SD): 645 ± 357 nmol/L',
          'merknad','THC i serum; n=20 menn med ikke-daglig cannabisbruk. Tmax 14,1 min fra røykestart. Stoffmengden er innhold i sigaretten, ikke absorbert dose. Hunault et al. (2008), tabell 2.'),
        jsonb_build_object(
          'dose','69,4 mg THC i sigaretten','regime','Røyket cannabis blandet med tobakk; enkeltdose',
          'konsentrasjon','Cmax (middel ± SD): 735 ± 345 nmol/L',
          'merknad','THC i serum; n=20 menn med ikke-daglig cannabisbruk. Tmax 12,3 min fra røykestart. Stoffmengden er innhold i sigaretten, ikke absorbert dose. Hunault et al. (2008), tabell 2.')
      )),
      'referanser',jsonb_build_array(r_serum)
    ), '{}'::jsonb, kilde);

  -- Redaksjonell supplering: korte, kildehomogene fagkort. Alle har
  -- synlige paastandsnaere siteringer, ikke lange panelreferanselister.
  create temporary table thc_fullforing_kort(
    panel text not null,
    posisjon integer not null,
    tittel text not null,
    tekst text not null,
    kilder text[] not null
  ) on commit drop;

  insert into thc_fullforing_kort values
    ('farmakokinetikk',4,'Mat og farmakokinetisk variasjon',
      'Ved samtidig matinntak med Sativex var gjennomsnittlig maksimal THC-plasmakonsentrasjon (Cmax) 1,6 ganger og THC-AUC 2,8 ganger høyere enn under fastende betingelser. Dette er data for THC/CBD-munnspray og kan ikke direkte generaliseres til dronabinol eller inhalert cannabis.',
      array['spc']),
    ('farmakokinetikk',5,'Nedsatt leverfunksjon',
      'Etter fire sprayer Sativex (10,8 mg THC og 10 mg CBD) ble det ikke funnet signifikant forskjell i clearance ved mild leversvikt versus friske kontroller, mens moderat og alvorlig leversvikt var forbundet med redusert clearance og forlenget halveringstid. Studien er preparatspesifikk; ikke bruk disse dataene som en generell THC-doseringsalgoritme.',
      array['spc']),
    ('tdm',1,'Prøvetaking etter inhalasjon',
      'I et kontrollert forsøk med 18–20 menn per aktiv dose nådde THC i serum gjennomsnittlig maksimal konsentrasjon omtrent 10–14 minutter etter røykestart. Nivåene falt raskt videre, og dose i sigaretten var ikke lik systemisk absorbert dose. Tolking av enkeltmålinger krever derfor prøvetidspunkt og inntaksmåte; de observerte toppverdiene er ikke terapeutiske målverdier eller sikre rusgrenser.',
      array['serum']),
    ('avhengighet_toleranse',3,'Lært mestringsavhengighet',
      'Ved gjentatt bruk av THC-holdig cannabis for å håndtere uro, negative følelser eller søvnvansker kan en person utvikle forventning om å trenge cannabis i bestemte situasjoner. Humane studier finner at mestrings- og søvnmotiver forekommer og henger sammen med bruksmønster, men dokumenterer ikke at isolert THC alene forårsaker en varig slik forventning. Fenomenet er ikke en egen diagnose og er ikke i seg selv ensbetydende med addiksjon, craving eller fysiologisk abstinens.',
      array['coping','motiver']);

  for k in select * from thc_fullforing_kort order by panel,posisjon loop
    select jsonb_agg(
      case c.nokkel
        when 'spc' then to_jsonb(r_spc)
        when 'serum' then to_jsonb(r_serum)
        when 'coping' then to_jsonb(r_coping)
        when 'motiver' then to_jsonb(r_motiver)
        else null
      end order by c.ord
    ) into refs
    from unnest(k.kilder) with ordinality as c(nokkel,ord);

    if refs is null or refs @> '[null]'::jsonb then
      raise exception 'Ukjent eller tom referanse i THC-kort: %', k.tittel;
    end if;

    dokument := jsonb_build_object(
      'type','doc',
      'content',jsonb_build_array(
        jsonb_build_object(
          'type','paragraph',
          'content',jsonb_build_array(
            jsonb_build_object('type','text','text',k.tekst),
            jsonb_build_object('type','sitering',
              'attrs',jsonb_build_object('referanser',refs))
          )
        )
      )
    );
    perform intern.kuratering_nytt(
      side,
      jsonb_build_object(
        'panel',k.panel,'posisjon',k.posisjon,'elementtype','kinetikkort',
        'data',jsonb_build_object('tittel',k.tittel,'dokument',dokument),
        'referanser','[]'::jsonb
      ),
      jsonb_build_object('tittel',k.tittel), kilde
    );
  end loop;
end
$thc_fullforing$;