#!/usr/bin/env python3
"""Bygg src/data/analytter.json fra kommentarer.pdf.

Kjor:  python3 scripts/build_data.py

Kilden er fire tabeller i PDF-en: tre referansetabeller (Antidepressiver,
Stemningsstabiliserende, Antipsykotika) og en kommentartabell. Skriptet
slar dem sammen til ett datasett per analytt.

PDF-en bryter lange ord midt i ordet uten bindestrek fordi kolonnene er
smale ("likevektskonsentrasjo" / "n."). Ekte mellomrom er bevart i
tegnstrommen, sa en linje som slutter pa mellomrom var et ordskille og en
linje som slutter pa en bokstav var et tvunget orddelingsbrudd. Det gjor
rekonstruksjonen eksakt, uten heuristikk.

Alle rettelser skriptet gjor er samlet i RETTELSER og havner i
meta.rettelser i JSON-filen, slik at de kan etterprovest mot PDF-en.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pdfplumber

ROT = Path(__file__).resolve().parent.parent
PDF = ROT / "originaldata" / "kommentarer.pdf"
UT = ROT / "src" / "data" / "analytter.json"
ALIAS_FIL = ROT / "src" / "data" / "aliaser.json"

NIVAER = ("under", "innenfor", "over")

# Analysemetoden alle analyttene i denne PDF-en rekvireres under. Koden vises
# som pille i kommenteringsmodulen og er det sidemenyen grupperer etter.
ANALYSEMETODE = "SPFA"

# Analytter som ikke males i nmol/L. PDF-en markerer disse med en stjerne i
# tallkolonnene, men fotnoten som forklarer stjernen finnes ikke i dokumentet.
ENHET_UNNTAK = {"LAM": "µmol/L"}
STANDARD_ENHET = "nmol/L"

# Stavefeil i kildedokumentet. Noekkel = slik det star i PDF-en.
STAVEFEIL = {
    "ecitalopram": "escitalopram",
    "dehydroariprazol": "dehydroaripiprazol",
}

RETTELSER: list[dict] = []


def logg(kategori: str, hvor: str, fra: str, til: str, begrunnelse: str) -> None:
    RETTELSER.append({
        "kategori": kategori, "hvor": hvor,
        "fra": fra, "til": til, "begrunnelse": begrunnelse,
    })


# --------------------------------------------------------------------------
# Uttrekk fra PDF
# --------------------------------------------------------------------------

def celletekst(sidetegn: list[dict], boks) -> str:
    """Bygg opp teksten i en tabellcelle og reverser linjebrytingen."""
    x0, topp, x1, bunn = boks
    tegn = [
        c for c in sidetegn
        if c["x0"] >= x0 - 0.5 and c["x1"] <= x1 + 0.5
        and c["top"] >= topp - 0.5 and c["bottom"] <= bunn + 0.5
    ]
    if not tegn:
        return ""

    linjer: dict[float, list[dict]] = {}
    for c in tegn:
        linjer.setdefault(round(c["top"], 1), []).append(c)

    biter: list[str] = []
    for noekkel in sorted(linjer):
        linje = "".join(c["text"] for c in sorted(linjer[noekkel], key=lambda z: z["x0"]))
        renset = linje.rstrip()
        if not renset:
            continue
        biter.append(renset)
        # Avsluttende mellomrom => ordskille. Ellers delte PDF-en et ord.
        biter.append(" " if linje != renset else "")
    return "".join(biter).strip()


def les_pdf() -> tuple[list[dict], list[dict]]:
    """Returner (referanserader, kommentarrader) slik de star i PDF-en."""
    referanse: list[dict] = []
    kommentar: list[dict] = []
    gjeldende_gruppe = ""

    with pdfplumber.open(PDF) as pdf:
        for side in pdf.pages:
            tegn = side.chars
            for tabell in side.find_tables():
                overskrift = finn_overskrift(side, tabell)
                if overskrift:
                    gjeldende_gruppe = overskrift
                rader = [[celletekst(tegn, c) if c else "" for c in r.cells]
                         for r in tabell.rows]
                if not rader:
                    continue
                if len(rader[0]) == 5:
                    for rad in rader:
                        celler = [c.strip() for c in rad]
                        if celler[0] in ("", "Kode") or not any(celler):
                            continue
                        referanse.append({"gruppe": gjeldende_gruppe, "celler": celler})
                else:
                    for rad in rader:
                        celler = [c.strip() for c in rad]
                        if not any(celler) or celler[0] == "Analytt":
                            continue
                        if not celler[0] and not celler[1]:
                            # Fortsettelse av forrige rad fra forrige side.
                            if kommentar:
                                for i in range(2, 6):
                                    if celler[i]:
                                        skille = " " if kommentar[-1]["celler"][i] else ""
                                        kommentar[-1]["celler"][i] += skille + celler[i]
                            continue
                        kommentar.append({"celler": celler})
    return referanse, kommentar


def finn_overskrift(side, tabell) -> str:
    """Hent overskriften som star rett over en referansetabell."""
    x0, topp, x1, _ = tabell.bbox
    over = [c for c in side.chars if c["bottom"] <= topp - 1 and c["bottom"] >= topp - 40]
    if not over:
        return ""
    tekst = "".join(c["text"] for c in sorted(over, key=lambda z: (round(z["top"], 1), z["x0"])))
    return tekst.strip()


# --------------------------------------------------------------------------
# Normalisering av tekst
# --------------------------------------------------------------------------

TANKESTREK = "–"


def rett_staving(tekst: str, hvor: str) -> str:
    for feil, riktig in STAVEFEIL.items():
        if feil in tekst:
            tekst = tekst.replace(feil, riktig)
            logg("stavefeil", hvor, feil, riktig, "feilstavet virkestoffnavn i PDF-en")
        stor = feil.capitalize()
        if stor in tekst:
            tekst = tekst.replace(stor, riktig.capitalize())
            logg("stavefeil", hvor, stor, riktig.capitalize(), "feilstavet virkestoffnavn i PDF-en")
    return tekst


def rett_streker(tekst: str, hvor: str) -> str:
    """Bindestrek mellom to tall er et intervall og skal vaere tankestrek."""
    def bytt(m: re.Match) -> str:
        ny = m.group(0).replace(m.group(1), TANKESTREK)
        logg("tankestrek", hvor, m.group(0), ny, "bindestrek brukt om tallintervall")
        return ny

    tekst = re.sub(r"[\d,]+(\s*-\s*)\d+", bytt, tekst)
    if "+/-" in tekst:
        tekst = tekst.replace("+/-", "±")
        logg("typografi", hvor, "+/-", "±", "pluss-minus skrevet med skraastrek")
    return tekst


def vask_kommentar(tekst: str, hvor: str) -> str:
    tekst = unicodedata.normalize("NFC", tekst)
    tekst = re.sub(r"\s+", " ", tekst).strip()
    tekst = re.sub(r"\s+([,.;:])", r"\1", tekst)
    tekst = rett_staving(tekst, hvor)
    tekst = rett_streker(tekst, hvor)
    return tekst


# --------------------------------------------------------------------------
# Tallparsing
# --------------------------------------------------------------------------

def tall(tekst: str) -> float | int | None:
    tekst = tekst.strip().replace("*", "").replace(",", ".")
    try:
        verdi = float(tekst)
    except ValueError:
        return None
    return int(verdi) if verdi == int(verdi) else verdi


def formater(verdi: float | None) -> str:
    if verdi is None:
        return ""
    if verdi == int(verdi):
        return str(int(verdi))
    return f"{verdi:g}".replace(".", ",")


def les_intervall(tekst: str) -> dict | None:
    """Tolk "10 - 1799", "< 300", "0,6 – 34" osv."""
    if not tekst:
        return None
    renset = tekst.replace("*", "").strip()
    merknad = ""
    if "(" in renset:
        merknad = renset[renset.index("(") + 1:].rstrip(")").strip()
        renset = renset[:renset.index("(")].strip()

    m = re.fullmatch(r"[<≤]\s*([\d,\.]+)", renset)
    if m:
        return {"fra": None, "til": tall(m.group(1)), "merknad": merknad}
    m = re.fullmatch(r"[>≥]\s*([\d,\.]+)", renset)
    if m:
        return {"fra": tall(m.group(1)), "til": None, "merknad": merknad}
    m = re.fullmatch(r"([\d,\.]+)\s*[-–]\s*([\d,\.]+)", renset)
    if m:
        return {"fra": tall(m.group(1)), "til": tall(m.group(2)), "merknad": merknad}
    return None


def intervalltekst(iv: dict | None) -> str:
    if not iv:
        return ""
    fra, til = iv.get("fra"), iv.get("til")
    if fra is None and til is not None:
        kjerne = f"< {formater(til)}"
    elif til is None and fra is not None:
        kjerne = f"≥ {formater(fra)}"
    elif fra is not None and til is not None:
        kjerne = f"{formater(fra)} {TANKESTREK} {formater(til)}"
    else:
        return ""
    return f"{kjerne} ({iv['merknad']})" if iv.get("merknad") else kjerne


def les_maleomrade(tekst: str, hvor: str) -> dict:
    """Maleomradet er enten ett intervall eller ett per delanalytt."""
    tekst = re.sub(r"\s+", " ", tekst).strip()
    if not tekst:
        return {"tekst": "", "deler": []}

    biter = re.findall(r"([A-ZÆØÅ]{2,}):\s*([\d,\.]+\s*[-–]\s*[\d,\.]+)", tekst)
    if biter:
        deler = []
        for kode, spenn in biter:
            iv = les_intervall(spenn)
            deler.append({"kode": kode, **(iv or {}), "tekst": intervalltekst(iv)})
        return {"tekst": ", ".join(f"{d['kode']}: {d['tekst']}" for d in deler), "deler": deler}

    iv = les_intervall(tekst)
    if iv:
        return {"tekst": intervalltekst(iv), "deler": [{"kode": None, **iv, "tekst": intervalltekst(iv)}]}
    return {"tekst": rett_streker(tekst, hvor), "deler": []}


# --------------------------------------------------------------------------
# Sammenstilling
# --------------------------------------------------------------------------

def noekkel(navn: str) -> str:
    """Slaa sammen navnevarianter fra de to tabellene til en felles noekkel."""
    navn = navn.lower().replace("sum:", "")
    navn = re.sub(r"\([^)]*\)", "", navn)
    return re.sub(r"[^a-zæøå+]", "", navn)


def komponenter(navn: str) -> list[str]:
    deler = [d.strip() for d in navn.split("+") if d.strip()]
    return [d[0].upper() + d[1:] for d in deler]


def bygg() -> dict:
    referanse, kommentar = les_pdf()

    analytter: dict[str, dict] = {}
    for rad in referanse:
        kode, navn, under, innenfor, over = rad["celler"]
        navn = rett_staving(navn, f"referansetabell/{kode}")
        analytter[noekkel(navn)] = {
            "kode": kode,
            "navn": navn,
            "gruppe": rad["gruppe"],
            "_under": under,
            "_innenfor": innenfor,
            "_over": over,
        }

    grupper: dict[str, list[dict]] = {}
    for rad in kommentar:
        navn = rett_staving(rad["celler"][0], "kommentartabell/analyttnavn")
        grupper.setdefault(noekkel(navn), []).append({"navn": navn, "celler": rad["celler"]})

    manglende = set(analytter) ^ set(grupper)
    if manglende:
        raise SystemExit(f"Analytter matcher ikke mellom tabellene: {sorted(manglende)}")

    resultat = []
    avvik: list[dict] = []

    for n, base in analytter.items():
        rader = grupper[n]
        if len(rader) != 3:
            raise SystemExit(f"{base['kode']}: forventet 3 rader, fant {len(rader)}")

        kode = base["kode"]
        enhet = ENHET_UNNTAK.get(kode, STANDARD_ENHET)
        visningsnavn = rader[0]["navn"]

        # Ref.omraade, maleomraade og ringegrense star bare pa en av de tre
        # radene i PDF-en, men gjelder alle tre.
        ref_tekst = neste([r["celler"][3] for r in rader], f"{kode}/referanseomrade")
        maal_tekst = neste([r["celler"][4] for r in rader], f"{kode}/maleomrade")
        ringe_tekst = neste([r["celler"][5] for r in rader], f"{kode}/ringegrense")

        if ref_tekst and not les_intervall(ref_tekst):
            logg("artefakt", f"{kode}/referanseomrade", ref_tekst, "",
                 "lost tegn i kildetabellen, ikke et intervall")
            ref_tekst = ""

        referanseomrade = les_intervall(ref_tekst)
        maleomrade = les_maleomrade(maal_tekst, f"{kode}/maleomrade")
        ringegrense = tall(ringe_tekst)

        under = les_intervall(base["_under"])
        innenfor = les_intervall(base["_innenfor"])
        over = les_intervall(base["_over"])
        if not (under and innenfor and over):
            raise SystemExit(f"{kode}: klarte ikke tolke grensene")

        nedre = under["til"]
        ovre = over["fra"]

        nivaer = []
        for niva, rad, iv in zip(NIVAER, rader, (under, innenfor, over)):
            hvor = f"{kode}/{niva}"
            nivaer.append({
                "niva": niva,
                "tekst": intervalltekst(iv),
                "fra": iv["fra"],
                "til": iv["til"],
                "kommentar": vask_kommentar(rad["celler"][2], hvor),
            })

        # Avvik som ikke lar seg rette maskinelt, men som brukeren bor kjenne til.
        if innenfor["til"] is not None and ovre is not None and innenfor["til"] >= ovre:
            avvik.append({
                "kode": kode, "type": "overlapp",
                "beskrivelse": f"Innenfor slutter pa {formater(innenfor['til'])} mens "
                               f"Over starter pa {formater(ovre)}; verdien "
                               f"{formater(ovre)} dekkes av begge. Appen klassifiserer "
                               f"den som Over.",
            })
        if innenfor["til"] is not None and ovre is not None and innenfor["til"] + 1 < ovre:
            avvik.append({
                "kode": kode, "type": "hull",
                "beskrivelse": f"Innenfor slutter pa {formater(innenfor['til'])} mens "
                               f"Over starter pa {formater(ovre)}; omradet imellom er "
                               f"udefinert i PDF-en. Appen klassifiserer det som Innenfor.",
            })
        if ringegrense is not None and ovre is not None and ringegrense < ovre:
            avvik.append({
                "kode": kode, "type": "ringegrense",
                "beskrivelse": f"Ringegrensen ({formater(ringegrense)}) er lavere enn "
                               f"grensen for Over ({formater(ovre)}), sa det finnes "
                               f"konsentrasjoner som er innenfor referanseomradet og "
                               f"samtidig over ringegrensen.",
            })
        tak = maks_maleomrade(maleomrade)
        if ringegrense is not None and tak is not None and tak < ringegrense:
            avvik.append({
                "kode": kode, "type": "maleomrade",
                "beskrivelse": f"Maleomradet stopper pa {formater(tak)}, altsa lavere "
                               f"enn ringegrensen ({formater(ringegrense)}).",
            })

        resultat.append({
            "kode": kode,
            "navn": base["navn"],
            "visningsnavn": visningsnavn,
            "komponenter": komponenter(base["navn"]),
            "gruppe": base["gruppe"],
            "analysemetode": ANALYSEMETODE,
            # Kategorien i sidemenyen er overskriften analytten star under i
            # referansetabellen, sa den folger kilden og ikke en egen liste.
            "kategori": base["gruppe"],
            "enhet": enhet,
            "referanseomrade": beriket(referanseomrade),
            "maleomrade": maleomrade,
            "ringegrense": ringegrense,
            "nedreGrense": nedre,
            "ovreGrense": ovre,
            "nivaer": nivaer,
        })

    resultat.sort(key=lambda a: (a["gruppe"], a["navn"]))
    aliaser = json.loads(ALIAS_FIL.read_text("utf-8")) if ALIAS_FIL.exists() else {}
    for a in resultat:
        a["aliaser"] = aliaser.get(a["kode"], [])

    return {
        "meta": {
            "kilde": PDF.name,
            "standardEnhet": STANDARD_ENHET,
            "antallAnalytter": len(resultat),
            "rettelser": RETTELSER,
            "avvik": avvik,
        },
        "analytter": resultat,
    }


def neste(verdier: list[str], hvor: str) -> str:
    """Kolonnen er bare fylt ut pa en av de tre radene, men gjelder alle tre.

    Star det noe pa mer enn en rad er det et lost tegn i kilden; forste
    utfylte rad vinner, og resten logges som artefakt.
    """
    utfylte = [v.strip() for v in verdier if v and v.strip()]
    for ekstra in utfylte[1:]:
        logg("artefakt", hvor, ekstra, "",
             "lost tegn pa en av de andre radene for samme analytt")
    return utfylte[0] if utfylte else ""


def beriket(iv: dict | None) -> dict | None:
    return {**iv, "tekst": intervalltekst(iv)} if iv else None


def maks_maleomrade(maleomrade: dict) -> float | None:
    tak = [d["til"] for d in maleomrade["deler"] if d.get("til") is not None]
    return max(tak) if tak else None


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
