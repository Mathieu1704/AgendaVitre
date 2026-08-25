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
from datetime import time
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
from zipfile import ZipFile


W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

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


def _ascii_upper(value: str) -> str:
    import unicodedata
    return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").upper()


def locate_hainaut_header(header_row: list[str]) -> dict | None:
    """Retrouve la position reelle de chaque colonne a partir des libelles
    d'en-tete plutot que de supposer un nombre fixe de colonnes : chaque
    Word Hainaut fusionne les sous-colonnes "NOMBRE DE FACE"/"PRIX
    PRESTATION" differemment (2, 3 sous-colonnes, espaceurs vides...).
    Retourne None si l'en-tete n'est pas reconnaissable (secours legacy).
    """
    labels = [_ascii_upper(clean(cell)) for cell in header_row]

    def find(*keywords: str) -> int | None:
        for index, label in enumerate(labels):
            if any(keyword in label for keyword in keywords):
                return index
        return None

    client_idx = find("CLIENT")
    face_idx = find("NOMBRE DE FACE")
    price_idx = find("PRIX")
    temps_idx = find("TEMPS")
    paiement_idx = find("PAIEMENT")
    frequence_idx = find("FREQUENCE")
    positions = [client_idx, face_idx, price_idx, temps_idx, paiement_idx, frequence_idx]
    if any(index is None for index in positions) or positions != sorted(positions):
        return None
    return {
        "client": client_idx,
        "face_slots": list(range(face_idx, price_idx)),
        "price_slots": list(range(price_idx, temps_idx)),
        "temps_slots": list(range(temps_idx, paiement_idx)),
        "paiement_slots": list(range(paiement_idx, frequence_idx)),
        "frequence": frequence_idx,
    }


def row_columns(zone: str, row: list[str], header_map: dict | None = None) -> dict:
    if zone == "hainaut":
        first_cell = clean(row[0] if row else "")
        is_time_window = bool(re.search(r"\b\d{1,2}\s*(?:h|:)\s*\d{0,2}\b|\b(?:avant|après|apres|entre)\b", first_cell, re.IGNORECASE))
        marker, appointment = ("", first_cell) if is_time_window else (first_cell, "")
        cell = lambda index: row[index] if index < len(row) else ""
        if header_map:
            n = max(len(header_map["face_slots"]), len(header_map["price_slots"]))
            raw_faces = [cell(header_map["face_slots"][i]) if i < len(header_map["face_slots"]) else "" for i in range(n)]
            raw_prices = [cell(header_map["price_slots"][i]) if i < len(header_map["price_slots"]) else "" for i in range(n)]
            # Ne garder que les couples reellement remplis (les sous-colonnes
            # fusionnees laissent des slots vides selon le document), puis
            # se limiter aux deux premiers : le modele ne gere que deux
            # variantes alternees par commerce.
            pairs = [(f, p) for f, p in zip(raw_faces, raw_prices) if clean(f) or clean(p)][:2]
            faces = [pair[0] for pair in pairs] or [""]
            prices = [pair[1] for pair in pairs] or [""]
            temps = next((cell(i) for i in header_map["temps_slots"] if clean(cell(i))), "")
            paiement = next((cell(i) for i in header_map["paiement_slots"] if clean(cell(i))), "")
            return {
                "marker": marker, "appointment": appointment, "client": cell(header_map["client"]),
                "faces": faces[:2] + [""] * max(0, 2 - len(faces)), "prices": prices[:2] + [""] * max(0, 2 - len(prices)),
                "duration": temps, "payment": paiement, "frequency": cell(header_map["frequence"]),
            }
        # Secours : ancien decoupage fixe si l'en-tete n'a pas ete reconnu.
        values = (row + [""] * 9)[:9]
        return {
            "marker": marker, "appointment": appointment, "client": values[1],
            "faces": [values[2], values[3]], "prices": [values[4], values[5]],
            "duration": values[6], "payment": values[7], "frequency": values[8],
        }
    target = 12
    values = (row + [""] * target)[:target]
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


def build_services(columns: dict) -> list[dict]:
    """Une prestation par colonne face/prix, fidele au tableau papier.

    Paiement et frequence restent du texte libre au niveau du commerce
    (jamais interpretes) : voir columns["payment"]/columns["frequency"].
    """
    pairs = [(clean(face), clean(price)) for face, price in zip(columns["faces"], columns["prices"]) if clean(face) or clean(price)]
    services = []
    for index, (label, price_text) in enumerate(pairs):
        amounts = money_values(price_text)
        price = round(sum(amounts), 2) if amounts else 0
        services.append({
            "label": label or "Prestation à confirmer",
            "price_ht": price,
            "position": index,
            "active": True,
        })
    return services


def parse_document(path: Path, zone: str, weekday: int, name: str) -> dict:
    sections: list[dict] = []
    current_section: dict | None = None
    previous_stop: dict | None = None
    ignored_rows = []
    all_rows = document_rows(path)
    header_map = locate_hainaut_header(all_rows[0]) if zone == "hainaut" and all_rows else None
    for row_index, raw_row in enumerate(all_rows):
        columns = row_columns(zone, raw_row, header_map)
        joined = " ".join(raw_row).upper()
        if not joined.strip() or "NOMBRE" in joined and "PRIX" in joined:
            continue
        client = clean(columns["client"])
        if is_section_label(client, columns["faces"], columns["prices"]):
            current_section = {"label": section_name(client), "position": len(sections), "stops": []}
            sections.append(current_section)
            previous_stop = None
            continue
        services = build_services(columns)
        extra_notes = [clean(columns[key]) for key in ("marker", "appointment", "duration") if clean(columns[key])]
        if not client:
            if previous_stop and (services or extra_notes):
                previous_stop["services"].extend({**service, "position": len(previous_stop["services"]) + offset} for offset, service in enumerate(services))
                if extra_notes:
                    previous_stop["note"] = clean(" / ".join(filter(None, [previous_stop.get("note", ""), *extra_notes])))
            elif any(clean(value) for value in raw_row):
                ignored_rows.append({"row": row_index, "cells": raw_row})
            continue
        if current_section is None:
            current_section = {"label": "Sans section", "position": 0, "stops": []}
            sections.append(current_section)
        stop = {
            "name": client,
            "note": clean(" / ".join(extra_notes)) or None,
            "payment_text": clean(columns["payment"]) or None,
            "frequency_text": clean(columns["frequency"]) or None,
            "estimated_minutes": duration_minutes(columns["duration"]),
            "position": sum(len(section["stops"]) for section in sections),
            "active": True,
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
    }
    return {"format": "lvm-tour-seed-v1", "stats": stats, "templates": templates}


def apply_local(seed: dict) -> int:
    if os.getenv("ALLOW_LOCAL_TOUR_IMPORT") != "1":
        raise RuntimeError("Definissez ALLOW_LOCAL_TOUR_IMPORT=1 pour confirmer l'ecriture locale.")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.core.config import settings
    from app.models.models import SessionLocal, TourSection, TourService, TourStop, TourTemplate

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
            template_values = {key: payload[key] for key in ("name", "zone", "weekday", "default_start_time", "default_end_time", "active", "archived", "source_document")}
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
                    stop = TourStop(template_id=template.id, section_id=section.id, **{key: stop_data.get(key) for key in ("name", "note", "payment_text", "frequency_text", "estimated_minutes", "position", "active")})
                    db.add(stop)
                    db.flush()
                    for service_data in stop_data["services"]:
                        db.add(TourService(stop_id=stop.id, **{key: service_data.get(key) for key in ("label", "price_ht", "position", "active")}))
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
