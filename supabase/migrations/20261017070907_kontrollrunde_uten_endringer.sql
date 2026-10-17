-- En ny kontrollrunde uten endringer (docs/kurateringsgrener.md, «Statusene»;
-- fase 9 i docs/kuratorprotokoll.md). Har kontrolløren bedt om endringer
-- (`tilbakemelding`) og kuratoren ikke har noe å rette — kontrolløren var ikke
-- ferdig med kildekontrollen, eller kuratoren har vist med kilder at
-- innvendingen ikke holder — sender kuratoren den samme revisjonen til en ny
-- runde, i stedet for å lage en kunstig revisjon for å komme videre.
--
-- Kravene til en kontrollrunde gjelder som før. I tillegg må kuratoren ha
-- svart på vurderingen: skrevet minst én kommentar i grenen (et svar i en tråd
-- eller en ny merknad) etter den. Runden økes som vanlig, og hendelsen
-- `til_kontroll` får `uten_endringer: true` når revisjonen er vurdert før, så
-- kontrolløren og appen ser at det er de samme endringene og svarene som skal
-- leses.
--
-- Den siste vurderingen av en revisjon er den som gjelder. Publiseringen
-- (`kuratering.hindringer`) bruker den alt, så en godkjenning etter en ny
-- runde kan publiseres, og en eldre godkjenning gjelder ikke etter en senere
-- `endringer`. Lesingen sier nå det samme: `gjelder_denne` er bare sann for
-- den siste vurderingen av revisjonen som vises (før var den sann for hver
-- vurdering med samme fingeravtrykk). Bare kuratering.h_til_kontroll og
-- kuratering.detaljer endres; resten står som før.

-- En ny kontrollrunde krever at kuratoren har svart i hver åpen sperrende
-- tråd der kontrolløren sist skrev. Fra `tilbakemelding` går den samme
-- revisjonen til en ny runde bare når kuratoren også har svart på
-- vurderingen.
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
  perform kuratering.krev_status(g, array['arbeid', 'retting', 'tilbakemelding'], 'sendes til kontroll');
  if (p_data ->> 'revisjon')::integer is distinct from g.revisjon then
    raise exception 'Grenen er på revisjon %, ikke %.', g.revisjon, p_data ->> 'revisjon' using errcode = 'PT409';
  end if;
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

-- Grenen i sin helhet for den som skal arbeide med eller kontrollere den: en
-- revisjon (den siste når ingen er oppgitt) med tilstanden, prøvepubliseringen
-- og forhåndsvisningen, grunnversjonen, vurderingene, hendelsene og
-- dokumentene. Kuratoren ser i blindfasen bare oppbygningen av grunnversjonen
-- og ingen forhåndsvisning. `gjelder_denne` er sann for vurderingen som
-- gjelder revisjonen som vises: den siste av den, med samme fingeravtrykk.
create or replace function kuratering.detaljer(p_gren kuratering.grener, p_revisjon integer, p_blind boolean)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  r kuratering.grenrevisjoner := kuratering.revisjonen(p_gren.id, coalesce(p_revisjon, p_gren.revisjon));
  grunnlag public.sideversjoner;
  gjeldende bigint;
begin
  if p_revisjon is not null and r.revisjon is null then
    raise exception 'Grenen har ingen revisjon %.', p_revisjon using errcode = 'PT404';
  end if;
  select v.* into grunnlag from public.sideversjoner v where v.id = coalesce(r.grunnversjon, p_gren.grunnversjon);
  select max(v.id) into gjeldende from kuratering.vurderinger v where v.gren = p_gren.id and v.revisjon = r.revisjon;
  return kuratering.sammendrag(p_gren) || jsonb_build_object(
    'grenrevisjon', case when r.revisjon is null then null else jsonb_strip_nulls(jsonb_build_object(
      'revisjon', r.revisjon,
      'fingeravtrykk', r.fingeravtrykk,
      'melding', r.melding,
      'av', r.profil_navn,
      'kl', r.opprettet_kl,
      'tilstand', r.innhold,
      'teknisk', r.teknisk,
      'forhandsvisning', case when p_blind then null else r.forhandsvisning end
    )) end,
    'grunnlag', case
      when p_blind then kuratering.oppbygning(grunnlag)
      else public.les_sideversjon(p_gren.stoff, grunnlag.nr)
    end,
    'vurderinger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'revisjon', v.revisjon, 'beslutning', v.beslutning, 'begrunnelse', v.begrunnelse,
        'av', v.profil_navn, 'kl', v.opprettet_kl,
        'gjelder_denne', coalesce(v.id = gjeldende and v.fingeravtrykk = r.fingeravtrykk, false))
        order by v.id)
      from kuratering.vurderinger v where v.gren = p_gren.id
    ), '[]'::jsonb),
    'hendelser', coalesce((
      select jsonb_agg(h.j order by h.id desc)
      from (
        select x.id, jsonb_strip_nulls(jsonb_build_object(
          'hendelse', x.hendelse, 'fra', x.fra, 'til', x.til, 'revisjon', x.revisjon,
          'av', x.profil_navn, 'data', nullif(x.data, '{}'::jsonb), 'kl', x.kl)) as j
        from kuratering.hendelser x where x.gren = p_gren.id
        order by x.id desc limit 100
      ) h
    ), '[]'::jsonb),
    'dokumenter', coalesce((
      select jsonb_agg(jsonb_build_object('art', d.art, 'versjon', d.versjon, 'kl', d.opprettet_kl) order by d.art, d.versjon)
      from kuratering.dokumenter d where d.gren = p_gren.id
        and d.versjon = (select max(d2.versjon) from kuratering.dokumenter d2 where d2.gren = d.gren and d2.art = d.art)
    ), '[]'::jsonb),
    'hindringer', to_jsonb(kuratering.hindringer(p_gren)),
    'manglende_dokumenter', to_jsonb(kuratering.manglende_dokumenter(p_gren))
  );
end;
$$;

revoke all on all functions in schema kuratering from public, anon, authenticated, service_role;
