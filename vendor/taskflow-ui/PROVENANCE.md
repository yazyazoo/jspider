# TaskFlow WebUI bundle

- Source repository: `https://github.com/redprimrose-org/taskflow`
- Live component: `https://taskflow.redprimrose.mov/ui/taskflow-ui.es.js`
- Reviewed revision metadata: `version.json`
- Source revision: identified by ETag, Last-Modified and SHA-256 in `version.json`
- Expected source path: `webui/dist/taskflow-ui.es.js`
- License: MIT, reproduced in `LICENSE`
- First vendored on: 2026-11-14

The bundle is included locally so Manifest V3 never executes remote JavaScript.
Refresh it with `npm run update:webui`. The updater validates the integration
contract, runs the complete JSpider verification, rebuilds `dist`, and restores
the previous revision if verification fails.

JSpider does not modify this bundle. Its local `taskflow-create-bridge.ts`
adapter seeds the existing Create state after a successful TaskFlow submission.
The adapter requires the deployed `selectablePackages` contract so waiting,
preparing, needs-attention and ready packages can all be preselected. It fails
visibly if that contract or a submitted package ID is absent.

