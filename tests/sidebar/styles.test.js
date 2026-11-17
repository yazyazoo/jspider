import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/sidebar/sidebar.css', import.meta.url), 'utf8');

describe('responsive sidebar layout', () => {
  it('reserves a compact minimum height for the Emby status', () => {
    expect(css).toMatch(/\.emby-status\s*\{[^}]*min-height:/s);
    expect(css).toMatch(/\.emby-file-list\s*\{[^}]*display:\s*grid/s);
  });

  it('moves the right header group to its own right-aligned row at narrow widths', () => {
    const narrow = css.match(/@media \(max-width: 620px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(narrow).toContain('header { flex-wrap: wrap; }');
    expect(narrow).toContain('.header-actions { width: 100%; justify-content: flex-end; }');
  });

  it('lays out compact wrapping rating badges with source-specific identities', () => {
    expect(css).toMatch(/\.candidate-ratings\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s);
    expect(css).toMatch(/\.rating-badge\s*\{[^}]*border-radius:/s);
    expect(css).toContain('.rating-imdb');
    expect(css).toContain('.rating-tmdb');
    expect(css).toContain('.rating-metacritic');
  });
});
