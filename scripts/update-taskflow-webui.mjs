import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TASKFLOW_WEBUI_URL = 'https://taskflow.redprimrose.mov/ui/taskflow-ui.es.js';

const requiredContractMarkers = [
  'selectablePackages',
  'needs_attention',
  'changePreset',
  'customElements.define',
  'taskflow-ui',
];

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validateCandidate(source) {
  const missing = requiredContractMarkers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    throw new Error(`WebUI TaskFlow incompatibile con il contratto JSpider: mancano ${missing.join(', ')}.`);
  }
}

async function atomicWrite(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

async function optionalRead(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export function commandInvocation(
  command,
  args,
  platform = process.platform,
  commandProcessor = process.env.ComSpec || 'cmd.exe',
) {
  if (platform === 'win32' && command === 'npm') {
    return {
      executable: commandProcessor,
      args: ['/d', '/s', '/c', [command, ...args].join(' ')],
    };
  }
  return { executable: command, args };
}

function defaultRunCommand(command, args, root) {
  return new Promise((resolvePromise, reject) => {
    const invocation = commandInvocation(command, args);
    const child = spawn(invocation.executable, invocation.args, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} terminato con codice ${code ?? 'sconosciuto'}.`));
    });
  });
}

async function restore(path, previous, writeAtomic = atomicWrite) {
  if (previous === null) await rm(path, { force: true });
  else await writeAtomic(path, previous);
}

export async function updateTaskFlowWebUi({
  root = resolve(import.meta.dirname, '..'),
  fetcher = globalThis.fetch,
  runCommand = defaultRunCommand,
  now = () => new Date(),
  log = console.log,
  writeAtomic = atomicWrite,
} = {}) {
  const bundlePath = resolve(root, 'vendor/taskflow-ui/taskflow-ui.es.js');
  const versionPath = resolve(root, 'vendor/taskflow-ui/version.json');
  const previousBundle = await optionalRead(bundlePath);
  const previousVersion = await optionalRead(versionPath);
  let installed = false;

  log('[0%] Avvio aggiornamento WebUI TaskFlow');
  const response = await fetcher(TASKFLOW_WEBUI_URL);
  if (!response?.ok) {
    throw new Error(`Download WebUI TaskFlow non riuscito: HTTP ${response?.status ?? 'sconosciuto'}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const source = bytes.toString('utf8');
  log('[10%] Download WebUI completato');
  validateCandidate(source);
  log('[20%] Contratto JSpider–TaskFlow verificato');

  const metadata = {
    source: TASKFLOW_WEBUI_URL,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    sha256: digest(bytes),
    syncedAt: now().toISOString(),
  };

  try {
    await writeAtomic(bundlePath, bytes);
    installed = true;
    await writeAtomic(versionPath, `${JSON.stringify(metadata, null, 2)}\n`);
    log('[30%] Candidato WebUI installato localmente');

    log('[35%] Controllo TypeScript');
    await runCommand('npm', ['run', 'check'], root);
    log('[45%] Controllo TypeScript completato');

    log('[50%] Test JSpider');
    await runCommand('npm', ['test'], root);
    log('[70%] Test JSpider completati');

    log('[75%] Audit codice legacy');
    await runCommand('npm', ['run', 'audit:legacy'], root);
    log('[85%] Audit completato');

    log('[90%] Build dist');
    await runCommand('npm', ['run', 'build'], root);
    log('[95%] Build dist completata');
    log('[100%] Aggiornamento WebUI completato');
    return metadata;
  } catch (error) {
    if (installed) {
      log('[ROLLBACK] Ripristino della WebUI precedente');
      await restore(bundlePath, previousBundle, writeAtomic);
      await restore(versionPath, previousVersion, writeAtomic);
      await runCommand('npm', ['run', 'build'], root);
    }
    throw error;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  updateTaskFlowWebUi().catch((error) => {
    console.error(`[ERRORE] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
