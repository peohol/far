#!/usr/bin/env python3
"""Bygg src/data/rusmidler.json fra rusmidler.pdf.

Kjor:  python3 scripts/build_rusmidler.py

Kilden er tre tabeller i PDF-en: "Benzodiazepiner og Z-hypnotika", "THC" og
"Opioider". Hver rad er en analytt eller en navngitt kombinasjon av analytter,
med en hovedkommentar, eventuelt en tilleggskommentar, og eventuelt en
bemerkning om fortolkningen.

Tabellene er satt opp litt ulikt. Benzotabellen har egne kolonner for
tilleggskommentar og bemerkning; opioidtabellen slar de to sammen til en
kolonne ("Bemerkning om fortolkingen, tilleggskommentarer"), og THC-tabellen
har bare en kommentarkolonne. Skriptet leser kolonnene etter overskriftene
sine og deler den sammenslatte kolonnen i avsnitt: avsnittet som henviser
videre ("Se kommentar for ... i serum.") er tilleggskommentaren, resten er
bemerkning.

Hver logisk rad i PDF-en dekker tre fysiske tabellrader, fordi analyttnavnet
star i sin egen rutedeling til venstre. Radene med full tabellbredde er de
logiske radene; navnet hentes fra navnekolonnen over hele det bandet.

Radene er ventet a vaere de samme fra gang til gang. RADER under er fasiten:
finner skriptet noe annet i PDF-en, stopper det med beskjed i stedet for a
skrive et datasett appen tolker feil. Ider derfra er noklene domenelaget i
appen slar opp pa.

Alle rettelser skriptet gjor er samlet i RETTELSER og havner i
meta.rettelser i JSON-filen, slik at de kan etterproves mot PDF-en.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pdfplumber

ROT = Path(__file__).resolve().parent.parent
PDF = ROT / "originaldata" / "rusmidler.pdf"
UT = ROT / "src" / "data" / "rusmidler.json"

# Fasiten over radene i PDF-en, i dokumentrekkefolge: (id, analyttetikett,
# koder). Etiketten er analyttkolonnen slik den star, med linjeskift som
# mellomrom. Ider er noklene appen slar opp pa og ma ikke endres uten at
# src/domain/rus.ts endres i samme slengen.
RADER: list[tuple[str, str, list[str]]] = [
    ("alprazolam", "Alprazolam", ["APR"]),
    ("diazepam", "Diazepam", ["DIAZ"]),
    ("desmetyldiazepam", "Desmetyldiazepam", ["DMI"]),
    ("klonazepam", "Klonazepam", ["CZP"]),
    ("nitrazepam", "Nitrazepam", ["NIT"]),
    ("oksazepam", "Oksazepam", ["OXA"]),
    ("zolpidem", "Zolpidem", ["ZOLP"]),
    ("zopiklon", "Zopiklon", ["ZOPI"]),
    (
        "diazepamgruppen-samlet",
        "KOMBINASJON Diazepam, N-desmetyldiazepam og oksazepam",
        ["DIAZ", "DMI", "OXA"],
    ),
    ("thc", "THC", ["THC"]),
    ("buprenorfin", "Buprenorfin", ["BUP"]),
    ("fentanyl", "Fentanyl", ["FYL"]),
    ("kodein", "Kodein", ["KOD"]),
    ("kodein-med-morfin", "Kodein ved KOMBINASJON Morfin og kodein", ["KOD"]),
    ("morfin", "Morfin", ["MOR"]),
    ("metadon", "Metadon", ["MDO"]),
    ("oksykodon", "Oksykodon", ["OKSY"]),
    ("tapentadol", "Tapentadol", ["TAP"]),
    ("tramadol", "Tramadol", ["TRAM"]),
    ("o-desmetyltramadol", "O-desmetyltramadol", ["OTRAM"]),
    ("hoy-kodein-lav-morfin", "KOMBINASJON Høy kodein, lav morfin", ["KOD", "MOR"]),
]

# Kolonneoverskriftene, normalisert til feltnavnene i JSON-filen. Overskriften
# star bare pa forste side av hver tabell; siden etterpa arver oppsettet.
KOLONNER = {
    "kode": "kode",
    "hovedkommentar": "hovedkommentar",
    "kommentar": "hovedkommentar",
    "tilleggskommentar": "tilleggskommentar",
    "bemerkning om fortolkningen": "merknader",
    "bemerkning om fortolkingen, tilleggskommentarer": "merknader",
}

# Avsnittet som henviser videre til en annen analytts kommentar. Det er en
# tilleggskommentar som skal limes inn, ikke en bemerkning til den som tolker.
HENVISNING = re.compile(r"Se kommentar for .+ i serum\.")

RETTELSER: list[dict] = []


def logg(kategori: str, hvor: str, fra: str, til: str, begrunnelse: str) -> None:
    RETTELSER.append({
        "kategori": kategori, "hvor": hvor,
        "fra": fra, "til": til, "begrunnelse": begrunnelse,
    })


# --------------------------------------------------------------------------
# Uttrekk fra PDF
# --------------------------------------------------------------------------

def linjer(sidetegn: list[dict], boks) -> list[tuple[float, str]]:
    """Linjene i et rektangel, som (toppkoordinat, tekst)."""
    x0, topp, x1, bunn = boks
    tegn = [
        c for c in sidetegn
        if c["x0"] >= x0 - 0.5 and c["x1"] <= x1 + 0.5
        and c["top"] >= topp - 0.5 and c["bottom"] <= bunn + 0.5
    ]

    samlet: dict[float, list[dict]] = {}
    for c in tegn:
        samlet.setdefault(round(c["top"], 1), []).append(c)

    ut: list[tuple[float, str]] = []
    for noekkel in sorted(samlet):
        tekst = "".join(c["text"] for c in sorted(samlet[noekkel], key=lambda z: z["x0"]))
        if tekst.strip():
            ut.append((noekkel, tekst.rstrip()))
    return ut


def flett(biter: list[str]) -> str:
    """Sett sammen linjer til lopende tekst.

    Kolonnene er smale, sa nesten hver linje er et tvunget brudd. Slutter en
    linje pa bindestrek er streken en del av ordet ("O-desmetyltramadol",
    "40-120"), og linjene settes sammen uten mellomrom; ellers med.
    """
    ut = ""
    for bit in biter:
        if not ut:
            ut = bit
        elif ut.endswith("-"):
            ut += bit
        else:
            ut += " " + bit
    return ut


def avsnitt(sidetegn: list[dict], boks) -> list[str]:
    """Teksten i en celle, delt i avsnitt.

    Et avsnittsskille synes som et ekstra stort sprang mellom to linjer.
    Linjeavstanden i PDF-en er den samme overalt, sa terskelen kan settes
    romslig i forhold til den minste avstanden cellen selv har.
    """
    rader = linjer(sidetegn, boks)
    if not rader:
        return []
    if len(rader) == 1:
        return [rader[0][1]]

    sprang = [b[0] - a[0] for a, b in zip(rader, rader[1:])]
    minste = min(sprang)

    grupper: list[list[str]] = [[rader[0][1]]]
    for (_, tekst), avstand in zip(rader[1:], sprang):
        if avstand > minste * 1.4:
            grupper.append([tekst])
        else:
            grupper[-1].append(tekst)
    return [flett(g) for g in grupper]


def datatabeller(side):
    """Datatabellene pa siden, ovenfra og ned.

    `find_tables` finner ogsa navnekolonnen som sin egen lille tabell der et
    analyttnavn gar over flere linjer. De ligger inne i en ekte tabell og
    lukes ut pa det. En side kan ha mer enn en ekte tabell: side 3 avslutter
    THC-tabellen og begynner opioidtabellen.
    """
    alle = side.find_tables()

    def inni(a, b) -> bool:
        return (
            a is not b
            and a.bbox[0] >= b.bbox[0] - 1 and a.bbox[1] >= b.bbox[1] - 1
            and a.bbox[2] <= b.bbox[2] + 1 and a.bbox[3] <= b.bbox[3] + 1
        )

    ekte = [t for t in alle if not any(inni(t, annen) for annen in alle)]
    return sorted(ekte, key=lambda t: t.bbox[1])


def logiske_rader(tabell):
    """Radene som har en rute i hver kolonne, over hele tabellbredden.

    Hver logiske rad dekker flere fysiske: analyttnavnet star i sin egen
    rutedeling til venstre, og en tom kolonne kan vaere delt opp pa samme vis.
    De delradene mangler ruter i midten, og lukes ut pa det.
    """
    x1 = tabell.bbox[2]
    antall = max(len(kolonnebokser(r)) for r in tabell.rows)
    return [
        r for r in tabell.rows
        if abs(r.bbox[2] - x1) < 1 and len(kolonnebokser(r)) == antall
    ]


def kolonnebokser(rad) -> list[tuple[float, float]]:
    """x-omradene til kolonnene i en rad, fra venstre."""
    return [(c[0], c[2]) for c in rad.cells if c is not None]


def overskrift(side, tabell) -> str:
    """Tabelloverskriften: den nederste tekstlinjen rett over tabellen."""
    _, topp, _, _ = tabell.bbox
    over = [c for c in side.chars if topp - 40 <= c["bottom"] <= topp - 1]
    if not over:
        return ""
    nederst = max(round(c["top"], 1) for c in over)
    linje = [c for c in over if round(c["top"], 1) == nederst]
    return "".join(c["text"] for c in sorted(linje, key=lambda z: z["x0"])).strip()


class Uttrekk:
    """Radene i PDF-en, samlet mens sidene leses.

    Kolonneoppsettet star bare i overskriftsraden pa forste side av hver
    tabell; sidene etter arver det. En rad uten bade navn og kode er
    fortsettelsen av forrige rad over et sideskift.
    """

    def __init__(self) -> None:
        self.rader: list[dict] = []
        self.felt: list[str] = []
        self.gruppe = ""

    def les_side(self, side) -> None:
        tegn = side.chars
        for tabell in datatabeller(side):
            for rad in logiske_rader(tabell):
                _, topp, _, bunn = rad.bbox
                celler = [
                    avsnitt(tegn, (x0, topp, x1, bunn)) for x0, x1 in kolonnebokser(rad)
                ]
                self.les_rad(side, tabell, celler)

    def les_rad(self, side, tabell, celler: list[list[str]]) -> None:
        flate = [" ".join(a).strip() for a in celler]
        if not any(flate):
            return

        if any(f.lower() == "kode" for f in flate):
            self.felt = ["analytt"] + [KOLONNER.get(f.lower(), "") for f in flate[1:]]
            self.gruppe = overskrift(side, tabell) or self.gruppe
            return

        if not self.felt:
            raise SystemExit(f"rad uten kjent kolonneoppsett pa side {side.page_number}")

        post: dict[str, list[str]] = {navn: [] for navn in KOLONNER.values()}
        post["analytt"] = []
        for navn, deler in zip(self.felt, celler):
            if navn:
                post[navn] = deler

        navn = flett(post["analytt"])
        kode = flett(post["kode"])

        if not navn and not kode:
            if not self.rader:
                raise SystemExit(f"fortsettelsesrad uten forgjenger pa side {side.page_number}")
            for felt in ("hovedkommentar", "tilleggskommentar", "merknader"):
                slaa_sammen(self.rader[-1][felt], post[felt])
            return

        self.rader.append({
            "gruppe": self.gruppe,
            "analytt": navn,
            "koder": kode.split(),
            "hovedkommentar": post["hovedkommentar"],
            "tilleggskommentar": post["tilleggskommentar"],
            "merknader": post["merknader"],
        })


def les_pdf() -> list[dict]:
    """Radene i PDF-en, i dokumentrekkefolge, med tekst per kolonne."""
    uttrekk = Uttrekk()
    with pdfplumber.open(PDF) as pdf:
        for side in pdf.pages:
            uttrekk.les_side(side)
    return uttrekk.rader


def slaa_sammen(forrige: list[str], nye: list[str]) -> None:
    """Skjot en celle som fortsetter over et sideskift.

    Forste avsnitt pa den nye siden er resten av det siste avsnittet pa den
    forrige; eventuelle avsnitt etter det er nye.
    """
    if not nye:
        return
    if forrige:
        forrige[-1] = flett([forrige[-1], nye[0]])
        forrige.extend(nye[1:])
    else:
        forrige.extend(nye)


# --------------------------------------------------------------------------
# Normalisering av tekst
# --------------------------------------------------------------------------

TANKESTREK = "–"


def rett_streker(tekst: str, hvor: str) -> str:
    """Bindestrek mellom to tall er et intervall og skal vaere tankestrek."""
    def bytt(m: re.Match) -> str:
        ny = m.group(0).replace(m.group(1), TANKESTREK)
        logg("tankestrek", hvor, m.group(0), ny, "bindestrek brukt om tallintervall")
        return ny

    return re.sub(r"[\d,]+(\s*-\s*)\d+", bytt, tekst)


def rett_prosent(tekst: str, hvor: str) -> str:
    """Prosenttegn skal ha mellomrom foran seg, slik kilden ellers skriver det."""
    ny = re.sub(r"(\d)%", r"\1 %", tekst)
    if ny != tekst:
        logg("typografi", hvor, tekst, ny, "manglende mellomrom foran prosenttegn")
    return ny


def vask(tekst: str, hvor: str) -> str:
    tekst = unicodedata.normalize("NFC", tekst)
    tekst = re.sub(r"\s+", " ", tekst).strip()
    tekst = re.sub(r"\s+([,.;:])", r"\1", tekst)
    tekst = rett_streker(tekst, hvor)
    return rett_prosent(tekst, hvor)


# --------------------------------------------------------------------------
# Sammenstilling
# --------------------------------------------------------------------------

def bygg() -> dict:
    raa = les_pdf()

    if len(raa) != len(RADER):
        funnet = "\n".join(f"  {r['analytt']!r} {r['koder']}" for r in raa)
        raise SystemExit(
            f"forventet {len(RADER)} rader i PDF-en, fant {len(raa)}:\n{funnet}"
        )

    ut = []
    for (rad_id, etikett, koder), rad in zip(RADER, raa):
        if rad["analytt"] != etikett or rad["koder"] != koder:
            raise SystemExit(
                f"{rad_id}: PDF-en har {rad['analytt']!r} {rad['koder']}, "
                f"skriptet venter {etikett!r} {koder}"
            )

        hoved = vask(flett(rad["hovedkommentar"]), f"{rad_id}/hovedkommentar")

        # Benzotabellen har egen kolonne for tilleggskommentaren. Opioidtabellen
        # slar tilleggskommentar og bemerkning sammen; der er avsnittet som
        # henviser videre tilleggskommentaren.
        tillegg = [vask(a, f"{rad_id}/tilleggskommentar") for a in rad["tilleggskommentar"]]
        bemerkninger = []
        for a in rad["merknader"]:
            renset = vask(a, f"{rad_id}/merknad")
            (tillegg if HENVISNING.search(renset) else bemerkninger).append(renset)

        if len(tillegg) > 1:
            raise SystemExit(f"{rad_id}: fant {len(tillegg)} tilleggskommentarer")

        ut.append({
            "id": rad_id,
            "gruppe": rad["gruppe"],
            "analytt": etikett,
            "koder": koder,
            "hovedkommentar": hoved,
            "tilleggskommentar": tillegg[0] if tillegg else "",
            "bemerkninger": bemerkninger,
        })

    return {
        "meta": {
            "kilde": str(PDF.relative_to(ROT)),
            "antallRader": len(ut),
            "rettelser": RETTELSER,
        },
        "rader": ut,
    }


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
