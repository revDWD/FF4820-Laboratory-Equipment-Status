# Integration notes

## Current release

This application is static and has no connection to REES, Maintenance Connection, an enterprise network, or a system of record. The CSV is manually maintained and GitHub Pages publishes static files. The dashboard does not show live temperature, humidity, alarms, maintenance tickets, or validated records.

The current application defines disabled, no-network boundaries in `app.js`:

- `StaticEquipmentProvider` loads `data/equipment.csv`.
- `StaticStatusProvider` loads `data/config.json`.
- `ReesMonitoringProviderPlaceholder` documents possible approved monitoring inputs but does not make requests.
- `MaintenanceConnectionProviderPlaceholder` documents possible approved asset references but does not make requests.

No credentials or confidential endpoint addresses are included. Do not add browser credentials, tokens, undocumented APIs, or integrations that bypass authentication, CORS, or network controls.

## Future connector approval checklist

Before implementing any provider:

1. Obtain written approval for the data source, audience, access pattern, and fields that may be displayed.
2. Use documented, approved, read-only interfaces. Confirm enterprise network, authentication, CORS, and public-site exposure requirements with IT/security.
3. Decide how a stable equipment Unit ID maps to an approved PBC/asset reference. Do not treat a REES input number as a permanent equipment identifier.
4. Define which source owns each field, refresh/availability semantics, and a safe unavailable/error state. Keep the static page useful without a connector.
5. Separate physical equipment, `unitId`, `spaceNumber`, PBC/asset reference, REES input, and maintenance reference. Avoid conflating identifiers.
6. Do not label a value live, validated, or official unless the provider and its behavior justify that claim.

No connector should silently replace manually reviewed status notes, status history, or the source inventory. A future Excel importer is optional, manual, and review-first; it produces a diff and candidate file only when explicitly requested.
