# Data dictionary

The editable source is `data/equipment.csv`. Keep the header names and order unchanged. Use UTF-8 CSV; quote fields that contain commas or quotation marks. Empty cells mean the source has not supplied a value. Do not use a blank value as a substitute for an unknown operational or monitoring status: use the controlled value `Unknown`.

## Equipment record fields

| Field | Required for active records | Meaning and allowed form |
|---|---|---|
| `spaceNumber` | Yes | Physical space number from the Excel register; text to preserve source formatting. |
| `unitId` | Yes | Exact equipment Unit ID. Must be unique. |
| `unitType` | Yes | `Incubator`, `Freezer`, or `Refrigerator`. |
| `purpose` | Yes | Purpose/program as recorded in the workbook. |
| `operationalStatus` | Yes | One value from the operational vocabulary below. Never infer it. |
| `monitoringStatus` | Yes | One value from the monitoring vocabulary below. Never infer it. |
| `temperatureSetpoint` | No | Target temperature from the register (for example `25°C`); not a live measurement. |
| `humiditySetpoint` | No | Target humidity or source value such as `Ambient` or `n/a`. |
| `lightCycle` | No | Light cycle from the register, including source `n/a` values. |
| `reesInput` | No | REES input label/reference from the register; not a permanent equipment identifier or current reading. |
| `pbcNumber` | No | PBC number as text, preserving leading digits. |
| `statusNote` | No | Current human-maintained status note, if provided. |
| `dateReported` | No | Date a status item was reported, ISO `YYYY-MM-DD`. |
| `lastUpdated` | No | Date this row's status information was last reviewed, ISO `YYYY-MM-DD`. This drives the header's “Data last updated” value. |
| `updatedBy` | No | Person who made the status update, if provided and appropriate for the audience. |
| `nextAction` | No | Confirmed next action only; leave blank when none is supplied. |
| `maintenanceReference` | No | Approved Maintenance Connection reference or URL. Plain asset references are allowed; URLs must use HTTP or HTTPS and contain no credentials. |
| `reesReference` | No | Approved REES reference or URL. Plain references are allowed; URLs must use HTTP or HTTPS and contain no credentials. |
| `displayOrder` | Yes | Integer used for consistent inventory order. |
| `active` | Yes | `true` to include the equipment in the active list/map, `false` to retain a non-active record without showing it as active. This is an inventory inclusion flag, not an operational status. |

## Controlled status vocabulary

### Operational status

`Operational`, `Attention Needed`, `Out of Service`, `Under Maintenance`, `Reserved`, `Temporarily Unavailable`, `Monitoring Disconnected`, `Retired`, `Unknown`.

### Monitoring status

`Connected`, `Alarm`, `Inhibited`, `Disconnected`, `Not Monitored`, `Unknown`.

Keep operational status and monitoring status separate. `Unknown` means the approved source did not provide a confirmed current value. Setpoint, assignment, or slide text does not determine either status.

## Sample equipment record

The first inventory record is a sample using source attributes and explicitly unconfirmed status. It is a real migrated source row, not fabricated equipment. Its initial current-status note is a migration prompt.

```csv
spaceNumber,unitId,unitType,purpose,operationalStatus,monitoringStatus,temperatureSetpoint,humiditySetpoint,lightCycle,reesInput,pbcNumber,statusNote,dateReported,lastUpdated,updatedBy,nextAction,maintenanceReference,reesReference,displayOrder,active
1,INC-120,Incubator,OOO,Unknown,Unknown,25°C,0.7,0 L : 24 D,97 T/98 RH,300000000408253,Current status not provided in source.,,,,,,,1,true
```

## Data presentation rules

- Missing values display as **Not provided**.
- Unknown controlled values display as **Unknown** and are included in the review queue.
- Setpoints are target conditions, not live readings.
- A REES input is a monitoring reference, not a stable asset identifier.
- No status history, current measured values, maintenance events, or external provider data is implied unless explicitly supplied.
