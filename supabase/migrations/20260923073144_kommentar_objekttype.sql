-- Fortolkningskommentarer blir en egen objekttype i faginnholdet.
--
-- Verdien legges til i en migrasjon for seg: en ny enum-verdi kan ikke tas i
-- bruk i samme transaksjon som den ble lagt til i. Resten står i neste
-- migrasjon.
alter type public.objekttype add value 'kommentar';