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
    }
  },
  {
    "nokkel": "hydroksykarbazepin",
    "navn": "10-hydroksykarbazepin (MHD)",
    "engelsk": "licarbazepine",
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
    }
  },
  {
    "nokkel": "norklozapin",
    "navn": "Norklozapin (N-desmetylklozapin)",
    "engelsk": "norclozapine",
    "synonymer": [
      "N-desmethylclozapine"
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
    }
  },
  {
    "nokkel": "norkvetiapin",
    "navn": "Norkvetiapin",
    "engelsk": "norquetiapine",
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
    }
  },
  {
    "nokkel": "thc-oh",
    "navn": "11-hydroksy-THC",
    "engelsk": "11-hydroxy-delta9-tetrahydrocannabinol",
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
    }
  }
]
