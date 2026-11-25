English | [Italiano](configuration.it.md)

# Configuration

JSpider reads `config.local.json` from the extension root. The tracked
`config.example.json` contains every supported key and placeholder values.

For source builds, keep `config.local.json` in the repository root. `npm run
build` copies it into `dist/`; the copied local file remains ignored although
the compiled directory is tracked. For a downloaded release, create the file
directly beside the extracted `manifest.json`.

## Fields

| Key | Purpose |
| --- | --- |
| `taskflowBaseUrl` | TaskFlow origin, without `/api/v1` |
| `taskflowToken` | Administrative Bearer token used by the TaskFlow WebUI and API client |
| `tmdbCredential` | TMDB read-access token or v3 API key |
| `omdbApiKey` | OMDb API key used only as a fallback for awards missing from MDBList |
| `mdblistApiKey` | MDBList API key used for read-only ratings and awards lookup |
| `embyBaseUrl` | HTTPS origin of the Emby server |
| `embyToken` | Emby API token sent only through the `X-Emby-Token` header |
| `_logDirectory` | Full `log` folder path, shown in clear text and automatically aligned by JSpider's picker |

TaskFlow, TMDB, OMDb, and MDBList values can also be saved from the JSpider
settings panel. Every property explicitly present in `config.local.json`,
including an empty value, takes precedence and is synchronized to
`chrome.storage.local`. Edge storage is only a fallback for properties absent
from the JSON. During the current test phase those settings fields
intentionally show their values in clear text.

Emby is configured only through `config.local.json`. Its lookup is read-only,
uses the validated TMDB ID when available, and falls back to title/year only
after the explicit fallback choice.

## Secret handling

- `config.local.json`, `.env*`, keys, certificates, and `release/` are ignored
  by Git. The compiled `dist/` directory is tracked, but any
  `dist/config.local.json` remains ignored by the basename rule.
- Release packaging explicitly excludes `config.local.json` even when a local
  build copied it into `dist/`.
- TaskFlow and Emby tokens are not placed in request URLs or rendered in the
  Emby status panel. MDBList requires its key in the query string; JSpider
  redacts it from network and HTTP error messages.
- Use HTTPS endpoints for TaskFlow and Emby so credentials are encrypted in
  transit.

Never replace placeholders in `config.example.json` with real credentials.

## Quick Workflow log folder

Enter the complete `log` directory path and use **Settings → Align project
folder and config**. In the extension page, select the project root (`JSpider`
or `JSpider-follow-season`), not the `log` folder. JSpider verifies that the
entered path belongs to the selected root, creates `log` when missing, stores
Chromium's authorization, and updates both the root and `dist`
`config.local.json` files when `dist` exists. Other values, including keys and
tokens, are preserved.

The **CONFIG AND CHROMIUM ALIGNED** state confirms that the complete JSON path
matches the path authorized by the browser. **CONFIG MISSING**, **CHROMIUM NOT
AUTHORIZED**, and **NOT ALIGNED** identify which side still needs attention.

When Chromium already stores a previous `log` handle, use **Confirm previously
authorized folder** to associate the visible full path with that handle without
opening the picker again. This is also the recommended path on Chromium 157 for
Windows versions affected by the regression that may incorrectly return an
`AbortError` after a valid selection.

Each Quick Workflow run creates one readable JSON file prefixed with its local
start date/time and followed by the workflow name. Sorting the directory by
filename therefore produces chronological order. JSpider updates that same file after every
request, response, or error, so the directory also serves as workflow history.
If Chromium forgets the permission, choose the directory again. Clearing the
latest log in the sidebar does not delete historical files.
