function normalizePath(value: string): { path: string; parts: string[] } {
  const input = value.trim();
  if (!input) throw new Error('Inserisci il percorso completo della cartella log.');
  if (/\p{Cc}/u.test(input)) throw new Error('Il percorso completo contiene caratteri non validi.');

  if (/^[A-Za-z]:[\\/]/.test(input)) {
    const path = input.replace(/\//g, '\\').replace(/\\+/g, '\\').replace(/\\$/, '');
    return { path, parts: path.slice(3).split('\\').filter(Boolean) };
  }
  if (input.startsWith('/')) {
    const path = input.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    return { path, parts: path.split('/').filter(Boolean) };
  }
  throw new Error('Inserisci il percorso completo assoluto della cartella log.');
}

export function validateExistingLogPath(value: string, directoryName: string): string {
  const { path, parts } = normalizePath(value);
  if (directoryName.toLocaleLowerCase() !== 'log' || parts.at(-1)?.toLocaleLowerCase() !== 'log') {
    throw new Error('Seleziona direttamente la cartella “log” indicata nel percorso configurato.');
  }
  return path;
}

export function resolveLogDirectoryPath(
  configuredPath: string | undefined,
): string {
  return configuredPath?.trim() ?? '';
}
