# FF4820 Laboratory Equipment Status: Project Context

## Purpose and operating boundary

This is a static GitHub Pages dashboard for laboratory situational awareness. It is not a replacement for REES, Maintenance Connection, controlled equipment records, or approved monitoring and alarm-response procedures. Do not describe the app as live, validated, compliant, or a system of record.

Before publishing, confirm that repository visibility and audience are approved for the workbook-derived equipment, room, PBC, and REES-input identifiers.

## Data authority and migration decisions

- `data/equipment.csv` is the editable runtime inventory. The primary source was `FF4820 Map.xlsx`; all 32 current workbook records were migrated.
- `data/config.json` contains the controlled status vocabularies and CSV field order.
- `data/layout.json` contains editable normalized marker centers digitized from the numbered facility map embedded in `FF4820 Map.xlsx`. `images/ff4820-facility-map.png` is the published map background. The historic `Incubation Room.pptx` is a visual cross-reference, not a source of current status or equipment assignments.
- Excel takes precedence for current equipment attributes. Do not use old slide assignments to overwrite Excel values or infer current status.
- Operational status and monitoring status are separate controlled values. Never infer either from purpose, a setpoint, historical slide text, or missing data.
- Units are `Operational` per owner confirmation; INC-120 remains `Unknown`. Do not invent incident dates, owners, next actions, or references. Species values are owner-confirmable inferences from register abbreviations.
- Keep the map first under the header; do not reintroduce a situational-awareness banner, equipment index, "?" marker glyph, or "About this data" panel. "Manually maintained" lives only in the header pill.
- User-visible changes need a `CHANGELOG.md` entry and, when released, a semver bump in `data/config.json`.
- Setpoints are target conditions, never live readings. REES input is a monitoring reference, not a permanent equipment identifier.
- `DATA_REVIEW.md` records source discrepancies, missing values, historical labels, unmapped workbook notes, and map assumptions. Keep it current when reviewed or corrected.

## Architecture

The app uses semantic HTML, CSS, and dependency-free browser JavaScript. `app.js` loads CSV and JSON using relative paths so it works under a GitHub Pages repository subpath. There is no backend, database, browser-persisted editing, credential, or live enterprise connector.

`StaticEquipmentProvider` and `StaticStatusProvider` load local published data. REES and Maintenance Connection provider placeholders are disabled and must not make network calls. Any future connector needs explicit audience, security, source-of-truth, access, and read-only approvals; keep the static experience useful without integrations.

Maintain the existing three views: facility map, searchable/filterable equipment list, and attention queue. The map sits directly under the header and is the focal view; do not add a banner or a duplicate equipment index beneath it. Keep readiness counts data-derived. Markers are colored by status tone (`statusTones`), with a hover/focus popup for details and a monitoring-alert badge. Preserve keyboard access, visible focus, status text plus color, tablet/mobile list access, reduced-motion support, useful loading errors, and print styles.

## Safe data updates

- Update a unit by editing its row in `data/equipment.csv`; routine status changes must not require app-code changes.
- Use only approved status vocabulary from `data/config.json`.
- Dates are ISO `YYYY-MM-DD`. Leave optional fields empty when not supplied.
- Keep the CSV header and order aligned with `csvFields`; quote values containing commas.
- Active unit IDs must each have a map position in `data/layout.json`, matching the equipment `spaceNumber`. The source groups spaces 19 and 20, so their separate interactive markers are intentionally offset within that shared source-map label.
- Active space numbers must be unique unless an owner confirms sharing. Only then add the confirmed value to `allowedSharedSpaceNumbers` in `data/config.json`.
- Do not silently overwrite status fields or notes when importing workbook inventory changes. The optional `scripts/import_excel.py` prints a review diff and only writes to an explicitly named separate candidate file.
- Avoid committing credentials, tokens, internal session data, confidential endpoints, or unapproved personal data.

Read `DATA_DICTIONARY.md` for field meanings, `UPDATE_GUIDE.md` for row/map/conflict instructions, and `INTEGRATION_NOTES.md` for connector boundaries.

## Validation and local preview

Python 3 is sufficient; there are no package installs.

```powershell
py -3 scripts\validate_data.py
py -3 -m unittest discover -s tests
py -3 -m http.server 8000
```

Open `http://localhost:8000/` for preview. Validation checks required fields, IDs, duplicate spaces, controlled statuses, date format, URL safety, and active map coverage. Keep errors record/field specific and update/add tests when changing these rules.

## GitHub Pages deployment

`.github/workflows/pages.yml` is the single deployment method. It runs unit tests and data validation, then deploys the app, data, and owner documentation. Configure **Settings → Pages → GitHub Actions** and ensure organization policy permits Pages with `pages: write` and `id-token: write`.

The workflow is configured for pushes to `main` or `master` and manual dispatch. Preserve relative asset/data links; do not introduce root-relative URLs. Follow deployment and troubleshooting instructions in `README.md`.

## Source review and acceptance

When editing, inspect current files and preserve unrelated changes. Validate the exact behavior changed. Browser-check status propagation across map, list, attention, summary, and detail; verify desktop tiles do not overlap, mobile/tablet have no horizontal overflow, and list/attention print views remain usable.

The current migration intentionally leaves unresolved: all current operational/monitoring statuses and update dates; missing PBC for `FRZ-365`; Excel notes whose scope is unclear; unusual REES labels `N4 52` and `N4 5`; legacy PowerPoint assignment disagreements; and whether the digitized map positions still match current physical locations. See `DATA_REVIEW.md` rather than guessing.
