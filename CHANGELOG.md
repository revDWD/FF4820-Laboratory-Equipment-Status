# Changelog

All user-visible changes to the FF4820 Insect Bioassay Operations Center are recorded here.
The project follows [Semantic Versioning](https://semver.org/): **MAJOR** for breaking data-format changes, **MINOR** for new user-visible features, **PATCH** for fixes and data-only updates.

**Maintainers:** when you change a feature, add a bullet under `Unreleased`. When you publish, rename that heading to the new version and date, and update `version` and `versionName` in `data/config.json` (shown in the page footer; the validator rejects an invalid version).

## Unreleased

## [1.2.0] - 2026-10-25 - UX Refinement Release

- Renamed the app to **FF4820 Insect Bioassay Operations Center** with a larger title.
- Added the associated insect species to every incubator: shown in the map hover card, the detail card, the equipment list, and map search. New `species` and `speciesGroup` data columns drive it.
- Redesigned the equipment detail card: status, species, and target conditions (temperature, humidity, light cycle) now lead; empty and duplicate fields were removed.
- Equipment now reports real operating status; the map shows 31 of 32 units available. INC-120 stays unconfirmed because its register purpose is `OOO`.
- Removed the "Most recent review" text, the "About this data" panel, the map footnote, and the footer link list. "Manually maintained" remains in the header.
- Added "Designed and maintained by DWD" and the version number to the footer.

## [1.1.0] - 2026-10-24 - Facility Map Enhancement Release

- Facility map is now the first and largest element, built from the FF4820 workbook floor plan.
- Status-colored markers (green, blue, yellow, orange, red), readiness count, status filters, search, and hover cards.
- Removed the situational-awareness banner, summary cards, equipment index, and the meaningless "?" marker glyph.
- Dark theme and expanded status vocabulary with a color tone per status.

## [1.0.0] - 2026-10-23 - Initial Laboratory Equipment Dashboard

- First static dashboard: equipment register (CSV), searchable list, attention queue, and detail dialog.
- Data validator, unit tests, and GitHub Pages deployment.
