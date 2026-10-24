# Update guide

The site is a static view of files in the repository. Browser interactions do not save changes. Edit the CSV, validate it, then commit and push it so GitHub Pages republishes the site.

## How to update one unit

1. Open `data/equipment.csv` and find the exact `unitId` row.
2. Confirm the current value in the approved source or procedure.
3. Change only the appropriate columns:
   - `operationalStatus`: one approved operational value.
   - `monitoringStatus`: separately set only from a confirmed approved source.
   - `statusNote`: concise current context, if known.
   - `dateReported`: report date if known (`YYYY-MM-DD`).
   - `lastUpdated`: date status was checked/changed (`YYYY-MM-DD`).
   - `updatedBy`: editor name only when appropriate for the audience.
   - `nextAction`: only a confirmed next action; otherwise keep empty.
4. Save as UTF-8 CSV and do not change the header.
5. Run `py -3 scripts\validate_data.py` and fix any row/field it identifies.
6. Commit the one data-file change and push to `main` or `master`.
7. After the Pages workflow succeeds, reload the published page. The status and summary are calculated from the CSV.

Example: to report a confirmed unit as out of service, update its one row's `operationalStatus` to `Out of Service`, add an accurate `statusNote`, and fill date/owner/action fields only when known. Never change temperature setpoint to represent a measured reading.

## How to add new equipment

1. Confirm the new unit in the approved inventory source and gather its exact Unit ID, space, type, and available attributes.
2. Add a CSV row with all 20 columns in the existing header order. Use an empty field for unavailable optional information and `Unknown` for unconfirmed operational or monitoring status.
3. Set a unique `displayOrder` and `active=true` if it belongs in the active inventory. Do not set `Operational` by default.
4. Add an entry to `data/layout.json` with the exact `unitId`, same `spaceNumber`, and approximate integer `x`/`y` coordinates from 0 to 1000. These are normalized coordinates on the supplied facility-map image; place the marker at the center of the corresponding numbered location. The map is not an architectural drawing.
5. Run the validator and inspect the local preview before committing.

## How to move equipment on the map

1. Open `data/layout.json` and find the unit's `unitId`.
2. Edit `x` and `y` only. Coordinates are normalized from 0 (top/left) to 1000 (bottom/right) on the facility-map image. Place the marker at the center of the numbered location and verify its physical placement in the room; the source is not surveyed.
3. Do not change the equipment's physical `spaceNumber` in the layout without changing the matching approved CSV data as well.
4. Run `py -3 scripts\validate_data.py`, then inspect the local preview at desktop and tablet sizes.

Active equipment must have a unique space number unless an owner confirms that multiple units share a space. Only then add that exact space number to `allowedSharedSpaceNumbers` in `data/config.json`; do not suppress duplicate-space errors without that confirmation.

## How to resolve CSV merge conflicts

1. Do not choose “accept all” if another edit changed a different status row.
2. Open the conflict-marked `data/equipment.csv` in a text editor. Remove `<<<<<<<`, `=======`, and `>>>>>>>` marker lines.
3. Keep the header once. For each affected Unit ID, compare fields from both edits with the approved source and retain the intended value in each column. A CSV row is one record; do not combine cell fragments or leave partial lines.
4. Preserve quotes around fields containing commas, such as `WTP, CPB, MBB Receiving`.
5. Run `py -3 scripts\validate_data.py`; check duplicate IDs/spaces, missing fields, and controlled statuses.
6. Preview the affected equipment before committing the resolved file. Ask the other editor if the intended status or note cannot be established.

## Local preview and test commands (Windows)

From the project folder:

```powershell
py -3 scripts\validate_data.py
py -3 -m unittest discover -s tests
py -3 -m http.server 8000
```

Visit `http://localhost:8000/` and stop the server with Ctrl+C. No package install is required.
