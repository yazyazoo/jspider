import { describe, expect, it } from 'vitest';
import { normalizeArchiveUrl, selectArchiveLinks } from '../../src/domain/archive-links';

describe('normalizeArchiveUrl', () => {
  it('accepts only direct HTTPS archive links and bare host file identifiers', () => {
    expect(normalizeArchiveUrl('https://terabytez.org/abc/file.part01.rar')).toBe(
      'https://terabytez.org/abc/file.part01.rar',
    );
    expect(normalizeArchiveUrl('https://filestore.me/2e34fudfmqcr')).toBe(
      'https://filestore.me/2e34fudfmqcr',
    );
    expect(normalizeArchiveUrl('https://filestore.me/2e34fudfmqcr?ref=partner')).toBeNull();
    expect(normalizeArchiveUrl('http://terabytez.org/abc/file.rar')).toBeNull();
    expect(normalizeArchiveUrl('https://evil.example/file.rar')).toBeNull();
  });
});

describe('selectArchiveLinks', () => {
  it('deduplicates links and keeps only explicitly selected hosts', () => {
    expect(selectArchiveLinks([
      'https://terabytez.org/a/file.rar',
      'https://filestore.me/2e34fudfmqcr',
      'https://terabytez.org/a/file.rar',
    ], ['terabytez.org'])).toEqual(['https://terabytez.org/a/file.rar']);
  });
});

