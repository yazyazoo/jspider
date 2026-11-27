import { describe, expect, it } from 'vitest';
import { createExtensionManifest } from '../../scripts/site-manifest.mjs';

const baseManifest = {
  manifest_version: 3,
  permissions: ['storage', 'tabs'],
  host_permissions: ['https://api.themoviedb.org/*'],
  content_scripts: [{ matches: [], js: ['content.js'], run_at: 'document_idle' }],
  web_accessible_resources: [{ resources: ['sidebar.html'], matches: [] }],
};

const catalog = [
  {
    siteId: 'one',
    siteName: 'One',
    origins: ['https://one.example'],
    articleMatches: ['https://one.example/article/*'],
    searchMatches: [],
    capabilities: { article: true, search: false },
  },
  {
    siteId: 'two',
    siteName: 'Two',
    origins: ['https://two.example'],
    articleMatches: ['https://two.example/index.php*'],
    searchMatches: [],
    capabilities: { article: true, search: false },
  },
];

describe('site manifest projection', () => {
  it('preserves general permissions and adds site entries exactly once', () => {
    const manifest = createExtensionManifest(baseManifest, catalog);

    expect(manifest.permissions).toEqual(['storage', 'tabs']);
    expect(manifest.host_permissions).toEqual([
      'https://api.themoviedb.org/*',
      'https://one.example/*',
      'https://two.example/*',
    ]);
    expect(manifest.content_scripts[0].matches).toEqual([
      'https://one.example/article/*',
      'https://two.example/index.php*',
    ]);
    expect(manifest.web_accessible_resources[0].matches).toEqual([
      'https://one.example/*',
      'https://two.example/*',
    ]);
  });

  it.each([
    [['one', 'one'], 'siteId'],
    [['one', 'two'], 'origin'],
    [['one', 'three'], 'article match'],
  ])('rejects duplicate catalog values (%s)', (ids, message) => {
    const duplicate = structuredClone(catalog);
    duplicate[1].siteId = ids[1];
    if (message === 'origin') duplicate[1].origins = [duplicate[0].origins[0]];
    if (message === 'article match') {
      duplicate[0].articleMatches = [
        duplicate[0].articleMatches[0],
        duplicate[0].articleMatches[0],
      ];
    }
    expect(() => createExtensionManifest(baseManifest, duplicate)).toThrow(message);
  });

  it('rejects non-HTTPS origins and patterns outside declared origins', () => {
    const insecure = structuredClone(catalog);
    insecure[0].origins = ['http://one.example'];
    expect(() => createExtensionManifest(baseManifest, insecure)).toThrow('HTTPS');

    const foreignPattern = structuredClone(catalog);
    foreignPattern[0].articleMatches = ['https://evil.example/article/*'];
    expect(() => createExtensionManifest(baseManifest, foreignPattern)).toThrow('declared origin');
  });

  it('rejects wildcard origins and malformed Chromium match patterns', () => {
    const wildcardOrigin = structuredClone(catalog);
    wildcardOrigin[0].origins = ['https://*.example.com'];
    expect(() => createExtensionManifest(baseManifest, wildcardOrigin)).toThrow('exact hostname');

    for (const pattern of [
      'https://user:pass@one.example/article/*',
      'https://one.example:8443/article/*',
      'https://one.example:443/article/*',
      'https://one.example/article/?page=*',
      'https://one.example/article/#fragment',
    ]) {
      const malformed = structuredClone(catalog);
      malformed[0].articleMatches = [pattern];
      expect(() => createExtensionManifest(baseManifest, malformed)).toThrow('valid Chromium match');
    }
  });
});
