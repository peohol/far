-- Retting av `intern.kuratering_referanse` (`*_monografkuratering_hjelpere*.sql`,
-- `docs/monografkuratering.md`).
--
--   * Lenken renses for mellomrom før den kontrolleres og sammenlignes, slik
--     referansene lagrer den, så en lenke med mellomrom rundt verken slipper
--     forbi kravet om lenke eller gir en dobbel referanse.
--   * En referanse gjenbrukes bare når både den publiserte utgaven og utkastet
--     har nøyaktig den lenken, og ingen av dem er arkivert. Har et utkast endret
--     lenken, stopper migrasjonen, så kurateringen aldri siterer en publisert
--     referanse med en annen lenke enn den ba om.

create or replace function intern.kuratering_referanse(p_innhold jsonb, p_kilde text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  onsket text := nullif(btrim(p_innhold->>'lenke'), '');
  treff uuid[];
begin
  if nullif(btrim(p_kilde), '') is null then
    raise exception 'En kuratering må ha en kilde i historikken.';
  end if;
  if onsket is null then
    raise exception 'En kilde i en kuratering må ha en lenke.';
  end if;
  -- Utkast og publiserte sammen: en referanse som bare finnes som utkast, er
  -- også redaksjonelt arbeid kurateringen ikke skal gå forbi. En referanse
  -- som er arkivert både i utkastet og publisert, er lagt bort og telles ikke.
  select array_agg(distinct r.objekt_id) into treff
  from public.referanser r
  where btrim(r.lenke) = onsket and not r.arkivert;

  if cardinality(treff) > 1 then
    raise exception 'Lenken % står på % referanser. Duplikatene må avklares først.', onsket, cardinality(treff);
  end if;
  if cardinality(treff) = 1 then
    -- Den publiserte utgaven og utkastet skal begge ha lenken og ikke være
    -- arkivert: ellers er referansen under redigering.
    if not exists (select 1 from public.referanser r where r.objekt_id = treff[1] and r.tilstand = 'publisert')
      or exists (
        select 1 from public.referanser r
        where r.objekt_id = treff[1] and (r.arkivert or btrim(r.lenke) is distinct from onsket)
      ) then
      raise exception 'Lenken % står på en referanse som ikke er publisert med den lenken, eller som har et upublisert utkast med en annen lenke eller en arkivering. Utkastet må avklares først.',
        onsket;
    end if;
    return treff[1];
  end if;

  perform set_config('far.revisjonskilde', p_kilde, true);
  treff := array[(public.opprett_utkast('referanse', p_innhold || jsonb_build_object('lenke', onsket))).id];
  perform public.publiser_utkast(treff[1], 1);
  return treff[1];
end;
$$;

comment on function intern.kuratering_referanse(jsonb, text) is
  'Den publiserte referansen med lenken, eller en ny, publisert referanse. Stopper hvis lenken står på flere (utkast medregnet), eller på en der utkastet har en annen lenke, en arkivering eller ikke er publisert.';

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
