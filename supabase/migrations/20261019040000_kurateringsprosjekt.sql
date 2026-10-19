-- Kurateringen flyttes til et eget prosjekt med en Claude-kurator og en
-- uavhengig Claude-kontrollør (docs/kuratering-prosjekt.md):
--
-- * Kontrolløren `claude-monografikontrollor` legges inn, uten nøkkel. Nøklene
--   til begge Claude-agentene lages i det nye prosjektet med
--   `npm run kurator -- nye-nokler`, som skriver en egen migrasjon med bare
--   kontrollsummene.
-- * ChatGPT-kontrolløren deaktiveres: nøkkelen avvises fra nå. En administrator
--   kan slå den på igjen med «Lag ny nøkkel» under Kurateringer → Agentene.
--   De sperrende trådene den har åpnet, kan nå lukkes av en annen kontrollør
--   når de er løst, ikke bare av en administrator.
-- * Visningsnavnene på de to eldre agentene rettes fra «monograf» til
--   «monografi». Nøklene (ID-ene) er de samme. Radene i endringsagenter kan
--   ellers ikke endres, så vernet slås av bare rundt denne ene rettingen, i
--   samme transaksjon.

alter table public.endringsagenter disable trigger endringsagenter_uforanderlig;

update public.endringsagenter set navn = 'Claude monografikurator' where nokkel = 'claude-monografkurator';
update public.endringsagenter set navn = 'ChatGPT monografikurator' where nokkel = 'chatgpt-monografkurator';

alter table public.endringsagenter enable trigger endringsagenter_uforanderlig;

insert into public.endringsagenter (nokkel, navn, art, beskrivelse) values
  ('claude-monografikontrollor', 'Claude monografikontrollør', 'ki-agent',
    'Kontrollerer kurateringsgrenene uavhengig av kuratoren etter kontrollørinstruksen (docs/kontrollorinstruks.md). Kuraterer ikke.');

insert into kuratering.agenter (agent, roller) values ('claude-monografikontrollor', array['kontrollor']);

update kuratering.agenter set aktiv = false where agent = 'chatgpt-monografkurator';

create or replace function kuratering.h_lukk_kommentar(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  traad kuratering.kommentarer;
  tekst text := coalesce(nullif(btrim(p_data ->> 'tekst'), ''), 'Lukket.');
  v_klient text := nullif(btrim(p_data ->> 'klient_id'), '');
begin
  perform kuratering.krev_leser(p_aktor, g);
  traad := kuratering.traaden(g, (p_data ->> 'kommentar')::uuid);
  if traad.art = 'sperrende' and not p_aktor.admin
    and (p_aktor.agent is null or traad.agent is distinct from p_aktor.agent)
    -- En kontrollør som er slått av, kan ikke lukke trådene sine; en annen
    -- kontrollør tar dem over.
    and not ('kontrollor' = any (p_aktor.roller) and exists (
      select 1 from kuratering.agenter a where a.id = traad.agent and not a.aktiv and 'kontrollor' = any (a.roller)))
  then
    raise exception 'En sperrende tråd lukkes av den som åpnet den, eller en administrator.' using errcode = '42501';
  end if;
  if kuratering.traadhandling_lagret(g, p_aktor, traad.id, 'lukket', tekst, v_klient) then
    return jsonb_build_object('traad', traad.id, 'status', kuratering.traadstatus(traad.id), 'klient_id', v_klient, 'alt_lagret', true);
  end if;
  perform kuratering.krev_aktiv_traad(g);
  if kuratering.traadstatus(traad.id) = 'lukket' then
    raise exception 'Tråden er alt lukket.' using errcode = '22023';
  end if;
  perform kuratering.ny_kommentar(g, p_aktor, traad.id, 'lukket', null, null, tekst, v_klient);
  return jsonb_strip_nulls(jsonb_build_object('traad', traad.id, 'status', 'lukket', 'klient_id', v_klient));
end;
$$;
