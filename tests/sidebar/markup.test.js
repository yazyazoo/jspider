import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { createExtensionManifest } from '../../scripts/site-manifest.mjs';

function sidebar() {
  const html = readFileSync(new URL('../../src/sidebar/sidebar.html', import.meta.url), 'utf8');
  return new JSDOM(html).window.document;
}

describe('sidebar fallback action', () => {
  it('renders mutually exclusive Quick Workflow and TaskFlow branches', () => {
    const document = sidebar();
    expect(document.querySelector('#mode-quick')?.hasAttribute('checked')).toBe(true);
    expect(document.querySelector('#quick-panel')).not.toBeNull();
    expect(document.querySelector('#taskflow-panel')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('#quick-workflow')?.textContent).toBe('Quick Workflow');
    expect(document.querySelector('#load-packages')?.textContent).toBe('Carica package su JD');
    const cleanup = document.querySelector('#cleanup');
    expect(cleanup).not.toBeNull();
    expect(cleanup?.hasAttribute('checked')).toBe(true);
    expect(cleanup?.closest('.quick-flags')?.querySelector('#autodownload')).not.toBeNull();
    expect(document.querySelector('#task-list')).toBeNull();
    expect(document.querySelector('#task-json')).toBeNull();
  });

  it('connects every info icon to an existing tooltip', () => {
    const document = sidebar();
    const icons = [...document.querySelectorAll('[data-tooltip]')];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      const id = icon.getAttribute('aria-describedby');
      const tooltip = id ? document.getElementById(id) : null;
      expect(tooltip?.getAttribute('role'), id ?? 'missing aria-describedby').toBe('tooltip');
    }
  });

  it('explains both execution modes next to the enabled-by-default setting', () => {
    const document = sidebar();
    expect(document.querySelector('#settings-panel #protected-execution')?.hasAttribute('checked')).toBe(true);
    const text = document.querySelector('#tip-protected-execution')?.textContent;
    expect(text).toContain('Attiva (consigliata)');
    expect(text).toContain('scheda JSpider in secondo piano');
    expect(text).toContain('Disattiva:');
    expect(text).toContain('Chromium può interrompere');
  });

  it('uses a right-aligned title action group and a dedicated settings popover', () => {
    const document = sidebar();
    const actions = document.querySelector('#header-actions');
    expect(actions?.querySelector('#overlay-width-control')).not.toBeNull();
    expect(actions?.querySelector('#settings-button')?.textContent).toBe('Impostazioni');
    expect(actions?.querySelector('#quick-log-button')?.textContent).toBe('Log JSON');
    expect(actions?.querySelector('#refresh')).not.toBeNull();
    expect(document.querySelector('#settings-panel form#settings-form')).not.toBeNull();
    expect(document.querySelector('#settings-panel #log-directory-state')).not.toBeNull();
    const configuredLogDirectory = document.querySelector('#settings-panel #log-directory-config');
    expect(configuredLogDirectory?.getAttribute('type')).toBe('text');
    expect(configuredLogDirectory?.hasAttribute('readonly')).toBe(false);
    expect(document.querySelector('#settings-panel #log-directory-choose')?.textContent)
      .toBe('Autorizza cartella log');
    expect(document.querySelector('#settings-panel #webui-version-check')?.textContent)
      .toBe('Controlla aggiornamenti WebUI');
    expect(document.querySelector('#settings-panel #webui-version-state')).not.toBeNull();
    expect(document.querySelector('#tip-webui-version')?.textContent)
      .toContain('Aggiorna-WebUI.cmd');
    expect(document.querySelector('#tip-webui-version')?.textContent)
      .toContain('Aggiorna-WebUI.command');
    expect(document.querySelector('#tip-webui-version')?.textContent)
      .toContain('test e build');
    expect(document.querySelector('#quick-log-panel #quick-log-entries')).not.toBeNull();
    expect(document.querySelector('#quick-log-copy')?.textContent).toBe('Copia tutto');
    expect(document.querySelector('#quick-log-clear')?.textContent).toBe('Svuota');
    expect(document.querySelector('details#settings')).toBeNull();
  });

  it('does not include the administrative TaskFlow WebUI in settings', () => {
    const document = sidebar();
    expect(document.querySelector('#taskflow-connect')).toBeNull();
    expect(document.querySelector('#taskflow-admin-ui')).toBeNull();
    expect(document.querySelector('#taskflow-ui-slot')).toBeNull();
    expect(document.querySelector('#taskflow-create-slot')).not.toBeNull();
  });

  it('shows TaskFlow, TMDB, OMDb and MDBList credentials as clear text fields', () => {
    const document = sidebar();
    expect(document.querySelector('#taskflow-token')?.getAttribute('type')).toBe('text');
    expect(document.querySelector('#tmdb-token')?.getAttribute('type')).toBe('text');
    expect(document.querySelector('#omdb-api-key')?.getAttribute('type')).toBe('text');
    expect(document.querySelector('#mdblist-api-key')?.getAttribute('type')).toBe('text');
  });

  it('grants the background client access only to the MDBList API origin', () => {
    const baseManifest = JSON.parse(readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));
    const catalog = JSON.parse(readFileSync(new URL('../../src/sites/catalog.json', import.meta.url), 'utf8'));
    const manifest = createExtensionManifest(baseManifest, catalog);
    expect(manifest.host_permissions).toContain('https://api.mdblist.com/*');
    expect(manifest.host_permissions).toContain('https://titanhd.space/*');
    expect(manifest.host_permissions).toContain('https://laforestaincantata.org/*');
    expect(manifest.host_permissions).not.toContain('https://www.rottentomatoes.com/*');
  });

  it('labels the two explicit metadata searches and removes the global fallback button', () => {
    const document = sidebar();
    expect(document.querySelector('#imdb-search')?.textContent).toBe('Cerca tramite IMDb');
    expect(document.querySelector('#tmdb-search')?.textContent).toBe('Cerca su TMDB');
    expect(document.querySelector('#metadata-fallback')).toBeNull();
  });

  it('places the read-only Emby result in phase 1 below the candidate cards', () => {
    const document = sidebar();
    const results = document.querySelector('#results');
    const emby = document.querySelector('#emby-status');
    expect(emby).not.toBeNull();
    expect(emby?.closest('#phase-1')).not.toBeNull();
    expect(results?.nextElementSibling).toBe(emby);
  });

  it('gives every workflow phase a stable validation target', () => {
    const document = sidebar();
    expect([...document.querySelectorAll('#home-view > section')].map((section) => section.id))
      .toEqual(['phase-1', 'phase-2', 'phase-3']);
  });

  it('places Follow season beside host selection with an accessible explanation', () => {
    const document = sidebar();
    const control = document.querySelector('#follow-season');
    const hostFieldset = document.querySelector('#host-selection');
    expect(control).not.toBeNull();
    expect(control?.closest('#phase-2')).not.toBeNull();
    expect(hostFieldset?.nextElementSibling?.contains(control)).toBe(true);
    expect(document.querySelector('#follow-season-state')?.getAttribute('aria-live')).toBe('polite');
    const info = document.querySelector('[aria-describedby="tip-follow-season"]');
    expect(info?.hasAttribute('data-tooltip')).toBe(true);
    expect(document.querySelector('#tip-follow-season')?.textContent)
      .toContain('URL esatti');
  });

  it('requires an explicit preset and replaces the old footer with a WebUI button', () => {
    const document = sidebar();
    expect(document.querySelector('#workflow-preset option[value=""]')?.textContent)
      .toBe('Seleziona un preset TaskFlow');
    expect(document.querySelector('#preset-summary')?.textContent)
      .toContain('Seleziona un preset');
    const webui = document.querySelector('#open-taskflow-webui');
    expect(webui?.textContent).toBe('Apri WebUI TaskFlow');
    expect(webui?.tagName).toBe('BUTTON');
    expect(document.querySelector('#taskflow-full-panel')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('#home-view')).not.toBeNull();
    expect(document.querySelector('footer')?.textContent).not.toContain('Dati TMDB');
    expect(document.querySelector('footer')?.textContent).not.toContain('sviluppo locale');
  });
});
