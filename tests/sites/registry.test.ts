import { describe, expect, it } from 'vitest';
import { resolveSiteAdapter } from '../../src/sites/registry';

describe('site registry', () => {
  it('routes supported title pages to one exact adapter and rejects unrelated pages', () => {
    expect(resolveSiteAdapter('https://titanhd.space/catalogo/14481')?.id).toBe('titanhd');
    expect(resolveSiteAdapter('https://laforestaincantata.org/index.php?newsid=503997')?.id)
      .toBe('laforestaincantata');
    expect(resolveSiteAdapter('https://laforestaincantata.org/')).toBeNull();
    expect(resolveSiteAdapter('https://example.com/catalogo/14481')).toBeNull();
  });
});

