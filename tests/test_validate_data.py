import csv
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
from validate_data import validate_project


class EquipmentDataValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        shutil.copytree(PROJECT_ROOT / "data", self.root / "data")
        if (PROJECT_ROOT / "images").is_dir():
            shutil.copytree(PROJECT_ROOT / "images", self.root / "images")

    def tearDown(self):
        self.temp_dir.cleanup()

    def read_records(self):
        path = self.root / "data" / "equipment.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            return reader.fieldnames, list(reader)

    def write_records(self, fields, records):
        with (self.root / "data" / "equipment.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
            writer.writeheader()
            writer.writerows(records)

    def errors(self):
        return validate_project(self.root)[0]

    def test_current_register_and_layout_are_valid(self):
        errors, count = validate_project(self.root)
        self.assertEqual(errors, [])
        self.assertEqual(count, 32)

    def test_duplicate_unit_id_is_reported(self):
        fields, records = self.read_records()
        records[1]["unitId"] = records[0]["unitId"]
        self.write_records(fields, records)
        self.assertTrue(any("Duplicate Unit ID" in error for error in self.errors()))

    def test_unapproved_duplicate_space_is_reported(self):
        fields, records = self.read_records()
        records[1]["spaceNumber"] = records[0]["spaceNumber"]
        self.write_records(fields, records)
        self.assertTrue(any("Duplicate active spaceNumber '1'" in error for error in self.errors()))

    def test_invalid_status_identifies_field_and_unit(self):
        fields, records = self.read_records()
        records[0]["operationalStatus"] = "Working"
        self.write_records(fields, records)
        errors = self.errors()
        self.assertTrue(any("INC-120" in error and "operationalStatus" in error for error in errors))

    def test_invalid_date_is_reported(self):
        fields, records = self.read_records()
        records[0]["lastUpdated"] = "10/23/2026"
        self.write_records(fields, records)
        self.assertTrue(any("lastUpdated" in error and "YYYY-MM-DD" in error for error in self.errors()))

    def test_active_unit_without_map_position_is_reported(self):
        path = self.root / "data" / "layout.json"
        layout = json.loads(path.read_text(encoding="utf-8"))
        layout["equipment"] = [item for item in layout["equipment"] if item["unitId"] != "INC-120"]
        path.write_text(json.dumps(layout), encoding="utf-8")
        self.assertTrue(any("INC-120" in error and "no display position" in error for error in self.errors()))

    def test_missing_map_background_is_reported(self):
        (self.root / "images" / "ff4820-facility-map.png").unlink()
        self.assertTrue(any("background.image: file not found" in error for error in self.errors()))

    def test_absolute_map_background_path_is_reported(self):
        path = self.root / "data" / "layout.json"
        layout = json.loads(path.read_text(encoding="utf-8"))
        layout["background"]["image"] = str(self.root / "images" / "ff4820-facility-map.png")
        path.write_text(json.dumps(layout), encoding="utf-8")
        self.assertTrue(any("background.image: image path must be relative" in error for error in self.errors()))

    def test_map_background_dimensions_are_checked(self):
        path = self.root / "data" / "layout.json"
        layout = json.loads(path.read_text(encoding="utf-8"))
        layout["background"]["width"] += 1
        path.write_text(json.dumps(layout), encoding="utf-8")
        self.assertTrue(any("background dimensions do not match" in error for error in self.errors()))

    def test_status_without_color_tone_is_reported(self):
        path = self.root / "data" / "config.json"
        config = json.loads(path.read_text(encoding="utf-8"))
        del config["statusTones"]["Calibration Due"]
        path.write_text(json.dumps(config), encoding="utf-8")
        self.assertTrue(any("Calibration Due" in error and "statusTones" in error for error in self.errors()))

    def test_unknown_species_group_is_reported(self):
        fields, records = self.read_records()
        records[0]["speciesGroup"] = "spiders"
        self.write_records(fields, records)
        self.assertTrue(any("INC-120" in error and "speciesGroup" in error for error in self.errors()))

    def test_invalid_version_is_reported(self):
        path = self.root / "data" / "config.json"
        config = json.loads(path.read_text(encoding="utf-8"))
        config["version"] = "v1.2"
        path.write_text(json.dumps(config), encoding="utf-8")
        self.assertTrue(any("semantic version" in error for error in self.errors()))

    def test_unsafe_reference_is_reported(self):
        fields, records = self.read_records()
        records[0]["reesReference"] = "javascript:alert(1)"
        self.write_records(fields, records)
        self.assertTrue(any("INC-120" in error and "reesReference" in error for error in self.errors()))

    def test_malformed_url_is_reported(self):
        fields, records = self.read_records()
        records[0]["maintenanceReference"] = "https://example.com:99999/asset"
        self.write_records(fields, records)
        self.assertTrue(any("INC-120" in error and "maintenanceReference" in error for error in self.errors()))


if __name__ == "__main__":
    unittest.main()
