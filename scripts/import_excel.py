#!/usr/bin/env python3
"""Create a reviewable equipment.csv update from an approved .xlsx register.

This optional utility makes no network calls and never edits the workbook.
It prints a diff by default. Supply --output explicitly to write a candidate CSV.
"""

import argparse
import csv
import difflib
import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
SOURCE_HEADERS = {
    "Space #": "spaceNumber",
    "Unit ID": "unitId",
    "Unit Type": "unitType",
    "Purpose / Program": "purpose",
    "REES Input": "reesInput",
    "Temperature Setpoint": "temperatureSetpoint",
    "Humidity Setpoint": "humiditySetpoint",
    "Light Cycle": "lightCycle",
    "PBC #": "pbcNumber",
}
SOURCE_FIELDS = tuple(SOURCE_HEADERS.values())
NEW_STATUS_NOTE = "Current status not provided in source."


def column_index(reference):
    letters = re.match(r"[A-Z]+", reference)
    if not letters:
        raise ValueError(f"Invalid Excel cell reference {reference!r}.")
    value = 0
    for character in letters.group(0):
        value = value * 26 + ord(character) - ord("A") + 1
    return value - 1


def workbook_rows(path):
    ns = {"m": MAIN_NS, "r": REL_NS, "p": PKG_REL_NS}
    with zipfile.ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            strings = [
                "".join(node.text or "" for node in item.findall(".//m:t", ns))
                for item in shared.findall("m:si", ns)
            ]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relation_file = "xl/_rels/workbook.xml.rels"
        relations = ET.fromstring(archive.read(relation_file))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relations.findall("p:Relationship", ns)}
        first_sheet = workbook.find("m:sheets/m:sheet", ns)
        if first_sheet is None:
            raise ValueError("Workbook does not contain a worksheet.")
        target = targets[first_sheet.attrib[f"{{{REL_NS}}}id"]]
        if target.startswith("/"):
            sheet_path = target.lstrip("/")
        else:
            sheet_path = posixpath.normpath(posixpath.join("xl", target))
        root = ET.fromstring(archive.read(sheet_path))
        result = []
        for row in root.findall(".//m:sheetData/m:row", ns):
            values = {}
            for cell in row.findall("m:c", ns):
                value = cell.find("m:v", ns)
                content = value.text if value is not None else ""
                cell_type = cell.attrib.get("t")
                if cell_type == "s" and content:
                    content = strings[int(content)]
                elif cell_type == "inlineStr":
                    content = "".join(node.text or "" for node in cell.findall(".//m:t", ns))
                values[column_index(cell.attrib["r"])] = content or ""
            if values:
                result.append([values.get(index, "") for index in range(max(values) + 1)])
    if not result:
        raise ValueError("Workbook worksheet is empty.")
    headers = result[0]
    missing_headers = [header for header in SOURCE_HEADERS if header not in headers]
    if missing_headers:
        raise ValueError(f"Workbook is missing approved columns: {', '.join(missing_headers)}.")
    output = []
    for row_number, values in enumerate(result[1:], start=2):
        values.extend([""] * max(0, len(headers) - len(values)))
        record = {
            field: str(values[headers.index(source)]).strip()
            for source, field in SOURCE_HEADERS.items()
        }
        if record["unitId"]:
            output.append((row_number, record))
    return output


def read_current(csv_path, fields):
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != fields:
            raise ValueError("Current equipment.csv headers do not match data/config.json.")
        return list(reader)


def merge_register(source_records, current_records, fields):
    merged = [dict(record) for record in current_records]
    by_id = {record["unitId"]: record for record in merged}
    for display_order, (row_number, source) in enumerate(source_records, start=1):
        unit_id = source["unitId"]
        if unit_id in by_id:
            target = by_id[unit_id]
            for field in SOURCE_FIELDS:
                target[field] = source[field]
            target["displayOrder"] = str(display_order)
        else:
            target = {field: "" for field in fields}
            target.update(source)
            target.update({
                "operationalStatus": "Unknown",
                "monitoringStatus": "Unknown",
                "speciesGroup": "unspecified",
                "statusNote": NEW_STATUS_NOTE,
                "displayOrder": str(display_order),
                "active": "true",
            })
            by_id[unit_id] = target
            merged.append(target)
    return merged


def csv_text(records, fields):
    from io import StringIO

    output = StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(records)
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path, help="approved Excel workbook to read")
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--output", type=Path, help="write a candidate CSV here (never overwrites the current data file)")
    args = parser.parse_args()
    try:
        config = json.loads((args.data_dir / "config.json").read_text(encoding="utf-8"))
        fields = config["csvFields"]
        current = read_current(args.data_dir / "equipment.csv", fields)
        source = workbook_rows(args.workbook)
        candidate = merge_register(source, current, fields)
        current_csv = (args.data_dir / "equipment.csv").resolve()
        if args.output and args.output.resolve() == current_csv:
            raise ValueError("--output must be a separate candidate file; it cannot replace data/equipment.csv.")
        before = csv_text(current, fields).splitlines(keepends=True)
        after = csv_text(candidate, fields).splitlines(keepends=True)
        diff = "".join(difflib.unified_diff(
            before, after,
            fromfile="current equipment.csv",
            tofile="candidate equipment.csv",
        ))
        print(diff or "No source-managed field changes found.")
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text("".join(after), encoding="utf-8", newline="")
            print(f"Candidate written to {args.output}. Review it before replacing the maintained data file.")
        print("Operational status, monitoring status, status notes, dates, owners, next actions, and approved references are preserved.", file=sys.stderr)
    except (OSError, KeyError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        print(f"Excel import review failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
