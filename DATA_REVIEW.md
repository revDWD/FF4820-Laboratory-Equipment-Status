# Data migration review

This report records information gaps and differences found while migrating **FF4820 Map.xlsx** and inspecting **Incubation Room.pptx**. Excel is authoritative for current inventory fields. The PowerPoint is an older visual reference only; none of its historical purpose text was used to replace Excel values.

## Review required before operational use

1. **Current operational status was supplied by the owner, not the workbook.** The workbook has no status column. The owner confirmed units are operating, so 31 are `Operational`; INC-120 (purpose `OOO`) stays `Unknown`.
2. **Monitoring status is inferred.** Units with a REES input are `Connected`; FRZ-282 has none and is `Not Monitored`. Confirm against REES.
3. **Incident information is absent.** Current notes, date reported, last reviewed date, updated-by owner, next action, maintenance references, REES references, and status history are not present in the approved workbook fields. Those cells remain blank; `statusNote` states only that a current status was not provided in the source.
4. **PBC number is missing for `FRZ-365`** (space 24). The value is left blank, not inferred.
5. **Excel-only notes need an owner to place them.** The source worksheet has additional notes outside the listed equipment columns: `CS-STL-SOP-1002 section 4.1.7` near `I1601` and `Humidity = ± 10%` near `INC-90`. They were not mapped to an equipment field because their intended meaning and scope are not explicit. Confirm whether these belong in a controlled reference or equipment record.
6. **Inventory inclusion is not an operational status.** `active=true` means the row appears in the provided equipment register and is included in this initial inventory. Confirm whether any record should be excluded or marked retired.

## Excel and PowerPoint differences retained for review

The current site preserves Excel values where readable historical PowerPoint labels differ. None of the older slide values were used to set status or overwrite the current purpose:

| Unit ID | Excel current value | Historical slide value(s) | Treatment |
|---|---|---|---|
| `I840` | `Tribolium` | Slide 1 `I840?`; slide 2 `GLW` | Excel preserved; slide 1 is ambiguous and slide 2 is an older assignment. |
| `I2377` | `Leps` | Slide 1 `Monarch`; slide 2 `BEB rearing` | Excel preserved; confirm assignment only through an approved source. |
| `I1601` | `Empty` | Slide 2 `WCR/SCR Rearing` | Excel preserved; slide 1's `empty` agrees with Excel. |
| `I1383` | `PWA` | Slide 2 `Corn Roots` | Excel preserved; slide 1's `PWA` agrees with Excel. |
| `INC-94` | `Leps` | Slide 2 `CFF` | Excel preserved. |
| `INC-93` | `Leps` | Slide 2 `MBB assays` | Excel preserved. |
| `INC-71` | `GLW Bioassay` | Slide 2 `NBS Assay` | Excel preserved; slide 1's `GLW bioassay` agrees. |
| `INC-63` | `Leps` | Slide 2 `NBSB Rearing` | Excel preserved; slide 1's `Leps` agrees. |
| `I3413` | `Rootworm Handling` | Slide 2 `Pollen Germ` | Excel preserved; slide 1's `Rootworm Handling` agrees. |
| `FRZ-248` | `Disposal Weekday` | Slide 2 `Elsa` | Excel preserved; slide 1's `Weekday Disposal` agrees in meaning. |
| `F3212` | `Disposal Weekday` | Slide 2 `Anna` | Excel preserved; slide 1's `Weekday Disposal` agrees in meaning. |
| `FRZ-353` | `Sample Storage- working freezer` | Slide 1 `Buffer Freezer`; slide 2 `Buffer/working` | Excel preserved; confirm only through an approved source. |
| `INC-111` | `Leps` | Slide 2 `Corn Rolls` | Excel preserved; slide 1's `Leps` agrees. |
| `I3213` | `NBSB Rearing and Handling` | Slide 2 `WCR` | Excel preserved; slide 1's `NBSB rearing and handling` agrees. |
| `INC-112` | `WCR Assays` | Slide 1 `WCR` (grouped); slide 2 `Monarch` | Excel preserved; slide 1 is abbreviated and slide 2 is an older assignment. |
| `INC-113` | `WTP, CPB, MBB Receiving` | Slide 1 `WTP, CPB, MBB Storage` (grouped); slide 2 `Cold storage` | Excel preserved; slide 1 is grouped and differs on Receiving/Storage. |
| `R2192` | `Buffer/Chem Storage` | Slides 1 and 2 `Buffers` | Excel preserved; older label is abbreviated. |
| `FRZ-343` | `Buffer/Chemical Storage` | Slides 1 and 2 `Chemicals` | Excel preserved; older label is less specific. |
| `FRZ-335` | `Sample Storage- long term storage` | Slide 1 `Long-term storage`; slide 2 `Long-term` | Excel preserved; older labels are abbreviated. |
| `FRZ-342` | `Sample Storage- half working and DC samples` | Slide 1 `Working DC samples`; slide 2 `working DC` | Excel preserved; older labels are abbreviated. |

Slide 2 also labels an `I2378` as `OOO`; there is no `I2378` Unit ID in the current Excel inventory, so it was not added. The `OOO` value on Excel's `INC-120` row remains its purpose/program, not an operational status.

Slide 1 groups the purpose text for `INC-112` and `INC-113` visually; the workbook provides separate current records and setpoints. Each remains a separate unit in the site.

## Source values preserved without interpretation

- Excel `OOO` for `INC-120` is retained as its **purpose/program**. It was not converted into `Out of Service`.
- `Ambient` and `n/a` values are preserved as written.
- REES strings `N4 52` and `N4 5` for `FRZ-281` and `REFG-116` are preserved exactly. Confirm their intended labels; they are not silently corrected.
- Humidity `0.6`, `0.7`, `0.75`, and `0.8` are retained exactly; no units or percentage interpretation was added.
- Temperature values are shown as setpoints and not as measured or live values.

## Facility map and layout

The facility-first map background is the numbered plan embedded in `FF4820 Map.xlsx` (1024 × 576 pixels). `data/layout.json` stores normalized marker centers digitized from its numbered equipment locations. The map includes spaces 30–32 in neighboring rooms, as shown in the source image; those positions are not silently moved into FF4820. Spaces 19 and 20 are shown together as `19/20` on the source plan, so their interactive markers are offset slightly within that shared map label to keep both records selectable.

`Incubation Room.pptx` remains a historic visual reference and helps explain older arrangement/assignment differences above; it was not used to set current statuses or replace the workbook map. The digitized positions reproduce the source map, but the source does not establish surveyed coordinates or guarantee present-day placement. Confirm locations in the room before relying on the map for navigation.
