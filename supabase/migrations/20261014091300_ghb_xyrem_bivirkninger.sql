-- Bivirkninger for fagsiden «ghb» fra Xyrem – preparatomtale (SPC).
-- Faglig og visuelt kontrollert av ChatGPT 14.10.2026; se docs/bivirkninger.md.
select intern.endring_start('chatgpt-monografkurator', '20261014091300_ghb_xyrem_bivirkninger.sql', 'Importerer strukturerte bivirkninger fra Xyrem SPC', array['https://github.com/peohol/far/pull/228']);


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
            "Nasofaryngitt",
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
            "Hypersensitivitet"
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
            "Anoreksi",
            "nedsatt appetitt"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "Dehydrering",
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
            "Depresjon",
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
            "Selvmordsforsøk",
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
            "Selvmordstanker",
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
            "Svimmelhet",
            "hodepine"
          ]
        },
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Søvnparalyse",
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
            "Myoklonus",
            "amnesi",
            "”restless legs”- syndrom"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "Konvulsjoner",
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
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "Tinnitus"
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
            "Palpitasjoner"
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
          "frekvens": "vanlige",
          "bivirkninger": [
            "Dyspné",
            "snorking",
            "nesetetthet"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "Respirasjonsdepresjon",
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
            "Kvalme (frekvensen av kvalme er høyere hos kvinner enn hos menn)"
          ]
        },
        {
          "frekvens": "vanlige",
          "bivirkninger": [
            "Oppkast",
            "diaré",
            "smerter i øvre abdomen"
          ]
        },
        {
          "frekvens": "mindre_vanlige",
          "bivirkninger": [
            "Fekal inkontinens"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "Munntørrhet"
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
            "Hyperhidrose",
            "utslett"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "Urtikaria",
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
            "Artralgi",
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
            "Enuresis nocturna",
            "urininkontinens"
          ]
        },
        {
          "frekvens": "ikke_kjent",
          "bivirkninger": [
            "Pollakisuri/hurtig innsettende trang til vannlating",
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
            "Asteni",
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
            "Økt blodtrykk",
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
            "Fall"
          ]
        }
      ]
    }
  ]
}$import$::jsonb);
