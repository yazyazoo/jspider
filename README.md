English | [Italiano](README.it.md)

# JSpider

JSpider is a Chromium Manifest V3 extension that reads supported release pages,
compares available versions, validates metadata with TMDB, reports whether a
title is already present in Emby, and creates workflows through the public
TaskFlow API.

```text
JSpider → TaskFlow API → TaskFlow JDownloader integration → JD
```

JSpider has no MyJDownloader SDK, login, session, JD-comment protocol, direct
JD call, or Click'n'Load interception. Normal Click'n'Load remains the
responsibility of the official MyJDownloader extension.

## Install a release

1. Download [jspider-v0.1.0.zip](https://github.com/yazyazoo/jspider/releases/download/v0.1.0/jspider-v0.1.0.zip)
   from [GitHub Releases](https://github.com/yazyazoo/jspider/releases).
2. Extract it to a permanent directory.
3. Copy `config.example.json` to `config.local.json` and enter the required
   endpoints and credentials.
4. Open the extensions page in a Chromium browser, enable Developer mode, and
   choose **Load unpacked**.
5. Select the extracted directory containing `manifest.json`.

Release archives never contain `config.local.json` or private credentials.

Alternatively, clone the repository and load the already compiled
[dist/](https://github.com/yazyazoo/jspider/tree/main/dist) directory. Create
`dist/config.local.json` from the included example before use; that local file
is ignored by Git.

## Development

Requirements: Node.js 22+ and a Chromium 120+ browser.

```powershell
npm ci
npm run verify
```

The build refreshes the tracked `JSpider/dist` directory. Load `JSpider/dist`
as the unpacked extension; do not load the repository root. When root
`config.local.json` exists, the local build copies it into `dist/`, but that
local configuration remains ignored by Git.

Create the same secret-free ZIP used by releases with:

```powershell
npm run package:extension
```

The archive is written under `release/` with `manifest.json` at its root.

## Documentation

- [Configuration](docs/configuration.md)
- [Installation and distribution](docs/installation.md)
- [Development](docs/development.md)
- [Architecture](docs/architecture.md)
- [Operator manual](docs/operator-manual.md)

## Main workflow

The in-page sidebar shares title validation and version selection between two
exclusive creation modes:

- **Quick Workflow** submits packages and uses one TaskFlow preset for Create
  and Start. With Autodownload disabled, submission stops in LinkGrabber.
- **TaskFlow** submits packages and opens the bundled TaskFlow Create view with
  common metadata prefilled; that view remains authoritative for presets,
  tasks, parameters, cleanup, Create, and Start.

The Emby panel in phase 1 is read-only and informational. A red indicator means
matching files are present; green means absent; ambiguous or unreachable states
remain distinct and never affect workflow creation.

## License

JSpider is GPL-3.0-or-later. See `NOTICE` for provenance. The bundled TaskFlow
WebUI retains its MIT license under `vendor/taskflow-ui`.
