#!/usr/bin/env python3
"""Bygg src/data/antihypertensiver.json fra originaldata/AHT.docx.

Kjor:  python3 scripts/build_antihypertensiver.py

Kilden er en tabell i Word-dokumentet med tre rader per analytt:

    Enalaprilat  | Under nedre teknisk maleomrade | <kommentar>
    ENAT         | < 1 nmol/L   L   1-9 nmol/L    |
    Enalaprilat  | Terapiomradet                  | <kommentar>
    ENAT         | 10-300 nmol/L  H  301-1199 nmol/L |
    Enalaprilat  | Toksisk konsentrasjon          | <kommentar>
    ENAT         | >= 1200 nmol/L                 |

Antihypertensiver kommenteres med de samme tre konsentrasjonsbandene som
psykofarmaka, sa de fem intervallene i kilden slas sammen til tre:

    under      = "under nedre teknisk maleomrade" + L
    innenfor   = terapiomradet + H
    over       = toksisk konsentrasjon

Bumetanid og furosemid har verken L eller H. De har "Innenfor" i stedet for
"Terapiomradet", og far derfor ingen terapiomradepille.

Kategorien har ingen ringegrense, og kilden oppgir ikke noe ovre maleomrade.

Grensene og kommentarene er ikke lenger en del av datasettet: de ble importert
til regelsettene i Supabase (se docs/fortolkningsregler.md), og det er dem
fortolkningen bruker. Skriptet leser og kontrollerer dem fortsatt, sa
rettelsene og avvikene i meta viser hvordan de importerte reglene kom fra
kilden. Datasettet har bare det analyttkortet og informasjonssidene viser.

Alle rettelser skriptet gjor er samlet i RETTELSER og havner i
meta.rettelser i JSON-filen, slik at de kan etterproves mot dokumentet.
Uoverensstemmelser som ikke lar seg rette maskinelt havner i meta.avvik.
"""
from __future__ import annotations

import json
import re
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree

ROT = Path(__file__).resolve().parent.parent
DOKUMENT = ROT / "originaldata" / "AHT.docx"
UT = ROT / "src" / "data" / "antihypertensiver.json"
ALIAS_FIL = ROT / "src" / "data" / "aliaser.json"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

GRUPPE = "Antihypertensiver"
STANDARD_ENHET = "nmol/L"

# Analysemetoden analyttene rekvireres under. Koden vises som pille i
# kommenteringsmodulen og er det sidemenyen grupperer etter.
ANALYSEMETODE = "AHT"

# Legemiddelgruppen hver analytt horer til.
#
# AHT.docx har ingen slik inndeling. Tabellen er delt inn en gang, av
# klinikeren, ved a lese virkestoffnavnenes suffikser: -pril(at) er
# ACE-hemmere, -renon aldosteronantagonister, -ilol og -alol alfa- og
# betablokkere, doksazosin alfablokker, -sartan ARB, -olol betablokkere, -id
# diuretika, og resten kalsiumantagonister. Klinikeren presiserte at
# suffiksene var en engangsnokkel og ikke en regel som skal gjelde videre, sa
# resultatet star her som en oppslagsliste og utledes ikke av navnet. Et nytt
# virkestoff ma fores inn manuelt; skriptet stopper hvis noen mangler.
#
# Losartansyre er verdt a merke seg: den ender pa -syre og ikke pa -sartan,
# men er den virksomme metabolitten av losartan og fort som ARB.
KATEGORI = {
    "ENAT": "ACE-hemmere",
    "LISI": "ACE-hemmere",
    "RAMAT": "ACE-hemmere",
    "EPLR": "Aldosteronantagonister",
    "KANR": "Aldosteronantagonister",
    "KARV": "Alfa- og betablokkere",
    "LABE": "Alfa- og betablokkere",
    "DOKSA": "Alfablokkere",
    "IRBE": "ARB",
    "KAND": "ARB",
    "LOSYR": "ARB",
    "TELM": "ARB",
    "VALS": "ARB",
    "ATEN": "Betablokkere",
    "BISO": "Betablokkere",
    "METOP": "Betablokkere",
    "BEND": "Diuretika",
    "BUME": "Diuretika",
    "FURO": "Diuretika",
    "HYDR": "Diuretika",
    "AMLO": "Kalsiumantagonister",
    "DIL": "Kalsiumantagonister",
    "LERK": "Kalsiumantagonister",
    "NIFE": "Kalsiumantagonister",
    "VER": "Kalsiumantagonister",
}
NIVAER = ("under", "innenfor", "over")
TANKESTREK = "–"

# Overskriftene de tre radene til en analytt star med, i rekkefolge.
UNDER = "Under nedre teknisk måleområde"
TOKSISK = "Toksisk konsentrasjon"
# Terapiomradet heter "Innenfor" for de to analyttene som ikke har noe
# definert terapiomrade.
INNENFOR = ("Terapiområdet", "Innenfor")

RETTELSER: list[dict] = []
AVVIK: list[dict] = []

# Kommentarer overstyrt etter eksplisitt instruks fra klinikeren (peder.holman),
# fordi de avvek fra tilsvarende kommentar hos en annen analytt i kilden.
# Noekkel: (kode, niva). Overstyringen logges som en rettelse med kilden og
# den nye teksten, slik alle andre rettelser gjor.
KLINIKERRETTELSER: dict[tuple[str, str], str] = {
    ("FURO", "innenfor"): (
        "Furosemid kan påvises 1–6 timer etter inntak. Analysesvaret må alltid ses i "
        "sammenheng med klinikk. Ved spørsmål kan rekvirent kontakte vakthavende lege "
        "ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no)."
    ),
}


def logg(kategori: str, hvor: str, fra: str, til: str, begrunnelse: str) -> None:
    RETTELSER.append({
        "kategori": kategori, "hvor": hvor,
        "fra": fra, "til": til, "begrunnelse": begrunnelse,
    })


def avvik(kode: str, type_: str, beskrivelse: str) -> None:
    AVVIK.append({"kode": kode, "type": type_, "beskrivelse": beskrivelse})


# --------------------------------------------------------------------------
# Uttrekk fra Word-dokumentet
# --------------------------------------------------------------------------

def celletekst(celle: ElementTree.Element) -> str:
    """Teksten i en tabellcelle, med avsnitt og linjeskift som «\\n»."""
    avsnitt = []
    for p in celle.findall(W + "p"):
        biter = []
        for node in p.iter():
            if node.tag == W + "t":
                biter.append(node.text or "")
            elif node.tag in (W + "br", W + "cr"):
                biter.append("\n")
            elif node.tag == W + "tab":
                biter.append(" ")
        avsnitt.append("".join(biter))
    return "\n".join(avsnitt)


def les_tabell() -> list[list[str]]:
    """Radene i dokumentets ene tabell, med tre celler hver."""
    with zipfile.ZipFile(DOKUMENT) as arkiv:
        rot = ElementTree.fromstring(arkiv.read("word/document.xml"))

    tabeller = rot.findall(".//" + W + "tbl")
    if len(tabeller) != 1:
        raise SystemExit(f"Forventet en tabell i {DOKUMENT.name}, fant {len(tabeller)}")

    rader = []
    for rad in tabeller[0].findall(W + "tr"):
        celler = [celletekst(c) for c in rad.findall(W + "tc")]
        if len(celler) != 3:
            raise SystemExit(f"Forventet tre kolonner, fant {len(celler)}: {celler!r}")
        rader.append(celler)
    return rader


# --------------------------------------------------------------------------
# Normalisering av tekst
# --------------------------------------------------------------------------

def linjer(tekst: str) -> list[str]:
    """Cellen delt i linjer, uten harde mellomrom og tomme linjer."""
    ut = []
    for linje in unicodedata.normalize("NFC", tekst).replace("\xa0", " ").split("\n"):
        renset = re.sub(r"\s+", " ", linje).strip()
        if renset:
            ut.append(renset)
    return ut


def rett_desimaltegn(tekst: str, hvor: str) -> str:
    """Punktum mellom to siffer er et desimaltegn og skal vaere komma."""
    def bytt(m: re.Match) -> str:
        ny = m.group(0).replace(".", ",")
        logg("desimaltegn", hvor, m.group(0), ny, "punktum brukt som desimaltegn")
        return ny

    return re.sub(r"\d+\.\d+", bytt, tekst)


def rett_streker(tekst: str, hvor: str) -> str:
    """Bindestrek mellom to tall er et intervall og skal vaere tankestrek."""
    def bytt(m: re.Match) -> str:
        ny = m.group(0).replace(m.group(1), TANKESTREK)
        logg("tankestrek", hvor, m.group(0), ny, "bindestrek brukt om tallintervall")
        return ny

    return re.sub(r"[\d,]+(\s*-\s*)\d+", bytt, tekst)


def rett_ordlyd(tekst: str, hvor: str) -> str:
    """«basert pa bruk 5-40 mg» mangler «av», slik de 60 andre radene har det."""
    ny = re.sub(r"basert på bruk (?!av )(?=[\d½])", "basert på bruk av ", tekst)
    if ny != tekst:
        logg("ordlyd", hvor, "basert på bruk", "basert på bruk av",
             "preposisjonen manglet; kilden har «basert på bruk av» ellers")
    return ny


def rett_setningsrekkefolge(tekst: str, hvor: str) -> str:
    """Metabolittsetningen skal sta etter begge sporsmalene, som ellers i kilden.

    Hos enalaprilat, ramiprilat og losartansyre star «X er den aktive
    metabolitten av Y.» etter bade «Mangelfull medikamentetterlevelse?» og
    «Farmakokinetiske avvik?». Kanrenon har den mellom de to sporsmalene.
    """
    m = re.search(
        r"Mangelfull medikamentetterlevelse\?\s+(?P<setning>\S.*?\.)\s*"
        r"Farmakokinetiske avvik\?",
        tekst,
    )
    if not m:
        return tekst
    gammel = m.group(0)
    ny = f"Mangelfull medikamentetterlevelse? Farmakokinetiske avvik? {m.group('setning')}"
    logg("setningsrekkefolge", hvor, gammel, ny,
         "metabolittsetningen sto mellom de to spørsmålene; kilden har den ellers "
         "stående etter begge")
    return tekst.replace(gammel, ny, 1)


def vask_kommentar(tekst: str, hvor: str) -> str:
    """En kommentar pa en linje, uten doble mellomrom og med norsk tegnsetting."""
    ren = unicodedata.normalize("NFC", tekst).replace("\xa0", " ")

    funn = []
    if "\n" in ren.strip():
        funn.append("linjeskift")
    if re.search(r"\S  +\S", ren):
        funn.append("dobbelt mellomrom")
    if "\xa0" in tekst:
        funn.append("hardt mellomrom")
    if ren != ren.strip():
        funn.append("mellomrom i enden")
    if funn:
        logg("mellomrom", hvor, ", ".join(funn), "vanlige enkle mellomrom",
             "kommentaren var ikke en sammenhengende linje med enkle mellomrom")

    ren = re.sub(r"\s+", " ", ren).strip()
    ren = re.sub(r"\s+([,.;:?])", r"\1", ren)
    ren = rett_desimaltegn(ren, hvor)
    ren = rett_streker(ren, hvor)
    ren = rett_ordlyd(ren, hvor)
    ren = rett_setningsrekkefolge(ren, hvor)
    return ren


# --------------------------------------------------------------------------
# Tallparsing
# --------------------------------------------------------------------------

def tall(tekst: str) -> float | int | None:
    renset = tekst.strip().replace(",", ".")
    try:
        verdi = float(renset)
    except ValueError:
        return None
    return int(verdi) if verdi == int(verdi) else verdi


def formater(verdi: float | None) -> str:
    if verdi is None:
        return ""
    if verdi == int(verdi):
        return str(int(verdi))
    return f"{verdi:g}".replace(".", ",")


def desimaler(*verdier: float | None) -> int:
    """Antall desimaler det fineste av tallene har."""
    return max((len(str(v).split(".")[1]) if isinstance(v, float) else 0)
               for v in verdier if v is not None)


def les_intervall(tekst: str, hvor: str) -> dict:
    """Tolk «< 1 nmol/L», «1–9 nmol/L», «≥ 1200 nmol/L» og «0.1 nmol/L»."""
    renset = tekst.strip()
    m = re.fullmatch(r"(.*?)\s*(nmol/L|µmol/L|umol/L)", renset)
    if not m:
        raise SystemExit(f"{hvor}: mangler enhet i «{tekst}»")
    verdi, enhet = m.group(1).strip(), m.group(2)
    if enhet != STANDARD_ENHET:
        raise SystemExit(f"{hvor}: uventet enhet «{enhet}»")

    m = re.fullmatch(r"[<≤]\s*([\d,.]+)", verdi)
    if m:
        return {"fra": None, "til": tall(m.group(1))}
    m = re.fullmatch(r"[>≥]\s*([\d,.]+)", verdi)
    if m:
        return {"fra": tall(m.group(1)), "til": None}
    m = re.fullmatch(r"([\d,.]+)\s*[-–—]\s*([\d,.]+)", verdi)
    if m:
        return {"fra": tall(m.group(1)), "til": tall(m.group(2))}
    if tall(verdi) is not None:
        # Ett tall alene er et intervall pa en eneste verdi (lerkanidipin: «L 0.1»).
        return {"fra": tall(verdi), "til": tall(verdi)}
    raise SystemExit(f"{hvor}: klarte ikke tolke intervallet «{tekst}»")


def intervalltekst(fra: float | None, til: float | None) -> str:
    if fra is None and til is not None:
        return f"< {formater(til)}"
    if til is None and fra is not None:
        return f"≥ {formater(fra)}"
    if fra is not None and til is not None:
        return formater(fra) if fra == til else f"{formater(fra)} {TANKESTREK} {formater(til)}"
    return ""


# --------------------------------------------------------------------------
# Sammenstilling
# --------------------------------------------------------------------------

def les_navnecelle(tekst: str, hvor: str) -> tuple[str, str]:
    deler = linjer(tekst)
    if len(deler) != 2:
        raise SystemExit(f"{hvor}: forventet navn og kode, fant {deler!r}")
    return deler[0], deler[1]


def les_bandcelle(tekst: str, hvor: str) -> tuple[str, dict, dict | None]:
    """(overskrift, hovedintervall, L- eller H-intervall).

    Cellen har enten to linjer — overskrift og intervall — eller fire, der
    de to siste er merket «L» eller «H» og intervallet som horer til.
    """
    deler = linjer(tekst)
    if len(deler) not in (2, 4):
        raise SystemExit(f"{hvor}: forventet to eller fire linjer, fant {deler!r}")

    hoved = les_intervall(deler[1], hvor)
    if len(deler) == 2:
        return deler[0], hoved, None
    if deler[2] not in ("L", "H"):
        raise SystemExit(f"{hvor}: forventet merket «L» eller «H», fant «{deler[2]}»")
    return deler[0], hoved, les_intervall(deler[3], f"{hvor}/{deler[2]}")


def sjekk_naboer(kode: str, hvor: str, nedre_slutt: float, ovre_start: float,
                 hva_nedre: str, hva_ovre: str, avgjorelse: str) -> None:
    """To intervaller som skal ligge kant i kant, malt i hele enheter.

    Kilden bruker hele tall pa alle sine egne intervallgrenser, sa naboer er
    riktige nar de star ett trinn fra hverandre. Mindre sprang enn det kommer
    av desimalene til analytten og er ikke en uoverensstemmelse i kilden.
    """
    if nedre_slutt >= ovre_start:
        avvik(kode, "overlapp",
              f"{hva_nedre} slutter på {formater(nedre_slutt)} mens {hva_ovre} starter "
              f"på {formater(ovre_start)}; området imellom dekkes av begge. {avgjorelse}")
    elif ovre_start - nedre_slutt > 1:
        avvik(kode, "hull",
              f"{hva_nedre} slutter på {formater(nedre_slutt)} mens {hva_ovre} starter "
              f"på {formater(ovre_start)}; området imellom er udefinert i kilden. "
              f"{avgjorelse}")


def bygg() -> dict:
    rader = les_tabell()
    if len(rader) % 3:
        raise SystemExit(f"Forventet tre rader per analytt, fant {len(rader)} rader")

    resultat = []
    for start in range(0, len(rader), 3):
        tre = rader[start:start + 3]
        navn, kode = les_navnecelle(tre[0][0], f"rad {start}")
        for nr, rad in enumerate(tre[1:], start=1):
            if les_navnecelle(rad[0], f"rad {start + nr}") != (navn, kode):
                raise SystemExit(f"{kode}: de tre radene har ulikt navn eller kode")

        overskrifter = []
        intervaller = []
        merker = []
        for nivanavn, rad in zip(NIVAER, tre):
            overskrift, hoved, merket = les_bandcelle(rad[1], f"{kode}/{nivanavn}")
            overskrifter.append(overskrift)
            intervaller.append(hoved)
            merker.append(merket)

        if overskrifter[0] != UNDER or overskrifter[2] != TOKSISK:
            raise SystemExit(f"{kode}: uventede overskrifter {overskrifter!r}")
        if overskrifter[1] not in INNENFOR:
            raise SystemExit(f"{kode}: uventet overskrift «{overskrifter[1]}»")

        lav, terapi, toksisk = intervaller
        L, H, _ = merker
        # Terapiomradet er «Innenfor» nar det ikke er definert, og da har
        # analytten verken L eller H.
        har_terapiomrade = overskrifter[1] == INNENFOR[0]
        if har_terapiomrade != (L is not None) or har_terapiomrade != (H is not None):
            raise SystemExit(f"{kode}: «{overskrifter[1]}» stemmer ikke med L/H-merkene")

        pavisningsgrense = lav["til"]
        if pavisningsgrense is None or toksisk["fra"] is None or terapi["fra"] is None:
            raise SystemExit(f"{kode}: klarte ikke lese grensene")

        # De tre bandene appen viser: under + L, terapiomradet + H, og toksisk.
        nedre = max(terapi["fra"], pavisningsgrense)
        ovre = toksisk["fra"]
        steg = 10 ** -desimaler(nedre, ovre)
        sammenslatt = (H or terapi)["til"]
        if sammenslatt is None:
            raise SystemExit(f"{kode}: mangler ovre grense for innenfor")
        innenfor_til = min(sammenslatt, round(ovre - steg, 6))

        fint = desimaler(pavisningsgrense, nedre, ovre, innenfor_til,
                         *(v for iv in (lav, terapi, toksisk, L, H) if iv
                           for v in iv.values()))
        if fint > desimaler(nedre, ovre):
            raise SystemExit(
                f"{kode}: kilden har finere tall enn båndgrensene; appen ville delt "
                f"tallinja grovere enn kilden gjør")

        # Uoverensstemmelser i kilden. Bandene er de samme uansett, men den
        # som leser datasettet bor kjenne dem.
        if terapi["fra"] < pavisningsgrense:
            avvik(kode, "påvisningsgrense",
                  f"{overskrifter[1]} starter på {formater(terapi['fra'])}, altså lavere "
                  f"enn påvisningsgrensen ({formater(pavisningsgrense)}). Appen lar båndet "
                  f"begynne på påvisningsgrensen.")
        if L:
            if L["fra"] != pavisningsgrense:
                avvik(kode, "påvisningsgrense",
                      f"L starter på {formater(L['fra'])} mens påvisningsgrensen er "
                      f"{formater(pavisningsgrense)}.")
            sjekk_naboer(kode, "L", L["til"], terapi["fra"], "L", overskrifter[1],
                         "Appen slår L sammen med «under måleområdet», så båndet under "
                         f"slutter rett før {formater(nedre)}.")
        if H:
            sjekk_naboer(kode, "H", terapi["til"], H["fra"], overskrifter[1], "H",
                         "Appen slår de to sammen til ett bånd, så grensen mellom dem "
                         "har ingen betydning for kommentaren.")
        sjekk_naboer(kode, "toksisk", sammenslatt, ovre, "H" if H else overskrifter[1],
                     "Toksisk konsentrasjon",
                     "Appen klassifiserer den som toksisk.")

        kommentarer = [vask_kommentar(rad[2], f"{kode}/{n}") for n, rad in zip(NIVAER, tre)]

        for i, n in enumerate(NIVAER):
            overstyrt = KLINIKERRETTELSER.get((kode, n))
            if overstyrt is None:
                continue
            logg("klinikerrettelse", f"{kode}/{n}", kommentarer[i], overstyrt,
                 "kommentaren i kilden avvek fra den tilsvarende korte formen hos en annen "
                 "analytt i samme tabell; rettet etter eksplisitt instruks fra klinikeren")
            kommentarer[i] = overstyrt

        if kommentarer[0] == kommentarer[1]:
            avvik(kode, "ordlyd",
                  "Kommentaren for «innenfor» er ordrett den samme som for «under», så "
                  "de to første knappene gir samme tekst.")

        resultat.append({
            "kode": kode,
            "navn": navn,
            "visningsnavn": navn,
            "komponenter": [navn],
            "gruppe": GRUPPE,
            "analysemetode": ANALYSEMETODE,
            # Kontrolleres mot kilden nedenfor, sa en manglende kode gir en
            # forstaelig feil i stedet for et oppslag som sprekker her.
            "kategori": KATEGORI.get(kode, ""),
            "enhet": STANDARD_ENHET,
            "referanseomrade": None,
            # Kilden oppgir bare nedre teknisk maleomrade, ikke noe tak.
            "maleomrade": {"tekst": "", "deler": []},
            "antihypertensiv": {
                "pavisningsgrense": pavisningsgrense,
                "terapiomrade": {
                    "fra": terapi["fra"],
                    "til": terapi["til"],
                    "merknad": "",
                    "tekst": intervalltekst(terapi["fra"], terapi["til"]),
                } if har_terapiomrade else None,
            },
        })

    koder = [a["kode"] for a in resultat]
    if len(set(koder)) != len(koder):
        raise SystemExit(f"Analyttkoder gar igjen: {koder}")

    ukjente = sorted(set(koder) - set(KATEGORI))
    if ukjente:
        raise SystemExit(
            f"Mangler legemiddelgruppe i KATEGORI for: {', '.join(ukjente)}. "
            "For dem inn manuelt — gruppen utledes ikke av navnet."
        )
    ubrukte = sorted(set(KATEGORI) - set(koder))
    if ubrukte:
        raise SystemExit(f"KATEGORI har koder som ikke finnes i kilden: {', '.join(ubrukte)}")

    aliaser = json.loads(ALIAS_FIL.read_text("utf-8")) if ALIAS_FIL.exists() else {}
    for a in resultat:
        a["aliaser"] = aliaser.get(a["kode"], [])

    return {
        "meta": {
            "kilde": DOKUMENT.name,
            "standardEnhet": STANDARD_ENHET,
            "antallAnalytter": len(resultat),
            "rettelser": RETTELSER,
            "avvik": AVVIK,
        },
        "analytter": resultat,
    }


def main() -> None:
    data = bygg()
    UT.parent.mkdir(parents=True, exist_ok=True)
    UT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf-8")

    print(f"Skrev {UT.relative_to(ROT)} med {data['meta']['antallAnalytter']} analytter.")
    print(f"\nRettelser ({len(data['meta']['rettelser'])}):")
    for r in data["meta"]["rettelser"]:
        print(f"  [{r['kategori']}] {r['hvor']}: {r['fra']!r} -> {r['til']!r}")
    print(f"\nAvvik i kilden ({len(data['meta']['avvik'])}):")
    for a in data["meta"]["avvik"]:
        print(f"  [{a['type']}] {a['kode']}: {a['beskrivelse']}")


if __name__ == "__main__":
    main()
