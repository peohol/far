/**
 * Forbindelsene OUSFAR kjenner, med koblingene til PubChem (`docs/kjemi.md`).
 *
 * Endres i en PR. Koblingene lages og kontrolleres med
 * `scripts/kurer-forbindelser.ts`, som også skriver fila; synkroniseringen
 * leser den og legger aldri til noe selv. Står som TypeScript, ikke JSON, så
 * serverfunksjonene kan importere den direkte.
 */
import type { Forbindelse } from '../kjemi/forbindelser.js'

export const FORBINDELSESDATA: Forbindelse[] = [
  {
    "nokkel": "7-aminoflunitrazepam",
    "navn": "7-aminoflunitrazepam",
    "engelsk": "7-aminoflunitrazepam",
    "stoffer": [
      {
        "stoff": "flunitrazepam",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 92294,
      "inchikey": "LTCDLGUFORGHGY-UHFFFAOYSA-N",
      "formel": "C16H14FN3O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «7-aminoflunitrazepam»; samme InChIKey hos ChEBI (CHEBI:174707)."
    },
    "farmakologiportalen": {
      "status": "usikker",
      "id": "749",
      "navn": "7-Aminoflunitrazepam (7-AF)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («7-Aminoflunitrazepam (7-AF)», ID 749), men CAS-nummeret portalen oppgir (4928-02-3), er ikke blant PubChems, men hos PubChem «7-Aminonitrazepam» (CID 78641, C15H13N3O), og molekylvekten er ikke oppgitt."
    }
  },
  {
    "nokkel": "7-aminoklonazepam",
    "navn": "7-aminoklonazepam",
    "engelsk": "7-aminoclonazepam",
    "stoffer": [
      {
        "stoff": "klonazepam",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 188298,
      "inchikey": "HEFRPWRJTGLSSV-UHFFFAOYSA-N",
      "formel": "C15H12ClN3O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «7-aminoclonazepam»; samme InChIKey hos ChEBI (CHEBI:143344)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "747",
      "navn": "7-Aminoklonazepam (7-AK)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («7-Aminoklonazepam (7-AK)», ID 747); CAS-nummeret 4959-17-5 er også PubChems (PubChem (CID 188298))."
    }
  },
  {
    "nokkel": "7-aminonitrazepam",
    "navn": "7-aminonitrazepam",
    "engelsk": "7-aminonitrazepam",
    "stoffer": [
      {
        "stoff": "nitrazepam",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 78641,
      "inchikey": "OYOUQHVDCKOOAL-UHFFFAOYSA-N",
      "formel": "C15H13N3O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «7-aminonitrazepam»; samme InChIKey hos ChEBI (CHEBI:166534)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "748",
      "navn": "7-Aminonitrazepam (7-AN)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («7-Aminonitrazepam (7-AN)», ID 748); CAS-nummeret 4928-02-3 er også PubChems (PubChem (CID 78641))."
    }
  },
  {
    "nokkel": "alprazolam",
    "navn": "Alprazolam",
    "engelsk": "alprazolam",
    "stoffer": [
      {
        "stoff": "alprazolam",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2118,
      "inchikey": "VREFGVBLTWBCJP-UHFFFAOYSA-N",
      "formel": "C17H13ClN4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «alprazolam»; samme InChIKey hos ClinPGx (PA448333, CID 2118) og ChEBI (CHEBI:2611)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "503",
      "navn": "Alprazolam",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Alprazolam», ID 503); CAS-nummeret 28981-97-7 er også PubChems (PubChem (CID 2118))."
    }
  },
  {
    "nokkel": "amfetamin",
    "navn": "Amfetamin",
    "engelsk": "amphetamine",
    "stoffer": [
      {
        "stoff": "amfetamin",
        "relasjon": "selve_stoffet"
      },
      {
        "stoff": "metamfetamin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3007,
      "inchikey": "KWTSXDURSIMDCE-UHFFFAOYSA-N",
      "formel": "C9H13N",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «amphetamine»; samme InChIKey hos ClinPGx (PA448408, CID 3007)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "507",
      "navn": "Amfetamin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Amfetamin», ID 507); CAS-nummeret 300-62-9 er også PubChems, og molekylvekten 135,21 g/mol stemmer med PubChem (CID 3007) (135,21)."
    }
  },
  {
    "nokkel": "amisulprid",
    "navn": "Amisulprid",
    "engelsk": "amisulpride",
    "stoffer": [
      {
        "stoff": "amisulprid",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2159,
      "inchikey": "NTJOBXMMWNYJFB-UHFFFAOYSA-N",
      "formel": "C17H27N3O4S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «amisulpride»; samme InChIKey hos ClinPGx (PA162565877, CID 2159) og ChEBI (CHEBI:64045)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "513",
      "navn": "Amisulprid",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Amisulprid», ID 513); CAS-nummeret 71675-85-9 er også PubChems, og molekylvekten 369,48 g/mol stemmer med PubChem (CID 2159) (369,5)."
    }
  },
  {
    "nokkel": "amitriptylin",
    "navn": "Amitriptylin",
    "engelsk": "amitriptyline",
    "stoffer": [
      {
        "stoff": "amitriptylin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2160,
      "inchikey": "KRMDCWKBEZIMAB-UHFFFAOYSA-N",
      "formel": "C20H23N",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «amitriptyline»; samme InChIKey hos ClinPGx (PA448385, CID 2160) og ChEBI (CHEBI:2666)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "512",
      "navn": "Amitriptylin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Amitriptylin», ID 512); CAS-nummeret 50-48-6 er også PubChems, og molekylvekten 277,4 g/mol stemmer med PubChem (CID 2160) (277,4)."
    }
  },
  {
    "nokkel": "amlodipin",
    "navn": "Amlodipin",
    "engelsk": "amlodipine",
    "stoffer": [
      {
        "stoff": "amlodipin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2162,
      "inchikey": "HTIQEAQVCYTUBX-UHFFFAOYSA-N",
      "formel": "C20H25ClN2O5",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «amlodipine»; samme InChIKey hos ClinPGx (PA448388, CID 2162) og ChEBI (CHEBI:2668)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1324",
      "navn": "Amlodipin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Amlodipin», ID 1324); CAS-nummeret 88150-42-9 er også PubChems, og molekylvekten 408,88 g/mol stemmer med PubChem (CID 2162) (408,9)."
    }
  },
  {
    "nokkel": "aripiprazol",
    "navn": "Aripiprazol",
    "engelsk": "aripiprazole",
    "stoffer": [
      {
        "stoff": "aripiprazol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 60795,
      "inchikey": "CEUORZQYGODEFX-UHFFFAOYSA-N",
      "formel": "C23H27Cl2N3O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «aripiprazole»; samme InChIKey hos ClinPGx (PA10026, CID 60795) og ChEBI (CHEBI:31236)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "515",
      "navn": "Aripiprazol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Aripiprazol», ID 515); CAS-nummeret 129722-12-9 er også PubChems, og molekylvekten 448,39 g/mol stemmer med PubChem (CID 60795) (448,4)."
    }
  },
  {
    "nokkel": "atenolol",
    "navn": "Atenolol",
    "engelsk": "atenolol",
    "stoffer": [
      {
        "stoff": "atenolol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2249,
      "inchikey": "METKIMKYRPQLGS-UHFFFAOYSA-N",
      "formel": "C14H22N2O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «atenolol»; samme InChIKey hos ClinPGx (PA448499, CID 2249) og ChEBI (CHEBI:2904)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "518",
      "navn": "Atenolol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Atenolol», ID 518); CAS-nummeret 29122-68-7 er også PubChems, og molekylvekten 266,34 g/mol stemmer med PubChem (CID 2249) (266,34)."
    }
  },
  {
    "nokkel": "atomoksetin",
    "navn": "Atomoksetin",
    "engelsk": "atomoxetine",
    "stoffer": [
      {
        "stoff": "atomoksetin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 54841,
      "inchikey": "VHGCDTVCOLNTBX-QGZVFWFLSA-N",
      "formel": "C17H21NO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «atomoxetine»; samme InChIKey hos ClinPGx (PA134688071, CID 54841) og ChEBI (CHEBI:127342)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "519",
      "navn": "Atomoksetin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Atomoksetin», ID 519); CAS-nummeret 83015-26-3 er også PubChems (PubChem (CID 54841))."
    }
  },
  {
    "nokkel": "bendroflumetiazid",
    "navn": "Bendroflumetiazid",
    "engelsk": "bendroflumethiazide",
    "stoffer": [
      {
        "stoff": "bendroflumetiazid",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2315,
      "inchikey": "HDWIHXWEUNVBIY-UHFFFAOYSA-N",
      "formel": "C15H14F3N3O4S2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «bendroflumethiazide»; samme InChIKey hos ClinPGx (PA448563, CID 2315) og ChEBI (CHEBI:3013)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9098",
      "navn": "Bendroflumetiazid",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Bendroflumetiazid», ID 9098); CAS-nummeret 73-48-3 er også PubChems (PubChem (CID 2315))."
    }
  },
  {
    "nokkel": "benzoylekgonin",
    "navn": "Benzoylekgonin",
    "engelsk": "benzoylecgonine",
    "stoffer": [
      {
        "stoff": "kokain",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 448223,
      "inchikey": "GVGYEFKIHJTNQZ-RFQIPJPRSA-N",
      "formel": "C16H19NO4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «benzoylecgonine»; samme InChIKey hos ClinPGx (PA166287643, CID 448223)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "793",
      "navn": "Benzoylekgonin (BZE)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Benzoylekgonin (BZE)», ID 793); CAS-nummeret 519-09-5 er også PubChems (PubChem (CID 448223))."
    }
  },
  {
    "nokkel": "bisoprolol",
    "navn": "Bisoprolol",
    "engelsk": "bisoprolol",
    "stoffer": [
      {
        "stoff": "bisoprolol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2405,
      "inchikey": "VHYCDWMUTMEGQY-UHFFFAOYSA-N",
      "formel": "C18H31NO4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «bisoprolol»; samme InChIKey hos ClinPGx (PA448641, CID 2405) og ChEBI (CHEBI:3127)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1329",
      "navn": "Bisoprolol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Bisoprolol», ID 1329); CAS-nummeret 66722-44-9 er også PubChems, og molekylvekten 325,44 g/mol stemmer med PubChem (CID 2405) (325,4)."
    }
  },
  {
    "nokkel": "brekspiprazol",
    "navn": "Brekspiprazol",
    "engelsk": "brexpiprazole",
    "stoffer": [
      {
        "stoff": "brekspiprazol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 11978813,
      "inchikey": "ZKIAIYBUSXZPLP-UHFFFAOYSA-N",
      "formel": "C25H27N3O2S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «brexpiprazole»; samme InChIKey hos ClinPGx (PA166160053, CID 11978813) og ChEBI (CHEBI:134716)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "10081",
      "navn": "Brekspiprazol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Brekspiprazol», ID 10081); CAS-nummeret 913611-97-9 er også PubChems (PubChem (CID 11978813))."
    }
  },
  {
    "nokkel": "bumetanid",
    "navn": "Bumetanid",
    "engelsk": "bumetanide",
    "stoffer": [
      {
        "stoff": "bumetanid",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2471,
      "inchikey": "MAEIEVLCKWDQJH-UHFFFAOYSA-N",
      "formel": "C17H20N2O5S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «bumetanide»; samme InChIKey hos ClinPGx (PA448682, CID 2471) og ChEBI (CHEBI:3213)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "3217",
      "navn": "Bumetanid",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Bumetanid», ID 3217); CAS-nummeret 28395-03-1 er også PubChems, og molekylvekten 364,42 g/mol stemmer med PubChem (CID 2471) (364,4)."
    }
  },
  {
    "nokkel": "buprenorfin",
    "navn": "Buprenorfin",
    "engelsk": "buprenorphine",
    "stoffer": [
      {
        "stoff": "buprenorfin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 644073,
      "inchikey": "RMRJXGBAOAMLHD-IHFGGWKQSA-N",
      "formel": "C29H41NO4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «buprenorphine»; samme InChIKey hos ChEBI (CHEBI:3216)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "528",
      "navn": "Buprenorfin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Buprenorfin», ID 528); CAS-nummeret 52485-79-7 er også PubChems, og molekylvekten 467,64 g/mol stemmer med PubChem (CID 644073) (467,6)."
    }
  },
  {
    "nokkel": "bupropion",
    "navn": "Bupropion",
    "engelsk": "bupropion",
    "stoffer": [
      {
        "stoff": "bupropion",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 444,
      "inchikey": "SNPPWIUOZRMYNY-UHFFFAOYSA-N",
      "formel": "C13H18ClNO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «bupropion»; samme InChIKey hos ClinPGx (PA448687, CID 444) og ChEBI (CHEBI:3219)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "529",
      "navn": "Bupropion",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Bupropion», ID 529); CAS-nummeret 34841-39-9 er også PubChems, og molekylvekten 239,74 g/mol stemmer med PubChem (CID 444) (239,74)."
    }
  },
  {
    "nokkel": "cbd",
    "navn": "Cannabidiol",
    "engelsk": "cannabidiol",
    "stoffer": [
      {
        "stoff": "cbd",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 644019,
      "inchikey": "QHMBSVQNZZTUGM-ZWKOTPCHSA-N",
      "formel": "C21H30O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «cannabidiol»; samme InChIKey hos ClinPGx (PA166175791, CID 644019) og ChEBI (CHEBI:69478)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "3237",
      "navn": "Cannabidiol (CBD)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Cannabidiol (CBD)», ID 3237); CAS-nummeret 13956-29-1 er også PubChems (PubChem (CID 644019))."
    }
  },
  {
    "nokkel": "citalopram",
    "navn": "Citalopram",
    "engelsk": "citalopram",
    "stoffer": [
      {
        "stoff": "citalopram",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2771,
      "inchikey": "WSEQXVZVJXJVFP-UHFFFAOYSA-N",
      "formel": "C20H21FN2O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «citalopram»; samme InChIKey hos ClinPGx (PA449015, CID 2771)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "536",
      "navn": "Citalopram",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Citalopram», ID 536); CAS-nummeret 59729-33-8 er også PubChems, og molekylvekten 324,39 g/mol stemmer med PubChem (CID 2771) (324,4)."
    }
  },
  {
    "nokkel": "dehydroaripiprazol",
    "navn": "Dehydroaripiprazol",
    "engelsk": "dehydroaripiprazole",
    "stoffer": [
      {
        "stoff": "aripiprazol",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 10114519,
      "inchikey": "CDONPRYEWWPREK-UHFFFAOYSA-N",
      "formel": "C23H25Cl2N3O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «dehydroaripiprazole»; samme InChIKey hos ClinPGx (PA166170895, CID 10114519)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "804",
      "navn": "Dehydroaripiprazol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Dehydroaripiprazol», ID 804); CAS-nummeret 129722-25-4 er også PubChems (PubChem (CID 10114519))."
    }
  },
  {
    "nokkel": "desmetylcitalopram",
    "navn": "Desmetylcitalopram",
    "engelsk": "desmethylcitalopram",
    "stoffer": [
      {
        "stoff": "citalopram",
        "relasjon": "metabolitt"
      },
      {
        "stoff": "escitalopram",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 162180,
      "inchikey": "PTJADDMMFYXMMG-UHFFFAOYSA-N",
      "formel": "C19H19FN2O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «desmethylcitalopram»; samme InChIKey hos ClinPGx (PA134687941, CID 162180)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "795",
      "navn": "Desmetylcitalopram",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Desmetylcitalopram», ID 795); CAS-nummeret 144010-85-5 er i PubChem CID 12986614 («(R)-1-(4-Fluorophenyl)-1-(3-(methylamino)propyl)-1,3-dihydroisobenzofuran-5-carbonitrile»), samme forbindelse som PubChem (CID 162180) uten hensyn til stereokjemien (InChIKey-skjelett PTJADDMMFYXMMG)."
    }
  },
  {
    "nokkel": "desmetyldoksepin",
    "navn": "Desmetyldoksepin",
    "engelsk": "nordoxepin",
    "synonymer": [
      "desmethyldoxepin"
    ],
    "stoffer": [
      {
        "stoff": "doksepin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4535,
      "inchikey": "HVKCEFHNSNZIHO-UHFFFAOYSA-N",
      "formel": "C18H19NO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «nordoxepin»; samme InChIKey hos ChEBI (CHEBI:141547)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "796",
      "navn": "Desmetyldoksepin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Desmetyldoksepin», ID 796); CAS-nummeret 1225-56-5 er også PubChems (PubChem (CID 4535))."
    }
  },
  {
    "nokkel": "desmetylkariprazin",
    "navn": "Desmetylkariprazin",
    "engelsk": "desmethyl cariprazine",
    "stoffer": [
      {
        "stoff": "kariprazin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 11338928,
      "inchikey": "WMQLLTKSISGWHQ-UHFFFAOYSA-N",
      "formel": "C20H30Cl2N4O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «desmethyl cariprazine»; samme InChIKey hos ClinPGx (PA166356841, CID 11338928)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "10085",
      "navn": "Desmetylkariprazin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Desmetylkariprazin», ID 10085); CAS-nummeret 839712-15-1 er også PubChems, og molekylvekten 413,4 g/mol stemmer med PubChem (CID 11338928) (413,4)."
    }
  },
  {
    "nokkel": "desmetylklomipramin",
    "navn": "Desmetylklomipramin",
    "engelsk": "desmethylclomipramine",
    "synonymer": [
      "norclomipramine",
      "N-desmethylclomipramine"
    ],
    "stoffer": [
      {
        "stoff": "klomipramin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "uavklart": {
      "grunn": "Ingen uavhengig kilde (ClinPGx, ChEBI) bekrefter treffet i PubChem (Norclomipramine).",
      "kandidater": [
        622606
      ]
    },
    "farmakologiportalen": {
      "status": "usikker",
      "id": "800",
      "navn": "Desmetylklomipramin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Desmetylklomipramin», ID 800), men forbindelsen har ingen verifisert kobling til PubChem å kontrollere mot."
    }
  },
  {
    "nokkel": "desmetylmianserin",
    "navn": "Desmetylmianserin",
    "engelsk": "desmethylmianserin",
    "stoffer": [
      {
        "stoff": "mianserin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 115194,
      "inchikey": "ZBILSSSEXRZGKS-UHFFFAOYSA-N",
      "formel": "C17H18N2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «desmethylmianserin»; samme InChIKey hos ChEBI (CHEBI:188043)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "801",
      "navn": "Desmetylmianserin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Desmetylmianserin», ID 801); CAS-nummeret 71936-92-0 er også PubChems (PubChem (CID 115194))."
    }
  },
  {
    "nokkel": "desmetylsertralin",
    "navn": "Desmetylsertralin",
    "engelsk": "desmethylsertraline",
    "stoffer": [
      {
        "stoff": "sertralin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 114743,
      "inchikey": "SRPXSILJHWNFMK-ZBEGNZNMSA-N",
      "formel": "C16H15Cl2N",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «desmethylsertraline»; samme InChIKey hos ClinPGx (PA166180536, saltet CID 25008634 med moderforbindelse CID 114743)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "802",
      "navn": "Desmetylsertralin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Desmetylsertralin», ID 802); CAS-nummeret 918933-19-4 er i PubChem CID 577181 («4-(3,4-Dichlorophenyl)-1,2,3,4-tetrahydronaphthalen-1-amine»), samme forbindelse som PubChem (CID 114743) uten hensyn til stereokjemien (InChIKey-skjelett SRPXSILJHWNFMK)."
    }
  },
  {
    "nokkel": "diazepam",
    "navn": "Diazepam",
    "engelsk": "diazepam",
    "stoffer": [
      {
        "stoff": "diazepam",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3016,
      "inchikey": "AAOVKJBEBIDNHE-UHFFFAOYSA-N",
      "formel": "C16H13ClN2O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «diazepam»; samme InChIKey hos ClinPGx (PA449283, CID 3016) og ChEBI (CHEBI:49575)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "541",
      "navn": "Diazepam",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Diazepam», ID 541); CAS-nummeret 439-14-5 er også PubChems (PubChem (CID 3016))."
    }
  },
  {
    "nokkel": "didesmetylkariprazin",
    "navn": "Didesmetylkariprazin",
    "engelsk": "didesmethyl cariprazine",
    "stoffer": [
      {
        "stoff": "kariprazin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 11200383,
      "inchikey": "UMTWXZNVNBBFLC-UHFFFAOYSA-N",
      "formel": "C19H28Cl2N4O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «didesmethyl cariprazine»; samme InChIKey hos ClinPGx (PA166356881, CID 11200383)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "10086",
      "navn": "Didesmetylkariprazin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Didesmetylkariprazin», ID 10086); CAS-nummeret 839712-25-3 er også PubChems, og molekylvekten 399,4 g/mol stemmer med PubChem (CID 11200383) (399,4)."
    }
  },
  {
    "nokkel": "diltiazem",
    "navn": "Diltiazem",
    "engelsk": "diltiazem",
    "stoffer": [
      {
        "stoff": "diltiazem",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 39186,
      "inchikey": "HSUGRBWQSSZJOP-RTWAWAEBSA-N",
      "formel": "C22H26N2O4S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «diltiazem»; samme InChIKey hos ClinPGx (PA449334, CID 39186) og ChEBI (CHEBI:101278)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1332",
      "navn": "Diltiazem",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Diltiazem», ID 1332); CAS-nummeret 42399-41-7 er også PubChems, og molekylvekten 414,52 g/mol stemmer med PubChem (CID 39186) (414,5)."
    }
  },
  {
    "nokkel": "doksazosin",
    "navn": "Doksazosin",
    "engelsk": "doxazosin",
    "stoffer": [
      {
        "stoff": "doksazosin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3157,
      "inchikey": "RUZYUOTYCVRMRZ-UHFFFAOYSA-N",
      "formel": "C23H25N5O5",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «doxazosin»; samme InChIKey hos ClinPGx (PA449407, CID 3157) og ChEBI (CHEBI:4708)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9104",
      "navn": "Doksazosin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Doksazosin», ID 9104); CAS-nummeret 74191-85-8 er også PubChems (PubChem (CID 3157))."
    }
  },
  {
    "nokkel": "doksepin",
    "navn": "Doksepin",
    "engelsk": "doxepin",
    "stoffer": [
      {
        "stoff": "doksepin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3158,
      "inchikey": "ODQWQRRAPPTVAG-UHFFFAOYSA-N",
      "formel": "C19H21NO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «doxepin»; samme InChIKey hos ChEBI (CHEBI:4710)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "559",
      "navn": "Doksepin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Doksepin», ID 559); CAS-nummeret 1668-19-5 er også PubChems, og molekylvekten 279,38 g/mol stemmer med PubChem (CID 3158) (279,4)."
    }
  },
  {
    "nokkel": "duloksetin",
    "navn": "Duloksetin",
    "engelsk": "duloxetine",
    "stoffer": [
      {
        "stoff": "duloksetin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 60835,
      "inchikey": "ZEUITGRIYCTCEM-KRWDZBQOSA-N",
      "formel": "C18H19NOS",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «duloxetine»; samme InChIKey hos ClinPGx (PA10066, CID 60835)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "560",
      "navn": "Duloksetin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Duloksetin», ID 560); CAS-nummeret 116539-59-4 er også PubChems, og molekylvekten 297,41 g/mol stemmer med PubChem (CID 60835) (297,4)."
    }
  },
  {
    "nokkel": "eddp",
    "navn": "EDDP",
    "engelsk": "2-ethylidene-1,5-dimethyl-3,3-diphenylpyrrolidine",
    "stoffer": [
      {
        "stoff": "metadon",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5352621,
      "inchikey": "AJRJPORIQGYFMT-RMOCHZDMSA-N",
      "formel": "C20H23N",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «2-ethylidene-1,5-dimethyl-3,3-diphenylpyrrolidine»; samme InChIKey hos ChEBI (CHEBI:80645)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "769",
      "navn": "Etylidendimetyldifenylpyrrolidin (EDDP)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Etylidendimetyldifenylpyrrolidin (EDDP)», ID 769); CAS-nummeret 30223-73-5 er også PubChems (PubChem (CID 5352621))."
    }
  },
  {
    "nokkel": "enalapril",
    "navn": "Enalapril",
    "engelsk": "enalapril",
    "stoffer": [
      {
        "stoff": "enalapril",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5388962,
      "inchikey": "GBXSMTUPTTWBMN-XIRDDKMYSA-N",
      "formel": "C20H28N2O5",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «enalapril»; samme InChIKey hos ChEBI (CHEBI:4784)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2898",
      "navn": "Enalapril",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Enalapril», ID 2898); CAS-nummeret 75847-73-3 er også PubChems (PubChem (CID 5388962))."
    }
  },
  {
    "nokkel": "enalaprilat",
    "navn": "Enalaprilat",
    "engelsk": "enalaprilat",
    "synonymer": [
      "enalaprilat (anhydrous)"
    ],
    "stoffer": [
      {
        "stoff": "enalapril",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5462501,
      "inchikey": "LZFZMUMEGBBDTC-QEJZJMRPSA-N",
      "formel": "C18H24N2O5",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «enalaprilat»; samme InChIKey hos ChEBI (CHEBI:4786)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9086",
      "navn": "Enalaprilat",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Enalaprilat», ID 9086); CAS-nummeret 76420-72-9 er også PubChems (PubChem (CID 5462501))."
    }
  },
  {
    "nokkel": "eplerenon",
    "navn": "Eplerenon",
    "engelsk": "eplerenone",
    "stoffer": [
      {
        "stoff": "eplerenon",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 443872,
      "inchikey": "JUKPWJGBANNWMW-VWBFHTRKSA-N",
      "formel": "C24H30O6",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «eplerenone»; samme InChIKey hos ChEBI (CHEBI:31547)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9576",
      "navn": "Eplerenon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Eplerenon», ID 9576); CAS-nummeret 107724-20-9 er også PubChems (PubChem (CID 443872))."
    }
  },
  {
    "nokkel": "escitalopram",
    "navn": "Escitalopram",
    "engelsk": "escitalopram",
    "stoffer": [
      {
        "stoff": "escitalopram",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 146570,
      "inchikey": "WSEQXVZVJXJVFP-FQEVSTJZSA-N",
      "formel": "C20H21FN2O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «escitalopram»; samme InChIKey hos ClinPGx (PA10074, CID 146570) og ChEBI (CHEBI:36791)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "563",
      "navn": "Escitalopram",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Escitalopram», ID 563); CAS-nummeret 128196-01-0 er også PubChems, og molekylvekten 324,39 g/mol stemmer med PubChem (CID 146570) (324,4)."
    }
  },
  {
    "nokkel": "etanol",
    "navn": "Etanol",
    "engelsk": "ethanol",
    "stoffer": [
      {
        "stoff": "etanol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 702,
      "inchikey": "LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
      "formel": "C2H6O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ethanol»; samme InChIKey hos ClinPGx (PA448073, CID 702) og ChEBI (CHEBI:16236)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "554",
      "navn": "Etanol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Etanol», ID 554); CAS-nummeret 64-17-5 er også PubChems, og molekylvekten 46,04 g/mol stemmer med PubChem (CID 702) (46,07)."
    }
  },
  {
    "nokkel": "etylglukuronid",
    "navn": "Etylglukuronid (EtG)",
    "engelsk": "ethyl glucuronide",
    "stoffer": [
      {
        "stoff": "etanol",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 18392195,
      "inchikey": "IWJBVMJWSPZNJH-UQGZVRACSA-N",
      "formel": "C8H14O7",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ethyl glucuronide»; samme InChIKey hos ChEBI (CHEBI:87248)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "738",
      "navn": "Etylglukuronid (EtG)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Etylglukuronid (EtG)», ID 738); CAS-nummeret 17685-04-0 er også PubChems, og molekylvekten 222,19 g/mol stemmer med PubChem (CID 18392195) (222,19)."
    }
  },
  {
    "nokkel": "etylsulfat",
    "navn": "Etylsulfat (EtS)",
    "engelsk": "ethyl sulfate",
    "synonymer": [
      "ethyl hydrogen sulfate"
    ],
    "stoffer": [
      {
        "stoff": "etanol",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 6004,
      "inchikey": "KIWBPDUYBMNFTB-UHFFFAOYSA-N",
      "formel": "C2H6O4S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ethyl sulfate»; samme InChIKey hos ChEBI (CHEBI:156187)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "739",
      "navn": "Etylsulfat (EtS)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Etylsulfat (EtS)», ID 739); CAS-nummeret 540-82-9 er også PubChems, og molekylvekten 126,13 g/mol stemmer med PubChem (CID 6004) (126,13)."
    }
  },
  {
    "nokkel": "fenobarbital",
    "navn": "Fenobarbital",
    "engelsk": "phenobarbital",
    "stoffer": [
      {
        "stoff": "fenobarbital",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4763,
      "inchikey": "DDBREPKUVSBGFI-UHFFFAOYSA-N",
      "formel": "C12H12N2O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «phenobarbital»; samme InChIKey hos ClinPGx (PA450911, CID 4763) og ChEBI (CHEBI:8069)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "574",
      "navn": "Fenobarbital",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Fenobarbital», ID 574); molekylvekten 232,235 g/mol stemmer med PubChem (CID 4763) (232,23)."
    }
  },
  {
    "nokkel": "fentanyl",
    "navn": "Fentanyl",
    "engelsk": "fentanyl",
    "stoffer": [
      {
        "stoff": "fentanyl",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3345,
      "inchikey": "PJMPHNIQZUBGLI-UHFFFAOYSA-N",
      "formel": "C22H28N2O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «fentanyl»; samme InChIKey hos ClinPGx (PA449599, CID 3345) og ChEBI (CHEBI:119915)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "576",
      "navn": "Fentanyl",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Fentanyl», ID 576); CAS-nummeret 437-38-7 er også PubChems, og molekylvekten 336,47 g/mol stemmer med PubChem (CID 3345) (336,5)."
    }
  },
  {
    "nokkel": "fenytoin",
    "navn": "Fenytoin",
    "engelsk": "phenytoin",
    "stoffer": [
      {
        "stoff": "fenytoin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 1775,
      "inchikey": "CXOFVDLJLONNDW-UHFFFAOYSA-N",
      "formel": "C15H12N2O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «phenytoin»; samme InChIKey hos ClinPGx (PA450947, CID 1775) og ChEBI (CHEBI:8107)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "577",
      "navn": "Fenytoin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Komponenten i Farmakologiportalen med nøyaktig navnet («Fenytoin», ID 577; ellers «Fenytoin (bundet)», «Fenytoin (fritt)»); CAS-nummeret 57-41-0 er også PubChems, og molekylvekten 252,27 g/mol stemmer med PubChem (CID 1775) (252,27)."
    }
  },
  {
    "nokkel": "flunitrazepam",
    "navn": "Flunitrazepam",
    "engelsk": "flunitrazepam",
    "stoffer": [
      {
        "stoff": "flunitrazepam",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3380,
      "inchikey": "PPTYJKAXVCCBDU-UHFFFAOYSA-N",
      "formel": "C16H12FN3O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «flunitrazepam»; samme InChIKey hos ClinPGx (PA164781320, CID 3380) og ChEBI (CHEBI:31622)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "580",
      "navn": "Flunitrazepam",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Flunitrazepam», ID 580); CAS-nummeret 1622-62-4 er også PubChems (PubChem (CID 3380))."
    }
  },
  {
    "nokkel": "fluoksetin",
    "navn": "Fluoksetin",
    "engelsk": "fluoxetine",
    "stoffer": [
      {
        "stoff": "fluoksetin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3386,
      "inchikey": "RTHCYVBBDHJXIQ-UHFFFAOYSA-N",
      "formel": "C17H18F3NO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «fluoxetine»; samme InChIKey hos ClinPGx (PA449673, CID 3386)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "581",
      "navn": "Fluoksetin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Fluoksetin», ID 581); CAS-nummeret 54910-89-3 er også PubChems, og molekylvekten 309,33 g/mol stemmer med PubChem (CID 3386) (309,33)."
    }
  },
  {
    "nokkel": "flupentiksol",
    "navn": "Flupentiksol",
    "engelsk": "flupentixol",
    "synonymer": [
      "cis-flupenthixol"
    ],
    "stoffer": [
      {
        "stoff": "flupentiksol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5281881,
      "inchikey": "NJMYODHXAKYRHW-DVZOWYKESA-N",
      "formel": "C23H25F3N2OS",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «flupentixol»; samme InChIKey hos ChEBI (CHEBI:10454)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "586",
      "navn": "Flupentiksol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Flupentiksol», ID 586); CAS-nummeret 2709-56-0 er også PubChems, og molekylvekten 434,52 g/mol stemmer med PubChem (CID 5281881) (434,5)."
    }
  },
  {
    "nokkel": "fluvoksamin",
    "navn": "Fluvoksamin",
    "engelsk": "fluvoxamine",
    "stoffer": [
      {
        "stoff": "fluvoksamin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5324346,
      "inchikey": "CJOFXWAVKWHTFT-XSFVSMFZSA-N",
      "formel": "C15H21F3N2O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «fluvoxamine»; samme InChIKey hos ChEBI (CHEBI:5138)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "588",
      "navn": "Fluvoksamin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Fluvoksamin», ID 588); CAS-nummeret 54739-18-3 er også PubChems, og molekylvekten 318,34 g/mol stemmer med PubChem (CID 5324346) (318,33)."
    }
  },
  {
    "nokkel": "furosemid",
    "navn": "Furosemid",
    "engelsk": "furosemide",
    "stoffer": [
      {
        "stoff": "furosemid",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3440,
      "inchikey": "ZZUFCTLCJUWOSV-UHFFFAOYSA-N",
      "formel": "C12H11ClN2O5S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «furosemide»; samme InChIKey hos ClinPGx (PA449719, CID 3440) og ChEBI (CHEBI:47426)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2900",
      "navn": "Furosemid",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Furosemid», ID 2900); CAS-nummeret 54-31-9 er også PubChems, og molekylvekten 330,75 g/mol stemmer med PubChem (CID 3440) (330,74)."
    }
  },
  {
    "nokkel": "gabapentin",
    "navn": "Gabapentin",
    "engelsk": "gabapentin",
    "stoffer": [
      {
        "stoff": "gabapentin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3446,
      "inchikey": "UGJMXCAKCUNAIE-UHFFFAOYSA-N",
      "formel": "C9H17NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «gabapentin»; samme InChIKey hos ClinPGx (PA449720, CID 3446) og ChEBI (CHEBI:42797)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "590",
      "navn": "Gabapentin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Gabapentin», ID 590); CAS-nummeret 60142-96-3 er også PubChems, og molekylvekten 171,24 g/mol stemmer med PubChem (CID 3446) (171,24)."
    }
  },
  {
    "nokkel": "ghb",
    "navn": "GHB (gamma-hydroksybutyrat)",
    "engelsk": "4-hydroxybutanoic acid",
    "synonymer": [
      "4-hydroxybutyric acid",
      "gamma-hydroxybutyric acid"
    ],
    "stoffer": [
      {
        "stoff": "ghb",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "merknad": "Laboratoriene måler GHB som fri syre, også når legemiddelet er natriumoksybat.",
    "pubchem": {
      "cid": 10413,
      "inchikey": "SJZRECIVHVDYJC-UHFFFAOYSA-N",
      "formel": "C4H8O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «4-hydroxybutanoic acid»; samme InChIKey hos ChEBI (CHEBI:30830)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "592",
      "navn": "Gammahydroksysmørsyre (GHB)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Gammahydroksysmørsyre (GHB)», ID 592); CAS-nummeret 591-81-1 er også PubChems (PubChem (CID 10413))."
    }
  },
  {
    "nokkel": "haloperidol",
    "navn": "Haloperidol",
    "engelsk": "haloperidol",
    "stoffer": [
      {
        "stoff": "haloperidol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3559,
      "inchikey": "LNEPOXFFQSENCJ-UHFFFAOYSA-N",
      "formel": "C21H23ClFNO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «haloperidol»; samme InChIKey hos ClinPGx (PA449841, CID 3559) og ChEBI (CHEBI:5613)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "594",
      "navn": "Haloperidol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Komponenten i Farmakologiportalen med nøyaktig navnet («Haloperidol», ID 594; ellers «Haloperidol (redusert)»); CAS-nummeret 52-86-8 er også PubChems, og molekylvekten 375,9 g/mol stemmer med PubChem (CID 3559) (375,9)."
    }
  },
  {
    "nokkel": "hydroklortiazid",
    "navn": "Hydroklortiazid",
    "engelsk": "hydrochlorothiazide",
    "stoffer": [
      {
        "stoff": "hydroklortiazid",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3639,
      "inchikey": "JZUFKLXOESDKRF-UHFFFAOYSA-N",
      "formel": "C7H8ClN3O4S2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «hydrochlorothiazide»; samme InChIKey hos ClinPGx (PA449899, CID 3639) og ChEBI (CHEBI:5778)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9096",
      "navn": "Hydroklortiazid",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Hydroklortiazid», ID 9096); CAS-nummeret 58-93-5 er også PubChems (PubChem (CID 3639))."
    }
  },
  {
    "nokkel": "hydroksybupropion",
    "navn": "Hydroksybupropion",
    "engelsk": "hydroxybupropion",
    "stoffer": [
      {
        "stoff": "bupropion",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 446,
      "inchikey": "AKOAEVOSDHIVFX-UHFFFAOYSA-N",
      "formel": "C13H18ClNO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «hydroxybupropion»; samme InChIKey hos ClinPGx (PA166226561, CID 446) og ChEBI (CHEBI:166487)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "794",
      "navn": "Hydroksybupropion",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Hydroksybupropion», ID 794); CAS-nummeret 357399-43-0 er i PubChem CID 9837966 («2-(3-Chlorophenyl)-3,5,5-trimethyl-2-morpholinol»), samme molekylformel (C13H18ClNO2) og dermed samme molekylvekt som PubChem (CID 446)."
    }
  },
  {
    "nokkel": "hydroksykarbazepin",
    "navn": "10-hydroksykarbazepin (MHD)",
    "engelsk": "licarbazepine",
    "fpnavn": [
      "Likarbazepin"
    ],
    "stoffer": [
      {
        "stoff": "okskarbazepin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 114709,
      "inchikey": "BMPDWHIDQYTSHX-UHFFFAOYSA-N",
      "formel": "C15H14N2O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «licarbazepine»; samme InChIKey hos ChEBI (CHEBI:701)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "807",
      "navn": "Likarbazepin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Likarbazepin», ID 807); CAS-nummeret 104746-03-4 er i PubChem CID 9816485 («Licarbazepine, (R)-»), samme forbindelse som PubChem (CID 114709) uten hensyn til stereokjemien (InChIKey-skjelett BMPDWHIDQYTSHX)."
    }
  },
  {
    "nokkel": "irbesartan",
    "navn": "Irbesartan",
    "engelsk": "irbesartan",
    "stoffer": [
      {
        "stoff": "irbesartan",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3749,
      "inchikey": "YOSHYTLCDANDAN-UHFFFAOYSA-N",
      "formel": "C25H28N6O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «irbesartan»; samme InChIKey hos ClinPGx (PA450084, CID 3749) og ChEBI (CHEBI:5959)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1342",
      "navn": "Irbesartan",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Irbesartan», ID 1342); CAS-nummeret 138402-11-6 er også PubChems, og molekylvekten 428,53 g/mol stemmer med PubChem (CID 3749) (428,5)."
    }
  },
  {
    "nokkel": "kandesartan",
    "navn": "Kandesartan",
    "engelsk": "candesartan",
    "stoffer": [
      {
        "stoff": "kandesartan",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "merknad": "Det aktive stoffet laboratoriene måler; legemiddelet er forløperen kandesartancileksetil.",
    "pubchem": {
      "cid": 2541,
      "inchikey": "HTQMVQVXFRQIKW-UHFFFAOYSA-N",
      "formel": "C24H20N6O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «candesartan»; samme InChIKey hos ClinPGx (PA448765, CID 2541) og ChEBI (CHEBI:3347)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2906",
      "navn": "Kandesartan",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Kandesartan», ID 2906); CAS-nummeret 139481-59-7 er også PubChems, og molekylvekten 440,45 g/mol stemmer med PubChem (CID 2541) (440,5)."
    }
  },
  {
    "nokkel": "kanrenon",
    "navn": "Kanrenon",
    "engelsk": "canrenone",
    "stoffer": [
      {
        "stoff": "spironolakton",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 13789,
      "inchikey": "UJVLDDZCTMKXJK-WNHSNXHDSA-N",
      "formel": "C22H28O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «canrenone»; samme InChIKey hos ChEBI (CHEBI:135445)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9100",
      "navn": "Kanrenon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Kanrenon», ID 9100); CAS-nummeret 976-71-6 er også PubChems (PubChem (CID 13789))."
    }
  },
  {
    "nokkel": "karbamazepin",
    "navn": "Karbamazepin",
    "engelsk": "carbamazepine",
    "stoffer": [
      {
        "stoff": "karbamazepin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2554,
      "inchikey": "FFGPTBGBLSHEPO-UHFFFAOYSA-N",
      "formel": "C15H12N2O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «carbamazepine»; samme InChIKey hos ClinPGx (PA448785, CID 2554) og ChEBI (CHEBI:3387)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "619",
      "navn": "Karbamazepin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Komponenten i Farmakologiportalen med nøyaktig navnet («Karbamazepin», ID 619; ellers «Karbamazepin (bundet)», «Karbamazepin (fritt)»); CAS-nummeret 298-46-4 er også PubChems, og molekylvekten 236,27 g/mol stemmer med PubChem (CID 2554) (236,27)."
    }
  },
  {
    "nokkel": "karbamazepinepoksid",
    "navn": "Karbamazepin-10,11-epoksid",
    "engelsk": "carbamazepine-10,11-epoxide",
    "stoffer": [
      {
        "stoff": "karbamazepin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2555,
      "inchikey": "ZRWWEEVEIOGMMT-UHFFFAOYSA-N",
      "formel": "C15H12N2O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «carbamazepine-10,11-epoxide»; samme InChIKey hos ChEBI (CHEBI:3388)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "808",
      "navn": "Karbamazepinepoksid",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Karbamazepinepoksid», ID 808); CAS-nummeret 36507-30-9 er også PubChems (PubChem (CID 2555))."
    }
  },
  {
    "nokkel": "kariprazin",
    "navn": "Kariprazin",
    "engelsk": "cariprazine",
    "stoffer": [
      {
        "stoff": "kariprazin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 11154555,
      "inchikey": "KPWSJANDNDDRMB-UHFFFAOYSA-N",
      "formel": "C21H32Cl2N4O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «cariprazine»; samme InChIKey hos ClinPGx (PA166177476, CID 11154555)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "10082",
      "navn": "Kariprazin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Kariprazin», ID 10082); CAS-nummeret 839712-12-8 er også PubChems (PubChem (CID 11154555))."
    }
  },
  {
    "nokkel": "karvedilol",
    "navn": "Karvedilol",
    "engelsk": "carvedilol",
    "stoffer": [
      {
        "stoff": "karvedilol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2585,
      "inchikey": "OGHNVEJMJSYVRP-UHFFFAOYSA-N",
      "formel": "C24H26N2O4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «carvedilol»; samme InChIKey hos ClinPGx (PA448817, CID 2585) og ChEBI (CHEBI:3441)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1343",
      "navn": "Karvedilol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Karvedilol», ID 1343); CAS-nummeret 72956-09-3 er også PubChems, og molekylvekten 406,47 g/mol stemmer med PubChem (CID 2585) (406,5)."
    }
  },
  {
    "nokkel": "ketamin",
    "navn": "Ketamin",
    "engelsk": "ketamine",
    "stoffer": [
      {
        "stoff": "ketamin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3821,
      "inchikey": "YQEZLKZALYSWHR-UHFFFAOYSA-N",
      "formel": "C13H16ClNO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ketamine»; samme InChIKey hos ClinPGx (PA450144, CID 3821) og ChEBI (CHEBI:6121)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "621",
      "navn": "Ketamin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Ketamin», ID 621); CAS-nummeret 6740-88-1 er også PubChems, og molekylvekten 237,73 g/mol stemmer med PubChem (CID 3821) (237,72)."
    }
  },
  {
    "nokkel": "ketobemidon",
    "navn": "Ketobemidon",
    "engelsk": "ketobemidone",
    "stoffer": [
      {
        "stoff": "ketobemidon",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 10101,
      "inchikey": "ALFGKMXHOUSVAD-UHFFFAOYSA-N",
      "formel": "C15H21NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ketobemidone»; samme InChIKey hos ClinPGx (PA166211241, CID 10101) og ChEBI (CHEBI:6125)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "622",
      "navn": "Ketobemidon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Ketobemidon», ID 622); CAS-nummeret 469-79-4 er også PubChems, og molekylvekten 247,33 g/mol stemmer med PubChem (CID 10101) (247,33)."
    }
  },
  {
    "nokkel": "klomipramin",
    "navn": "Klomipramin",
    "engelsk": "clomipramine",
    "stoffer": [
      {
        "stoff": "klomipramin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2801,
      "inchikey": "GDLIGKIOYRNHDA-UHFFFAOYSA-N",
      "formel": "C19H23ClN2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «clomipramine»; samme InChIKey hos ClinPGx (PA449048, CID 2801) og ChEBI (CHEBI:47780)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "625",
      "navn": "Klomipramin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Klomipramin», ID 625); CAS-nummeret 303-49-1 er også PubChems, og molekylvekten 314,9 g/mol stemmer med PubChem (CID 2801) (314,9)."
    }
  },
  {
    "nokkel": "klonazepam",
    "navn": "Klonazepam",
    "engelsk": "clonazepam",
    "stoffer": [
      {
        "stoff": "klonazepam",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2802,
      "inchikey": "DGBIGWXXNGSACT-UHFFFAOYSA-N",
      "formel": "C15H10ClN3O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «clonazepam»; samme InChIKey hos ClinPGx (PA449050, CID 2802) og ChEBI (CHEBI:3756)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "626",
      "navn": "Klonazepam",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Klonazepam», ID 626); CAS-nummeret 1622-61-3 er også PubChems (PubChem (CID 2802))."
    }
  },
  {
    "nokkel": "klorprotiksen",
    "navn": "Klorprotiksen",
    "engelsk": "chlorprothixene",
    "stoffer": [
      {
        "stoff": "klorprotiksen",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 667467,
      "inchikey": "WSPOMRSOLSGNFJ-AUWJEWJLSA-N",
      "formel": "C18H18ClNS",
      "kontrollert": "2026-10-08",
      "grunnlag": "PubChems post for «chlorprothixene» (tittel «Chlorprothixene»); ClinPGx (PA164781400, CID 2729) og ChEBI (CHEBI:3651) har samme skjelett, men en annen stereokjemi eller protonering i InChIKey. Formelen og molekylvekten er de samme."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "629",
      "navn": "Klorprotiksen",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Klorprotiksen», ID 629); CAS-nummeret 113-59-7 er også PubChems, og molekylvekten 315,86 g/mol stemmer med PubChem (CID 667467) (315,9)."
    }
  },
  {
    "nokkel": "klozapin",
    "navn": "Klozapin",
    "engelsk": "clozapine",
    "stoffer": [
      {
        "stoff": "klozapin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 135398737,
      "inchikey": "QZUDBNBUXVUHMW-UHFFFAOYSA-N",
      "formel": "C18H19ClN4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «clozapine»; samme InChIKey hos ChEBI (CHEBI:3766)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "630",
      "navn": "Klozapin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Klozapin», ID 630); CAS-nummeret 5786-21-0 er også PubChems, og molekylvekten 326,82 g/mol stemmer med PubChem (CID 135398737) (326,8)."
    }
  },
  {
    "nokkel": "kodein",
    "navn": "Kodein",
    "engelsk": "codeine",
    "stoffer": [
      {
        "stoff": "kodein",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5284371,
      "inchikey": "OROGSEYTTFOCAN-DNJOTXNNSA-N",
      "formel": "C18H21NO3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «codeine»; samme InChIKey hos ClinPGx (PA449088, CID 5284371) og ChEBI (CHEBI:16714)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "631",
      "navn": "Kodein",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Kodein», ID 631); CAS-nummeret 76-57-3 er også PubChems (PubChem (CID 5284371))."
    }
  },
  {
    "nokkel": "kokain",
    "navn": "Kokain",
    "engelsk": "cocaine",
    "stoffer": [
      {
        "stoff": "kokain",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 446220,
      "inchikey": "ZPUCINDJVBIVPJ-LJISPDSOSA-N",
      "formel": "C17H21NO4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «cocaine»; samme InChIKey hos ChEBI (CHEBI:27958)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "633",
      "navn": "Kokain",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Kokain», ID 633); CAS-nummeret 50-36-2 er også PubChems (PubChem (CID 446220))."
    }
  },
  {
    "nokkel": "kvetiapin",
    "navn": "Kvetiapin",
    "engelsk": "quetiapine",
    "stoffer": [
      {
        "stoff": "kvetiapin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5002,
      "inchikey": "URKOMYMAXPYINW-UHFFFAOYSA-N",
      "formel": "C21H25N3O2S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «quetiapine»; samme InChIKey hos ClinPGx (PA451201, CID 5002) og ChEBI (CHEBI:8707)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "697",
      "navn": "Kvetiapin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Kvetiapin», ID 697); CAS-nummeret 111974-69-7 er også PubChems, og molekylvekten 383,51 g/mol stemmer med PubChem (CID 5002) (383,5)."
    }
  },
  {
    "nokkel": "labetalol",
    "navn": "Labetalol",
    "engelsk": "labetalol",
    "stoffer": [
      {
        "stoff": "labetalol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3869,
      "inchikey": "SGUAFYQXFOLMHL-UHFFFAOYSA-N",
      "formel": "C19H24N2O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «labetalol»; samme InChIKey hos ClinPGx (PA164743150, CID 3869)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2910",
      "navn": "Labetalol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Labetalol», ID 2910); CAS-nummeret 36894-69-6 er også PubChems, og molekylvekten 328,41 g/mol stemmer med PubChem (CID 3869) (328,4)."
    }
  },
  {
    "nokkel": "lamotrigin",
    "navn": "Lamotrigin",
    "engelsk": "lamotrigine",
    "stoffer": [
      {
        "stoff": "lamotrigin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3878,
      "inchikey": "PYZRQGJRPPTADH-UHFFFAOYSA-N",
      "formel": "C9H7Cl2N5",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «lamotrigine»; samme InChIKey hos ClinPGx (PA450164, CID 3878) og ChEBI (CHEBI:6367)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "634",
      "navn": "Lamotrigin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Lamotrigin», ID 634); CAS-nummeret 84057-84-1 er også PubChems, og molekylvekten 256,09 g/mol stemmer med PubChem (CID 3878) (256,09)."
    }
  },
  {
    "nokkel": "lerkanidipin",
    "navn": "Lerkanidipin",
    "engelsk": "lercanidipine",
    "stoffer": [
      {
        "stoff": "lerkanidipin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 65866,
      "inchikey": "ZDXUKAKRHYTAKV-UHFFFAOYSA-N",
      "formel": "C36H41N3O6",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «lercanidipine»; samme InChIKey hos ClinPGx (PA164769058, CID 65866) og ChEBI (CHEBI:135930)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9093",
      "navn": "Lerkanidipin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Lerkanidipin», ID 9093); CAS-nummeret 100427-26-7 er også PubChems (PubChem (CID 65866))."
    }
  },
  {
    "nokkel": "levetiracetam",
    "navn": "Levetiracetam",
    "engelsk": "levetiracetam",
    "stoffer": [
      {
        "stoff": "levetiracetam",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5284583,
      "inchikey": "HPHUVLMMVZITSG-LURJTMIESA-N",
      "formel": "C8H14N2O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «levetiracetam»; samme InChIKey hos ChEBI (CHEBI:6437)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "635",
      "navn": "Levetiracetam",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Levetiracetam», ID 635); CAS-nummeret 102767-28-2 er også PubChems, og molekylvekten 170,21 g/mol stemmer med PubChem (CID 5284583) (170,21)."
    }
  },
  {
    "nokkel": "levomepromazin",
    "navn": "Levomepromazin",
    "engelsk": "levomepromazine",
    "stoffer": [
      {
        "stoff": "levomepromazin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 72287,
      "inchikey": "VRQVVMDWGGWHTJ-CQSZACIVSA-N",
      "formel": "C19H24N2OS",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «levomepromazine»; samme InChIKey hos ClinPGx (PA134687942, CID 72287)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "636",
      "navn": "Levomepromazin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Levomepromazin», ID 636); CAS-nummeret 60-99-1 er også PubChems, og molekylvekten 328,47 g/mol stemmer med PubChem (CID 72287) (328,5)."
    }
  },
  {
    "nokkel": "lisinopril",
    "navn": "Lisinopril",
    "engelsk": "lisinopril",
    "stoffer": [
      {
        "stoff": "lisinopril",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5362119,
      "inchikey": "RLAWWYSOJDYHDC-BZSNNMDCSA-N",
      "formel": "C21H31N3O5",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «lisinopril»; samme InChIKey hos ClinPGx (PA450242, CID 5362119) og ChEBI (CHEBI:43755)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2912",
      "navn": "Lisinopril",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Lisinopril», ID 2912); CAS-nummeret 76547-98-3 er også PubChems, og molekylvekten 405,49 g/mol stemmer med PubChem (CID 5362119) (405,5)."
    }
  },
  {
    "nokkel": "litium",
    "navn": "Litium",
    "engelsk": "lithium cation",
    "synonymer": [
      "lithium(1+)"
    ],
    "stoffer": [
      {
        "stoff": "litium",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "ion",
    "merknad": "Laboratoriene måler litiumionet; konsentrasjonen oppgis i mmol/L.",
    "pubchem": {
      "cid": 28486,
      "inchikey": "HBBGRARXTFLTSG-UHFFFAOYSA-N",
      "formel": "Li+",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «lithium cation»; samme InChIKey hos ChEBI (CHEBI:49713)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "637",
      "navn": "Litium",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Litium», ID 637); molekylvekten 6,941 g/mol stemmer med PubChem (CID 28486) (7)."
    }
  },
  {
    "nokkel": "losartan",
    "navn": "Losartan",
    "engelsk": "losartan",
    "stoffer": [
      {
        "stoff": "losartan",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 3961,
      "inchikey": "PSIFNNKUMBGKDQ-UHFFFAOYSA-N",
      "formel": "C22H23ClN6O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «losartan»; samme InChIKey hos ClinPGx (PA450268, CID 3961) og ChEBI (CHEBI:6541)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1344",
      "navn": "Losartan",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Losartan», ID 1344); CAS-nummeret 114798-26-4 er også PubChems (PubChem (CID 3961))."
    }
  },
  {
    "nokkel": "losartansyre",
    "navn": "Losartansyre (EXP-3174)",
    "engelsk": "losartan carboxylic acid",
    "stoffer": [
      {
        "stoff": "losartan",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 108185,
      "inchikey": "ZEUXAIYYDDCIRX-UHFFFAOYSA-N",
      "formel": "C22H21ClN6O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «losartan carboxylic acid»; samme InChIKey hos ChEBI (CHEBI:74125)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9106",
      "navn": "Losartansyre",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Losartansyre», ID 9106); CAS-nummeret 124750-92-1 er også PubChems (PubChem (CID 108185))."
    }
  },
  {
    "nokkel": "lurasidon",
    "navn": "Lurasidon",
    "engelsk": "lurasidone",
    "stoffer": [
      {
        "stoff": "lurasidon",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 213046,
      "inchikey": "PQXKDMSYBGKCJA-CVTJIBDQSA-N",
      "formel": "C28H36N4O2S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «lurasidone»; samme InChIKey hos ClinPGx (PA166129557, CID 213046) og ChEBI (CHEBI:70735)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9001",
      "navn": "Lurasidon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Lurasidon», ID 9001); CAS-nummeret 367514-87-2 er også PubChems, og molekylvekten 492,67 g/mol stemmer med PubChem (CID 213046) (492,7)."
    }
  },
  {
    "nokkel": "mda",
    "navn": "MDA",
    "engelsk": "3,4-methylenedioxyamphetamine",
    "stoffer": [
      {
        "stoff": "mdma",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 1614,
      "inchikey": "NGBBVGZWCFBOGO-UHFFFAOYSA-N",
      "formel": "C10H13NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «3,4-methylenedioxyamphetamine»; samme InChIKey hos ChEBI (CHEBI:166520)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "657",
      "navn": "Metylendioksyamfetamin (MDA)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Metylendioksyamfetamin (MDA)», ID 657); CAS-nummeret 4764-17-4 er også PubChems, og molekylvekten 179,22 g/mol stemmer med PubChem (CID 1614) (179,22)."
    }
  },
  {
    "nokkel": "mdma",
    "navn": "MDMA",
    "engelsk": "3,4-methylenedioxymethamphetamine",
    "stoffer": [
      {
        "stoff": "mdma",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 1615,
      "inchikey": "SHXWCVYOXRDMCX-UHFFFAOYSA-N",
      "formel": "C11H15NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «3,4-methylenedioxymethamphetamine»; samme InChIKey hos ClinPGx (PA131887008, CID 1615) og ChEBI (CHEBI:1391)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "661",
      "navn": "Metylendioksymetamfetamin (MDMA)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Metylendioksymetamfetamin (MDMA)», ID 661); CAS-nummeret 42542-10-9 er også PubChems, og molekylvekten 193,24 g/mol stemmer med PubChem (CID 1615) (193,24)."
    }
  },
  {
    "nokkel": "metadon",
    "navn": "Metadon",
    "engelsk": "methadone",
    "stoffer": [
      {
        "stoff": "metadon",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4095,
      "inchikey": "USSIQXCVUWKGNF-UHFFFAOYSA-N",
      "formel": "C21H27NO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «methadone»; samme InChIKey hos ClinPGx (PA450401, CID 4095)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "645",
      "navn": "Metadon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Metadon», ID 645); CAS-nummeret 76-99-3 er også PubChems (PubChem (CID 4095))."
    }
  },
  {
    "nokkel": "metamfetamin",
    "navn": "Metamfetamin",
    "engelsk": "methamphetamine",
    "stoffer": [
      {
        "stoff": "metamfetamin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 10836,
      "inchikey": "MYWUZJCMWCOHBA-VIFPVBQESA-N",
      "formel": "C10H15N",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «methamphetamine»; samme InChIKey hos ClinPGx (PA450403, CID 10836) og ChEBI (CHEBI:6809)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "647",
      "navn": "Metamfetamin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Metamfetamin», ID 647); CAS-nummeret 537-46-2 er også PubChems, og molekylvekten 149,23 g/mol stemmer med PubChem (CID 10836) (149,23)."
    }
  },
  {
    "nokkel": "metoprolol",
    "navn": "Metoprolol",
    "engelsk": "metoprolol",
    "stoffer": [
      {
        "stoff": "metoprolol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4171,
      "inchikey": "IUBSYMUCCVWXPE-UHFFFAOYSA-N",
      "formel": "C15H25NO3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «metoprolol»; samme InChIKey hos ClinPGx (PA450480, CID 4171) og ChEBI (CHEBI:6904)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "653",
      "navn": "Metoprolol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Metoprolol», ID 653); CAS-nummeret 37350-58-6 er også PubChems, og molekylvekten 267,36 g/mol stemmer med PubChem (CID 4171) (267,36)."
    }
  },
  {
    "nokkel": "metylfenidat",
    "navn": "Metylfenidat",
    "engelsk": "methylphenidate",
    "stoffer": [
      {
        "stoff": "metylfenidat",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4158,
      "inchikey": "DUGOZIWVEXMGBE-UHFFFAOYSA-N",
      "formel": "C14H19NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «methylphenidate»; samme InChIKey hos ClinPGx (PA450464, CID 4158)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "664",
      "navn": "Metylfenidat",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Metylfenidat», ID 664); CAS-nummeret 113-45-1 er også PubChems, og molekylvekten 233,3 g/mol stemmer med PubChem (CID 4158) (233,31)."
    }
  },
  {
    "nokkel": "mianserin",
    "navn": "Mianserin",
    "engelsk": "mianserin",
    "stoffer": [
      {
        "stoff": "mianserin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4184,
      "inchikey": "UEQUQVLFIPOEMF-UHFFFAOYSA-N",
      "formel": "C18H20N2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «mianserin»; samme InChIKey hos ClinPGx (PA134687937, CID 4184) og ChEBI (CHEBI:51137)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "666",
      "navn": "Mianserin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Mianserin», ID 666); CAS-nummeret 24219-97-4 er også PubChems, og molekylvekten 264,37 g/mol stemmer med PubChem (CID 4184) (264,4)."
    }
  },
  {
    "nokkel": "mirtazapin",
    "navn": "Mirtazapin",
    "engelsk": "mirtazapine",
    "stoffer": [
      {
        "stoff": "mirtazapin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4205,
      "inchikey": "RONZAEMNMFQXRA-UHFFFAOYSA-N",
      "formel": "C17H19N3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «mirtazapine»; samme InChIKey hos ClinPGx (PA450522, CID 4205) og ChEBI (CHEBI:6950)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "668",
      "navn": "Mirtazapin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Mirtazapin», ID 668); CAS-nummeret 61337-67-5 er også PubChems, og molekylvekten 265,35 g/mol stemmer med PubChem (CID 4205) (265,35)."
    }
  },
  {
    "nokkel": "morfin",
    "navn": "Morfin",
    "engelsk": "morphine",
    "stoffer": [
      {
        "stoff": "morfin",
        "relasjon": "selve_stoffet"
      },
      {
        "stoff": "kodein",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5288826,
      "inchikey": "BQJCRHHNABKAKU-KBQPJGBKSA-N",
      "formel": "C17H19NO3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «morphine»; samme InChIKey hos ClinPGx (PA450550, CID 5288826) og ChEBI (CHEBI:17303)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "671",
      "navn": "Morfin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Morfin», ID 671); CAS-nummeret 57-27-2 er også PubChems, og molekylvekten 285,34 g/mol stemmer med PubChem (CID 5288826) (285,34)."
    }
  },
  {
    "nokkel": "nifedipin",
    "navn": "Nifedipin",
    "engelsk": "nifedipine",
    "stoffer": [
      {
        "stoff": "nifedipin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4485,
      "inchikey": "HYIMSNHJOBLJNT-UHFFFAOYSA-N",
      "formel": "C17H18N2O6",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «nifedipine»; samme InChIKey hos ClinPGx (PA450631, CID 4485) og ChEBI (CHEBI:7565)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2914",
      "navn": "Nifedipin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Nifedipin», ID 2914); CAS-nummeret 21829-25-4 er også PubChems, og molekylvekten 346,33 g/mol stemmer med PubChem (CID 4485) (346,3)."
    }
  },
  {
    "nokkel": "nitrazepam",
    "navn": "Nitrazepam",
    "engelsk": "nitrazepam",
    "stoffer": [
      {
        "stoff": "nitrazepam",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4506,
      "inchikey": "KJONHKAYOJNZEC-UHFFFAOYSA-N",
      "formel": "C15H11N3O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «nitrazepam»; samme InChIKey hos ClinPGx (PA10242, CID 4506) og ChEBI (CHEBI:7581)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "673",
      "navn": "Nitrazepam",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Nitrazepam», ID 673); CAS-nummeret 146-22-5 er også PubChems (PubChem (CID 4506))."
    }
  },
  {
    "nokkel": "norbuprenorfin",
    "navn": "Norbuprenorfin",
    "engelsk": "norbuprenorphine",
    "stoffer": [
      {
        "stoff": "buprenorfin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 114976,
      "inchikey": "YOYLLRBMGQRFTN-IOMBULRVSA-N",
      "formel": "C25H35NO4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «norbuprenorphine»; samme InChIKey hos ClinPGx (PA166301121, CID 114976) og ChEBI (CHEBI:172315)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "766",
      "navn": "Norbuprenorfin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Norbuprenorfin», ID 766); CAS-nummeret 78715-23-8 er også PubChems (PubChem (CID 114976))."
    }
  },
  {
    "nokkel": "nordiazepam",
    "navn": "Nordiazepam (desmetyldiazepam)",
    "engelsk": "nordazepam",
    "stoffer": [
      {
        "stoff": "diazepam",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2997,
      "inchikey": "AKPLHCDWDRPJGD-UHFFFAOYSA-N",
      "formel": "C15H11ClN2O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «nordazepam»; samme InChIKey hos ClinPGx (PA166131305, CID 2997) og ChEBI (CHEBI:111762)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "745",
      "navn": "Desmetyldiazepam (DMD, nordiazepam)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Desmetyldiazepam (DMD, nordiazepam)», ID 745); CAS-nummeret 1088-11-5 er også PubChems (PubChem (CID 2997))."
    }
  },
  {
    "nokkel": "norfentanyl",
    "navn": "Norfentanyl",
    "engelsk": "norfentanyl",
    "stoffer": [
      {
        "stoff": "fentanyl",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 259381,
      "inchikey": "PMCBDBWCQQBSRJ-UHFFFAOYSA-N",
      "formel": "C14H20N2O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «norfentanyl»; samme InChIKey hos ClinPGx (PA166179852, CID 259381) og ChEBI (CHEBI:62685)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2943",
      "navn": "Norfentanyl",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Norfentanyl», ID 2943); CAS-nummeret 1609-66-1 er også PubChems (PubChem (CID 259381))."
    }
  },
  {
    "nokkel": "norfluoksetin",
    "navn": "Norfluoksetin",
    "engelsk": "norfluoxetine",
    "stoffer": [
      {
        "stoff": "fluoksetin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4541,
      "inchikey": "WIQRCHMSJFFONW-UHFFFAOYSA-N",
      "formel": "C16H16F3NO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «norfluoxetine»; samme InChIKey hos ChEBI (CHEBI:180876)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "798",
      "navn": "Norfluoksetin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Norfluoksetin», ID 798); CAS-nummeret 83891-03-6 er også PubChems (PubChem (CID 4541))."
    }
  },
  {
    "nokkel": "norketamin",
    "navn": "Norketamin",
    "engelsk": "norketamine",
    "stoffer": [
      {
        "stoff": "ketamin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 123767,
      "inchikey": "BEQZHFIKTBVCAU-UHFFFAOYSA-N",
      "formel": "C12H14ClNO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «norketamine»; samme InChIKey hos ClinPGx (PA166364981, CID 123767) og ChEBI (CHEBI:91519)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "3245",
      "navn": "Norketamin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Norketamin», ID 3245); CAS-nummeret 35211-10-0 er også PubChems, og molekylvekten 223,7 g/mol stemmer med PubChem (CID 123767) (223,7)."
    }
  },
  {
    "nokkel": "norklozapin",
    "navn": "Norklozapin (N-desmetylklozapin)",
    "engelsk": "norclozapine",
    "synonymer": [
      "N-desmethylclozapine"
    ],
    "fpnavn": [
      "Desmetylklozapin"
    ],
    "stoffer": [
      {
        "stoff": "klozapin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 135409468,
      "inchikey": "JNNOSTQEZICQQP-UHFFFAOYSA-N",
      "formel": "C17H17ClN4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «norclozapine»; samme InChIKey hos ChEBI (CHEBI:64050)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "805",
      "navn": "Desmetylklozapin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Desmetylklozapin», ID 805); CAS-nummeret 6104-71-8 er også PubChems (PubChem (CID 135409468))."
    }
  },
  {
    "nokkel": "norkvetiapin",
    "navn": "Norkvetiapin",
    "engelsk": "norquetiapine",
    "fpnavn": [
      "N-desalkylkvetiapin"
    ],
    "stoffer": [
      {
        "stoff": "kvetiapin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 11369918,
      "inchikey": "JLOAJISUHPIQOX-UHFFFAOYSA-N",
      "formel": "C17H17N3S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «norquetiapine»; samme InChIKey hos ChEBI (CHEBI:188278)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1305",
      "navn": "N-desalkylkvetiapin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («N-desalkylkvetiapin», ID 1305); CAS-nummeret 5747-48-8 er også PubChems (PubChem (CID 11369918))."
    }
  },
  {
    "nokkel": "noroksykodon",
    "navn": "Noroksykodon",
    "engelsk": "noroxycodone",
    "stoffer": [
      {
        "stoff": "oksykodon",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5489120,
      "inchikey": "RIKMCJUNPCRFMW-ISWURRPUSA-N",
      "formel": "C17H19NO4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «noroxycodone»; samme InChIKey hos ClinPGx (PA166131342, CID 5489120) og ChEBI (CHEBI:168092)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "3225",
      "navn": "Noroksykodon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Noroksykodon», ID 3225); CAS-nummeret 57664-96-7 er også PubChems (PubChem (CID 5489120))."
    }
  },
  {
    "nokkel": "nortriptylin",
    "navn": "Nortriptylin",
    "engelsk": "nortriptyline",
    "stoffer": [
      {
        "stoff": "nortriptylin",
        "relasjon": "selve_stoffet"
      },
      {
        "stoff": "amitriptylin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4543,
      "inchikey": "PHVGLTMQBUFIQQ-UHFFFAOYSA-N",
      "formel": "C19H21N",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «nortriptyline»; samme InChIKey hos ClinPGx (PA450657, CID 4543) og ChEBI (CHEBI:7640)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "675",
      "navn": "Nortriptylin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Nortriptylin», ID 675); CAS-nummeret 72-69-5 er også PubChems, og molekylvekten 263,38 g/mol stemmer med PubChem (CID 4543) (263,4)."
    }
  },
  {
    "nokkel": "o-desmetyltramadol",
    "navn": "O-desmetyltramadol",
    "engelsk": "O-desmethyltramadol",
    "stoffer": [
      {
        "stoff": "tramadol",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 9838803,
      "inchikey": "UWJUQVWARXYRCG-HIFRSBDPSA-N",
      "formel": "C15H23NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «O-desmethyltramadol»; samme InChIKey hos ChEBI (CHEBI:165221)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "765",
      "navn": "O-desmetyltramadol (ODMT)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («O-desmetyltramadol (ODMT)», ID 765); CAS-nummeret 73986-53-5 er i PubChem CID 130829 («3-(2-((Dimethylamino)methyl)-1-hydroxycyclohexyl)phenol»), samme forbindelse som PubChem (CID 9838803) uten hensyn til stereokjemien (InChIKey-skjelett UWJUQVWARXYRCG)."
    }
  },
  {
    "nokkel": "o-desmetylvenlafaksin",
    "navn": "O-desmetylvenlafaksin",
    "engelsk": "desvenlafaxine",
    "stoffer": [
      {
        "stoff": "venlafaksin",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 125017,
      "inchikey": "KYYIDSXMWOZKMP-UHFFFAOYSA-N",
      "formel": "C16H25NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «desvenlafaxine»; samme InChIKey hos ClinPGx (PA165958374, CID 125017)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "803",
      "navn": "O-desmetylvenlafaksin (ODMV)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («O-desmetylvenlafaksin (ODMV)», ID 803); CAS-nummeret 93413-62-8 er også PubChems (PubChem (CID 125017))."
    }
  },
  {
    "nokkel": "oksazepam",
    "navn": "Oksazepam",
    "engelsk": "oxazepam",
    "stoffer": [
      {
        "stoff": "oksazepam",
        "relasjon": "selve_stoffet"
      },
      {
        "stoff": "diazepam",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4616,
      "inchikey": "ADIMAYPTOBDMTL-UHFFFAOYSA-N",
      "formel": "C15H11ClN2O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «oxazepam»; samme InChIKey hos ClinPGx (PA450731, CID 4616) og ChEBI (CHEBI:7823)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "676",
      "navn": "Oksazepam",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Oksazepam», ID 676); CAS-nummeret 604-75-1 er også PubChems (PubChem (CID 4616))."
    }
  },
  {
    "nokkel": "okskarbazepin",
    "navn": "Okskarbazepin",
    "engelsk": "oxcarbazepine",
    "stoffer": [
      {
        "stoff": "okskarbazepin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 34312,
      "inchikey": "CTRLABGOLIVAIY-UHFFFAOYSA-N",
      "formel": "C15H12N2O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «oxcarbazepine»; samme InChIKey hos ClinPGx (PA450732, CID 34312) og ChEBI (CHEBI:7824)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "677",
      "navn": "Okskarbazepin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Okskarbazepin», ID 677); CAS-nummeret 28721-07-5 er også PubChems (PubChem (CID 34312))."
    }
  },
  {
    "nokkel": "oksykodon",
    "navn": "Oksykodon",
    "engelsk": "oxycodone",
    "stoffer": [
      {
        "stoff": "oksykodon",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5284603,
      "inchikey": "BRUQQQPBMZOVGD-XFKAJCMBSA-N",
      "formel": "C18H21NO4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «oxycodone»; samme InChIKey hos ClinPGx (PA450741, CID 5284603) og ChEBI (CHEBI:7852)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "678",
      "navn": "Oksykodon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Oksykodon», ID 678); CAS-nummeret 76-42-6 er også PubChems, og molekylvekten 315,36 g/mol stemmer med PubChem (CID 5284603) (315,4)."
    }
  },
  {
    "nokkel": "oksymorfon",
    "navn": "Oksymorfon",
    "engelsk": "oxymorphone",
    "stoffer": [
      {
        "stoff": "oksykodon",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5284604,
      "inchikey": "UQCNKQCJZOAFTQ-ISWURRPUSA-N",
      "formel": "C17H19NO4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «oxymorphone»; samme InChIKey hos ClinPGx (PA450748, CID 5284604) og ChEBI (CHEBI:7865)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1380",
      "navn": "Oksymorfon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Oksymorfon», ID 1380); CAS-nummeret 76-41-5 er også PubChems (PubChem (CID 5284604))."
    }
  },
  {
    "nokkel": "olanzapin",
    "navn": "Olanzapin",
    "engelsk": "olanzapine",
    "stoffer": [
      {
        "stoff": "olanzapin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 135398745,
      "inchikey": "KVWDHTXUZHCGIO-UHFFFAOYSA-N",
      "formel": "C17H20N4S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «olanzapine»; samme InChIKey hos ChEBI (CHEBI:7735)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "679",
      "navn": "Olanzapin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Olanzapin», ID 679); CAS-nummeret 132539-06-1 er også PubChems, og molekylvekten 312,44 g/mol stemmer med PubChem (CID 135398745) (312,4)."
    }
  },
  {
    "nokkel": "paliperidon",
    "navn": "Paliperidon (9-hydroksyrisperidon)",
    "engelsk": "paliperidone",
    "stoffer": [
      {
        "stoff": "paliperidon",
        "relasjon": "selve_stoffet"
      },
      {
        "stoff": "risperidon",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 115237,
      "inchikey": "PMXMIIMHBWHSKN-UHFFFAOYSA-N",
      "formel": "C23H27FN4O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «paliperidone»; samme InChIKey hos ClinPGx (PA163518919, CID 115237)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "681",
      "navn": "Paliperidon (hydroksyrisperidon)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Paliperidon (hydroksyrisperidon)», ID 681); CAS-nummeret 144598-75-4 er også PubChems, og molekylvekten 426,48 g/mol stemmer med PubChem (CID 115237) (426,5)."
    }
  },
  {
    "nokkel": "paroksetin",
    "navn": "Paroksetin",
    "engelsk": "paroxetine",
    "stoffer": [
      {
        "stoff": "paroksetin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 43815,
      "inchikey": "AHOUBRCZNHFOSL-YOEHRIQHSA-N",
      "formel": "C19H20FNO3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «paroxetine»; samme InChIKey hos ClinPGx (PA450801, CID 43815) og ChEBI (CHEBI:7936)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "685",
      "navn": "Paroksetin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Paroksetin», ID 685); CAS-nummeret 61869-08-7 er også PubChems, og molekylvekten 329,3 g/mol stemmer med PubChem (CID 43815) (329,4)."
    }
  },
  {
    "nokkel": "perfenazin",
    "navn": "Perfenazin",
    "engelsk": "perphenazine",
    "stoffer": [
      {
        "stoff": "perfenazin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4748,
      "inchikey": "RGCVKNLCSQQDEP-UHFFFAOYSA-N",
      "formel": "C21H26ClN3OS",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «perphenazine»; samme InChIKey hos ClinPGx (PA450882, CID 4748) og ChEBI (CHEBI:8028)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "688",
      "navn": "Perfenazin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Perfenazin», ID 688); CAS-nummeret 58-39-9 er også PubChems, og molekylvekten 403,97 g/mol stemmer med PubChem (CID 4748) (404)."
    }
  },
  {
    "nokkel": "petidin",
    "navn": "Petidin",
    "engelsk": "pethidine",
    "stoffer": [
      {
        "stoff": "petidin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 4058,
      "inchikey": "XADCESSVHJOZHK-UHFFFAOYSA-N",
      "formel": "C15H21NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «pethidine»; samme InChIKey hos ChEBI (CHEBI:6754)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "689",
      "navn": "Petidin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Petidin», ID 689); CAS-nummeret 57-42-1 er også PubChems, og molekylvekten 247,33 g/mol stemmer med PubChem (CID 4058) (247,33)."
    }
  },
  {
    "nokkel": "ramipril",
    "navn": "Ramipril",
    "engelsk": "ramipril",
    "stoffer": [
      {
        "stoff": "ramipril",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5362129,
      "inchikey": "HDACQVRGBOVJII-JBDAPHQKSA-N",
      "formel": "C23H32N2O5",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ramipril»; samme InChIKey hos ClinPGx (PA451223, CID 5362129) og ChEBI (CHEBI:8774)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2922",
      "navn": "Ramipril",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Ramipril», ID 2922); CAS-nummeret 87333-19-5 er også PubChems (PubChem (CID 5362129))."
    }
  },
  {
    "nokkel": "ramiprilat",
    "navn": "Ramiprilat",
    "engelsk": "ramiprilat",
    "stoffer": [
      {
        "stoff": "ramipril",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5464096,
      "inchikey": "KEDYTOTWMPBSLG-HILJTLORSA-N",
      "formel": "C21H28N2O5",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ramiprilat»; samme InChIKey hos ClinPGx (PA166345361, CID 5464096) og ChEBI (CHEBI:77363)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9137",
      "navn": "Ramiprilat",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Ramiprilat», ID 9137); CAS-nummeret 87269-97-4 er også PubChems (PubChem (CID 5464096))."
    }
  },
  {
    "nokkel": "risperidon",
    "navn": "Risperidon",
    "engelsk": "risperidone",
    "stoffer": [
      {
        "stoff": "risperidon",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5073,
      "inchikey": "RAPZEAPATHNIPO-UHFFFAOYSA-N",
      "formel": "C23H27FN4O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «risperidone»; samme InChIKey hos ClinPGx (PA451257, CID 5073) og ChEBI (CHEBI:8871)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "703",
      "navn": "Risperidon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Risperidon», ID 703); CAS-nummeret 106266-06-2 er også PubChems, og molekylvekten 410,49 g/mol stemmer med PubChem (CID 5073) (410,5)."
    }
  },
  {
    "nokkel": "ritalinsyre",
    "navn": "Ritalinsyre",
    "engelsk": "ritalinic acid",
    "stoffer": [
      {
        "stoff": "metylfenidat",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 86863,
      "inchikey": "INGSNVSERUZOAK-UHFFFAOYSA-N",
      "formel": "C13H17NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ritalinic acid»; samme InChIKey hos ClinPGx (PA166170868, CID 86863) og ChEBI (CHEBI:83481)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "774",
      "navn": "Ritalinsyre",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Ritalinsyre», ID 774); CAS-nummeret 19395-41-6 er også PubChems, og molekylvekten 219,28 g/mol stemmer med PubChem (CID 86863) (219,28)."
    }
  },
  {
    "nokkel": "sertindol",
    "navn": "Sertindol",
    "engelsk": "sertindole",
    "stoffer": [
      {
        "stoff": "sertindol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 60149,
      "inchikey": "GZKLJWGUPQBVJQ-UHFFFAOYSA-N",
      "formel": "C24H26ClFN4O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «sertindole»; samme InChIKey hos ClinPGx (PA164784002, CID 60149) og ChEBI (CHEBI:9122)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "707",
      "navn": "Sertindol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Sertindol», ID 707); CAS-nummeret 106516-24-9 er også PubChems, og molekylvekten 440,94 g/mol stemmer med PubChem (CID 60149) (440,9)."
    }
  },
  {
    "nokkel": "sertralin",
    "navn": "Sertralin",
    "engelsk": "sertraline",
    "stoffer": [
      {
        "stoff": "sertralin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 68617,
      "inchikey": "VGKDLMBJGBXTGI-SJCJKPOMSA-N",
      "formel": "C17H17Cl2N",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «sertraline»; samme InChIKey hos ClinPGx (PA451333, CID 68617) og ChEBI (CHEBI:9123)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "708",
      "navn": "Sertralin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Sertralin», ID 708); CAS-nummeret 79617-96-2 er også PubChems, og molekylvekten 306,23 g/mol stemmer med PubChem (CID 68617) (306,2)."
    }
  },
  {
    "nokkel": "spironolakton",
    "navn": "Spironolakton",
    "engelsk": "spironolactone",
    "stoffer": [
      {
        "stoff": "spironolakton",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5833,
      "inchikey": "LXMSZDCAJNLERA-ZHYRCANASA-N",
      "formel": "C24H32O4S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «spironolactone»; samme InChIKey hos ClinPGx (PA451483, CID 5833) og ChEBI (CHEBI:9241)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "9101",
      "navn": "Spironolakton",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Spironolakton», ID 9101); CAS-nummeret 52-01-7 er også PubChems (PubChem (CID 5833))."
    }
  },
  {
    "nokkel": "tapentadol",
    "navn": "Tapentadol",
    "engelsk": "tapentadol",
    "stoffer": [
      {
        "stoff": "tapentadol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 9838022,
      "inchikey": "KWTWDQCKEHXFFR-SMDDNHRTSA-N",
      "formel": "C14H23NO",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «tapentadol»; samme InChIKey hos ClinPGx (PA166179720, CID 9838022) og ChEBI (CHEBI:135935)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "2228",
      "navn": "Tapentadol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Tapentadol», ID 2228); CAS-nummeret 175591-23-8 er også PubChems (PubChem (CID 9838022))."
    }
  },
  {
    "nokkel": "telmisartan",
    "navn": "Telmisartan",
    "engelsk": "telmisartan",
    "stoffer": [
      {
        "stoff": "telmisartan",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 65999,
      "inchikey": "RMMXLENWKUUMAY-UHFFFAOYSA-N",
      "formel": "C33H30N4O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «telmisartan»; samme InChIKey hos ClinPGx (PA451605, CID 65999) og ChEBI (CHEBI:9434)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1347",
      "navn": "Telmisartan",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Telmisartan», ID 1347); CAS-nummeret 144701-48-4 er også PubChems, og molekylvekten 514,62 g/mol stemmer med PubChem (CID 65999) (514,6)."
    }
  },
  {
    "nokkel": "thc",
    "navn": "THC (delta-9-tetrahydrokannabinol)",
    "engelsk": "dronabinol",
    "stoffer": [
      {
        "stoff": "thc",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 16078,
      "inchikey": "CYQFCXCEBYINGO-IAGOWNOFSA-N",
      "formel": "C21H30O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «dronabinol»; samme InChIKey hos ClinPGx (PA449421, CID 16078)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "742",
      "navn": "Tetrahydrocannabinol (THC)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Tetrahydrocannabinol (THC)», ID 742); CAS-nummeret 1972-08-3 er også PubChems (PubChem (CID 16078))."
    }
  },
  {
    "nokkel": "thc-cooh",
    "navn": "THC-syre (THC-COOH)",
    "engelsk": "11-nor-9-carboxy-delta9-tetrahydrocannabinol",
    "stoffer": [
      {
        "stoff": "thc",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 108207,
      "inchikey": "YOVRGSHRZRJTLZ-HZPDHXFCSA-N",
      "formel": "C21H28O4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «11-nor-9-carboxy-delta9-tetrahydrocannabinol»; samme InChIKey hos ChEBI (CHEBI:77273)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "744",
      "navn": "Tetrahydrocannabinolsyre (THC-COOH)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Tetrahydrocannabinolsyre (THC-COOH)», ID 744); CAS-nummeret 64280-14-4 er i PubChem CID 107885 («11-Nor-delta(9)-tetrahydrocannabinol-9-carboxylic acid»), samme forbindelse som PubChem (CID 108207) uten hensyn til stereokjemien (InChIKey-skjelett YOVRGSHRZRJTLZ)."
    }
  },
  {
    "nokkel": "thc-oh",
    "navn": "11-hydroksy-THC",
    "engelsk": "11-hydroxy-delta9-tetrahydrocannabinol",
    "fpnavn": [
      "Hydroksytetrahydrocannabinol"
    ],
    "stoffer": [
      {
        "stoff": "thc",
        "relasjon": "metabolitt"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 644022,
      "inchikey": "YCBKSSAWEUDACY-IAGOWNOFSA-N",
      "formel": "C21H30O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «11-hydroxy-delta9-tetrahydrocannabinol»; samme InChIKey hos ChEBI (CHEBI:77270)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "743",
      "navn": "Hydroksytetrahydrocannabinol (OH-THC)",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Hydroksytetrahydrocannabinol (OH-THC)», ID 743); CAS-nummeret 36557-05-8 er også PubChems (PubChem (CID 644022))."
    }
  },
  {
    "nokkel": "topiramat",
    "navn": "Topiramat",
    "engelsk": "topiramate",
    "stoffer": [
      {
        "stoff": "topiramat",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5284627,
      "inchikey": "KJADKKWYZYXHBB-XBWDGYHZSA-N",
      "formel": "C12H21NO8S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «topiramate»; samme InChIKey hos ClinPGx (PA451728, CID 5284627) og ChEBI (CHEBI:63631)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "717",
      "navn": "Topiramat",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Topiramat», ID 717); CAS-nummeret 97240-79-4 er også PubChems, og molekylvekten 339,36 g/mol stemmer med PubChem (CID 5284627) (339,36)."
    }
  },
  {
    "nokkel": "tramadol",
    "navn": "Tramadol",
    "engelsk": "tramadol",
    "stoffer": [
      {
        "stoff": "tramadol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 33741,
      "inchikey": "TVYLLZQTGLZFBW-ZBFHGGJFSA-N",
      "formel": "C16H25NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «tramadol»; samme InChIKey hos ClinPGx (PA451735, CID 33741)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "718",
      "navn": "Tramadol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Tramadol», ID 718); CAS-nummeret 27203-92-5 er også PubChems, og molekylvekten 263,4 g/mol stemmer med PubChem (CID 33741) (263,37)."
    }
  },
  {
    "nokkel": "trimipramin",
    "navn": "Trimipramin",
    "engelsk": "trimipramine",
    "stoffer": [
      {
        "stoff": "trimipramin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5584,
      "inchikey": "ZSCDBOWYZJWBIY-UHFFFAOYSA-N",
      "formel": "C20H26N2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «trimipramine»; samme InChIKey hos ClinPGx (PA451791, CID 5584) og ChEBI (CHEBI:9738)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "721",
      "navn": "Trimipramin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Trimipramin», ID 721); CAS-nummeret 739-71-9 er også PubChems, og molekylvekten 294,43 g/mol stemmer med PubChem (CID 5584) (294,4)."
    }
  },
  {
    "nokkel": "valproat",
    "navn": "Valproinsyre",
    "engelsk": "valproic acid",
    "stoffer": [
      {
        "stoff": "valproat",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "merknad": "Laboratoriene måler valproinsyre, også når legemiddelet er natriumvalproat.",
    "pubchem": {
      "cid": 3121,
      "inchikey": "NIJJYAXOARWZEE-UHFFFAOYSA-N",
      "formel": "C8H16O2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «valproic acid»; samme InChIKey hos ClinPGx (PA451846, CID 3121) og ChEBI (CHEBI:39867)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "724",
      "navn": "Valproat",
      "kontrollert": "2026-10-08",
      "grunnlag": "Komponenten i Farmakologiportalen med nøyaktig navnet («Valproat», ID 724; ellers «Valproat (bundet)», «Valproat (fritt)»); CAS-nummeret 99-66-1 er også PubChems, og molekylvekten 144,21 g/mol stemmer med PubChem (CID 3121) (144,21)."
    }
  },
  {
    "nokkel": "valsartan",
    "navn": "Valsartan",
    "engelsk": "valsartan",
    "stoffer": [
      {
        "stoff": "valsartan",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 60846,
      "inchikey": "ACWBQPMHZXGDFX-QFIPXVFZSA-N",
      "formel": "C24H29N5O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «valsartan»; samme InChIKey hos ClinPGx (PA451848, CID 60846) og ChEBI (CHEBI:9927)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1348",
      "navn": "Valsartan",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Valsartan», ID 1348); CAS-nummeret 137862-53-4 er også PubChems, og molekylvekten 435,52 g/mol stemmer med PubChem (CID 60846) (435,5)."
    }
  },
  {
    "nokkel": "venlafaksin",
    "navn": "Venlafaksin",
    "engelsk": "venlafaxine",
    "stoffer": [
      {
        "stoff": "venlafaksin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5656,
      "inchikey": "PNVNVHUZROJLTJ-UHFFFAOYSA-N",
      "formel": "C17H27NO2",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «venlafaxine»; samme InChIKey hos ClinPGx (PA451866, CID 5656) og ChEBI (CHEBI:9943)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "726",
      "navn": "Venlafaksin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Venlafaksin», ID 726); CAS-nummeret 93413-69-5 er også PubChems, og molekylvekten 277,4 g/mol stemmer med PubChem (CID 5656) (277,4)."
    }
  },
  {
    "nokkel": "verapamil",
    "navn": "Verapamil",
    "engelsk": "verapamil",
    "stoffer": [
      {
        "stoff": "verapamil",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 2520,
      "inchikey": "SGTNSNPWRIOYBX-UHFFFAOYSA-N",
      "formel": "C27H38N2O4",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «verapamil»; samme InChIKey hos ClinPGx (PA451868, CID 2520)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "1349",
      "navn": "Verapamil",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Verapamil», ID 1349); CAS-nummeret 52-53-9 er også PubChems, og molekylvekten 454,6 g/mol stemmer med PubChem (CID 2520) (454,6)."
    }
  },
  {
    "nokkel": "vortioksetin",
    "navn": "Vortioksetin",
    "engelsk": "vortioxetine",
    "stoffer": [
      {
        "stoff": "vortioksetin",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 9966051,
      "inchikey": "YQNWZWMKLDQSAC-UHFFFAOYSA-N",
      "formel": "C18H22N2S",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «vortioxetine»; samme InChIKey hos ClinPGx (PA166122595, CID 9966051) og ChEBI (CHEBI:76016)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "3212",
      "navn": "Vortioksetin",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Vortioksetin», ID 3212); CAS-nummeret 508233-74-7 er også PubChems, og molekylvekten 298,45 g/mol stemmer med PubChem (CID 9966051) (298,4)."
    }
  },
  {
    "nokkel": "ziprasidon",
    "navn": "Ziprasidon",
    "engelsk": "ziprasidone",
    "stoffer": [
      {
        "stoff": "ziprasidon",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 60854,
      "inchikey": "MVWVFYHBGMAFLY-UHFFFAOYSA-N",
      "formel": "C21H21ClN4OS",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «ziprasidone»; samme InChIKey hos ClinPGx (PA451974, CID 60854) og ChEBI (CHEBI:10119)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "731",
      "navn": "Ziprasidon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Ziprasidon», ID 731); CAS-nummeret 146939-27-7 er også PubChems, og molekylvekten 412,94 g/mol stemmer med PubChem (CID 60854) (412,9)."
    }
  },
  {
    "nokkel": "zolpidem",
    "navn": "Zolpidem",
    "engelsk": "zolpidem",
    "stoffer": [
      {
        "stoff": "zolpidem",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5732,
      "inchikey": "ZAFYATHCZYHLPB-UHFFFAOYSA-N",
      "formel": "C19H21N3O",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «zolpidem»; samme InChIKey hos ClinPGx (PA451976, CID 5732) og ChEBI (CHEBI:10125)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "734",
      "navn": "Zolpidem",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Zolpidem», ID 734); CAS-nummeret 82626-48-0 er også PubChems (PubChem (CID 5732))."
    }
  },
  {
    "nokkel": "zopiklon",
    "navn": "Zopiklon",
    "engelsk": "zopiclone",
    "stoffer": [
      {
        "stoff": "zopiklon",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5735,
      "inchikey": "GBBSUAFBMRNDJC-UHFFFAOYSA-N",
      "formel": "C17H17ClN6O3",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «zopiclone»; samme InChIKey hos ClinPGx (PA10236, CID 5735) og ChEBI (CHEBI:32315)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "733",
      "navn": "Zopiklon",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Zopiklon», ID 733); CAS-nummeret 43200-80-2 er også PubChems (PubChem (CID 5735))."
    }
  },
  {
    "nokkel": "zuklopentiksol",
    "navn": "Zuklopentiksol",
    "engelsk": "zuclopenthixol",
    "stoffer": [
      {
        "stoff": "zuklopentiksol",
        "relasjon": "selve_stoffet"
      }
    ],
    "form": "fri",
    "pubchem": {
      "cid": 5311507,
      "inchikey": "WFPIAZLQTJBIFN-DVZOWYKESA-N",
      "formel": "C22H25ClN2OS",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste treff i PubChem for «zuclopenthixol»; samme InChIKey hos ClinPGx (PA452629, CID 5311507) og ChEBI (CHEBI:51364)."
    },
    "farmakologiportalen": {
      "status": "verifisert",
      "id": "735",
      "navn": "Zuklopentiksol",
      "kontrollert": "2026-10-08",
      "grunnlag": "Eneste komponent i Farmakologiportalen med navnet («Zuklopentiksol», ID 735); CAS-nummeret 53772-83-1 er også PubChems, og molekylvekten 400,97 g/mol stemmer med PubChem (CID 5311507) (401)."
    }
  }
]
