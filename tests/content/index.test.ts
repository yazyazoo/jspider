// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

let resolveContentArticle: typeof import('../../src/content/index')['resolveContentArticle'];

beforeAll(async () => {
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
      onMessage: { addListener: vi.fn() },
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
      },
    },
  });
  ({ resolveContentArticle } = await import('../../src/content/index'));
});

describe('content site resolution', () => {
  it('uses the common module registry instead of importing a site directly', () => {
    expect(resolveContentArticle('https://titanhd.space/catalogo/14481')?.id).toBe('titanhd');
    expect(resolveContentArticle('https://example.com/title/1')).toBeNull();
  });
});
