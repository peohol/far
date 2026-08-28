#!/usr/bin/env python3
"""Bygg src/data/rusmidler.json fra rusmidler.md.

Kjor:  python3 scripts/build_rusmidler.py

Kilden er tabellene i originaldata/rusmidler.md, gruppert under overskrifter:
benzodiazepiner og Z-hypnotika, cannabis, opioider og sentralstimulerende.
De fleste tabellene har en rad per analytt eller navngitt kombinasjon, med en
hovedkommentar og eventuelt en tilleggskommentar. Morfin/kodein-tabellen er satt
opp annerledes, med en rad per situasjon og en kolonne per analytt.

TABELLER under er fasiten: den sier hvilke tabeller dokumentet skal ha, hvilke
kolonner de skal ha, og hvilke rader i hvilken rekkefolge. Finner skriptet noe
annet, stopper det med beskjed i stedet for a skrive et datasett appen tolker
feil. Ider derfra er noklene domenelaget i appen slar opp pa.

Cellene i dokumentet inneholder uthevinger, harde linjeskift som er blitt til
doble mellomrom, og plasseringsinstrukser i klammer ("[limes pa MAF1]"). Alt
dette er notasjon rundt teksten, ikke en del av kommentaren som limes inn, og
vaskes bort. Rettelser i selve teksten samles i RETTELSER og havner i
meta.rettelser i JSON-filen, slik at de kan etterproves mot dokumentet.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent
KILDE = ROT / "originaldata" / "rusmidler.md"
UT = ROT / "src" / "data" / "rusmidler.json"

# Analysemetoden stoffene rekvireres under. Koden vises som pille i
# kommenteringsmodulen og er det sidemenyen grupperer etter.
ANALYSEMETODE = "SRUS"

# Kategorien i sidemenyen, per overskrift i kilden. Overskriftene er kildens
# egne; bare "Cannabis" heter noe annet i appen, fordi klinikeren ba om
# "Cannabinoider" der. Stopper skriptet hvis dokumentet far en ny overskrift,
# sa en ny gruppe ikke havner i menyen uten en bestemt kategori.
KATEGORI = {
    "Benzodiazepiner og Z-hypnotika": "Benzodiazepiner og Z-hypnotika",
    "Cannabis": "Cannabinoider",
    "Opioider": "Opioider",
    "Sentralstimulerende": "Sentralstimulerende",
}


class Tabell:
    """En ventet tabell i dokumentet.

    `tekstkolonner` og `merknadkolonner` er {kolonneoverskrift: nokkel}.
    Tekstkolonnene blir kommentarer appen kan kopiere; merknadkolonnene blir
    veiledning til den som fortolker. Noklene er de appen slar opp pa, sa den
    kan vise den delen av veiledningen som hjelper i situasjonen.

    `rader` er (id, analyttetikett, koder, veiledning). Er `veiledning` sann,
    er radens tekstkolonner ikke kommentarer a lime inn, men prosa om hvordan
    saken skal handteres, og legges blant merknadene.
    """

    def __init__(self, gruppe, etikettkolonne, kodekolonne, tekstkolonner,
                 merknadkolonner, rader):
        self.gruppe = gruppe
        self.etikettkolonne = etikettkolonne
        self.kodekolonne = kodekolonne
        self.tekstkolonner = tekstkolonner
        self.merknadkolonner = merknadkolonner
        self.rader = rader


HOVED_OG_TILLEGG = {"Hovedkommentar": "hoved", "Tilleggskommentar": "tillegg"}

TABELLER: list[Tabell] = [
    Tabell(
        "Benzodiazepiner og Z-hypnotika", "Analytt", "Kode",
        {"Hovedkommentar": "hoved"}, {},
        [
            ("alprazolam", "Alprazolam", ["APR"], False),
            ("klonazepam", "Klonazepam", ["CZP"], False),
            ("nitrazepam", "Nitrazepam", ["NIT"], False),
            ("zolpidem", "Zolpidem", ["ZOLP"], False),
            ("zopiklon", "Zopiklon", ["ZOPI"], False),
        ],
    ),
    Tabell(
        "Benzodiazepiner og Z-hypnotika", "Analytt", "Kode", HOVED_OG_TILLEGG, {},
        [
            ("diazepam", "Diazepam", ["DIAZ"], False),
            ("desmetyldiazepam", "Desmetyldiazepam", ["DMI"], False),
            ("oksazepam", "Oksazepam", ["OXA"], False),
            (
                "diazepamgruppen-samlet",
                "KOMBINASJON: Diazepam, N-desmetyldiazepam og oksazepam påvist og OXA ≤ DIAZ + DMI",
                ["DIAZ", "DMI", "OXA"],
                False,
            ),
        ],
    ),
    Tabell(
        "Cannabis", "Analytt", "Kode", {"Kommentar": "hoved"}, {},
        [("thc", "THC", ["THC"], False)],
    ),
    Tabell(
        "Opioider", "Analytt", "Kode", {"Hovedkommentar": "hoved"}, {},
        [
            ("buprenorfin", "Buprenorfin", ["BUP"], False),
            ("fentanyl", "Fentanyl", ["FYL"], False),
            ("metadon", "Metadon", ["MDO"], False),
            ("oksykodon", "Oksykodon", ["OKSY"], False),
            ("tapentadol", "Tapentadol", ["TAP"], False),
        ],
    ),
    Tabell(
        "Opioider", "Analytt", "Kode", HOVED_OG_TILLEGG, {},
        [("tramadolgruppen", "Tramadol O-desmetyltramadol", ["TRAM", "OTRAM"], False)],
    ),
    Tabell(
        "Opioider", "Situasjon", None,
        {"Kommentar på kodein (KOD)": "kodein", "Kommentar på morfin (MOR)": "morfin"},
        {"Kriterium": "kriterium", "Håndtering / merknad": "handtering"},
        [
            ("kun-kodein", "Kun kodein påvist", ["KOD"], False),
            ("kun-morfin", "Kun morfin påvist", ["MOR"], False),
            (
                "hoy-kodein-lav-morfin",
                "Morfin og kodein – høy kodein, lav morfin",
                ["KOD", "MOR"],
                False,
            ),
            (
                "kodein-morfin-grasone",
                "Morfin og kodein – mellomområde / gråsone",
                ["KOD", "MOR"],
                True,
            ),
            (
                "kodein-morfin-ordinaer",
                "Morfin og kodein – ordinær kombinasjon",
                ["KOD", "MOR"],
                False,
            ),
        ],
    ),
    Tabell(
        "Sentralstimulerende", "Analytt", "Kode", {"Kommentar": "hoved"}, {},
        [
            ("benzoylekgonin", "Benzoylekgonin", ["BEZ1"], False),
            ("mdma", "MDMA (Ecstasy)", ["ECS1"], False),
        ],
    ),
    Tabell(
        "Sentralstimulerende", "Analytt", "Kode", HOVED_OG_TILLEGG, {},
        [
            ("amfetamin", "Amfetamin", ["AMF1"], False),
            ("metamfetamin", "Metamfetamin", ["MAF1"], False),
            (
                "amfetamingruppen-samlet",
                "KOMBINASJON: Amfetamin og metamfetamin",
                ["AMF1", "MAF1"],
                False,
            ),
        ],
    ),
]

# Cellen sier uttrykkelig at analytten ikke skal ha noen kommentar i denne
# situasjonen. Det er ikke en kommentartekst, og blir en tom celle.
INGEN_KOMMENTAR = re.compile(r"^Ingen \w*kommentar\.?$", re.IGNORECASE)

RETTELSER: list[dict] = []


def logg(kategori: str, hvor: str, fra: str, til: str, begrunnelse: str) -> None:
    RETTELSER.append({
        "kategori": kategori, "hvor": hvor,
        "fra": fra, "til": til, "begrunnelse": begrunnelse,
    })


# --------------------------------------------------------------------------
# Uttrekk fra dokumentet
# --------------------------------------------------------------------------

def er_skillelinje(rad: list[str]) -> bool:
    """Linjen under overskriftsraden i en markdown-tabell: | --- | --- |"""
    return bool(rad) and all(re.fullmatch(r":?-{3,}:?", c.strip()) for c in rad if c.strip() != "")


def celler(linje: str) -> list[str]:
    """Cellene i en tabellinje, uten de ytre rorstrekene."""
    return [c.strip() for c in linje.strip().strip("|").split("|")]


def les_tabeller(tekst: str) -> list[dict]:
    """Tabellene i dokumentet, i rekkefolge, med overskriften de star under."""
    funnet: list[dict] = []
    gruppe = ""
    gjeldende: dict | None = None

    for linje in tekst.splitlines():
        stripet = linje.strip()

        # Bare tabellens egen hovedoverskrift («# Opioider») er gruppen;
        # underoverskrifter deler bare opp tabellene innenfor gruppen.
        if stripet.startswith("# "):
            gruppe = stripet[2:].strip()
            gjeldende = None
            continue
        if stripet.startswith("#"):
            gjeldende = None
            continue

        if not stripet.startswith("|"):
            gjeldende = None
            continue

        rad = celler(stripet)
        if gjeldende is None:
            gjeldende = {"gruppe": gruppe, "kolonner": rad, "rader": []}
            funnet.append(gjeldende)
            continue
        if er_skillelinje(rad):
            continue
        if not any(c for c in rad):
            # Tom rad, som den dokumentet har etter tramadoltabellen.
            continue
        gjeldende["rader"].append(rad)

    return funnet


# --------------------------------------------------------------------------
# Vask av celletekst
# --------------------------------------------------------------------------

TANKESTREK = "–"

# Plasseringsinstrukser står i klammer, av og til med markdown-rømming foran.
KLAMMER = re.compile(r"\\?\[[^\]]*\\?\]")


def uten_notasjon(tekst: str) -> str:
    """Fjern markdown-notasjon og plasseringsinstrukser."""
    tekst = KLAMMER.sub("", tekst)
    tekst = re.sub(r"\*+", "", tekst)
    tekst = tekst.replace("\\", "")
    tekst = unicodedata.normalize("NFC", tekst)
    # Harde linjeskift i kilden er blitt til flere mellomrom.
    tekst = re.sub(r"\s+", " ", tekst).strip()
    return re.sub(r"\s+([,.;:])", r"\1", tekst)


def rett_streker(tekst: str, hvor: str) -> str:
    """Bindestrek mellom to tall er et intervall og skal vaere tankestrek."""
    def bytt(m: re.Match) -> str:
        ny = m.group(0).replace(m.group(1), TANKESTREK)
        logg("tankestrek", hvor, m.group(0), ny, "bindestrek brukt om tallintervall")
        return ny

    return re.sub(r"[\d,]+(\s*-\s*)\d+", bytt, tekst)


def rett_punktum(tekst: str, hvor: str) -> str:
    """En kommentar er en hel setning og skal slutte med punktum.

    Kilden mister punktumet der en plasseringsinstruks i klammer star etter
    setningen; de samme kommentarene har det ellers.
    """
    if not tekst or tekst.endswith((".", "!", "?", ":")):
        return tekst
    ny = tekst + "."
    logg("tegnsetting", hvor, tekst, ny, "kommentaren manglet avsluttende punktum")
    return ny


def vask_kommentar(tekst: str, hvor: str) -> str:
    renset = uten_notasjon(tekst)
    if not renset or INGEN_KOMMENTAR.fullmatch(renset):
        return ""
    return rett_punktum(rett_streker(renset, hvor), hvor)


def vask_merknad(tekst: str, hvor: str) -> str:
    renset = uten_notasjon(tekst)
    return rett_streker(renset, hvor) if renset else ""


def uten_mellomrom(tekst: str) -> str:
    """Til sammenligning av etiketter og koder.

    Dokumentet har mistet noen linjeskift inne i celler, slik at «Tramadol» og
    «O-desmetyltramadol» star som ett ord. Sammenligningen ser bort fra
    mellomrom, sa den artefakten ikke stopper byggingen — men en celle som
    faktisk sier noe annet, gjor det.
    """
    return re.sub(r"\s+", "", uten_notasjon(tekst))


# --------------------------------------------------------------------------
# Sammenstilling
# --------------------------------------------------------------------------

def bygg() -> dict:
    tabeller = les_tabeller(KILDE.read_text("utf-8"))

    if len(tabeller) != len(TABELLER):
        funnet = "\n".join(f"  {t['gruppe']}: {t['kolonner']}" for t in tabeller)
        raise SystemExit(
            f"forventet {len(TABELLER)} tabeller i dokumentet, fant {len(tabeller)}:\n{funnet}"
        )

    ut = []
    for ventet, tabell in zip(TABELLER, tabeller):
        ut.extend(les_tabell(ventet, tabell))

    return {
        "meta": {
            "kilde": str(KILDE.relative_to(ROT)),
            "antallRader": len(ut),
            "rettelser": RETTELSER,
        },
        "rader": ut,
    }


def les_tabell(ventet: Tabell, tabell: dict) -> list[dict]:
    kolonner = [uten_notasjon(k) for k in tabell["kolonner"]]

    def indeks(navn: str) -> int:
        if navn not in kolonner:
            raise SystemExit(
                f"{ventet.gruppe}: fant ikke kolonnen {navn!r} blant {kolonner}"
            )
        return kolonner.index(navn)

    if tabell["gruppe"] != ventet.gruppe:
        raise SystemExit(
            f"tabellen med kolonnene {kolonner} star under {tabell['gruppe']!r}, "
            f"skriptet venter {ventet.gruppe!r}"
        )
    if len(tabell["rader"]) != len(ventet.rader):
        raise SystemExit(
            f"{ventet.gruppe} ({kolonner[0]}): forventet {len(ventet.rader)} rader, "
            f"fant {len(tabell['rader'])}"
        )

    etikett_i = indeks(ventet.etikettkolonne)
    kode_i = indeks(ventet.kodekolonne) if ventet.kodekolonne else None
    tekst_i = {navn: (indeks(navn), nokkel) for navn, nokkel in ventet.tekstkolonner.items()}
    merknad_i = {navn: (indeks(navn), nokkel) for navn, nokkel in ventet.merknadkolonner.items()}

    ut = []
    for (rad_id, etikett, koder, veiledning), rad in zip(ventet.rader, tabell["rader"]):
        if uten_mellomrom(rad[etikett_i]) != uten_mellomrom(etikett):
            raise SystemExit(
                f"{rad_id}: dokumentet har {uten_notasjon(rad[etikett_i])!r}, "
                f"skriptet venter {etikett!r}"
            )
        if kode_i is not None and uten_mellomrom(rad[kode_i]) != "".join(koder):
            raise SystemExit(
                f"{rad_id}: dokumentet har kodene {uten_notasjon(rad[kode_i])!r}, "
                f"skriptet venter {koder}"
            )

        tekster: dict[str, str] = {}
        merknader: dict[str, str] = {}
        for _, (i, nokkel) in merknad_i.items():
            merknad = vask_merknad(rad[i], f"{rad_id}/{nokkel}")
            if merknad:
                merknader[nokkel] = merknad
        for navn, (i, nokkel) in tekst_i.items():
            hvor = f"{rad_id}/{nokkel}"
            if veiledning:
                # Radens tekstkolonner er prosa om handteringen, ikke
                # kommentarer noen skal lime inn.
                merknad = vask_merknad(rad[i], hvor)
                if merknad:
                    merknader[nokkel] = merknad
            else:
                tekst = vask_kommentar(rad[i], hvor)
                if tekst:
                    tekster[nokkel] = tekst

        if not veiledning and not tekster:
            raise SystemExit(f"{rad_id}: fant ingen kommentartekst")

        if ventet.gruppe not in KATEGORI:
            raise SystemExit(
                f"Overskriften {ventet.gruppe!r} mangler en kategori i KATEGORI."
            )

        ut.append({
            "id": rad_id,
            "gruppe": ventet.gruppe,
            "analysemetode": ANALYSEMETODE,
            "kategori": KATEGORI[ventet.gruppe],
            "analytt": etikett,
            "koder": koder,
            "tekster": tekster,
            "merknader": merknader,
        })

    return ut


def main() -> None:
    data = bygg()
    UT.parent.mkdir(parents=True, exist_ok=True)
    UT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf-8")

    print(f"Skrev {UT.relative_to(ROT)} med {data['meta']['antallRader']} rader.")
    print(f"\nRettelser ({len(data['meta']['rettelser'])}):")
    for r in data["meta"]["rettelser"]:
        print(f"  [{r['kategori']}] {r['hvor']}: {r['fra']!r} -> {r['til']!r}")


if __name__ == "__main__":
    main()
