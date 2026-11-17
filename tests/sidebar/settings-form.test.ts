// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  fillSettingsFields,
  readSettingsFields,
  type SettingsFields,
} from '../../src/sidebar/settings-form';

function fields(): SettingsFields {
  document.body.innerHTML = `
    <input id="url">
    <input id="taskflow">
    <input id="tmdb">
    <input id="omdb">
    <input id="mdblist">
  `;
  return {
    taskflowBaseUrl: document.querySelector<HTMLInputElement>('#url')!,
    taskflowToken: document.querySelector<HTMLInputElement>('#taskflow')!,
    tmdbCredential: document.querySelector<HTMLInputElement>('#tmdb')!,
    omdbApiKey: document.querySelector<HTMLInputElement>('#omdb')!,
    mdblistApiKey: document.querySelector<HTMLInputElement>('#mdblist')!,
  };
}

describe('visible settings form', () => {
  it('fills every field with the saved value in clear', () => {
    const view = fields();

    fillSettingsFields({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: 'omdb-secret',
      mdblistApiKey: 'mdblist-secret',
    }, view);

    expect(readSettingsFields(view)).toEqual({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: 'taskflow-secret',
      tmdbCredential: 'tmdb-secret',
      omdbApiKey: 'omdb-secret',
      mdblistApiKey: 'mdblist-secret',
    });
  });

  it('returns empty fields so saving can delete an existing credential', () => {
    const view = fields();
    view.taskflowBaseUrl.value = 'https://taskflow.example';
    view.taskflowToken.value = '';
    view.tmdbCredential.value = '';
    view.omdbApiKey.value = '';
    view.mdblistApiKey.value = '';

    expect(readSettingsFields(view)).toEqual({
      taskflowBaseUrl: 'https://taskflow.example',
      taskflowToken: '',
      tmdbCredential: '',
      omdbApiKey: '',
      mdblistApiKey: '',
    });
  });
});
