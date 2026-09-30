-- Referansene (1 av 2)
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;

begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- rognstad2021
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Establishing Serum Reference Ranges for Antihypertensive Drugs' and r.lenke = 'https://doi.org/10.1097/FTD.0000000000000806'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Establishing Serum Reference Ranges for Antihypertensive Drugs","forfattere":"Rognstad S et al.","aar":"2021","lenke":"https://doi.org/10.1097/FTD.0000000000000806"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- thorstensen2022
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Development of UHPLC-MS/MS methods to quantify 25 antihypertensive drugs in serum in a cohort of patients treated for hypertension' and r.lenke = 'https://doi.org/10.1016/j.jpba.2022.114908'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Development of UHPLC-MS/MS methods to quantify 25 antihypertensive drugs in serum in a cohort of patients treated for hypertension","forfattere":"Thorstensen CW et al.","aar":"2022","lenke":"https://doi.org/10.1016/j.jpba.2022.114908"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- hiemke2017
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017","forfattere":"Hiemke C et al.","aar":"2018","lenke":"https://doi.org/10.1055/s-0043-116492"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- schulz2020
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics","forfattere":"Schulz M et al.","aar":"2020","lenke":"https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- wu2005
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'A Summary of the Effects of Antihypertensive Medications on Measured Blood Pressure' and r.lenke = 'https://doi.org/10.1016/j.amjhyper.2005.01.011'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"A Summary of the Effects of Antihypertensive Medications on Measured Blood Pressure","forfattere":"Wu J et al.","aar":"2005","lenke":"https://doi.org/10.1016/j.amjhyper.2005.01.011"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- baselt2017
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Disposition of Toxic Drugs and Chemicals in Man' and r.lenke = ''
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Disposition of Toxic Drugs and Chemicals in Man","forfattere":"Baselt RC","aar":"2017","lenke":""}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- felleskatalogen
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Felleskatalogen' and r.lenke = 'https://www.felleskatalogen.no/'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Felleskatalogen","forfattere":"Felleskatalogen AS","aar":"","lenke":"https://www.felleskatalogen.no/"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- legemiddelhandboka
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Norsk legemiddelhåndbok' and r.lenke = 'https://www.legemiddelhandboka.no/'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Norsk legemiddelhåndbok","forfattere":"Foreningen for utgivelse av Norsk legemiddelhåndbok","aar":"","lenke":"https://www.legemiddelhandboka.no/"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-ace-hemmere
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'ACE-hemmere – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/ace-hemmere-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"ACE-hemmere – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/ace-hemmere-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-betablokkere
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Betablokkere – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/betablokkere-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Betablokkere – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/betablokkere-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-angiotensin-2-antagonister
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Angiotensin-2-antagonister – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/angiotensin-2-antagonister-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Angiotensin-2-antagonister – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/angiotensin-2-antagonister-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-amlodipin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Amlodipin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/amlodipin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Amlodipin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/amlodipin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-diltiazem
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Diltiazem – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/diltiazem-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Diltiazem – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/diltiazem-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-nifedipin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Nifedipin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/nifedipin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Nifedipin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/nifedipin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-verapamil
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Verapamil – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/verapamil-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Verapamil – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/verapamil-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-lerkanidipin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Lerkanidipin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/lerkanidipin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Lerkanidipin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/lerkanidipin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-atenolol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Atenolol «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/atenolol-viatris-viatris-546528'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Atenolol «Viatris»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/atenolol-viatris-viatris-546528"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-bendroflumetiazid
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Centyl med kaliumklorid / Centyl mite med kaliumklorid «Karo Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/centyl-med-kaliumklorid-centyl-mite-med-kaliumklorid-karo-pharma-547387'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Centyl med kaliumklorid / Centyl mite med kaliumklorid «Karo Pharma»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/centyl-med-kaliumklorid-centyl-mite-med-kaliumklorid-karo-pharma-547387"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-bisoprolol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Bisoprolol Sandoz «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/bisoprolol-sandoz-sandoz-546885'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Bisoprolol Sandoz «Sandoz»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/bisoprolol-sandoz-sandoz-546885"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-bumetanid
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Burinex «Karo Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/burinex-karo-pharma-547150'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Burinex «Karo Pharma»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/burinex-karo-pharma-547150"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-doksazosin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Carduran CR «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/carduran-cr-viatris-547272'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Carduran CR «Viatris»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/carduran-cr-viatris-547272"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-enalapril
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Enalapril Sandoz «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/enalapril-sandoz-sandoz-558589'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Enalapril Sandoz «Sandoz»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/enalapril-sandoz-sandoz-558589"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-eplerenon
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Inspra «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/inspra-viatris-560083'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Inspra «Viatris»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/inspra-viatris-560083"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-furosemid
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Furix «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/furix-orifarm-healthcare-559469'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Furix «Orifarm Healthcare»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/furix-orifarm-healthcare-559469"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-hydroklortiazid
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Hydromed «EQL Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/hydromed-eql-pharma-579916'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Hydromed «EQL Pharma»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/hydromed-eql-pharma-579916"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Referansene (2 av 2)
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;

begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- spc-karvedilol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Carvedilol HEXAL «HEXAL»' and r.lenke = 'https://www.felleskatalogen.no/medisin/carvedilol-hexal-hexal-547279'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Carvedilol HEXAL «HEXAL»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/carvedilol-hexal-hexal-547279"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-labetalol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Trandate «Aspen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/trandate-aspen-564767'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Trandate «Aspen»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/trandate-aspen-564767"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-lisinopril
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Lisinopril ratiopharm «ratiopharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/lisinopril-ratiopharm-ratiopharm-561023'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Lisinopril ratiopharm «ratiopharm»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/lisinopril-ratiopharm-ratiopharm-561023"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-losartan
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Losartan Krka «KRKA»' and r.lenke = 'https://www.felleskatalogen.no/medisin/losartan-krka-krka-588049'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Losartan Krka «KRKA»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/losartan-krka-krka-588049"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- bruun2025
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Effect of metoprolol exposure following myocardial infarction on future cardiovascular events: a Mendelian randomization study' and r.lenke = 'https://doi.org/10.1007/s00228-025-03806-w'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Effect of metoprolol exposure following myocardial infarction on future cardiovascular events: a Mendelian randomization study","forfattere":"Bruun LD et al.","aar":"2025","lenke":"https://doi.org/10.1007/s00228-025-03806-w"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-metoprolol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Selo-Zok «Recordati»' and r.lenke = 'https://www.felleskatalogen.no/medisin/selo-zok-recordati-563801'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Selo-Zok «Recordati»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/selo-zok-recordati-563801"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-ramipril
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ramipril HEXAL «HEXAL»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ramipril-hexal-hexal-563204'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Ramipril HEXAL «HEXAL»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/ramipril-hexal-hexal-563204"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-spironolakton
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Spirix «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/spirix-orifarm-healthcare-564122'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Spirix «Orifarm Healthcare»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/spirix-orifarm-healthcare-564122"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-telmisartan
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Telmisartan Actavis «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/telmisartan-actavis-actavis-585999'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Telmisartan Actavis «Actavis»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/telmisartan-actavis-actavis-585999"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- spc-valsartan
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Diovan «Novartis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/diovan-novartis-548015'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra antihypertensiver.docx', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Diovan «Novartis»","forfattere":"Felleskatalogen (preparatomtale)","aar":"","lenke":"https://www.felleskatalogen.no/medisin/diovan-novartis-548015"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;