#!/usr/bin/env python3
"""Validate the static equipment register and the map layout."""

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path, PurePosixPath, PureWindowsPath
from urllib.parse import urlsplit


REQUIRED_FIELDS = {
    "spaceNumber",
    "unitId",
    "unitType",
    "purpose",
    "operationalStatus",
    "monitoringStatus",
    "displayOrder",
    "active",
}
DATE_FIELDS = ("dateReported", "lastUpdated")
URL_FIELDS = ("maintenanceReference", "reesReference")


def read_json(path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate_map_background(root, layout, errors):
    background = layout.get("background")
    if not isinstance(background, dict):
        errors.append("data/layout.json background: expected an image and its dimensions.")
        return

    image = background.get("image")
    if not isinstance(image, str) or not image.strip():
        errors.append("data/layout.json background.image: a relative image path is required.")
        return
    if PurePosixPath(image).is_absolute() or PureWindowsPath(image).is_absolute():
        errors.append("data/layout.json background.image: image path must be relative.")
        return

    image_path = (root / image).resolve()
    try:
        image_path.relative_to(root.resolve())
    except ValueError:
        errors.append("data/layout.json background.image: image path must stay inside the project.")
        return
    try:
        contents = image_path.read_bytes()
    except OSError:
        errors.append(f"data/layout.json background.image: file not found: {image}.")
        return

    if len(contents) < 24 or contents[:8] != b"\x89PNG\r\n\x1a\n":
        errors.append(f"data/layout.json background.image: expected a PNG image: {image}.")
        return

    width = int.from_bytes(contents[16:20], "big")
    height = int.from_bytes(contents[20:24], "big")
    if background.get("width") != width or background.get("height") != height:
        errors.append(
            "data/layout.json background dimensions do not match "
            f"{image} ({width} x {height})."
        )


def validate_project(root):
    root = Path(root)
    errors = []
    data_dir = root / "data"
    try:
        config = read_json(data_dir / "config.json")
        layout = read_json(data_dir / "layout.json")
    except (OSError, json.JSONDecodeError) as error:
        return [f"Project configuration: {error}"], 0

    validate_map_background(root, layout, errors)

    fields = config.get("csvFields", [])
    with (data_dir / "equipment.csv").open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, strict=True)
        headers = reader.fieldnames or []
        if headers != fields:
            errors.append(
                "data/equipment.csv header: fields must match data/config.json csvFields "
                f"in order; found {headers!r}."
            )
        records = []
        try:
            for row_number, row in enumerate(reader, start=2):
                if None in row:
                    errors.append(f"CSV row {row_number}: extra fields beyond the configured header.")
                    continue
                if any(value is None for value in row.values()):
                    errors.append(f"CSV row {row_number}: one or more configured fields are missing.")
                    continue
                records.append((row_number, row))
        except csv.Error as error:
            errors.append(f"CSV row {reader.line_num}: malformed CSV: {error}.")
            return errors, len(records)

    if not records:
        errors.append("data/equipment.csv: no equipment records found.")
    by_unit = {}
    unit_rows = defaultdict(list)
    space_rows = defaultdict(list)
    for row_number, row in records:
        unit_id = row.get("unitId", "").strip()
        display_name = unit_id or f"CSV row {row_number}"
        for field in REQUIRED_FIELDS:
            if not row.get(field, "").strip():
                errors.append(f"{display_name} (CSV row {row_number}), field {field}: required value is missing.")
        if unit_id:
            unit_rows[unit_id.casefold()].append((row_number, unit_id))
            by_unit[unit_id] = (row_number, row)
        if row.get("active", "").strip().lower() not in {"true", "false"}:
            errors.append(f"{display_name} (CSV row {row_number}), field active: expected true or false.")
        try:
            int(row.get("displayOrder", ""))
        except ValueError:
            errors.append(f"{display_name} (CSV row {row_number}), field displayOrder: expected a whole number.")

        unit_type = row.get("unitType", "").strip()
        if unit_type and unit_type not in {"Incubator", "Freezer", "Refrigerator"}:
            errors.append(f"{display_name} (CSV row {row_number}), field unitType: unsupported equipment type {unit_type!r}.")
        op_status = row.get("operationalStatus", "").strip()
        if op_status and op_status not in config.get("operationalStatuses", []):
            errors.append(f"{display_name} (CSV row {row_number}), field operationalStatus: unapproved value {op_status!r}.")
        monitor_status = row.get("monitoringStatus", "").strip()
        if monitor_status and monitor_status not in config.get("monitoringStatuses", []):
            errors.append(f"{display_name} (CSV row {row_number}), field monitoringStatus: unapproved value {monitor_status!r}.")

        space_number = row.get("spaceNumber", "").strip()
        if space_number and row.get("active", "").strip().lower() == "true":
            space_rows[space_number].append((row_number, unit_id))
        for field in DATE_FIELDS:
            value = row.get(field, "").strip()
            if value:
                try:
                    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                        raise ValueError
                    date.fromisoformat(value)
                except ValueError:
                    errors.append(f"{display_name} (CSV row {row_number}), field {field}: expected a valid YYYY-MM-DD date, got {value!r}.")
        for field in URL_FIELDS:
            value = row.get(field, "").strip()
            if not value:
                continue
            if re.match(r"^(?:https?[:/]|[a-zA-Z][a-zA-Z0-9+.-]*:)", value, re.IGNORECASE):
                try:
                    parts = urlsplit(value)
                    hostname = parts.hostname
                    parts.port
                except ValueError:
                    errors.append(f"{display_name} (CSV row {row_number}), field {field}: malformed URL {value!r}.")
                    continue
                if (parts.scheme.lower() not in {"http", "https"} or not parts.netloc or not hostname
                        or any(character.isspace() for character in value)):
                    errors.append(f"{display_name} (CSV row {row_number}), field {field}: unsafe or malformed URL {value!r}.")
                elif parts.username or parts.password:
                    errors.append(f"{display_name} (CSV row {row_number}), field {field}: URLs must not contain embedded credentials.")

    for entries in unit_rows.values():
        if len(entries) > 1:
            ids = ", ".join(f"{unit_id} at CSV row {row}" for row, unit_id in entries)
            errors.append(f"Duplicate Unit ID: {ids}.")

    allowed_shared = {str(value) for value in config.get("allowedSharedSpaceNumbers", [])}
    for space_number, entries in space_rows.items():
        if len(entries) > 1 and space_number not in allowed_shared:
            units = ", ".join(f"{unit_id or '(missing Unit ID)'} at CSV row {row}" for row, unit_id in entries)
            errors.append(f"Duplicate active spaceNumber {space_number!r} is not approved: {units}.")

    positions = layout.get("equipment", [])
    positions_by_id = defaultdict(list)
    for position_number, position in enumerate(positions, start=1):
        unit_id = str(position.get("unitId", "")).strip()
        if not unit_id:
            errors.append(f"data/layout.json equipment position {position_number}, field unitId: value is required.")
            continue
        positions_by_id[unit_id].append(position_number)
        if unit_id not in by_unit:
            errors.append(f"data/layout.json equipment position {position_number}, field unitId: unknown Unit ID {unit_id!r}.")
            continue
        _, record = by_unit[unit_id]
        if str(position.get("spaceNumber", "")) != record.get("spaceNumber", ""):
            errors.append(
                f"{unit_id} (layout position {position_number}), field spaceNumber: "
                f"layout has {position.get('spaceNumber')!r}, equipment.csv has {record.get('spaceNumber')!r}."
            )
        for coordinate in ("x", "y"):
            value = position.get(coordinate)
            if not isinstance(value, (int, float)) or not 0 <= value <= 1000:
                errors.append(f"{unit_id} (layout position {position_number}), field {coordinate}: expected a number from 0 to 1000.")
    for unit_id, position_numbers in positions_by_id.items():
        if len(position_numbers) > 1:
            errors.append(f"{unit_id} (data/layout.json): duplicate map positions at entries {position_numbers}.")
    for row_number, record in records:
        if record.get("active", "").strip().lower() == "true" and record.get("unitId", "") not in positions_by_id:
            errors.append(
                f"{record.get('unitId') or f'CSV row {row_number}'}, field layout position: "
                "active equipment has no display position in data/layout.json."
            )

    return errors, len(records)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1], help="project root directory")
    args = parser.parse_args()
    errors, count = validate_project(args.root)
    if errors:
        print("Equipment data validation failed:")
        for error in errors:
            print(f" - {error}")
        return 1
    print(f"Equipment data validation passed: {count} records, controlled values and map positions checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
