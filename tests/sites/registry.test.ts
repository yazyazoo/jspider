import { describe, expect, it } from 'vitest';
import type { SiteModule } from '../../src/sites/contracts';
import {
  listSearchProviders,
  resolveArticleModule,
  siteModules,
} from '../../src/sites/registry';

describe('site registry', () => {
  it('routes supported title pages to one exact module and rejects unrelated pages', () => {
    expect(resolveArticleModule('https://titanhd.space/catalogo/14481')?.definition.siteId)
      .toBe('titanhd');
    expect(resolveArticleModule('https://laforestaincantata.org/index.php?newsid=503997')
      ?.definition.siteId).toBe('laforestaincantata');
    expect(resolveArticleModule('https://laforestaincantata.org/')).toBeNull();
    expect(resolveArticleModule('https://example.com/catalogo/14481')).toBeNull();
  });

  it('does not resolve an ambiguous URL or depend on catalog order', () => {
    const duplicate: SiteModule = {
      definition: { ...siteModules[0]!.definition, siteId: 'duplicate' },
      article: siteModules[0]!.article!,
    };
    const reversed = [...siteModules].reverse();

    expect(resolveArticleModule('https://titanhd.space/catalogo/14481', [
      ...siteModules,
      duplicate,
    ])).toBeNull();
    expect(resolveArticleModule('https://titanhd.space/catalogo/14481', reversed)
      ?.definition.siteId).toBe('titanhd');
  });

  it('lists no search providers until a module explicitly exposes one', () => {
    expect(listSearchProviders()).toEqual([]);
  });
});

