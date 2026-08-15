"""Reprise unique des 21 tableaux Word de tournees.

Le mode par defaut genere uniquement un JSON de previsualisation. Aucun Word
n'est importe par l'application en production : une fois ce seed valide et
applique sur une base locale, l'editeur admin devient l'unique source.

Exemple (previsualisation sans toucher a la base) :
  python scripts/import_tours_word.py \
    --hainaut-dir "/chemin/vers/Hainaut" \
    --ardennes-dir "/chemin/vers/Ardennes" \
    --output data/tours_initial_seed.json

L'ecriture DB est volontairement protegee et refuse toute machine distante :
  ALLOW_LOCAL_TOUR_IMPORT=1 python scripts/import_tours_word.py ... \
    --apply-local --confirm LOCAL_TEST_ONLY
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from copy import deepcopy
from datetime import date, time
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
from zipfile import ZipFile


W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ALL_MONTHS = list(range(1, 13))
WINTER_MONTHS = [1, 2, 3, 11, 12]
NON_WINTER_MONTHS = [4, 5, 6, 7, 8, 9, 10]

MANIFEST = [
    ("hainaut", 4, "Jeudi Tournée Nivelles.docx", "Tournée Nivelles"),
    ("hainaut", 4, "Jeudi tournée Rebecq-virginal.docx", "Tournée Rebecq-Virginal"),
    ("hainaut", 4, "Jeudi tournée Tubize.docx", "Tournée Tubize"),
    ("hainaut", 2, "Mardi tournée Enghien - 1.docx", "Tournée Enghien 1"),
    ("hainaut", 2, "Mardi tournée Enghien - 2.docx", "Tournée Enghien 2"),
    ("hainaut", 2, "Mardi tournée Lessines.docx", "Tournée Lessines"),
    # Le fichier est mal nomme Mardi, mais son titre source et la decision
    # metier placent explicitement Mons le mercredi.
    ("hainaut", 3, "Mardi tournée Mons.docx", "Tournée Mons"),
    ("hainaut", 3, "Mercredi tournée Soignies - 1 pas hivers.docx", "Tournée Soignies 1"),
    ("hainaut", 3, "Mercredi tournée Soignies - 2.docx", "Tournée Soignies 2"),
    ("hainaut", 5, "Vendredi tournée BLC-Naast.docx", "Tournée BLC-Naast"),
    ("hainaut", 5, "Vendredi tournée Ecaussinnes.docx", "Tournée Écaussinnes"),
    ("ardennes", 4, "Jeudi tournée 1 Bièvre Gedinne Bellefontaine Vencimont Paliseul.docx", "Tournée 1 Bièvre-Gedinne-Bellefontaine-Vencimont-Paliseul"),
    ("ardennes", 4, "Jeudi tournée 2 Bouillon.docx", "Tournée 2 Bouillon"),
    ("ardennes", 4, "Jeudi tournée Namur - Marche - Awans - Boncelle.docx", "Tournée Namur-Marche-Awans-Boncelles"),
    ("ardennes", 2, "Mardi tournée 1  Florenville.docx", "Tournée 1 Florenville"),
    ("ardennes", 2, "Mardi tournée 2 Neufchâteau.docx", "Tournée 2 Neufchâteau"),
    ("ardennes", 3, "Mercredi tournée 1 Hotton Barvaux Bomal.docx", "Tournée 1 Hotton-Barvaux-Bomal"),
    # Les deux fichiers suivants restent deux modeles distincts, meme si leur
    # numero imprime est identique.
    ("ardennes", 3, "Mercredi tournée 2 Marche Marloie Forrière On Tellin (1).docx", "Tournée 2 Marche-Marloie-Forrières-On-Tellin"),
    ("ardennes", 3, "Mercredi tournée 2 Saint-Hubert.docx", "Tournée 2 Saint-Hubert"),
    ("ardennes", 5, "Vendredi tournée 2 Bertrix Herbeumont.docx", "Tournée 2 Bertrix-Herbeumont"),
    ("ardennes", 5, "Vendredri tournée 1 Libramont Ochamps Bastogne - Copie.docx", "Tournée 1 Libramont-Ochamps-Bastogne"),
]


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip(" /\t")


def document_rows(path: Path) -> list[list[str]]:
    """Extrait la grille logique et respecte les cellules Word fusionnees."""
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    tables = list(root.iter(W + "tbl"))
    if not tables:
        return []
    # Les documents fournis utilisent un tableau principal. Si Word contient
    # aussi une micro-table de mise en page, on garde celle qui a le plus de lignes.
    table = max(tables, key=lambda item: len(list(item.iter(W + "tr"))))
    rows: list[list[str]] = []
    for row in table.iter(W + "tr"):
        logical: list[str] = []
        for cell in row.findall(W + "tc"):
            span_node = cell.find(W + "tcPr/" + W + "gridSpan")
            span = int(span_node.attrib.get(W + "val", "1")) if span_node is not None else 1
            paragraphs = []
            for paragraph in cell.iter(W + "p"):
                text = clean("".join(node.text or "" for node in paragraph.iter(W + "t")))
                if text:
                    paragraphs.append(text)
            logical.append(clean(" / ".join(paragraphs)))
            logical.extend([""] * (span - 1))
        rows.append(logical)
    return rows


def money_values(value: str) -> list[float]:
    values = []
    for raw in re.findall(r"(?<![A-Za-z])[-+]?\s*\d+(?:[,.]\d{1,2})?", value):
        try:
            number = float(raw.replace(" ", "").replace(",", ".").replace("+", ""))
        except ValueError:
            continue
        if number >= 0:
            values.append(number)
    return values


def payment_modes(raw: str) -> tuple[list[str], bool]:
    # Les limites alphabetiques sont indispensables : le N de "mensuel" ne
    # doit jamais etre pris pour le code cash N.
    normalized = raw.upper().replace(".", "")
    tokens = re.findall(r"(?<![A-Z])(NF|F\s*TRIM|FT|N|F)(?![A-Z])", normalized)
    modes = []
    for token in tokens:
        if token == "NF":
            mode = "cash_no_invoice"
        elif token.replace(" ", "").startswith("FT"):
            mode = "quarterly_invoice"
        elif token == "N":
            mode = "cash_invoiced"
        else:
            mode = "monthly_invoice"
        if not modes or modes[-1] != mode:
            modes.append(mode)
    if not modes:
        return ["monthly_invoice"], True
    return modes, len(set(modes)) > 1


def frequency_rules(raw: str) -> tuple[list[dict], bool]:
    value = clean(raw).lower().replace("fois", "x")
    rules: list[dict] = []

    def add(kind: str, interval: int | None = None, months: list[int] | None = None, cap: int | None = None):
        candidate = {
            "kind": kind,
            "anchor_date": None,
            "interval_weeks": interval,
            "active_months": months or ALL_MONTHS,
            "monthly_cap": cap,
            "position": len(rules),
        }
        signature = (kind, interval, tuple(candidate["active_months"]), cap)
        if signature not in {(rule["kind"], rule["interval_weeks"], tuple(rule["active_months"]), rule["monthly_cap"]) for rule in rules}:
            rules.append(candidate)

    if "demande" in value:
        add("on_demand")
    if re.search(r"1\s*x?\s*/?\s*(?:1\s*)?an", value) or "annuel" in value:
        add("annual")
    if "trim" in value or re.search(r"1\s*x\s*/\s*3\s*mois", value):
        add("interval", 12)
    for amount in re.findall(r"1\s*x\s*/\s*(\d+)\s*mois", value):
        add("interval", int(amount) * 4)
    for amount in re.findall(r"(?:toutes?\s+les|1\s*x\s*/?)\s*(\d+)\s*(?:semaines?|sem\b)", value):
        add("interval", int(amount))
    for amount in re.findall(r"([124])\s*x\s*/\s*mois", value):
        per_month = int(amount)
        interval = {1: 4, 2: 2, 4: 1}[per_month]
        cap = 4 if per_month == 4 and ("5" in value or "même" in value or "meme" in value) else None
        add("interval", interval, cap=cap)
    if not rules:
        # Rien n'est presellectionne tant que l'admin n'a pas interprete le texte.
        add("on_demand")
        return rules, True

    seasonal = "hiver" in value
    if seasonal:
        intervals = [rule for rule in rules if rule["kind"] == "interval"]
        if len(intervals) >= 2:
            intervals[0]["active_months"] = NON_WINTER_MONTHS
            intervals[1]["active_months"] = WINTER_MONTHS
        else:
            # Le texte saisonnier n'est pas assez structure pour inventer une
            # seconde cadence : on conserve la regle et force la validation.
            for rule in intervals:
                rule["active_months"] = ALL_MONTHS
    ambiguous = seasonal or len(rules) > 1 or bool(re.search(r"\bou\b|\*", value))
    return rules, ambiguous


def extract_phone(name: str) -> tuple[str, str | None]:
    match = re.search(r"(?:(?:\+|00)32\s*\(0\)?|0)\d(?:[\s./-]*\d{2}){3,4}", name)
    if not match:
        return name, None
    return clean(name[:match.start()] + " " + name[match.end():]), clean(match.group(0))


def duration_minutes(raw: str) -> int | None:
    value = clean(raw).lower()
    hours = re.search(r"(\d+)\s*h(?:\s*(\d{1,2}))?", value)
    if hours:
        return int(hours.group(1)) * 60 + int(hours.group(2) or 0)
    minutes = re.search(r"(\d+)\s*(?:min(?:ute)?s?|')", value)
    return int(minutes.group(1)) if minutes else None


def is_section_label(client: str, service_cells: Iterable[str], price_cells: Iterable[str]) -> bool:
    if not client or any(clean(value) for value in [*service_cells, *price_cells]):
        return False
    upper = client.upper()
    return bool(re.match(r"^CLIENTS?\b", upper) or upper == client and len(client) < 80)


def section_name(raw: str) -> str:
    value = re.sub(r"^CLIENTS?\s*", "", raw, flags=re.IGNORECASE).strip(" :-")
    return value or "Sans section"


def row_columns(zone: str, row: list[str]) -> dict:
    target = 9 if zone == "hainaut" else 12
    values = (row + [""] * target)[:target]
    if zone == "hainaut":
        first_cell = clean(values[0])
        is_time_window = bool(re.search(r"\b\d{1,2}\s*(?:h|:)\s*\d{0,2}\b|\b(?:avant|après|apres|entre)\b", first_cell, re.IGNORECASE))
        return {
            "marker": "" if is_time_window else values[0], "appointment": values[0] if is_time_window else "", "client": values[1],
            "faces": [values[2], values[3]], "prices": [values[4], values[5]],
            "duration": values[6], "payment": values[7], "frequency": values[8],
        }
    # Un des Word Ardennes change de grille au milieu du tableau : sa petite
    # premiere colonne est fusionnee sur deux cases, ce qui decale client,
    # prestations et paiement d'une colonne. Dans ces lignes la colonne client
    # normale est vide (ou contient le creneau), tandis que la suivante porte
    # bien le nom du commerce.
    if len(row) == 11 and clean(row[3]) and (
        not clean(row[2])
        or bool(re.search(r"\b(?:avt|avant|apd|entre|jusqu|\d{1,2}\s*h)\b", row[2], re.IGNORECASE))
    ):
        shifted = (row + [""] * 11)[:11]
        return {
            "marker": shifted[0], "appointment": shifted[2], "client": shifted[3],
            "faces": [shifted[4], shifted[5]], "prices": [shifted[6], shifted[7]],
            "duration": shifted[8], "frequency": shifted[9], "payment": shifted[10],
        }
    # Bertrix utilise trois sous-colonnes de prestation pour deux prix. La
    # sous-colonne centrale et la suivante sont les deux variantes du second
    # prix; on les fusionne textuellement afin de ne perdre aucune consigne.
    if len(row) == 11 and clean(row[10]):
        second_face = clean(" / ".join(filter(None, [row[4], row[5]])))
        return {
            "marker": row[0], "appointment": row[1], "client": row[2],
            "faces": [row[3], second_face], "prices": [row[6], row[7]],
            "duration": row[8], "frequency": row[9], "payment": row[10],
        }
    return {
        "marker": values[0], "appointment": values[1], "client": values[2],
        "faces": [values[3], values[4]], "prices": [values[5], values[6]],
        "duration": values[7], "frequency": values[8], "payment": values[9],
    }


def build_services(columns: dict, row_index: int, source: str) -> tuple[list[dict], bool]:
    pairs = [(clean(face), clean(price)) for face, price in zip(columns["faces"], columns["prices"]) if clean(face) or clean(price)]
    modes, _ = payment_modes(columns["payment"])
    rules, frequency_ambiguous = frequency_rules(columns["frequency"])
    services = []
    overall_ambiguous = False
    for index, (label, price_text) in enumerate(pairs):
        amounts = money_values(price_text)
        price = round(sum(amounts), 2) if amounts else 0
        mapping_ambiguous = (
            not label
            or not amounts
            or len(amounts) > 1
            or (len(modes) > 1 and len(modes) != len(pairs))
            or frequency_ambiguous
            or (len(rules) > 1 and len(pairs) > 1)
        )
        mode = modes[index] if len(modes) == len(pairs) else modes[0]
        service_rules = [deepcopy(rules[index])] if len(rules) == len(pairs) else deepcopy(rules)
        for rule_position, rule in enumerate(service_rules):
            rule["position"] = rule_position
        services.append({
            "label": label or "Prestation à confirmer",
            "price_ht": price,
            "billing_mode": mode,
            "position": index,
            # Une association ambigue est conservee integralement mais reste
            # inactive tant qu'un admin ne l'a pas validee.
            "active": not mapping_ambiguous,
            "needs_review": mapping_ambiguous,
            "source_data": {
                "document": source,
                "row": row_index,
                "face_text": label,
                "price_text": price_text,
                "frequency_text": columns["frequency"],
                "payment_text": columns["payment"],
            },
            "schedules": service_rules,
        })
        overall_ambiguous = overall_ambiguous or mapping_ambiguous
    return services, overall_ambiguous


def parse_document(path: Path, zone: str, weekday: int, name: str) -> dict:
    sections: list[dict] = []
    current_section: dict | None = None
    previous_stop: dict | None = None
    ignored_rows = []
    for row_index, raw_row in enumerate(document_rows(path)):
        columns = row_columns(zone, raw_row)
        joined = " ".join(raw_row).upper()
        if not joined.strip() or "NOMBRE" in joined and "PRIX" in joined:
            continue
        client = clean(columns["client"])
        if is_section_label(client, columns["faces"], columns["prices"]):
            current_section = {"label": section_name(client), "position": len(sections), "stops": []}
            sections.append(current_section)
            previous_stop = None
            continue
        services, ambiguous = build_services(columns, row_index, path.name)
        extra_notes = [clean(columns[key]) for key in ("marker", "appointment", "duration") if clean(columns[key])]
        if not client:
            continuation_notes = [*extra_notes]
            if clean(columns["frequency"]):
                continuation_notes.append(f"Fréquence: {clean(columns['frequency'])}")
            if clean(columns["payment"]):
                continuation_notes.append(f"Paiement: {clean(columns['payment'])}")
            if previous_stop and (services or continuation_notes):
                previous_stop["services"].extend({**service, "position": len(previous_stop["services"]) + offset} for offset, service in enumerate(services))
                if continuation_notes:
                    previous_stop["instructions"] = clean(" / ".join(filter(None, [previous_stop.get("instructions", ""), *continuation_notes])))
                previous_stop["source_data"]["continuation_rows"].append(row_index)
            elif any(clean(value) for value in raw_row):
                ignored_rows.append({"row": row_index, "cells": raw_row})
            continue
        if current_section is None:
            current_section = {"label": "Sans section", "position": 0, "stops": []}
            sections.append(current_section)
        clean_name, phone = extract_phone(client)
        stop = {
            "name": clean_name or client,
            "export_label": clean_name or client,
            "address": None,
            "phone": phone,
            "email": None,
            "latitude": None,
            "longitude": None,
            "time_window": clean(columns["appointment"]) or None,
            "estimated_minutes": duration_minutes(columns["duration"]),
            "instructions": clean(" / ".join(extra_notes)) or None,
            "position": sum(len(section["stops"]) for section in sections),
            "active": True,
            "needs_review": not services,
            "source_data": {"document": path.name, "row": row_index, "cells": raw_row, "continuation_rows": []},
            "services": services,
        }
        current_section["stops"].append(stop)
        previous_stop = stop
    if not sections:
        sections = [{"label": "Sans section", "position": 0, "stops": []}]
    return {
        "name": name,
        "zone": zone,
        "weekday": weekday,
        "default_start_time": "08:00:00",
        "default_end_time": "16:00:00",
        "active": False,
        "archived": False,
        "setup_complete": False,
        "source_document": path.name,
        "sections": sections,
        "import_report": {"ignored_rows": ignored_rows},
    }


def build_seed(hainaut_dir: Path, ardennes_dir: Path) -> dict:
    roots = {"hainaut": hainaut_dir, "ardennes": ardennes_dir}
    templates = []
    missing = []
    for zone, weekday, filename, name in MANIFEST:
        path = roots[zone] / filename
        if not path.exists():
            missing.append(str(path))
            continue
        templates.append(parse_document(path, zone, weekday, name))
    if missing:
        raise FileNotFoundError("Documents manquants:\n" + "\n".join(missing))
    stats = {
        "templates": len(templates),
        "hainaut": sum(item["zone"] == "hainaut" for item in templates),
        "ardennes": sum(item["zone"] == "ardennes" for item in templates),
        "stops": sum(len(section["stops"]) for item in templates for section in item["sections"]),
        "services": sum(len(stop["services"]) for item in templates for section in item["sections"] for stop in section["stops"]),
        "ambiguous_stops": sum(stop["needs_review"] for item in templates for section in item["sections"] for stop in section["stops"]),
        "ambiguous_services": sum(service["needs_review"] for item in templates for section in item["sections"] for stop in section["stops"] for service in stop["services"]),
    }
    return {"format": "lvm-tour-seed-v1", "stats": stats, "templates": templates}


def apply_local(seed: dict) -> int:
    if os.getenv("ALLOW_LOCAL_TOUR_IMPORT") != "1":
        raise RuntimeError("Definissez ALLOW_LOCAL_TOUR_IMPORT=1 pour confirmer l'ecriture locale.")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.core.config import settings
    from app.models.models import SessionLocal, TourSection, TourService, TourServiceSchedule, TourStop, TourTemplate

    host = (urlparse(settings.DATABASE_URL).hostname or "").lower()
    if host not in {"localhost", "127.0.0.1", "::1", "db"}:
        raise RuntimeError(f"Import refuse: la base '{host}' n'est pas locale.")
    db = SessionLocal()
    created = 0
    try:
        for payload in seed["templates"]:
            exists = db.query(TourTemplate).filter(TourTemplate.source_document == payload["source_document"]).first()
            if exists:
                continue
            template_values = {key: payload[key] for key in ("name", "zone", "weekday", "default_start_time", "default_end_time", "active", "archived", "setup_complete", "source_document")}
            template_values["default_start_time"] = time.fromisoformat(template_values["default_start_time"])
            template_values["default_end_time"] = time.fromisoformat(template_values["default_end_time"])
            template = TourTemplate(**template_values)
            db.add(template)
            db.flush()
            for section_data in payload["sections"]:
                section = TourSection(template_id=template.id, label=section_data["label"], position=section_data["position"])
                db.add(section)
                db.flush()
                for stop_data in section_data["stops"]:
                    stop = TourStop(template_id=template.id, section_id=section.id, **{key: stop_data.get(key) for key in ("name", "export_label", "address", "phone", "email", "latitude", "longitude", "time_window", "estimated_minutes", "instructions", "position", "active", "needs_review", "source_data")})
                    db.add(stop)
                    db.flush()
                    for service_data in stop_data["services"]:
                        service = TourService(stop_id=stop.id, **{key: service_data.get(key) for key in ("label", "price_ht", "billing_mode", "position", "active", "needs_review", "source_data")})
                        db.add(service)
                        db.flush()
                        for rule_data in service_data["schedules"]:
                            rule_values = {key: rule_data.get(key) for key in ("kind", "anchor_date", "interval_weeks", "active_months", "monthly_cap", "position")}
                            if isinstance(rule_values["anchor_date"], str):
                                rule_values["anchor_date"] = date.fromisoformat(rule_values["anchor_date"])
                            db.add(TourServiceSchedule(service_id=service.id, **rule_values))
            created += 1
        db.commit()
        return created
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hainaut-dir", type=Path)
    parser.add_argument("--ardennes-dir", type=Path)
    parser.add_argument("--seed", type=Path, help="Reutilise un seed deja valide sans relire les Word.")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--apply-local", action="store_true")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args()
    if args.seed:
        seed = json.loads(args.seed.read_text(encoding="utf-8"))
    else:
        if not args.hainaut_dir or not args.ardennes_dir:
            parser.error("--hainaut-dir et --ardennes-dir sont requis sans --seed")
        seed = build_seed(args.hainaut_dir, args.ardennes_dir)
    rendered = json.dumps(seed, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if args.apply_local:
        if args.confirm != "LOCAL_TEST_ONLY":
            raise RuntimeError("Ajoutez --confirm LOCAL_TEST_ONLY. Aucune base distante n'est acceptee.")
        created = apply_local(seed)
        print(f"{created} modele(s) crees sur la base locale.")
    print(json.dumps(seed["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()
