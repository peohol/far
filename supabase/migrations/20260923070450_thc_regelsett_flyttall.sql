-- THC-syreregelsettet skal leses tilbake til nøyaktig de samme flyttallene som
-- ble lagret.
--
-- Supabase skriver flyttall med 15 gjeldende sifre (extra_float_digits = 0 i
-- konfigurasjonen). Øyeblikksbildet gjør tallene om til JSON, og fikk dermed
-- bare 15 sifre — og det publiserte, som skrives av øyeblikksbildet, likeså.
-- Kurveparametrene har 16–17. Funksjonen setter nå selv innstillingen som gir
-- den korteste eksakte skrivemåten.
alter function intern.les_thc_regelsett(uuid, public.objekttilstand) set extra_float_digits = 1;

-- Et regelsett som alt er lagret med for få sifre, rettes: utkastet — som
-- ble skrevet av det som ble sendt inn, med alle sifrene — lagres som en ny
-- revisjon og publiseres, gjennom de vanlige funksjonene og som den som
-- lagret revisjonen som rettes. Historikken står urørt.
do $rett$
declare
  objekt uuid;
  gjeldende public.objektrevisjoner;
  publisert integer;
  status public.objektstatus;
begin
  select o.id into objekt from public.redigerbare_objekter o where o.type = 'thc_regelsett';
  if objekt is null then
    return;
  end if;

  select r.* into gjeldende
  from public.objekttilstander t
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = t.revisjon
  where t.objekt_id = objekt and t.tilstand = 'utkast';
  if gjeldende.innhold = intern.les_thc_regelsett(objekt, 'utkast') then
    return;
  end if;

  select t.revisjon into publisert
  from public.objekttilstander t
  where t.objekt_id = objekt and t.tilstand = 'publisert';

  perform set_config('request.jwt.claims',
    json_build_object('sub', gjeldende.utfort_av, 'role', 'authenticated')::text, true);
  perform set_config('far.revisjonskilde',
    'Rettet: tallene ble lagret med 15 gjeldende sifre i stedet for alle', true);
  status := public.lagre_utkast(objekt, gjeldende.revisjon, intern.les_thc_regelsett(objekt, 'utkast'));
  if publisert = gjeldende.revisjon then
    perform public.publiser_utkast(objekt, status.revisjon);
  end if;
end
$rett$;
