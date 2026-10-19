-- Nøklene til Claude-agentene i kurateringsprosjektet (docs/kuratering-prosjekt.md),
-- laget med `npm run kurator -- nye-nokler`. Bare SHA-256 av nøklene står her;
-- selve nøklene ligger i prosjektets delte mappe. Den forrige nøkkelen til
-- hver agent slutter å virke.

do $nokler$
begin
  update kuratering.agenter set nokkel_sha256 = 'cd68f498939a7a743c34cb965ef4239a4e5733049fe3c174315d2276a5a0569f', nokkel_kl = now(), aktiv = true where agent = 'claude-monografkurator';
  if not found then raise exception 'Fant ikke agenten claude-monografkurator.'; end if;
  update kuratering.agenter set nokkel_sha256 = '46c40a2b695c11adc72a6b5f20af88c5cbbb4c6909b1840d5014b77d2845d2c1', nokkel_kl = now(), aktiv = true where agent = 'claude-monografikontrollor';
  if not found then raise exception 'Fant ikke agenten claude-monografikontrollor.'; end if;
end
$nokler$;
