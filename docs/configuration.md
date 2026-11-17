English | [Italiano](configuration.it.md)

# Configuration

JSpider reads `config.local.json` from the extension root. The tracked
`config.example.json` contains every supported key and placeholder values.

For source builds, keep `config.local.json` in the repository root. `npm run
build` copies it into the ignored `dist/` directory. For a downloaded release,
create the file directly beside the extracted `manifest.json`.

## Fields

| Key | Purpose |
| --- | --- |
| `taskflowBaseUrl` | TaskFlow origin, without `/api/v1` |
| `taskflowToken` | Administrative Bearer token used by the TaskFlow WebUI and API client |
| `tmdbCredential` | TMDB read-access token or v3 API key |
| `omdbApiKey` | OMDb API key; stored for testing but not yet used by a network client |
| `embyBaseUrl` | HTTPS origin of the Emby server |
| `embyToken` | Emby API token sent only through the `X-Emby-Token` header |

TaskFlow, TMDB, and OMDb values can also be saved from the JSpider settings
panel. Explicit browser values in `chrome.storage.local`, including empty
values, override their local defaults. During the current test phase those
settings fields intentionally show their values in clear text.

Emby is configured only through `config.local.json`. Its lookup is read-only,
uses the validated TMDB ID when available, and falls back to title/year only
after the explicit fallback choice.

## Secret handling

- `config.local.json`, `.env*`, keys, certificates, `dist/`, and `release/` are
  ignored by Git.
- Release packaging explicitly excludes `config.local.json` even when a local
  build copied it into `dist/`.
- Tokens are not placed in request URLs or rendered in the Emby status panel.
- Use HTTPS endpoints for TaskFlow and Emby so credentials are encrypted in
  transit.

Never replace placeholders in `config.example.json` with real credentials.
