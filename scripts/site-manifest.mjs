function unique(values) {
  return [...new Set(values)];
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label} in site catalog.`);
  }
}

function normalizeOrigin(value, siteId) {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error(`Invalid origin for ${siteId}.`); }
  if (parsed.hostname.includes('*')) {
    throw new Error(`Site ${siteId} must use an exact hostname.`);
  }
  if (parsed.protocol !== 'https:' || parsed.origin !== value || parsed.pathname !== '/'
    || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`Site ${siteId} must use a bare HTTPS origin.`);
  }
  return parsed.origin;
}

function matchOrigin(pattern, siteId) {
  let parsed;
  try { parsed = new URL(pattern); }
  catch { throw new Error(`Invalid match pattern for ${siteId}.`); }
  const authority = pattern.slice(`${parsed.protocol}//`.length).split('/')[0] ?? '';
  if (parsed.protocol !== 'https:' || authority !== parsed.hostname || parsed.username || parsed.password
    || parsed.port || parsed.search || parsed.hash) {
    throw new Error(`Site ${siteId} must use a valid Chromium match pattern.`);
  }
  return parsed.origin;
}

export function validateSiteCatalog(catalog) {
  if (!Array.isArray(catalog)) throw new Error('Site catalog must be an array.');
  const siteIds = [];
  const origins = [];
  const matches = [];

  for (const definition of catalog) {
    if (!definition || typeof definition !== 'object' || typeof definition.siteId !== 'string'
      || !definition.siteId) throw new Error('Every site must have a siteId.');
    siteIds.push(definition.siteId);
    if (!Array.isArray(definition.origins) || !Array.isArray(definition.articleMatches)
      || !Array.isArray(definition.searchMatches)) {
      throw new Error(`Invalid catalog arrays for ${definition.siteId}.`);
    }
    const declaredOrigins = definition.origins.map((origin) => normalizeOrigin(origin, definition.siteId));
    origins.push(...declaredOrigins);
    const siteMatches = [...definition.articleMatches, ...definition.searchMatches];
    for (const pattern of siteMatches) {
      if (typeof pattern !== 'string' || !declaredOrigins.includes(matchOrigin(pattern, definition.siteId))) {
        throw new Error(`Site ${definition.siteId} match pattern does not belong to a declared origin.`);
      }
    }
    matches.push(...siteMatches);
  }

  assertUnique(siteIds, 'siteId');
  assertUnique(origins, 'origin');
  assertUnique(matches, 'article match');
}

export function createExtensionManifest(baseManifest, catalog) {
  validateSiteCatalog(catalog);
  const manifest = structuredClone(baseManifest);
  const origins = catalog.flatMap((definition) => definition.origins);
  const articleMatches = catalog.flatMap((definition) => definition.articleMatches);
  const sitePermissions = origins.map((origin) => `${origin}/*`);

  manifest.host_permissions = unique([
    ...(manifest.host_permissions ?? []),
    ...sitePermissions,
  ]);

  if (!Array.isArray(manifest.content_scripts) || !manifest.content_scripts[0]) {
    throw new Error('Base manifest requires a content script template.');
  }
  manifest.content_scripts[0] = {
    ...manifest.content_scripts[0],
    matches: unique(articleMatches),
  };

  if (!Array.isArray(manifest.web_accessible_resources)
    || !manifest.web_accessible_resources[0]) {
    throw new Error('Base manifest requires a web-accessible resource template.');
  }
  manifest.web_accessible_resources[0] = {
    ...manifest.web_accessible_resources[0],
    matches: unique(sitePermissions),
  };

  return manifest;
}
