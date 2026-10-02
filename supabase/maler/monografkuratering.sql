-- Mal for en monografkuratering (`docs/monografkuratering.md`).
--
-- Kopier filen til supabase/migrations/<versjon>_<stoff>_monografkuratering.sql
-- og bytt ut eksemplet: nøkkelen til stoffsiden, kilden, preflighten med
-- antallene og revisjonene kuratoren kontrollerte i produksjonen, og endringene.
-- `monografkuratering.test.ts` kjører malen slik den står, mot en eksempelside.
do $kuratering$
declare
  -- Uten kuratorprofil (tom database) gir start null, og ingenting gjøres.
  side uuid := intern.kuratering_start('eksempelstoff');
  kilde constant text := 'Monografkuratering av eksempelstoff 02.10.2026: farmakodynamikk og dosering';
  d2 uuid;
  h1 uuid;
  dosering uuid;
  referanse uuid;
begin
  if side is null then
    return;
  end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  -- 1. Preflight: alt migrasjonen endrer, slik kuratoren så det. Står noe
  --    annerledes, stopper migrasjonen før noe er endret.
  perform intern.kuratering_antall(side, 'farmakodynamikk', 'mekanismekort', 2);
  d2 := intern.kuratering_element(side, 'farmakodynamikk', 'mekanismekort', '{"maal": "D2-reseptor"}', 1);
  h1 := intern.kuratering_element(side, 'farmakodynamikk', 'mekanismekort', '{"maal": "H1-reseptor"}', 1);
  perform intern.kuratering_antall(side, 'dosering', 'riktekst', 1);
  dosering := intern.kuratering_element(side, 'dosering', 'riktekst', '{}', 2);

  -- 2. Kildene: en som mangler, legges inn.
  referanse := intern.kuratering_referanse(
    '{"tittel": "Eksempelkilde", "forfattere": "Forfatter A", "aar": "2026", "lenke": "https://example.org/eksempelkilde"}',
    kilde);

  -- 3. Endringene, hver mot revisjonen preflighten bandt den til.
  perform intern.kuratering_lagre(d2, 1, jsonb_build_object(
    'data', '{"maal": "D2-reseptor", "mekanisme": "antagonisme", "dokument": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Kuratert tekst."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse)), kilde);
  perform intern.kuratering_lagre(h1, 1, '{"panel": "fjernet"}', kilde);
  perform intern.kuratering_lagre(dosering, 2, jsonb_build_object(
    'data', '{"dokument": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Kuratert dosering."}]}]}}'::jsonb), kilde);
  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel', 'farmakodynamikk', 'posisjon', 2, 'elementtype', 'mekanismekort',
    'data', '{"maal": "5-HT2C-reseptor", "mekanisme": "antagonisme", "dokument": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Nytt kort."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse)), '{"maal": "5-HT2C-reseptor"}', kilde);
end
$kuratering$;
