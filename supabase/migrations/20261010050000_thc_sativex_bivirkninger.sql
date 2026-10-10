-- Bivirkninger for fagsiden «thc» fra Preparatomtale (SPC) for Sativex munnspray, MT 11-8809.
-- Laget av scripts/lag-bivirkningsimport.ts fra importfila; se docs/bivirkninger.md.
select bivirkninger.importer($import${
  "format": "ousfar-bivirkninger/1",
  "stoff": "thc",
  "kilde": {
    "nokkel": "sativex-munnspray-11-8809",
    "type": "spc",
    "tittel": "Preparatomtale (SPC) for Sativex munnspray, MT 11-8809",
    "preparat": "Sativex munnspray, 27 mg/ml THC og 25 mg/ml CBD",
    "innehaver": "CNX Therapeutics Ireland Ltd.",
    "revisjonsdato": "2026-05-28",
    "lenke": "https://produktinformasjon.legemiddelsok.no/preparatomtaler/11-8809.pdf",
    "kontrollert": "2026-10-10",
    "kontrollert_av": "ChatGPT monografikurator",
    "importert_av": "ChatGPT monografikurator",
    "merknad": "Avsnitt 4.8, bivirkninger med plausibel sammenheng med Sativex i placebokontrollerte og åpne studier hos MS-pasienter. Enkelte kan være del av underliggende sykdom. Asteriskfotnoter gjelder langvarige åpne studier."
  },
  "organsystemer": [
    {
      "organsystem": "infeksiose",
      "frekvenser": [
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "Faryngitt"
          ]
        }
      ]
    },
    {
      "organsystem": "stoffskifte",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Redusert appetitt"
          ]
        },
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "Økt appetitt"
          ]
        }
      ]
    },
    {
      "organsystem": "psykiatriske",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Desorientering",
            "Eufori",
            "Nedstemt humør",
            "Depresjon",
            "Dissosiasjon"
          ]
        },
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "Hallusinasjoner (uspesifiserte, auditive, visuelle)",
            "Paranoia",
            "Selvmordstanker",
            "Illusjoner",
            {
              "tekst": "Vrangforestillinger",
              "fotnote": "* rapportert i langvarige åpne studier"
            }
          ]
        }
      ]
    },
    {
      "organsystem": "nevrologiske",
      "frekvenser": [
        {
          "frekvens": "svaert_vanlige",
          "bivirkninger": [
            "Svimmelhet"
          ]
        },
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Somnolens",
            "Oppmerksomhetsforstyrrelse",
            "Balanseforstyrrelse",
            "Dysgeusi",
            "Apati",
            "Dysartri",
            "Nedsatt hukommelse",
            "Amnesi",
            "Synkope"
          ]
        }
      ]
    },
    {
      "organsystem": "oye",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Tåkesyn"
          ]
        }
      ]
    },
    {
      "organsystem": "ore_labyrint",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Vertigo"
          ]
        }
      ]
    },
    {
      "organsystem": "hjerte",
      "frekvenser": [
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "Palpitasjoner",
            "Takykardi"
          ]
        }
      ]
    },
    {
      "organsystem": "kar",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Hypertensjon"
          ]
        }
      ]
    },
    {
      "organsystem": "respirasjon",
      "frekvenser": [
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "Halsirritasjon"
          ]
        }
      ]
    },
    {
      "organsystem": "muskel_skjelett",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Muskelsvakhet"
          ]
        }
      ]
    },
    {
      "organsystem": "gastrointestinale",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Kvalme",
            "Diaré",
            "Munntørrhet",
            "Oppkast",
            "Forstoppelse",
            "Smerte i munnen",
            "Sår i munnhulen",
            "Ubehag i munnen",
            "Glossodyni",
            "Misfarging av tenner",
            "Øvre abdominalsmerter",
            "Munnlidelser"
          ]
        },
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            {
              "tekst": "Misfarging av munnslimhinnen",
              "fotnote": "* rapportert i langvarige åpne studier"
            },
            {
              "tekst": "Eksfoliasjon av munnslimhinnen",
              "fotnote": "* rapportert i langvarige åpne studier"
            },
            "Stomatitt"
          ]
        }
      ]
    },
    {
      "organsystem": "generelle",
      "frekvenser": [
        {
          "frekvens": "svaert_vanlige",
          "bivirkninger": [
            "Tretthet"
          ]
        },
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Smerter på administrasjonsstedet",
            "Asteni",
            "Unormal følelse",
            "Følelse av beruselse",
            "Uvelhet"
          ]
        },
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "Irritasjon på administrasjonsstedet"
          ]
        }
      ]
    },
    {
      "organsystem": "skader",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Fall"
          ]
        }
      ]
    }
  ]
}$import$::jsonb);