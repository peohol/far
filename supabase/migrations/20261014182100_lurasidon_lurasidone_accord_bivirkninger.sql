-- Bivirkninger for fagsiden «lurasidon» fra Lurasidone Accord - preparatomtale (SPC).
-- Faglig kontrollert mot tabellene for voksne og ungdom i pkt. 4.8 den 14.10.2026.
select intern.endring_start('chatgpt-monografkurator', '20261014182100_lurasidon_lurasidone_accord_bivirkninger.sql', 'Importerer strukturerte bivirkninger fra Lurasidone Accord SPC', array['https://github.com/peohol/far/pull/229']);

select bivirkninger.importer($import${
  "format": "ousfar-bivirkninger/1",
  "stoff": "lurasidon",
  "kilde": {
    "nokkel": "lurasidone-accord-tabletter",
    "type": "spc",
    "tittel": "Lurasidone Accord - preparatomtale (SPC)",
    "preparat": "Lurasidone Accord 18,5 mg, 37 mg og 74 mg filmdrasjerte tabletter",
    "innehaver": "Accord Healthcare B.V.",
    "revisjonsdato": "2026-04-17",
    "lenke": "https://produktinformasjon.legemiddelsok.no/preparatomtaler/22-15235.pdf",
    "kontrollert": "2026-10-14",
    "kontrollert_av": "ChatGPT",
    "importert_av": "chatgpt-monografkurator",
    "merknad": "Preparatomtalen har separate tabeller for voksne og ungdom; populasjonene er derfor bevart som separate kontekster."
  },
  "tabeller": [
    {
      "nokkel": "voksne",
      "navn": "Voksne",
      "frekvensgrunnlag": "Bivirkninger basert på sammensatte data hos voksne",
      "organsystemer": [
        { "organsystem": "infeksiose", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Nasofaryngitt"] }
        ] },
        { "organsystem": "blod_lymfe", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Anemi"] },
          { "frekvens": "sjeldne", "bivirkninger": ["Eosinofili", "Leukopeni"] },
          { "frekvens": "ikke_kjent", "bivirkninger": [{ "tekst": "Nøytropeni", "fotnote": "Bivirkning observert i kontrollerte og ukontrollerte fase 2- og 3-studier, men med en forekomst som var for lav til å anslå frekvensen." }] }
        ] },
        { "organsystem": "immunsystemet", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Overfølsomhet"] }
        ] },
        { "organsystem": "stoffskifte", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Vektøkning", "Nedsatt appetitt"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Økt blodglukose", "Hyponatremi"] }
        ] },
        { "organsystem": "psykiatriske", "frekvenser": [
          { "frekvens": "svaert_vanlige", "bivirkninger": ["Insomni"] },
          { "frekvens": "vanlige", "bivirkninger": ["Agitasjon", "Angst", "Rastløshet"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Mareritt", "Kataton tilstand", "Panikkanfall"] },
          { "frekvens": "sjeldne", "bivirkninger": ["Selvmordsatferd"] },
          { "frekvens": "ikke_kjent", "bivirkninger": [{ "tekst": "Søvnforstyrrelser", "fotnote": "Bivirkning observert i kontrollerte og ukontrollerte fase 2- og 3-studier, men med en forekomst som var for lav til å anslå frekvensen." }] }
        ] },
        { "organsystem": "nevrologiske", "frekvenser": [
          { "frekvens": "svaert_vanlige", "bivirkninger": ["Akatisi"] },
          { "frekvens": "vanlige", "bivirkninger": [
            { "tekst": "Somnolens", "fotnote": "Somnolens omfatter hypersomni, hypersomnolens, sedasjon og somnolens." },
            { "tekst": "Parkinsonisme", "fotnote": "Parkinsonisme omfatter bradykinesi, tannhjulsrigiditet, sikling, ekstrapyramidale forstyrrelser, hypokinesi, muskelrigiditet, parkinsonisme, psykomotorisk retardasjon og tremor." },
            "Svimmelhet",
            { "tekst": "Dystoni", "fotnote": "Dystoni omfatter dystoni, okulogyr krise, oromandibulær dystoni, tungespasme, torticollis og trismus." },
            "Dyskinesi"
          ] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Letargi", "Dysartri", "Tardiv dyskinesi", "Synkope", "Kramper"] },
          { "frekvens": "sjeldne", "bivirkninger": ["Malignt nevroleptikasyndrom", "Cerebrovaskulær hendelse"] }
        ] },
        { "organsystem": "oye", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Tåkesyn"] }
        ] },
        { "organsystem": "ore_labyrint", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Vertigo"] }
        ] },
        { "organsystem": "hjerte", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Takykardi"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Angina pectoris", "Førstegrads AV-blokk", "Bradykardi"] }
        ] },
        { "organsystem": "kar", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Hypertensjon"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Hypotensjon", "Ortostatisk hypotensjon", "Hetetokter", "Økt blodtrykk"] }
        ] },
        { "organsystem": "gastrointestinale", "frekvenser": [
          { "frekvens": "svaert_vanlige", "bivirkninger": ["Kvalme"] },
          { "frekvens": "vanlige", "bivirkninger": ["Diaré", "Oppkast", "Dyspepsi", "Hypersalivasjon", "Munntørrhet", "Smerter i øvre abdomen", "Ubehag i abdomen"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Flatulens", "Dysfagi", "Gastritt"] }
        ] },
        { "organsystem": "lever_galle", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Økt alaninaminotransferase"] }
        ] },
        { "organsystem": "hud", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Utslett", "Pruritus"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Hyperhidrose"] },
          { "frekvens": "sjeldne", "bivirkninger": ["Angioødem"] },
          { "frekvens": "ikke_kjent", "bivirkninger": ["Stevens-Johnsons syndrom"] }
        ] },
        { "organsystem": "muskel_skjelett", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Ryggsmerter", "Muskelstivhet"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Leddstivhet", "Myalgi", "Nakkesmerter"] },
          { "frekvens": "sjeldne", "bivirkninger": ["Rabdomyolyse"] }
        ] },
        { "organsystem": "nyre_urinveier", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Økt kreatinin i blod"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Dysuri"] },
          { "frekvens": "sjeldne", "bivirkninger": ["Nyresvikt"] }
        ] },
        { "organsystem": "svangerskap", "frekvenser": [
          { "frekvens": "ikke_kjent", "bivirkninger": ["Neonatalt seponeringssyndrom"] }
        ] },
        { "organsystem": "kjonnsorganer_bryst", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Økt prolaktin i blod", "Erektil dysfunksjon", "Amenoré", "Dysmenoré"] },
          { "frekvens": "sjeldne", "bivirkninger": ["Brystsmerter", "Galaktoré"] },
          { "frekvens": "ikke_kjent", "bivirkninger": [{ "tekst": "Brystforstørrelse", "fotnote": "Bivirkning observert i kontrollerte og ukontrollerte fase 2- og 3-studier, men med en forekomst som var for lav til å anslå frekvensen." }] }
        ] },
        { "organsystem": "generelle", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Fatigue"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Gangforstyrrelse"] },
          { "frekvens": "sjeldne", "bivirkninger": ["Plutselig uventet død"] }
        ] },
        { "organsystem": "undersokelser", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Økt kreatinfosfokinase i blod"] }
        ] }
      ]
    },
    {
      "nokkel": "ungdom",
      "navn": "Ungdom fra 13 år",
      "frekvensgrunnlag": "Bivirkninger hos ungdom",
      "organsystemer": [
        { "organsystem": "infeksiose", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Nasofaryngitt", "Rhinitt", "Infeksjon i øvre luftveier"] }
        ] },
        { "organsystem": "blod_lymfe", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Nøytropeni"] }
        ] },
        { "organsystem": "immunsystemet", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Overfølsomhet"] }
        ] },
        { "organsystem": "endokrine", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Hyperprolaktinemi, inkludert økt prolaktin i blod"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Autoimmun tyreoiditt", "Hyperandrogenisme", "Hypotyreose"] }
        ] },
        { "organsystem": "stoffskifte", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Nedsatt appetitt", "Økt appetitt"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Hyperinsulinemi"] }
        ] },
        { "organsystem": "psykiatriske", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Unormale drømmer", "Agitasjon", "Angst", "Depresjon", "Insomni", "Psykotisk lidelse", "Schizofreni", "Anspenthet"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Aggresjon", "Apati", "Forvirringstilstand", "Nedstemthet", "Dissosiasjon", "Hørselshallusinasjon", "Synshallusinasjon", "Drapstanker", "Impulsiv atferd", "Innsovningsvansker", "Nedsatt libido", "Økt libido", "Likegyldighet", "Humørsvingninger", "Tvangstanker", "Panikkanfall", "Psykomotorisk hyperaktivitet", "Rastløshet", "Søvnforstyrrelser", "Selvmordstanker", "Tidlig oppvåkning", "Unormal tenkning"] }
        ] },
        { "organsystem": "nevrologiske", "frekvenser": [
          { "frekvens": "svaert_vanlige", "bivirkninger": ["Akatisi", "Hodepine", { "tekst": "Somnolens", "fotnote": "Somnolens omfatter hypersomni, hypersomnolens, sedasjon og somnolens." }] },
          { "frekvens": "vanlige", "bivirkninger": ["Oppmerksomhetsforstyrrelse", "Svimmelhet", "Dyskinesi", { "tekst": "Dystoni", "fotnote": "Dystoni omfatter dystoni, okulogyr krise, oromandibulær dystoni, tungespasme, torticollis og trismus." }, { "tekst": "Parkinsonisme", "fotnote": "Parkinsonisme omfatter bradykinesi, tannhjulsrigiditet, sikling, ekstrapyramidale forstyrrelser, hypokinesi, muskelrigiditet, parkinsonisme, psykomotorisk retardasjon og tremor." }] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Postural svimmelhet", "Dysgeusi", "Hyperkinesi", "Nedsatt hukommelse", "Migrene", "Parestesi", "Psykomotorisk hyperaktivitet", "Rastløse ben", "Tardiv dyskinesi", "Spenningshodepine"] }
        ] },
        { "organsystem": "oye", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Akkommodasjonsforstyrrelse", "Tåkesyn"] }
        ] },
        { "organsystem": "ore_labyrint", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Hyperakusis"] }
        ] },
        { "organsystem": "hjerte", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Takykardi"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Palpitasjoner", "Supraventrikulære ekstrasystoler"] }
        ] },
        { "organsystem": "kar", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Ortostatisk hypotensjon", "Hypertensjon"] }
        ] },
        { "organsystem": "respirasjon", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Orofaryngeal smerte", "Dyspné"] }
        ] },
        { "organsystem": "gastrointestinale", "frekvenser": [
          { "frekvens": "svaert_vanlige", "bivirkninger": ["Kvalme"] },
          { "frekvens": "vanlige", "bivirkninger": ["Forstoppelse", "Munntørrhet", "Hypersalivasjon", "Oppkast"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Ubehag i abdomen", "Smerter i øvre abdomen", "Nedsatt spyttsekresjon", "Diaré", "Dyspepsi", "Tørre lepper", "Tannverk"] }
        ] },
        { "organsystem": "hud", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Hyperhidrose"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Alopesi", "Unormal hårvekst", "Utslett", "Urtikaria"] }
        ] },
        { "organsystem": "muskel_skjelett", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Muskelstivhet"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Artralgi", "Muskelstramhet", "Muskel- og skjelettstivhet", "Myalgi", "Smerter i ekstremitet", "Kjevesmerter"] }
        ] },
        { "organsystem": "nyre_urinveier", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Bilirubinuri", "Dysuri", "Vannlatingsforstyrrelse", "Polyuri", "Proteinuri", "Nyresykdom"] }
        ] },
        { "organsystem": "kjonnsorganer_bryst", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Erektil dysfunksjon"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Amenoré", "Brystsmerter", "Ejakulasjonsforstyrrelse", "Galaktoré", "Gynekomasti", "Uregelmessig menstruasjon", "Oligomenoré", "Seksuell dysfunksjon"] }
        ] },
        { "organsystem": "medfodte", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Tourettes syndrom"] }
        ] },
        { "organsystem": "generelle", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Asteni", "Kronisk fatigue", "Irritabilitet"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Frysninger", "Gangforstyrrelse", "Uvelhet", "Ikke-kardiale brystsmerter", "Feber"] }
        ] },
        { "organsystem": "undersokelser", "frekvenser": [
          { "frekvens": "vanlige", "bivirkninger": ["Økt kreatinfosfokinase i blod", "Økt C-reaktivt protein", "Vektøkning", "Vektreduksjon"] },
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Økt alaninaminotransferase", "Positivt antityreoidea-antistoff", "Økt aspartataminotransferase", "Redusert alkalisk fosfatase i blod", "Økt alkalisk fosfatase i blod", "Økt kolesterol i blod", "Økt blodglukose", "Økt insulin i blod", "Redusert testosteron i blod", "Økt tyreotropin i blod", "Økte triglyserider i blod", "Forkortet PR-intervall på EKG", "Redusert hemoglobin", "Redusert HDL", "Redusert LDL"] }
        ] },
        { "organsystem": "skader", "frekvenser": [
          { "frekvens": "mindre_vanlige", "bivirkninger": ["Tilsiktet overdose"] }
        ] }
      ]
    }
  ]
}$import$::jsonb);
