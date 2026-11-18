import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/sidebar/sidebar.css', import.meta.url), 'utf8');

describe('responsive sidebar layout', () => {
  it('reserves a compact minimum height for the Emby status', () => {
    expect(css).toMatch(/\.emby-status\s*\{[^}]*min-height:/s);
    expect(css).toMatch(/\.emby-file-list\s*\{[^}]*display:\s*grid/s);
  });

  it('wraps compact Emby season buttons without horizontal scrolling', () => {
    expect(css).toMatch(/\.emby-season-list\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s);
    expect(css).not.toMatch(/\.emby-season-list\s*\{[^}]*overflow-x:\s*(?:auto|scroll)/s);
  });

  it('moves the right header group to its own right-aligned row at narrow widths', () => {
    const narrow = css.match(/@media \(max-width: 620px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(narrow).toContain('header { flex-wrap: wrap; }');
    expect(narrow).toContain('.header-actions { width: 100%; justify-content: flex-end; }');
  });

  it('lays out compact wrapping rating badges with source-specific identities', () => {
    expect(css).toMatch(/\.candidate-ratings\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s);
    expect(css).toMatch(/\.rating-badge\s*\{[^}]*border-radius:/s);
    expect(css).toMatch(/\.rating-logo\s*\{[^}]*object-fit:\s*contain/s);
  });

  it('uses the poster height efficiently and clamps long overviews to three lines', () => {
    expect(css).toMatch(/\.candidate\s*\{[^}]*grid-template-columns:\s*96px\s+minmax\(0,\s*1fr\)/s);
    expect(css).toMatch(/\.candidate-overview\s*\{[^}]*-webkit-line-clamp:\s*3/s);
    expect(css).toMatch(/\.candidate-overview\.expanded\s*\{[^}]*-webkit-line-clamp:\s*unset/s);
    expect(css).toMatch(/\.overview-toggle\s*\{[^}]*background:\s*transparent/s);
    expect(css).toMatch(/@media \(max-width:\s*520px\)[\s\S]*\.candidate\s*\{[^}]*grid-template-columns:\s*72px\s+minmax\(0,\s*1fr\)/s);
  });

  it('keeps the JSON log readable inside a bounded title popover', () => {
    expect(css).toMatch(/\.log-popover\s*\{[^}]*max-height:\s*calc\(100vh\s*-\s*\d+px\)/s);
    expect(css).toMatch(/\.quick-log-entries\s*\{[^}]*overflow:\s*auto/s);
    expect(css).toMatch(/\.quick-log-entry pre\s*\{[^}]*white-space:\s*pre-wrap[^}]*overflow-wrap:\s*anywhere/s);
  });
});
