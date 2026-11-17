export interface VisibleSettings {
  taskflowBaseUrl: string;
  taskflowToken: string;
  tmdbCredential: string;
  omdbApiKey: string;
}

export interface SettingsFields {
  taskflowBaseUrl: HTMLInputElement;
  taskflowToken: HTMLInputElement;
  tmdbCredential: HTMLInputElement;
  omdbApiKey: HTMLInputElement;
}

export function fillSettingsFields(settings: VisibleSettings, fields: SettingsFields): void {
  fields.taskflowBaseUrl.value = settings.taskflowBaseUrl;
  fields.taskflowToken.value = settings.taskflowToken;
  fields.tmdbCredential.value = settings.tmdbCredential;
  fields.omdbApiKey.value = settings.omdbApiKey;
}

export function readSettingsFields(fields: SettingsFields): VisibleSettings {
  return {
    taskflowBaseUrl: fields.taskflowBaseUrl.value,
    taskflowToken: fields.taskflowToken.value,
    tmdbCredential: fields.tmdbCredential.value,
    omdbApiKey: fields.omdbApiKey.value,
  };
}
