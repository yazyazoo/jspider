English | [Italiano](development.it.md)

# Development

## Requirements

- Node.js 22 or newer
- npm with the checked-in lockfile
- Chrome, Edge, Brave, Vivaldi, Opera, or another Chromium 120+ browser

## Install and verify

```powershell
npm ci
npm run verify
```

`verify` runs TypeScript checking, all Vitest tests, the MyJD/legacy audit, and
the esbuild production build.

Individual commands:

```powershell
npm run check
npm test
npm run audit:legacy
npm run build
```

## Update the embedded TaskFlow WebUI

The settings panel can compare the embedded SHA-256 with the public TaskFlow
component, but a Chromium extension cannot launch npm or rewrite its installed
files. Run the repository-root launcher instead:

- Windows: double-click `Aggiorna-WebUI.cmd`;
- macOS: double-click `Aggiorna-WebUI.command`.

Both launchers run `npm run update:webui`. The terminal shows staged completion
for download, contract validation, TypeScript, the complete test suite, the
legacy audit, and the `dist` build. The updater records ETag, Last-Modified and
SHA-256 in `vendor/taskflow-ui/version.json`. A failed candidate or verification
restores the previous bundle and rebuilds the previous `dist`.

After a successful update, reload JSpider from the Chromium extensions page.

## Load the extension

The build output is `JSpider/dist`. Open the browser's extensions page, enable
Developer mode, choose **Load unpacked**, and select that directory.

After changing the manifest, service worker, or content scripts, rebuild and
use the extension card's Reload action. Refresh the supported title page as
well when a content script changed.

## Configuration during development

Copy `config.example.json` to root `config.local.json` and fill it locally.
The build copies the file into `dist/`; both copies of `config.local.json`
remain ignored while the other compiled files in `dist/` are tracked. A build
also succeeds when the local file is absent.

## Package a release candidate

```powershell
npm run package:extension
```

This reruns the complete verification and creates
`release/jspider-v<version>.zip`. The ZIP contains runtime files directly at
archive root and always excludes local configuration.

After a source change, rebuild and commit the refreshed `dist/` files together
with the source. The generated ZIP is not committed; it is attached to the
matching GitHub Release.

## Automation

`.github/workflows/ci.yml` verifies pushes and pull requests and exposes the
compiled directory as a workflow artifact. `.github/workflows/release.yml` is
inert until a matching `v*` tag is pushed; it requires the tag, package, and
manifest versions to match before creating a GitHub Release asset.

Do not create tags, publish releases, or deploy without explicit authorization.
