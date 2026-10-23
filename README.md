# FF4820 Laboratory Equipment Status

A static, manually maintained equipment overview for the FF4820 laboratory. The dashboard is for situational awareness only; it is not a replacement for REES, Maintenance Connection, controlled equipment records, or approved alarm-response procedures.

## Architecture

This first release uses semantic HTML, CSS, and vanilla JavaScript. GitHub Pages serves the site as static files; there is no server, database, browser-based editing, or external integration.

- `data/equipment.csv` is the editable equipment register.
- `data/config.json` controls approved operational and monitoring vocabularies.
- `data/layout.json` holds editable simplified map coordinates.
- `app.js` loads and renders those files using relative URLs, so a repository subpath works.
- `scripts/validate_data.py` checks controlled values, required fields, duplicates, dates, URLs, and map coverage.
- `scripts/import_excel.py` is an optional, explicit, review-first utility for an approved `.xlsx` register. It is never run by the site or deployment.

Current equipment attributes were migrated from **FF4820 Map.xlsx**. The historic PowerPoint was used only as a visual reference for the approximate equipment arrangement. Differences and information requiring confirmation are listed in [DATA_REVIEW.md](DATA_REVIEW.md).

## Update one unit

1. Open `data/equipment.csv` in a spreadsheet editor or text editor.
2. Find the row by `unitId`.
3. Change only fields confirmed by an approved source. For an operational status change, update `operationalStatus`, `statusNote`, `dateReported` (when known), `lastUpdated`, and `updatedBy` (when known). Set `monitoringStatus` separately and only when confirmed.
4. Save the CSV as UTF-8, keeping its header and comma-separated format.
5. Run `py -3 scripts\validate_data.py` from the project folder.
6. Commit and push the change to `main` (or `master`). GitHub Actions republishes the site.

For the exact field rules and safe merge-conflict steps, see [UPDATE_GUIDE.md](UPDATE_GUIDE.md). Statuses must come from an approved operational source; do not infer a status from a setpoint, assignment, old slide, or missing data.

## Add equipment or adjust the map

Add a complete row to `data/equipment.csv` using the existing header, assign a unique `unitId`, and use `Unknown` for unconfirmed status fields. Then add its `unitId`, matching `spaceNumber`, and normalized `x`/`y` values to `data/layout.json`. Read the detailed guides in [UPDATE_GUIDE.md](UPDATE_GUIDE.md), then run the validator.

## Local preview and checks

Requires Python 3; no package installation is needed.

```powershell
py -3 scripts\validate_data.py
py -3 -m unittest discover -s tests
py -3 -m http.server 8000
```

Open `http://localhost:8000/` for the local preview. Stop the preview with Ctrl+C. For deployment-path testing, the site uses relative asset and data paths; a GitHub Pages URL such as `https://OWNER.github.io/REPOSITORY/` resolves them under that repository path.

The optional Excel review utility can be run manually against an approved workbook:

```powershell
py -3 scripts\import_excel.py "C:\path\to\approved-register.xlsx"
```

It prints a diff and does not write a file unless `--output C:\path\to\candidate.csv` is supplied. Review the candidate and diff before using it; new equipment still needs a reviewed map position.

## GitHub Pages deployment

The repository contains one deployment method: [`.github/workflows/pages.yml`](.github/workflows/pages.yml), which validates the data and publishes the static site artifact using GitHub Actions. A repository administrator must initialize Pages in **Settings → Pages** and select **GitHub Actions** before the first successful deployment.

Before enabling Pages, confirm the repository visibility and intended audience with the repository/organization owner. The workbook-derived inventory includes internal equipment, space, PBC, and REES input identifiers; do not publish it to an audience that is not approved for those values.

1. Push the project to the intended GitHub repository and default branch (`main` or `master`).
2. In **Settings → Pages**, set the publishing source to **GitHub Actions** and save. This first-time repository setting cannot be initialized by the workflow token.
3. Ensure repository or organization policy permits Pages and the workflow permissions `pages: write` and `id-token: write`.
4. Push to `main`/`master`, or run the workflow manually from **Actions → Deploy static site to GitHub Pages → Run workflow**.
5. Confirm the Actions run succeeds and open the Pages URL shown in the deployment job.

The site uses relative file references and is suitable for a repository subpath. The workflow copies the app entry point, styles, script, data, and linked owner documentation into the published artifact.

### Deployment troubleshooting

- **Blank page:** Open browser developer tools and inspect the network request for `app.js`; confirm the deployment job completed and refresh without a cached page.
- **404 error:** Check the Pages URL and repository name; the repository name is part of the URL for project Pages.
- **CSS not loading:** Confirm `styles.css` is included in the artifact and that the deployed HTML requests the relative `styles.css` path.
- **Data file not loading:** Check that `data/equipment.csv`, `data/config.json`, and `data/layout.json` exist in the Pages artifact and load successfully beneath the repository path.
- **Incorrect repository base path:** Keep app references relative (`styles.css`, `app.js`, `data/...`); do not change them to `/...` root paths.
- **GitHub Pages disabled by organization policy:** Ask the GitHub organization owner to enable Pages for the repository or approve an alternative host.
- **Pages build blocked by repository permissions:** Ask a repository administrator to enable Actions, Pages deployment, and the workflow permissions noted above; also check organization Actions policy.

## Data meaning and integrations

All current workbook rows are included in the inventory. The workbook does not provide current operational or monitoring status, so all migrated records start as `Unknown`; their generic status note is a migration prompt, not a recorded incident. A date is blank unless it was supplied. See [DATA_DICTIONARY.md](DATA_DICTIONARY.md), [DATA_REVIEW.md](DATA_REVIEW.md), and [INTEGRATION_NOTES.md](INTEGRATION_NOTES.md).

The dashboard displays register setpoints as **targets**, never as live measurements. No credentials, enterprise endpoints, or integration requests are included. Future integration boundaries remain disabled placeholders.
