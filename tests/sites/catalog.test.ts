import { describe, expect, it } from 'vitest';
import { requireSiteDefinition, siteDefinitions } from '../../src/sites/catalog';
import { siteModules } from '../../src/sites/registry';

describe('site catalog', () => {
  it('declares the two current article-only sites', () => {
    expect(siteDefinitions.map(({ siteId }) => siteId)).toEqual([
      'titanhd',
      'laforestaincantata',
    ]);

    for (const definition of siteDefinitions) {
      expect(definition.capabilities).toEqual({ article: true, search: false });
      expect(definition.searchMatches).toEqual([]);
    }
  });

  it('uses unique ids, origins and article patterns', () => {
    const ids = siteDefinitions.map(({ siteId }) => siteId);
    const origins = siteDefinitions.flatMap(({ origins }) => origins);
    const patterns = siteDefinitions.flatMap(({ articleMatches }) => articleMatches);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(origins).size).toBe(origins.length);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('allows only bare HTTPS origins', () => {
    for (const definition of siteDefinitions) {
      for (const origin of definition.origins) {
        const parsed = new URL(origin);
        expect(parsed.protocol).toBe('https:');
        expect(parsed.username).toBe('');
        expect(parsed.password).toBe('');
        expect(parsed.pathname).toBe('/');
        expect(parsed.search).toBe('');
        expect(parsed.hash).toBe('');
        expect(origin).toBe(parsed.origin);
      }
    }
  });

  it('requires known definitions with an explicit error', () => {
    expect(requireSiteDefinition('titanhd').siteName).toBe('TitanHD');
    expect(() => requireSiteDefinition('missing')).toThrowError(
      'Unknown site definition: missing',
    );
  });

  it('keeps registered article modules aligned with the catalog', () => {
    expect(siteModules.map(({ definition }) => definition.siteId))
      .toEqual(siteDefinitions.map(({ siteId }) => siteId));
    for (const module of siteModules) {
      expect(module.article?.id).toBe(module.definition.siteId);
      expect(module.article?.name).toBe(module.definition.siteName);
      expect(module.article?.patterns).toEqual(module.definition.articleMatches);
    }
  });
});
