export function normalizeTaskFlowBaseUrl(value: string): string {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const secureTransport = url.protocol === 'https:' || (url.protocol === 'http:' && loopback);
  const bareOrigin = !url.username && !url.password && url.pathname === '/'
    && !url.search && !url.hash;
  if (!secureTransport || !bareOrigin) {
    throw new Error('L’URL TaskFlow deve essere un’origine HTTPS oppure HTTP su loopback, senza credenziali, percorsi, query o frammenti.');
  }
  return url.origin;
}
