import { access, readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const candidates = [
  resolve(root, 'src'),
  resolve(root, 'manifest.json'),
  ...['background.js', 'content.js', 'sidebar.js', 'sidebar.html', 'sidebar.css', 'manifest.json']
    .map((name) => resolve(root, 'dist', name)),
];
const targets = [];
for (const candidate of candidates) {
  try { await access(candidate); targets.push(candidate); } catch { /* build not present yet */ }
}
const forbidden = [
  /myjd/i,
  /my\.jdownloader/i,
  /myjdownloader/i,
  /jdapi/i,
  /jd-send/i,
  /click.?n.?load/i,
  /cnl2/i,
  /127\.0\.0\.1:9666/i,
  /comment/i,
  /automatic_workflow/i,
  /bypassLinkgrabber/i,
  /chrome\.webRequest/i,
  /chrome\.offscreen/i,
  /clipboard/i,
  /selectedTasks/,
  /runTaskFlowPipeline/,
  /composeWorkflowPayload/,
  /submissionMode/,
  /taskflow\.run/,
  /taskflow\.start/,
  /preview-label/,
  /workflow-flags/,
  /taskflow-connect/,
  /taskflow-admin-ui/,
  /taskflow-ui-slot/,
  /toggleTaskFlowUi/,
  /TaskFlowUiState/,
  /nextTaskFlowUiState/,
  /metadata-fallback/,
  /taskflow-admin-heading/,
  /settings-body/,
];

async function files(path) {
  const stat = await import('node:fs/promises').then(({ stat }) => stat(path));
  if (stat.isFile()) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => files(join(path, entry.name))))).flat();
}

const findings = [];
for (const target of targets) {
  for (const file of await files(target)) {
    if (!['.ts', '.js', '.html', '.css', '.json'].includes(extname(file))) continue;
    const text = await readFile(file, 'utf8');
    for (const pattern of forbidden) if (pattern.test(text)) findings.push(`${file}: ${pattern}`);
  }
}
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Legacy MyJD/comment and superseded Create paths: none found in JSpider source or build.');
}

