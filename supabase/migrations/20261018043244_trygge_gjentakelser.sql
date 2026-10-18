-- Skrivekall som er trygge å gjenta, og en oversikt som sier hvem som har
-- neste handling (docs/kurateringsgrener.md, fase F3).
--
-- Et svar kan forsvinne etter at kallet er utført (et brudd i forbindelsen,
-- en klient som stopper). Når den samme agenten eller personen gjentar et
-- kall som alt har virket, svarer handlingen nå med det som ble lagret og
-- `alt_lagret: true`, i stedet for en feil som ser ut som om kallet ikke ble
-- utført:
--
-- - `vurder`: den siste vurderingen av revisjonen er den samme (beslutning og
--   begrunnelse), av den samme, og statusen er den vurderingen satte. En
--   annen vurdering av en revisjon som alt er vurdert, avvises som en
--   konflikt. Med `runde` avvises også et kall fra en eldre kontrollrunde, så
--   en vurdering aldri lander i en runde den ikke gjaldt;
-- - `til_kontroll`: grenen er alt til kontroll med den revisjonen;
-- - `publiser`: grenen er alt publisert;
-- - `lukk_kommentar` og `gjenapne_kommentar`: tråden ble sist lukket eller
--   åpnet igjen av den samme, med den samme teksten.
--
-- Ingenting lagres to ganger, og ingen kontroll faller bort: det som ellers
-- ville blitt avvist, avvises fortsatt.
--
-- Sammendraget får `status_kl` (når grenen fikk statusen den har),
-- `apne_sperrer` og `venter_pa_kurator` (åpne tråder som venter på svar fra
-- kuratoren), så oversikten kan si hva som venter på hvem, og siden når.

-- Om en rad (en vurdering eller en kommentar) er skrevet av den samme agenten
-- eller personen.
create function kuratering.av_samme(p_agent uuid, p_profil uuid, p_aktor kuratering.aktor)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case
    when p_aktor.agent is not null then p_agent = p_aktor.agent
    else p_agent is null and p_profil = (p_aktor.profil).id
  end, false)
$$;

create or replace function kuratering.h_vurder(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  r kuratering.grenrevisjoner;
  v kuratering.vurderinger;
  beslutning text := p_data ->> 'beslutning';
  begrunnelse text := btrim(coalesce(p_data ->> 'begrunnelse', ''));
  hindret text[];
begin
  perform kuratering.krev_rolle(p_aktor, 'kontrollor');
  if p_aktor.agent is not null and p_aktor.agent = g.kurator then
    raise exception 'En agent kan ikke vurdere sin egen kuratering.' using errcode = '42501';
  end if;
  if (p_data ->> 'revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %. Vurder den siste.', g.revisjon, p_data ->> 'revisjon' using errcode = 'PT409';
  end if;
  if p_data ? 'runde' and (p_data ->> 'runde')::integer is distinct from g.runde then
    raise exception 'Grenen er i kontrollrunde %, ikke %. Les grenen på nytt før du vurderer.', g.runde, p_data ->> 'runde' using errcode = 'PT409';
  end if;

  -- Statusen er satt av den siste vurderingen så lenge grenen er godkjent
  -- eller venter på rettinger.
  if g.status in ('godkjent', 'tilbakemelding') then
    select x.* into v from kuratering.vurderinger x where x.gren = g.id order by x.id desc limit 1;
    if v.revisjon = g.revisjon and v.beslutning = beslutning and v.begrunnelse = begrunnelse
      and kuratering.av_samme(v.agent, v.profil, p_aktor)
    then
      return kuratering.sammendrag(g) || jsonb_build_object('alt_lagret', true);
    end if;
    if v.revisjon = g.revisjon then
      raise exception 'Revisjon % er alt vurdert i kontrollrunde % («%» av %). Les grenen før du gjør noe mer.',
        g.revisjon, g.runde, v.beslutning, coalesce(v.profil_navn, 'en annen') using errcode = 'PT409';
    end if;
  end if;

  perform kuratering.krev_status(g, array['klar'], 'vurderes');
  if beslutning is null or beslutning not in ('godkjent', 'endringer') then
    raise exception 'Beslutningen må være godkjent eller endringer.' using errcode = '22023';
  end if;
  -- Også en godkjenning sier hva som er kontrollert, så kontrollen kan spores.
  if char_length(begrunnelse) not between 1 and 4000 then
    raise exception 'Vurderingen må ha en begrunnelse (1 til 4000 tegn): hva som er kontrollert, eller hva som må endres.' using errcode = '22023';
  end if;
  r := kuratering.revisjonen(g.id, g.revisjon);
  if beslutning = 'godkjent' then
    hindret := array(
      select h from unnest(kuratering.hindringer(g)) h
      where h <> 'Revisjon ' || g.revisjon || ' er ikke faglig godkjent.'
    );
    if cardinality(hindret) > 0 then
      raise exception 'Revisjonen kan ikke godkjennes: %', array_to_string(hindret, ' ') using errcode = '22023';
    end if;
  end if;

  insert into kuratering.vurderinger (gren, infoside, revisjon, fingeravtrykk, beslutning, begrunnelse, agent, profil, profil_navn)
  values (g.id, g.infoside, g.revisjon, r.fingeravtrykk, beslutning, begrunnelse,
    p_aktor.agent, case when p_aktor.agent is null then (p_aktor.profil).id end, kuratering.aktornavn(p_aktor));
  g := kuratering.sett_status(g, case beslutning when 'godkjent' then 'godkjent' else 'tilbakemelding' end,
    p_aktor, 'vurdert', null, jsonb_build_object('beslutning', beslutning));
  return kuratering.sammendrag(g);
end;
$$;

create or replace function kuratering.h_til_kontroll(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  r kuratering.grenrevisjoner;
  ubesvart integer;
  vurdert bigint;
  uten_endringer boolean;
begin
  perform kuratering.krev_kurator(p_aktor, g);
  if (p_data ->> 'revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %.', g.revisjon, p_data ->> 'revisjon' using errcode = 'PT409';
  end if;
  if g.status = 'klar' then
    return kuratering.sammendrag(g) || jsonb_build_object('alt_lagret', true);
  end if;
  perform kuratering.krev_status(g, array['arbeid', 'retting', 'tilbakemelding'], 'sendes til kontroll');
  if g.blindfase then
    raise exception 'Blindfasen må avsluttes før grenen sendes til kontroll.' using errcode = '22023';
  end if;
  r := kuratering.revisjonen(g.id, g.revisjon);
  if r.revisjon is null then
    raise exception 'Grenen har ingen endringer.' using errcode = '22023';
  end if;
  if not coalesce((r.teknisk ->> 'ok')::boolean, false) or not coalesce((r.teknisk ->> 'rapport_ok')::boolean, false) then
    raise exception 'Prøvepubliseringen må bestå, med en rapport som stemmer, før grenen sendes til kontroll: %',
      coalesce(r.teknisk ->> 'feil', r.teknisk ->> 'rapportfeil', 'ukjent feil') using errcode = '22023';
  end if;
  if (kuratering.siste_versjon(g.infoside)).id is distinct from g.grunnversjon then
    raise exception 'Fagsiden er publisert på nytt; oppdater grenen til den nye versjonen først.' using errcode = 'PT409';
  end if;
  perform kuratering.krev_dokumenter(g, kuratering.pakrevde_dokumenter(g.art), 'Grenen kan ikke sendes til kontroll');
  select count(*) into ubesvart
  from jsonb_array_elements(kuratering.traader(g)) t
  where t ->> 'art' = 'sperrende' and (t ->> 'venter_pa_kurator')::boolean;
  if ubesvart > 0 then
    raise exception '% sperrende kommentar(er) venter på svar fra kuratoren.', ubesvart using errcode = '22023';
  end if;

  -- Svaret på vurderingen: en kommentar fra kuratoren (ikke en lukking) etter
  -- den. Hendelsene står i den rekkefølgen de skjedde, siden grenen er låst
  -- for både vurderingen og kommentaren, også når de kommer i samme øyeblikk.
  if g.status = 'tilbakemelding' then
    select max(h.id) into vurdert
    from kuratering.hendelser h
    where h.gren = g.id and h.hendelse = 'vurdert';
    if not exists (
      select 1 from kuratering.hendelser h
      where h.gren = g.id and h.hendelse = 'kommentar' and h.agent = g.kurator
        and h.data ->> 'handling' = 'kommentar' and h.id > coalesce(vurdert, 0)
    ) then
      raise exception 'Svar på vurderingen før den samme revisjonen sendes til en ny kontrollrunde: svar i trådene eller skriv en merknad. Er det noe å rette, lagre en ny revisjon.'
        using errcode = '22023';
    end if;
  end if;

  uten_endringer := exists (select 1 from kuratering.vurderinger v where v.gren = g.id and v.revisjon = g.revisjon);
  update kuratering.grener x set runde = x.runde + 1 where x.id = g.id returning x.* into g;
  g := kuratering.sett_status(g, 'klar', p_aktor, 'til_kontroll', null,
    jsonb_build_object('runde', g.runde)
      || case when uten_endringer then jsonb_build_object('uten_endringer', true) else '{}'::jsonb end);
  return kuratering.sammendrag(g);
end;
$$;

create or replace function kuratering.h_publiser(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
begin
  if not p_aktor.admin then
    perform kuratering.krev_kurator(p_aktor, g);
  end if;
  if (p_data ->> 'revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %.', g.revisjon, p_data ->> 'revisjon' using errcode = 'PT409';
  end if;
  if g.status = 'publisert' then
    return jsonb_build_object('ok', true, 'status', 'publisert',
      'versjon', (select v.nr from public.sideversjoner v where v.id = g.publisert_versjon), 'alt_lagret', true);
  end if;
  return kuratering.publiser(g, p_aktor);
end;
$$;

-- Den siste lukkingen eller gjenåpningen av tråden.
create function kuratering.siste_traadhandling(p_traad uuid)
returns kuratering.kommentarer
language sql
stable
set search_path = ''
as $$
  select x.* from kuratering.kommentarer x
  where x.traad = p_traad and x.handling in ('lukket', 'gjenapnet')
  order by x.opprettet_kl desc, x.id desc
  limit 1
$$;

create or replace function kuratering.h_lukk_kommentar(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  traad kuratering.kommentarer;
  siste kuratering.kommentarer;
  tekst text := coalesce(nullif(btrim(p_data ->> 'tekst'), ''), 'Lukket.');
begin
  perform kuratering.krev_leser(p_aktor, g);
  perform kuratering.krev_aktiv_traad(g);
  traad := kuratering.traaden(g, (p_data ->> 'kommentar')::uuid);
  if traad.art = 'sperrende' and not p_aktor.admin
    and (p_aktor.agent is null or traad.agent is distinct from p_aktor.agent)
  then
    raise exception 'En sperrende tråd lukkes av den som åpnet den, eller en administrator.' using errcode = '42501';
  end if;
  siste := kuratering.siste_traadhandling(traad.id);
  if siste.handling = 'lukket' then
    if siste.tekst = tekst and kuratering.av_samme(siste.agent, siste.profil, p_aktor) then
      return jsonb_build_object('traad', traad.id, 'status', 'lukket', 'alt_lagret', true);
    end if;
    raise exception 'Tråden er alt lukket.' using errcode = '22023';
  end if;
  perform kuratering.ny_kommentar(g, p_aktor, traad.id, 'lukket', null, null, tekst);
  return jsonb_build_object('traad', traad.id, 'status', 'lukket');
end;
$$;

create or replace function kuratering.h_gjenapne_kommentar(p_aktor kuratering.aktor, p_data jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g kuratering.grener := kuratering.gren_fra(p_data);
  traad kuratering.kommentarer;
  siste kuratering.kommentarer;
begin
  perform kuratering.krev_rolle(p_aktor, 'kontrollor');
  perform kuratering.krev_aktiv_traad(g);
  traad := kuratering.traaden(g, (p_data ->> 'kommentar')::uuid);
  siste := kuratering.siste_traadhandling(traad.id);
  if siste.handling is distinct from 'lukket' then
    if siste.handling = 'gjenapnet' and siste.tekst = btrim(coalesce(p_data ->> 'tekst', ''))
      and kuratering.av_samme(siste.agent, siste.profil, p_aktor)
    then
      return jsonb_build_object('traad', traad.id, 'status', 'apen', 'alt_lagret', true);
    end if;
    raise exception 'Tråden er åpen.' using errcode = '22023';
  end if;
  perform kuratering.ny_kommentar(g, p_aktor, traad.id, 'gjenapnet', null, null, p_data ->> 'tekst');
  return jsonb_build_object('traad', traad.id, 'status', 'apen');
end;
$$;

create or replace function kuratering.sammendrag(p_gren kuratering.grener)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_gren.id,
    'stoff', p_gren.stoff,
    'navn', (select s.navn from public.infosider s where s.objekt_id = p_gren.infoside and s.tilstand = 'publisert'),
    'art', p_gren.art,
    'formaal', p_gren.formaal,
    'status', p_gren.status,
    'status_grunn', p_gren.status_grunn,
    'status_kl', (select max(h.kl) from kuratering.hendelser h where h.gren = p_gren.id and h.til = p_gren.status),
    'runde', p_gren.runde,
    'revisjon', p_gren.revisjon,
    'blindfase', p_gren.blindfase,
    'kurator', (select e.navn from kuratering.agenter a join public.endringsagenter e on e.nokkel = a.agent where a.id = p_gren.kurator),
    'opprettet_av', p_gren.opprettet_av_navn,
    'grunnversjon', (select v.nr from public.sideversjoner v where v.id = p_gren.grunnversjon),
    'konflikt', kuratering.er_aktiv(p_gren.status) and (kuratering.siste_versjon(p_gren.infoside)).id is distinct from p_gren.grunnversjon,
    'teknisk_ok', (select (r.teknisk ->> 'ok')::boolean and coalesce((r.teknisk ->> 'rapport_ok')::boolean, p_gren.kurator is null)
      from kuratering.grenrevisjoner r where r.gren = p_gren.id and r.revisjon = p_gren.revisjon),
    'apne_sperrer', case when kuratering.er_aktiv(p_gren.status) then t.apne_sperrer end,
    'venter_pa_kurator', case when kuratering.er_aktiv(p_gren.status) then t.venter_pa_kurator end,
    'aktivitet', p_gren.aktivitet,
    'opprettet_kl', p_gren.opprettet_kl,
    'oppdatert_kl', p_gren.oppdatert_kl,
    'publisert_kl', p_gren.publisert_kl,
    'publisert_versjon', (select v.nr from public.sideversjoner v where v.id = p_gren.publisert_versjon)
  ))
  -- Trådene telles bare i grener som fortsatt kan endres.
  from (
    select
      count(*) filter (where x ->> 'status' = 'apen' and x ->> 'art' = 'sperrende') as apne_sperrer,
      count(*) filter (where (x ->> 'venter_pa_kurator')::boolean) as venter_pa_kurator
    from jsonb_array_elements(kuratering.traader(p_gren)) x
    where kuratering.er_aktiv(p_gren.status)
  ) t
$$;

revoke all on all functions in schema kuratering from public, anon, authenticated, service_role;
