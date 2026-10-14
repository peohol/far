-- Bivirkninger for fagsiden «ghb» fra Xyrem – preparatomtale (SPC).
-- Faglig og visuelt kontrollert av ChatGPT 14.10.2026; se docs/bivirkninger.md.
select intern.endring_start('chatgpt-monografkurator', '20261014070800_ghb_xyrem_bivirkninger.sql', 'Importerer strukturerte bivirkninger fra Xyrem SPC', array['https://github.com/peohol/far/pull/228']);


select bivirkninger.importer($import${
  "format": "ousfar-bivirkninger/1",
  "stoff": "ghb",
  "kilde": {
    "nokkel": "xyrem-mikstur",
    "type": "spc",
    "tittel": "Xyrem – preparatomtale (SPC)",
    "preparat": "Xyrem 500 mg/ml mikstur, oppløsning",
    "innehaver": "UCB Pharma S.A.",
    "revisjonsdato": "2025-05-12",
    "lenke": "https://www.ema.europa.eu/no/documents/product-information/xyrem-epar-product-information_no.pdf",
    "kontrollert": "2026-10-14",
    "kontrollert_av": "ChatGPT",
    "importert_av": "ChatGPT",
    "merknad": "Tabellert etter pkt. 4.8 i gjeldende norsk EMA-produktinformasjon. Tabellen har samme hendelsesliste som Oxiore og ingen fotnoter; kildeproveniens beholdes separat."
  },
  "organsystemer": [
    {
      "organsystem": "infeksiose",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "nasofaryngitt",
            "sinusitt"
          ]
        }
      ]
    },
    {
      "organsystem": "immunsystemet",
      "frekvenser": [
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "hypersensitivitet"
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
            "anoreksi",
            "nedsatt appetitt"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "dehydrering",
            "økt appetitt"
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
            "depresjon",
            "katapleksi",
            "angst",
            "unormale drømmer",
            "forvirringstilstand",
            "desorientering",
            "mareritt",
            "søvngjengeri",
            "søvnforstyrrelser",
            "insomni",
            "søvnopprettholdelse-insomni",
            "nervøsitet"
          ]
        },
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "selvmordsforsøk",
            "psykose",
            "paranoia",
            "hallusinasjoner",
            "unormale tanker",
            "opphisselse",
            "initial insomni"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "selvmordstanker",
            "drapstanker",
            "aggresjon",
            "eufori",
            "søvnrelaterte spiseforstyrrelser",
            "panikkanfall",
            "mani/bipolar lidelse",
            "vrangforestillinger",
            "bruksisme",
            "irritabilitet",
            "økt libido"
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
            "svimmelhet",
            "hodepine"
          ]
        },
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "søvnparalyse",
            "søvnighet",
            "tremor",
            "balanseforstyrrelser",
            "oppmerksomhetsforstyrrelser",
            "hypoestesi",
            "parestesi",
            "sedasjon",
            "dysgeusi"
          ]
        },
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "myoklonus",
            "amnesi",
            "”restless legs”- syndrom"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "konvulsjoner",
            "bevissthetstap",
            "dyskinesi"
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
            "tåkesyn"
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
            "vertigo"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "tinnitus"
          ]
        }
      ]
    },
    {
      "organsystem": "hjerte",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "palpitasjoner"
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
            "hypertensjon"
          ]
        }
      ]
    },
    {
      "organsystem": "respirasjon",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "dyspné",
            "snorking",
            "nesetetthet"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "respirasjonsdepresjon",
            "søvnapné",
            "kvelningsfornemmelse"
          ]
        }
      ]
    },
    {
      "organsystem": "gastrointestinale",
      "frekvenser": [
        {
          "frekvens": "svaert_vanlige",
          "bivirkninger": [
            "kvalme (frekvensen av kvalme er høyere hos kvinner enn hos menn)"
          ]
        },
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "oppkast",
            "diaré",
            "smerter i øvre abdomen"
          ]
        },
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "fekal inkontinens"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "munntørrhet"
          ]
        }
      ]
    },
    {
      "organsystem": "hud",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "hyperhidrose",
            "utslett"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "urtikaria",
            "angioødem",
            "seboré"
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
            "artralgi",
            "muskelspasmer",
            "ryggsmerte"
          ]
        }
      ]
    },
    {
      "organsystem": "nyre_urinveier",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "enuresis nocturna",
            "urininkontinens"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "pollakisuri/hurtig innsettende trang til vannlating",
            "nokturi"
          ]
        }
      ]
    },
    {
      "organsystem": "generelle",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "asteni",
            "tretthet",
            "følelse av å være beruset",
            "perifert ødem"
          ]
        }
      ]
    },
    {
      "organsystem": "undersokelser",
      "frekvenser": [
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "økt blodtrykk",
            "vektreduksjon"
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
            "fall"
          ]
        }
      ]
    }
  ]
}$import$::jsonb);
