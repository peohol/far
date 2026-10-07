-- THC-syreregelsettet: de låste delene håndheves i databasen, og
-- redigeringen lagres i én transaksjon.
--
-- 1. Utskillelseskurvene og konverteringsfaktoren er låst (Peder, 07.10.2026):
--    de endres bare i koden, med en migrasjon, aldri i appen. Hittil ble det
--    bare håndhevet når redigeringen lagret. All skriving av regelsettet —
--    lagring, gjenoppretting av en eldre revisjon og publisering — går
--    gjennom intern.skriv_thc_regelsett, så kontrollen legges der: finnes
--    det et publisert regelsett, må de låste delene være nøyaktig som i det.
--    En migrasjon som skal endre dem, slår av kontrollen for sin egen
--    transaksjon med
--
--      select set_config('far.endre_thc_laste_deler', 'ja', true);
--
--    Innstillingen kan ikke settes gjennom data-API-et.
--
-- 2. Redigeringen lagret kommentarene og regelsettet hver for seg. Ga ett av
--    dem en samtidighetskonflikt, ble det som alt var lagret, stående, og
--    «Forkast mine endringer» forkastet ikke hele redigeringen.
--    lagre_thc_regelsett lagrer alt i én transaksjon, slik intervall- og
--    scenarioregelsettene lagres: alt eller ingenting, hver mot revisjonen
--    redigeringen åpnet.

-- --- De låste delene -------------------------------------------------------

-- Avviser innhold der kurvene eller konverteringsfaktoren er forskjellig fra
-- det publiserte regelsettet. Uten et publisert regelsett er det ingenting å
-- holde dem lik.
create function intern.krev_thc_laste_deler(p_objekt uuid, p_innhold jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  faktor double precision;
  kurver jsonb;
  kurve jsonb;
  k public.thc_kurver;
begin
  if current_setting('far.endre_thc_laste_deler', true) is not distinct from 'ja' then
    return;
  end if;

  select r.konverteringsfaktor into faktor
  from public.thc_regelsett r
  where r.objekt_id = p_objekt and r.tilstand = 'publisert';
  if not found then
    return;
  end if;

  if intern.flyttall(p_innhold, 'konverteringsfaktor') is distinct from faktor then
    raise exception 'Konverteringsfaktoren er låst og kan bare endres i koden.' using errcode = '22023';
  end if;

  kurver := intern.objekt(p_innhold, 'kurver');
  for k in
    select * from public.thc_kurver x where x.objekt_id = p_objekt and x.tilstand = 'publisert'
  loop
    kurve := intern.objekt(kurver, k.rolle::text);
    if intern.tekst(kurve, 'navn') is distinct from k.navn
      or intern.flyttall(kurve, 'a1') is distinct from k.a1
      or intern.flyttall(kurve, 'k1') is distinct from k.k1
      or intern.flyttall(kurve, 'a2') is distinct from k.a2
      or intern.flyttall(kurve, 'k2') is distinct from k.k2
    then
      raise exception 'Utskillelseskurvene er låst og kan bare endres i koden.' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- Skrivingen og valideringen står uendret, under et nytt navn. Funksjonen
-- intern.skriv kaller, kontrollerer de låste delene først, og skriver så.
-- Skal valideringen endres, er det skriv_thc_regelsett_innhold som endres.
alter function intern.skriv_thc_regelsett(uuid, public.objekttilstand, jsonb)
  rename to skriv_thc_regelsett_innhold;

create function intern.skriv_thc_regelsett(
  p_objekt uuid, p_tilstand public.objekttilstand, p_innhold jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform intern.krev_thc_laste_deler(p_objekt, p_innhold);
  perform intern.skriv_thc_regelsett_innhold(p_objekt, p_tilstand, p_innhold);
end;
$$;

-- --- Lagringen i én transaksjon ---------------------------------------------

create function public.lagre_thc_regelsett(
  objekt uuid, forventet_revisjon integer, innhold jsonb, kommentarer jsonb
)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_admin();
  if (select o.type from public.redigerbare_objekter o where o.id = objekt) is distinct from 'thc_regelsett' then
    raise exception 'Fant ikke regelsettet.' using errcode = 'PT404';
  end if;
  perform intern.lagre_kommentarendringer(kommentarer);
  return public.lagre_utkast(objekt, forventet_revisjon, innhold);
end;
$$;

comment on function public.lagre_thc_regelsett(uuid, integer, jsonb, jsonb) is
  'Lagrer THC-syreregelsettet og de endrede kommentarene tekstbolkene peker på, som utkast i én transaksjon. Avvises med PT409 hvis noen av revisjonene er endret. Krever administrator.';

-- --- Rettigheter -----------------------------------------------------------

revoke all on function public.lagre_thc_regelsett(uuid, integer, jsonb, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.lagre_thc_regelsett(uuid, integer, jsonb, jsonb) to authenticated;

revoke all on function intern.krev_thc_laste_deler(uuid, jsonb)
from public, anon, authenticated, service_role;

revoke all on function intern.skriv_thc_regelsett(uuid, public.objekttilstand, jsonb)
from public, anon, authenticated, service_role;
