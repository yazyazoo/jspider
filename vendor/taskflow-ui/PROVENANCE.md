# TaskFlow WebUI bundle

- Source repository: `https://github.com/redprimrose-org/taskflow`
- Deployment snapshot: `https://taskflow.redprimrose.mov/ui/assets/index-CSPlTJzX.js`
- Source revision: not exposed by the deployed artifact
- Expected source path: `webui/dist/taskflow-ui.es.js`
- SHA-256: `797a339d0af2d1c64c548bb0eac4f0e8f8c3f422ffd643ce2a2fe58893d82b95`
- License: MIT, reproduced in `LICENSE`
- Vendored on: 2026-11-14

The bundle is included locally so Manifest V3 never executes remote JavaScript.
Refresh it only from a reviewed TaskFlow revision and rerun the JSpider build and tests.

JSpider does not modify this bundle. Its local `taskflow-create-bridge.ts`
adapter seeds the existing Create state after a successful TaskFlow submission.
The adapter requires the deployed `selectablePackages` contract so waiting,
preparing, needs-attention and ready packages can all be preselected. It fails
visibly if that contract or a submitted package ID is absent.

