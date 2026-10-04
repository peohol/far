-- Bivirkninger for fagsiden «kvetiapin» fra Seroquel Depot – preparatomtale (SPC).
-- Laget av scripts/lag-bivirkningsimport.ts fra importfila; se docs/bivirkninger.md.
select bivirkninger.importer($import${
  "format": "ousfar-bivirkninger/1",
  "stoff": "kvetiapin",
  "kilde": {
    "nokkel": "seroquel-depot-spc",
    "type": "spc",
    "tittel": "Seroquel Depot – preparatomtale (SPC)",
    "preparat": "Seroquel Depot",
    "innehaver": "CHEPLAPHARM Arzneimittel GmbH",
    "spc_versjon": "Oppdateringsdato 03.07.2024",
    "revisjonsdato": "2024-07-03",
    "lenke": "https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5214.pdf",
    "kontrollert": "2026-10-04",
    "kontrollert_av": "ChatGPT",
    "importert_av": "ChatGPT monografikurator",
    "merknad": "Tabell 1 for voksne og tabell 2 for barn og ungdom er overført fra pkt. 4.8 i den norske preparatomtalen. Separate tabeller er bevart som separate kontekster."
  },
  "tabeller": [
    {
      "nokkel": "voksne-tabell-1",
      "navn": "Tabell 1 Bivirkninger forbundet med kvetiapinbehandling",
      "organsystemer": [
        {
          "organsystem": "blod_lymfe",
          "frekvenser": [
            {
              "frekvens": "svaert_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Redusert hemoglobin",
                  "fotnote": "Redusert hemoglobin til ≤ 13 g/dl (8,07 mmol/l) menn, ≤ 12 g/dl (7,45 mmol/l) kvinner forekom i minst ett tilfelle hos 11 % av kvetiapin-pasienter i alle forsøkene inkludert åpne tilleggsstudier. Hos disse pasientene var gjennomsnittlig maksimal reduksjon i hemoglobin til enhver tid -1,50 g/dl."
                }
              ]
            },
            {
              "frekvens": "vanlige",
              "bivirkninger": [
                {
                  "tekst": "Leukopeni",
                  "fotnote": "Se pkt. 4.4. Basert på endringer fra normal baseline til potensiell klinisk viktig verdi når som helst etter baseline i alle studier. Endringer for WBC er definert som ≤ 3 x 10^9 celler/l når som helst."
                },
                "redusert nøytrofiltall",
                {
                  "tekst": "økning i eosinofile granulocytter",
                  "fotnote": "Basert på endringer fra normal baseline til potensiell klinisk viktig verdi når som helst etter baseline i alle studier. Endringer for eosinofile granulocytter er definert som > 1 x 10^9 celler/l når som helst."
                }
              ]
            },
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Nøytropeni",
                  "fotnote": "Se pkt. 4.4."
                },
                "trombocytopeni",
                "anemi",
                {
                  "tekst": "redusert trombocyttall",
                  "fotnote": "Minst ett tilfelle av trombocytter ≤ 100 x 10^9/l."
                }
              ]
            },
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Agranulocytose",
                  "fotnote": "Basert på endring i nøytrofiler fra ≥ 1,5 x 10^9/l ved baseline til < 0,5 x 10^9/l når som helst under behandling, og basert på pasienter med alvorlig nøytropeni (< 0,5 x 10^9/l) og infeksjon under alle kliniske studier med kvetiapin (se pkt. 4.4)."
                }
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
                "Overfølsomhet (inkludert allergiske hudreaksjoner)"
              ]
            },
            {
              "frekvens": "svaert_sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Anafylaktisk reaksjon",
                  "fotnote": "Frekvensberegning av bivirkninger er utelukkende basert på bivirkningsdata etter markedsføring av kvetiapin-tabletter (umiddelbar frisetting)."
                }
              ]
            }
          ]
        },
        {
          "organsystem": "endokrine",
          "frekvenser": [
            {
              "frekvens": "vanlige",
              "bivirkninger": [
                {
                  "tekst": "Hyperprolaktinemi",
                  "fotnote": "Prolaktinnivå (pasienter > 18 år): > 20 mikrog/l (> 869,56 pmol/l) menn; > 30 mikrog/l (> 1304,34 pmol/l), kvinner uavhengig av tidspunkt."
                },
                {
                  "tekst": "reduksjon i total T4",
                  "fotnote": "Basert på endringer fra normal baseline til potensiell klinisk viktig verdi når som helst etter baseline i alle studier. Endringer i total T4, fritt T4, total T3 og fritt T3 er definert som < 0,8 x LLN (pmol/l) og endringer i TSH er > 5 mIU/l når som helst."
                },
                {
                  "tekst": "reduksjon i fritt T4",
                  "fotnote": "Basert på endringer fra normal baseline til potensiell klinisk viktig verdi når som helst etter baseline i alle studier. Endringer i total T4, fritt T4, total T3 og fritt T3 er definert som < 0,8 x LLN (pmol/l) og endringer i TSH er > 5 mIU/l når som helst."
                },
                {
                  "tekst": "reduksjon i total T3",
                  "fotnote": "Basert på endringer fra normal baseline til potensiell klinisk viktig verdi når som helst etter baseline i alle studier. Endringer i total T4, fritt T4, total T3 og fritt T3 er definert som < 0,8 x LLN (pmol/l) og endringer i TSH er > 5 mIU/l når som helst."
                },
                {
                  "tekst": "økning i TSH",
                  "fotnote": "Basert på endringer fra normal baseline til potensiell klinisk viktig verdi når som helst etter baseline i alle studier. Endringer i total T4, fritt T4, total T3 og fritt T3 er definert som < 0,8 x LLN (pmol/l) og endringer i TSH er > 5 mIU/l når som helst."
                }
              ]
            },
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Reduksjon i fritt T3",
                  "fotnote": "Basert på endringer fra normal baseline til potensiell klinisk viktig verdi når som helst etter baseline i alle studier. Endringer i total T4, fritt T4, total T3 og fritt T3 er definert som < 0,8 x LLN (pmol/l) og endringer i TSH er > 5 mIU/l når som helst."
                },
                {
                  "tekst": "hypotyreoidisme",
                  "fotnote": "Se pkt. 5.1."
                }
              ]
            },
            {
              "frekvens": "svaert_sjeldne",
              "bivirkninger": [
                "Uhensiktsmessig ADH sekresjon"
              ]
            }
          ]
        },
        {
          "organsystem": "stoffskifte",
          "frekvenser": [
            {
              "frekvens": "svaert_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Økte serum triglyseridnivåer",
                  "fotnote": "Minst ett tilfelle av triglyserider ≥ 200 mg/dl (≥ 2,258 mmol/l) (pasienter ≥ 18 år) eller ≥ 150 mg/dl (≥ 1,694 mmol/l) (pasienter < 18 år). Hos noen pasienter ble en forverring av flere enn én av de metabolske faktorene som vekt, blodglukose og lipider observert i kliniske studier (se pkt. 4.4)."
                },
                {
                  "tekst": "økning i totalkolesterol (hovedsakelig LDL-kolesterol)",
                  "fotnote": "Minst ett tilfelle av kolesterol ≥ 240 mg/dl (≥ 6,2064 mmol/l) (pasienter ≥ 18 år) eller ≥ 200 mg/dl (≥ 5,172 mmol/l) (pasienter < 18 år). Økning i LDL-kolesterol på > 30 mg/dl (≥ 0,769 mmol/l) er observert svært hyppig. Gjennomsnittlig endring hos pasienter som hadde slik økning var 41,7 mg/dl (≥ 1,07 mmol/l). Hos noen pasienter ble en forverring av flere enn én av de metabolske faktorene som vekt, blodglukose og lipider observert i kliniske studier (se pkt. 4.4)."
                },
                {
                  "tekst": "reduksjon av HDL-kolesterol",
                  "fotnote": "HDL-kolesterol: < 40 mg/dl (1,025 mmol/l), menn; < 50 mg/dl (1,282 mmol/l), kvinner uavhengig av tidspunkt. Hos noen pasienter ble en forverring av flere enn én av de metabolske faktorene som vekt, blodglukose og lipider observert i kliniske studier (se pkt. 4.4)."
                },
                {
                  "tekst": "vektøkning",
                  "fotnote": "Basert på > 7 % økning av kroppsvekt fra baseline. Forekommer hovedsakelig de første ukene av behandlingen hos voksne. Hos noen pasienter ble en forverring av flere enn én av de metabolske faktorene som vekt, blodglukose og lipider observert i kliniske studier (se pkt. 4.4)."
                }
              ]
            },
            {
              "frekvens": "vanlige",
              "bivirkninger": [
                "Økt appetitt",
                {
                  "tekst": "blodglukose økt til hyperglykemiske nivåer",
                  "fotnote": "Minst ett tilfelle av fastende blodglukose ≥ 126 mg/dl (≥ 7,0 mmol/l) eller ikke-fastende blodglukose ≥ 200 mg/dl (≥ 11,1 mmol/l). Hos noen pasienter ble en forverring av flere enn én av de metabolske faktorene som vekt, blodglukose og lipider observert i kliniske studier (se pkt. 4.4)."
                }
              ]
            },
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Hyponatremi",
                  "fotnote": "Endring fra > 132 mmol/l til ≤ 132 mmol/l i minst ett tilfelle."
                },
                {
                  "tekst": "diabetes mellitus",
                  "fotnote": "Se pkt. 4.4. Frekvensberegning av bivirkninger er utelukkende basert på bivirkningsdata etter markedsføring av kvetiapin-tabletter (umiddelbar frisetting)."
                },
                "eksaserbasjon av eksisterende diabetes"
              ]
            },
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Metabolsk syndrom",
                  "fotnote": "Basert på rapporter om bivirkninger for metabolsk syndrom fra alle kliniske forsøk med kvetiapin."
                }
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
                "Uvanlige drømmer og mareritt",
                {
                  "tekst": "suicidale tanker og suicidal atferd",
                  "fotnote": "Det er blitt rapportert tilfeller av selvmordstanker og selvmordsrelatert adferd under behandling med kvetiapin eller like etter at behandlingen ble seponert (se pkt. 4.4 og 5.1)."
                }
              ]
            },
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Søvngjengeri og relaterte reaksjoner, som å snakke i søvne og søvnrelaterte spiseforstyrrelser",
                  "fotnote": "Se tekst under tabellen i preparatomtalen."
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
                {
                  "tekst": "Svimmelhet",
                  "fotnote": "Som med andre antipsykotika som blokkerer alfa-1-adrenerg aktivitet, er det vanlig at kvetiapin induserer ortostatisk hypotensjon, forbundet med svimmelhet, takykardi og, hos noen pasienter, synkope, spesielt i den innledende dosetitreringsperioden (se pkt. 4.4). Kan føre til fall."
                },
                {
                  "tekst": "somnolens",
                  "fotnote": "Somnolens kan oppstå, vanligvis i løpet av de to første ukene av behandlingen og forsvinner vanligvis ved fortsatt bruk av kvetiapin. Kan føre til fall."
                },
                "hodepine",
                {
                  "tekst": "ekstrapyramidale symptomer",
                  "fotnote": "Se pkt. 4.4. Se pkt. 5.1."
                }
              ]
            },
            {
              "frekvens": "vanlige",
              "bivirkninger": [
                "Dysartri"
              ]
            },
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Krampeanfall",
                  "fotnote": "Se pkt. 4.4."
                },
                "restless legs-syndrom",
                {
                  "tekst": "tardive dyskinesier",
                  "fotnote": "Se pkt. 4.4. Frekvensberegning av bivirkninger er utelukkende basert på bivirkningsdata etter markedsføring av kvetiapin-tabletter (umiddelbar frisetting)."
                },
                {
                  "tekst": "synkope",
                  "fotnote": "Som med andre antipsykotika som blokkerer alfa-1-adrenerg aktivitet, er det vanlig at kvetiapin induserer ortostatisk hypotensjon, forbundet med svimmelhet, takykardi og, hos noen pasienter, synkope, spesielt i den innledende dosetitreringsperioden (se pkt. 4.4). Kan føre til fall."
                },
                "forvirringstilstand"
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
                {
                  "tekst": "Takykardi",
                  "fotnote": "Som med andre antipsykotika som blokkerer alfa-1-adrenerg aktivitet, er det vanlig at kvetiapin induserer ortostatisk hypotensjon, forbundet med svimmelhet, takykardi og, hos noen pasienter, synkope, spesielt i den innledende dosetitreringsperioden (se pkt. 4.4)."
                },
                {
                  "tekst": "palpitasjoner",
                  "fotnote": "Dette ble rapportert der det forekom takykardi, svimmelhet, ortostatisk hypotensjon og/eller underliggende hjertesykdom/respiratorisk sykdom."
                }
              ]
            },
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                {
                  "tekst": "QT-forlengelse",
                  "fotnote": "Se pkt. 4.4. Se tekst under tabellen i preparatomtalen. Forekomst av pasienter som har QTc-endring fra < 450 msek til ≥ 450 msek med en ≥ 30 msek økning. Gjennomsnittlig endring og forekomst av pasienter som har endring til et klinisk signifikant nivå er sammenlignbart mellom kvetiapin og placebo i placebo-kontrollerte studier med kvetiapin."
                },
                {
                  "tekst": "bradykardi",
                  "fotnote": "Kan oppstå ved eller rett etter oppstart av behandling og være assosiert med hypotensjon og/eller synkope. Frekvens er basert på bivirkningsrapportering av bradykardi og relaterte hendelser fra alle kliniske studier med kvetiapin."
                }
              ]
            },
            {
              "frekvens": "ikke_kjent",
              "bivirkninger": [
                "Kardiomyopati",
                "myokarditt"
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
                "Sløret syn"
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
                {
                  "tekst": "Ortostatisk hypotensjon",
                  "fotnote": "Som med andre antipsykotika som blokkerer alfa-1-adrenerg aktivitet, er det vanlig at kvetiapin induserer ortostatisk hypotensjon, forbundet med svimmelhet, takykardi og, hos noen pasienter, synkope, spesielt i den innledende dosetitreringsperioden (se pkt. 4.4). Kan føre til fall."
                }
              ]
            },
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Venøs tromboembolisme",
                  "fotnote": "Se pkt. 4.4."
                }
              ]
            },
            {
              "frekvens": "ikke_kjent",
              "bivirkninger": [
                {
                  "tekst": "Slag",
                  "fotnote": "Basert på én retrospektiv, ikke-randomisert epidemiologisk studie."
                }
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
                {
                  "tekst": "Dyspné",
                  "fotnote": "Dette ble rapportert der det forekom takykardi, svimmelhet, ortostatisk hypotensjon og/eller underliggende hjertesykdom/respiratorisk sykdom."
                }
              ]
            },
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                "Rhinitt"
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
                "Munntørrhet"
              ]
            },
            {
              "frekvens": "vanlige",
              "bivirkninger": [
                "Forstoppelse",
                "dyspepsi",
                {
                  "tekst": "oppkast",
                  "fotnote": "Basert på økt hyppighet av oppkast hos eldre pasienter (≥ 65 år)."
                }
              ]
            },
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Dysfagi",
                  "fotnote": "Det var kun i kliniske studier av bipolar depresjon at man så en økning i forekomst av dysfagi med kvetiapin versus placebo."
                }
              ]
            },
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Pankreatitt",
                  "fotnote": "Se pkt. 4.4."
                },
                "intestinal obstruksjon/ileus"
              ]
            }
          ]
        },
        {
          "organsystem": "lever_galle",
          "frekvenser": [
            {
              "frekvens": "vanlige",
              "bivirkninger": [
                {
                  "tekst": "Økning i serum alaninaminotransferase (ALAT)",
                  "fotnote": "Asymptomatiske økninger (endringer fra normal til > 3 x ULN når som helst) i serumtransaminaser (ALAT, ASAT) eller gamma-GT er observert hos pasienter som brukte kvetiapin. Disse økningene var vanligvis reversible ved fortsatt behandling."
                },
                {
                  "tekst": "økninger i gamma-GT nivåer",
                  "fotnote": "Asymptomatiske økninger (endringer fra normal til > 3 x ULN når som helst) i serumtransaminaser (ALAT, ASAT) eller gamma-GT er observert hos pasienter som brukte kvetiapin. Disse økningene var vanligvis reversible ved fortsatt behandling."
                }
              ]
            },
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Økning i serum aspartattransaminase (ASAT)",
                  "fotnote": "Asymptomatiske økninger (endringer fra normal til > 3 x ULN når som helst) i serumtransaminaser (ALAT, ASAT) eller gamma-GT er observert hos pasienter som brukte kvetiapin. Disse økningene var vanligvis reversible ved fortsatt behandling."
                }
              ]
            },
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Gulsott",
                  "fotnote": "Frekvensberegning av bivirkninger er utelukkende basert på bivirkningsdata etter markedsføring av kvetiapin-tabletter (umiddelbar frisetting)."
                },
                "hepatitt"
              ]
            }
          ]
        },
        {
          "organsystem": "hud",
          "frekvenser": [
            {
              "frekvens": "svaert_sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Angioødem",
                  "fotnote": "Frekvensberegning av bivirkninger er utelukkende basert på bivirkningsdata etter markedsføring av kvetiapin-tabletter (umiddelbar frisetting)."
                },
                {
                  "tekst": "Stevens-Johnson syndrom",
                  "fotnote": "Frekvensberegning av bivirkninger er utelukkende basert på bivirkningsdata etter markedsføring av kvetiapin-tabletter (umiddelbar frisetting)."
                }
              ]
            },
            {
              "frekvens": "ikke_kjent",
              "bivirkninger": [
                "Toksisk epidermal nekrolyse",
                "erythema multiforme",
                "akutt generalisert eksantematøs pustulose (AGEP)",
                "legemiddelutslett med eosinofili og systemiske symptomer (DRESS)",
                "kutan vaskulitt"
              ]
            }
          ]
        },
        {
          "organsystem": "muskel_skjelett",
          "frekvenser": [
            {
              "frekvens": "svaert_sjeldne",
              "bivirkninger": [
                "Rabdomyolyse"
              ]
            }
          ]
        },
        {
          "organsystem": "nyre_urinveier",
          "frekvenser": [
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                "Urinretensjon"
              ]
            }
          ]
        },
        {
          "organsystem": "svangerskap",
          "frekvenser": [
            {
              "frekvens": "ikke_kjent",
              "bivirkninger": [
                {
                  "tekst": "Neonatale seponeringssymptomer",
                  "fotnote": "Se pkt. 4.6."
                }
              ]
            }
          ]
        },
        {
          "organsystem": "kjonnsorganer_bryst",
          "frekvenser": [
            {
              "frekvens": "mindre_vanlige",
              "bivirkninger": [
                "Seksuell dysfunksjon"
              ]
            },
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                "Priapisme",
                "galaktoré",
                "hevelse i brystene",
                "menstruasjonsforstyrrelse"
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
                {
                  "tekst": "Seponeringssymptomer",
                  "fotnote": "Se pkt. 4.4. I akutte placebokontrollerte monoterapistudier der seponeringssymptomer ble evaluert, ble følgende seponeringssymptomer hyppigst observert: Søvnløshet, kvalme, hodepine, diaré, oppkast, svimmelhet og irritabilitet. Hyppigheten falt signifikant 1 uke etter seponering."
                }
              ]
            },
            {
              "frekvens": "vanlige",
              "bivirkninger": [
                "Mild asteni",
                "perifert ødem",
                "irritabilitet",
                "pyreksi"
              ]
            },
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Malignt nevroleptikasyndrom",
                  "fotnote": "Se pkt. 4.4."
                },
                "hypotermi"
              ]
            }
          ]
        },
        {
          "organsystem": "undersokelser",
          "frekvenser": [
            {
              "frekvens": "sjeldne",
              "bivirkninger": [
                {
                  "tekst": "Økning i blod-kreatinfosfokinase",
                  "fotnote": "Basert på bivirkningsrapporter fra kliniske studier vedrørende økning av blodkreatinfosfokinase som ikke var assosiert med malignt nevroleptisk syndrom."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "nokkel": "barn-ungdom-tabell-2",
      "navn": "Tabell 2 Bivirkninger hos barn og ungdom forbundet med kvetiapinbehandling som forekommer med en høyere frekvens enn hos voksne, eller som ikke er sett i den voksne populasjonen",
      "merknad": "Barn og ungdom 10–17 år. Tabellen inneholder bare bivirkninger i høyere frekvenskategori enn hos voksne eller bivirkninger som ikke er identifisert hos voksne; øvrige voksenbivirkninger skal også vurderes.",
      "organsystemer": [
        {
          "organsystem": "endokrine",
          "frekvenser": [
            {
              "frekvens": "svaert_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Økt prolaktinnivå",
                  "fotnote": "Prolaktinnivå (pasienter < 18 år): > 20 mikrog/l (> 869,56 pmol/l) menn, > 26 mikrog/l (> 1130,428 pmol/l) kvinner uavhengig av tidspunkt. Mindre enn 1 % av pasientene hadde økning til et prolaktinnivå > 100 mikrog/l."
                }
              ]
            }
          ]
        },
        {
          "organsystem": "stoffskifte",
          "frekvenser": [
            {
              "frekvens": "svaert_vanlige",
              "bivirkninger": [
                "Økt appetitt"
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
                {
                  "tekst": "Ekstrapyramidale symptomer",
                  "fotnote": "Frekvensen er konsistent med det som ble observert hos voksne, men kan være forbundet med andre kliniske implikasjoner hos barn og ungdom enn hos voksne. Se pkt. 5.1."
                }
              ]
            },
            {
              "frekvens": "vanlige",
              "bivirkninger": [
                "Synkope"
              ]
            }
          ]
        },
        {
          "organsystem": "kar",
          "frekvenser": [
            {
              "frekvens": "svaert_vanlige",
              "bivirkninger": [
                {
                  "tekst": "Økt blodtrykk",
                  "fotnote": "Basert på endringer over klinisk signifikante grenseverdier (adaptert fra kriterier fra National Institutes of Health), eller økninger > 20 mmHg for systolisk eller > 10 mmHg for diastolisk blodtrykk når som helst i løpet av to akutte (3-6 uker) placebokontrollerte studier hos barn og ungdom."
                }
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
                "Rhinitt"
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
                "Oppkast"
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
                {
                  "tekst": "Irritabilitet",
                  "fotnote": "Frekvensen er konsistent med det som ble observert hos voksne, men kan være forbundet med andre kliniske implikasjoner hos barn og ungdom enn hos voksne."
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}$import$::jsonb);