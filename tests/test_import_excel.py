import csv
import json
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
from import_excel import merge_register


class ExcelImportMergeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config = json.loads((PROJECT_ROOT / "data" / "config.json").read_text(encoding="utf-8"))
        cls.fields = config["csvFields"]
        with (PROJECT_ROOT / "data" / "equipment.csv").open(encoding="utf-8-sig", newline="") as handle:
            cls.current = next(csv.DictReader(handle))
        cls.source = {
            "spaceNumber": "1",
            "unitId": "INC-120",
            "unitType": "Incubator",
            "purpose": "Updated source purpose",
            "reesInput": "97 T/98 RH",
            "temperatureSetpoint": "25°C",
            "humiditySetpoint": "0.7",
            "lightCycle": "0 L : 24 D",
            "pbcNumber": "300000000408253",
        }

    def test_existing_managed_status_and_notes_are_preserved(self):
        current = dict(self.current)
        current.update({
            "operationalStatus": "Out of Service",
            "monitoringStatus": "Alarm",
            "statusNote": "Manually maintained incident note",
            "lastUpdated": "2026-10-23",
        })
        merged = merge_register([(2, self.source)], [current], self.fields)[0]
        self.assertEqual(merged["purpose"], "Updated source purpose")
        self.assertEqual(merged["operationalStatus"], "Out of Service")
        self.assertEqual(merged["monitoringStatus"], "Alarm")
        self.assertEqual(merged["statusNote"], "Manually maintained incident note")
        self.assertEqual(merged["lastUpdated"], "2026-10-23")

    def test_new_source_record_starts_with_unknown_status(self):
        source = dict(self.source)
        source["unitId"] = "NEW-UNIT"
        merged = merge_register([(2, source)], [], self.fields)[0]
        self.assertEqual(merged["operationalStatus"], "Unknown")
        self.assertEqual(merged["monitoringStatus"], "Unknown")
        self.assertEqual(merged["active"], "true")
        self.assertEqual(merged["statusNote"], "Current status not provided in source.")
        self.assertEqual(merged["nextAction"], "")


if __name__ == "__main__":
    unittest.main()
