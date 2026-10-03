# Bivirkninger fra preparatomtaler

Én JSON-fil per preparatomtale (SPC) per fagside, med navnet
`<fagsidenøkkel>--<kildenøkkel>.json`. Formatet, kontrollen og arbeidsflyten
står i `docs/bivirkninger.md`, og malen i `supabase/maler/bivirkningsimport.json`.

Filene her er sannheten for hva som er importert: testen
`src/__tests__/bivirkninger.test.ts` krever at hver fil er lik den siste
importen av samme kilde i migrasjonene, og at hver kilde migrasjonene har
lagt inn og ikke trukket tilbake, har en fil her.
